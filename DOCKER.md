# Docker

Local **Postgres and Redis only**. API, app, admin, and web run on the host with `pnpm dev` (hot reload). Production is [Vercel](VERCEL.md) (Neon + Upstash) — Compose is not a deploy path.

## Quick start

```bash
cp .env.example .env   # skipped if .env already exists (`predocker:up`)
pnpm docker:up
pnpm install
pnpm db:migrate
pnpm dev
```

| Service  | URL                                |
| -------- | ---------------------------------- |
| App      | http://localhost:3000 (`pnpm dev`) |
| API      | http://localhost:3001 (`pnpm dev`) |
| Admin    | http://localhost:3002 (`pnpm dev`) |
| Web      | http://localhost:3003 (`pnpm dev`) |
| Postgres | localhost:5433 (container 5432)    |
| Redis    | localhost:6380 (container 6379)    |

The API runs Drizzle migrations on boot as well. Scalar is at http://localhost:3001/docs (`NODE_ENV=development`). Seed an admin user (`ADMIN_PASSWORD` is required):

```bash
ADMIN_PASSWORD='your-strong-password' pnpm db:seed
```

Drizzle Studio on the host: `pnpm db:studio`.

## Scripts

| Script                                   | What it does                                                        |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `pnpm docker:up`                         | `compose up -d --wait --remove-orphans` (creates `.env` if missing) |
| `pnpm docker:rebuild`                    | Pull Postgres/Redis images, then up                                 |
| `pnpm docker:reset`                      | `down -v` then up (wipes the Postgres volume)                       |
| `pnpm docker:down`                       | Stop and remove containers                                          |
| `pnpm docker:start` / `stop` / `restart` | Existing containers                                                 |

Migrate and seed on the host: `pnpm db:migrate`, `pnpm db:seed`.

## Images

| Service    | Image                | Notes                                                         |
| ---------- | -------------------- | ------------------------------------------------------------- |
| `postgres` | `postgres:18-alpine` | Volume `postgres_data`                                        |
| `redis`    | `redis:8-alpine`     | Host **6380** so it does not collide with local Redis on 6379 |

Host apps use the published ports (`localhost:5433`, `localhost:6380`). `.env.example` is already set that way. Change those only if Postgres or Redis is running natively on the default ports.

`docker/postgres-init/` runs on a **new** volume only. It creates `nuxt_app_db_test` for API tests.

The API rate-limits by client IP (Redis locally via Compose and in production on Upstash, in-memory in tests). The limiter uses the socket address unless `TRUST_PROXY` is set, in which case it keys on the first `X-Forwarded-For` hop. Only enable that when a reverse proxy overwrites the header.
