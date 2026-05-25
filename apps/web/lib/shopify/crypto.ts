import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import { env } from "@kit/shared/env";

/**
 * AES-256-GCM symmetric encryption for sensitive secrets at rest
 * (currently the Shopify Partner access token).
 *
 * Format:  iv_b64:ciphertext_b64:authTag_b64
 *  - IV is random per encryption (12 bytes — GCM standard).
 *  - Auth tag (16 bytes) is verified on decrypt; tampering → throw.
 *  - All three fields are base64-encoded so the whole envelope fits in
 *    a TEXT column without binary escaping.
 *
 * Why three-piece format: lets us rotate the encryption key later by
 * decrypting with the old key + re-encrypting with the new one without
 * touching every row's storage shape.
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function loadKey(): Buffer {
  const raw = env.SHOPIFY_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SHOPIFY_ENCRYPTION_KEY is not set. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\" and add to apps/web/.env",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `SHOPIFY_ENCRYPTION_KEY must be base64-encoded 32 bytes (got ${key.length} bytes after decode).`,
    );
  }
  return key;
}

export function isEncryptionConfigured(): boolean {
  return Boolean(env.SHOPIFY_ENCRYPTION_KEY);
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    ciphertext.toString("base64"),
    authTag.toString("base64"),
  ].join(":");
}

export function decryptSecret(envelope: string): string {
  const key = loadKey();
  const parts = envelope.split(":");
  if (parts.length !== 3) {
    throw new Error("Encrypted secret envelope must have 3 fields.");
  }
  const [ivB64, cipherB64, tagB64] = parts;
  const iv = Buffer.from(ivB64!, "base64");
  const ciphertext = Buffer.from(cipherB64!, "base64");
  const authTag = Buffer.from(tagB64!, "base64");
  if (iv.length !== IV_BYTES)
    throw new Error("Bad IV length in encrypted secret.");
  if (authTag.length !== AUTH_TAG_BYTES)
    throw new Error("Bad auth-tag length in encrypted secret.");

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
