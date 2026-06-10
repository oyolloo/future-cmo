CREATE TABLE IF NOT EXISTS "magic_link_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "magic_link_tokens_token_idx" ON "magic_link_tokens" USING btree ("token");
CREATE INDEX IF NOT EXISTS "magic_link_tokens_email_idx" ON "magic_link_tokens" USING btree ("email");

-- Make password_hash optional for magic-link-only users
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
