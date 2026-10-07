import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { db } from "~/db";
import { coffees, roasters, vocabularies } from "~/db/schema";

type CoffeeDetail = {
  id: string;
  name: string;
  image: string | null;
  region: string | null;
  producer: string | null;
  farm: string | null;
  altitudeMeters: number | null;
  harvestYear: number | null;
  roastingDate: string | null;
  notes: string | null;
  roaster: { id: string; name: string };
  originCountryLabels: string[];
  processLabel: string | null;
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

  const [roaster] = await db
    .select({ id: roasters.id, name: roasters.name })
    .from(roasters)
    .where(eq(roasters.id, coffee.roasterId))
    .limit(1);

  if (!roaster) {
    throw data(null, { status: 404 });
  }

  const terms = await db
    .select({
      id: vocabularies.id,
      kind: vocabularies.kind,
      label: vocabularies.label,
    })
    .from(vocabularies);

  const processLabel = coffee.processId
    ? (terms.find((t) => t.kind === "process" && t.id === coffee.processId)
      ?.label ?? null)
    : null;

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
      roastingDate: coffee.roastingDate,
      notes: coffee.notes,
      roaster,
      originCountryLabels: labelsFor(
        coffee.originCountryIds,
        "origin_country",
        terms,
      ), processLabel,
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
  const roastLabel = coffee.roastingDate
    ? DateTime.fromISO(coffee.roastingDate).toLocaleString(DateTime.DATE_MED)
    : null;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <p className="text-sm">
        <Link to="/" className="underline">
          Home
        </Link>
        {" · "}
        <Link to="/coffees" className="underline">
          Library
        </Link>
      </p>
      {coffee.image ? (
        <img
          src={coffee.image}
          alt=""
          className="mt-4 aspect-square w-full border border-neutral-300 object-cover"
        />
      ) : null}
      <h1 className="mt-4 text-xl">{coffee.name}</h1>
      <p className="mt-2">
        <span className="text-sm text-neutral-500">Roaster</span>
        <br />
        <Link to={`/roasters/${coffee.roaster.id}`} className="underline">
          {coffee.roaster.name}
        </Link>
      </p>
      {coffee.originCountryLabels.length > 0 ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Origin country</span>
          <br />
          {coffee.originCountryLabels.join(", ")}
        </p>
      ) : null}
      {coffee.region ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Region</span>
          <br />
          {coffee.region}
        </p>
      ) : null}
      {coffee.farm ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Farm</span>
          <br />
          {coffee.farm}
        </p>
      ) : null}
      {coffee.producer ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Producer</span>
          <br />
          {coffee.producer}
        </p>
      ) : null}
      {coffee.processLabel ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Process</span>
          <br />
          {coffee.processLabel}
        </p>
      ) : null}
      {coffee.varietyLabels.length > 0 ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Variety</span>
          <br />
          {coffee.varietyLabels.join(", ")}
        </p>
      ) : null}
      {coffee.packNoteLabels.length > 0 ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Pack notes</span>
          <br />
          {coffee.packNoteLabels.join(", ")}
        </p>
      ) : null}
      {roastLabel ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Roast date</span>
          <br />
          {roastLabel}
        </p>
      ) : null}
      {coffee.harvestYear ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Harvest year</span>
          <br />
          {coffee.harvestYear}
        </p>
      ) : null}
      {coffee.altitudeMeters != null ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Altitude</span>
          <br />
          {coffee.altitudeMeters} m
        </p>
      ) : null}
      {coffee.notes ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Notes</span>
          <br />
          {coffee.notes}
        </p>
      ) : null}
      <Form
        method="post"
        className="mt-6"
        onSubmit={(event) => {
          if (!confirm("Delete this coffee?")) event.preventDefault();
        }}
      >
        <button
          type="submit"
          disabled={isDeleting}
          className="border border-neutral-300 px-3 py-1 disabled:opacity-50"
        >
          {isDeleting ? "Deleting…" : "Delete"}
        </button>
      </Form>
    </main>
  );
}
