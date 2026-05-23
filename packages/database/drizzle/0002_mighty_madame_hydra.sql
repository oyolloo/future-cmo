CREATE TABLE "places_cache" (
	"place_id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"formatted_address" text,
	"phone" varchar(50),
	"website" text,
	"rating" text,
	"review_count" text,
	"lat" text,
	"lng" text,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"formatted_address" text,
	"phone" varchar(50),
	"website" text,
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospects_user_place_unique" UNIQUE("user_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "audit_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"overall_score" integer NOT NULL,
	"sections" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "places_cache_expires_at_idx" ON "places_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "prospects_user_id_idx" ON "prospects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "prospects_place_id_idx" ON "prospects" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "audit_reports_prospect_id_idx" ON "audit_reports" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "audit_reports_generated_at_idx" ON "audit_reports" USING btree ("generated_at");