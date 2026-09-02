# API (`apps/api`)

Hono server. Repo-root `AGENTS.md` covers monorepo commands, shared imports, and root `.env`. This file is this app only.

## Commands

```bash
pnpm dev:api                         # tsx watch, http://localhost:3000
pnpm --filter @nuxt-app/api test     # vitest, app.request(), db nuxt_app_db_test
pnpm --filter @nuxt-app/api test -- sessions.test.ts   # single file
pnpm --filter @nuxt-app/api test -- -t "sweeps expired sessions when logging in"   # single test by name
pnpm db:generate                     # after editing src/db/schema/
pnpm db:migrate                      # also runs on boot in src/index.ts and on Vercel API builds (production and preview)
pnpm db:ensure-admin                 # create/promote an admin; ADMIN_PASSWORD required
```

Scalar is at http://localhost:3000/docs when `NODE_ENV=development`. Spec: `/openapi.json` (generated from routes).

## Architecture

`src/index.ts` is process boot (`runMigrations()` + `serve`). Vercel does not run `index.ts`. API builds run `scripts/vercel-build.sh` (`pnpm db:migrate` then `scripts/bundle-vercel.mjs` → `dist/vercel/app.js`). The Hono builder serves that file — `/var/task` has no `node_modules`. Preview must use its own `DATABASE_URL` / `DATABASE_URL_UNPOOLED`.

`app.ts` is the framework surface: global middleware and `.route()` mounts, and it exports `AppType` — the route type `packages/auth`'s `hc` client infers from (keep the `const app = base.route(...)` chain un-annotated; typing it `Hono<AppEnv>` erases route inference). `package.json` exposes it types-only via the `./app` export. `factory.ts` is `createFactory<AppEnv>` + `OpenAPIHono`. Cross-cutting middleware stays in `src/middleware/`. Origin policy lives in `src/request-policy.ts` (`resolveCorsOrigin`, `skipPublic`).

## Module layout

Domain lives in `src/modules/<name>/`. See `docs/agents/module-layout.md` when adding a module, choosing module vs package, splitting `routes.ts` from domain files, or mounting a router in `app.ts`.

Copy `src/modules/auth/`. `routes.ts` maps HTTP with chained `createRoute` + `createRouter().openapi()`; handlers stay inline. `identity.ts` owns users and passwords (`createUser`, `signIn`, `ensureAdmin`). `signIn` issues the Session from the User PK only when `requireRole` admission passes. `session.ts` owns cookie + row + 7-day expiry and maps rows to AuthUser. Routes do not see the user PK.

`health` and `docs` stay route-only. `admin` is a mount prefix.

## Database

Drizzle lives in `src/db/`. PKs and FKs are `uuid` with SQL default `uuidv7()` (Postgres 18). Leave `id` off inserts and read it back with `.returning()`. `created_at` / `updated_at` use SQL `now()`; leave them off inserts. The pool is `max: 5` on Vercel and `max: 10` locally.

Public API/URL identifiers are `public_id` with SQL default `nanoid()` — add that column only when the row is addressable from the API. JSON `id` is that `public_id`, never the PK. Sessions and other non-addressable rows stay PK-only. Path params that identify a user use `getParamsSchema({ validator: 'nanoid' })`.

The public user is `authUserSchema` in `@nuxt-app/types` (`id` is `public_id`). Never leak `passwordHash`. Request bodies that Nuxt forms also use stay in `@nuxt-app/types`.

## Session and rate limit

`sessionMiddleware` / `requireAdmin` live in `src/middleware/`. `requireAdmin` uses `matchesRequiredRole` from `@nuxt-app/types`. Public paths (`/`, `/health`, `/docs`, `/openapi.json`, `OPTIONS`) skip Session via `skipPublic`.

Rate limit is `hono-rate-limiter` `RedisStore` + node-redis over `REDIS_URL` (global skip of those public paths; tighter cap on `POST /v1/auth/login` and `POST /v1/auth/register`). Tests inject `MemoryStore` via `setRateLimitStoreFactory`.

Logging is pino via `hono-pino` (`c.var.logger`, `LOG_LEVEL`).

## Env

`src/env.ts` loads root `.env` then `apps/api/.env`. `resolveDatabaseUrl()` is the pooled runtime URL. `resolveMigrationDatabaseUrl()` is the direct URL used only by `runMigrations()` / drizzle-kit. `DATABASE_URL_UNPOOLED` is required in production when `DATABASE_URL` is a pooled endpoint. Neon uses `sslmode=verify-full`. Upstash `REDIS_URL` must be `rediss://`; local Compose stays `redis://`.

`APP_URL`, `ADMIN_URL`, `WEB_URL`, and `REDIS_URL` are hard-required when `NODE_ENV=production` — `env.ts` calls `process.exit(1)` on boot if any is missing. On Vercel this is covered: `APP_URL`/`ADMIN_URL`/`WEB_URL` fall back to `resolveVercelPreviewUrl()` on Preview, and `REDIS_URL` is set for both Production and Preview. Deploying outside Vercel with `NODE_ENV=production` (e.g. a bare VM) means setting all four explicitly or the process won't boot. `API_URL` is not required — it's only meaningful for CORS in dev and defaults quietly.

Rate-limit knobs: `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`. Rate limiting uses the socket address unless `TRUST_PROXY` is set (then the first `X-Forwarded-For` hop).

## Imports and tests

Same-app source: `#api/` (even inside a module; Node `imports`, not a TypeScript-only `@api/` path). Tests live in `test/` and call `app.request()` — no HTTP server. Setup creates `nuxt_app_db_test` and runs migrations. Unlike the Nuxt apps' colocated component tests, API tests stay in `test/`: most (`app.test.ts`, `sessions.test.ts`, `rate-limit.test.ts`, `request-policy.test.ts`) exercise the whole app across several modules, so there's no single source file to sit next to.

SPAs talk to this API through `@nuxt-app/auth` and `@nuxt-app/types`.
