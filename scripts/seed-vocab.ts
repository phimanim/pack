import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { type VocabKind, vocabularies } from "../app/db/schema";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

const db = drizzle(neon(url));

const originCountries = [
  { id: "br", label: "Brazil" },
  { id: "co", label: "Colombia" },
  { id: "cr", label: "Costa Rica" },
  { id: "sv", label: "El Salvador" },
  { id: "et", label: "Ethiopia" },
  { id: "gt", label: "Guatemala" },
  { id: "hn", label: "Honduras" },
  { id: "id", label: "Indonesia" },
  { id: "ke", label: "Kenya" },
  { id: "ni", label: "Nicaragua" },
  { id: "pa", label: "Panama" },
  { id: "pe", label: "Peru" },
  { id: "rw", label: "Rwanda" },
  { id: "th", label: "Thailand" },
  { id: "ye", label: "Yemen" },
];

function terms(
  kind: VocabKind,
  items: { id: string; label: string }[],
): (typeof vocabularies.$inferInsert)[] {
  return items.map((item, sort) => ({ ...item, kind, sort }));
}

const rows = [
  ...terms("variety", [
    { id: "red_bourbon", label: "Red bourbon" },
    { id: "pink_bourbon", label: "Pink bourbon" },
    { id: "caturra", label: "Caturra" },
    { id: "geisha", label: "Geisha" },
    { id: "sl28", label: "SL28" },
  ]),
  ...terms("process", [
    { id: "washed", label: "Washed" },
    { id: "natural", label: "Natural" },
    { id: "anaerobic", label: "Anaerobic" },
    { id: "semi_washed", label: "Semi-washed" },
  ]),
  ...terms("pack_note", [
    { id: "blueberry", label: "Blueberry" },
    { id: "yellow_fruits", label: "Yellow fruits" },
    { id: "jasmine", label: "Jasmine" },
  ]),
  ...terms("origin_country", originCountries),
];

await db.delete(vocabularies).where(
  and(
    eq(vocabularies.kind, "origin_country"),
    sql`length(${vocabularies.id}) = 2`,
    notInArray(
      vocabularies.id,
      originCountries.map((c) => c.id),
    ),
  ),
);

await db.insert(vocabularies).values(rows).onConflictDoNothing();
console.log(`seeded ${rows.length} vocab rows (insert if missing)`);
