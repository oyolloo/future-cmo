CREATE TABLE "prospect_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"place_ids" jsonb NOT NULL,
	"business_count" integer NOT NULL,
	"overall_score" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prospect_reports" ADD CONSTRAINT "prospect_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospect_reports_user_id_created_at_idx" ON "prospect_reports" USING btree ("user_id","created_at");