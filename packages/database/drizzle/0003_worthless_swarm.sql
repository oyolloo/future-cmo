CREATE TABLE "shared_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(40) NOT NULL,
	"user_id" uuid NOT NULL,
	"place_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "shared_reports_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "shared_reports" ADD CONSTRAINT "shared_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shared_reports_token_idx" ON "shared_reports" USING btree ("token");--> statement-breakpoint
CREATE INDEX "shared_reports_user_id_idx" ON "shared_reports" USING btree ("user_id");