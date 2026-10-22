import { gte } from "drizzle-orm";
import { DateTime } from "luxon";
import { Link } from "react-router";
import { db } from "~/db";
import { entries } from "~/db/schema";

const DAYS = 30;

type CupsPerDayPoint = { day: string; count: number };

type StatsData = { cupsPerDay: CupsPerDayPoint[] };

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

  return { cupsPerDay };
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
      </div>
    </main>
  );
}
