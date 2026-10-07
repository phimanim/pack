import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const vocabKinds = [
  "variety",
  "process",
  "pack_note",
  "origin_country",
] as const;

export type VocabKind = (typeof vocabKinds)[number];

export const vocabularies = pgTable(
  "vocabularies",
  {
    id: text("id").notNull(),
    kind: text("kind").$type<VocabKind>().notNull(),
    label: text("label").notNull(),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.id, t.kind] })],
);

export const roasters = pgTable("roasters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  country: text("country"),
  city: text("city"),
  url: text("url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const coffees = pgTable("coffees", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  roasterId: uuid("roaster_id")
    .notNull()
    .references(() => roasters.id),
  originCountryIds: text("origin_country_ids")
    .array()
    .notNull()
    .default(sql`'{}'`),
  region: text("region"),
  producer: text("producer"),
  farm: text("farm"),
  processId: text("process_id"),
  varietyIds: text("variety_ids").array().notNull().default(sql`'{}'`),
  packNoteIds: text("pack_note_ids").array().notNull().default(sql`'{}'`),
  altitudeMeters: integer("altitude_meters"),
  harvestYear: integer("harvest_year"),
  roastingDate: date("roasting_date", { mode: "string" }),
  image: text("image"),
  owned: boolean("owned").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
