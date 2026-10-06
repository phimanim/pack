import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { db } from "~/db";
import { roasters } from "~/db/schema";

type FormValues = {
  name: string;
  country: string;
  city: string;
  url: string;
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

function normalizeUrl(value: string | null): string | null {
  if (value == null) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  country: z.string().nullable(),
  city: z.string().nullable(),
  url: z.union([z.httpUrl({ error: "Invalid url" }), z.null()]),
  notes: z.string().nullable(),
});

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const values: FormValues = {
    name: String(formData.get("name") ?? ""),
    country: String(formData.get("country") ?? ""),
    city: String(formData.get("city") ?? ""),
    url: String(formData.get("url") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const parsed = schema.safeParse({
    name: values.name,
    country: blankToNull(formData.get("country")),
    city: blankToNull(formData.get("city")),
    url: normalizeUrl(blankToNull(formData.get("url"))),
    notes: blankToNull(formData.get("notes")),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid roaster";
    return data({ error: message, values } satisfies ActionData, {
      status: 400,
    });
  }

  const id = crypto.randomUUID();
  await db.insert(roasters).values({
    id,
    name: parsed.data.name,
    country: parsed.data.country,
    city: parsed.data.city,
    url: parsed.data.url,
    notes: parsed.data.notes,
  });

  throw redirect(`/roasters/${id}`);
}

export default function NewRoaster({
  actionData,
}: {
  actionData?: ActionData;
}) {
  const navigation = useNavigation();
  const isSaving = navigation.state !== "idle";
  const values = actionData?.values;
  const fieldClass = "border border-neutral-300 px-2 py-1";

  return (
    <main className="mx-auto max-w-2xl p-8">
      <p className="text-sm">
        <Link to="/" className="underline">
          Home
        </Link>
        {" · "}
        <Link to="/roasters" className="underline">
          Roasters
        </Link>
      </p>
      <h1 className="mt-4 text-xl">Add a roaster</h1>
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
          Country
          <input
            name="country"
            defaultValue={values?.country ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col text-sm">
          City
          <input
            name="city"
            defaultValue={values?.city ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col text-sm">
          URL
          <input
            name="url"
            defaultValue={values?.url ?? ""}
            className={fieldClass}
          />
        </label>
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
    </main>
  );
}
