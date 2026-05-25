import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

/**
 * Per-user Shopify Partner API credentials. ONE row per user — they
 * connect a single Partner org. (Multi-org support deferred.)
 *
 * Security:
 *   - `accessToken` is AES-256-GCM encrypted at rest using
 *     SHOPIFY_ENCRYPTION_KEY (envar). Stored as
 *     `${ivBase64}:${ciphertextBase64}:${authTagBase64}` so we can rotate
 *     the encryption key by re-encrypting all rows.
 *   - Plaintext access token must NEVER hit logs / responses. Server
 *     actions decrypt → use → discard.
 */
export const shopifyPartnerCredentials = pgTable(
  "shopify_partner_credentials",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Numeric Partner organization ID from Partner Dashboard URL. */
    organizationId: text("organization_id").notNull(),
    /** Encrypted Partner API access token — see file comment. */
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
);

export type ShopifyPartnerCredentialsRow =
  typeof shopifyPartnerCredentials.$inferSelect;
export type NewShopifyPartnerCredentialsRow =
  typeof shopifyPartnerCredentials.$inferInsert;
