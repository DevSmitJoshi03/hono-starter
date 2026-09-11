# Hono API Starter

A production-oriented Hono + Cloudflare Workers starter: schema-first OpenAPI
routing, typed env, JWT/OTP auth with refresh-token rotation, a dual Postgres
adapter, object storage, structured logging, linting, Git hooks, and CI — wired
up and verified to build.

## Stack

- **Hono + `@hono/zod-openapi`** — schema-first routing; Zod schemas double as
  request/response validation, TypeScript types, and a generated OpenAPI spec.
- **Cloudflare Workers (+ Node fallback)** — deploys via `wrangler`; the same
  app also runs under `@hono/node-server` (`src/index.ts`) for a non-Workers
  dev loop.
- **Drizzle ORM + PostgreSQL** — Cloudflare **Hyperdrive** binding in
  production, `@neondatabase/serverless` (or any Postgres URL) locally.
- **Bun** — install + scripts.
- **Zod** — env validation (`src/env.ts`); invalid/missing config fails fast.
- **JWT (EdDSA) + OTP auth** — access/refresh token pattern with rotation and
  reuse detection, admin + customer account types, OTP-based password reset.
- **Cloudflare R2** — object storage via the S3-compatible SDK
  (`@aws-sdk/client-s3`), so the same code works against R2 or plain S3.
- **pino / hono-pino** — structured logging.
- **Biome** — lint + format.
- **Vitest** — tests.

---

## Starting a new project from this template

Work top to bottom. Everything here is a one-time change; after the first
commit you rarely touch most of it again.

### 1. Get the code and reset history

```bash
npx degit <this-repo-url> my-api
cd my-api
rm -rf .git && git init
bun install
```

### 2. Rename the project

| File                                 | Field                          | Change to                                                                  |
| ------------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| `package.json`                        | `name`                          | your package name (kebab-case)                                              |
| `wrangler.jsonc`                      | `name`                          | your Worker name — shown in the CF dashboard, becomes part of the default `*.workers.dev` URL |
| `src/routes/index.route.ts`           | the `/` message + example schema | your API's name                                                             |
| `src/lib/configure-open-api.ts`       | `info.title`                    | your API's name                                                             |

`wrangler.jsonc`'s `r2_buckets[].bucket_name` and the `R2_BUCKET_NAME` env var
are **not** just branding — they're a real Cloudflare resource id, set in
step 4, not here.

### 3. Set up env

```bash
cp .dev.vars.example .dev.vars   # wrangler dev / production bindings
cp .env.example .env             # optional: Node-only dev loop + drizzle-kit
```

- Generate an Ed25519 key pair: `bun run src/scripts/generate-jwt-keys.ts` →
  paste into `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`.
- Fill in `DATABASE_URL` with a local/dev Postgres connection string.
- Change the variable set in [src/env.ts](src/env.ts) to what your app needs;
  mirror any change in `.dev.vars.example` **and** `.env.example`.
- **Never** put secrets in `vars` in `wrangler.jsonc` — they'd be readable in
  the dashboard/logs. Use `wrangler secret put` in production (see step 8).

### 4. Provision Cloudflare resources

```bash
wrangler hyperdrive create <name> --connection-string="<postgres-url>"
wrangler r2 bucket create <name>
wrangler email sending enable <your-domain>   # optional — only if you send OTP emails
```

Paste the returned Hyperdrive id and bucket name into `wrangler.jsonc` (and
`R2_BUCKET_NAME`). The two rate-limiter `namespace_id`s in `wrangler.jsonc`
need no provisioning — pick any unused positive integer yourself.
`bun run deploy` runs `src/scripts/check-deploy-config.ts` first and fails
loudly if the Hyperdrive id or R2 bucket is still a stale placeholder.

### 5. Run migrations and create your first admin

```bash
bun run db:migrate
bun run create-admin -- --email=you@example.com --password=xxxxxxxx
```

There's no admin-registration HTTP endpoint by design — only an existing admin
should be able to create another — so
[`create-admin`](src/scripts/create-admin.ts) is the bootstrap path for the
first one.

### 6. Build your first route

Copy an existing route folder as the template — `src/routes/customer-auth/` is
the best reference (`*.routes.ts`, `*.handlers.ts`, `*.index.ts`,
`*.type.ts`) — and wire it into the `routes` array in
[src/app.ts](src/app.ts). Update [src/db/schema/](src/db/schema/) for your
data model and run `bun run db:generate`. Update the public-path and
rate-limited-path allowlists in [src/lib/create-app.ts](src/lib/create-app.ts)
if the new route should skip auth or needs stricter rate limiting.

### 7. Verify and commit

```bash
bun run typecheck && bun run lint && bun run test
bun run dev        # wrangler dev — confirm /reference renders + your route responds
git add -A && git commit -m "chore: initialize from starter"
```

The pre-commit hook runs lint-staged; the pre-push hook runs `typecheck`. Push
to GitHub and CI (`.github/workflows/ci.yml`) runs typecheck + lint + test +
build on every PR.

### 8. Before your first deploy

```bash
wrangler secret put JWT_PRIVATE_KEY
wrangler secret put JWT_PUBLIC_KEY
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put DATABASE_URL          # only if not using the Hyperdrive binding

# Safe as `vars` in wrangler.jsonc (not secret):
#   NODE_ENV=production, LOG_LEVEL, CLOUDFLARE_ACCOUNT_ID, R2_BUCKET_NAME,
#   CORS_ORIGIN, JWT_EXPIRES_IN, REFRESH_TOKEN_TTL_MS, AUTH_MODE, OTP_EXPIRES_IN_MS,
#   BRAND_NAME, EMAIL_FROM_ADDRESS, SITE_URL, LOGO_URL, BRAND_ACCENT_COLOR

DATABASE_URL=<prod-url> bun run db:migrate   # apply migrations against production
bun run deploy                               # runs predeploy (check-deploy-config.ts) first
bun run create-admin -- --email=... --password=...   # against the prod DATABASE_URL
```

The JWT private key in particular can mint tokens for any user — treat it like
any other production credential.

---

## Scripts

| Command                             | Purpose                                        |
| ------------------------------------ | ----------------------------------------------- |
| `bun run dev`                        | Run locally via `wrangler dev`                  |
| `bun run dev:remote`                 | `wrangler dev --remote`, bound to `0.0.0.0`     |
| `bun run deploy`                     | Minified deploy via Wrangler (runs `predeploy`) |
| `bun run db:generate`                | Generate Drizzle migrations from schema changes |
| `bun run db:migrate`                 | Apply migrations (`DB_MIGRATING=true`)          |
| `bun run create-admin`               | Bootstrap an admin user directly against the DB |
| `bun run typecheck`                  | `tsc --noEmit`                                  |
| `bun run lint` / `bun run lint:fix`  | Biome checks                                    |
| `bun run format`                     | Biome format                                    |
| `bun run test`                       | Vitest (`NODE_ENV=test`)                        |
| `bun run build`                      | Compile + resolve path aliases for the Node entrypoint |

## Project layout

```
src/
  worker.ts       Workers entrypoint (wrangler.jsonc `main`) — fetch + scheduled
  app.ts          The Hono app itself (imported by worker.ts, index.ts, and tests)
  index.ts        Node entrypoint (@hono/node-server)
  env.ts          Zod-validated environment/bindings
  db/             Drizzle schema, queries, connection factory
  lib/            App wiring: router factory, middleware pipeline, shared types
  middlewares/    Auth, rate limiting, security headers, logging, error handling
  openapi/        OpenAPI helpers and reusable response schemas
  routes/         Feature routes (*.routes.ts, *.handlers.ts, *.index.ts, *.type.ts)
  scheduled/      Cron Trigger handlers (see wrangler.jsonc `triggers.crons`)
  scripts/        One-off CLI scripts (JWT keygen, admin bootstrap, predeploy check)
  utility/        JWT, OTP, password hashing, email, R2 helpers, HTTP status constants
```

## Auth & middleware pipeline

The middleware chain in [src/lib/create-app.ts](src/lib/create-app.ts) runs in
a deliberate order — cheap checks before expensive ones (body size and rate
limiting both run before the per-request DB pool is created, so a rejected
request never pays for a connection it'll never use).

- **Adding a route that skips auth** (e.g. a public read) — add its path to
  `publicPathMatchers`.
- **Adding a route that needs tight rate limiting** (credential/OTP guessing
  surface) — add it to `rateLimitedPathMatchers`.
- **Reading the caller inside a handler** — `c.get("user")` after `jwtAuth()`
  gives `{ id, type }`; `requireRole(UserType.ADMIN)` and
  `requirePermission(AdminModule.X)` (see
  [src/middlewares/auth.ts](src/middlewares/auth.ts)) gate further. Use
  `optionalAuth()` instead of `jwtAuth()` for routes that behave differently
  for guests vs. logged-in callers without forcing a 401.
- **Refresh tokens** are delivered by platform (`x-platform` header): browsers
  get an httpOnly `Secure` cookie only; native apps (`ios`/`android`/`desktop`)
  also get the token in the JSON body to store in Keychain/Keystore. See
  [src/utility/refresh-token-delivery.ts](src/utility/refresh-token-delivery.ts).

## Calling the database

Every query function takes `DB | DBTransaction` as its last argument, so the
same function works standalone or inside a `db.transaction(...)` — see
[src/routes/customer-auth/customer-auth.handlers.ts](src/routes/customer-auth/customer-auth.handlers.ts)
for a real multi-table example (user + profile + refresh token, one
transaction).

```ts
// src/db/queries/widget.ts
import { eq } from "drizzle-orm";
import type { DB, DBTransaction } from "@/db";
import widgets, {
  type InsertWidget,
  type SelectWidget,
} from "@/db/schema/widget";

export async function findOne(
  id: string,
  db: DB | DBTransaction
): Promise<SelectWidget | null> {
  const [row] = await db.select().from(widgets).where(eq(widgets.id, id)).limit(1);
  return row ?? null;
}

export async function create(
  data: InsertWidget,
  db: DB | DBTransaction
): Promise<SelectWidget | null> {
  const [row] = await db.insert(widgets).values(data).returning();
  return row ?? null;
}
```

```ts
// src/routes/widgets/widgets.handlers.ts
export const getWidget: AppRouteHandler<GetWidgetRoute> = async (c) => {
  const db = c.var.db;
  const widget = await widgetQueries.findOne(c.req.valid("param").id, db);
  if (!widget) {
    return c.json(
      failure(ErrorCodes.NOT_FOUND, "Widget not found"),
      HttpStatusCodes.NOT_FOUND
    );
  }
  return c.json(success(widget), HttpStatusCodes.OK);
};
```

- **Responses**: every handler returns `success(data)` / `failure(code, message)`
  (see [src/utility/response.ts](src/utility/response.ts)) so the shape is
  consistent across the API.
- **Adapter**: `createDb()` (`src/db/index.ts`) picks Hyperdrive when the
  binding is present, otherwise falls back to `DATABASE_URL` — handlers never
  branch on which one is active.

## Not included — add per project

- Tests beyond small utilities/OpenAPI helpers/app wiring — DB query logic is
  untested (needs a real Postgres, not just dummy env vars).
- CRUD scaffolding beyond auth (the `customer`/`admin` tables and routes are a
  reference pattern for the JWT/OTP flow, not a full admin panel).
- External error-tracking/alerting (e.g. Sentry) beyond Cloudflare's built-in
  Workers observability.
- Push notifications, webhooks, background job queues beyond the one Cron
  Trigger (`src/scheduled/prune-stale-auth-records.ts`).

## Keeping dependencies current

A template is a **snapshot**. Every version in `package.json` is pinned, so
nothing updates on its own.

Some dependencies are **paired** — bumping one without the other breaks things
silently, not with a clear error:

- **`hono` + `@hono/zod-openapi` + `zod`** — `@hono/zod-openapi`'s major is
  pinned to a specific `zod` major (v4 here). Bumping `zod` alone can break
  route validation in ways that don't fail typecheck.
- **`drizzle-orm` + `drizzle-kit`** — bump together; check the
  [Drizzle changelog](https://orm.drizzle.team/docs/changelog) for breaking
  schema/migration changes.
- **`wrangler` + `@cloudflare/workers-types`** — `@cloudflare/workers-types`
  should track the Workers runtime version implied by `compatibility_date` in
  `wrangler.jsonc`; bump both together and bump `compatibility_date` deliberately
  (read the [compatibility date docs](https://developers.cloudflare.com/workers/configuration/compatibility-dates/)
  first — it can change runtime behavior).

Everything else (`@aws-sdk/*`, `pino`, `biome`, `vitest`, …) can be upgraded
normally, one at a time.

### If you're starting a project and the template is a few months old

```bash
# 1. Bump the paired groups together, reading each changelog for breaking changes
bunx npm-check-updates -u /^(wrangler|@cloudflare\/workers-types)$/
bunx npm-check-updates -u /^(hono|@hono\/zod-openapi|zod)$/
bunx npm-check-updates -u /^(drizzle-orm|drizzle-kit|drizzle-zod)$/
bun install

# 2. Bump everything else — minor + patch only (safe, no breaking majors)
bunx npm-check-updates -u --target minor
bun install

# 3. Verify
bun run typecheck && bun run lint && bun run test && bun run build
bun run dev        # confirm /reference renders and a route responds
```

For **major** bumps of the non-paired deps, do them one at a time afterwards,
reading each library's migration guide:

```bash
bunx npm-check-updates              # list what's behind, including majors
bunx npm-check-updates -u <pkg>     # bump one, then test
```

If the template was refreshed recently, skip all of this — just `bun install`
and start building.

### Maintaining this template repo

Run the same procedure on `main` periodically, test, and commit — so new
projects start current instead of months behind. A Dependabot config with
grouped minor/patch PRs keeps the non-paired deps moving between refreshes
with little effort.

### Upgrading an existing project's dependencies later

Same steps, run inside the project whenever you deliberately move to newer
versions. This is normal maintenance, not template-specific.

## License

MIT
