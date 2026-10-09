import { put } from "@vercel/blob";
import { and, asc, eq, max } from "drizzle-orm";
import { DateTime } from "luxon";
import { useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useFetcher,
  useNavigation,
} from "react-router";
import { z } from "zod";
import { db } from "~/db";
import {
  cafes,
  coffees,
  entries,
  extractionIds,
  extractionLabels,
  type Recipe,
  roasters,
  type VocabKind,
  vocabKinds,
  vocabularies,
} from "~/db/schema";
import { slugifyTerm } from "~/lib/slug";

type VocabOption = { id: string; label: string };

type CoffeeOption = {
  id: string;
  name: string | null;
  roasterName: string | null;
};

type LoaderData = {
  cafe: { id: string; name: string };
  today: string;
  coffees: CoffeeOption[];
  roasters: { id: string; name: string }[];
  originCountries: VocabOption[];
  processes: VocabOption[];
  varieties: VocabOption[];
  packNotes: VocabOption[];
};

type FormValues = {
  coffeeMode: "existing" | "new";
  coffeeId: string;
  name: string;
  roasterId: string;
  newRoasterName: string;
  originCountryIds: string[];
  processIds: string[];
  varietyIds: string[];
  packNoteIds: string[];
  tastedAt: string;
  extraction: string;
  bloomSeconds: string;
  ratio: string;
  temperature: string;
  description: string;
  note: string;
};

type ActionData = {
  error: string;
  values?: FormValues;
};

const fieldClass = "border border-neutral-300 px-2 py-1";

function blankToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

function blankToInt(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : Number.NaN;
}

function blankToNumber(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

function hasTerm(
  terms: { id: string; kind: string }[],
  kind: string,
  id: string,
): boolean {
  return terms.some((t) => t.kind === kind && t.id === id);
}

function fileFromForm(formData: FormData, name: string): File | null {
  const photo = formData.get(name);
  if (!(photo instanceof File) || photo.size === 0) return null;
  return photo;
}

function recipeFrom(fields: {
  bloomSeconds: number | null;
  ratio: string | null;
  temperature: number | null;
  description: string | null;
}): Recipe | null {
  const recipe: Recipe = {};
  if (fields.bloomSeconds != null) recipe.bloomSeconds = fields.bloomSeconds;
  if (fields.ratio != null) recipe.ratio = fields.ratio;
  if (fields.temperature != null) recipe.temperature = fields.temperature;
  if (fields.description != null) recipe.description = fields.description;
  return Object.keys(recipe).length === 0 ? null : recipe;
}

function coffeeLabel(coffee: CoffeeOption): string {
  const name = coffee.name ?? "Untitled";
  return coffee.roasterName ? `${name} · ${coffee.roasterName}` : name;
}

const addTermSchema = z.object({
  intent: z.literal("add_term"),
  kind: z.enum(vocabKinds),
  label: z.string().trim().min(1, "Label is required"),
});

const schema = z
  .object({
    coffeeMode: z.enum(["existing", "new"]),
    coffeeId: z.uuid().nullable(),
    name: z.string().nullable(),
    roasterId: z.uuid().nullable(),
    newRoasterName: z.string().nullable(),
    originCountryIds: z.array(z.string()),
    processIds: z.array(z.string()),
    varietyIds: z.array(z.string()),
    packNoteIds: z.array(z.string()),
    tastedAt: z
      .string()
      .min(1, "Date is required")
      .refine(
        (value) => DateTime.fromISO(value, { zone: "utc" }).isValid,
        "Invalid date",
      ),
    extraction: z.enum(extractionIds).nullable(),
    bloomSeconds: z
      .number()
      .int("Bloom must be a whole number")
      .min(0)
      .nullable(),
    ratio: z.string().nullable(),
    temperature: z.number().nullable(),
    description: z.string().nullable(),
    note: z.string().nullable(),
  })
  .refine(
    (value) => value.coffeeMode !== "existing" || value.coffeeId != null,
    {
      message: "Choose a coffee",
      path: ["coffeeId"],
    },
  );

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
    .select({ id: cafes.id, name: cafes.name })
    .from(cafes)
    .where(eq(cafes.id, parsed.data))
    .limit(1);

  if (!cafe) {
    throw data(null, { status: 404 });
  }

  const coffeeRows = await db
    .select({
      id: coffees.id,
      name: coffees.name,
      roasterName: roasters.name,
    })
    .from(coffees)
    .leftJoin(roasters, eq(coffees.roasterId, roasters.id))
    .orderBy(asc(coffees.name));

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
    cafe,
    today: DateTime.now().toISODate() ?? "",
    coffees: coffeeRows,
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

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const formData = await request.formData();

  if (String(formData.get("intent") ?? "") === "add_term") {
    const parsed = addTermSchema.safeParse({
      intent: "add_term",
      kind: formData.get("kind"),
      label: formData.get("label"),
    });
    if (!parsed.success) {
      return data(
        { error: parsed.error.issues[0]?.message ?? "Invalid term" },
        { status: 400 },
      );
    }
    const { kind, label } = parsed.data;
    const id = slugifyTerm(label);
    if (!id) {
      return data(
        { error: "Could not make an id from that label" },
        { status: 400 },
      );
    }
    const [existing] = await db
      .select({ id: vocabularies.id })
      .from(vocabularies)
      .where(and(eq(vocabularies.id, id), eq(vocabularies.kind, kind)))
      .limit(1);
    if (existing) {
      return data({ error: `“${label}” already exists` }, { status: 400 });
    }
    const [agg] = await db
      .select({ m: max(vocabularies.sort) })
      .from(vocabularies)
      .where(eq(vocabularies.kind, kind));
    await db.insert(vocabularies).values({
      id,
      kind,
      label,
      sort: (agg?.m ?? 0) + 1,
    });
    return data({ error: "" });
  }

  const cafeParsed = z.uuid().safeParse(params.id);
  if (!cafeParsed.success) {
    throw data(null, { status: 404 });
  }

  const [cafe] = await db
    .select({ id: cafes.id })
    .from(cafes)
    .where(eq(cafes.id, cafeParsed.data))
    .limit(1);

  if (!cafe) {
    throw data(null, { status: 404 });
  }

  const coffeeMode =
    String(formData.get("coffeeMode") ?? "") === "new" ? "new" : "existing";

  const values: FormValues = {
    coffeeMode,
    coffeeId: String(formData.get("coffeeId") ?? ""),
    name: String(formData.get("name") ?? ""),
    roasterId: String(formData.get("roasterId") ?? ""),
    newRoasterName: String(formData.get("newRoasterName") ?? ""),
    originCountryIds: formData.getAll("originCountryIds").map(String),
    processIds: formData.getAll("processIds").map(String),
    varietyIds: formData.getAll("varietyIds").map(String),
    packNoteIds: formData.getAll("packNoteIds").map(String),
    tastedAt: String(formData.get("tastedAt") ?? ""),
    extraction: String(formData.get("extraction") ?? ""),
    bloomSeconds: String(formData.get("bloomSeconds") ?? ""),
    ratio: String(formData.get("ratio") ?? ""),
    temperature: String(formData.get("temperature") ?? ""),
    description: String(formData.get("description") ?? ""),
    note: String(formData.get("note") ?? ""),
  };

  const fail = (message: string, status = 400) =>
    data({ error: message, values } satisfies ActionData, { status });

  const bloomSeconds = blankToInt(formData.get("bloomSeconds"));
  const temperature = blankToNumber(formData.get("temperature"));
  if (Number.isNaN(bloomSeconds) || Number.isNaN(temperature)) {
    return fail("Bloom and temperature must be numbers");
  }

  const parsed = schema.safeParse({
    coffeeMode,
    coffeeId: blankToNull(formData.get("coffeeId")),
    name: blankToNull(formData.get("name")),
    roasterId: blankToNull(formData.get("roasterId")),
    newRoasterName: blankToNull(formData.get("newRoasterName")),
    originCountryIds: values.originCountryIds.filter((id) => id !== ""),
    processIds: values.processIds.filter((id) => id !== ""),
    varietyIds: values.varietyIds.filter((id) => id !== ""),
    packNoteIds: values.packNoteIds.filter((id) => id !== ""),
    tastedAt: values.tastedAt,
    extraction: blankToNull(formData.get("extraction")),
    bloomSeconds,
    ratio: blankToNull(formData.get("ratio")),
    temperature,
    description: blankToNull(formData.get("description")),
    note: blankToNull(formData.get("note")),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid cup");
  }

  const packPhoto = fileFromForm(formData, "photo");
  const entryPhoto = fileFromForm(formData, "entryPhoto");
  if (packPhoto && !packPhoto.type.startsWith("image/")) {
    return fail("Photo must be an image");
  }
  if (entryPhoto && !entryPhoto.type.startsWith("image/")) {
    return fail("Cup photo must be an image");
  }

  let coffeeId = parsed.data.coffeeId;

  if (parsed.data.coffeeMode === "existing") {
    if (!coffeeId) return fail("Choose a coffee");
    const [existing] = await db
      .select({ id: coffees.id })
      .from(coffees)
      .where(eq(coffees.id, coffeeId))
      .limit(1);
    if (!existing) return fail("Choose a coffee");
  } else {
    let roasterId = parsed.data.roasterId;
    if (parsed.data.newRoasterName) {
      roasterId = crypto.randomUUID();
      await db.insert(roasters).values({
        id: roasterId,
        name: parsed.data.newRoasterName,
      });
    } else if (roasterId) {
      const [roaster] = await db
        .select({ id: roasters.id })
        .from(roasters)
        .where(eq(roasters.id, roasterId))
        .limit(1);
      if (!roaster) return fail("Roaster not found");
    }

    const terms = await db
      .select({ id: vocabularies.id, kind: vocabularies.kind })
      .from(vocabularies);

    if (
      parsed.data.originCountryIds.some(
        (id) => !hasTerm(terms, "origin_country", id),
      )
    ) {
      return fail("Invalid origin country");
    }
    if (parsed.data.processIds.some((id) => !hasTerm(terms, "process", id))) {
      return fail("Invalid process");
    }
    if (parsed.data.varietyIds.some((id) => !hasTerm(terms, "variety", id))) {
      return fail("Invalid variety");
    }
    if (
      parsed.data.packNoteIds.some((id) => !hasTerm(terms, "pack_note", id))
    ) {
      return fail("Invalid pack note");
    }

    coffeeId = crypto.randomUUID();
    let image: string | null = null;
    if (packPhoto) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return fail("BLOB_READ_WRITE_TOKEN is not set");
      }
      const ext = packPhoto.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const blob = await put(`coffees/${coffeeId}.${ext}`, packPhoto, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      image = blob.url;
    }

    await db.insert(coffees).values({
      id: coffeeId,
      name: parsed.data.name,
      roasterId,
      originCountryIds: parsed.data.originCountryIds,
      processIds: parsed.data.processIds,
      varietyIds: parsed.data.varietyIds,
      packNoteIds: parsed.data.packNoteIds,
      image,
      owned: false,
    });
  }

  if (!coffeeId) return fail("Choose a coffee");

  const tastedAt =
    DateTime.fromISO(parsed.data.tastedAt, { zone: "utc" }).toISODate() ??
    parsed.data.tastedAt;

  const entryId = crypto.randomUUID();
  let entryImage: string | null = null;
  if (entryPhoto) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return fail("BLOB_READ_WRITE_TOKEN is not set");
    }
    const ext = entryPhoto.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const blob = await put(`entries/${entryId}.${ext}`, entryPhoto, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    entryImage = blob.url;
  }

  await db.insert(entries).values({
    id: entryId,
    coffeeId,
    cafeId: cafe.id,
    tastedAt,
    extraction: parsed.data.extraction,
    recipe: recipeFrom(parsed.data),
    note: parsed.data.note,
    image: entryImage,
  });

  throw redirect(`/cafes/${cafe.id}`);
}

function AddTerm({
  kind,
  placeholder,
}: {
  kind: VocabKind;
  placeholder: string;
}) {
  const fetcher = useFetcher<ActionData>();
  const [label, setLabel] = useState("");

  return (
    <div className="mt-1">
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={placeholder}
          className={`min-w-0 flex-1 ${fieldClass}`}
        />
        <button
          type="button"
          disabled={fetcher.state !== "idle"}
          className="cursor-pointer border border-neutral-300 px-2 py-1 disabled:opacity-50"
          onClick={() => {
            fetcher.submit(
              { intent: "add_term", kind, label },
              { method: "post" },
            );
            setLabel("");
          }}
        >
          Add
        </button>
      </div>
      {fetcher.data?.error ? (
        <p className="mt-1 text-sm">{fetcher.data.error}</p>
      ) : null}
    </div>
  );
}

export default function NewCafeEntry({
  loaderData,
  actionData,
}: {
  loaderData: LoaderData;
  actionData?: ActionData;
}) {
  const navigation = useNavigation();
  const isSaving = navigation.state !== "idle";
  const values = actionData?.values;
  const [mode, setMode] = useState<"existing" | "new">(
    values?.coffeeMode ?? "existing",
  );
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [entryPhotoName, setEntryPhotoName] = useState<string | null>(null);
  const [isBlend, setIsBlend] = useState(
    (values?.originCountryIds.length ?? 0) > 1,
  );

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
        <Link to={`/cafes/${loaderData.cafe.id}`} className="underline">
          {loaderData.cafe.name}
        </Link>
      </p>
      <h1 className="mt-4 text-xl">Log a cup</h1>
      {actionData?.error ? (
        <p className="mt-4 text-sm">{actionData.error}</p>
      ) : null}
      <Form
        method="post"
        encType="multipart/form-data"
        className="mt-4 flex flex-col gap-4"
      >
        <fieldset className="text-sm">
          <legend>Coffee</legend>
          <label className="mt-2 flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="coffeeMode"
              value="existing"
              checked={mode === "existing"}
              onChange={() => setMode("existing")}
            />
            Existing coffee
          </label>
          <label className="mt-1 flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="coffeeMode"
              value="new"
              checked={mode === "new"}
              onChange={() => setMode("new")}
            />
            New coffee
          </label>
        </fieldset>

        {mode === "existing" ? (
          <label className="flex flex-col text-sm">
            Coffee
            <select
              name="coffeeId"
              defaultValue={values?.coffeeId ?? ""}
              className={`mt-1 cursor-pointer ${fieldClass}`}
            >
              <option value="">Select a coffee</option>
              {loaderData.coffees.map((coffee) => (
                <option key={coffee.id} value={coffee.id}>
                  {coffeeLabel(coffee)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="flex cursor-pointer flex-col text-sm">
              Photo
              <span className={`${fieldClass} cursor-pointer text-neutral-500`}>
                {photoName ?? "select a photo"}
              </span>
              <input
                type="file"
                name="photo"
                accept="image/*"
                className="sr-only"
                onChange={(event) =>
                  setPhotoName(event.target.files?.[0]?.name ?? null)
                }
              />
            </label>
            <label className="flex flex-col text-sm">
              Name
              <input
                name="name"
                placeholder="Las Flores"
                defaultValue={values?.name ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col text-sm">
              Roaster
              <select
                name="roasterId"
                defaultValue={values?.roasterId ?? ""}
                className={`mt-1 cursor-pointer ${fieldClass}`}
              >
                <option value="">Select a roaster</option>
                {loaderData.roasters.map((roaster) => (
                  <option key={roaster.id} value={roaster.id}>
                    {roaster.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              Or create a roaster
              <input
                name="newRoasterName"
                placeholder="April"
                defaultValue={values?.newRoasterName ?? ""}
                className={fieldClass}
              />
            </label>
            <div className="flex flex-col text-sm">
              Origin country
              <label className="mt-2 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={isBlend}
                  onChange={(event) => setIsBlend(event.target.checked)}
                />
                Is it a blend?
              </label>
              {isBlend ? (
                <div className="mt-2 flex flex-col gap-1">
                  {loaderData.originCountries.map((term) => (
                    <label
                      key={term.id}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        name="originCountryIds"
                        value={term.id}
                        defaultChecked={values?.originCountryIds.includes(
                          term.id,
                        )}
                      />
                      {term.label}
                    </label>
                  ))}
                </div>
              ) : (
                <select
                  name="originCountryIds"
                  defaultValue={values?.originCountryIds[0] ?? ""}
                  className={`mt-2 cursor-pointer ${fieldClass}`}
                >
                  <option value="">Select a country</option>
                  {loaderData.originCountries.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.label}
                    </option>
                  ))}
                </select>
              )}
              <AddTerm kind="origin_country" placeholder="or add a country" />
            </div>
            <fieldset className="text-sm">
              <legend>Process</legend>
              <div className="mt-2 flex flex-col gap-1">
                {loaderData.processes.map((term) => (
                  <label
                    key={term.id}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      name="processIds"
                      value={term.id}
                      defaultChecked={values?.processIds.includes(term.id)}
                    />
                    {term.label}
                  </label>
                ))}
              </div>
              <AddTerm kind="process" placeholder="add a process" />
            </fieldset>
            <fieldset className="text-sm">
              <legend>Variety</legend>
              <div className="mt-2 flex flex-col gap-1">
                {loaderData.varieties.map((term) => (
                  <label
                    key={term.id}
                    className="flex cursor-pointer items-center gap-2"
                  >
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
              <AddTerm kind="variety" placeholder="add a variety" />
            </fieldset>
            <fieldset className="text-sm">
              <legend>Pack notes</legend>
              <div className="mt-2 flex flex-col gap-1">
                {loaderData.packNotes.map((term) => (
                  <label
                    key={term.id}
                    className="flex cursor-pointer items-center gap-2"
                  >
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
              <AddTerm kind="pack_note" placeholder="add a note" />
            </fieldset>
          </>
        )}

        <label className="flex cursor-pointer flex-col text-sm">
          Cup photo
          <span className={`${fieldClass} cursor-pointer text-neutral-500`}>
            {entryPhotoName ?? "select a photo"}
          </span>
          <input
            type="file"
            name="entryPhoto"
            accept="image/*"
            className="sr-only"
            onChange={(event) =>
              setEntryPhotoName(event.target.files?.[0]?.name ?? null)
            }
          />
        </label>
        <label className="flex flex-col text-sm">
          Date *
          <input
            type="date"
            name="tastedAt"
            required
            defaultValue={values?.tastedAt ?? loaderData.today}
            className={`cursor-pointer ${fieldClass}`}
          />
        </label>
        <label className="flex flex-col text-sm">
          Extraction
          <select
            name="extraction"
            defaultValue={values?.extraction ?? ""}
            className={`mt-1 cursor-pointer ${fieldClass}`}
          >
            <option value="">Select extraction</option>
            {extractionIds.map((id) => (
              <option key={id} value={id}>
                {extractionLabels[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          Bloom (seconds)
          <input
            name="bloomSeconds"
            inputMode="numeric"
            placeholder="60"
            defaultValue={values?.bloomSeconds ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col text-sm">
          Ratio
          <input
            name="ratio"
            placeholder="1:16"
            defaultValue={values?.ratio ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col text-sm">
          Temperature (°C)
          <input
            name="temperature"
            inputMode="decimal"
            placeholder="93"
            defaultValue={values?.temperature ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col text-sm">
          Description
          <textarea
            name="description"
            rows={3}
            placeholder="Kalita, slow spirals"
            defaultValue={values?.description ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col text-sm">
          Note
          <textarea
            name="note"
            rows={3}
            defaultValue={values?.note ?? ""}
            className={fieldClass}
          />
        </label>
        <button
          type="submit"
          disabled={isSaving}
          className="cursor-pointer self-start border border-neutral-300 px-3 py-1 disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </Form>
    </main>
  );
}
