ALTER TABLE "shopify_app_events" ADD COLUMN "charge_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "shopify_app_events" ADD COLUMN "charge_currency" text;--> statement-breakpoint
ALTER TABLE "shopify_app_events" ADD COLUMN "charge_name" text;--> statement-breakpoint
ALTER TABLE "shopify_app_events" ADD COLUMN "is_test" boolean DEFAULT false;