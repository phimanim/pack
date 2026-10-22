import { eq } from "drizzle-orm";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { db } from "~/db";
import { roasters } from "~/db/schema";

type Roaster = typeof roasters.$inferSelect;

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

export async function loader({
  params,
}: {
  params: { id: string };
}): Promise<{ roaster: Roaster }> {
  const parsed = z.uuid().safeParse(params.id);
  if (!parsed.success) {
    throw data(null, { status: 404 });
  }

  const [roaster] = await db
    .select()
    .from(roasters)
    .where(eq(roasters.id, parsed.data))
    .limit(1);

  if (!roaster) {
    throw data(null, { status: 404 });
  }

  return { roaster };
}

export async function action({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  const id = z.uuid().safeParse(params.id);
  if (!id.success) {
    throw data(null, { status: 404 });
  }

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

  await db
    .update(roasters)
    .set({
      name: parsed.data.name,
      country: parsed.data.country,
      city: parsed.data.city,
      url: parsed.data.url,
      notes: parsed.data.notes,
    })
    .where(eq(roasters.id, id.data));

  throw redirect(`/roasters/${id.data}`);
}

export default function EditRoaster({
  loaderData,
  actionData,
}: {
  loaderData: { roaster: Roaster };
  actionData?: ActionData;
}) {
  const navigation = useNavigation();
  const isSaving = navigation.state !== "idle";
  const { roaster } = loaderData;
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
        {" · "}
        <Link to={`/roasters/${roaster.id}`} className="underline">
          {roaster.name}
        </Link>
      </p>
      <h1 className="mt-4 text-xl">Edit roaster</h1>
      {actionData?.error ? (
        <p className="mt-4 text-sm">{actionData.error}</p>
      ) : null}
      <Form method="post" className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col text-sm">
          Name
          <Input
            name="name"
            required
            defaultValue={values?.name ?? roaster.name}
          />
        </label>
        <label className="flex flex-col text-sm">
          Country
          <Input
            name="country"
            defaultValue={values?.country ?? roaster.country ?? ""}
          />
        </label>
        <label className="flex flex-col text-sm">
          City
          <Input
            name="city"
            defaultValue={values?.city ?? roaster.city ?? ""}
          />
        </label>
        <label className="flex flex-col text-sm">
          URL
          <Input name="url" defaultValue={values?.url ?? roaster.url ?? ""} />
        </label>
        <label className="flex flex-col text-sm">
          Notes
          <textarea
            name="notes"
            rows={4}
            defaultValue={values?.notes ?? roaster.notes ?? ""}
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
