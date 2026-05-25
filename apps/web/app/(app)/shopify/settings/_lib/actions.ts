"use server";

import { revalidatePath } from "next/cache";

import {
  deleteShopifyPartnerCredentials,
  upsertShopifyPartnerCredentials,
} from "@kit/database";

import { requireUser } from "@/lib/auth/session";
import {
  encryptSecret,
  isEncryptionConfigured,
} from "@/lib/shopify/crypto";
import { makePartnerClient } from "@/lib/shopify/partner-api";

export type SaveCredentialsState =
  | { ok: true }
  | { ok: false; error: { message: string } };

const ORG_ID_RE = /^[0-9]+$/;

export async function saveCredentialsAction(input: {
  organizationId: string;
  accessToken: string;
}): Promise<SaveCredentialsState> {
  const user = await requireUser();

  if (!isEncryptionConfigured()) {
    return {
      ok: false,
      error: {
        message:
          "SHOPIFY_ENCRYPTION_KEY is not set on the server. Generate a 32-byte base64 key and add it to apps/web/.env, then restart dev.",
      },
    };
  }

  const orgId = input.organizationId.trim();
  const token = input.accessToken.trim();

  if (!orgId || !ORG_ID_RE.test(orgId)) {
    return {
      ok: false,
      error: { message: "Organization ID must be numeric (from your Partner Dashboard URL)." },
    };
  }
  if (!token || token.length < 20) {
    return {
      ok: false,
      error: { message: "Access token looks too short — re-copy from Partner Dashboard → Settings → Partner API clients." },
    };
  }

  // Probe the token with a trivial GraphQL query before saving so we
  // give the user immediate feedback instead of failing on the next sync.
  const client = makePartnerClient({
    organizationId: orgId,
    accessToken: token,
  });

  const probe = await client.request<{ __typename: string }>(`{ __typename }`);
  if (!probe.ok) {
    const e = probe.error;
    const friendly =
      e.kind === "http_error"
        ? e.status === 401 || e.status === 403
          ? "Token rejected by Shopify — check it has the Manage apps permission and that the org ID matches."
          : `Partner API returned ${e.status}: ${e.message}`
        : e.kind === "graphql_error"
          ? `GraphQL error: ${e.messages.join(" · ")}`
          : e.kind === "timeout"
            ? "Partner API timed out — try again."
            : `Network error: ${e.message}`;
    return { ok: false, error: { message: friendly } };
  }

  await upsertShopifyPartnerCredentials({
    userId: user.id,
    organizationId: orgId,
    accessTokenEncrypted: encryptSecret(token),
  });

  revalidatePath("/shopify");
  revalidatePath("/shopify/settings");
  return { ok: true };
}

export async function deleteCredentialsAction(): Promise<SaveCredentialsState> {
  const user = await requireUser();
  await deleteShopifyPartnerCredentials(user.id);
  revalidatePath("/shopify");
  revalidatePath("/shopify/settings");
  return { ok: true };
}
