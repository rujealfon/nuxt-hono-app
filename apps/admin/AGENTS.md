# Admin (`apps/admin`)

Admin SPA (`ssr: false`). Extends `layer-auth` + `layer-base`. Color mode defaults to dark. Repo-root `AGENTS.md` covers monorepo commands, shared imports, and root `.env`. This file is this app only.

## Commands

```bash
pnpm dev:admin                         # http://localhost:3002
pnpm --filter @nuxt-app/admin test     # @nuxt/test-utils + Vitest; component tests colocated as *.test.ts, route/page tests under test/
pnpm --filter @nuxt-app/admin test -- -t "shows the admin home for an administrator"   # single test by name
pnpm --filter @nuxt-app/admin type-check
```

Needs a running API (`pnpm dev:api`) and an admin user (`pnpm db:seed`).

## Feature layout

Domain UI lives in `app/features/<name>/`. `app/pages/` stays the route adapter (`definePageMeta`, then the feature). See `docs/agents/feature-layout.md` when adding a feature, choosing feature vs layer, placing Pinia Colada queries or mutations, or moving pages/composables.

Auth stays in `layers/auth`. Do not add another Colada plugin or per-feature defaults. Session / `AuthUser` stays in `useAuth` (key `['auth', 'me']`). Features do not re-query `/auth/me`.

`nuxt.config.ts` registers `~/features/*/components/**` and `features/*/composables`. Prefix feature components with the feature name (`HomeWelcomeCard.vue`). Its test lives next to it (`HomeWelcomeCard.test.ts`); Vitest picks up colocated `*.test.ts` files automatically.

## Route access

Guards are adapters over `resolveRouteAccess` in `layers/auth`. `/` uses `admin`; `/login` uses `guest-admin`. There is no register page. `guest-admin` redirects only administrators so a shared-cookie regular user can reach this login.

Guards use `applyRouteAccess` → `fetchUser()` so a revoked Session cannot pass on a stale cache.

`useAuth` constructs `createAuthClient(apiUrl, pageHref)`. The client picks the first-party `/__api` base on preview `*.vercel.app` hosts. `layers/auth` serves that prefix (`server/routes/__api/[...path].ts`) and adds `x-vercel-protection-bypass` when `NUXT_API_PROTECTION_BYPASS` is set (the API project’s Protection Bypass secret). Failed bodies map through `messageFromFailedBody` / `failedResponseBody`.

## Imports

Same-app source: `@admin/`. Inside `app/features/<name>/`, relative paths that stay in that feature. Pages import `@admin/features/<name>/...`. A feature does not import another feature or `pages/`.

A specific layer file is `#layers/base` or `#layers/auth`. Components and composables from layers are auto-imported.
