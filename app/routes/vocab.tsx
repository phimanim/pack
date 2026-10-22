import { and, asc, eq, max } from "drizzle-orm";
import { data, Form, Link, redirect } from "react-router";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { db } from "~/db";
import { type VocabKind, vocabKinds, vocabularies } from "~/db/schema";
import { slugifyTerm } from "~/lib/slug";
import type { Route } from "./+types/vocab";

type VocabTerm = typeof vocabularies.$inferSelect;
type TermsByKind = Record<VocabKind, VocabTerm[]>;
type ActionData = { error: string; errorKind: string };

const addTermSchema = z.object({
  intent: z.literal("add_term"),
  kind: z.enum(vocabKinds),
  label: z.string().trim().min(1, "Label is required"),
});

const sectionTitles: Record<VocabKind, string> = {
  variety: "Variety",
  process: "Process",
  pack_note: "Pack notes",
  origin_country: "Origin country",
  dripper: "Drippers",
  paper_filter: "Paper filters",
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
      dripper: terms.filter((t) => t.kind === "dripper"),
      paper_filter: terms.filter((t) => t.kind === "paper_filter"),
    },
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const parsed = addTermSchema.safeParse({
    intent: formData.get("intent"),
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
      <h1 className="mt-4 font-serif text-4xl">Vocabularies</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Stored value is the id. Label is display only.
      </p>

      {(vocabKinds as readonly VocabKind[]).map((kind) => {
        const terms = termsByKind[kind];
        return (
          <section
            key={kind}
            className="mt-8 border-2 border-outline bg-container p-5 sm:p-6"
          >
            <h2 className="font-serif text-2xl">{sectionTitles[kind]}</h2>
            <ul className="mt-3 divide-y-2 divide-outline-variant border-y-2 border-outline">
              {terms.map((term) => (
                <li key={`${term.kind}:${term.id}`} className="py-2">
                  {term.label}{" "}
                  <span className="text-xs text-ink-muted">{term.id}</span>
                </li>
              ))}
            </ul>

            <Form method="post" className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="intent" value="add_term" />
              <input type="hidden" name="kind" value={kind} />
              <label className="flex flex-col text-sm">
                <span className="mb-1.5 font-sans text-xs font-medium uppercase tracking-widest text-ink-muted">
                  Add a term
                </span>
                <Input name="label" required />
              </label>
              <Button type="submit">Add</Button>
            </Form>
            {actionData?.errorKind === kind ? (
              <p className="mt-2 text-sm">{actionData.error}</p>
            ) : null}
          </section>
        );
      })}
    </main>
  );
}
