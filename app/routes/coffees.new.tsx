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
import { db } from "~/db";
import {
  coffees,
  roasters,
  type VocabKind,
  vocabKinds,
  vocabularies,
} from "~/db/schema";
import { slugifyTerm } from "~/lib/slug";

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
  newRoasterName: string;
  newRoasterCountry: string;
  newRoasterCity: string;
  newRoasterUrl: string;
  originCountryIds: string[];
  region: string;
  producer: string;
  farm: string;
  processIds: string[];
  varietyIds: string[];
  packNoteIds: string[];
  altitudeMeters: string;
  harvestYear: string;
  roastingDate: string;
  notes: string;
  owned: boolean;
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

function normalizeUrl(value: string | null): string | null {
  if (value == null) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function hasTerm(
  terms: { id: string; kind: string }[],
  kind: string,
  id: string,
): boolean {
  return terms.some((t) => t.kind === kind && t.id === id);
}

function photoFromForm(formData: FormData): File | null {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return null;
  return photo;
}

const addTermSchema = z.object({
  intent: z.literal("add_term"),
  kind: z.enum(vocabKinds),
  label: z.string().trim().min(1, "Label is required"),
});

const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    roasterId: z.uuid().nullable(),
    newRoasterName: z.string().nullable(),
    newRoasterCountry: z.string().nullable(),
    newRoasterCity: z.string().nullable(),
    newRoasterUrl: z.union([z.httpUrl({ error: "Invalid url" }), z.null()]),
    originCountryIds: z.array(z.string()),
    region: z.string().nullable(),
    producer: z.string().nullable(),
    farm: z.string().nullable(),
    processIds: z.array(z.string()),
    varietyIds: z.array(z.string()),
    packNoteIds: z.array(z.string()),
    altitudeMeters: z
      .number()
      .int("Altitude must be a whole number")
      .min(0)
      .nullable(),
    harvestYear: z
      .number()
      .int("Harvest year must be a year")
      .min(1900)
      .max(DateTime.now().year + 1)
      .nullable(),
    roastingDate: z
      .string()
      .nullable()
      .refine(
        (value) =>
          value == null || DateTime.fromISO(value, { zone: "utc" }).isValid,
        "Invalid roast date",
      ),
    notes: z.string().nullable(),
  })
  .refine((value) => value.roasterId != null || value.newRoasterName != null, {
    message: "Choose or create a roaster",
    path: ["roasterId"],
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

  const values: FormValues = {
    name: String(formData.get("name") ?? ""),
    roasterId: String(formData.get("roasterId") ?? ""),
    newRoasterName: String(formData.get("newRoasterName") ?? ""),
    newRoasterCountry: String(formData.get("newRoasterCountry") ?? ""),
    newRoasterCity: String(formData.get("newRoasterCity") ?? ""),
    newRoasterUrl: String(formData.get("newRoasterUrl") ?? ""),
    originCountryIds: formData.getAll("originCountryIds").map(String),
    region: String(formData.get("region") ?? ""),
    producer: String(formData.get("producer") ?? ""),
    farm: String(formData.get("farm") ?? ""),
    processIds: formData.getAll("processIds").map(String),
    varietyIds: formData.getAll("varietyIds").map(String),
    packNoteIds: formData.getAll("packNoteIds").map(String),
    altitudeMeters: String(formData.get("altitudeMeters") ?? ""),
    harvestYear: String(formData.get("harvestYear") ?? ""),
    roastingDate: String(formData.get("roastingDate") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    owned: formData.get("owned") === "true",
  };

  const fail = (message: string, status = 400) =>
    data({ error: message, values } satisfies ActionData, { status });

  const altitudeMeters = blankToInt(formData.get("altitudeMeters"));
  const harvestYear = blankToInt(formData.get("harvestYear"));
  if (Number.isNaN(altitudeMeters) || Number.isNaN(harvestYear)) {
    return fail("Altitude and harvest year must be whole numbers");
  }

  const parsed = schema.safeParse({
    name: values.name,
    roasterId: blankToNull(formData.get("roasterId")),
    newRoasterName: blankToNull(formData.get("newRoasterName")),
    newRoasterCountry: blankToNull(formData.get("newRoasterCountry")),
    newRoasterCity: blankToNull(formData.get("newRoasterCity")),
    newRoasterUrl: normalizeUrl(blankToNull(formData.get("newRoasterUrl"))),
    originCountryIds: values.originCountryIds.filter((id) => id !== ""),
    region: blankToNull(formData.get("region")),
    producer: blankToNull(formData.get("producer")),
    farm: blankToNull(formData.get("farm")),
    processIds: values.processIds.filter((id) => id !== ""),
    varietyIds: values.varietyIds.filter((id) => id !== ""),
    packNoteIds: values.packNoteIds.filter((id) => id !== ""),
    altitudeMeters,
    harvestYear,
    roastingDate: blankToNull(formData.get("roastingDate")),
    notes: blankToNull(formData.get("notes")),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid coffee");
  }

  const photo = photoFromForm(formData);
  if (photo && !photo.type.startsWith("image/")) {
    return fail("Photo must be an image");
  }

  let roasterId = parsed.data.roasterId;
  if (parsed.data.newRoasterName) {
    roasterId = crypto.randomUUID();
    await db.insert(roasters).values({
      id: roasterId,
      name: parsed.data.newRoasterName,
      country: parsed.data.newRoasterCountry,
      city: parsed.data.newRoasterCity,
      url: parsed.data.newRoasterUrl,
    });
  } else if (roasterId) {
    const [roaster] = await db
      .select({ id: roasters.id })
      .from(roasters)
      .where(eq(roasters.id, roasterId))
      .limit(1);
    if (!roaster) return fail("Roaster is required");
  }

  if (!roasterId) return fail("Choose or create a roaster");

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
  if (parsed.data.packNoteIds.some((id) => !hasTerm(terms, "pack_note", id))) {
    return fail("Invalid pack note");
  }

  const id = crypto.randomUUID();
  let image: string | null = null;
  if (photo) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return fail("BLOB_READ_WRITE_TOKEN is not set");
    }
    const ext = photo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const blob = await put(`coffees/${id}.${ext}`, photo, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    image = blob.url;
  }

  await db.insert(coffees).values({
    id,
    name: parsed.data.name,
    roasterId,
    originCountryIds: parsed.data.originCountryIds,
    region: parsed.data.region,
    producer: parsed.data.producer,
    farm: parsed.data.farm,
    processIds: parsed.data.processIds,
    varietyIds: parsed.data.varietyIds,
    packNoteIds: parsed.data.packNoteIds,
    altitudeMeters: parsed.data.altitudeMeters,
    harvestYear: parsed.data.harvestYear,
    roastingDate: parsed.data.roastingDate
      ? DateTime.fromISO(parsed.data.roastingDate, { zone: "utc" }).toISODate()
      : null,
    image,
    owned: values.owned,
    notes: parsed.data.notes,
  });

  throw redirect(`/coffees/${id}`);
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
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fetcher.state !== "idle"}
          onClick={() => {
            fetcher.submit(
              { intent: "add_term", kind, label },
              { method: "post" },
            );
            setLabel("");
          }}
        >
          Add
        </Button>
      </div>
      {fetcher.data?.error ? (
        <p className="mt-1 text-sm">{fetcher.data.error}</p>
      ) : null}
    </div>
  );
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
  const { roasters: roasterOptions } = loaderData;
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [roasterQuery, setRoasterQuery] = useState("");
  const [isBlend, setIsBlend] = useState(
    (values?.originCountryIds.length ?? 0) > 1,
  );
  const filteredRoasters = roasterOptions.filter((roaster) =>
    roaster.name.toLowerCase().includes(roasterQuery.trim().toLowerCase()),
  );
  const roasterItems = [
    { label: "Select a roaster", value: null },
    ...filteredRoasters.map((roaster) => ({
      label: roaster.name,
      value: roaster.id,
    })),
  ];
  const originCountryItems = [
    { label: "Select a country", value: null },
    ...loaderData.originCountries.map((term) => ({
      label: term.label,
      value: term.id,
    })),
  ];

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
      <h1 className="mt-4 text-xl">Add a coffee</h1>
      {actionData?.error ? (
        <p className="mt-4 text-sm">{actionData.error}</p>
      ) : null}
      <Form
        method="post"
        encType="multipart/form-data"
        className="mt-4 flex flex-col gap-4"
      >
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
          Name *
          <Input
            name="name"
            required
            placeholder="Las Flores"
            defaultValue={values?.name ?? ""}
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span>Roaster *</span>
          <Input
            value={roasterQuery}
            onChange={(event) => setRoasterQuery(event.target.value)}
            placeholder="Search roasters"
          />
          <Select
            name="roasterId"
            defaultValue={values?.roasterId || null}
            items={roasterItems}
          >
            <SelectTrigger className="w-full">
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
        </div>
        <fieldset className="flex flex-col gap-2 border border-neutral-300 p-3 text-sm">
          <legend>Or create a roaster</legend>
          <label className="flex flex-col">
            Name
            <Input
              name="newRoasterName"
              placeholder="April"
              defaultValue={values?.newRoasterName ?? ""}
            />
          </label>
          <label className="flex flex-col">
            Country
            <Input
              name="newRoasterCountry"
              placeholder="France"
              defaultValue={values?.newRoasterCountry ?? ""}
            />
          </label>
          <label className="flex flex-col">
            City
            <Input
              name="newRoasterCity"
              placeholder="Paris"
              defaultValue={values?.newRoasterCity ?? ""}
            />
          </label>
          <label className="flex flex-col">
            URL
            <Input
              name="newRoasterUrl"
              placeholder="https://"
              defaultValue={values?.newRoasterUrl ?? ""}
            />
          </label>
        </fieldset>
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
                    defaultChecked={values?.originCountryIds.includes(term.id)}
                  />
                  {term.label}
                </label>
              ))}
            </div>
          ) : (
            <Select
              name="originCountryIds"
              defaultValue={values?.originCountryIds[0] || null}
              items={originCountryItems}
            >
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {originCountryItems
                    .filter((item) => item.value != null)
                    .map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <AddTerm kind="origin_country" placeholder="or add a country" />
        </div>
        <label className="flex flex-col text-sm">
          Region
          <Input
            name="region"
            placeholder="Yirgacheffe"
            defaultValue={values?.region ?? ""}
          />
        </label>
        <label className="flex flex-col text-sm">
          Farm
          <Input
            name="farm"
            placeholder="Finca La Esperanza"
            defaultValue={values?.farm ?? ""}
          />
        </label>
        <label className="flex flex-col text-sm">
          Producer
          <Input
            name="producer"
            placeholder="Lopez family"
            defaultValue={values?.producer ?? ""}
          />
        </label>
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
        <label className="flex flex-col text-sm">
          Roast date
          <Input
            type="date"
            name="roastingDate"
            defaultValue={values?.roastingDate ?? ""}
            className="cursor-pointer"
          />
        </label>
        <label className="flex flex-col text-sm">
          Harvest year
          <Input
            name="harvestYear"
            inputMode="numeric"
            placeholder="2025"
            defaultValue={values?.harvestYear ?? ""}
          />
        </label>
        <label className="flex flex-col text-sm">
          Altitude (m)
          <Input
            name="altitudeMeters"
            inputMode="numeric"
            placeholder="1800"
            defaultValue={values?.altitudeMeters ?? ""}
          />
        </label>
        <label className="flex flex-col text-sm">
          Notes
          <textarea
            name="notes"
            rows={4}
            placeholder="What's on the bag"
            defaultValue={values?.notes ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="owned"
            value="true"
            defaultChecked={values?.owned ?? true}
            className="h-4 w-4 cursor-pointer"
          />
          <span>
            <span className="font-medium">In my home library</span>
            <span className="block text-xs text-neutral-500">
              Check if you bought this coffee. Uncheck if you drank it at a café
              or somewhere else.
            </span>
          </span>
        </label>
        <Button type="submit" className="self-start" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </Form>
    </main>
  );
}
