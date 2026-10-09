ALTER TABLE "coffees" ADD COLUMN "process_ids" text[] DEFAULT '{}'::text[] NOT NULL;
UPDATE "coffees" SET "process_ids" = ARRAY["process_id"]::text[] WHERE "process_id" IS NOT NULL;
ALTER TABLE "coffees" DROP COLUMN "process_id";
