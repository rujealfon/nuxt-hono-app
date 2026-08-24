# Migrating Drizzle 0.45.x → 1.0

> **Status: draft, written against `drizzle-orm`/`drizzle-kit` 1.0.0-rc.5 and the official [v0 → v1 updates](https://orm.drizzle.team/docs/v0-v1-changes).** As of 2026-08-23 the stable release is still 0.45.x, and 1.0 is in release candidate. An RC can still change before it ships. Treat the installed package as the authority, and prefer 0.45.x guidance for any project that hasn't deliberately opted into the RC.

Drizzle 1.0 is the first release to break the schema-definition API in a way that silently changes generated SQL rather than producing a type error. The two changes that matter most — casing and relations — are covered first.

## Contents

- [Casing moved from config to table builders](#casing-moved-from-config-to-table-builders)
- [RQBv1 removed: `relations()` is gone](#rqbv1-removed-relations-is-gone)
- [`drizzle()` config shape changed](#drizzle-config-shape-changed)
- [Other breaking changes (easy to miss)](#other-breaking-changes-easy-to-miss)
- [Additive changes worth knowing](#additive-changes-worth-knowing)
- [Migration checklist](#migration-checklist)

## Casing moved from config to table builders

In 0.45.x, camelCase→snake_case column mapping was a single global setting, passed to `drizzle()` and to `drizzle.config.ts`:

```typescript
// 0.45.x — one global switch
const db = drizzle(client, { schema, casing: 'snake_case' });
```

In 1.0 that option no longer exists in either place. Casing is chosen per table by importing a casing-specific builder from `drizzle-orm/pg-core`:

```typescript
// 1.0 — casing is a property of the table
import { snakeCase, camelCase, pgTable, text, integer } from 'drizzle-orm/pg-core';

export const users = snakeCase.table('users', {
  firstName: text(),      // -> "first_name"
  userId: integer(),      // -> "user_id"
  explicit: text('kept_as_is'),  // explicit names always win
});
```

Verified behavior for a column declared without an explicit name:

| Builder | `firstName` becomes |
| --- | --- |
| `pgTable` | `firstName` (no transform) |
| `snakeCase.table` | `first_name` |
| `camelCase.table` | `firstName` |

An explicitly named column (`text('kept_as_is')`) is never transformed, under any builder.

`snakeCase` and `camelCase` each expose `.table`, `.view`, `.materializedView`, and `.schema` — so a whole schema can adopt one convention via `snakeCase.schema('app')`.

**Why this is the dangerous one:** a project that upgrades to 1.0 while leaving `casing: 'snake_case'` in its config loses the option silently. Every `pgTable` with unnamed columns starts emitting camelCase identifiers, which don't match the existing database. This surfaces as `column "firstName" does not exist` at runtime, not as a type error. When migrating, convert the tables *before* running anything against a real database, and diff a generated migration to confirm no column renames appear.

Note that `drizzle.config.ts` still has an `introspect.casing` option (`'camel' | 'preserve'`) — that is unrelated. It controls how `drizzle-kit pull` names properties in the TypeScript it generates, not how your schema maps to SQL.

### Column builders are single-use

Relevant when writing the migration mechanically: column builder objects are mutable and record their resolved name on first use. Sharing one column-definition object across two tables silently gives the second table the first table's naming:

```typescript
const cols = { firstName: text() };
pgTable('a', cols);          // "firstName"
snakeCase.table('b', cols);  // still "firstName" — the builder was already named
```

Build a fresh object per table (a factory function if the shape repeats).

## RQBv1 removed: `relations()` is gone

In 1.0, `relations` is no longer exported from `drizzle-orm` or `drizzle-orm/pg-core` — it is `undefined`, so legacy relation blocks fail at import. `defineRelations` is the only relations API.

```typescript
// 0.45.x — removed in 1.0
import { relations } from 'drizzle-orm';

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));
export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));
```

```typescript
// 1.0 — one block for the whole schema
import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, (r) => ({
  users: {
    posts: r.many.posts(),
  },
  posts: {
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
  },
}));
```

The shape differences that trip people up: `defineRelations` takes the whole schema and returns one object keyed by table (rather than one exported `relations()` call per table), and the field mapping is `from`/`to` rather than `fields`/`references`.

See [relations.md](relations.md) for the full `defineRelations` reference.

## `drizzle()` config shape changed

`DrizzleConfig` in 1.0 accepts:

```typescript
{
  logger?: boolean | Logger;
  relations?: TRelationConfigs;
  cache?: Cache;
  jit?: boolean;
}
```

Compared with 0.45.x: `casing` is gone (see above), the RQBv1 `schema` option is gone (`db.query` is wired through `relations` only), and `jit` is new — it toggles the just-in-time compiled row mappers (off by default; uses a `Function` constructor, so it stands down under CSP `jitless`).

## Other breaking changes (easy to miss)

These are smaller than casing/relations but will fail a 0.45.x → 1.0 mechanical upgrade if skipped. Source: [v0 → v1 updates](https://orm.drizzle.team/docs/v0-v1-changes).

- **`.array()` is no longer chainable.** Multidimensional arrays use string syntax: `column.array('[][]')`, not `column.array().array()`.
- **`.enableRLS()` is deprecated.** Use `pgTable.withRLS('users', { ... })` instead of `pgTable('users', { ... }).enableRLS()`. Adding a `pgPolicy(...)` still enables RLS on 0.45.x as documented in [postgres-advanced.md](postgres-advanced.md).
- **`.generatedAlwaysAs()` only accepts SQL.** Pass a `sql` template or a thunk returning one — a raw string is rejected.
- **`getTableColumns` is deprecated.** Use `getColumns` from `drizzle-orm`.
- **Migration folder v3.** No more `journal.json`. Each migration is a folder grouping SQL + snapshot. `drizzle-kit drop` is removed. `drizzle-kit up` upgrades the migration table (`name` + `applied_at` columns) and matches migrations by full folder name, not timestamp. The migrator now applies *every missing* migration, not only those newer than the last applied timestamp.
- **`schemaFilter` default is all schemas**, not just `public`. Glob patterns work (`['public', 'app_*']`). Omit the option to manage everything.
- **`drizzle-kit push --strict` is gone** — confirmation for data-loss statements is now the default. Preview with `drizzle-kit push --explain`; skip prompts with `--force`. `drizzle-kit check` is a commutativity check across migration branches; `--ignore-conflicts` bypasses it.

## Additive changes worth knowing

These don't break existing 0.45.x code, but they change what the best answer looks like on a 1.0 project. Check the installed types before relying on specifics.

- **Codecs** — driver-aware cast/normalize layer (regular SELECT, JSON/RQB context, INSERT params). Enabled by default per driver; override via `drizzle(client, { codecs: { ... } })`. Deep reference: [Codecs](https://orm.drizzle.team/docs/codecs).
- **SQL comments** — `.comment("tag")` or `.comment({ key: 'val' })` on select/insert/update/delete, appended as sqlcommenter. Must be applied *before* `.prepare()`. Deep reference: [SQL comments](https://orm.drizzle.team/docs/sql-comments).
- **JIT mappers** — `drizzle({ jit: true })`. Deep reference: [JIT mappers](https://orm.drizzle.team/docs/jit-mappers).
- **Drizzle Kit** — `push --explain`, `pull --init`, commutativity `check`, top-level `await` in config, tsx loader.
- **New drivers** — Netlify DB, Effect Postgres (`drizzle-orm/effect-postgres`), plus the MSSQL and CockroachDB dialects (out of this skill's Postgres scope).

## Migration checklist

1. Confirm the installed version actually is 1.0 (`node -p "require('drizzle-orm/package.json').version"`) — don't migrate a project still on 0.45.x.
2. Run `drizzle-kit up` so existing migration folders move to the v3 layout (no `journal.json`) before generating anything new.
3. Find every `casing` option in `drizzle()` calls and `drizzle.config.ts`. For each, decide the equivalent table builder; leaving the option in place is a silent no-op, not an error.
4. Convert `pgTable` → `snakeCase.table` (or `camelCase.table`) for every table that relied on the global setting. Check views, materialized views, and `pgSchema` too.
5. Replace every `relations()` block with a single `defineRelations(schema, ...)`, converting `fields`/`references` to `from`/`to`. Switch `drizzle({ schema })` to `drizzle({ relations })`.
6. Replace `.array().array()`, `.enableRLS()`, string `.generatedAlwaysAs(...)`, and `getTableColumns` as listed above. Switch `drizzle-zod` imports to `drizzle-orm/zod`.
7. Run `drizzle-kit generate` and **read the resulting SQL**. A correct schema conversion should be empty or contain only the changes you intended. Any unexpected `ALTER TABLE ... RENAME COLUMN` means a casing conversion was missed.
8. Run the project's typecheck, then exercise a query per converted table against a real database — casing mistakes are runtime errors, so typecheck alone will not catch them.
