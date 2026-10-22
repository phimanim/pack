import { eq } from "drizzle-orm";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { db } from "~/db";
import {
  coffees,
  type Extraction,
  extractionLabels,
  roasters,
  vocabularies,
} from "~/db/schema";
import { formatDate } from "~/lib/dates";
import {
  cupCostMinor,
  doseGrams,
  formatMinor,
  formatPricePer100g,
} from "~/lib/money";

type CoffeeDetail = {
  id: string;
  name: string | null;
  image: string | null;
  region: string | null;
  producer: string | null;
  farm: string | null;
  altitudeMeters: number | null;
  harvestYear: number | null;
  priceMinor: number | null;
  currency: string | null;
  bagWeightGrams: number | null;
  roastingDate: string | null;
  notes: string | null;
  owned: boolean;
  roaster: { id: string; name: string } | null;
  originCountryLabels: string[];
  processLabels: string[];
  varietyLabels: string[];
  packNoteLabels: string[];
};

function labelsFor(
  ids: string[],
  kind: string,
  terms: { id: string; kind: string; label: string }[],
): string[] {
  return ids.flatMap((id) => {
    const term = terms.find((t) => t.kind === kind && t.id === id);
    return term ? [term.label] : [];
  });
}

export async function loader({
  params,
}: {
  params: { id: string };
}): Promise<{ coffee: CoffeeDetail }> {
  const parsed = z.uuid().safeParse(params.id);
  if (!parsed.success) {
    throw data(null, { status: 404 });
  }

  const [coffee] = await db
    .select()
    .from(coffees)
    .where(eq(coffees.id, parsed.data))
    .limit(1);

  if (!coffee) {
    throw data(null, { status: 404 });
  }

  let roaster: { id: string; name: string } | null = null;
  if (coffee.roasterId) {
    const [row] = await db
      .select({ id: roasters.id, name: roasters.name })
      .from(roasters)
      .where(eq(roasters.id, coffee.roasterId))
      .limit(1);
    roaster = row ?? null;
  }

  const terms = await db
    .select({
      id: vocabularies.id,
      kind: vocabularies.kind,
      label: vocabularies.label,
    })
    .from(vocabularies);

  return {
    coffee: {
      id: coffee.id,
      name: coffee.name,
      image: coffee.image,
      region: coffee.region,
      producer: coffee.producer,
      farm: coffee.farm,
      altitudeMeters: coffee.altitudeMeters,
      harvestYear: coffee.harvestYear,
      priceMinor: coffee.priceMinor,
      currency: coffee.currency,
      bagWeightGrams: coffee.bagWeightGrams,
      roastingDate: coffee.roastingDate,
      notes: coffee.notes,
      owned: coffee.owned,
      roaster,
      originCountryLabels: labelsFor(
        coffee.originCountryIds,
        "origin_country",
        terms,
      ),
      processLabels: labelsFor(coffee.processIds, "process", terms),
      varietyLabels: labelsFor(coffee.varietyIds, "variety", terms),
      packNoteLabels: labelsFor(coffee.packNoteIds, "pack_note", terms),
    },
  };
}

export async function action({ params }: { params: { id: string } }) {
  const parsed = z.uuid().safeParse(params.id);
  if (!parsed.success) {
    throw data(null, { status: 404 });
  }

  await db.delete(coffees).where(eq(coffees.id, parsed.data));
  throw redirect("/coffees");
}

export default function CoffeeDetail({
  loaderData,
}: {
  loaderData: { coffee: CoffeeDetail };
}) {
  const navigation = useNavigation();
  const isDeleting = navigation.state !== "idle";
  const { coffee } = loaderData;
  const { priceMinor, currency, bagWeightGrams } = coffee;
  const perCup =
    priceMinor != null && currency && bagWeightGrams
      ? Object.entries(doseGrams)
          .map(([id, dose]) => {
            const minor = cupCostMinor(priceMinor, bagWeightGrams, dose);
            const label = extractionLabels[id as Extraction].toLowerCase();
            return `${formatMinor(Math.round(minor), currency)} per ${label} (${dose} g)`;
          })
          .join(" · ")
      : null;
  const roastLabel = coffee.roastingDate
    ? formatDate(coffee.roastingDate)
    : null;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <p className="text-sm">
        <Link to="/coffees" className="underline">
          Library
        </Link>
      </p>
      {coffee.image ? (
        <img
          src={coffee.image}
          alt=""
          className="mt-4 aspect-square w-full border-2 border-outline-variant object-cover"
        />
      ) : null}
      <h1 className="mt-4 font-serif text-4xl">{coffee.name ?? "Untitled"}</h1>
      {coffee.roaster ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Roaster
          </span>
          <br />
          <Link to={`/roasters/${coffee.roaster.id}`} className="underline">
            {coffee.roaster.name}
          </Link>
        </p>
      ) : null}
      {coffee.originCountryLabels.length > 0 ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Origin country
          </span>
          <br />
          {coffee.originCountryLabels.join(", ")}
        </p>
      ) : null}
      {coffee.region ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Region
          </span>
          <br />
          {coffee.region}
        </p>
      ) : null}
      {coffee.farm ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Farm
          </span>
          <br />
          {coffee.farm}
        </p>
      ) : null}
      {coffee.producer ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Producer
          </span>
          <br />
          {coffee.producer}
        </p>
      ) : null}
      {coffee.processLabels.length > 0 ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Process
          </span>
          <br />
          {coffee.processLabels.join(", ")}
        </p>
      ) : null}
      {coffee.varietyLabels.length > 0 ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Variety
          </span>
          <br />
          {coffee.varietyLabels.join(", ")}
        </p>
      ) : null}
      {coffee.packNoteLabels.length > 0 ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Pack notes
          </span>
          <br />
          {coffee.packNoteLabels.join(", ")}
        </p>
      ) : null}
      {roastLabel ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Roast date
          </span>
          <br />
          {roastLabel}
        </p>
      ) : null}
      {coffee.harvestYear ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Harvest year
          </span>
          <br />
          {coffee.harvestYear}
        </p>
      ) : null}
      {coffee.altitudeMeters != null ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Altitude
          </span>
          <br />
          {coffee.altitudeMeters} m
        </p>
      ) : null}
      {coffee.priceMinor != null && coffee.currency ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Price
          </span>
          <br />
          <span data-testid="price">
            {formatMinor(coffee.priceMinor, coffee.currency)}
          </span>
          {coffee.bagWeightGrams != null ? (
            <span data-testid="price-per-100g" className="text-ink-muted">
              {" "}
              (
              {formatPricePer100g(
                coffee.priceMinor,
                coffee.currency,
                coffee.bagWeightGrams,
              )}{" "}
              per 100 g)
            </span>
          ) : null}
          {perCup ? (
            <span data-testid="price-per-cup" className="block text-ink-muted">
              {perCup}
            </span>
          ) : null}
        </p>
      ) : null}
      {coffee.bagWeightGrams != null ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Bag weight
          </span>
          <br />
          {coffee.bagWeightGrams} g
        </p>
      ) : null}
      {coffee.notes ? (
        <p className="mt-2">
          <span className="font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Notes
          </span>
          <br />
          {coffee.notes}
        </p>
      ) : null}
      <div className="mt-6 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={coffee.owned}
          disabled
          className="h-4 w-4"
        />
        <span>
          <span className="font-medium">In my home library</span>
          <span className="block text-xs text-ink-muted">
            {coffee.owned
              ? "You bought this coffee for your home library."
              : "You drank this coffee somewhere else."}
          </span>
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        <Link
          to={`/coffees/${coffee.id}/edit`}
          className="border-2 border-outline-variant px-3 py-1"
        >
          Edit
        </Link>
        <Form
          method="post"
          onSubmit={(event) => {
            if (!confirm("Delete this coffee?")) event.preventDefault();
          }}
        >
          <Button type="submit" variant="outline" disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </Form>
      </div>
    </main>
  );
}
