---
name: drizzle-postgres
description: Build, review, migrate, and troubleshoot PostgreSQL data layers with Drizzle ORM and Drizzle Kit. Use when defining a Postgres schema with pgTable, writing Drizzle queries (select/insert/update/delete, joins, db.query), setting up drizzle.config.ts, running drizzle-kit generate/migrate/push/pull/studio, wiring a Postgres driver (pg, postgres.js, Neon, Supabase, PGlite, PlanetScale Postgres, Bun SQL), adding indexes/constraints/relations, or debugging Drizzle/Postgres errors — even if they just say "add a table" or "write a migration." Use when the user runs /drizzle-postgres. PostgreSQL only; for MySQL, SQLite, MSSQL, SingleStore, or CockroachDB, rely on general Drizzle knowledge.
---

# Drizzle ORM (PostgreSQL)

Drizzle's API differs meaningfully between versions. The relations API changed from `relations()`/`one()`/`many()` to `defineRelations()`/`r.one`/`r.many`, and Drizzle 1.0 (in release candidate as of 2026-08-22, with 0.45.x still stable) removes the legacy `relations()` export entirely and moves camelCase→snake_case mapping from a global config option to per-table builders. Treat the target project's installed `drizzle-orm` and `drizzle-kit` versions and local type declarations as the source of truth; use the references below as a curated starting point, not a substitute for checking what's actually installed.

## Start from the project

1. Check `package.json`/lockfile for the installed `drizzle-orm` and `drizzle-kit` versions, and which Postgres driver package is present (`pg`, `postgres`, `@neondatabase/serverless`, `@vercel/postgres`, `@electric-sql/pglite`, etc.).
2. Read the existing schema file(s), `drizzle.config.ts`, and any existing migrations to match the project's conventions (file layout, naming, camelCase vs snake_case column mapping, single-file vs `schema/` directory).
3. Grep `node_modules/drizzle-orm/pg-core` or the package's type declarations when unsure whether a given API (e.g. `defineRelations`, `.generatedAlwaysAsIdentity()`, `pgTable.withRLS()`) exists in the installed version before using it.
4. Preserve the project's organization unless the task explicitly asks for a refactor.

## Read the relevant reference

- [references/schema.md](references/schema.md) — `pgTable`, column type builders, defaults, `pgSchema`, and choosing between `serial` and identity columns.
- [references/relations.md](references/relations.md) — declaring relations (both the legacy `relations()`/`one()`/`many()` API and the newer `defineRelations()`/`r.one`/`r.many` API) and querying them with `db.query`.
- [references/queries.md](references/queries.md) — select/insert/update/delete, operators, joins, transactions, set operations, dynamic query building.
- [references/migrations.md](references/migrations.md) — `drizzle.config.ts`, Drizzle Kit commands (`generate`, `migrate`, `push`, `pull`, `check`, `studio`, `export`), custom SQL migrations, seeding.
- [references/connections.md](references/connections.md) — driver setup for node-postgres, postgres.js, Neon, Supabase, Vercel Postgres, PGlite, PlanetScale Postgres, Bun SQL, HTTP proxy, and other providers.
- [references/postgres-advanced.md](references/postgres-advanced.md) — indexes/constraints, views, generated columns, custom types, RLS, sequences, extensions (pgvector/PostGIS), query cache, batch API, read replicas, and Zod/Valibot validation integration.
- [references/migration-0.45-to-1.0.md](references/migration-0.45-to-1.0.md) — the 0.45.x → 1.0 breaking changes (casing moved to table builders, `relations()` removed, `drizzle()` config shape) with before/after code and a migration checklist. Read this whenever a project is on the 1.0 RC, or when guidance that works on 0.45.x appears to have no effect.

These are condensed and curated, not full copies of the upstream docs. For behavior not covered here or that looks version-sensitive, check the installed package or the [official Postgres docs](https://orm.drizzle.team/docs/get-started-postgresql) and note which version you followed.

## Implement deliberately

- Default to `pgTable` with explicit column names only when they need to differ from the camelCase JS property. How unnamed columns get mapped is version-dependent: on 0.45.x it's the global `casing: "snake_case"` option (in `drizzle()` and `drizzle.config.ts`); on 1.0 that option is gone and casing is chosen per table via `snakeCase.table(...)`/`camelCase.table(...)` from `drizzle-orm/pg-core`. Match whatever the project already does, and see [references/migration-0.45-to-1.0.md](references/migration-0.45-to-1.0.md) if the two are mixed — a leftover `casing` option on 1.0 is a silent no-op that changes emitted SQL.
- Add a foreign key with `.references()` at the column level for simple cases; use `foreignKey()` in the table's second argument for composite or self-referential keys.
- Index columns used in `where`/`join`/`orderBy` conditions, especially foreign keys — Postgres does not auto-index them.
- Prefer `generatedAlwaysAsIdentity()` for new auto-incrementing primary keys over `serial` (Postgres's own recommendation); keep `serial` only when matching an existing schema's convention.
- Wrap multi-statement writes that must succeed or fail together in `db.transaction()`, not several sequential calls. Keep transaction bodies to database calls only — an external API call or other slow I/O inside `db.transaction()` holds Postgres locks for the duration, which can stall or deadlock unrelated queries.
- Use the relational query API (`db.query.<table>.findMany/findFirst`) when the caller wants nested related data; use the core query builder (`db.select().from().leftJoin()`) when the caller needs a flat/aggregated result or fine-grained SQL control.
- Reach for `drizzle-kit push` only in local/prototype workflows; for anything shared or production-bound, use `generate` + `migrate` so schema changes are versioned SQL files that get reviewed.
- In serverless/edge deployments (Lambda, Vercel functions, Cloudflare Workers), don't create a fresh `pg.Pool`/`postgres()` client per invocation — each cold start opening its own pool is a common way to exhaust Postgres's `max_connections` under load. Reuse a module-level client across invocations, or use an HTTP/serverless-native driver (Neon HTTP, `@vercel/postgres`) that doesn't hold a persistent connection at all. See [references/connections.md](references/connections.md).
- Batch multiple rows into one `db.insert(table).values([...])` call instead of looping individual inserts — it's one round trip instead of N.

## Verify the result

- Run `drizzle-kit check` after `generate` to confirm the migration doesn't collide with another branch's migration history.
- Read the generated SQL migration file before applying it — confirm it does what's intended (e.g. a column rename wasn't generated as drop+add, which would lose data).
- Typecheck: Drizzle infers row/insert types from the schema, so a schema or query mistake usually surfaces as a TypeScript error at the call site — run the project's typecheck rather than assuming it compiles.
- For query changes, exercise the empty-result, single-row, and multi-row cases, and confirm `where` conditions use the intended AND/OR grouping (a common mistake when mixing `and()`/`or()`).
- For transactions, verify the rollback path (e.g. force the failure condition) in addition to the happy path.
