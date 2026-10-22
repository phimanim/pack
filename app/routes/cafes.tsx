import { asc } from "drizzle-orm";
import { Link } from "react-router";
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
    <main className="mx-auto max-w-2xl p-8">
      <p className="text-sm">
        <Link to="/" className="underline">
          Home
        </Link>
        {" · "}
        <Link to="/cafes/new" className="underline">
          Add a café
        </Link>
      </p>
      <h1 className="mt-4 text-xl">Cafés</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          No cafés yet.{" "}
          <Link to="/cafes/new" className="underline">
            Add a café
          </Link>
        </p>
      ) : (
        <ul className="mt-4 border border-neutral-300">
          {items.map((cafe) => (
            <li
              key={cafe.id}
              className="border-b border-neutral-300 last:border-b-0"
            >
              <Link
                to={`/cafes/${cafe.id}`}
                className="block px-3 py-2 underline"
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
