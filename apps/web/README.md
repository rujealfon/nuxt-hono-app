# Web (`@nuxt-app/web`)

Public marketing site. Nuxt 4 SSG (`nuxt generate`, `nitro.preset: 'static'`). Production host: `nuxt-app.com`. Local: http://localhost:3003.

Extends `@nuxt-app/layer-base` only — no auth layer, no session client. Install and env live at the repo root.

```bash
pnpm install
pnpm dev:web
```

Login and register CTAs point at the product app. The destination is baked in at generate time from `NUXT_PUBLIC_APP_URL` (falls back to `APP_URL`).

## Routes

| Path | Notes                         |
| ---- | ----------------------------- |
| `/`  | Prerendered marketing landing |

Prefer prerender. Do not add a Node server unless a page needs per-request data.

## Tests

```bash
pnpm --filter @nuxt-app/web test
```

`@nuxt/test-utils` + Vitest (`environment: 'nuxt'`), files under `test/`.

## Env

From the repo-root `.env`. `WEB_URL` is this site’s public origin. `NUXT_PUBLIC_APP_URL` / `APP_URL` are the product-app links in the generated HTML.

## Deploy

Vercel project `nuxt-app-web` (`nuxt generate`, output `.output/public`). Details: [VERCEL.md](../../VERCEL.md). Local Postgres/Redis: [DOCKER.md](../../DOCKER.md).
