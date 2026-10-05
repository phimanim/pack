import { and, asc, eq, max } from "drizzle-orm";
import { data, Form, Link, redirect } from "react-router";
import { z } from "zod";
import { db } from "~/db";
import { type VocabKind, vocabKinds, vocabularies } from "~/db/schema";
import { slugifyTerm } from "~/lib/slug";
import type { Route } from "./+types/vocab";

type VocabTerm = typeof vocabularies.$inferSelect;
type TermsByKind = Record<VocabKind, VocabTerm[]>;
type ActionData =
  | {
      pick: {
        varietyIds: string[];
        processId: string | null;
        packNoteIds: string[];
        country: string | null;
      };
    }
  | { error: string; errorKind: string };

const addTermSchema = z.object({
  intent: z.literal("add_term"),
  kind: z.enum(vocabKinds),
  label: z.string().trim().min(1, "Label is required"),
});

const sectionCopy: Record<VocabKind, { title: string; pick: string }> = {
  variety: { title: "Variety", pick: "Multi-select (stored: variety ids)" },
  process: { title: "Process", pick: "One (stored: process id)" },
  pack_note: { title: "Pack notes", pick: "Multi-select (stored: note ids)" },
  origin_country: {
    title: "Origin country",
    pick: "Select (stored: ISO id)",
  },
};

export async function loader(): Promise<{ termsByKind: TermsByKind }> {
  const terms = await db
    .select()
    .from(vocabularies)
    .orderBy(
      asc(vocabularies.kind),
      asc(vocabularies.sort),
      asc(vocabularies.label),
    );

  return {
    termsByKind: {
      variety: terms.filter((t) => t.kind === "variety"),
      process: terms.filter((t) => t.kind === "process"),
      pack_note: terms.filter((t) => t.kind === "pack_note"),
      origin_country: terms.filter((t) => t.kind === "origin_country"),
    },
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "pick_demo") {
    const pick: ActionData = {
      pick: {
        varietyIds: formData.getAll("varietyIds").map(String),
        processId: String(formData.get("processId") ?? "") || null,
        packNoteIds: formData.getAll("packNoteIds").map(String),
        country: String(formData.get("country") ?? "") || null,
      },
    };
    return data(pick);
  }

  const parsed = addTermSchema.safeParse({
    intent,
    kind: formData.get("kind"),
    label: formData.get("label"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid term";
    return data(
      {
        error: message,
        errorKind: String(formData.get("kind") ?? ""),
      } satisfies ActionData,
      { status: 400 },
    );
  }

  const { kind, label } = parsed.data;
  const id = slugifyTerm(label);
  if (!id) {
    return data(
      {
        error: "Could not make an id from that label",
        errorKind: kind,
      } satisfies ActionData,
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: vocabularies.id })
    .from(vocabularies)
    .where(and(eq(vocabularies.id, id), eq(vocabularies.kind, kind)))
    .limit(1);

  if (existing) {
    return data(
      {
        error: `A ${kind} with id “${id}” already exists.`,
        errorKind: kind,
      } satisfies ActionData,
      { status: 400 },
    );
  }

  const [agg] = await db
    .select({ m: max(vocabularies.sort) })
    .from(vocabularies)
    .where(eq(vocabularies.kind, kind));

  await db.insert(vocabularies).values({
    id,
    kind,
    label,
    sort: (agg?.m ?? 0) + 1,
  });

  throw redirect("/vocab");
}

export default function Vocab({
  loaderData,
  actionData,
}: {
  loaderData: { termsByKind: TermsByKind };
  actionData?: ActionData;
}) {
  const { termsByKind } = loaderData;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <p className="text-sm">
        <Link to="/" className="underline">
          Home
        </Link>
      </p>
      <h1 className="mt-4 text-xl">Vocabularies</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Stored value is the id. Label is display only.
      </p>

      <form id="pick-demo" method="post">
        <input type="hidden" name="intent" value="pick_demo" />
      </form>

      {(vocabKinds as readonly VocabKind[]).map((kind) => {
        const terms = termsByKind[kind];
        return (
          <section key={kind} className="mt-8 border border-neutral-300 p-4">
            <h2 className="text-lg">{sectionCopy[kind].title}</h2>
            <ul className="mt-3 space-y-1">
              {terms.map((term) => (
                <li key={`${term.kind}:${term.id}`}>
                  {term.label}{" "}
                  <span className="text-xs text-neutral-500">{term.id}</span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-sm text-neutral-500">
              {sectionCopy[kind].pick}
            </p>
            {kind === "variety" ? (
              <div className="mt-2 flex flex-col gap-1">
                {terms.map((term) => (
                  <label key={term.id} className="flex items-center gap-2">
                    <input
                      form="pick-demo"
                      type="checkbox"
                      name="varietyIds"
                      value={term.id}
                    />
                    {term.label}
                  </label>
                ))}
              </div>
            ) : null}
            {kind === "process" ? (
              <div className="mt-2 flex flex-col gap-1">
                {terms.map((term) => (
                  <label key={term.id} className="flex items-center gap-2">
                    <input
                      form="pick-demo"
                      type="radio"
                      name="processId"
                      value={term.id}
                    />
                    {term.label}
                  </label>
                ))}
              </div>
            ) : null}
            {kind === "pack_note" ? (
              <div className="mt-2 flex flex-col gap-1">
                {terms.map((term) => (
                  <label key={term.id} className="flex items-center gap-2">
                    <input
                      form="pick-demo"
                      type="checkbox"
                      name="packNoteIds"
                      value={term.id}
                    />
                    {term.label}
                  </label>
                ))}
              </div>
            ) : null}
            {kind === "origin_country" ? (
              <select
                form="pick-demo"
                name="country"
                className="mt-2 border border-neutral-300 bg-transparent px-2 py-1"
                defaultValue=""
              >
                <option value="">—</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.label}
                  </option>
                ))}
              </select>
            ) : null}

            <Form method="post" className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="intent" value="add_term" />
              <input type="hidden" name="kind" value={kind} />
              <label className="flex flex-col text-sm">
                Add a term
                <input
                  name="label"
                  required
                  className="border border-neutral-300 px-2 py-1"
                />
              </label>
              <button
                type="submit"
                className="border border-neutral-300 px-3 py-1"
              >
                Add
              </button>
            </Form>
            {actionData &&
            "error" in actionData &&
            actionData.errorKind === kind ? (
              <p className="mt-2 text-sm">{actionData.error}</p>
            ) : null}
          </section>
        );
      })}

      <div className="mt-8">
        <button
          form="pick-demo"
          type="submit"
          className="border border-neutral-300 px-3 py-1"
        >
          Show stored ids
        </button>
        {actionData && "pick" in actionData ? (
          <pre className="mt-4 overflow-x-auto border border-neutral-300 p-3 text-sm">
            {JSON.stringify(actionData.pick, null, 2)}
          </pre>
        ) : null}
      </div>
    </main>
  );
}
