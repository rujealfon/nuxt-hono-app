# Admin (`@nuxt-app/admin`)

Admin panel SPA (Nuxt 4, `ssr: false`). Production host: `admin.nuxt-app.com`. Local: http://localhost:3002.

Extends `@nuxt-app/layer-base` and `@nuxt-app/layer-auth`. Color mode defaults to dark. Install and env live at the repo root.

```bash
pnpm install
pnpm dev:admin
```

Needs the API on http://localhost:3001 (`pnpm dev:api`). Create an admin first — see [apps/api/README.md](../api/README.md).

## Routes

| Path     | Access        |
| -------- | ------------- |
| `/`      | `admin`       |
| `/login` | `guest-admin` |

There is no register page. `guest-admin` redirects only administrators, so a shared-cookie regular user can still reach this login. Session is the same `nuxt_app_session` cookie as the product app. Preview `*.vercel.app` hosts call the API through this app’s same-origin `/__api` Nitro proxy.

## Tests

```bash
pnpm --filter @nuxt-app/admin test
```

`@nuxt/test-utils` + Vitest (`environment: 'nuxt'`), files under `test/`.

## Env

From the repo-root `.env`. `ADMIN_URL` is this app’s public origin (CORS + cookie). Production custom domains share the session with the product app via `COOKIE_DOMAIN=.nuxt-app.com`.

## Deploy

Vercel project `nuxt-app-admin` (`nuxt build`). Details: [VERCEL.md](../../VERCEL.md). Local Postgres/Redis: [DOCKER.md](../../DOCKER.md).
