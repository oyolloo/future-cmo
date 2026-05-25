CREATE TABLE "website_audits" (
	"url" text PRIMARY KEY NOT NULL,
	"techno_stack" jsonb NOT NULL,
	"seo_signals" jsonb,
	"pagespeed_score" integer,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
