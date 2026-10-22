import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { db } from "~/db";
import { cafes } from "~/db/schema";

type FormValues = {
  name: string;
  city: string;
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

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  city: z.string().nullable(),
  notes: z.string().nullable(),
});

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const values: FormValues = {
    name: String(formData.get("name") ?? ""),
    city: String(formData.get("city") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const parsed = schema.safeParse({
    name: values.name,
    city: blankToNull(formData.get("city")),
    notes: blankToNull(formData.get("notes")),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid café";
    return data({ error: message, values } satisfies ActionData, {
      status: 400,
    });
  }

  const id = crypto.randomUUID();
  await db.insert(cafes).values({
    id,
    name: parsed.data.name,
    city: parsed.data.city,
    notes: parsed.data.notes,
  });

  throw redirect(`/cafes/${id}`);
}

export default function NewCafe({ actionData }: { actionData?: ActionData }) {
  const navigation = useNavigation();
  const isSaving = navigation.state !== "idle";
  const values = actionData?.values;
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
      <h1 className="mt-4 font-serif text-4xl">Add a café</h1>
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
            City
          </span>
          <Input name="city" defaultValue={values?.city ?? ""} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1.5 font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Notes
          </span>
          <Textarea name="notes" rows={4} defaultValue={values?.notes ?? ""} />
        </label>
        <Button type="submit" className="self-start" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </Form>
    </main>
  );
}
