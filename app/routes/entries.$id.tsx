import { eq, inArray } from "drizzle-orm";
import { data, Link, useLoaderData } from "react-router";
import { z } from "zod";
import { db } from "~/db";
import {
  cafes,
  coffees,
  entries,
  extractionLabels,
  roasters,
  vocabularies,
} from "~/db/schema";
import { formatDate } from "~/lib/dates";
import { formatMinor } from "~/lib/money";

export async function loader({ params }: { params: { id: string } }) {
  const id = z.uuid().safeParse(params.id);
  if (!id.success) throw data("Cup not found", { status: 404 });

  const [cup] = await db
    .select({
      id: entries.id,
      tastedAt: entries.tastedAt,
      extraction: entries.extraction,
      recipe: entries.recipe,
      dripperId: entries.dripperId,
      paperFilterId: entries.paperFilterId,
      priceMinor: entries.priceMinor,
      currency: entries.currency,
      note: entries.note,
      image: entries.image,
      cafeName: cafes.name,
      coffeeName: coffees.name,
      roasterName: roasters.name,
    })
    .from(entries)
    .innerJoin(coffees, eq(entries.coffeeId, coffees.id))
    .leftJoin(roasters, eq(coffees.roasterId, roasters.id))
    .leftJoin(cafes, eq(entries.cafeId, cafes.id))
    .where(eq(entries.id, id.data))
    .limit(1);
  if (!cup) throw data("Cup not found", { status: 404 });

  const gearIds = [cup.dripperId, cup.paperFilterId].filter(
    (value): value is string => value != null,
  );
  const gearTerms =
    gearIds.length > 0
      ? await db
          .select({
            id: vocabularies.id,
            kind: vocabularies.kind,
            label: vocabularies.label,
          })
          .from(vocabularies)
          .where(inArray(vocabularies.id, gearIds))
      : [];
  const labelFor = (kind: string, termId: string | null) =>
    termId
      ? (gearTerms.find((t) => t.kind === kind && t.id === termId)?.label ??
        null)
      : null;

  return {
    cup,
    dripperLabel: labelFor("dripper", cup.dripperId),
    paperFilterLabel: labelFor("paper_filter", cup.paperFilterId),
  };
}

export default function CupPage() {
  const { cup, dripperLabel, paperFilterLabel } =
    useLoaderData<typeof loader>();
  const recipe = cup.recipe;
  const recipeLines = [
    recipe?.bloomSeconds != null ? `Bloom ${recipe.bloomSeconds}s` : null,
    recipe?.ratio ? recipe.ratio : null,
    recipe?.temperature != null ? `${recipe.temperature}°C` : null,
    recipe?.description ? recipe.description : null,
  ].filter((line): line is string => line != null);

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
      </p>
      <h1 className="mt-4 font-serif text-4xl">
        {cup.coffeeName ?? "Untitled"}
      </h1>
      {cup.roasterName ? (
        <p className="text-ink-muted">{cup.roasterName}</p>
      ) : null}

      {cup.image ? (
        <img
          src={cup.image}
          alt=""
          className="mt-4 aspect-square w-full max-w-64 border-2 border-outline-variant object-cover"
        />
      ) : null}

      <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 border-2 border-outline bg-container p-5 text-sm">
        <dt className="text-ink-muted">Date</dt>
        <dd>{formatDate(cup.tastedAt)}</dd>
        <dt className="text-ink-muted">Where</dt>
        <dd>{cup.cafeName ?? "Home"}</dd>
        {cup.extraction ? (
          <>
            <dt className="text-ink-muted">Extraction</dt>
            <dd>{extractionLabels[cup.extraction]}</dd>
          </>
        ) : null}
        {dripperLabel ? (
          <>
            <dt className="text-ink-muted">Dripper</dt>
            <dd>{dripperLabel}</dd>
          </>
        ) : null}
        {paperFilterLabel ? (
          <>
            <dt className="text-ink-muted">Paper filter</dt>
            <dd>{paperFilterLabel}</dd>
          </>
        ) : null}
        {recipeLines.length > 0 ? (
          <>
            <dt className="text-ink-muted">Recipe</dt>
            <dd>{recipeLines.join(" · ")}</dd>
          </>
        ) : null}
        {cup.priceMinor != null && cup.currency ? (
          <>
            <dt className="text-ink-muted">Price</dt>
            <dd>{formatMinor(cup.priceMinor, cup.currency)}</dd>
          </>
        ) : null}
        {cup.note ? (
          <>
            <dt className="text-ink-muted">Note</dt>
            <dd className="whitespace-pre-line">{cup.note}</dd>
          </>
        ) : null}
      </dl>

      <p className="mt-4 text-sm">
        <Link
          to={`/entries/new?duplicateOf=${cup.id}`}
          className="font-medium underline"
        >
          Duplicate
        </Link>
        <span className="text-ink-muted">
          {" "}
          · opens Log a cup with this setup. Nothing is saved until you press
          Save.
        </span>
      </p>
    </main>
  );
}
