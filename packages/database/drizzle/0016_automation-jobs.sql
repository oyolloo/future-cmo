CREATE TABLE "automation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"tasks" jsonb NOT NULL,
	"delay_value" integer DEFAULT 0 NOT NULL,
	"delay_unit" text DEFAULT 'minutes' NOT NULL,
	"current_task_index" integer DEFAULT 0 NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"task_runs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "automation_jobs" ADD CONSTRAINT "automation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_jobs_user_created_idx" ON "automation_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "automation_jobs_status_idx" ON "automation_jobs" USING btree ("status");