CREATE TABLE "shopify_partner_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopify_partner_apps" (
	"user_id" uuid NOT NULL,
	"app_gid" text NOT NULL,
	"app_name" text NOT NULL,
	"api_key" text,
	"last_synced_at" timestamp with time zone,
	"last_sync_error" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopify_partner_apps_user_id_app_gid_pk" PRIMARY KEY("user_id","app_gid")
);
--> statement-breakpoint
CREATE TABLE "shopify_app_events" (
	"app_gid" text NOT NULL,
	"event_type" text NOT NULL,
	"shop_gid" text NOT NULL,
	"shop_name" text,
	"shop_domain" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopify_app_events_app_gid_event_type_shop_gid_occurred_at_pk" PRIMARY KEY("app_gid","event_type","shop_gid","occurred_at")
);
--> statement-breakpoint
CREATE TABLE "shopify_shops" (
	"app_gid" text NOT NULL,
	"shop_gid" text NOT NULL,
	"shop_name" text,
	"shop_domain" text,
	"current_state" text NOT NULL,
	"first_installed_at" timestamp with time zone,
	"last_event_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopify_shops_app_gid_shop_gid_pk" PRIMARY KEY("app_gid","shop_gid")
);
--> statement-breakpoint
ALTER TABLE "shopify_partner_credentials" ADD CONSTRAINT "shopify_partner_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_partner_apps" ADD CONSTRAINT "shopify_partner_apps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopify_partner_apps_user_id_idx" ON "shopify_partner_apps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shopify_app_events_app_occurred_idx" ON "shopify_app_events" USING btree ("app_gid","occurred_at");--> statement-breakpoint
CREATE INDEX "shopify_shops_app_state_idx" ON "shopify_shops" USING btree ("app_gid","current_state");