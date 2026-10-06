import { asc, eq } from "drizzle-orm";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { db } from "~/db";
import { coffees, roasters, vocabularies } from "~/db/schema";

type VocabOption = { id: string; label: string };

type LoaderData = {
  roasters: { id: string; name: string }[];
  originCountries: VocabOption[];
  processes: VocabOption[];
  varieties: VocabOption[];
  packNotes: VocabOption[];
};

type FormValues = {
  name: string;
  roasterId: string;
  originCountryId: string;
  processId: string;
  varietyIds: string[];
  packNoteIds: string[];
  notes: string;
};

type ActionData = {
  error: string;
  values: FormValues;
};

function blankToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

function hasTerm(
  terms: { id: string; kind: string }[],
  kind: string,
  id: string,
): boolean {
  return terms.some((t) => t.kind === kind && t.id === id);
}

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  roasterId: z.uuid({ error: "Roaster is required" }),
  originCountryId: z.string().nullable(),
  processId: z.string().nullable(),
  varietyIds: z.array(z.string()),
  packNoteIds: z.array(z.string()),
  notes: z.string().nullable(),
});

export async function loader(): Promise<LoaderData> {
  const roasterRows = await db
    .select({ id: roasters.id, name: roasters.name })
    .from(roasters)
    .orderBy(asc(roasters.name));

  const terms = await db
    .select({
      id: vocabularies.id,
      kind: vocabularies.kind,
      label: vocabularies.label,
    })
    .from(vocabularies)
    .orderBy(asc(vocabularies.sort), asc(vocabularies.label));

  return {
    roasters: roasterRows,
    originCountries: terms
      .filter((t) => t.kind === "origin_country")
      .map((t) => ({ id: t.id, label: t.label })),
    processes: terms
      .filter((t) => t.kind === "process")
      .map((t) => ({ id: t.id, label: t.label })),
    varieties: terms
      .filter((t) => t.kind === "variety")
      .map((t) => ({ id: t.id, label: t.label })),
    packNotes: terms
      .filter((t) => t.kind === "pack_note")
      .map((t) => ({ id: t.id, label: t.label })),
  };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const values: FormValues = {
    name: String(formData.get("name") ?? ""),
    roasterId: String(formData.get("roasterId") ?? ""),
    originCountryId: String(formData.get("originCountryId") ?? ""),
    processId: String(formData.get("processId") ?? ""),
    varietyIds: formData.getAll("varietyIds").map(String),
    packNoteIds: formData.getAll("packNoteIds").map(String),
    notes: String(formData.get("notes") ?? ""),
  };

  const parsed = schema.safeParse({
    name: values.name,
    roasterId: values.roasterId,
    originCountryId: blankToNull(formData.get("originCountryId")),
    processId: blankToNull(formData.get("processId")),
    varietyIds: values.varietyIds.filter((id) => id !== ""),
    packNoteIds: values.packNoteIds.filter((id) => id !== ""),
    notes: blankToNull(formData.get("notes")),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid coffee";
    return data({ error: message, values } satisfies ActionData, {
      status: 400,
    });
  }

  const [roaster] = await db
    .select({ id: roasters.id })
    .from(roasters)
    .where(eq(roasters.id, parsed.data.roasterId))
    .limit(1);

  if (!roaster) {
    return data({ error: "Roaster is required", values } satisfies ActionData, {
      status: 400,
    });
  }

  const terms = await db
    .select({ id: vocabularies.id, kind: vocabularies.kind })
    .from(vocabularies);

  if (
    parsed.data.originCountryId &&
    !hasTerm(terms, "origin_country", parsed.data.originCountryId)
  ) {
    return data(
      { error: "Invalid origin country", values } satisfies ActionData,
      { status: 400 },
    );
  }

  if (
    parsed.data.processId &&
    !hasTerm(terms, "process", parsed.data.processId)
  ) {
    return data({ error: "Invalid process", values } satisfies ActionData, {
      status: 400,
    });
  }

  if (parsed.data.varietyIds.some((id) => !hasTerm(terms, "variety", id))) {
    return data({ error: "Invalid variety", values } satisfies ActionData, {
      status: 400,
    });
  }

  if (parsed.data.packNoteIds.some((id) => !hasTerm(terms, "pack_note", id))) {
    return data({ error: "Invalid pack note", values } satisfies ActionData, {
      status: 400,
    });
  }

  const id = crypto.randomUUID();
  await db.insert(coffees).values({
    id,
    name: parsed.data.name,
    roasterId: parsed.data.roasterId,
    originCountryId: parsed.data.originCountryId,
    processId: parsed.data.processId,
    varietyIds: parsed.data.varietyIds,
    packNoteIds: parsed.data.packNoteIds,
    notes: parsed.data.notes,
  });

  throw redirect(`/coffees/${id}`);
}

export default function NewCoffee({
  loaderData,
  actionData,
}: {
  loaderData: LoaderData;
  actionData?: ActionData;
}) {
  const navigation = useNavigation();
  const isSaving = navigation.state !== "idle";
  const values = actionData?.values;
  const fieldClass = "border border-neutral-300 px-2 py-1";
  const { roasters: roasterOptions } = loaderData;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <p className="text-sm">
        <Link to="/" className="underline">
          Home
        </Link>
        {" · "}
        <Link to="/coffees" className="underline">
          Coffees
        </Link>
      </p>
      <h1 className="mt-4 text-xl">Add a coffee</h1>
      {roasterOptions.length === 0 ? (
        <p className="mt-4 text-sm">
          Add a roaster before adding a coffee.{" "}
          <Link to="/roasters/new" className="underline">
            Add a roaster
          </Link>
        </p>
      ) : (
        <>
          {actionData?.error ? (
            <p className="mt-4 text-sm">{actionData.error}</p>
          ) : null}
          <Form method="post" className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col text-sm">
              Name
              <input
                name="name"
                required
                defaultValue={values?.name ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col text-sm">
              Roaster
              <select
                name="roasterId"
                required
                defaultValue={values?.roasterId ?? ""}
                className={fieldClass}
              >
                <option value="">—</option>
                {roasterOptions.map((roaster) => (
                  <option key={roaster.id} value={roaster.id}>
                    {roaster.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              Origin country
              <select
                name="originCountryId"
                defaultValue={values?.originCountryId ?? ""}
                className={fieldClass}
              >
                <option value="">—</option>
                {loaderData.originCountries.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              Process
              <select
                name="processId"
                defaultValue={values?.processId ?? ""}
                className={fieldClass}
              >
                <option value="">—</option>
                {loaderData.processes.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="text-sm">
              <legend>Variety</legend>
              <div className="mt-2 flex flex-col gap-1">
                {loaderData.varieties.map((term) => (
                  <label key={term.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="varietyIds"
                      value={term.id}
                      defaultChecked={values?.varietyIds.includes(term.id)}
                    />
                    {term.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="text-sm">
              <legend>Pack notes</legend>
              <div className="mt-2 flex flex-col gap-1">
                {loaderData.packNotes.map((term) => (
                  <label key={term.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="packNoteIds"
                      value={term.id}
                      defaultChecked={values?.packNoteIds.includes(term.id)}
                    />
                    {term.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col text-sm">
              Notes
              <textarea
                name="notes"
                rows={4}
                defaultValue={values?.notes ?? ""}
                className={fieldClass}
              />
            </label>
            <button
              type="submit"
              disabled={isSaving}
              className="self-start border border-neutral-300 px-3 py-1 disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </Form>
        </>
      )}
    </main>
  );
}
