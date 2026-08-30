# API (`@nuxt-app/api`)

Hono server for auth, sessions, and the public HTTP API. Production host: `api.nuxt-app.com`. Local: http://localhost:3000.

Install and env live at the repo root. From the monorepo:

```bash
pnpm install
pnpm db:migrate
pnpm dev:api
```

Scalar (development only): http://localhost:3000/docs  
OpenAPI spec: http://localhost:3000/openapi.json

## Endpoints

| Method | Path                  | Description    |
| ------ | --------------------- | -------------- |
| GET    | `/`                   | Service status |
| GET    | `/health`             | Health check   |
| POST   | `/v1/auth/register`   | Create account |
| POST   | `/v1/auth/login`      | Login          |
| POST   | `/v1/auth/logout`     | Logout         |
| GET    | `/v1/auth/me`         | Current user   |
| GET    | `/v1/admin/dashboard` | Admin only     |

Sessions are an httpOnly cookie (`nuxt_app_session`), stored in Postgres, 7-day expiry. Production custom domains set `COOKIE_DOMAIN=.nuxt-app.com`. Local: `localhost`. Preview `*.vercel.app` hosts leave `COOKIE_DOMAIN` unset; app and admin call this API through a same-origin `/__api` proxy.

## Database

Drizzle schema: `src/db/schema/`. After editing it:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Migrations also run on API boot (`src/index.ts`) and on every Vercel API build (`pnpm db:migrate`). Preview must use its own database. See [VERCEL.md](../../VERCEL.md).

Create or promote an admin (`ADMIN_PASSWORD` is required). Optional: `ADMIN_EMAIL` (default `admin@nuxt-app.com`), `ADMIN_NAME`. If that email already exists, the password is reset and the user is promoted to admin.

```bash
ADMIN_PASSWORD='your-strong-password' pnpm db:ensure-admin
```

Or register, then:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## Tests

```bash
pnpm --filter @nuxt-app/api test
```

Tests live in `test/` and call the mounted Hono app via `app.request()` (no HTTP server). They use database `nuxt_app_db_test` on the same Postgres as `DATABASE_URL` (override with `DATABASE_URL_TEST`). Rate limiting uses an in-memory store (no Redis).

## Env

Loaded from the repo-root `.env`, then `apps/api/.env`. See `.env.example`.

| Var                                                             | Role                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                  | Pooled runtime Postgres                                                                           |
| `DATABASE_URL_UNPOOLED`                                         | Direct URL for migrations (required in production when `DATABASE_URL` is PgBouncer / Neon pooler) |
| `DATABASE_URL_TEST`                                             | Test database (defaults to `nuxt_app_db_test` on the same host)                                   |
| `REDIS_URL`                                                     | `redis://` locally, `rediss://` on Upstash                                                        |
| `COOKIE_DOMAIN`                                                 | Shared parent for app + admin cookies                                                             |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX` | Rate-limit knobs                                                                                  |
| `LOG_LEVEL`                                                     | pino (`silent` in tests)                                                                          |
| `TRUST_PROXY`                                                   | Use first `X-Forwarded-For` hop                                                                   |

Neon connection strings use `sslmode=verify-full`.

## Deploy

Vercel project `nuxt-app-api`. Entry is the `dist/vercel/app.js` bundle (not `tsc`). Details: [VERCEL.md](../../VERCEL.md). Local Postgres/Redis: [DOCKER.md](../../DOCKER.md).
