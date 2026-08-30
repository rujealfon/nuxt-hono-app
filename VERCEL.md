# Vercel

Four separate projects, one GitHub repo (`rujealfon/nuxt-app`). Each has its own Root Directory, env, domains, and rollback.

| Project          | Root Directory | Runtime                      | Serves             |
| ---------------- | -------------- | ---------------------------- | ------------------ |
| `nuxt-app-web`   | `apps/web`     | Static (`nuxt generate`)     | Marketing site     |
| `nuxt-app-app`   | `apps/app`     | Nuxt SPA (`ssr: false`)      | Logged-in product  |
| `nuxt-app-admin` | `apps/admin`   | Nuxt SPA                     | Admin              |
| `nuxt-app-api`   | `apps/api`     | Hono on Node (Fluid Compute) | Auth, sessions, DB |

Custom domains (attach when DNS is ready):

- `nuxt-app.com` → web
- `app.nuxt-app.com` → app
- `admin.nuxt-app.com` → admin
- `api.nuxt-app.com` → api
- `COOKIE_DOMAIN=.nuxt-app.com`

`*.vercel.app` URLs work for a first smoke test. Cross-subdomain cookies match [apps/api/README.md](apps/api/README.md) only after those custom domains are attached.

## Already done

- Projects exist: `nuxt-app-web`, `nuxt-app-app`, `nuxt-app-admin`, `nuxt-app-api`.
- Nitro: `layers/base` uses `vercel` when `VERCEL` is set, `node-server` otherwise. `apps/web` still overrides to `static`.
- Redis: `connectRedis()` is lazy and coalesced. Rate limiting works when Vercel serves the bundled app and never runs `src/index.ts`.
- Vercel entry for the API is the esbuild bundle at `dist/vercel/app.js` (`export default app`). Do not use `apps/api` `build` (`tsc`) as the Vercel build command. The API `buildCommand` is `scripts/vercel-build.sh` (`pnpm db:migrate` then a single-file bundle). The Hono tracer does not copy pnpm `node_modules` into `/var/task`.

Migrations do **not** run on API boot on Vercel. Production and preview API builds run `pnpm db:migrate`. Preview must use a different database than production. See [Migrate](#migrate).

## Project settings

Each app owns its settings in `apps/<name>/vercel.json` (picked up because Root Directory is that folder). Leave dashboard **Override** toggles (Build / Output / Install / Development) off so the files win. Leave **Include files outside the Root Directory** on (pnpm workspaces need `layers/*` and `packages/*`). Node **24.x**. Nuxt presets detect `pnpm-lock.yaml` at the repo root. The Hono preset does not — `apps/api/package.json` sets `packageManager` and `installCommand` runs `scripts/vercel-install.sh` so pnpm uses the repo-root lockfile. Do not drop `installCommand` when editing `buildCommand`. Do not add `tsc` to the API Vercel build. Do not clear API `outputDirectory` (`dist/vercel`). App/admin/web `buildCommand` runs `nuxt prepare` in the shared layers so Vite can resolve `layers/*/.nuxt/tsconfig.json` (that folder is gitignored and is not created by the app’s own prepare). CI/`turbo run build` does the same via `^nuxt:prepare` instead of a per-app `prebuild`, so parallel app builds do not race on `layers/*/.nuxt`.

| App   | File                     | Framework | Build                                                 | Output                                      |
| ----- | ------------------------ | --------- | ----------------------------------------------------- | ------------------------------------------- |
| web   | `apps/web/vercel.json`   | `nuxtjs`  | layer `nuxt:prepare` + `pnpm build` (`nuxt generate`) | `.output/public`                            |
| app   | `apps/app/vercel.json`   | `nuxtjs`  | layer `nuxt:prepare` + `pnpm build` (`nuxt build`)    | default (Nitro `vercel` → `.vercel/output`) |
| admin | `apps/admin/vercel.json` | `nuxtjs`  | layer `nuxt:prepare` + `pnpm build` (`nuxt build`)    | default                                     |
| api   | `apps/api/vercel.json`   | `hono`    | `scripts/vercel-build.sh` (migrate + esbuild)         | `dist/vercel` — bundled `app.js`            |

Do **not** set `ignoreCommand` / Ignored Build Step to `npx turbo-ignore` (`turbo-ignore` is deprecated). Vercel [skips unaffected projects](https://vercel.com/docs/monorepos#skipping-unaffected-projects) when the commit does not change that package or its workspace deps. That path does not take a concurrent build slot. Leave **Skip deployment** enabled under Root Directory (the default). Leave Ignored Build Step empty.

Do **not** copy web’s `outputDirectory` onto app/admin. Those are `nuxt build` + the Vercel Nitro preset, not a static `generate`.

### Dashboard Framework Preset

`vercel.json` does **not** replace the Framework Preset dropdown. A project created in this monorepo often saves as **Nuxt**. That stored preset still injects Nuxt build hooks (`nuxt build`, `nuxt dev`, Nitro output) even when `apps/api/vercel.json` says `hono`.

On each project: **Settings → Build and Deployment → Framework Preset**:

| Project          | Framework Preset |
| ---------------- | ---------------- |
| `nuxt-app-web`   | Nuxt             |
| `nuxt-app-app`   | Nuxt             |
| `nuxt-app-admin` | Nuxt             |
| `nuxt-app-api`   | **Hono**         |

If `nuxt-app-api` still shows Nuxt, switch it to Hono, save, and redeploy. Leave the four Override toggles off.

After linking locally:

```bash
vercel link --repo
```

That writes `.vercel/repo.json`. Run later `vercel` commands from the app directory (`apps/api`, etc.) so it does not ask which project.

## Postgres + Redis (API only)

Schema needs **Postgres 18** (`uuidv7()`) and `pgcrypto` (`nanoid()`). Redis is TCP (`REDIS_URL` + `node-redis`), not the Upstash REST SDK.

On the **API** project (Vercel Marketplace):

1. Storage → Create Database → Neon. Pick Postgres 18. Put the **pooled** (`…-pooler…`) URL in the API’s `DATABASE_URL` and the **direct** (non-pooler) URL in `DATABASE_URL_UNPOOLED`.
2. Storage → Create Database → Upstash Redis. Put the TCP `rediss://…` URL in `REDIS_URL` (not `redis://`). Upstash endpoints enforce TLS (`TLS/SSL: Enabled` in the console); `redis://` will fail to connect. Keep the existing `node-redis` client.

## Env vars

Set on each project. Projects do not inherit each other’s vars. Database, Redis, `TRUST_PROXY`, `LOG_LEVEL`, and `ENABLE_EXPERIMENTAL_COREPACK` belong on Production **and** Preview. The `*_URL` / `NUXT_PUBLIC_*` rows below are **Production only** — leave them unset on Preview so `resolveVercelPreviewUrl()` can derive the sibling branch domains (see [Preview](#preview)). A var scoped to All Environments counts as set on Preview and disables that fallback.

**`nuxt-app-api`**

| Name                           | Production                                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                 | Neon **pooled** URL (runtime), `sslmode=verify-full`                                                                                                                                                         |
| `DATABASE_URL_UNPOOLED`        | Neon **direct** URL (migrations), `sslmode=verify-full`. Required when `DATABASE_URL` is a pooled endpoint. Must be available at **build** time. Preview scope must be a different database than Production. |
| `REDIS_URL`                    | Upstash `rediss://…` (TLS). Do not use `redis://` — Upstash rejects it.                                                                                                                                      |
| `NODE_ENV`                     | `production` (Vercel usually sets this)                                                                                                                                                                      |
| `API_URL`                      | `https://api.nuxt-app.com` (or the API `*.vercel.app` URL until DNS is ready)                                                                                                                                |
| `APP_URL`                      | `https://app.nuxt-app.com`                                                                                                                                                                                   |
| `ADMIN_URL`                    | `https://admin.nuxt-app.com`                                                                                                                                                                                 |
| `WEB_URL`                      | `https://nuxt-app.com`                                                                                                                                                                                       |
| `COOKIE_DOMAIN`                | `.nuxt-app.com` on custom domains; omit on `*.vercel.app` previews (app/admin use a same-origin `/__api` proxy so the cookie is first-party)                                                                 |
| `TRUST_PROXY`                  | `true` (Vercel overwrites `X-Forwarded-For`)                                                                                                                                                                 |
| `LOG_LEVEL`                    | `info`                                                                                                                                                                                                       |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` (build + all environments). Vercel’s pnpm table stops at 10; this repo is `pnpm@11.22.0`. Without Corepack, a custom `pnpm install` uses **pnpm 6**.                                                     |

`APP_URL` / `ADMIN_URL` / `WEB_URL` are the CORS + CSRF allowlist. Exact origin: `https`, no trailing slash.

**`nuxt-app-app` and `nuxt-app-admin`**

| Name                         | Value                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `NUXT_PUBLIC_API_URL`        | `https://api.nuxt-app.com` (Production only)                                                   |
| `NUXT_API_PROTECTION_BYPASS` | Preview: the **API** project’s Protection Bypass secret (see [Preview](#preview)). Not public. |

`NUXT_PUBLIC_API_URL` is baked in at **build** time (`layers/auth` `runtimeConfig.public.apiUrl`). Change it, then redeploy those two projects.

**`nuxt-app-web`**

| Name                  | Value                      |
| --------------------- | -------------------------- |
| `NUXT_PUBLIC_APP_URL` | `https://app.nuxt-app.com` |

Baked into the static site at **generate** time (`runtimeConfig.public.appUrl`). Change it, then redeploy web. Falls back to `APP_URL` if unset.

### Preview

Preview deployments auto-wire to each other when Preview-scoped `APP_URL` / `ADMIN_URL` / `WEB_URL` / `NUXT_PUBLIC_API_URL` / `NUXT_PUBLIC_APP_URL` are **unset**. Each PR gets a unique per-deployment domain, but Vercel also gives every project a **stable per-branch domain** (`<project>-git-<branch-slug>-<scope>.vercel.app`) that's the same across every push to that branch. `resolveVercelPreviewUrl()` (`layers/base/vercel-preview-url.ts`, duplicated inline in `apps/api/src/env.ts` since the API doesn't depend on Nuxt layers) reads its own `VERCEL_BRANCH_URL` (hostname only, no `https://`) and swaps in a sibling project's name to derive that sibling's branch domain — no need to reproduce Vercel's branch-slug algorithm. It only activates when `VERCEL_ENV === 'preview'`, and an explicit env var always wins over the derived one. If those URL vars are already set for All Environments, split them to Production or the preview app will keep talking to the production API.

- `layers/auth/nuxt.config.ts` → `apiUrl` falls back to `resolveVercelPreviewUrl('nuxt-app-api')`.
- `apps/web/nuxt.config.ts` → `appUrl` falls back to `resolveVercelPreviewUrl('nuxt-app-app')` (after `NUXT_PUBLIC_APP_URL`, then `APP_URL`).
- `apps/api/src/env.ts` → `APP_URL` / `ADMIN_URL` / `WEB_URL` each fall back to the matching `resolveVercelPreviewUrl(...)`.

This assumes all four projects are named `nuxt-app-web` / `nuxt-app-app` / `nuxt-app-admin` / `nuxt-app-api` and deploy from the same branch under the same scope — true for this repo. Rename a project and update the string literal passed to `resolveVercelPreviewUrl` at each call site.

Standard Deployment Protection on the API blocks the app/admin `/__api` Nitro proxy (that hop is server-to-server and has no SSO cookie). Keep protection on if you want; enable **Protection Bypass for Automation** on `nuxt-app-api`, copy the secret, and set it as `NUXT_API_PROTECTION_BYPASS` on **`nuxt-app-app` and `nuxt-app-admin` only** (Preview). The proxy sends `x-vercel-protection-bypass` and does not follow SSO redirects. Do not put this var on the API project and do not use the app’s own `VERCEL_AUTOMATION_BYPASS_SECRET` — it must be the **API** project’s bypass secret. Redeploy app and admin after setting it.

### Until custom domains are attached

Production still on the four `*.vercel.app` URLs (no DNS yet). Use each project's own `*.vercel.app` URL in place of the custom domain, and leave `COOKIE_DOMAIN` unset:

**`nuxt-app-api`**

| Name            | Value                          |
| --------------- | ------------------------------ |
| `API_URL`       | the API's `*.vercel.app` URL   |
| `APP_URL`       | the app's `*.vercel.app` URL   |
| `ADMIN_URL`     | the admin's `*.vercel.app` URL |
| `WEB_URL`       | the web's `*.vercel.app` URL   |
| `COOKIE_DOMAIN` | unset                          |

**`nuxt-app-app` / `nuxt-app-admin`**

| Name                  | Value                        |
| --------------------- | ---------------------------- |
| `NUXT_PUBLIC_API_URL` | the API's `*.vercel.app` URL |

**`nuxt-app-web`**

| Name                  | Value                        |
| --------------------- | ---------------------------- |
| `NUXT_PUBLIC_APP_URL` | the app's `*.vercel.app` URL |

`API_URL` / `APP_URL` / `ADMIN_URL` / `WEB_URL` double as the CORS + CSRF allowlist, so each must be the exact origin (`https://…`, no trailing slash) — not the `/__api` proxy path. Each `*.vercel.app` hostname is its own site with no shared parent domain, so app/admin reach the API through their same-origin `/__api` Nitro proxy and the session cookie stays first-party (`SameSite=Lax`) without `COOKIE_DOMAIN`.

Once custom domains are attached, switch all of the above to the custom-domain URLs and set `COOKIE_DOMAIN=.nuxt-app.com` so app and admin share the session cookie.

## Custom domains

Settings → Domains on each project:

| Domain                 | Project          |
| ---------------------- | ---------------- |
| `nuxt-app.com` + `www` | `nuxt-app-web`   |
| `app.nuxt-app.com`     | `nuxt-app-app`   |
| `admin.nuxt-app.com`   | `nuxt-app-admin` |
| `api.nuxt-app.com`     | `nuxt-app-api`   |

Add the DNS records Vercel shows. Then set `COOKIE_DOMAIN=.nuxt-app.com` on the API and redeploy it.

Until DNS is live: use the four `*.vercel.app` URLs, leave `COOKIE_DOMAIN` unset, and put those exact origins in `APP_URL` / `ADMIN_URL` / `WEB_URL` / `NUXT_PUBLIC_API_URL` / `NUXT_PUBLIC_APP_URL`. Each `*.vercel.app` hostname is its own site, so the app/admin clients call the API through a same-origin `/__api` proxy and the session cookie stays first-party (`SameSite=Lax`). After custom domains are attached, set `COOKIE_DOMAIN=.nuxt-app.com` so app and admin share the cookie on the parent domain.

## Migrate

`pnpm db:migrate` (repo root) runs `tsx apps/api/src/db/migrate.ts`. It loads repo-root `.env`, then `apps/api/.env`. A shell `DATABASE_URL_UNPOOLED` (then `DATABASE_URL`) wins. API boot also runs migrations locally and uses `DATABASE_URL_UNPOOLED` when set.

Vercel API builds (production and preview) run `pnpm db:migrate`. Mark `DATABASE_URL` and `DATABASE_URL_UNPOOLED` available at **build** time on `nuxt-app-api` (not Runtime-only). Set Preview-scoped URLs to a different Neon database (or branch) than Production.

Use Neon’s **direct** host (no `-pooler`) in `DATABASE_URL_UNPOOLED`. Migrations take a lock; the pooler can hang. Keep the pooler URL in `DATABASE_URL` for the running API.

```bash
DATABASE_URL_UNPOOLED='postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech:5432/neondb?sslmode=verify-full' \
  pnpm db:migrate

DATABASE_URL='postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech:5432/neondb?sslmode=verify-full' \
  ADMIN_PASSWORD='your-strong-password' \
  pnpm db:ensure-admin
```

`drizzle-kit` / `tsx` do not load Vercel env files. Pass `DATABASE_URL_UNPOOLED` on the command line for migrate/studio.

Preview deploys apply that branch’s SQL to the **preview** database. Do not point Preview `DATABASE_URL` / `DATABASE_URL_UNPOOLED` at production. A Vercel rollback restores functions, not schema.

Keep migrations additive. First Neon stand-up and anything destructive (`DROP` / rename) stay off the automatic hook — run those from your machine.

Local Compose:

```bash
docker compose up postgres -d
pnpm db:migrate
```

## Deploy order

1. API (env vars set).
2. `https://<api>/health`.
3. Confirm the API build applied migrations (`Running migrations...` / `Migrations completed.`). Create an admin if the database is new (`pnpm db:ensure-admin`).
4. app, admin, web.

Git pushes then deploy all four. Vercel skips a project when that package and its workspace deps did not change.

## Smoke test

1. Open web → page loads (static, no Node server).
2. Open app `/register` → create a user → lands on `/login` (register does not start a session).
3. Sign in with that account → lands logged in.
4. `GET https://<api>/v1/auth/me` in that browser session returns the user (`nuxt_app_session`, httpOnly).
5. Open admin → same cookie works on `*.nuxt-app.com` with `COOKIE_DOMAIN` set. Promote with `ADMIN_PASSWORD=... pnpm db:ensure-admin` (resets that account's password) or `UPDATE users SET role = 'admin' …`.
6. Wrong-origin request to the API is rejected (CORS/CSRF).
7. Hit login ~11 times quickly → 429 from the Redis limiter.

## Gotchas

- Postgres must be 18. Neon 17 fails the first migration (`uuidv7()`).
- API Vercel build is `scripts/vercel-build.sh` (migrate + esbuild), not `tsc`. The function file must not `import` npm or workspace packages — `/var/task` has no `node_modules`. Preview must not share production `DATABASE_URL`.
- Same-app imports stay `#api/` (`apps/api/package.json` `imports`) for local `tsx` / tests. Do not reintroduce TypeScript-only `@api/` paths.
- Hono does not detect the repo-root pnpm lockfile. A custom `pnpm install` uses Vercel’s oldest pnpm (6), which ignores this lockfile. `scripts/vercel-install.sh` installs from the workspace root with `npx pnpm@<packageManager>`. Also set `ENABLE_EXPERIMENTAL_COREPACK=1` on `nuxt-app-api` ([Vercel Corepack](https://vercel.com/docs/builds/configure-a-build#corepack); [pnpm 11](https://andrewusher.dev/blog/upgrading-pnpm-11-vercel)). `tsc` is not the Vercel entry.
- Runtime `DATABASE_URL` is the Neon **pooler**. If the pool is exhausted, set `max: 1` on the `pg` Pool. Migrations use `DATABASE_URL_UNPOOLED` (required in production when `DATABASE_URL` is pooled). Neon URLs use `sslmode=verify-full` (`pg` already treats `require` as `verify-full` and warns).
- Upstash `REDIS_URL` must be `rediss://` (TLS). `redis://` is only for local Compose.
- SPA deep links work because Nitro/Vercel serves the fallback. web is fully static.
- Four projects = four preview URLs per PR. Sibling branch URLs are derived from `VERCEL_BRANCH_URL` when Preview `*_URL` / `NUXT_PUBLIC_*` vars are unset (see [Preview](#preview)). If those vars are set on Preview, they win and this preview talks to whatever origin they name.
