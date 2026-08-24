# Changelog

Versions here track this skill's own content (instructions and references), not the `drizzle-orm`/`drizzle-kit` package versions — see the [README](README.md#version) for which lines this skill was last verified against.

## 1.1.0 - 2026-08-23

Docs-backed refresh against official Postgres docs and `drizzle-orm`/`drizzle-kit` 1.0.0-rc.5. 0.45.x remains the primary target.

- Expand 1.0 notes (now matching [v0 → v1 updates](https://orm.drizzle.team/docs/v0-v1-changes)): `.array()` string syntax, `pgTable.withRLS()`, SQL-only `.generatedAlwaysAs()`, `getColumns`, migration folder v3, `schemaFilter` default, `push --explain` / `check` commutativity; point at codecs, SQL comments, and JIT pages instead of restating them.
- Named Postgres drivers: PlanetScale Postgres (Neon endpoint overrides), Prisma Postgres (use `pg`/`postgres.js`), Bun SQL, HTTP proxy.
- 0.45.x corrections: `drizzle-zod` (not `drizzle-orm/zod`), `.nullsNotDistinct()`, `upstashCache`, `text().array()`, Neon `ws` constructor.
- Fix SKILL.md typo `CockroachCB` → `CockroachDB`; add `/drizzle-postgres` trigger; point leftover official-docs links at the Postgres docs, not the dialect-generic overview.

Won't add: ESLint plugin, drizzle-graphql, Effect Postgres / Netlify DB as 0.45.x drivers, kit web/mobile.

## 1.0.0 - 2026-08-22

Initial versioned release. Covers schema definition, both the legacy `relations()` and newer `defineRelations()` relational APIs, queries, migrations, connections, and Postgres-specific features (indexes, RLS, extensions, etc.). Verified against `drizzle-orm` 0.45.2 / `drizzle-kit` 0.31.10.
