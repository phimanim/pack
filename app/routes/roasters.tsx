import { asc } from "drizzle-orm";
import { Link } from "react-router";
import { SiteNav } from "~/components/site-nav";
import { buttonVariants } from "~/components/ui/button";
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
    <main className="mx-auto p-8">
      <SiteNav />
      <div className="mt-4 mb-10 flex items-end justify-between gap-4 border-b-2 border-outline pb-4">
        <h1 className="font-serif text-4xl">Roasters</h1>
        <Link
          to="/roasters/new"
          className={buttonVariants({ variant: "outline" })}
        >
          Add a roaster
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          No roasters yet.{" "}
          <Link to="/roasters/new" className="underline">
            Add a roaster
          </Link>
        </p>
      ) : (
        <ul className="mt-4 divide-y-2 divide-outline-variant border-y-2 border-outline">
          {items.map((roaster) => (
            <li key={roaster.id}>
              <Link
                to={`/roasters/${roaster.id}`}
                className="block py-3 font-serif text-xl underline-offset-4 hover:underline"
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
