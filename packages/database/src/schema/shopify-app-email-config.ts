import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const shopifyAppEmailConfig = pgTable(
  "shopify_app_email_config",
  {
    userId: text("user_id").notNull(),
    appGid: text("app_gid").notNull(),
    /** "resend" | "brevo" | "gmail" */
    provider: text("provider").notNull(),
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.appGid] }),
  ],
);

export type ShopifyAppEmailConfigRow =
  typeof shopifyAppEmailConfig.$inferSelect;
