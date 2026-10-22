import { desc, eq, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { data, Link } from "react-router";
import { z } from "zod";
import { db } from "~/db";
import {
  cafes,
  coffees,
  type Extraction,
  entries,
  extractionLabels,
  type Recipe,
  roasters,
  vocabularies,
} from "~/db/schema";

type Cafe = typeof cafes.$inferSelect;

type EntryItem = {
  id: string;
  tastedAt: string;
  extraction: Extraction | null;
  note: string | null;
  image: string | null;
  recipe: Recipe | null;
  gear: string | null;
  coffee: {
    id: string;
    name: string | null;
    roasterName: string | null;
  };
};

type DrunkCoffee = {
  id: string;
  name: string | null;
  roasterName: string | null;
};

function gearLabel(
  row: { dripperId: string | null; paperFilterId: string | null },
  terms: { id: string; kind: string; label: string }[],
): string | null {
  const labels = [
    terms.find((t) => t.kind === "dripper" && t.id === row.dripperId)?.label,
    terms.find((t) => t.kind === "paper_filter" && t.id === row.paperFilterId)
      ?.label,
  ].filter((label): label is string => label != null);
  return labels.length > 0 ? labels.join(" · ") : null;
}

type LoaderData = {
  cafe: Cafe;
  entries: EntryItem[];
  coffees: DrunkCoffee[];
};

export async function loader({
  params,
}: {
  params: { id: string };
}): Promise<LoaderData> {
  const parsed = z.uuid().safeParse(params.id);
  if (!parsed.success) {
    throw data(null, { status: 404 });
  }

  const [cafe] = await db
    .select()
    .from(cafes)
    .where(eq(cafes.id, parsed.data))
    .limit(1);

  if (!cafe) {
    throw data(null, { status: 404 });
  }

  const rows = await db
    .select({
      id: entries.id,
      tastedAt: entries.tastedAt,
      extraction: entries.extraction,
      note: entries.note,
      image: entries.image,
      recipe: entries.recipe,
      dripperId: entries.dripperId,
      paperFilterId: entries.paperFilterId,
      coffeeId: coffees.id,
      coffeeName: coffees.name,
      roasterName: roasters.name,
    })
    .from(entries)
    .innerJoin(coffees, eq(entries.coffeeId, coffees.id))
    .leftJoin(roasters, eq(coffees.roasterId, roasters.id))
    .where(eq(entries.cafeId, cafe.id))
    .orderBy(desc(entries.tastedAt), desc(entries.createdAt));

  const gearTerms = await db
    .select({
      id: vocabularies.id,
      kind: vocabularies.kind,
      label: vocabularies.label,
    })
    .from(vocabularies)
    .where(inArray(vocabularies.kind, ["dripper", "paper_filter"]));

  const entryItems: EntryItem[] = rows.map((row) => ({
    id: row.id,
    tastedAt: row.tastedAt,
    extraction: row.extraction,
    note: row.note,
    image: row.image,
    recipe: row.recipe,
    gear: gearLabel(row, gearTerms),
    coffee: {
      id: row.coffeeId,
      name: row.coffeeName,
      roasterName: row.roasterName,
    },
  }));

  const drunk: DrunkCoffee[] = [];
  for (const entry of entryItems) {
    if (drunk.some((c) => c.id === entry.coffee.id)) continue;
    drunk.push(entry.coffee);
  }

  return { cafe, entries: entryItems, coffees: drunk };
}

export default function CafeDetail({ loaderData }: { loaderData: LoaderData }) {
  const { cafe, entries: cups, coffees: drunk } = loaderData;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <p className="text-sm">
        <Link to="/" className="underline">
          Home
        </Link>
        {" · "}
        <Link to="/cafes" className="underline">
          Cafés
        </Link>
        {" · "}
        <Link to={`/entries/new?cafeId=${cafe.id}`} className="underline">
          Log a cup
        </Link>
      </p>
      <h1 className="mt-4 text-xl">{cafe.name}</h1>
      {cafe.city ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">City</span>
          <br />
          {cafe.city}
        </p>
      ) : null}
      {cafe.notes ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Notes</span>
          <br />
          {cafe.notes}
        </p>
      ) : null}

      <h2 className="mt-8 text-lg">Cups</h2>
      {cups.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">
          No cups yet.{" "}
          <Link to={`/entries/new?cafeId=${cafe.id}`} className="underline">
            Log a cup
          </Link>
        </p>
      ) : (
        <ul className="mt-2 border border-neutral-300">
          {cups.map((cup) => {
            const tasted = DateTime.fromISO(cup.tastedAt).toLocaleString(
              DateTime.DATE_MED,
            );
            const recipe = cup.recipe;
            return (
              <li
                key={cup.id}
                className="border-b border-neutral-300 px-3 py-2 last:border-b-0"
              >
                {cup.image ? (
                  <img
                    src={cup.image}
                    alt=""
                    className="mb-2 aspect-square w-full max-w-48 border border-neutral-300 object-cover"
                  />
                ) : null}
                <p className="text-sm">{tasted}</p>
                <p>
                  <Link to={`/coffees/${cup.coffee.id}`} className="underline">
                    {cup.coffee.name ?? "Untitled"}
                  </Link>
                  {cup.coffee.roasterName
                    ? ` · ${cup.coffee.roasterName}`
                    : null}
                </p>
                {cup.extraction ? (
                  <p className="text-sm text-neutral-500">
                    {extractionLabels[cup.extraction]}
                  </p>
                ) : null}
                {cup.gear ? (
                  <p className="text-sm text-neutral-500">{cup.gear}</p>
                ) : null}
                {recipe?.bloomSeconds != null ? (
                  <p className="text-sm text-neutral-500">
                    Bloom {recipe.bloomSeconds}s
                  </p>
                ) : null}
                {recipe?.ratio ? (
                  <p className="text-sm text-neutral-500">{recipe.ratio}</p>
                ) : null}
                {recipe?.temperature != null ? (
                  <p className="text-sm text-neutral-500">
                    {recipe.temperature}°C
                  </p>
                ) : null}
                {recipe?.description ? (
                  <p className="text-sm text-neutral-500">
                    {recipe.description}
                  </p>
                ) : null}
                {cup.note ? <p className="mt-1 text-sm">{cup.note}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-8 text-lg">Coffees</h2>
      {drunk.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Nothing drunk here yet.</p>
      ) : (
        <ul className="mt-2 border border-neutral-300">
          {drunk.map((coffee) => (
            <li
              key={coffee.id}
              className="border-b border-neutral-300 last:border-b-0"
            >
              <Link
                to={`/coffees/${coffee.id}`}
                className="block px-3 py-2 underline"
              >
                {coffee.name ?? "Untitled"}
                {coffee.roasterName ? ` · ${coffee.roasterName}` : ""}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
