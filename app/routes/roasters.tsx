import { asc } from "drizzle-orm";
import { Link } from "react-router";
import { db } from "~/db";
import { roasters } from "~/db/schema";

type RoasterListItem = { id: string; name: string };

export async function loader(): Promise<{ roasters: RoasterListItem[] }> {
  const rows = await db
    .select({ id: roasters.id, name: roasters.name })
    .from(roasters)
    .orderBy(asc(roasters.name));

  return { roasters: rows };
}

export default function Roasters({
  loaderData,
}: {
  loaderData: { roasters: RoasterListItem[] };
}) {
  const { roasters: items } = loaderData;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <p className="text-sm">
        <Link to="/" className="underline">
          Home
        </Link>
        {" · "}
        <Link to="/roasters/new" className="underline">
          Add a roaster
        </Link>
      </p>
      <h1 className="mt-4 text-xl">Roasters</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          No roasters yet.{" "}
          <Link to="/roasters/new" className="underline">
            Add a roaster
          </Link>
        </p>
      ) : (
        <ul className="mt-4 border border-neutral-300">
          {items.map((roaster) => (
            <li
              key={roaster.id}
              className="border-b border-neutral-300 last:border-b-0"
            >
              <Link
                to={`/roasters/${roaster.id}`}
                className="block px-3 py-2 underline"
              >
                {roaster.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
