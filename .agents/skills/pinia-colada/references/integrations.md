# Integrations and testing

Use this reference for application setup, Nuxt, custom SSR, and testing.

## Contents

- [Vue application setup](#vue-application-setup)
- [Nuxt](#nuxt)
- [Custom SSR](#custom-ssr)
- [Testing](#testing)

## Vue application setup

Install Pinia before Pinia Colada:

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(PiniaColada, {
  queryOptions: {
    staleTime: 0,
  },
  mutationOptions: {},
  plugins: [],
})

app.mount('#app')
```

Preserve an application's existing bootstrap structure. In new Vue apps, install `@pinia/colada-devtools` as a dev dependency and mount `<PiniaColadaDevtools />` at the end of the root template. Do not enable it in production unless asked.

## Nuxt

Use the official Nuxt modules:

```ts
export default defineNuxtConfig({
  modules: ['@pinia/nuxt', '@pinia/colada-nuxt'],
})
```

Check the installed module names and configuration types before editing because module packaging may vary by version. Put Pinia Colada options in `colada.options.ts` when supported:

```ts
import type { PiniaColadaOptions } from '@pinia/colada'

export default {
  queryOptions: {
    staleTime: 30_000,
  },
} satisfies PiniaColadaOptions
```

In Nuxt, `useQuery()` participates in SSR through server-prefetch integration, so it generally does not need top-level `await`. Await `refresh()` only when navigation must block until data resolves. Use `enabled` to suppress a query on the server or until required inputs exist.

Use Nuxt-native `useFetch`/`useAsyncData` for simple page-local requests when their lifecycle is sufficient. Prefer Pinia Colada for shared cached data, mutations, optimistic updates, invalidation, or cross-component deduplication.

## Custom SSR

Follow Pinia SSR setup first. A custom renderer must additionally serialize and hydrate Pinia Colada's query-cache tree with the installed helpers such as `isQueryCache`, `serializeQueryCache`, and `hydrateQueryCache`.

Install Pinia and Pinia Colada before hydrating. Treat custom errors as custom serialized types.

Prevent server garbage-collection timers from surviving a request:

```ts
import {
  PiniaColada,
  PiniaColadaSSRNoGc,
  useQueryCache,
} from '@pinia/colada'

app.use(PiniaColada, {
  plugins: import.meta.env.SSR ? [PiniaColadaSSRNoGc()] : [],
})

// Clear the request-scoped cache after rendering.
useQueryCache(pinia).caches.clear()
```

The Nuxt module handles SSR cache serialization, disables server GC timers, and clears request cache automatically. In custom SSR, never share one Pinia/query cache across user requests.

## Testing

For component tests, mount with a new Pinia and Pinia Colada instance for every test:

```ts
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import type { Component } from 'vue'

export function mountWithData(component: Component) {
  return mount(component, {
    global: {
      plugins: [createPinia(), PiniaColada],
    },
  })
}
```

- Do not reuse the query cache between tests.
- Never use `createTestingPinia()` for components under test that use Pinia Colada: its stubbed actions break Colada's action-based internals. Use a real `createPinia()` instead.
- Prefer MSW or the project's existing network boundary for integration-like component tests.
- Use mocked query/mutation functions for narrow unit tests.
- Flush promises after initial query execution, mutations, invalidation, and refetches.
- Assert pending/loading, success, and error states.
- For cache behavior, verify deduplication, stale/fresh behavior, invalidation scope, and cleanup.
- For optimistic mutations, test success reconciliation, rollback, and overlapping operations.
- For SSR, verify no cross-request cache reuse and correct hydration without a duplicate request.

Official topics: [Nuxt](https://pinia-colada.esm.dev/nuxt.html), [SSR](https://pinia-colada.esm.dev/guide/ssr.html), and [Testing](https://pinia-colada.esm.dev/cookbook/testing.html).
