# fitness-tracker

Personal fitness tracker: alternating A/B workouts with auto-advancing progressions,
a gut log (weight/waist + charts), and a food log. Stack rationale and full setup
guide: see `rr7-cloudflare-drizzle-starter.md`. The remote D1 is the source of
truth for all data (D1 Time Travel gives point-in-time recovery); no data files
live in the repo.

## Working preferences

- Do not save Claude memories; persist anything worth keeping in repo files instead.
- Scaffold with official CLIs (`npm create cloudflare@latest`, `wrangler d1 create`, etc.) — never hand-write boilerplate. Rationale in the starter guide.

## App (repo root)

React Router 8 (framework mode) + Cloudflare Workers + D1 + Drizzle + Tailwind v4
+ shadcn/ui (Base UI base, Nova preset) + Zod 4 / drizzle-zod.
Scaffolded with `npm create cloudflare@latest`, Drizzle pinned per the starter guide;
shadcn set up with `npx shadcn@latest init` (config in `components.json`).

### Domain model (`app/db/schema.ts`)

- `exercises` — each has an ordered freeform progression (`progression_steps`, one
  line of text per step: weight for barbell, variation + reps for bodyweight/KB).
  No stored pointer: the step to prescribe is derived from the exercise's latest
  logged entry — "Felt good!" → the step after the one performed, anything else →
  repeat it, no history / unmatched text → the first step. The workout page
  preselects it in an editable dropdown.
- `plans` / `plan_exercises` — workout plans (A/B); workouts alternate through the
  active (non-archived) plans in `position` order, based on the last logged
  workout's plan. `archived` plans leave the rotation but keep their history;
  a plan is deletable only while no workouts reference it (otherwise the UI
  offers archive instead).
- `workouts` / `workout_entries` — a logged session; entries snapshot the chosen
  step description (freeform text) and record result + per-exercise notes. Since
  prescription is derived from the latest entry, deleting a workout automatically
  "rewinds" the progression.
- `gut_logs` (date, weight kg, waist cm, notes), `food_logs` (date, food, calories).
- `settings` — key/value app settings; currently `daily_calorie_target` (default
  2000, editable on the food page).

### Routes (`app/routes/`)

`/` (index) food log grouped by date + weekday calories bar chart + daily
target summary · `/workouts` today's workout logging (date field left,
Exercises/Plans links right) with the workout history list below
(`delete-workout` / `update-workout` intents; no intent = log workout; history cards edit inline like food/gut, entries addressed by entry id) · `/exercises` progression
editor (textarea bulk-edits steps, one per line), linked from `/workouts`,
not in the top nav · `/plans` plan editor (rename/archive/delete), likewise
linked from `/workouts` · `/gut` gut log + line charts. Top tabs: Food,
Workouts, Gut.

The history/exercises/plans UI lives in `app/sections/` — per section a
`*.server.ts` (load helper + action handler taking `(form, intent)`) and a
`*.tsx` with the section component; route modules compose them. **Server
code (anything importing `~/db`) must stay in `.server.ts` files**: only route
modules get loader/action stripped from the client bundle — a plain shared
module mixing db access with components drags `cloudflare:workers` into the
browser build and crashes client-side navigation.

### Workflows

- Dev: `npm run dev` (local D1 state in `.wrangler/state/`)
- Schema change: `npm run db:generate` → `npm run db:migrate:local` / `:remote`
- Re-seed a fresh local DB: `npm run db:migrate:local`, then import a data dump:
  `wrangler d1 execute fitness-tracker-db --local --file=<backup>.sql` (with the
  dev server stopped). Fresh dumps: `wrangler d1 export fitness-tracker-db
  --remote --output=backup-YYYY-MM-DD.sql`. The original CSV→seed pipeline
  (`scripts/seed.mjs`, `db:seed:*`) was removed 2026-09-01 along with the
  source CSVs; dumps are personal data, kept out of git (root `*.csv`/`*.sql`
  are gitignored and must never be committed).
- Typecheck: `npm run typecheck`
- Deploy: `npm run deploy` (the user runs it on their Mac — the sandbox has no
  Cloudflare auth). The remote D1 is created, migrated, and data-imported;
  `wrangler.jsonc` has the real `database_id`.

### Gotchas learned the hard way

- **Only one process may touch the local D1 SQLite at a time.** Two miniflare
  processes writing the same file caused transient `SQLITE_CORRUPT` errors and
  lost writes. This means: (a) never run `wrangler d1 execute --local` while a
  dev server is running — stop it first (kill the port-5173 listener), run the
  SQL, restart; (b) the user runs `npm run dev` on their Mac against this same
  shared folder, so the sandbox must not start its own dev server without
  checking that theirs isn't running (and vice versa).
- **D1 allows max 100 bound parameters per statement** (remote). Multi-row
  `.values([...])` inserts must be chunked (~30 rows of 3 columns); pair the
  delete+insert in `db.batch()` so a failed insert can't leave data half-wiped
  (see `replaceSteps` in `app/routes/exercises.tsx`).
- **The local D1 sqlite file is keyed by a hash of `database_id`.** Changing the
  id in `wrangler.jsonc` (e.g. placeholder → real id at first deploy) orphans the
  existing local data file under `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`
  and dev starts with an empty DB. Fix: stop all dev servers, then copy the old
  hash-named `.sqlite` file over the new hash's file (happened 2026-08-17).
- **Don't open the local D1 sqlite with `sqlite3` while a dev server runs** —
  even read-only access creates `-wal`/`-shm` files that make workerd throw
  `SQLITE_CORRUPT`. Stop the server first, or use `sqlite3 "file:...?immutable=1"`.
- **Smoke-testing actions with curl against the local dev DB**: POSTs to the
  index route need `/?index` (React Router routes a bare `POST /` to the root
  route, which has no action → 405). Identify a throwaway test row by its own
  unique content (e.g. `notes=smoke-test`), never by "highest id on the page":
  lists are paginated by date, so the max id visible can be a real row
  (2026-09-01: a real gut row was updated+deleted this way and had to be
  restored from `backup-2026-08-31.sql`). Verify final state with
  `wrangler d1 execute --local --json --command "select count(*) ..."` after
  stopping the server; `sqlite3 ...?immutable=1` won't see wrangler's WAL.
- **Transient dev-only SSR crash after installing new deps**: the first requests
  after Vite re-optimizes dependencies can throw `Cannot read properties of null
  (reading 'useRef')` (two React copies). Restart the dev server; not a code bug.

### Conventions

- Dates are `TEXT` `YYYY-MM-DD` — **calendar days, never instants**. A stored
  date is never converted through any time zone, so changing zone only moves
  the "today" boundary going forward and history stays put (this is what makes
  travel safe; keep it that way). **All "today"/relative-date logic uses the
  server date in the user's zone**: `appToday(request)` in `app/lib/ui.tsx`
  reads the IANA zone from the `tz` cookie (falls back to `DEFAULT_TIME_ZONE`,
  `America/Costa_Rica`); the layout route's loader reports the zone it used and
  a layout effect writes the browser's zone into the cookie + revalidates when
  they differ, so the app follows the device zone when travelling. Use
  `addDays`/`daysBetween`/`mondayOf` for calendar arithmetic on date strings.
  Loaders return `today` and pass it to `DateField` (`defaultValue`, plus
  `key={today}` on new-entry forms so the field remounts when the day rolls
  over) and to totals / week boundaries / chart cutoffs — the client never
  computes dates from its own clock, only its zone. Never use
  `new Date()`/`toISOString()`/`Date.now()` in routes or components; the
  earlier UTC-server vs local-browser split made the food page's today total
  read 0 near midnight (fixed 2026-09-01). The layout also revalidates all
  loaders on `visibilitychange`/`focus`, because a tab left open overnight
  kept yesterday's date in the form and logged a meal to the wrong day
  (2026-09-03). Travel days can span an odd number of hours; fix an entry
  with the date picker if it matters.
- **Log forms (food, gut)**: `<Form ref>` + an effect that clears the entry
  fields (not the date) and exits edit mode whenever the action returns
  `{ ok: true }` — deletes and updates clear the form too, by design. Log rows
  edit inline: an `edit` button swaps the row/card for a prefilled form posting
  `intent=update` + `id` (validated by the `*Update` schemas in
  `app/lib/validation.ts`); `editingId` state lives in the route component and
  action errors render under whichever form is active. Workouts redirect after
  logging instead, so they reset by navigation; their inline edit
  (`update-workout`) returns `{ ok: true }` like the others. The intake form
  and the edit form share `ExerciseFields` in `app/sections/history.tsx`.
  All three pages: one card around the intake form, then an `History` h2,
  then the log cards.
- Bindings come from `import { env } from "cloudflare:workers"` (see starter guide
  gotchas — not `context.cloudflare.env`).
- Forms are plain `<Form method="post">` + route actions with an `intent` field;
  no client state libs / form library (personal app, keep it lean).
- **Log lists are paginated cards with infinite scroll** (food, workout history,
  gut): loaders read `?count=` via `pageCount(request)` and return a slice +
  `hasMore`; `<LoadMoreSentinel>` (both in `app/components/LoadMore.tsx`) bumps
  `?count=` by 20 when scrolled near. URL-driven so revalidation after
  add/delete keeps the visible list consistent. Aggregates (weekly calories,
  today's total, gut chart series) are computed in loaders over their own
  bounded queries, never from the paginated slice (the food loader also
  extends each page to a whole-day boundary so day totals stay complete).
- **UI is shadcn/ui** (Base UI base, Nova preset, style `base-nova`, neutral).
  Generated components live in `app/components/ui/`; add more with
  `npx shadcn@latest add <component>` — never hand-write them. Use shadcn
  components with their defaults; if a behavior doesn't fit a component used the
  documented way, simplify the behavior rather than bending the component.
  Path alias is `~` (configured in `components.json`; the root `tsconfig.json`
  mirrors the `~/*` paths entry because the shadcn CLI reads it there).
- **Dark mode is media-query only** (`prefers-color-scheme`), Tailwind v4's
  default `dark:` behavior — no `.dark` class toggler. Theme tokens live in
  `app/app.css` (`:root` + a `prefers-color-scheme: dark` block). The font is the
  preset's Geist (self-hosted via `@fontsource-variable/geist`).
- **Charts are shadcn chart components** (Recharts 3 under the hood):
  `ChartContainer`/`ChartTooltip` wrappers in `app/components/{LineChart,
  WeekBarChart,StepChart}.tsx`, colored via the `--chart-N` theme tokens (the
  neutral preset makes them monochrome — edit the tokens in `app/app.css` to
  re-color all charts).
- **Action validation is Zod 4 + drizzle-zod** (`app/lib/validation.ts`):
  `createInsertSchema` off the Drizzle tables for gut/food logs, plain `z.object`
  where no table maps 1:1. Pattern: `safeParse(Object.fromEntries(form))`, on
  failure `return data({ errors: fieldErrors(err) }, { status: 400 })`. Gotchas:
  Zod 4 is `z.flattenError(err)` (not `err.flatten()`); `Object.fromEntries`
  drops multi-value fields; don't use `z.coerce.number()` for optional numeric
  FormData fields ("" would coerce to 0 — see `optionalNumber` helper).
