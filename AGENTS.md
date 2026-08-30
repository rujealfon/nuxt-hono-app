# AGENTS.md

This file provides guidance when working with code in this repository.

## Commands

```bash
pnpm dev              # all apps via Turborepo (api:3001, app:3000, admin:3002, web:3003)
pnpm dev:api          # single app: turbo run dev --filter=@nuxt-app/api (also dev:app, dev:admin, dev:web)
pnpm build            # turbo run build (respects dependsOn: ["^build"])
pnpm type-check       # turbo run type-check (every workspace: tsc or nuxt typecheck)
pnpm lint / lint:fix  # eslint . (root-level flat config, applies repo-wide; husky pre-commit runs lint-staged)
pnpm test             # turbo run test (API, Nuxt apps/layers, packages)
pnpm db:generate      # drizzle-kit generate (run after editing apps/api/src/db/schema/)
pnpm db:migrate       # applies migrations (API boot locally; production and preview Vercel API builds)
pnpm db:studio        # drizzle-kit studio on the host
pnpm db:ensure-admin  # create/promote an admin (requires ADMIN_PASSWORD), tsx apps/api/src/ensure-admin.ts
```

Docker: [DOCKER.md](DOCKER.md) (local Postgres 5433, Redis 6380, Drizzle Studio 4983; not production). Then `pnpm install`, `pnpm db:migrate`, `pnpm dev`. `.env.example` already uses those published ports.
Vercel: [VERCEL.md](VERCEL.md) (four projects: `nuxt-app-web`, `nuxt-app-app`, `nuxt-app-admin`, `nuxt-app-api`; env, domains, migrate).

## Git

Committing and pushing are reserved for the user. Stage changes and describe what you'd commit, then stop — do not run `git commit` or `git push` yourself, even when a skill or background-job flow you're running says to commit by default.

## Architecture

pnpm + Turborepo monorepo, three layers: `apps/*` (deployables), `layers/*` (Nuxt layers, extended by apps), `packages/*` (plain TS packages, no Nuxt). Each deployable has `apps/<name>/AGENTS.md` and `apps/<name>/README.md`.

- **apps/api** — Hono server. Modules under `src/modules/*`, mounted from `src/app.ts`. See `apps/api/AGENTS.md`.
- **apps/app** — Nuxt 4 SPA (`ssr: false`) for the authenticated product. Extends `layer-auth` + `layer-base`. See `apps/app/AGENTS.md`.
- **apps/admin** — Nuxt 4 SPA (`ssr: false`) for admins. Extends `layer-auth` + `layer-base`. See `apps/admin/AGENTS.md`.
- **apps/web** — Nuxt 4 SSG marketing site (`nuxt generate`, `nitro.preset: 'static'`). Extends `layer-base` only. See `apps/web/AGENTS.md`.
- **layers/base** (`@nuxt-app/layer-base`) — Tailwind v4 + `@nuxt/ui` + shared theme (`app/app.config.ts`, `app/assets/css/main.css`) + Nitro. Every Nuxt app depends on this. `app.vue` wraps pages in `UApp`. Change colors and fonts here.
- **layers/auth** (`@nuxt-app/layer-auth`) — Pinia Colada + `useAuth` (query key `['auth', 'me']`), `AuthLoginForm`/`AuthRegisterForm`, and `auth`/`guest`/`guest-admin`/`admin` route middleware. `guest-admin` redirects only administrators so a shared-cookie regular user can reach admin login.
- **packages/types** — shared Zod request schemas (`loginSchema`, `registerSchema`) plus inferred/plain types (`LoginInput`, `AuthUser`, …). API and Nuxt forms use the same schemas. Request bodies that are not table-shaped stay here. The public user shape (`authUserSchema`) lives here too.
- **packages/auth** — `createAuthClient(apiUrl, pageHref?)` fetch client for `/auth/*`, consumed by `layer-auth`'s `useAuth`. Chooses the first-party `/__api` base on preview `*.vercel.app` hosts. Does not import API route types.

Sessions are opaque IDs in an httpOnly cookie (`nuxt_app_session`), not JWTs. `resolveRouteAccess` is the route-access policy; the four Nuxt guards are adapters over it.

Imports:

- Another package or layer: `@nuxt-app/types`, `@nuxt-app/auth`, `@nuxt-app/layer-base`, `@nuxt-app/layer-auth`. Do not add short aliases (`@types`, `@auth`) — `@types` collides with DefinitelyTyped, and `@auth` is both a package and a layer.
- Same-app source: `#api/` (API; Node `package.json` `imports` — Vercel Node cannot resolve TypeScript `@api/` paths), `@app/`, `@admin/`, `@web/` (that app's `src/` or `app/`).
- Inside `app/features/<name>/`: relative paths that stay in that feature. Pages import `@app/features/<name>/...` (or `@admin/...`). A feature does not import another feature or `pages/`.
- Inside `packages/*`: relative `./` to local files. Public surface stays `src/index.ts`.
- Layers: `extends: '@nuxt-app/layer-*'`. Components and composables are auto-imported. A specific layer file is `#layers/base` or `#layers/auth`.

When changing a shared package's public surface (`packages/*/src/index.ts` exports), check all consuming apps/layers, not just the one you're editing.

Env vars are shared across all apps from repo-root `.env` (see `.env.example`). Nuxt layers/apps call `loadRootEnv()` before reading `NUXT_PUBLIC_*` (Turbo runs those tasks from each workspace directory). `DATABASE_URL`, `REDIS_URL`, `COOKIE_DOMAIN`, and per-app `*_URL` vars are used for CORS allowlisting and cross-subdomain cookies. Documented `*.vercel.app` previews are distinct sites; app/admin call the API via a same-origin `/__api` Nitro proxy so the session cookie is first-party (`SameSite=Lax`). Production custom domains set `COOKIE_DOMAIN=.nuxt-app.com`. API database and rate-limit env: `apps/api/AGENTS.md`.

Lint: `@antfu/eslint-config` (Vue + TypeScript + Vue a11y + formatters; CSS/SCSS properties alphabetical) at repo root — no per-package eslint config.

## Agent skills

### App guides

Each deployable has `apps/<name>/AGENTS.md`. Read it when adding a route or module in the API, a page or feature in app/admin, a marketing page in web, or changing that app's tests, env, or deploy entry.

### Issue tracker

Issues live as markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles map 1:1 to `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
