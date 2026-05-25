"use server";

import { revalidatePath } from "next/cache";

import {
  deleteShopifyPartnerApp,
  upsertShopifyPartnerApp,
} from "@kit/database";

import { requireUser } from "@/lib/auth/session";
import {
  encryptSecret,
  isEncryptionConfigured,
} from "@/lib/shopify/crypto";
import {
  fetchAppById,
  makePartnerClient,
} from "@/lib/shopify/partner-api";
import { syncShopifyApp, type SyncResult } from "@/lib/shopify/sync";

export type AddAppState =
  | { ok: true; appGid: string; appName: string }
  | { ok: false; error: { message: string } };

/**
 * Unified add-app action. User provides org ID + access token + app ID
 * all in one form. Credentials are stored per-app so different apps
 * can belong to different Partner organisations.
 */
export async function addAppAction(input: {
  organizationId: string;
  accessToken: string;
  appId: string;
  appStoreUrl?: string;
}): Promise<AddAppState> {
  const user = await requireUser();

  if (!isEncryptionConfigured()) {
    return {
      ok: false,
      error: {
        message:
          "SHOPIFY_ENCRYPTION_KEY is not set on the server. Add it to apps/web/.env and restart.",
      },
    };
  }

  const orgId = input.organizationId.trim();
  const token = input.accessToken.trim();
  const rawAppId = input.appId.trim();

  if (!orgId || !/^[0-9]+$/.test(orgId)) {
    return {
      ok: false,
      error: {
        message:
          "Organization ID must be numeric (from your Partner Dashboard URL).",
      },
    };
  }
  if (!token || token.length < 20) {
    return {
      ok: false,
      error: {
        message:
          "Access token looks too short — copy from Partner Dashboard → Settings → Partner API clients.",
      },
    };
  }

  const appGid = normaliseAppGid(rawAppId);
  if (!appGid) {
    return {
      ok: false,
      error: {
        message:
          "Enter a Partner app GID (gid://partners/App/123456) or just the numeric ID.",
      },
    };
  }

  // Validate credentials + app in one shot.
  const client = makePartnerClient({
    organizationId: orgId,
    accessToken: token,
  });

  const info = await fetchAppById(client, appGid);
  if (!info.ok) {
    if (info.error.kind === "not_found") {
      return {
        ok: false,
        error: {
          message: `No app found with GID ${appGid} in org ${orgId}. Check the IDs.`,
        },
      };
    }
    const e = info.error;
    const friendly =
      e.kind === "http_error"
        ? e.status === 401 || e.status === 403
          ? "Token rejected — check it has Manage apps permission and that the org ID matches."
          : `Partner API ${e.status}: ${e.message}`
        : e.kind === "graphql_error"
          ? e.messages.join(" · ")
          : e.kind === "timeout"
            ? "Partner API timed out."
            : `Network error: ${e.message}`;
    return { ok: false, error: { message: friendly } };
  }

  // App Store URL: prefer user-provided, then auto-resolve during sync.
  const appStoreUrl = input.appStoreUrl && input.appStoreUrl.includes("apps.shopify.com")
    ? input.appStoreUrl
    : null;

  await upsertShopifyPartnerApp({
    userId: user.id,
    appGid: info.data.id,
    appName: info.data.name,
    apiKey: info.data.apiKey,
    organizationId: orgId,
    accessTokenEncrypted: encryptSecret(token),
    ...(appStoreUrl ? { appStoreUrl } : {}),
  });

  revalidatePath("/shopify");
  return { ok: true, appGid: info.data.id, appName: info.data.name };
}

function normaliseAppGid(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("gid://partners/App/")) return trimmed;
  if (/^[0-9]+$/.test(trimmed)) return `gid://partners/App/${trimmed}`;
  return null;
}

export type RemoveAppState =
  | { ok: true }
  | { ok: false; error: { message: string } };

export async function removeAppAction(
  appGid: string,
): Promise<RemoveAppState> {
  const user = await requireUser();
  await deleteShopifyPartnerApp(user.id, appGid);
  revalidatePath("/shopify");
  return { ok: true };
}

export async function syncAppAction(appGid: string): Promise<SyncResult> {
  const user = await requireUser();
  const result = await syncShopifyApp(user.id, appGid);
  revalidatePath("/shopify");
  revalidatePath(`/shopify/apps/${encodeURIComponent(appGid)}`);
  return result;
}
