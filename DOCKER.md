# Docker

Full stack: Postgres, Redis, API, app, admin, web, and Drizzle Studio.

## Quick start

```bash
cp .env.example .env   # skipped if .env already exists (`predocker:up`)
pnpm docker:up
```

| Service        | URL                             |
| -------------- | ------------------------------- |
| App            | http://localhost:3000           |
| API            | http://localhost:3001           |
| Admin          | http://localhost:3002           |
| Web            | http://localhost:3003           |
| Drizzle Studio | http://127.0.0.1:4983           |
| Postgres       | localhost:5433 (container 5432) |
| Redis          | localhost:6380 (container 6379) |

The API runs Drizzle migrations on boot. Scalar is at http://localhost:3001/docs (`NODE_ENV=development`). Seed an admin user (`ADMIN_PASSWORD` is required):

```bash
ADMIN_PASSWORD='your-strong-password' pnpm docker:db:seed
```

## Scripts

| Script                                   | What it does                                       |
| ---------------------------------------- | -------------------------------------------------- |
| `pnpm docker:up`                         | `compose up -d --wait` (creates `.env` if missing) |
| `pnpm docker:rebuild`                    | Rebuild images, then up                            |
| `pnpm docker:reset`                      | `down -v` then rebuild (wipes the Postgres volume) |
| `pnpm docker:down`                       | Stop and remove containers                         |
| `pnpm docker:start` / `stop` / `restart` | Existing containers                                |
| `pnpm docker:db:migrate`                 | Migrate inside the `api` container                 |
| `pnpm docker:db:seed`                    | Seed inside the `api` container                    |

## Images

| Service               | Dockerfile               | Notes                                                         |
| --------------------- | ------------------------ | ------------------------------------------------------------- |
| `api`                 | `apps/api/Dockerfile`    | `development` target; `tsx watch` on bind-mounted source      |
| `drizzle-studio`      | `apps/api/Dockerfile`    | `development` target; schema bind-mounted                     |
| `app`, `admin`, `web` | `docker/Dockerfile.nuxt` | `development` target; `nuxt dev` on bind-mounted source       |
| `postgres`            | `postgres:18-alpine`     | Volume `postgres_data`                                        |
| `redis`               | `redis:8-alpine`         | Host **6380** so it does not collide with local Redis on 6379 |

Inside Compose, the API uses `postgres:5432` and `redis://redis:6379`. The host maps Postgres to **5433** and Redis to **6380**.

`docker/postgres-init/` runs on a **new** volume only. It creates `nuxt_app_db_test` for API tests.

## Host apps + Compose Postgres and Redis only

```bash
docker compose up postgres redis -d
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

`.env.example` already uses the published Compose ports (`localhost:5433` for Postgres, `localhost:6380` for Redis). Change those only if Postgres or Redis is running natively on the default ports.

The API rate-limits by client IP (Redis in Compose/production, in-memory in tests). The limiter uses the socket address unless `TRUST_PROXY` is set, in which case it keys on the first `X-Forwarded-For` hop. Only enable that when a reverse proxy overwrites the header.

Local Drizzle Studio (no container): `pnpm db:studio`.
