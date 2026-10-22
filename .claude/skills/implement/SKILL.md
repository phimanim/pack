---
name: implement
description: >-
  Ticket-driven implementation for Pack. Finds or creates the ticket in the
  Notion "features" database (Coffee log), records the request details, writes
  an implementation plan and a QA plan in the ticket, implements, QAs, commits
  when QA passes, and sets the ticket to Done. Use when the user says
  "implement", "/implement", "work on the ticket", "pick up <ticket>", or asks
  to build a feature or fix a bug that should be tracked in Notion.
---

# Implement a ticket

Every change goes through a ticket in the Notion **features** database. The ticket is the source of truth: details, plan, QA plan and QA results all live in it.

## Notion database

- Database: https://app.notion.com/p/omarimane/401b273f27cc80fbae74ec6eeb587a8d
- Data source: `collection://401b273f-27cc-80b7-aff7-000b99b27ba9`
- Properties (exact names):
  - `Name` (title)
  - `Notes` (text) — one- or two-sentence summary of the ask
  - `Status` (status) — `Not started` | `In progress` | `Done`
  - `Priority` (select) — `P0` | `P1` | `P2` | `P3`
  - `Tag` (select) — `bug` | `feature` | `nice to have`

Use the Notion MCP tools (`notion-fetch`, `notion-query-data-sources`, `notion-create-pages`, `notion-update-page`; load them with ToolSearch if deferred). Fetch the data source once at the start to confirm the schema hasn't changed; if it has, use the new names.

## Workflow

Track these steps in the task list. Do not skip or reorder them.

### 1. Find the ticket

- If the user mentions a ticket (Notion URL, page id, or a name), fetch it. A name: query the data source with `"Name" LIKE ?` and pick the match; if several match, ask which one.
- If no ticket is mentioned, search for one that already covers the request (query by keywords from the request against `Name` and `Notes`, skip `Done` ones). Reuse a clear match; if it's ambiguous, ask.
- If none exists, create one in the data source:
  - `Name`: short imperative title (like "Coffee select in Log a cup as a searchable combobox")
  - `Notes`: the ask in one or two sentences
  - `Tag`: `bug` or `feature` (or `nice to have` if the user says so)
  - `Priority`: what the user says, else `P2`
  - `Status`: `Not started`

Tell the user which ticket you're on, with its link.

### 2. Record the details

Fetch the ticket's current content and keep whatever is there (the user often writes context in the body). Append, don't rewrite.

If the prompt gave details (requirements, constraints, gear lists, edge cases, screenshots described), add them under a `## Details` heading, in the user's words where possible. If the existing `Notes` is empty or out of date, update it.

### 3. Implementation plan

Read the relevant code first (`CLAUDE.md`, `app/db/schema.ts`, the route modules involved). Then append `## Implementation plan` to the ticket:

- Approach in 2–4 sentences, including any modelling decision (vocab kind vs entity — follow the Domain rules in `CLAUDE.md`).
- Files to touch, one bullet each with what changes.
- Schema/migration/seed steps if any (`pnpm db:generate` → `pnpm db:migrate`, `pnpm db:seed`).
- Open questions. If an open question changes the design, ask the user before going on.

### 4. QA plan (before writing any code)

Append `## QA plan` to the ticket as a to-do list (`- [ ]`). Cover:

- `pnpm check` and `pnpm typecheck` pass.
- QA runs on the Neon branch `qa-<ticket-slug>`, not the main database.
- Migrations apply cleanly on the QA branch (if the schema changed); seed is safe to re-run.
- `dev-qa` server running with auto login, app opens without landing on `/login`.
- **One browser scenario per changed page or UI element.** Each one goes all the way through the user flow, not just "the field renders". For a form change (new select, combobox, input, conditional field), that means: open the form, fill every required field, set the new field, submit, then open the saved record (list/detail page, or the edit form) and check the new value is shown and persisted. Write each scenario as concrete steps with the values to use and the expected result, e.g.:
  - `- [ ] /entries/new: pick coffee "X", extraction filter, Dripper "Hario Switch size 2", Paper "Abaca dark" → Save → redirected to the entry; it shows Hario Switch size 2 + Abaca dark`
  - `- [ ] Edit that entry, change Dripper to "Kalita" → Save → entry shows Kalita`
- Edge cases for the changed fields, each also submitted through save: the new field left empty (if optional), a value that should fail Zod validation (error shown, nothing saved, other inputs kept), conditional fields hidden/shown correctly (e.g. filter vs espresso), home vs café where it applies, adding a new vocab term from the combobox.
- Existing data: records created before the change still open and render, and editing one without touching the new field still saves.
- Regressions: other pages that read the changed data (lists, detail, library filters) still render.

Then set `Status` to `In progress`.

### 5. Implement

Follow `CLAUDE.md` (stack, Luxon dates, `<Form>` + action + Zod, `VocabCombobox`, shadcn components only, no multi-user auth). Keep the change scoped to the ticket. Don't hand-edit `drizzle/`; regenerate.

Schema changes: run `pnpm db:generate` as usual, but apply the migration **only to the QA branch** (see "QA database" in step 6). Never run `pnpm db:migrate` or `pnpm db:seed` against the main database (`.env.local`) during the ticket.

If the plan changes while implementing, update the `## Implementation plan` section so it matches what was built.

### 6. QA

#### QA database (Neon branch)

QA writes real rows, and `.env.local` points at the main database. So every ticket gets its own Neon branch: a copy-on-write clone of main (real coffees and entries to test against), isolated from it, and it deletes itself after 7 days.

Use the Neon CLI through `npx -y neonctl@2`. Load `NEON_PROJECT_ID`, `PGDATABASE` and `PGUSER` by starting each shell command with `set -a && . ./.env.local && set +a &&`. Shell state doesn't persist between commands, so do this every time. Never print passwords or connection strings in chat or in the ticket.

1. **Auth.** Run `npx -y neonctl@2 me`. If you're not authenticated, stop. Ask the user to run `npx neonctl@2 auth` in their terminal (it opens a browser), then continue. Never fall back to QA on the main database.
2. **Branch.** Name it `qa-<ticket-slug>` (lowercase, from the ticket name, max ~40 chars). Check `npx -y neonctl@2 branches list --project-id "$NEON_PROJECT_ID"`. If it exists, reuse it. Otherwise create it from the default branch:
   ```bash
   npx -y neonctl@2 branches create --project-id "$NEON_PROJECT_ID" --name "qa-<ticket-slug>" --expires-at "$(date -u -v+7d +%Y-%m-%dT%H:%M:%SZ)"
   ```
3. **Env file.** Write `.env.qa.local` (git-ignored by `.env*.local`), overwriting it for the current ticket. The connection strings contain `&`, so the values **must be single-quoted** or sourcing the file fails:
   ```bash
   B="qa-<ticket-slug>"
   CS() { npx -y neonctl@2 connection-string "$B" --project-id "$NEON_PROJECT_ID" --database-name "$PGDATABASE" --role-name "$PGUSER" "$@" 2>/dev/null; }
   P=$(CS --pooled) && U=$(CS) && [ -n "$P" ] && [ -n "$U" ] \
     && printf "DATABASE_URL='%s'\nDATABASE_URL_UNPOOLED='%s'\nDEV_AUTO_LOGIN=1\n" "$P" "$U" > .env.qa.local
   ```
   Never echo `$P`/`$U` or `cat` the file.
4. **Migrate and seed the branch, behind a guard.** Shell env wins over the dotenv loading in `drizzle.config.ts` and `scripts/seed-vocab.ts`, so sourcing `.env.qa.local` first points them at the branch. Chain everything with `&&` (never `;`): if sourcing fails, or the host is empty or equal to main's, nothing runs.
   ```bash
   MAIN=$(sed -n 's/^DATABASE_URL="\{0,1\}postgres[a-z]*:\/\/[^@]*@\([^/:]*\).*/\1/p' .env.local) \
     && set -a && . ./.env.qa.local && set +a \
     && QA=$(node -p 'new URL(process.env.DATABASE_URL).host') \
     && [ -n "$MAIN" ] && [ -n "$QA" ] && [ "$QA" != "$MAIN" ] \
     && echo "on QA branch: $QA" \
     && pnpm db:migrate && pnpm db:seed
   ```
   Use the same guard prefix for any other DB command during the ticket (e.g. a one-off SQL check with `@neondatabase/serverless`). If the guard fails, stop and tell the user.

Photos still upload to the real Vercel Blob store. Only upload a photo in QA if the ticket touches photos.

#### Run the QA plan

Run every item of the QA plan:

1. `pnpm check` (use `pnpm check:write` for formatting fixes) and `pnpm typecheck`.
2. Start the app with `preview_start` `{ name: "dev-qa" }` (http://localhost:5180). This config loads `.env.qa.local` on top of `.env.local`, so the app uses the QA branch and auto login. The middleware in `app/root.tsx` skips the session check when `import.meta.env.DEV && process.env.DEV_AUTO_LOGIN === "1"`, and that check is stripped from production builds. Don't use the password form, and don't use the plain `dev` config for QA (it talks to main). If the page still redirects to `/login`, stop and tell the user instead of working around it. If port 5180 is taken, check what holds it (`lsof -nP -iTCP:5180 -sTCP:LISTEN`). Stop it only if it's a `dev-qa` server from this session; otherwise ask the user, and never kill their own dev servers. After a schema change, restart `dev-qa` (`preview_stop`, then `preview_start`) so it picks up the new code against the migrated branch.
3. Run each browser scenario exactly as written with the browser tools: really fill the form, really click Save, then navigate to the saved record and read the value back from the page (`read_page` / `get_page_text`). A scenario that stops before save, or doesn't check the saved result, doesn't count as passed. Check console and server logs (`preview_logs`) for errors after each submit, and take a screenshot of the saved result for the main scenario.
4. QA records stay on the QA branch. Don't clean them up; the branch expires on its own. Still name them so they're recognisable (e.g. a note "QA <ticket name>"). Record the branch name in `## QA results`.

Tick each item in the ticket (`- [x]`) and append `## QA results` with the date (`yyyy-MM-dd`), what passed, and anything that failed with the error output.

If something fails: fix it and re-run QA. If you can't make it pass, stop — leave `Status` as `In progress`, record the failure in `## QA results`, and tell the user. Do not commit.

### 7. Commit (only if QA passed)

- If on `main`, create a branch first (`git switch -c <short-ticket-slug>`).
- Stage only the files changed for this ticket (`git add <paths>`), not unrelated work in the tree. Check `git status` and `git diff --staged` before committing.
- Commit message: short imperative summary like the existing history ("Add dripper and paper filter to filter cups"), then a blank line and the ticket URL.
- Do not push unless the user asks.

### 8. Close the ticket

Set `Status` to `Done`. Append the commit hash and branch to `## QA results`.

Report to the user: ticket link, what changed, QA outcome, commit hash, and the QA branch name. If the ticket added a migration, say clearly that the main database hasn't been migrated yet: `pnpm db:migrate` (and `pnpm db:seed` if seeds changed) still has to run against `.env.local` when they ship. Run it only if they ask.
