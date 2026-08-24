# Relations and the relational query API

Drizzle has two generations of the relations API. **Check which one is installed before writing code** — mixing them produces confusing type errors, not runtime errors, so it's easy to silently write code against the wrong API:

- If the project imports `relations` from `'drizzle-orm'` and calls `one(...)`/`many(...)` inside it, or if `drizzle-orm/pg-core`'s installed version predates the `defineRelations` export, use the **legacy API** below — this is what almost all Drizzle codebases in production use today.
- If `defineRelations` is exported from `'drizzle-orm'` (check `node_modules/drizzle-orm/index.d.ts` or the project's own schema file) and the project already uses it, use the **new API**. Only introduce the new API into an existing project if asked to migrate; don't mix the two relation-declaration styles in one schema.

**On Drizzle 1.0 the choice is made for you:** `relations` is no longer exported at all, so the legacy API below is dead code there and `defineRelations` is the only option. The legacy section remains because 0.45.x is still the stable release. See [migration-0.45-to-1.0.md](migration-0.45-to-1.0.md) for converting between them.

Either way, relations are declared **separately from foreign keys**. A `.references()` foreign key alone does not give you `db.query` support — you also need a `relations`/`defineRelations` block, and both need to be passed into `drizzle()` via the `schema`/`relations` option for `db.query` to exist at all.

## Legacy API: `relations()` + `one()` / `many()`

```typescript
import { relations } from 'drizzle-orm';

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

Many-to-many needs an explicit junction table with a relation on both sides through it:

```typescript
export const usersToGroupsRelations = relations(usersToGroups, ({ one }) => ({
  user: one(users, { fields: [usersToGroups.userId], references: [users.id] }),
  group: one(groups, { fields: [usersToGroups.groupId], references: [groups.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  usersToGroups: many(usersToGroups),
}));
```
(The client then walks `usersToGroups` to get to `group`, since Drizzle's legacy relations API doesn't collapse the junction table automatically.)

Wire it up:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const db = drizzle(process.env.DATABASE_URL!, { schema });
```

Query with `db.query`:

```typescript
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true },
  where: (users, { eq }) => eq(users.id, 1),
  orderBy: (users, { asc }) => [asc(users.id)],
  columns: { id: true, name: true },
});

const post = await db.query.posts.findFirst({
  with: { author: true, comments: { with: { author: true } } },
});
```

`where`/`orderBy` callbacks receive the table's columns and the operator set as arguments — this is different from the core query builder, which imports operators (`eq`, `and`, ...) directly from `'drizzle-orm'`.

## New API: `defineRelations()` + `r.one` / `r.many`

```typescript
import { defineRelations } from 'drizzle-orm';

export const relations = defineRelations({ users, posts }, (r) => ({
  posts: {
    author: r.one.users({ from: r.posts.authorId, to: r.users.id }),
  },
  users: {
    posts: r.many.posts(),
  },
}));
```

Many-to-many uses `.through()` and does **not** require a separate relation declaration for the junction table — querying `users.groups` returns `groups` directly:

```typescript
export const relations = defineRelations({ users, groups, usersToGroups }, (r) => ({
  users: {
    groups: r.many.groups({
      from: r.users.id.through(r.usersToGroups.userId),
      to: r.groups.id.through(r.usersToGroups.groupId),
    }),
  },
}));
```

Wire it up (note: `relations` goes in its own option, not folded into `schema`):

```typescript
const db = drizzle(process.env.DATABASE_URL!, { relations });
```

Query with `db.query` — `where`/`orderBy` take plain objects instead of callbacks:

```typescript
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true },
  where: { id: 1 },
  orderBy: { id: 'asc' },
});

const posts = await db.query.posts.findMany({
  where: { comments: { createdAt: { lt: new Date() } } }, // filter through a relation
  with: { comments: { limit: 3, with: { author: true } } },
});
```

## Choosing `db.query` vs the core query builder

Use `db.query.<table>.findMany/findFirst` when the caller wants nested related rows shaped as JS objects/arrays (e.g. "a user with their posts"). Use `db.select().from().leftJoin(...)` from [queries.md](queries.md) when the result needs to be flat, aggregated, or otherwise doesn't map cleanly onto the relation tree — the relational API always issues one query per relation level under the hood (or a single query with JSON aggregation, depending on driver), which is not what you want for arbitrary joins.
