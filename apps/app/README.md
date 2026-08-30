# App (`@nuxt-app/app`)

Authenticated product SPA (Nuxt 4, `ssr: false`). Production host: `app.nuxt-app.com`. Local: http://localhost:3000.

Extends `@nuxt-app/layer-base` and `@nuxt-app/layer-auth`. Install and env live at the repo root.

```bash
pnpm install
pnpm dev:app
```

Needs the API on http://localhost:3001 (`pnpm dev:api`).

## Routes

| Path        | Access  |
| ----------- | ------- |
| `/`         | `auth`  |
| `/login`    | `guest` |
| `/register` | `guest` |

Login and register use the shared forms from `layers/auth`. Session is the `nuxt_app_session` cookie set by the API. Preview `*.vercel.app` hosts call the API through this app’s same-origin `/__api` Nitro proxy so the cookie stays first-party.

## Tests

```bash
pnpm --filter @nuxt-app/app test
```

`@nuxt/test-utils` + Vitest (`environment: 'nuxt'`), files under `test/`.

## Env

From the repo-root `.env`. `NUXT_PUBLIC_API_URL` is the API the client talks to in local/dev. `APP_URL` is this app’s public origin (CORS + cookie). Production custom domains share the session with admin via `COOKIE_DOMAIN=.nuxt-app.com`.

## Deploy

Vercel project `nuxt-app-app` (`nuxt build`). Details: [VERCEL.md](../../VERCEL.md). Local Postgres/Redis: [DOCKER.md](../../DOCKER.md).
