CREATE TABLE "pillars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pillars_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sub_pillars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pillar_id" uuid NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sub_pillars_pillar_slug_unique" UNIQUE("pillar_id","slug")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub_pillar_id" uuid NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_sub_pillar_slug_unique" UNIQUE("sub_pillar_id","slug")
);
--> statement-breakpoint
ALTER TABLE "sub_pillars" ADD CONSTRAINT "sub_pillars_pillar_id_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."pillars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_sub_pillar_id_sub_pillars_id_fk" FOREIGN KEY ("sub_pillar_id") REFERENCES "public"."sub_pillars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pillars_position_idx" ON "pillars" USING btree ("position");--> statement-breakpoint
CREATE INDEX "sub_pillars_pillar_id_idx" ON "sub_pillars" USING btree ("pillar_id");--> statement-breakpoint
CREATE INDEX "sub_pillars_position_idx" ON "sub_pillars" USING btree ("position");--> statement-breakpoint
CREATE INDEX "topics_sub_pillar_id_idx" ON "topics" USING btree ("sub_pillar_id");--> statement-breakpoint
CREATE INDEX "topics_position_idx" ON "topics" USING btree ("position");