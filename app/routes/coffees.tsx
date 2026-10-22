import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { Form, Link, useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "~/components/ui/combobox";
import { db } from "~/db";
import {
  cafes,
  coffees,
  type Extraction,
  entries,
  extractionLabels,
  type Recipe,
  roasters,
  vocabularies,
} from "~/db/schema";
import { formatDate } from "~/lib/dates";

type Option = { id: string; label: string };

function gearLabel(
  row: { dripperId: string | null; paperFilterId: string | null },
  terms: { id: string; kind: string; label: string }[],
): string | null {
  const labels = [
    terms.find((t) => t.kind === "dripper" && t.id === row.dripperId)?.label,
    terms.find((t) => t.kind === "paper_filter" && t.id === row.paperFilterId)
      ?.label,
  ].filter((label): label is string => label != null);
  return labels.length > 0 ? labels.join(" · ") : null;
}

type CoffeeListItem = {
  id: string;
  name: string | null;
  image: string | null;
  roasterName: string | null;
};

type AtHomeEntry = {
  id: string;
  tastedAt: string;
  extraction: Extraction | null;
  note: string | null;
  image: string | null;
  recipe: Recipe | null;
  gear: string | null;
  coffee: {
    id: string;
    name: string | null;
    roasterName: string | null;
  };
};

type OutsideEntry = {
  id: string;
  tastedAt: string;
  extraction: Extraction | null;
  note: string | null;
  image: string | null;
  recipe: Recipe | null;
  gear: string | null;
  coffee: {
    id: string;
    name: string | null;
    roasterName: string | null;
  };
  cafe: {
    id: string;
    name: string;
  };
};

export async function loader({ request }: { request: Request }): Promise<{
  coffees: CoffeeListItem[];
  atHomeEntries: AtHomeEntry[];
  outsideEntries: OutsideEntry[];
  roasters: Option[];
  originCountries: Option[];
}> {
  const params = new URL(request.url).searchParams;
  const showAll = params.get("all") === "true";
  const roasterIds = params.getAll("roaster").filter(Boolean);
  const countryIds = params.getAll("country").filter(Boolean);

  const conditions = [];
  if (!showAll) {
    conditions.push(or(isNotNull(coffees.image), eq(coffees.owned, true)));
  }
  if (roasterIds.length > 0) {
    conditions.push(inArray(coffees.roasterId, roasterIds));
  }
  if (countryIds.length > 0) {
    conditions.push(
      sql`${coffees.originCountryIds}::text[] && ${sql.param(countryIds)}::text[]`,
    );
  }

  const rows = await db
    .select({
      id: coffees.id,
      name: coffees.name,
      image: coffees.image,
      roasterName: roasters.name,
    })
    .from(coffees)
    .leftJoin(roasters, eq(coffees.roasterId, roasters.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(coffees.name));

  const roasterOptions = await db
    .select({ id: roasters.id, name: roasters.name })
    .from(roasters)
    .orderBy(asc(roasters.name));

  const countryTerms = await db
    .select({ id: vocabularies.id, label: vocabularies.label })
    .from(vocabularies)
    .where(eq(vocabularies.kind, "origin_country"))
    .orderBy(asc(vocabularies.sort), asc(vocabularies.label));

  const gearTerms = await db
    .select({
      id: vocabularies.id,
      kind: vocabularies.kind,
      label: vocabularies.label,
    })
    .from(vocabularies)
    .where(inArray(vocabularies.kind, ["dripper", "paper_filter"]));

  const atHomeRows = await db
    .select({
      id: entries.id,
      tastedAt: entries.tastedAt,
      extraction: entries.extraction,
      note: entries.note,
      image: entries.image,
      recipe: entries.recipe,
      dripperId: entries.dripperId,
      paperFilterId: entries.paperFilterId,
      coffeeId: coffees.id,
      coffeeName: coffees.name,
      roasterName: roasters.name,
    })
    .from(entries)
    .innerJoin(coffees, eq(entries.coffeeId, coffees.id))
    .leftJoin(roasters, eq(coffees.roasterId, roasters.id))
    .where(isNull(entries.cafeId))
    .orderBy(desc(entries.tastedAt), desc(entries.createdAt));

  const atHomeEntries: AtHomeEntry[] = atHomeRows.map((row) => ({
    id: row.id,
    tastedAt: row.tastedAt,
    extraction: row.extraction,
    note: row.note,
    image: row.image,
    recipe: row.recipe,
    gear: gearLabel(row, gearTerms),
    coffee: {
      id: row.coffeeId,
      name: row.coffeeName,
      roasterName: row.roasterName,
    },
  }));

  const outsideRows = await db
    .select({
      id: entries.id,
      tastedAt: entries.tastedAt,
      extraction: entries.extraction,
      note: entries.note,
      image: entries.image,
      recipe: entries.recipe,
      dripperId: entries.dripperId,
      paperFilterId: entries.paperFilterId,
      coffeeId: coffees.id,
      coffeeName: coffees.name,
      roasterName: roasters.name,
      cafeId: cafes.id,
      cafeName: cafes.name,
    })
    .from(entries)
    .innerJoin(coffees, eq(entries.coffeeId, coffees.id))
    .leftJoin(roasters, eq(coffees.roasterId, roasters.id))
    .innerJoin(cafes, eq(entries.cafeId, cafes.id))
    .where(isNotNull(entries.cafeId))
    .orderBy(desc(entries.tastedAt), desc(entries.createdAt));

  const outsideEntries: OutsideEntry[] = outsideRows.map((row) => ({
    id: row.id,
    tastedAt: row.tastedAt,
    extraction: row.extraction,
    note: row.note,
    image: row.image,
    recipe: row.recipe,
    gear: gearLabel(row, gearTerms),
    coffee: {
      id: row.coffeeId,
      name: row.coffeeName,
      roasterName: row.roasterName,
    },
    cafe: {
      id: row.cafeId,
      name: row.cafeName,
    },
  }));

  return {
    coffees: rows,
    atHomeEntries,
    outsideEntries,
    roasters: roasterOptions.map((roaster) => ({
      id: roaster.id,
      label: roaster.name,
    })),
    originCountries: countryTerms,
  };
}

function FilterCombobox({
  options,
  selectedIds,
  onChange,
  placeholder,
}: {
  options: Option[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}) {
  const anchor = useComboboxAnchor();
  const selectedOptions = options.filter((option) =>
    selectedIds.includes(option.id),
  );

  return (
    <Combobox
      multiple
      items={options}
      itemToStringLabel={(item: Option) => item.label}
      itemToStringValue={(item: Option) => item.id}
      isItemEqualToValue={(left: Option, right: Option) => left.id === right.id}
      value={selectedOptions}
      onValueChange={(next: Option | Option[] | null) => {
        const list = Array.isArray(next) ? next : next ? [next] : [];
        onChange(list.map((item) => item.id));
      }}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {selectedOptions.map((option) => (
            <ComboboxChip key={option.id}>{option.label}</ComboboxChip>
          ))}
        </ComboboxValue>
        <ComboboxChipsInput
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No matches.</ComboboxEmpty>
        <ComboboxList>
          {(item: Option) => (
            <ComboboxItem key={item.id} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export default function Coffees({
  loaderData,
}: {
  loaderData: {
    coffees: CoffeeListItem[];
    atHomeEntries: AtHomeEntry[];
    outsideEntries: OutsideEntry[];
    roasters: Option[];
    originCountries: Option[];
  };
}) {
  const {
    coffees: items,
    atHomeEntries,
    outsideEntries,
    roasters: roasterOptions,
    originCountries: countryOptions,
  } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const showAll = searchParams.get("all") === "true";
  const selectedRoasterIds = searchParams.getAll("roaster");
  const selectedCountryIds = searchParams.getAll("country");
  const hasFilters =
    selectedRoasterIds.length > 0 || selectedCountryIds.length > 0;

  function updateFilterParam(param: string, ids: string[]) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(param);
        for (const id of ids) next.append(param, id);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <main className="p-8">
      <p className="text-sm">
        <Link to="/coffees/new" className="underline">
          Add a coffee
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
      <div className="mt-4 mb-10 flex items-center justify-between border-b-2 border-outline pb-4">
        <h1 className="font-serif text-4xl">Library</h1>
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          onClick={() =>
            setSearchParams(showAll ? {} : { all: "true" }, { replace: true })
          }
        >
          {showAll ? "Show owned only" : "Show all coffees"}
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-64">
          <p className="mb-1 font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Roasters
          </p>
          <FilterCombobox
            options={roasterOptions}
            selectedIds={selectedRoasterIds}
            onChange={(ids) => updateFilterParam("roaster", ids)}
            placeholder="All roasters"
          />
        </div>
        <div className="w-full sm:w-64">
          <p className="mb-1 font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
            Countries
          </p>
          <FilterCombobox
            options={countryOptions}
            selectedIds={selectedCountryIds}
            onChange={(ids) => updateFilterParam("country", ids)}
            placeholder="All countries"
          />
        </div>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("roaster");
                  next.delete("country");
                  return next;
                },
                { replace: true },
              )
            }
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          {hasFilters
            ? "No packs match your filters."
            : "No packs in the library. "}
          {!hasFilters && (
            <Link to="/coffees/new" className="underline">
              Add a coffee
            </Link>
          )}
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          {items.map((coffee) => (
            <li
              key={coffee.id}
              className="border-2 border-outline-variant -mr-px -mb-px"
            >
              <Link to={`/coffees/${coffee.id}`} className="block">
                {coffee.image ? (
                  <img
                    src={coffee.image}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full bg-container p-3 text-sm">
                    {coffee.name ?? "Untitled"}
                  </div>
                )}
                <p className="border-t-2 border-outline-variant px-2 py-1 text-sm">
                  {coffee.name ?? "Untitled"}
                </p>
                {coffee.roasterName ? (
                  <p className="px-2 pb-2 text-xs text-ink-muted">
                    {coffee.roasterName}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-8 font-serif text-2xl">At home</h2>
      {atHomeEntries.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          No home brews yet.{" "}
          <Link to="/entries/new" className="underline">
            Log a cup
          </Link>
        </p>
      ) : (
        <ul className="mt-2 divide-y-2 divide-outline-variant border-y-2 border-outline">
          {atHomeEntries.map((brew) => {
            const tasted = formatDate(brew.tastedAt);
            const recipe = brew.recipe;
            return (
              <li key={brew.id} className="px-3 py-2">
                {brew.image ? (
                  <img
                    src={brew.image}
                    alt=""
                    className="mb-2 aspect-square w-full max-w-48 border-2 border-outline-variant object-cover"
                  />
                ) : null}
                <p className="text-sm">{tasted}</p>
                <p>
                  <Link to={`/coffees/${brew.coffee.id}`} className="underline">
                    {brew.coffee.name ?? "Untitled"}
                  </Link>
                  {brew.coffee.roasterName
                    ? ` · ${brew.coffee.roasterName}`
                    : null}
                </p>
                {brew.extraction ? (
                  <p className="text-sm text-ink-muted">
                    {extractionLabels[brew.extraction]}
                  </p>
                ) : null}
                {brew.gear ? (
                  <p className="text-sm text-ink-muted">{brew.gear}</p>
                ) : null}
                {recipe?.bloomSeconds != null ? (
                  <p className="text-sm text-ink-muted">
                    Bloom {recipe.bloomSeconds}s
                  </p>
                ) : null}
                {recipe?.ratio ? (
                  <p className="text-sm text-ink-muted">{recipe.ratio}</p>
                ) : null}
                {recipe?.temperature != null ? (
                  <p className="text-sm text-ink-muted">
                    {recipe.temperature}°C
                  </p>
                ) : null}
                {recipe?.description ? (
                  <p className="text-sm text-ink-muted">{recipe.description}</p>
                ) : null}
                {brew.note ? <p className="mt-1 text-sm">{brew.note}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
      <h3 className="mt-6 text-sm font-medium">Cups</h3>
      {outsideEntries.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          No cups yet.{" "}
          <Link to="/entries/new" className="underline">
            Log a cup
          </Link>
        </p>
      ) : (
        <ul className="mt-2 divide-y-2 divide-outline-variant border-y-2 border-outline">
          {outsideEntries.map((cup) => {
            const tasted = formatDate(cup.tastedAt);
            const recipe = cup.recipe;
            return (
              <li key={cup.id} className="px-3 py-2">
                {cup.image ? (
                  <img
                    src={cup.image}
                    alt=""
                    className="mb-2 aspect-square w-full max-w-48 border-2 border-outline-variant object-cover"
                  />
                ) : null}
                <p className="text-sm">{tasted}</p>
                <p>
                  <Link to={`/coffees/${cup.coffee.id}`} className="underline">
                    {cup.coffee.name ?? "Untitled"}
                  </Link>
                  {cup.coffee.roasterName
                    ? ` · ${cup.coffee.roasterName}`
                    : null}
                </p>
                <p className="text-sm text-ink-muted">
                  <Link to={`/cafes/${cup.cafe.id}`} className="underline">
                    {cup.cafe.name}
                  </Link>
                </p>
                {cup.extraction ? (
                  <p className="text-sm text-ink-muted">
                    {extractionLabels[cup.extraction]}
                  </p>
                ) : null}
                {cup.gear ? (
                  <p className="text-sm text-ink-muted">{cup.gear}</p>
                ) : null}
                {recipe?.bloomSeconds != null ? (
                  <p className="text-sm text-ink-muted">
                    Bloom {recipe.bloomSeconds}s
                  </p>
                ) : null}
                {recipe?.ratio ? (
                  <p className="text-sm text-ink-muted">{recipe.ratio}</p>
                ) : null}
                {recipe?.temperature != null ? (
                  <p className="text-sm text-ink-muted">
                    {recipe.temperature}°C
                  </p>
                ) : null}
                {recipe?.description ? (
                  <p className="text-sm text-ink-muted">{recipe.description}</p>
                ) : null}
                {cup.note ? <p className="mt-1 text-sm">{cup.note}</p> : null}
              </li>
            );
          })}
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
