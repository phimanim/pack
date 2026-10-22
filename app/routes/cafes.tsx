import { asc } from "drizzle-orm";
import { Link } from "react-router";
import { SiteNav } from "~/components/site-nav";
import { db } from "~/db";
import { cafes } from "~/db/schema";

type CafeListItem = { id: string; name: string };

export async function loader(): Promise<{ cafes: CafeListItem[] }> {
  const rows = await db
    .select({ id: cafes.id, name: cafes.name })
    .from(cafes)
    .orderBy(asc(cafes.name));

  return { cafes: rows };
}

export default function Cafes({
  loaderData,
}: {
  loaderData: { cafes: CafeListItem[] };
}) {
  const { cafes: items } = loaderData;

  return (
    <main className="mx-auto p-8">
      <SiteNav />
      <h1 className="mt-4 mb-10 border-b-2 border-outline pb-4 font-serif text-4xl">
        Cafés
      </h1>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          No cafés yet.{" "}
          <Link to="/cafes/new" className="underline">
            Add a café
          </Link>
        </p>
      ) : (
        <ul className="mt-4 divide-y-2 divide-outline-variant border-y-2 border-outline">
          {items.map((cafe) => (
            <li key={cafe.id}>
              <Link
                to={`/cafes/${cafe.id}`}
                className="block py-3 font-serif text-xl underline-offset-4 hover:underline"
              >
                {cafe.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
