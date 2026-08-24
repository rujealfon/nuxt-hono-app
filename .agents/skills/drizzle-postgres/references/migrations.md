# Drizzle Kit: config, migrations, seeding (PostgreSQL)

## `drizzle.config.ts`

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',       // or a glob: './src/schema/*'
  out: './drizzle',                 // migration output dir, defaults to "drizzle"
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,                    // print SQL during `push`
  strict: true,                     // confirm destructive changes before `push`
  casing: 'snake_case',             // 0.45.x only — JS camelCase -> DB snake_case column mapping.
                                    // Removed in 1.0; use snakeCase.table(...) per table instead.
  migrations: {
    table: '__drizzle_migrations',  // defaults shown
    schema: 'drizzle',
  },
});
```

`dbCredentials` also accepts discrete `host`/`port`/`user`/`password`/`database`/`ssl` fields instead of a single `url` — use whichever the project's secret management already provides.

## Commands and when to use each

| Command | What it does |
|---|---|
| `drizzle-kit generate` | Diffs the schema file against the last migration snapshot and writes a new SQL migration file under `out`. |
| `drizzle-kit migrate` | Applies pending SQL migration files to the database in order, recording each in the migrations table. |
| `drizzle-kit push` | Diffs the schema file against the live database and applies changes directly — no migration file produced. |
| `drizzle-kit pull` | Introspects an existing database and generates a Drizzle schema file from it (for onboarding onto an existing DB). |
| `drizzle-kit check` | Validates that migration files don't have colliding/out-of-order changes (e.g. after a branch merge). |
| `drizzle-kit up` | Upgrades old migration snapshot files to the current snapshot format after a Drizzle Kit version bump. |
| `drizzle-kit studio` | Opens Drizzle Studio, a local GUI for browsing/editing the connected database. |
| `drizzle-kit export` | Prints the schema's DDL as raw SQL without writing a migration file. |

**`push` vs `generate` + `migrate`:** `push` is fast and convenient for local development or early prototyping where there's no need to track history. For anything shared across a team, deployed to production, or that needs an audit trail / rollback path, use `generate` then `migrate` (or apply the generated SQL through whatever migration runner the deployment pipeline uses) — versioned SQL files are reviewable in a PR the way a direct `push` is not.

## Applying migrations at runtime (not via CLI)

```typescript
import { migrate } from 'drizzle-orm/node-postgres/migrator';

await migrate(db, { migrationsFolder: './drizzle' });
```

Every `drizzle-orm/<driver>` package ships a matching `.../migrator` entry point — use the one matching the driver already in use (e.g. `drizzle-orm/postgres-js/migrator`, `drizzle-orm/neon-http/migrator`).

## Custom (hand-written) migrations

For DDL Drizzle Kit can't express yet, or for data migrations/seed inserts that belong in migration history:

```bash
drizzle-kit generate --custom --name=seed-initial-roles
```

This creates an empty SQL file in `out` — write the SQL by hand, then apply it the same way as generated migrations (`drizzle-kit migrate`, or the runtime `migrate()` call). It gets tracked in the journal like any other migration.

## Seeding with `drizzle-seed`

For deterministic fake data (tests, local dev), rather than hand-written custom migrations:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { seed } from 'drizzle-seed';
import { users, posts } from './schema';

const db = drizzle(process.env.DATABASE_URL!);
await seed(db, { users, posts }); // 10 rows per table by default
```

`seed()` accepts a `count` option per call and a `seed` number for reproducible-but-different datasets; `.refine()` on a per-table basis customizes column-level generation (e.g. realistic emails) and can wire up related row counts for foreign keys. Install with `npm i drizzle-seed`. This is meant for dev/test fixtures, not production seed data that must exactly match business rules — use a custom migration for that instead.
