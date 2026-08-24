# Postgres-specific features

## Indexes and constraints

```typescript
import { index, uniqueIndex, unique, check, foreignKey, primaryKey } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slug: text().notNull(),
  age: integer(),
}, (table) => [
  index('author_idx').on(table.authorId),                 // plain index; index FKs used in joins/where
  uniqueIndex('slug_idx').on(table.slug),
  check('age_check', sql`${table.age} > 0`),
  unique('unique_name').on(table.authorId, table.slug).nullsNotDistinct(), // composite unique, PG15+
]);
```

Composite primary key:

```typescript
export const usersToGroups = pgTable('users_to_groups', {
  userId: integer('user_id').notNull().references(() => users.id),
  groupId: integer('group_id').notNull().references(() => groups.id),
}, (table) => [
  primaryKey({ columns: [table.userId, table.groupId] }),
]);
```

Composite/multi-column foreign key (when a single `.references()` isn't enough):

```typescript
foreignKey({
  columns: [table.userFirstName, table.userLastName],
  foreignColumns: [user.firstName, user.lastName],
}).onDelete('cascade')
```

Advanced index options: `.using('gist' | 'gin' | 'hnsw' | ...)`, `.concurrently()` (avoids locking the table during creation — use for migrations on live tables), `.where(sql\`...\`)` for partial indexes, column modifiers like `.asc()`/`.desc()`/`.nullsFirst()`/`.nullsLast()`.

## Views

```typescript
import { pgView, pgMaterializedView } from 'drizzle-orm/pg-core';

export const customersView = pgView('customers_view').as((qb) =>
  qb.select().from(users).where(eq(users.role, 'customer'))
);

// Materialized: persisted like a table, must be refreshed explicitly
export const newYorkers = pgMaterializedView('new_yorkers').as((qb) =>
  qb.select().from(users).where(eq(users.cityId, 1))
);
await db.refreshMaterializedView(newYorkers);
await db.refreshMaterializedView(newYorkers).concurrently();

// Mapping an existing view Drizzle shouldn't try to create/alter via migrations:
export const trimmedUser = pgView('trimmed_user', {
  id: serial('id'),
  name: text('name'),
}).existing();
```

## Generated columns

```typescript
export const docs = pgTable('docs', {
  content: text('content'),
  contentSearch: tsVector('content_search').generatedAlwaysAs(
    (): SQL => sql`to_tsvector('english', ${docs.content})`
  ),
});
```

Stored (computed on write, indexable). Cannot have a separate `.default()`, cannot reference other generated columns, and cannot be part of a primary/foreign key or unique constraint.

## Custom column types

```typescript
import { customType } from 'drizzle-orm/pg-core';

const customTimestamp = customType<{ data: Date; driverData: string }>({
  dataType() { return 'timestamp'; },
  fromDriver(value: string): Date { return new Date(value); },
});
```

Use when a Postgres type has no built-in Drizzle column builder, or when the driver's raw representation needs a custom JS transform.

## Row-Level Security (RLS)

```typescript
import { pgPolicy, pgRole, pgTable, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const admin = pgRole('admin', { createRole: true, inherit: true });

export const documents = pgTable('documents', {
  id: integer().primaryKey(),
  ownerId: integer('owner_id'),
}, () => [
  pgPolicy('owner-can-modify', {
    as: 'permissive',       // or 'restrictive'
    to: admin,               // role, 'public', 'current_user', or a pgRole
    for: 'all',               // 'all' | 'select' | 'insert' | 'update' | 'delete'
    using: sql`owner_id = current_user_id()`,   // read-side condition
    withCheck: sql`owner_id = current_user_id()`, // write-side condition
  }),
]);
```

Adding a policy enables RLS on the table automatically. Enable `entities: { roles: true }` in `drizzle.config.ts` so Drizzle Kit manages role DDL alongside tables. On 1.0, `pgTable(...).enableRLS()` is deprecated in favour of `pgTable.withRLS(...)` — see [migration-0.45-to-1.0.md](migration-0.45-to-1.0.md).

**Neon**: `import { crudPolicy, authenticatedRole, authUid } from 'drizzle-orm/neon'` — `crudPolicy({ role: authenticatedRole, read: true, modify: false })` generates the CRUD policies for you.

**Supabase**: `import { authenticatedRole, authUsers, authUid } from 'drizzle-orm/supabase'` — `authUsers` lets you `.references()` Supabase's built-in `auth.users` table; `authUid()` is the Postgres-side helper for `auth.uid()` checks.

## Sequences

```typescript
import { pgSequence } from 'drizzle-orm/pg-core';

export const orderNumberSeq = pgSequence('order_number_seq', {
  startWith: 1000, increment: 1, minValue: 1000, maxValue: 999999, cache: 10, cycle: false,
});
```

Reach for a standalone sequence when a value needs to be unique/sequential but isn't a table's primary key (e.g. a human-facing order number); for primary keys, prefer `.generatedAlwaysAsIdentity()` (see [schema.md](schema.md)), which manages its own sequence implicitly.

## Extensions: pgvector and PostGIS

Both require the extension already installed on the database (`CREATE EXTENSION vector;` / `CREATE EXTENSION postgis;` — Drizzle Kit doesn't do this for you).

```typescript
import { vector, index } from 'drizzle-orm/pg-core';
import { l2Distance, cosineDistance } from 'drizzle-orm';

export const items = pgTable('items', {
  embedding: vector({ dimensions: 3 }),
}, (table) => [
  index('embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

// nearest-neighbor search
await db.select().from(items).orderBy(cosineDistance(items.embedding, queryVector)).limit(5);
```

```typescript
import { geometry } from 'drizzle-orm/pg-core';

export const locations = pgTable('locations', {
  point: geometry('point', { type: 'point', mode: 'xy', srid: 4326 }),
});
```

## Query cache (0.45.x+)

`upstashCache` ships in 0.45.x (`drizzle-orm/cache/upstash`). It is **opt-in** (`global: false` by default): enable per query with `.$withCache()`, or pass `global: true` when wrapping `drizzle()`. It does not apply inside transactions, `db.execute`, or the relational query API.

```typescript
import { upstashCache } from 'drizzle-orm/cache/upstash';

const db = drizzle(process.env.DATABASE_URL!, {
  cache: upstashCache({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! }),
});

await db.select().from(users).$withCache();
await db.$cache.invalidate({ tables: [users] });
```

Official topic: [Cache](https://orm.drizzle.team/docs/cache).

## Batch API and read replicas

Some serverless drivers (e.g. Neon HTTP) expose `db.batch([...queries])` to send multiple independent queries in one round trip — check whether the connected driver supports it before relying on it; it's not universal across all Postgres drivers the way `db.transaction()` is.

`drizzle-orm` supports routing reads to replicas via `withReplicas(primaryDb, [replicaDb1, replicaDb2])` from `drizzle-orm/pg-core`, giving you `.$primary` for writes and automatic replica selection for reads — useful once a project has actual read-replica infrastructure, not something to introduce speculatively.

## Validation integration (Zod)

On **0.45.x** the helpers live in the standalone `drizzle-zod` package (`npm i drizzle-zod`). On **1.0** they moved into `drizzle-orm/zod` (and `drizzle-orm/valibot`, `drizzle-orm/typebox`, etc.) — see [migration-0.45-to-1.0.md](migration-0.45-to-1.0.md).

```typescript
// 0.45.x
import { createSelectSchema, createInsertSchema, createUpdateSchema } from 'drizzle-zod';
// 1.0
// import { createSelectSchema, createInsertSchema, createUpdateSchema } from 'drizzle-orm/zod';

const insertUserSchema = createInsertSchema(users, {
  email: (schema) => schema.email(), // refine/override a specific field's Zod schema
});

const newUser = insertUserSchema.parse(req.body);
```

`createInsertSchema` requires columns without defaults, makes defaulted/nullable columns optional; `createUpdateSchema` makes every column optional (for `PATCH`-style partial updates); `createSelectSchema` matches what a `select()` returns. Equivalent helpers exist for Valibot, TypeBox, ArkType (and on 1.0, Effect Schema).
