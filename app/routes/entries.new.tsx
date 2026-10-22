import { put } from "@vercel/blob";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { DateTime } from "luxon";
import { useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { VocabCombobox } from "~/components/vocab-combobox";
import { db } from "~/db";
import {
  cafes,
  coffees,
  entries,
  extractionIds,
  extractionLabels,
  type Recipe,
  roasters,
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

type CafeOption = { id: string; name: string };

type LoaderData = {
  selectedCafeId: string | null;
  today: string;
  cafes: CafeOption[];
  coffees: CoffeeOption[];
  roasters: { id: string; name: string }[];
  originCountries: VocabOption[];
  processes: VocabOption[];
  varieties: VocabOption[];
  packNotes: VocabOption[];
  drippers: VocabOption[];
  paperFilters: VocabOption[];
};

type FormValues = {
  cafeId: string;
  newCafeName: string;
  newCafeCity: string;
  newCafeNotes: string;
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
  dripperIds: string[];
  paperFilterIds: string[];
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
    cafeId: z.uuid().nullable(),
    newCafeName: z.string().nullable(),
    newCafeCity: z.string().nullable(),
    newCafeNotes: z.string().nullable(),
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
    dripperId: z.string().nullable(),
    paperFilterId: z.string().nullable(),
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
  request,
}: {
  request: Request;
}): Promise<LoaderData> {
  const requestedCafeId = new URL(request.url).searchParams.get("cafeId");

  const cafeRows = await db
    .select({ id: cafes.id, name: cafes.name })
    .from(cafes)
    .orderBy(asc(cafes.name));

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

  const selectedCafeId =
    requestedCafeId && cafeRows.some((cafe) => cafe.id === requestedCafeId)
      ? requestedCafeId
      : null;

  return {
    selectedCafeId,
    today: DateTime.now().toISODate() ?? "",
    cafes: cafeRows,
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
    drippers: terms
      .filter((t) => t.kind === "dripper")
      .map((t) => ({ id: t.id, label: t.label })),
    paperFilters: terms
      .filter((t) => t.kind === "paper_filter")
      .map((t) => ({ id: t.id, label: t.label })),
  };
}

export async function action({ request }: { request: Request }) {
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
      return data({ error: `"${label}" already exists` }, { status: 400 });
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
    return data({ error: "", id, label });
  }

  const coffeeMode =
    String(formData.get("coffeeMode") ?? "") === "new" ? "new" : "existing";

  const values: FormValues = {
    cafeId: String(formData.get("cafeId") ?? ""),
    newCafeName: String(formData.get("newCafeName") ?? ""),
    newCafeCity: String(formData.get("newCafeCity") ?? ""),
    newCafeNotes: String(formData.get("newCafeNotes") ?? ""),
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
    dripperIds: formData.getAll("dripperId").map(String),
    paperFilterIds: formData.getAll("paperFilterId").map(String),
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
    cafeId: blankToNull(formData.get("cafeId")),
    newCafeName: blankToNull(formData.get("newCafeName")),
    newCafeCity: blankToNull(formData.get("newCafeCity")),
    newCafeNotes: blankToNull(formData.get("newCafeNotes")),
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
    dripperId: blankToNull(formData.get("dripperId")),
    paperFilterId: blankToNull(formData.get("paperFilterId")),
    bloomSeconds,
    ratio: blankToNull(formData.get("ratio")),
    temperature,
    description: blankToNull(formData.get("description")),
    note: blankToNull(formData.get("note")),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid cup");
  }

  // Gear only applies to filter brews; ignore anything submitted otherwise.
  let dripperId: string | null = null;
  let paperFilterId: string | null = null;
  if (parsed.data.extraction === "filter") {
    const gearTerms = await db
      .select({ id: vocabularies.id, kind: vocabularies.kind })
      .from(vocabularies)
      .where(inArray(vocabularies.kind, ["dripper", "paper_filter"]));
    dripperId = parsed.data.dripperId;
    paperFilterId = parsed.data.paperFilterId;
    if (dripperId && !hasTerm(gearTerms, "dripper", dripperId)) {
      return fail("Invalid dripper");
    }
    if (paperFilterId && !hasTerm(gearTerms, "paper_filter", paperFilterId)) {
      return fail("Invalid paper filter");
    }
  }

  let cafeId = parsed.data.cafeId;
  if (parsed.data.newCafeName) {
    cafeId = crypto.randomUUID();
    await db.insert(cafes).values({
      id: cafeId,
      name: parsed.data.newCafeName,
      city: parsed.data.newCafeCity,
      notes: parsed.data.newCafeNotes,
    });
  } else if (cafeId) {
    const [cafe] = await db
      .select({ id: cafes.id })
      .from(cafes)
      .where(eq(cafes.id, cafeId))
      .limit(1);
    if (!cafe) return fail("Choose or create a café");
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
    cafeId,
    tastedAt,
    extraction: parsed.data.extraction,
    recipe: recipeFrom(parsed.data),
    dripperId,
    paperFilterId,
    note: parsed.data.note,
    image: entryImage,
  });

  throw redirect(cafeId ? `/cafes/${cafeId}` : `/`);
}

export default function NewEntry({
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
  const [extraction, setExtraction] = useState(values?.extraction ?? "");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [entryPhotoName, setEntryPhotoName] = useState<string | null>(null);
  const [isBlend, setIsBlend] = useState(
    (values?.originCountryIds.length ?? 0) > 1,
  );
  const cafeItems = [
    { label: "Home (no café)", value: null },
    ...loaderData.cafes.map((cafe) => ({
      label: cafe.name,
      value: cafe.id,
    })),
  ];
  const coffeeItems = [
    { label: "Select a coffee", value: null },
    ...loaderData.coffees.map((coffee) => ({
      label: coffeeLabel(coffee),
      value: coffee.id,
    })),
  ];
  const roasterItems = [
    { label: "Select a roaster", value: null },
    ...loaderData.roasters.map((roaster) => ({
      label: roaster.name,
      value: roaster.id,
    })),
  ];
  const extractionItems = [
    { label: "Select extraction", value: null },
    ...extractionIds.map((id) => ({
      label: extractionLabels[id],
      value: id,
    })),
  ];

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
      <h1 className="mt-4 text-xl">Log a cup</h1>
      {actionData?.error ? (
        <p className="mt-4 text-sm">{actionData.error}</p>
      ) : null}
      <Form
        method="post"
        encType="multipart/form-data"
        className="mt-4 flex flex-col gap-4"
      >
        <label className="flex flex-col text-sm">
          Where did you drink it?
          <Select
            name="cafeId"
            defaultValue={(values?.cafeId ?? loaderData.selectedCafeId) || null}
            items={cafeItems}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {cafeItems
                  .filter((item) => item.value != null)
                  .map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className="text-xs text-neutral-500">
            Defaults to home. Pick a café only if you drank it out.
          </span>
        </label>
        <fieldset className="flex flex-col gap-2 border border-neutral-300 p-3 text-sm">
          <legend>Drank it at a new café? Add it here</legend>
          <label className="flex flex-col">
            Name
            <Input
              name="newCafeName"
              placeholder="Klover"
              defaultValue={values?.newCafeName ?? ""}
            />
          </label>
          <label className="flex flex-col">
            City
            <Input
              name="newCafeCity"
              placeholder="Paris"
              defaultValue={values?.newCafeCity ?? ""}
            />
          </label>
          <label className="flex flex-col">
            Notes
            <textarea
              name="newCafeNotes"
              rows={3}
              defaultValue={values?.newCafeNotes ?? ""}
              className={fieldClass}
            />
          </label>
        </fieldset>
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
            <Select
              name="coffeeId"
              defaultValue={values?.coffeeId || null}
              items={coffeeItems}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {coffeeItems
                    .filter((item) => item.value != null)
                    .map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Photo
              <Input
                type="file"
                name="photo"
                accept="image/*"
                onChange={(event) =>
                  setPhotoName(event.target.files?.[0]?.name ?? null)
                }
              />
            </label>
            <label className="flex flex-col text-sm">
              Name
              <Input
                name="name"
                placeholder="Las Flores"
                defaultValue={values?.name ?? ""}
              />
            </label>
            <label className="flex flex-col text-sm">
              Roaster
              <Select
                name="roasterId"
                defaultValue={values?.roasterId || null}
                items={roasterItems}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {roasterItems
                      .filter((item) => item.value != null)
                      .map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col text-sm">
              Or create a roaster
              <Input
                name="newRoasterName"
                placeholder="April"
                defaultValue={values?.newRoasterName ?? ""}
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
              <VocabCombobox
                kind="origin_country"
                name="originCountryIds"
                terms={loaderData.originCountries}
                defaultIds={values?.originCountryIds}
                placeholder="Search or add a country"
                multiple={isBlend}
              />
            </div>
            <fieldset className="text-sm">
              <legend>Process</legend>
              <VocabCombobox
                kind="process"
                name="processIds"
                terms={loaderData.processes}
                defaultIds={values?.processIds}
                placeholder="Search or add a proce"
              />
            </fieldset>
            <fieldset className="text-sm">
              <legend>Variety</legend>
              <VocabCombobox
                kind="variety"
                name="varietyIds"
                terms={loaderData.varieties}
                defaultIds={values?.varietyIds}
                placeholder="Search or add a variety"
              />
            </fieldset>
            <fieldset className="text-sm">
              <legend>Pack notes</legend>
              <VocabCombobox
                kind="pack_note"
                name="packNoteIds"
                terms={loaderData.packNotes}
                defaultIds={values?.packNoteIds}
                placeholder="Search or add a pack note"
              />
            </fieldset>
          </>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Cup photo
          <Input
            type="file"
            name="entryPhoto"
            accept="image/*"
            onChange={(event) =>
              setEntryPhotoName(event.target.files?.[0]?.name ?? null)
            }
          />
        </label>
        <label className="flex flex-col text-sm">
          Date *
          <Input
            type="date"
            name="tastedAt"
            required
            defaultValue={values?.tastedAt ?? loaderData.today}
            className="cursor-pointer"
          />
        </label>
        <label className="flex flex-col text-sm">
          Extraction
          <Select
            name="extraction"
            defaultValue={values?.extraction || null}
            items={extractionItems}
            onValueChange={(value) => setExtraction(value ?? "")}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {extractionItems
                  .filter((item) => item.value != null)
                  .map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
        {extraction === "filter" ? (
          <>
            <fieldset className="text-sm">
              <legend>Dripper</legend>
              <VocabCombobox
                kind="dripper"
                name="dripperId"
                terms={loaderData.drippers}
                defaultIds={values?.dripperIds}
                placeholder="Search or add a dripper"
                multiple={false}
              />
            </fieldset>
            <fieldset className="text-sm">
              <legend>Paper filter</legend>
              <VocabCombobox
                kind="paper_filter"
                name="paperFilterId"
                terms={loaderData.paperFilters}
                defaultIds={values?.paperFilterIds}
                placeholder="Search or add a paper filter"
                multiple={false}
              />
            </fieldset>
          </>
        ) : null}
        <label className="flex flex-col text-sm">
          Bloom (seconds)
          <Input
            name="bloomSeconds"
            inputMode="numeric"
            placeholder="60"
            defaultValue={values?.bloomSeconds ?? ""}
          />
        </label>
        <label className="flex flex-col text-sm">
          Ratio
          <Input
            name="ratio"
            placeholder="1:16"
            defaultValue={values?.ratio ?? ""}
          />
        </label>
        <label className="flex flex-col text-sm">
          Temperature (°C)
          <Input
            name="temperature"
            inputMode="decimal"
            placeholder="93"
            defaultValue={values?.temperature ?? ""}
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
        <Button type="submit" className="self-start" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </Form>
    </main>
  );
}
