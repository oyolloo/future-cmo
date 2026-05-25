CREATE TABLE "shopify_app_email_config" (
	"user_id" text NOT NULL,
	"app_gid" text NOT NULL,
	"provider" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopify_app_email_config_user_id_app_gid_pk" PRIMARY KEY("user_id","app_gid")
);
