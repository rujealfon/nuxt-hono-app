# App (`apps/app`)

Authenticated product SPA (`ssr: false`). Extends `layer-auth` + `layer-base`. Repo-root `AGENTS.md` covers monorepo commands, shared imports, and root `.env`. This file is this app only.

## Commands

```bash
pnpm dev:app                         # http://localhost:3001
pnpm --filter @nuxt-app/app test     # @nuxt/test-utils + Vitest; component tests colocated as *.test.ts, route/page tests under test/
pnpm --filter @nuxt-app/app test -- HomeWelcomeCard.test.ts   # single file
pnpm --filter @nuxt-app/app test -- -t "shows the signed-in user"   # single test by name
pnpm --filter @nuxt-app/app type-check
```

Needs a running API (`pnpm dev:api`).

## Feature layout

Domain UI lives in `app/features/<name>/`. `app/pages/` stays the route adapter (`definePageMeta`, then the feature). See `docs/agents/feature-layout.md` when adding a feature, choosing feature vs layer, placing Pinia Colada queries or mutations, or moving pages/composables.

Auth stays in `layers/auth`. Do not add another Colada plugin or per-feature defaults. Session / `AuthUser` stays in `useAuth` (key `['auth', 'me']`). Features do not re-query `/auth/me`.

`nuxt.config.ts` registers `~/features/*/components/**` and `features/*/composables`. Prefix feature components with the feature name (`HomeWelcomeCard.vue`). Its test lives next to it (`HomeWelcomeCard.test.ts`); Vitest picks up colocated `*.test.ts` files automatically.

## Route access

Guards are adapters over `resolveRouteAccess` in `layers/auth`. `/` uses `auth`; `/login` and `/register` use `guest`. Guards use `applyRouteAccess` → `fetchUser()` so a revoked Session cannot pass on a stale cache.

`useAuth` constructs `createAuthClient(apiUrl, pageHref)`. The client picks the first-party `/__api` base on preview `*.vercel.app` hosts. `layers/auth` serves that prefix (`server/routes/__api/[...path].ts`) and adds `x-vercel-protection-bypass` when `NUXT_API_PROTECTION_BYPASS` is set (the API project’s Protection Bypass secret). Failed bodies map through `messageFromFailedBody` / `failedResponseBody`.

## Imports

Same-app source: `@app/`. Inside `app/features/<name>/`, relative paths that stay in that feature. Pages import `@app/features/<name>/...`. A feature does not import another feature or `pages/`.

A specific layer file is `#layers/base` or `#layers/auth`. Components and composables from layers are auto-imported.
