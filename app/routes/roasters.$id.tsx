import { eq } from "drizzle-orm";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { db } from "~/db";
import { roasters } from "~/db/schema";

type Roaster = typeof roasters.$inferSelect;

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

export async function action({ params }: { params: { id: string } }) {
  const parsed = z.uuid().safeParse(params.id);
  if (!parsed.success) {
    throw data(null, { status: 404 });
  }

  await db.delete(roasters).where(eq(roasters.id, parsed.data));
  throw redirect("/roasters");
}

export default function RoasterDetail({
  loaderData,
}: {
  loaderData: { roaster: Roaster };
}) {
  const navigation = useNavigation();
  const isDeleting = navigation.state !== "idle";
  const { roaster } = loaderData;

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
      <h1 className="mt-4 text-xl">{roaster.name}</h1>
      {roaster.country ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Country</span>
          <br />
          {roaster.country}
        </p>
      ) : null}
      {roaster.city ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">City</span>
          <br />
          {roaster.city}
        </p>
      ) : null}
      {roaster.url ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">URL</span>
          <br />
          <a href={roaster.url} className="underline">
            {roaster.url}
          </a>
        </p>
      ) : null}
      {roaster.notes ? (
        <p className="mt-2">
          <span className="text-sm text-neutral-500">Notes</span>
          <br />
          {roaster.notes}
        </p>
      ) : null}
      <Form
        method="post"
        className="mt-6"
        onSubmit={(event) => {
          if (!confirm("Delete this roaster?")) event.preventDefault();
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
