ALTER TABLE "coffees" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "coffees" ADD COLUMN "producer" text;--> statement-breakpoint
ALTER TABLE "coffees" ADD COLUMN "altitude_meters" integer;--> statement-breakpoint
ALTER TABLE "coffees" ADD COLUMN "harvest_year" integer;--> statement-breakpoint
ALTER TABLE "coffees" ADD COLUMN "roasting_date" date;--> statement-breakpoint
ALTER TABLE "coffees" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "coffees" ADD COLUMN "owned" boolean DEFAULT false NOT NULL;