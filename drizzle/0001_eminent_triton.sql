CREATE TABLE "assessments" (
	"item_id" text PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"next_action" text NOT NULL,
	"effort" text NOT NULL,
	"impact" text NOT NULL,
	"unblocks_others" boolean DEFAULT false NOT NULL,
	"blocked_by" jsonb,
	"why_now" text,
	"confidence" text NOT NULL,
	"assessed_by" text NOT NULL,
	"item_updated_at" timestamp with time zone NOT NULL,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;