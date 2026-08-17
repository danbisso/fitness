# Hobby App Starter — React Router 8 + Cloudflare + Drizzle

A reusable setup guide for spinning up a new full-stack TypeScript app. Type-safe end
to end, free/near-free to host, local dev, one command to deploy, all config in-repo.

> **Updated Aug 2026.** React Router v8 shipped 2026-06-17 and is what the official
> scaffold now generates. The loader/action/Form API is unchanged from v7, but the
> Cloudflare bindings pattern changed (see Gotchas) — most pre-June-2026 tutorials,
> and even Cloudflare's own docs page, show v7 code that no longer compiles.

## The stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React Router 8 (framework mode) | Successor to Remix; per-route generated types; SSR + config-based routing |
| Runtime / host | Cloudflare Workers (static assets) | The recommended target — Pages is frozen; free static assets; one-command deploy |
| Build / dev | Vite 8 + `@cloudflare/vite-plugin` | HMR locally with SSR running in real workerd + emulated bindings |
| Database | Cloudflare D1 (SQLite) | Native binding in the same Worker; generous free tier |
| ORM | Drizzle + drizzle-kit (**pinned 0.45.2 / 0.31.10**) | Schema in TypeScript; typed queries; zero runtime deps; native D1 fit |
| Styling | Tailwind v4 | Already in the scaffold, zero config; shadcn/ui is stable on it if wanted |
| Validation | Zod 4 in actions (optional) | Typed FormData in ~5 lines; scaffold ships none by design |
| Deploy / config | Wrangler (`wrangler.jsonc`) | Code-based, no dashboard; typegen wired via `postinstall` |

Requires Node ≥ 22.22 (v8 hard floor).

## Setup steps

### 1. Scaffold the app (one command)
```bash
npm create cloudflare@latest -- my-app --framework=react-router
cd my-app
```
> **Always scaffold with the official CLI — never hand-write the boilerplate.**
> The scaffold coordinates ~6 interlocking pieces (worker entry, Vite plugin order,
> wrangler.jsonc, generated types, tsconfig split, scripts) that are easy to get
> subtly wrong by hand, and it always reflects the current supported patterns —
> which have shifted more than once. Same logic applies later: add pieces via their
> official tools (`wrangler d1 create`, `npx shadcn@latest init`, etc.) rather than
> pasting equivalent files from tutorials.
>
> Do **not** add `--lang=ts` — it breaks the react-router framework option in C3
> (TypeScript is the default anyway).
>
> Avoid the "Deploy to Cloudflare" button / `cloudflare/templates/react-router-starter-template`
> — it's ~9 months stale (RR 7.9.6, obsolete future flags).

### 2. Add Drizzle (pin the versions)
```bash
npm i drizzle-orm@0.45.2
npm i -D drizzle-kit@0.31.10
```
> Drizzle's docs currently push `@rc` (1.0.0-rc). Don't — the RC line has an open bug
> (`drizzle-kit migrate` vs the `d1-http` driver, drizzle-orm#5952) and a nested
> migrations layout wrangler needs extra config for. `latest` (0.45.x) is the stable,
> battle-tested pairing with D1.

### 3. Create a D1 database (one-time; prints a `database_id`)
```bash
npx wrangler d1 create my-app-db
```
Paste the output block into `wrangler.jsonc`, adding `migrations_dir` so wrangler
reads Drizzle's output folder:
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "my-app-db",
    "database_id": "<paste-from-output>",
    "migrations_dir": "./drizzle"
  }
]
```

### 4. Regenerate binding types (so `env.DB` is typed)
```bash
npx wrangler types
```
(Also runs automatically on `npm install` via the scaffold's `postinstall`.)

### 5. Define your schema in TypeScript — `app/db/schema.ts`
```ts
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
});
```

### 6. Add a shared db instance — `app/db/index.ts`
```ts
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const db = drizzle(env.DB, { schema });
```
> This module-level singleton is the current official pattern: bindings come from the
> `cloudflare:workers` import, fully typed off the generated `Env`. It works in any
> module — loaders, actions, middleware.

### 7. Add `drizzle.config.ts` at the project root
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./app/db/schema.ts",
  out: "./drizzle",
});
```
> `driver: "d1-http"` is only needed if you want `drizzle-kit studio`/`introspect`
> against the remote DB (requires a D1-edit API token). `generate` needs no driver or
> credentials. Never use `drizzle-kit migrate` with D1 — apply via wrangler (below).

### 8. Generate + apply the migration
```bash
npx drizzle-kit generate                              # creates SQL in ./drizzle
npx wrangler d1 migrations apply my-app-db --local    # local dev DB
npx wrangler d1 migrations apply my-app-db --remote   # production DB
```
Worth adding as scripts:
```json
"db:generate": "drizzle-kit generate",
"db:migrate:local": "wrangler d1 migrations apply my-app-db --local",
"db:migrate:remote": "wrangler d1 migrations apply my-app-db --remote"
```

### 9. Query it from a loader — `app/routes/home.tsx`
```ts
import { db } from "~/db";
import { tasks } from "~/db/schema";
import type { Route } from "./+types/home";

export async function loader() {
  const rows = await db.select().from(tasks);   // fully typed, no SQL strings
  return { tasks: rows };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <ul>{loaderData.tasks.map(t => <li key={t.id}>{t.title}</li>)}</ul>;
}
```
Routes are declared in `app/routes.ts` (config-based, not file-convention — though
`@react-router/fs-routes` exists if you prefer that).

### 10. Run locally
```bash
npm run dev
```
Vite dev server with SSR running inside real workerd; D1/KV/R2 emulated locally
(state in `.wrangler/state/`). Same `env` shape as production.

### 11. Deploy (one command)
```bash
npm run deploy   # = react-router build && wrangler deploy
```

## CRUD form actions — the minimal pattern

No form library needed. Native `<Form>`/`useFetcher` + an action, optionally Zod 4
for typed FormData:

```ts
import { data } from "react-router";
import { z } from "zod";

const TaskSchema = z.object({ title: z.string().min(1) });

export async function action({ request }: Route.ActionArgs) {
  const parsed = TaskSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) {
    // non-2xx status skips the automatic revalidation a successful action triggers
    return data({ errors: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  }
  await db.insert(tasks).values(parsed.data);
  return { ok: true };
}
```
> Zod 4 renamed the error helpers: it's `z.flattenError(err)`, not `error.flatten()`.
> `Object.fromEntries` drops multi-value fields (checkbox groups) — handle those with
> `formData.getAll()`. Add Conform or RVF only if forms get genuinely complex.

## Two ways to query in Drizzle (both fully typed, no SQL strings)

SQL-shaped query builder:
```ts
import { gt } from "drizzle-orm";
await db.select().from(tasks).where(gt(tasks.id, 10));
```

High-level relational API (joins via relations, Prisma-like ergonomics):
```ts
await db.query.tasks.findMany({
  where: (t, { eq }) => eq(t.done, false),
  with: { /* related tables */ },
});
```

## Recurring workflow

| When you... | Run |
|---|---|
| Change the schema | `npm run db:generate` then `db:migrate:local` / `db:migrate:remote` |
| Change bindings in `wrangler.jsonc` | `npx wrangler types` |
| Develop locally | `npm run dev` |
| Ship | `npm run deploy` |

## Gotchas

- **Bindings come from `import { env } from "cloudflare:workers"`** — NOT from
  `context.cloudflare.env`. RR v8 removed `AppLoadContext`; the old pattern fails to
  compile and Cloudflare's React Router docs page still (stale as of Aug 2026) shows
  it. Trust the scaffold, not the docs prose or pre-June-2026 blog posts. For
  request-scoped values there's a new middleware pattern
  (`createContext` + `RouterContextProvider`), but a small CRUD app doesn't need it.
- **`nodejs_compat` is not in the scaffold's `wrangler.jsonc`.** Add
  `"compatibility_flags": ["nodejs_compat"]` the moment you pull in anything touching
  Node built-ins (auth libraries especially). CJS-only packages can also break under
  workerd's strict ESM — prefer ESM-native deps.
- **Never hand-write the `assets` block** in `wrangler.jsonc` — the Vite plugin
  injects it into a generated deploy config at build time.
- **SSR only**: SPA mode and prerendering are not supported with
  `@cloudflare/vite-plugin`. Fine for CRUD; just know the constraint.
- **No interactive transactions on D1** — `db.batch()` is the transaction unit
  (sequential statements, rollback on failure).
- **D1 limits** (fine for hobby scale, but the ceiling): SQLite only, 10 GB cap, no
  stored procedures / row-level security. Free tier: 5M rows read/day, 100k rows
  written/day; daily request limits apply to Worker invocations — static asset
  serving is free and unlimited. "Rows read" = rows *scanned*, so index your queries.
  Outgrowing it → Hyperdrive + Postgres (Neon/PlanetScale).
- **Re-run codegen after changes** — `wrangler types` for bindings,
  `react-router typegen` for route types (both wired into `npm run typecheck`),
  `drizzle-kit generate` for schema. Stale types are the most common source of confusion.
- **Auth later**: Better Auth is the lightest option — D1 is first-class in it now
  (`betterAuth({ database: env.DB })`, no adapter). remix-auth is stale; Lucia is dead.
  If the app is just for you, Cloudflare Access in front of it means zero auth code.

## Reference

- Best community template (RR 8 + D1 + Drizzle + Better Auth + shadcn, actively
  maintained): https://github.com/foxlau/react-router-v7-better-auth — crib its
  `db/` and auth wiring rather than cloning wholesale.
- React Router v8 release: https://remix.run/blog/react-router-v8
- React Router type safety: https://reactrouter.com/explanation/type-safety
- Cloudflare + React Router guide (bindings section stale, rest OK):
  https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
- Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- Full-stack on Workers (FE + BE + DB): https://blog.cloudflare.com/full-stack-development-on-cloudflare-workers/
- Drizzle + D1: https://orm.drizzle.team/docs/connect-cloudflare-d1
- D1 limits/pricing: https://developers.cloudflare.com/d1/platform/limits/
