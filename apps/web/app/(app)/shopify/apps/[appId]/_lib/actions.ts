"use server";

import { revalidatePath } from "next/cache";

import {
  deleteShopifyAppEmailConfig,
  findShopifyAppEmailConfig,
  findShopifyPartnerApp,
  updateShopifyPartnerAppListing,
  updateShopifyShopCrm,
  upsertShopifyAppEmailConfig,
} from "@kit/database";

import { requireUser } from "@/lib/auth/session";
import { analyzeImage } from "@/lib/ai/image-analyzer";
import { generateImage } from "@/lib/ai/image-generator";
import { chat, ECONOMY_CHAIN } from "@/lib/ai/openrouter";
import { optimizeListing } from "@/lib/ai/app-listing-optimizer";
import { sendEmail, type EmailProvider } from "@/lib/email/mailer";
import { decryptSecret, encryptSecret } from "@/lib/shopify/crypto";
import { scrapeAppListing } from "@/lib/audit/shopify-app-listing";
import { runListingChecks } from "@/lib/audit/shopify-listing-checks";

// ─── CRM ────────────────────────────────────────────────────────────

export type UpdateCrmState =
  | { ok: true }
  | { ok: false; error: { message: string } };

export async function updateStoreCrmAction(input: {
  appGid: string;
  shopGid: string;
  field: "email" | "ownerName" | "phone" | "notes" | "country";
  value: string;
}): Promise<UpdateCrmState> {
  await requireUser();

  const trimmed = input.value.trim();
  const val = trimmed.length > 0 ? trimmed : null;

  await updateShopifyShopCrm({
    appGid: input.appGid,
    shopGid: input.shopGid,
    [input.field]: val,
  });

  revalidatePath(`/shopify/apps/${encodeURIComponent(input.appGid)}`);
  return { ok: true };
}

// ─── App Store URL ──────────────────────────────────────────────────

export async function setAppStoreUrlAction(
  appGid: string,
  url: string,
): Promise<{ ok: true } | { ok: false; error: { message: string } }> {
  const user = await requireUser();

  if (!url.includes("apps.shopify.com")) {
    return {
      ok: false,
      error: { message: "URL must be from apps.shopify.com." },
    };
  }

  await updateShopifyPartnerAppListing({
    userId: user.id,
    appGid,
    appStoreUrl: url,
  });

  revalidatePath(`/shopify/apps/${encodeURIComponent(appGid)}`);
  return { ok: true };
}

// ─── Listing sync ───────────────────────────────────────────────────

export type SyncListingState =
  | { ok: true; data: unknown }
  | { ok: false; error: { message: string } };

export async function syncListingAction(
  appGid: string,
  appStoreUrl: string,
): Promise<SyncListingState> {
  const user = await requireUser();

  if (!appStoreUrl.includes("apps.shopify.com")) {
    return {
      ok: false,
      error: { message: "Invalid App Store URL." },
    };
  }

  const started = Date.now();

  const scrapeResult = await scrapeAppListing(appStoreUrl);
  if (!scrapeResult.ok) {
    return {
      ok: false,
      error: {
        message:
          scrapeResult.error.kind === "not_found"
            ? "404 — listing not found. Check the URL."
            : `Scrape failed: ${
                "message" in scrapeResult.error
                  ? scrapeResult.error.message
                  : scrapeResult.error.kind
              }`,
      },
    };
  }

  const pulse = runListingChecks(scrapeResult.data);
  const optResult = await optimizeListing(scrapeResult.data).catch(() => null);

  const cachePayload = {
    listing: scrapeResult.data,
    pulse,
    optimization: optResult?.ok ? optResult.data : null,
    optimizationError:
      optResult === null
        ? "LLM failed."
        : optResult.ok
          ? null
          : optResult.error.message,
    modelUsed: optResult?.ok ? optResult.meta.modelUsed : null,
    durationMs: Date.now() - started,
  };

  await updateShopifyPartnerAppListing({
    userId: user.id,
    appGid,
    listingCache: cachePayload,
  });

  revalidatePath(`/shopify/apps/${encodeURIComponent(appGid)}`);
  return { ok: true, data: cachePayload };
}

// ─── Screenshot AI ─────────────────────────────────────────────────

export async function analyzeScreenshotAction(imageUrl: string, appName: string) {
  await requireUser();
  return analyzeImage(imageUrl, `App Store screenshot for "${appName}" Shopify app`);
}

export async function generateImageAction(prompt: string) {
  await requireUser();
  return generateImage(prompt, {
    size: "1792x1024",
    quality: "standard",
    style: "vivid",
  });
}

// ─── Churn email AI ────────────────────────────────────────────────

export async function generateChurnEmailAction(input: {
  appName: string;
  shopName: string;
  shopDomain: string | null;
  eventType: string;
  ownerName: string | null;
}) {
  await requireUser();

  const eventLabel =
    input.eventType === "RelationshipUninstalled" ? "uninstalled" :
    input.eventType === "RelationshipDeactivated" ? "deactivated" :
    input.eventType === "SubscriptionChargeCanceled" ? "canceled their subscription on" :
    `performed "${input.eventType}" on`;

  const result = await chat(
    [
      {
        role: "user",
        content: `Write a short, warm, personal email from the developer of "${input.appName}" (a Shopify app) to a merchant who just ${eventLabel} the app.

Store name: ${input.shopName}
Store domain: ${input.shopDomain ?? "unknown"}
Contact name: ${input.ownerName ?? "unknown"}

Goals:
1. Empathize — don't be salesy or desperate
2. Ask why they left (was it a bug? missing feature? pricing?)
3. Offer to personally help fix any issue
4. Keep it under 120 words
5. Sound like a real human, not a template

Return ONLY the email body text — no subject line, no greeting prefix like "Subject:", no markdown. Start directly with "Hi {first name}" or "Hey {first name}".`,
      },
    ],
    {
      models: [...ECONOMY_CHAIN],
      temperature: 0.7,
      maxTokens: 500,
    },
  );

  if (!result.ok) {
    return { ok: false as const, error: { message: "AI generation failed." } };
  }

  return { ok: true as const, data: { body: result.data.text.trim() } };
}

// ─── Email settings ────────────────────────────────────────────────

export async function saveEmailSettingsAction(input: {
  appGid: string;
  provider: EmailProvider;
  apiKey: string;
  fromEmail: string;
  fromName: string;
}) {
  const user = await requireUser();

  if (!input.fromEmail.includes("@")) {
    return { ok: false as const, error: { message: "Invalid from email." } };
  }
  if (!input.fromName.trim()) {
    return { ok: false as const, error: { message: "From name is required." } };
  }
  if (input.apiKey.length < 5) {
    return { ok: false as const, error: { message: "API key too short." } };
  }

  const apiKeyEncrypted = encryptSecret(input.apiKey);

  await upsertShopifyAppEmailConfig({
    userId: user.id,
    appGid: input.appGid,
    provider: input.provider,
    apiKeyEncrypted,
    fromEmail: input.fromEmail.trim(),
    fromName: input.fromName.trim(),
  });

  revalidatePath(`/shopify/apps/${encodeURIComponent(input.appGid)}`);
  return { ok: true as const };
}

export async function deleteEmailSettingsAction(appGid: string) {
  const user = await requireUser();
  await deleteShopifyAppEmailConfig(user.id, appGid);
  revalidatePath(`/shopify/apps/${encodeURIComponent(appGid)}`);
  return { ok: true as const };
}

export async function testEmailAction(appGid: string) {
  const user = await requireUser();
  const config = await findShopifyAppEmailConfig(user.id, appGid);
  if (!config) {
    return { ok: false as const, error: { message: "Email not configured." } };
  }

  const apiKey = decryptSecret(config.apiKeyEncrypted);
  const res = await sendEmail({
    provider: config.provider as EmailProvider,
    apiKey,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    to: config.fromEmail,
    subject: "Test email from future-cmo",
    body: "This is a test email to verify your email configuration is working correctly.",
  });

  return res.ok
    ? { ok: true as const, messageId: res.messageId }
    : { ok: false as const, error: { message: res.error.message } };
}

// ─── Send email via configured provider ────────────────────────────

export async function sendAppEmailAction(input: {
  appGid: string;
  to: string;
  subject: string;
  body: string;
}) {
  const user = await requireUser();
  const config = await findShopifyAppEmailConfig(user.id, input.appGid);
  if (!config) {
    return { ok: false as const, error: { message: "Email not configured. Set it up in the Settings tab." } };
  }

  const apiKey = decryptSecret(config.apiKeyEncrypted);
  const res = await sendEmail({
    provider: config.provider as EmailProvider,
    apiKey,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    to: input.to,
    subject: input.subject,
    body: input.body,
  });

  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: { message: res.error.message } };
}
