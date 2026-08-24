# Queries

Use this reference for query design, keys, reusable definitions, pagination, and query-state rendering. Confirm exact option and return types against the installed `@pinia/colada` declarations.

## Contents

- [Basic query](#basic-query)
- [Reactive inputs and keys](#reactive-inputs-and-keys)
- [Query metadata](#query-metadata)
- [Error typing](#error-typing)
- [Freshness and lifetime](#freshness-and-lifetime)
- [Placeholder and paginated data](#placeholder-and-paginated-data)
- [Reusable queries](#reusable-queries)
- [Cancellation](#cancellation)

## Basic query

Use queries for asynchronous reads:

```ts
import { useQuery } from '@pinia/colada'

const {
  state,
  data,
  error,
  status,
  asyncStatus,
  refresh,
  refetch,
} = useQuery({
  key: ['todos'],
  query: () => api.todos.list(),
})
```

- `state.status` describes the cached data: `pending`, `success`, or `error`. `isPending` is `status === 'pending'`.
- `asyncStatus` describes current work: `idle` or `loading`. `isLoading` is `asyncStatus === 'loading'` (TanStack's `isFetching`, not TanStack's `isLoading`).
- Existing data can remain available while a background refresh is loading or fails.
- `refresh()` deduplicates work and respects freshness.
- `refetch()` forces a new request regardless of freshness.
- Use the grouped `state` discriminated union when TypeScript must narrow `data` or `error`.

Throw or reject from the query function for Pinia Colada to enter an error state. Native `fetch()` does not reject on HTTP 4xx/5xx, so check `response.ok` unless non-success responses intentionally belong in `data`. When a refetch fails, `error` is set **and previous `data` is kept** — show stale data plus an error banner rather than blanking the UI.

The query function is called as `query({ signal, entry })`. `signal` is an `AbortSignal` aborted when a newer request for the same key starts or when the cache cancels the entry. Pass it through:

```ts
query: ({ signal }) => fetch(`/api/todos`, { signal }).then((r) => {
  if (!r.ok) throw new Error(r.statusText)
  return r.json()
})
```

## Reactive inputs and keys

Put every value used by the query function into the key. Use a getter when any segment is reactive:

```ts
const route = useRoute()

const contact = useQuery({
  key: () => ['contacts', route.params.id as string],
  query: () => api.contacts.get(route.params.id as string),
  enabled: () => typeof route.params.id === 'string',
})
```

Keys must be non-empty, serializable arrays. Structure them from broad to specific so prefix matching is useful. Object property order does not change key identity, but array order and primitive types do.

Include user, tenant, locale, permission scope, or other identity dimensions in authenticated query keys whenever the same app/cache can change that context. Do this even when the API client applies identity implicitly. Clear or invalidate identity-bound entries during context changes; persistence partitioning does not isolate the in-memory query cache.

Create key factories and reusable options once a project has more than a few queries:

```ts
import { defineQueryOptions } from '@pinia/colada'

export const contactKeys = {
  root: ['contacts'] as const,
  list: (filters: ContactFilters) =>
    [...contactKeys.root, 'list', filters] as const,
  detail: (id: string) => [...contactKeys.root, 'detail', id] as const,
}

export const contactQuery = defineQueryOptions((id: string) => ({
  key: contactKeys.detail(id),
  query: () => api.contacts.get(id),
}))
```

Consume dynamic options through a getter when their inputs are reactive:

```ts
const result = useQuery(() => contactQuery(route.params.id as string))
```

Do not mechanically refactor a small project solely to introduce factories. Preserve an established key convention when it is already consistent and safe.

## Query metadata

Use `meta` for declarative information that global hooks or plugins need, not for reactive component state:

```ts
useQuery({
  key: contactKeys.detail(id),
  query: () => api.contacts.get(id),
  meta: {
    errorMessage: 'Unable to load this contact',
    auditArea: 'contacts',
  },
})
```

Keep metadata serializable when another integration may persist or inspect it. Augment Pinia Colada's query-meta type only when the installed version exposes a supported augmentation interface; verify its exact name in local declarations. Keep UI-local side effects in the component and cross-cutting effects in the query-hooks plugin.

## Error typing

Pinia Colada uses `Error` as the default error type. Set a project-wide type through supported module augmentation:

```ts
import '@pinia/colada'

declare module '@pinia/colada' {
  interface TypesConfig {
    defaultError: unknown
  }
}
```

Prefer `unknown` when callers must narrow every thrown value, or use the application's shared error base type. Use the grouped `state` discriminated union to narrow `data` and `error` from `status`. Errors cannot be made reliable merely through a TypeScript assertion; ensure API clients actually throw the modeled values.

## Freshness and lifetime

- `staleTime` controls how long successful data is fresh.
- `gcTime` controls how long an inactive cache entry remains before collection.
- `enabled` pauses automatic fetching; use it when required inputs are absent or a query must not run during SSR.
- Prefer `refresh()` for normal lifecycle refreshes and `refetch()` for explicit force-refresh UX.
- Avoid putting long-lived `useQuery()` calls in stores unless intentional. A store may keep a query active indefinitely; read the cache from the store when lifecycle ownership should stay with components.

Inspect installed types before assuming option defaults because defaults can change between versions.

## Placeholder and paginated data

For numbered pagination, include the page and filters in the key so each page is independently cached:

```ts
useQuery({
  key: () => ['contacts', 'page', page.value],
  query: () => api.contacts.page(page.value),
  placeholderData: (previousData) => previousData,
})
```

Treat placeholder data as display continuity, not confirmed data for the new key. Use `isPlaceholderData` when controls or messaging depend on that distinction. `initialData` writes a `success` entry into the cache (and is SSR-serialized); `placeholderData` is display-only and is not.

Use `useInfiniteQuery()` when pages form one growing result:

```ts
const feed = useInfiniteQuery({
  key: ['feed'],
  query: ({ pageParam }) => api.feed.list({ cursor: pageParam }),
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})
```

- The cache stores pages and page parameters together.
- Changing the key creates a different infinite-query entry.
- Define `getPreviousPageParam` before calling `loadPreviousPage()`.
- Guard load-more controls with the returned loading and availability state.
- Flatten pages only for presentation; retain the page structure for cache behavior.

## Reusable queries

Use `defineQueryOptions()` for reusable query configuration. Use `defineQuery()` only when a reusable query also needs colocated computed state, watchers, or methods:

```ts
export const useCurrentUser = defineQuery(() => {
  const query = useQuery({
    key: ['users', 'current'],
    query: api.users.current,
  })

  const displayName = computed(() => query.data.value?.name ?? 'Guest')
  return { ...query, displayName }
})
```

Call defined queries within component setup, a store, or an active effect scope so their reactive effects can be disposed.

## Cancellation

`signal` on the query context is an `AbortSignal`. It aborts when:

- a new request for the same key starts (the previous pending call is aborted first);
- `queryCache.cancelQueries({ key })` or `queryCache.cancel(entry)` runs.

Without passing `signal` into `fetch`/the client, Colada still discards the obsolete result, but the HTTP work keeps running. Invalidation marks data stale and refetches active matches; cancellation aborts in-flight work without refetching. During an optimistic mutation, snapshot current data, cancel related in-flight queries, then write the optimistic value so an older response cannot overwrite it.

Official topics: [Queries](https://pinia-colada.esm.dev/guide/queries.html), [Query keys](https://pinia-colada.esm.dev/guide/query-keys.html), [Canceling queries](https://pinia-colada.esm.dev/guide/cancelling-queries.html), [Error handling](https://pinia-colada.esm.dev/guide/error-handling.html), and [Infinite queries](https://pinia-colada.esm.dev/guide/infinite-queries.html).
