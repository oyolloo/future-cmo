import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Per-URL website audit cache (24-hour TTL). Stores detected tech stack,
 * SEO probe signals, and (optional) PageSpeed Insights performance score.
 * URLs are stable, sites change often — short TTL keeps the report fresh
 * without re-hitting external endpoints on every render.
 */
export type SeoSignals = {
  hasTitle: boolean;
  titleLength: number;
  hasMetaDescription: boolean;
  metaDescriptionLength: number;
  hasH1: boolean;
  hasOpenGraph: boolean;
  hasStructuredData: boolean;
};

export const websiteAudits = pgTable("website_audits", {
  url: text("url").primaryKey(),
  technoStack: jsonb("techno_stack").notNull().$type<string[]>(),
  seoSignals: jsonb("seo_signals").$type<SeoSignals | null>(),
  pagespeedScore: integer("pagespeed_score"), // 0–100, null on failure/timeout
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type WebsiteAuditRow = typeof websiteAudits.$inferSelect;
export type NewWebsiteAuditRow = typeof websiteAudits.$inferInsert;
