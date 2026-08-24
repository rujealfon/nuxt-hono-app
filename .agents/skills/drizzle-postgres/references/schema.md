# Schema declaration (PostgreSQL)

## Basic table

```typescript
import { pgTable, integer, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  email: text().notNull().unique(),
  isActive: boolean().default(true),
  createdAt: timestamp().defaultNow().notNull(),
});
```

Column builders can be called with or without an explicit DB column name (`text('full_name')` vs `text()`, which derives the name from the property). An explicit name is always used verbatim; how an *unnamed* column is derived depends on the installed version:

- **0.45.x** — the global `casing: "snake_case"` option, set on `drizzle()` and in `drizzle.config.ts`. Unset means the property name is used as-is (camelCase).
- **1.0** — the global option is gone. Casing is per table: `snakeCase.table(...)` / `camelCase.table(...)` from `drizzle-orm/pg-core`, while plain `pgTable` applies no transform. See [migration-0.45-to-1.0.md](migration-0.45-to-1.0.md).

Match whatever convention the project already uses — check existing tables and, on 0.45.x, `drizzle.config.ts`'s `casing` option before picking one.

## Column type builders

**Numeric**
- `integer()`, `smallint()`, `bigint({ mode: 'number' | 'bigint' })` — signed integers (4/2/8 bytes)
- `serial()`, `smallserial()`, `bigserial({ mode })` — legacy auto-increment; prefer `.generatedAlwaysAsIdentity()` on `integer()`/`bigint()` for new schemas
- `numeric({ precision, scale })` / `decimal(...)` — exact decimals
- `real()`, `doublePrecision()` — floating point

**Text**
- `text()` — unlimited length
- `varchar({ length })` — bounded length
- `char({ length })` — fixed length, blank-padded
- Postgres arrays: `text().array()`, `integer().array()` — chain `.array()` on a column builder. On 1.0, multidimensional arrays use `column.array('[][]')` instead of `.array().array()`; see [migration-0.45-to-1.0.md](migration-0.45-to-1.0.md).

**Other scalars**
- `boolean()`
- `uuid()` — pair with `.defaultRandom()` for server-generated UUIDs
- `json()` / `jsonb()` — use `.$type<T>()` to attach a TS shape, e.g. `jsonb().$type<{ tags: string[] }>()`
- `date()`, `time()`, `timestamp({ withTimezone, mode: 'date' | 'string', precision })`, `interval()`
- `bytea()` — binary data
- `inet()`, `cidr()`, `macaddr()`, `macaddr8()` — network types
- `point({ mode: 'tuple' | 'xy' })`, `line({ mode: 'tuple' | 'abc' })` — geometric types

**Enums**

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'editor', 'viewer']);

export const users = pgTable('users', {
  role: roleEnum().default('viewer').notNull(),
});
```

## Identity columns vs serial

`serial`/`bigserial` create an implicit sequence and are the historical default, but Postgres itself recommends identity columns going forward:

```typescript
id: integer().primaryKey().generatedAlwaysAsIdentity(),
// or, allowing manual override on insert:
id: integer().primaryKey().generatedByDefaultAsIdentity(),
```

Only introduce `serial` into a new schema if the rest of the project already relies on it — don't mix conventions within one table set without a reason.

## Integer identity vs UUID primary keys

Both are fine defaults; the tradeoff is real, so pick deliberately rather than reaching for UUID out of habit:

- **Integer identity** (`generatedAlwaysAsIdentity()`) — smaller (4/8 bytes), sequential inserts stay index-locality-friendly (better `btree` cache behavior on the PK index at scale), but the value is guessable/enumerable and leaks row count, and it's server-generated so the caller doesn't know the id until after insert.
- **`uuid().defaultRandom()`** — safe to expose in URLs/APIs, generatable client-side before insert (useful for offline-first or optimistic UI), merges cleanly across distributed/sharded writers — but random UUIDs (v4) fragment the PK index's insert locality, which matters for very large, high-write tables. `uuid_generate_v7`-style time-ordered UUIDs (via a custom default or extension) avoid that fragmentation if UUIDs are required at scale.

Default to integer identity for typical CRUD apps; reach for UUID when IDs need to be public-safe, client-generated, or merged across independent write sources.

## Defaults and runtime value generation

```typescript
createdAt: timestamp().defaultNow(),
id: uuid().defaultRandom(),
slug: text().$defaultFn(() => generateSlug()),      // computed in JS at insert time
updatedAt: timestamp().$onUpdateFn(() => new Date()), // recomputed in JS on every update
```

`.default()` and `.defaultRandom()` push a literal/expression into the SQL default; `$defaultFn`/`$onUpdateFn` run in the JS driver instead — pick the SQL-side default when other writers (raw SQL, another service) also insert into the table.

## Schemas (Postgres `SCHEMA`, not to be confused with the Drizzle "schema file")

```typescript
import { pgSchema } from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('auth');

export const authUsers = authSchema.table('users', {
  id: uuid().primaryKey(),
});
```

Use `pgSchema` when the project organizes tables under non-`public` Postgres schemas (common with Supabase's `auth`/`storage` schemas, or multi-tenant setups).

## Type inference

```typescript
type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;
```

Prefer these over hand-written interfaces — they stay in sync with the schema automatically, including which columns are optional on insert (have defaults) vs required.
