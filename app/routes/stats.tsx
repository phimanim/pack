import { count, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { DateTime } from "luxon";
import { Link } from "react-router";
import { db } from "~/db";
import { coffees, entries, vocabularies } from "~/db/schema";
import { formatDate, formatMonth } from "~/lib/dates";
import { formatMinor } from "~/lib/money";

const DAYS = 30;

type CupsPerDayPoint = { day: string; count: number };

type VarietyPoint = { id: string; label: string; count: number };

type SpendMonth = {
  month: string;
  bagsMinor: number;
  bags: number;
  cupsMinor: number;
  cups: number;
};

type Average = { totalMinor: number; cups: number };

type SpendPoint = {
  currency: string;
  months: SpendMonth[];
  bagsMinor: number;
  cupsMinor: number;
  outside: Average;
  home: Average;
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

  const spend = await loadSpend();

  return { cupsPerDay, varieties, totalCups: cupRows.length, spend };
}

// Spend per currency (never converted). A bag has no purchase date, so it is
// attributed to the month of its roast date, else the month it was added.
async function loadSpend(): Promise<SpendPoint[]> {
  const bagRows = await db
    .select({
      id: coffees.id,
      priceMinor: coffees.priceMinor,
      currency: coffees.currency,
      roastingDate: coffees.roastingDate,
      createdAt: coffees.createdAt,
    })
    .from(coffees)
    .where(isNotNull(coffees.priceMinor));
  const cupRows = await db
    .select({
      priceMinor: entries.priceMinor,
      currency: entries.currency,
      tastedAt: entries.tastedAt,
    })
    .from(entries)
    .where(isNotNull(entries.priceMinor));
  const homeCounts = new Map(
    (
      await db
        .select({ coffeeId: entries.coffeeId, n: count() })
        .from(entries)
        .where(isNull(entries.cafeId))
        .groupBy(entries.coffeeId)
    ).map((r) => [r.coffeeId, r.n]),
  );

  const byCurrency = new Map<string, SpendPoint>();
  const months = new Map<string, Map<string, SpendMonth>>();
  const get = (currency: string, month: string) => {
    let point = byCurrency.get(currency);
    if (!point) {
      point = {
        currency,
        months: [],
        bagsMinor: 0,
        cupsMinor: 0,
        outside: { totalMinor: 0, cups: 0 },
        home: { totalMinor: 0, cups: 0 },
      };
      byCurrency.set(currency, point);
      months.set(currency, new Map());
    }
    const m = months.get(currency) as Map<string, SpendMonth>;
    let row = m.get(month);
    if (!row) {
      row = { month, bagsMinor: 0, bags: 0, cupsMinor: 0, cups: 0 };
      m.set(month, row);
      point.months.push(row);
    }
    return { point, row };
  };

  for (const bag of bagRows) {
    if (bag.priceMinor == null || !bag.currency) continue;
    const date = bag.roastingDate
      ? DateTime.fromISO(bag.roastingDate, { zone: "utc" })
      : DateTime.fromJSDate(bag.createdAt, { zone: "utc" });
    const { point, row } = get(bag.currency, date.toFormat("yyyy-MM"));
    row.bagsMinor += bag.priceMinor;
    row.bags += 1;
    point.bagsMinor += bag.priceMinor;
    const homeCups = homeCounts.get(bag.id) ?? 0;
    if (homeCups > 0) {
      point.home.totalMinor += bag.priceMinor;
      point.home.cups += homeCups;
    }
  }
  for (const cup of cupRows) {
    if (cup.priceMinor == null || !cup.currency) continue;
    const month = DateTime.fromISO(cup.tastedAt, { zone: "utc" }).toFormat(
      "yyyy-MM",
    );
    const { point, row } = get(cup.currency, month);
    row.cupsMinor += cup.priceMinor;
    row.cups += 1;
    point.cupsMinor += cup.priceMinor;
    point.outside.totalMinor += cup.priceMinor;
    point.outside.cups += 1;
  }

  const result = [...byCurrency.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
  for (const point of result) {
    point.months.sort((a, b) => b.month.localeCompare(a.month));
  }
  return result;
}

function CupsPerDay({ data }: { data: CupsPerDayPoint[] }) {
  const peak = Math.max(0, ...data.map((d) => d.count));
  // Bar scaling only: avoids dividing by zero on an empty window.
  const max = Math.max(1, peak);
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
          const label = formatDate(d.day);
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
        <span>{formatDate(first)}</span>
        <span>max {peak}/day</span>
        <span>{formatDate(last)}</span>
      </p>
    </section>
  );
}

function averageLabel(avg: Average, currency: string) {
  if (avg.cups === 0) return "n/a";
  return formatMinor(Math.round(avg.totalMinor / avg.cups), currency);
}

function Spend({ data }: { data: SpendPoint[] }) {
  return (
    <section aria-labelledby="spend">
      <h2 id="spend" className="text-lg">
        Spend
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Priced bags and priced cups drunk outside, per month. A bag counts in
        the month of its roast date, or the month it was added if it has none.
        Currencies are not converted.
      </p>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Nothing priced yet.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-8">
          {data.map((point) => {
            const max = Math.max(
              1,
              ...point.months.map((m) => m.bagsMinor + m.cupsMinor),
            );
            return (
              <div
                key={point.currency}
                data-currency={point.currency}
                className="flex flex-col gap-3"
              >
                <h3 className="text-sm">
                  {point.currency}: bags{" "}
                  {formatMinor(point.bagsMinor, point.currency)}, cups{" "}
                  {formatMinor(point.cupsMinor, point.currency)}
                </h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div data-avg="outside">
                    <dt className="text-neutral-500">
                      Average outside cup ({point.outside.cups})
                    </dt>
                    <dd className="tabular-nums">
                      {averageLabel(point.outside, point.currency)}
                    </dd>
                  </div>
                  <div data-avg="home">
                    <dt className="text-neutral-500">
                      Average home cup ({point.home.cups})
                    </dt>
                    <dd className="tabular-nums">
                      {averageLabel(point.home, point.currency)}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-neutral-500">
                  Home cup = bag price divided by the home cups logged from it,
                  bags with a price and at least one home cup only.
                </p>
                <ul className="flex flex-col gap-2">
                  {point.months.map((m) => {
                    const month = formatMonth(m.month);
                    return (
                      <li
                        key={m.month}
                        data-month={m.month}
                        data-bags-minor={m.bagsMinor}
                        data-cups-minor={m.cupsMinor}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span className="w-20 shrink-0">{month}</span>
                        <div className="flex h-4 flex-1">
                          <div
                            className="h-full bg-neutral-800"
                            title={`Bags: ${formatMinor(m.bagsMinor, point.currency)}`}
                            style={{ width: `${(m.bagsMinor / max) * 100}%` }}
                          />
                          <div
                            className="h-full bg-neutral-400"
                            title={`Cups: ${formatMinor(m.cupsMinor, point.currency)}`}
                            style={{ width: `${(m.cupsMinor / max) * 100}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-right text-xs tabular-nums">
                          {m.bags} {m.bags === 1 ? "bag" : "bags"}{" "}
                          {formatMinor(m.bagsMinor, point.currency)} / {m.cups}{" "}
                          {m.cups === 1 ? "cup" : "cups"}{" "}
                          {formatMinor(m.cupsMinor, point.currency)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="flex gap-4 text-xs text-neutral-500">
                  <span>Dark: bags</span>
                  <span>Light: cups outside</span>
                </p>
              </div>
            );
          })}
        </div>
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
  const peak = Math.max(0, ...data.map((d) => d.count));
  // Bar scaling only: avoids dividing by zero on an empty window.
  const max = Math.max(1, peak);

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
