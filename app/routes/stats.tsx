import { eq, gte, isNotNull } from "drizzle-orm";
import { DateTime } from "luxon";
import { Link } from "react-router";
import { db } from "~/db";
import { coffees, entries, vocabularies } from "~/db/schema";
import { formatMinor } from "~/lib/money";

const DAYS = 30;

type CupsPerDayPoint = { day: string; count: number };

type VarietyPoint = { id: string; label: string; count: number };

type SpendPoint = {
  currency: string;
  totalMinor: number;
  cups: number;
};

type StatsData = {
  spend: SpendPoint[];
  cupsPerDay: CupsPerDayPoint[];
  varieties: VarietyPoint[];
  totalCups: number;
};

const NO_VARIETY = "__none__";

export async function loader(): Promise<StatsData> {
  const today = DateTime.now().startOf("day");
  const start = today.minus({ days: DAYS - 1 });

  const rows = await db
    .select({ tastedAt: entries.tastedAt })
    .from(entries)
    .where(gte(entries.tastedAt, start.toISODate() ?? ""));

  const counts = new Map<string, number>();
  for (const row of rows) {
    const day = DateTime.fromISO(row.tastedAt, { zone: "utc" }).toISODate();
    if (day) counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const cupsPerDay: CupsPerDayPoint[] = [];
  for (let i = 0; i < DAYS; i++) {
    const day = start.plus({ days: i }).toISODate() ?? "";
    cupsPerDay.push({ day, count: counts.get(day) ?? 0 });
  }

  const cupRows = await db
    .select({ varietyIds: coffees.varietyIds })
    .from(entries)
    .innerJoin(coffees, eq(entries.coffeeId, coffees.id));
  const labelRows = await db
    .select({ id: vocabularies.id, label: vocabularies.label })
    .from(vocabularies)
    .where(eq(vocabularies.kind, "variety"));
  const labels = new Map(labelRows.map((r) => [r.id, r.label]));

  // A cup counts once for each variety of its coffee.
  const varietyCounts = new Map<string, number>();
  for (const row of cupRows) {
    const ids = row.varietyIds.length > 0 ? row.varietyIds : [NO_VARIETY];
    for (const id of new Set(ids)) {
      varietyCounts.set(id, (varietyCounts.get(id) ?? 0) + 1);
    }
  }
  const varieties: VarietyPoint[] = [...varietyCounts].map(([id, count]) => ({
    id,
    label: id === NO_VARIETY ? "No variety" : (labels.get(id) ?? id),
    count,
  }));
  varieties.sort((a, b) => {
    if (a.id === NO_VARIETY) return 1;
    if (b.id === NO_VARIETY) return -1;
    return b.count - a.count || a.label.localeCompare(b.label);
  });

  // Cups drunk outside with a price, totalled per currency.
  const priceRows = await db
    .select({ priceMinor: entries.priceMinor, currency: entries.currency })
    .from(entries)
    .where(isNotNull(entries.priceMinor));
  const spendByCurrency = new Map<string, SpendPoint>();
  for (const row of priceRows) {
    if (row.priceMinor == null || !row.currency) continue;
    const point = spendByCurrency.get(row.currency) ?? {
      currency: row.currency,
      totalMinor: 0,
      cups: 0,
    };
    point.totalMinor += row.priceMinor;
    point.cups += 1;
    spendByCurrency.set(row.currency, point);
  }
  const spend = [...spendByCurrency.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );

  return { cupsPerDay, varieties, totalCups: cupRows.length, spend };
}

function CupsPerDay({ data }: { data: CupsPerDayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const first = DateTime.fromISO(data[0].day, { zone: "utc" });
  const last = DateTime.fromISO(data[data.length - 1].day, { zone: "utc" });

  return (
    <section aria-labelledby="cups-per-day">
      <h2 id="cups-per-day" className="text-lg">
        Cups per day
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        {total} {total === 1 ? "cup" : "cups"} in the last {DAYS} days
      </p>
      <ul className="mt-4 flex h-40 items-end gap-1 border-b border-neutral-300">
        {data.map((d) => {
          const label = DateTime.fromISO(d.day, { zone: "utc" }).toLocaleString(
            DateTime.DATE_MED,
          );
          return (
            <li
              key={d.day}
              data-day={d.day}
              data-count={d.count}
              title={`${label}: ${d.count}`}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <div
                className="w-full bg-neutral-800"
                style={{ height: `${(d.count / max) * 100}%` }}
              />
              <span className="sr-only">
                {label}: {d.count}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 flex justify-between text-xs text-neutral-500">
        <span>{first.toLocaleString(DateTime.DATE_MED)}</span>
        <span>max {max}/day</span>
        <span>{last.toLocaleString(DateTime.DATE_MED)}</span>
      </p>
    </section>
  );
}

function Spend({ data }: { data: SpendPoint[] }) {
  return (
    <section aria-labelledby="spend">
      <h2 id="spend" className="text-lg">
        Spend
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Cups with a price, all time. Currencies are not converted.
      </p>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No priced cups yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {data.map((d) => (
            <li
              key={d.currency}
              data-currency={d.currency}
              data-total-minor={d.totalMinor}
              data-cups={d.cups}
              className="flex justify-between text-sm"
            >
              <span>
                {d.cups} {d.cups === 1 ? "cup" : "cups"}
              </span>
              <span className="tabular-nums">
                {formatMinor(d.totalMinor, d.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Varieties({
  data,
  totalCups,
}: {
  data: VarietyPoint[];
  totalCups: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <section aria-labelledby="varieties">
      <h2 id="varieties" className="text-lg">
        Varieties
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        {totalCups} {totalCups === 1 ? "cup" : "cups"} all time. A coffee with
        several varieties counts once for each.
      </p>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No cups yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {data.map((d) => (
            <li
              key={d.id}
              data-variety={d.id}
              data-count={d.count}
              className="flex items-center gap-3 text-sm"
            >
              <span className="w-36 shrink-0 truncate">{d.label}</span>
              <div className="h-4 flex-1">
                <div
                  className="h-full bg-neutral-800"
                  style={{ width: `${(d.count / max) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums">
                {d.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Stats({ loaderData }: { loaderData: StatsData }) {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <p className="text-sm">
        <Link to="/" className="underline">
          Home
        </Link>
      </p>
      <h1 className="mt-4 text-xl">Stats</h1>
      <div className="mt-6 flex flex-col gap-10">
        <CupsPerDay data={loaderData.cupsPerDay} />
        <Spend data={loaderData.spend} />
        <Varieties
          data={loaderData.varieties}
          totalCups={loaderData.totalCups}
        />
      </div>
    </main>
  );
}
