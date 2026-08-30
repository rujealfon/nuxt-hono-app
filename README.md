# Nuxt App Monorepo Starter

pnpm + Turborepo. Four deployables, shared Nuxt layers, and shared TS packages.

| Domain               | App                           | Description                 |
| -------------------- | ----------------------------- | --------------------------- |
| `nuxt-app.com`       | [web](apps/web/README.md)     | Public marketing site (SSG) |
| `app.nuxt-app.com`   | [app](apps/app/README.md)     | Authenticated product (SPA) |
| `admin.nuxt-app.com` | [admin](apps/admin/README.md) | Admin panel (SPA)           |
| `api.nuxt-app.com`   | [api](apps/api/README.md)     | Hono API + custom auth      |

## Layers and packages

| Path             | Package                | Used by         | Provides                                                        |
| ---------------- | ---------------------- | --------------- | --------------------------------------------------------------- |
| `layers/base`    | `@nuxt-app/layer-base` | app, admin, web | Tailwind, `@nuxt/ui`, shared Harbor Glass theme, Nitro/devtools |
| `layers/auth`    | `@nuxt-app/layer-auth` | app, admin      | `useAuth`, `auth` / `guest` / `admin` middleware                |
| `packages/auth`  | `@nuxt-app/auth`       | layer-auth      | Fetch client for `/auth/*`                                      |
| `packages/types` | `@nuxt-app/types`      | API + Nuxt      | Shared Zod bodies and `AuthUser`                                |

## Stack

- **Monorepo**: pnpm + Turborepo
- **Frontends**: Nuxt 4
- **API**: Hono
- **Auth**: Session cookie (`nuxt_app_session`), not JWTs
- **DB**: PostgreSQL via Drizzle (Neon in production, `sslmode=verify-full`)
- **Local data**: Docker Compose (Postgres + Redis); apps on the host via `pnpm dev`
- **Deploy**: Vercel (Neon Postgres, Upstash Redis)
- **Rate limit**: `redis` (node-redis) + `hono-rate-limiter` (in-memory in tests). Production: [Upstash Redis](https://upstash.com/docs/redis) over `rediss://`
- **Jobs**: [Upstash QStash](https://upstash.com/docs/qstash)
- **Object storage**: [Cloudflare R2](https://developers.cloudflare.com/r2/)
- **Email**: [Resend](https://resend.com/docs)

## Structure

```
nuxt-app/
├── apps/
│   ├── api/          # Hono backend (port 3001)
│   ├── app/          # User app (port 3000)
│   ├── admin/        # Admin panel (port 3002)
│   └── web/          # Public marketing site (port 3003)
├── layers/
│   ├── base/
│   └── auth/
├── packages/
│   ├── auth/
│   └── types/
├── docker/
├── docker-compose.yml
├── DOCKER.md
├── VERCEL.md
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Quick start

See [DOCKER.md](./DOCKER.md) for Compose commands and ports. Compose is Postgres + Redis only.

```bash
cp .env.example .env
pnpm docker:up
pnpm install
pnpm db:migrate
pnpm dev
```

Or individually:

```bash
pnpm dev:api        # http://localhost:3001
pnpm dev:app        # http://localhost:3000
pnpm dev:admin      # http://localhost:3002
pnpm dev:web        # http://localhost:3003
```

Env is shared from the repo-root `.env` (see `.env.example`). Seed and schema commands: [apps/api/README.md](apps/api/README.md).

## Lint

[@antfu/eslint-config](https://github.com/antfu/eslint-config) at the repo root (Vue + TypeScript + Vue a11y + CSS formatters). CSS and SCSS declarations sort alphabetically. No per-package ESLint config.

```bash
pnpm lint
pnpm lint:fix
```

A Husky pre-commit hook runs `lint-staged` (`eslint --fix` on staged files).

## Deploy

Four Vercel projects from this repo. See [VERCEL.md](./VERCEL.md).
