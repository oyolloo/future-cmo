CREATE TABLE "business_website_info_cache" (
	"place_id" text PRIMARY KEY NOT NULL,
	"website_url" text NOT NULL,
	"screenshot" jsonb,
	"cms" jsonb,
	"speed" jsonb,
	"domain" jsonb,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "business_website_info_cache_expires_at_idx" ON "business_website_info_cache" USING btree ("expires_at");