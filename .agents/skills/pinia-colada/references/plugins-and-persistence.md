# Plugins and persistence

Use this reference for official plugins, cache persistence, and custom plugin development. Verify package exports and augmentation interfaces against installed declarations before implementation.

## Contents

- [Registration and selection](#registration-and-selection)
- [Query hooks](#query-hooks)
- [Auto-refetch](#auto-refetch)
- [Retry](#retry)
- [Loading delay](#loading-delay)
- [Cache persistence](#cache-persistence)
- [Custom serialization and identity](#custom-serialization-and-identity)
- [Writing custom plugins](#writing-custom-plugins)
- [Plugin validation](#plugin-validation)

## Registration and selection

Register plugins while installing Pinia Colada:

```ts
app.use(PiniaColada, {
  plugins: [
    // Plugin factories in intentional order.
  ],
})
```

Plugin order matters when multiple plugins subscribe to or extend the same cache actions. Install only behavior the application needs:

| Need | Plugin |
| --- | --- |
| Global query success/error/settled hooks | Built-in `PiniaColadaQueryHooksPlugin` |
| Interval or stale-time refetching | `@pinia/colada-plugin-auto-refetch` |
| Query retries | `@pinia/colada-plugin-retry` |
| Delayed loading indicator | `@pinia/colada-plugin-delay` |
| Persisted successful query data | `@pinia/colada-plugin-cache-persister` |
| TanStack-style result properties during migration | `@pinia/colada-plugin-tanstack-compat` |

Do not infer compatible versions across separate packages. Inspect the lockfile, peer dependencies, exports, and local types.

## Query hooks

Use the built-in query-hooks plugin for cache-level side effects:

```ts
import {
  PiniaColada,
  PiniaColadaQueryHooksPlugin,
} from '@pinia/colada'

app.use(PiniaColada, {
  plugins: [
    PiniaColadaQueryHooksPlugin({
      onError(error, entry) {
        if (entry.meta?.errorMessage) {
          reportQueryError(error, entry.meta.errorMessage)
        }
      },
      onSuccess(data, entry) {
        recordQuerySuccess(entry.key, data)
      },
      onSettled(data, error, entry) {
        recordQuerySettlement(entry.key, { data, error })
      },
    }),
  ],
})
```

Verify callback argument order against installed types. Use query `meta` to keep policy declarative. Do not use global hooks for component-instance effects; use component logic or a watcher instead. A cache-level hook may run once per request rather than once per mounted observer.

## Auto-refetch

`PiniaColadaAutoRefetch` accepts:

- `false` to disable;
- `true` to schedule from `staleTime`;
- a millisecond interval;
- a function returning `boolean | number` from query state.

When using `true`, set a meaningful `staleTime`. The plugin is timer-based and effectively client-only; verify server behavior before enabling it in custom SSR. Pause queries with `enabled` when polling is not appropriate.

Focus/reconnect/mount refetching is **core**, not this plugin: `refetchOnMount`, `refetchOnWindowFocus`, and `refetchOnReconnect` default to `true` and also accept `'always'`. Use the auto-refetch plugin only for interval polling.

## Retry

`PiniaColadaRetry` retries failed queries:

```ts
PiniaColadaRetry({
  retry: (failureCount, error) => {
    if (!isTransient(error)) return false
    return failureCount < 3 ? Math.min(1000 * 2 ** failureCount, 30_000) : false
  },
})
```

The callback may return `true` for immediate retry, a delay in milliseconds, or `false`. A numeric `retry` count retries immediately. Retries stop when a query becomes inactive or disabled, and obsolete fetches should not be retried. Confirm failure-count indexing and exact options from installed types. Never retry non-idempotent writes through a query plugin.

## Loading delay

`PiniaColadaDelay({ delay })` delays `asyncStatus` becoming `loading`, which avoids flicker during fast background refreshes. It does not change data status or request timing. Override with a per-query number or `false` when supported. Combine with `placeholderData` only when preserving prior content matches the intended UX.

## Cache persistence

Install and configure the persister globally:

```ts
import {
  PiniaColadaCachePersister,
  isCacheReady,
} from '@pinia/colada-plugin-cache-persister'

app.use(PiniaColada, {
  plugins: [
    PiniaColadaCachePersister({
      key: 'pinia-colada-cache:v3:anonymous',
      debounce: 1000,
      filter: {
        predicate: (entry) => entry.meta?.persist === true,
      },
      storage,
      stringify,
      parse,
    }),
  ],
})

await isCacheReady()
app.mount('#app')
```

Supported concepts in the current plugin include:

- `key`: storage namespace;
- `storage`: synchronous or asynchronous storage adapter;
- `debounce`: write delay;
- `filter`: key or predicate-based query selection;
- `stringify` and `parse`: cache codec.

Only successful results are persisted. Garbage collection still removes entries from persisted data, so align `gcTime` with desired retention. Persistence is best-effort: storage or codec failures should not become application failures.

For asynchronous storage in a plain Vue app, wait for `isCacheReady()` before mounting to avoid requests racing restoration. In Nuxt, do not transplant this bootstrap sequence blindly: inspect the installed Nuxt module and persister integration points, then define whether restoration happens before hydration, after hydration, or only on client-only routes. Test unavailable, corrupt, outdated, and quota-exhausted storage.

The official plugin page and async-storage cookbook have differed on whether `removeItem` is required. Implement it when the backing store supports deletion, and treat the installed `PiniaColadaStorage` declaration as authoritative.

## Custom serialization and identity

JSON does not preserve `Date`, `Map`, `Set`, or custom classes. Use a codec such as `devalue` when these must round-trip:

```ts
import { parse, stringify } from 'devalue'

PiniaColadaCachePersister({
  stringify,
  parse,
})
```

For custom types, define matching allow-listed reducers and revivers. Persist only fields safe to store on the target device; never serialize credentials, authorization headers, raw request objects, sensitive error causes, or server-only data.

The persister has no general application-schema or identity policy. Implement it through the storage namespace and application lifecycle:

1. Include a schema version in `key`.
2. Partition by user or tenant only when persisting their data is allowed.
3. Rotate or remove the old namespace on login, logout, tenant switch, or incompatible deployment.
4. Prefer allow-list filters such as `meta.persist === true`.
5. Treat timestamps or an application-level envelope as the authority for maximum age if the plugin version lacks a native expiry option.
6. Never use shared server persistence for request-specific or authenticated cache data.

Treat an IndexedDB/local-storage record as untrusted same-origin data, not a secret store. For multi-tab applications, prevent a stale tab or debounced write from recreating an old identity's cache after logout; use an identity epoch plus `BroadcastChannel`/storage events or force an application reload. If the installed persister has no verified runtime key-change, flush, or disposal API, recreate the app/Pinia/Colada instance rather than changing identity in place.

Define whether maximum age applies to the whole persisted snapshot or each entry. A snapshot envelope with immutable `createdAt`/`expiresAt` is a safe conservative policy; do not refresh its deadline on every debounced write. Per-entry age requires supported timestamps or an application-owned data format—never rewrite undocumented serialized cache internals.

When SSR hydration and browser persistence coexist, choose and test precedence explicitly: fresh SSR wins, persistence fills only absent entries, or persistence is skipped for SSR-rendered routes. Do not enable both without a deterministic merge policy.

## Writing custom plugins

Prefer an official plugin or public component logic first. Write a custom plugin for cross-cutting cache behavior that belongs at the query or mutation lifecycle.

A plugin receives `queryCache`, `pinia`, and `scope`:

```ts
import type { PiniaColadaPlugin } from '@pinia/colada'
import {
  onScopeDispose,
  shallowRef,
  type ShallowRef,
} from 'vue'

export function PiniaColadaUpdatedAt(): PiniaColadaPlugin {
  return ({ queryCache, scope }) => {
    scope.run(() => {
      const unsubscribe = queryCache.$onAction(({ name, args, after }) => {
        if (name === 'extend') {
          const [entry] = args
          entry.ext.dataUpdatedAt = shallowRef(entry.when)
        } else if (name === 'setEntryState') {
          const [entry] = args
          after(() => {
            if (entry.state.value.status === 'success') {
              entry.ext.dataUpdatedAt.value = entry.when
            }
          })
        }
      })

      onScopeDispose(unsubscribe)
    })
  }
}

declare module '@pinia/colada' {
  interface UseQueryEntryExtensions<TData, TError, TDataInitial> {
    dataUpdatedAt: ShallowRef<number>
  }
}
```

Follow these invariants:

- Subscribe with Pinia `$onAction()` and use `after()`/`onError()` for post-action outcomes.
- Create reactive extension fields inside `scope.run()` so effects are disposed correctly.
- Add every `entry.ext` key during the `extend` action; never replace `entry.ext`.
- For mutations, resolve `useMutationCache(pinia)` and augment `UseMutationEntryExtensions`.
- Extend supported query/mutation option and global-option interfaces through module augmentation when adding configuration.
- Observe `remove` for non-reactive external-resource cleanup.
- Unsubscribe store actions when the plugin scope is disposed.
- Do not depend on undocumented action arguments without installed-type and source verification.
- Avoid re-entering the same cache action recursively.

The mutation lifecycle is create → extend → ensure per invocation → mutate → state updates → remove. Each mutation invocation needs a fresh ensured entry.

Options belong to a shared cache entry, not an individual observer. Components using the same key must not pass conflicting plugin options unless the plugin explicitly defines and tests precedence. Decide whether measurement or retry duration includes downstream plugin work; installation order changes what an intercepted action observes.

## Plugin validation

Test:

- installation order and global/per-query overrides;
- success, error, cancellation, disabled, inactive, and removal paths;
- effect disposal and timer cleanup;
- SSR behavior and absence of cross-request state;
- option and extension type augmentation;
- persistence restore before mount and failure fallback;
- serialization round-trips and sensitive-data exclusion;
- multiple observers sharing one query entry;
- plugin coexistence without recursive or duplicated effects.

Official topics: [Query hooks](https://pinia-colada.esm.dev/plugins/official/query-hooks.html), [Retry](https://pinia-colada.esm.dev/plugins/official/retry.html), [Cache persistence](https://pinia-colada.esm.dev/cookbook/cache-persistence.html), and [Writing plugins](https://pinia-colada.esm.dev/plugins/writing-plugins.html).
