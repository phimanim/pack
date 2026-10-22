# Pack
Personal coffee catalog. One user per install. The public URL is not world-writable: a single password sets an httpOnly signed cookie (`userId: "owner"`). Do not add multi-user auth, sign-up, or public write access.
## Stack
React Router 8 (framework mode, SSR) + Tailwind 4 + shadcn (base-nova, `~/components/ui`) + Neon Postgres + Drizzle + Vercel Blob + Zod + Luxon + Biome.
- Routes: `app/routes.ts` + route modules under `app/routes/`.
- Schema: `app/db/schema.ts`. DB client: `app/db/index.ts`.
- Imports: `~/` → `app/`.
- UI: shadcn `Button`, `Input`, `Select`, `Combobox`. Icons: lucide. Do not add a second component library.
- Dates: Luxon `DateTime` only. No `Date`, moment, or dayjs. Parse ISO with `{ zone: "utc" }` when the value is a `date` column; display with `DateTime.DATE_MED`. Persist calendar dates as `yyyy-MM-dd` (`toISODate()`).
- Forms: React Router `<Form>` + `loader`/`action`. Validate in the action with Zod. Vocab fields use `VocabCombobox`.
- Lint/format: `pnpm check` (Biome). Double quotes, semicolons, 2-space indent.
## Domain
Four kinds of thing. Do not collapse them.
**Vocabularies** are terms with a stable `id` + `kind` (`variety`, `process`, `pack_note`, `origin_country`). Adding a term is data, not a code change. New labels get an id via `slugifyTerm` in `app/lib/slug.ts`. Seeded defaults live in `scripts/seed-vocab.ts` (`onConflictDoNothing`). Origin country ids are ISO-style (`et`, `co`), not full names.
**Roasters** are entities: name plus optional country, city, url, notes. Country/city here is where the company is — not coffee origin ids like `et`.
**Cafés** are entities: name plus optional city and notes. Home is not a café. A cup at home is an entry with `cafeId` null.
**Coffees** are bags: optional name, optional roaster, and vocab ids (origin, process, varieties, pack notes), plus farm/producer/region/altitude/harvest/roast date/photo/notes/`owned`. A café coffee you never bought is still a coffee row (`owned` false, often no photo). It stays out of the default library until it has a photo or is owned (`coffees.tsx` filters `image IS NOT NULL OR owned = true` unless “show all”).
**Entries** are cups: a coffee, optional café (set means outside), `tastedAt`, optional extraction (`filter` | `espresso` | `ibrik` | `turbo_shot`), optional recipe JSON (`bloomSeconds`, `ratio`, `temperature`, `description`), optional note and photo.
Photos go to Vercel Blob (`BLOB_READ_WRITE_TOKEN`), not `public/`.

## Commands
```sh
pnpm install
vercel env pull .env.local --yes   # first time / when env changes
pnpm dev                           # http://localhost:5173 — should land on login
pnpm db:generate                   # after schema.ts changes
pnpm db:migrate
pnpm db:seed                       # vocab only; safe to re-run
pnpm check
pnpm typecheck
Env (.env.local, never commit): DATABASE_URL, SESSION_SECRET, AUTH_PASSWORD, BLOB_READ_WRITE_TOKEN.

Schema change = edit app/db/schema.ts → pnpm db:generate → pnpm db:migrate. Do not hand-edit files under drizzle/ except by regenerating.

## Conventions
Prefer an existing route module over a new abstraction. Colocate Zod schemas with the form/action in that route file.
Extend vocab kinds only if a closed list of terms is the right model. People, shops, and bags are entities.
Do not treat home as a café row. Do not store origin country as a roaster field, or roaster location as origin vocab.
Keep the app one-user. Auth is password + cookie in app/sessions.server.ts; middleware in app/root.tsx redirects everyone except /login.
