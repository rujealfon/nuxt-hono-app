# Connecting to Postgres

Pick the driver that matches how the target actually runs — TCP-capable server vs. serverless/edge with no persistent TCP socket — rather than defaulting to whichever is most familiar. If a driver is already installed in the project, use that one.

## Don't exhaust `max_connections` in serverless/edge deployments

Postgres has a hard cap on concurrent connections (`max_connections`, often in the low hundreds). A long-running server opens one pool at startup and reuses it for the process lifetime, which is fine. A serverless function is different: if each invocation (or each cold start) creates a *new* `Pool`/`postgres()` client instead of reusing one, concurrent invocations under load can open far more connections than Postgres allows, and requests start failing with connection errors — this is one of the most common production incidents in serverless-Postgres setups, not a theoretical concern.

Two ways to avoid it:

1. **Reuse a module-level client.** Create the `Pool`/`postgres()` client once at module scope (outside the request handler) so warm invocations reuse it; only cold starts open a new connection. Pair with a small pool size (e.g. `max: 1`–`5` per function instance) since many function instances can run concurrently.
2. **Use an HTTP-based driver** that doesn't hold a persistent TCP connection at all — Neon's `neon-http` driver or `@vercel/postgres` issue each query as its own HTTP request, sidestepping the connection-limit problem entirely (at the cost of not supporting interactive `db.transaction()`; see the Neon section below). Prefer this for edge runtimes or Lambda functions with many concurrent instances, and fall back to a pooled TCP driver only when the workload needs real transactions.

If the target is a traditional long-running server or container, this isn't a concern — a single `Pool` created at startup and reused for the process lifetime is correct as shown below.

## node-postgres (`pg`) — traditional server/container deployments

```bash
npm i drizzle-orm pg
npm i -D drizzle-kit @types/pg
```

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(process.env.DATABASE_URL!);
```

With an existing `Pool` (needed for custom pool sizing, SSL config, etc.):

```typescript
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: true });
const db = drizzle({ client: pool });
```

## postgres.js — traditional server/container deployments, alternative driver

```bash
npm i drizzle-orm postgres
npm i -D drizzle-kit
```

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';

const db = drizzle(process.env.DATABASE_URL!);
```

postgres.js uses prepared statements by default. Behind a connection pooler running in transaction-pool mode (see Supabase below), disable them:

```typescript
import postgres from 'postgres';
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle({ client });
```

## Neon — serverless Postgres

```bash
npm i drizzle-orm @neondatabase/serverless
npm i -D drizzle-kit
```

Two drivers depending on workload:

```typescript
// neon-http: single isolated queries, works in edge runtimes without TCP/WebSocket
import { drizzle } from 'drizzle-orm/neon-http';
const db = drizzle(process.env.DATABASE_URL!);
```

```typescript
// neon-serverless: WebSocket-based pool, needed for interactive transactions / db.transaction()
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });
```

`neon-http` cannot run multi-statement interactive transactions (each call is its own HTTP request) — reach for `neon-serverless` if the code needs `db.transaction()`. In Node, `neon-serverless` also needs the `ws` package (`neonConfig.webSocketConstructor = ws`). In a traditional long-running server talking to Neon, plain `pg`/`postgres.js` also work over Neon's regular TCP endpoint.

## Supabase

Supabase is plain Postgres underneath, so any driver works, but its pooler mode matters:

```bash
npm i drizzle-orm postgres
npm i -D drizzle-kit
```

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
const db = drizzle(process.env.DATABASE_URL!);
```

- **Direct connection** — for long-running servers.
- **Connection pooler, transaction mode** — for serverless; requires `postgres(url, { prepare: false })` since prepared statements aren't supported in that mode.
- Supabase-specific RLS helpers (`authenticatedRole`, `authUsers`, `authUid()`) live in `drizzle-orm/supabase` — see [postgres-advanced.md](postgres-advanced.md).

## Vercel Postgres

```bash
npm i drizzle-orm @vercel/postgres
npm i -D drizzle-kit
```

```typescript
import { drizzle } from 'drizzle-orm/vercel-postgres';
const db = drizzle(); // reads POSTGRES_URL from env automatically
```

Built on `@vercel/postgres`'s serverless (WebSocket-based) driver — suitable for edge/serverless functions without TCP access.

## PGlite — embedded/in-memory Postgres (tests, local-first apps)

```bash
npm i drizzle-orm @electric-sql/pglite
npm i -D drizzle-kit
```

```typescript
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const client = new PGlite(); // or new PGlite('./local.db') for on-disk
const db = drizzle({ client });
```

Runs Postgres compiled to WASM with no separate server process — useful for unit/integration tests that want real Postgres semantics without a Docker container, or local-first apps.

## PlanetScale Postgres

PlanetScale Postgres is Postgres, not PlanetScale MySQL (`drizzle-orm/planetscale-serverless` is the MySQL driver — do not use it here).

Server/container: `drizzle-orm/node-postgres` with `pg`, same as above. Prefer port `6432` (PgBouncer) when many concurrent clients will share the cluster; `5432` is a direct connection counted against `max_connections`.

Serverless/edge: the Neon serverless driver works against PlanetScale Postgres **only** after overriding the Neon endpoints:

```typescript
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
const db = drizzle({ client: neon(process.env.DATABASE_URL!) });
```

WebSocket/`db.transaction()` uses `drizzle-orm/neon-serverless` and must disable Neon's default pipeline:

```typescript
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.pipelineConnect = false;
neonConfig.wsProxy = (host, port) => `${host}/v2?address=${host}:${port}`;
const db = drizzle({ client: new Pool({ connectionString: process.env.DATABASE_URL }) });
```

Official topic: [PlanetScale Postgres](https://orm.drizzle.team/docs/connect-planetscale-postgres).

## Prisma Postgres

No unique Drizzle driver. Use `drizzle-orm/node-postgres` or `drizzle-orm/postgres-js` against the Prisma Postgres connection string. Prisma's own serverless driver is not wired up in Drizzle yet.

## Bun SQL

Bun's native Postgres client, no extra driver package:

```typescript
import { drizzle } from 'drizzle-orm/bun-sql';
const db = drizzle(process.env.DATABASE_URL);
```

Or pass an existing `SQL` client: `drizzle({ client: new SQL(process.env.DATABASE_URL!) })`. Bun-only — do not import `drizzle-orm/bun-sql` from Node.

## Drizzle HTTP proxy

When queries must go through your own HTTP endpoint instead of a direct driver:

```typescript
import { drizzle } from 'drizzle-orm/pg-proxy';

const db = drizzle(async (sql, params, method) => {
  const rows = await fetch('/query', {
    method: 'POST',
    body: JSON.stringify({ sql, params, method }),
  }).then((r) => r.json());
  return { rows };
});
```

Return `{ rows: string[][] }` for `method === 'all'`, `{ rows: string[] }` for `execute`. Official topic: [Drizzle HTTP proxy](https://orm.drizzle.team/docs/connect-drizzle-proxy).

## Other providers (same shape, different package)

Xata and Nile follow the same `drizzle(...)` / `drizzle({ client })` shape as above. AWS Data API is `drizzle-orm/aws-data-api/pg` and takes `resourceArn` / `secretArn` / `database` instead of a URL. Netlify DB (`drizzle-orm/netlify-db`) and Effect Postgres (`drizzle-orm/effect-postgres`) are 1.0-line drivers — see [migration-0.45-to-1.0.md](migration-0.45-to-1.0.md).

## `db.execute` for anything outside the query builder

Every driver's `db` exposes `db.execute(sql\`...\`)` (or a plain string) for raw SQL that doesn't fit the builder — useful for one-off diagnostics or Postgres features not yet modeled by Drizzle.
