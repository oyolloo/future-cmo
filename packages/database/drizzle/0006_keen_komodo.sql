CREATE TABLE "place_reviews_cache" (
	"place_id" text PRIMARY KEY NOT NULL,
	"reviews" jsonb NOT NULL,
	"review_count" integer NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "place_reviews_cache_expires_at_idx" ON "place_reviews_cache" USING btree ("expires_at");