# fitness-tracker

Personal fitness tracker: alternating A/B workouts with auto-advancing progressions,
a gut log (weight/waist + charts), and a food log. Stack rationale and full setup
guide: see `rr7-cloudflare-drizzle-starter.md`. Original spreadsheet CSVs in this
folder are the source the seed data was derived from.

## Working preferences

- Do not save Claude memories; persist anything worth keeping in repo files instead.
- Scaffold with official CLIs (`npm create cloudflare@latest`, `wrangler d1 create`, etc.) — never hand-write boilerplate. Rationale in the starter guide.

## App (repo root)

React Router 8 (framework mode) + Cloudflare Workers + D1 + Drizzle + Tailwind v4.
Scaffolded with `npm create cloudflare@latest`, Drizzle pinned per the starter guide.

### Domain model (`app/db/schema.ts`)

- `exercises` — each has an ordered freeform progression (`progression_steps`, one
  line of text per step: weight for barbell, variation + reps for bodyweight/KB) and
  a `current_step_id` pointer = the load to use next time.
- `plans` / `plan_exercises` — workout plans (A/B); workouts alternate through plans
  in `position` order, based on the last logged workout's plan.
- `workouts` / `workout_entries` — a logged session; entries snapshot the step
  description and record result + per-exercise notes. Result **"Felt good!" advances
  that exercise's pointer** to the next step (other results / skipped don't).
  Deleting a workout does NOT rewind pointers (fix manually on the Exercises page).
- `gut_logs` (date, weight kg, waist cm, notes), `food_logs` (date, food).

### Routes (`app/routes/`)

`/` today's workout logging · `/workouts` history · `/exercises` progression
editor (click a step to move the pointer; textarea bulk-edits steps) ·
`/plans` plan editor · `/gut` gut log + SVG line charts · `/food` food log.

### Workflows

- Dev: `npm run dev` (local D1 state in `.wrangler/state/`)
- Schema change: `npm run db:generate` → `npm run db:migrate:local` / `:remote`
- Re-seed a fresh local DB: `npm run db:migrate:local && npm run db:seed:local`
  (seed generated from the CSVs by `scripts/seed.mjs`; one-time — not idempotent)
- Typecheck: `npm run typecheck`
- Deploy: `npm run deploy` — **before first deploy** run
  `npx wrangler d1 create fitness-tracker-db`, paste the real `database_id` into
  `wrangler.jsonc` (a placeholder UUID is there now), then apply migrations + seed
  with the `:remote` scripts.

### Conventions

- Dates are `TEXT` `YYYY-MM-DD`. Date inputs auto-fill with browser-local today
  via `DateField` (`app/lib/ui.tsx`).
- Bindings come from `import { env } from "cloudflare:workers"` (see starter guide
  gotchas — not `context.cloudflare.env`).
- Forms are plain `<Form method="post">` + route actions with an `intent` field;
  no client state libs, no Zod (personal app, keep it lean).
