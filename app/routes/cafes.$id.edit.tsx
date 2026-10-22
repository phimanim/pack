import { eq } from "drizzle-orm";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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

export async function loader({ params }: { params: { id: string } }) {
  const parsed = z.uuid().safeParse(params.id);
  if (!parsed.success) {
    throw data(null, { status: 404 });
  }

  const [cafe] = await db
    .select()
    .from(cafes)
    .where(eq(cafes.id, parsed.data))
    .limit(1);

  if (!cafe) {
    throw data(null, { status: 404 });
  }

  return { cafe };
}

export async function action({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  const parsedId = z.uuid().safeParse(params.id);
  if (!parsedId.success) {
    throw data(null, { status: 404 });
  }

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

  const updated = await db
    .update(cafes)
    .set({
      name: parsed.data.name,
      city: parsed.data.city,
      notes: parsed.data.notes,
    })
    .where(eq(cafes.id, parsedId.data))
    .returning({ id: cafes.id });

  if (updated.length === 0) {
    throw data(null, { status: 404 });
  }

  throw redirect(`/cafes/${parsedId.data}`);
}

export default function EditCafe({
  loaderData,
  actionData,
}: {
  loaderData: { cafe: typeof cafes.$inferSelect };
  actionData?: ActionData;
}) {
  const { cafe } = loaderData;
  const navigation = useNavigation();
  const isSaving = navigation.state !== "idle";
  const values: FormValues = actionData?.values ?? {
    name: cafe.name,
    city: cafe.city ?? "",
    notes: cafe.notes ?? "",
  };
  const fieldClass = "border border-neutral-300 px-2 py-1";

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
        <Link to={`/cafes/${cafe.id}`} className="underline">
          Back to {cafe.name}
        </Link>
      </p>
      <h1 className="mt-4 text-xl">Edit café</h1>
      {actionData?.error ? (
        <p className="mt-4 text-sm">{actionData.error}</p>
      ) : null}
      <Form method="post" className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col text-sm">
          Name
          <Input name="name" required defaultValue={values.name} />
        </label>
        <label className="flex flex-col text-sm">
          City
          <Input name="city" defaultValue={values.city} />
        </label>
        <label className="flex flex-col text-sm">
          Notes
          <textarea
            name="notes"
            rows={4}
            defaultValue={values.notes}
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
