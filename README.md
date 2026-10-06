# Pack

Personal coffee catalog. One user per install. The public URL is not world-writable: a single password sets an httpOnly signed cookie.

## Stack

React Router 8 (SSR) + Tailwind 4 + Neon/Drizzle + Vercel.

## Run locally

pnpm install
vercel env pull .env.local --yes
pnpm dev

Open http://localhost:5173. You should land on login.

## Env vars

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres (from the Vercel Neon integration) |
| `SESSION_SECRET` | Signs the session cookie |
| `AUTH_PASSWORD` | The one password that unlocks the app |
| `BLOB_READ_WRITE_TOKEN` | Later, for pack photos (Vercel Blob) |

Do not commit `.env.local`.

## Database

Vocabularies (variety, process, pack notes, origin country) are rows with a stable `id`. Adding a term is data, not a code change.

Roasters are entities, not vocab: name plus optional country, city, url, and notes (where the company is — not coffee origin ids like `et`).

pnpm db:generate
pnpm db:migrate
pnpm db:seed