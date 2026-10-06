CREATE TABLE "coffees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"roaster_id" uuid NOT NULL,
	"origin_country_id" text,
	"process_id" text,
	"variety_ids" text[] DEFAULT '{}' NOT NULL,
	"pack_note_ids" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coffees" ADD CONSTRAINT "coffees_roaster_id_roasters_id_fk" FOREIGN KEY ("roaster_id") REFERENCES "public"."roasters"("id") ON DELETE no action ON UPDATE no action;