import {
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
