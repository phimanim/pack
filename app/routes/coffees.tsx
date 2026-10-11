import { asc, eq, isNotNull, or } from "drizzle-orm";
import { Form, Link } from "react-router";
import { Button } from "~/components/ui/button";
import { db } from "~/db";
import { coffees, roasters } from "~/db/schema";

type CoffeeListItem = {
  id: string;
  name: string | null;
  image: string | null;
  roasterName: string | null;
};

export async function loader(): Promise<{ coffees: CoffeeListItem[] }> {
  const rows = await db
    .select({
      id: coffees.id,
      name: coffees.name,
      image: coffees.image,
      roasterName: roasters.name,
    })
    .from(coffees)
    .leftJoin(roasters, eq(coffees.roasterId, roasters.id))
    .where(or(isNotNull(coffees.image), eq(coffees.owned, true)))
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
    <main className="p-8">
      <p className="text-sm">
        <Link to="/coffees/new" className="underline">
          Add a coffee
        </Link>
        {" · "}
        <Link to="/entries/new" className="underline">
          Log a cup
        </Link>
        {" · "}
        <Link to="/roasters" className="underline">
          Roasters
        </Link>
        {" · "}
        <Link to="/cafes" className="underline">
          Cafés
        </Link>
        {" · "}
        <Link to="/vocab" className="underline">
          Vocabularies
        </Link>
      </p>
      <h1 className="mt-4 text-xl">Library</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          No packs in the library.{" "}
          <Link to="/coffees/new" className="underline">
            Add a coffee
          </Link>
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          {items.map((coffee) => (
            <li
              key={coffee.id}
              className="border border-neutral-300 -mr-px -mb-px"
            >
              <Link to={`/coffees/${coffee.id}`} className="block">
                {coffee.image ? (
                  <img
                    src={coffee.image}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full bg-neutral-50 p-3 text-sm">
                    {coffee.name ?? "Untitled"}
                  </div>
                )}
                <p className="border-t border-neutral-300 px-2 py-1 text-sm">
                  {coffee.name ?? "Untitled"}
                </p>
                {coffee.roasterName ? (
                  <p className="px-2 pb-2 text-xs text-neutral-500">
                    {coffee.roasterName}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Form method="post" action="/logout">
        <Button type="submit" variant="outline" className="mt-6">
          Log out
        </Button>
      </Form>
    </main>
  );
}
