import { data, Form, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { SiteNav } from "~/components/site-nav";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
  const fieldClass = "border-2 border-outline-variant px-2 py-1";

  return (
    <main className="mx-auto max-w-2xl p-8">
      <SiteNav />
      <h1 className="mt-4 font-serif text-4xl">Add a roaster</h1>
      {actionData?.error ? (
        <p className="mt-4 text-sm">{actionData.error}</p>
      ) : null}
      <Form
        method="post"
        className="mt-4 flex flex-col gap-4 border-2 border-outline bg-container p-5 sm:p-6"
      >
        <label className="flex flex-col text-sm">
          <span className="mb-1.5 font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Name
          </span>
          <Input name="name" required defaultValue={values?.name ?? ""} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1.5 font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Country
          </span>
          <Input name="country" defaultValue={values?.country ?? ""} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1.5 font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            City
          </span>
          <Input name="city" defaultValue={values?.city ?? ""} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1.5 font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            URL
          </span>
          <Input name="url" defaultValue={values?.url ?? ""} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1.5 font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Notes
          </span>
          <textarea
            name="notes"
            rows={4}
            defaultValue={values?.notes ?? ""}
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
