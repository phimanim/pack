import { asc, eq } from "drizzle-orm";
import { Link } from "react-router";
import { db } from "~/db";
import { coffees, roasters } from "~/db/schema";

type CoffeeListItem = {
  id: string;
  name: string;
  roasterName: string;
};

export async function loader(): Promise<{ coffees: CoffeeListItem[] }> {
  const rows = await db
    .select({
      id: coffees.id,
      name: coffees.name,
      roasterName: roasters.name,
    })
    .from(coffees)
    .innerJoin(roasters, eq(coffees.roasterId, roasters.id))
    .orderBy(asc(coffees.name));

  return { coffees: rows };
}

export default function Coffees({
  loaderData,
}: {
  loaderData: { coffees: CoffeeListItem[] };
}) {
  const { coffees: items } = loaderData;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <p className="text-sm">
        <Link to="/" className="underline">
          Home
        </Link>
        {" · "}
        <Link to="/coffees/new" className="underline">
          Add a coffee
        </Link>
      </p>
      <h1 className="mt-4 text-xl">Coffees</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          No coffees yet.{" "}
          <Link to="/coffees/new" className="underline">
            Add a coffee
          </Link>
        </p>
      ) : (
        <ul className="mt-4 border border-neutral-300">
          {items.map((coffee) => (
            <li
              key={coffee.id}
              className="border-b border-neutral-300 last:border-b-0"
            >
              <Link
                to={`/coffees/${coffee.id}`}
                className="block px-3 py-2 underline"
              >
                {coffee.name}
              </Link>
              <p className="px-3 pb-2 text-sm text-neutral-500">
                {coffee.roasterName}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
