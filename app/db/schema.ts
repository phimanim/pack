import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
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
  "dripper",
  "paper_filter",
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

export const cafes = pgTable("cafes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const coffees = pgTable("coffees", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  roasterId: uuid("roaster_id").references(() => roasters.id),
  originCountryIds: text("origin_country_ids")
    .array()
    .notNull()
    .default(sql`'{}'`),
  region: text("region"),
  producer: text("producer"),
  farm: text("farm"),
  processIds: text("process_ids").array().notNull().default(sql`'{}'`),
  varietyIds: text("variety_ids").array().notNull().default(sql`'{}'`),
  packNoteIds: text("pack_note_ids").array().notNull().default(sql`'{}'`),
  altitudeMeters: integer("altitude_meters"),
  harvestYear: integer("harvest_year"),
  priceMinor: integer("price_minor"),
  currency: text("currency"),
  bagWeightGrams: integer("bag_weight_grams"),
  roastingDate: date("roasting_date", { mode: "string" }),
  image: text("image"),
  owned: boolean("owned").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Recipe = {
  bloomSeconds?: number;
  ratio?: string;
  temperature?: number;
  description?: string;
};

export const extractionIds = [
  "filter",
  "espresso",
  "ibrik",
  "turbo_shot",
] as const;

export type Extraction = (typeof extractionIds)[number];

export const extractionLabels: Record<Extraction, string> = {
  filter: "Filter",
  espresso: "Espresso",
  ibrik: "Ibrik",
  turbo_shot: "Turbo shot",
};

export const entries = pgTable("entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  coffeeId: uuid("coffee_id")
    .notNull()
    .references(() => coffees.id, { onDelete: "cascade" }),
  cafeId: uuid("cafe_id").references(() => cafes.id),
  tastedAt: date("tasted_at", { mode: "string" }).notNull(),
  extraction: text("extraction").$type<Extraction>(),
  recipe: jsonb("recipe").$type<Recipe>(),
  dripperId: text("dripper_id"),
  paperFilterId: text("paper_filter_id"),
  note: text("note"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
