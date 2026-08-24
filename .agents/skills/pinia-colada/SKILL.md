---
name: pinia-colada
description: Build, review, migrate, test, and troubleshoot async data workflows with Pinia Colada in Vue and Nuxt applications. Use for @pinia/colada setup, useQuery/useMutation, query keys, cache updates and invalidation, optimistic updates, pagination and infinite queries, SSR and Nuxt, plugins, testing, TypeScript, TanStack Vue Query migrations, and PINIA_COLADA runtime errors. Use when the user runs /pinia-colada.
---

# Pinia Colada

Use the target project's installed Pinia Colada version and local types as the API authority. Use the focused references in this skill for workflow guidance and common patterns.

## Start from the project

1. Inspect the package manifest and lockfile to identify the package manager and installed versions of Vue, Pinia, Nuxt, and `@pinia/colada`.
2. Locate existing app setup, query definitions, key factories, mutations, cache access, tests, and SSR conventions.
3. Preserve the project's organization and naming unless the task explicitly requests a refactor.
4. Determine whether the task targets the installed version or explicitly asks for the latest upstream behavior.

If a bundled reference conflicts with installed TypeScript declarations or source, follow the installed package for signatures and call out the version difference. When no version is installed, use the references as a starting point and verify version-sensitive details in the official documentation.

## Read the relevant reference

- Read [references/queries.md](references/queries.md) for `useQuery`, keys, reusable queries, pagination, infinite queries, `AbortSignal` cancellation, and error typing.
- Read [references/cache-and-mutations.md](references/cache-and-mutations.md) for `useMutation` (`mutate` vs `mutateAsync`), invalidation, cache operations, prefetching, and optimistic updates.
- Read [references/integrations.md](references/integrations.md) for Vue setup, Nuxt, custom SSR, and testing.
- Read [references/plugins-and-persistence.md](references/plugins-and-persistence.md) for official plugins (including query-hooks `onError` + `entry.meta`), cache persistence, and custom plugins.
- Read [references/migration.md](references/migration.md) for TanStack Vue Query migration, compatibility helpers, and codemods.
- Read [references/troubleshooting.md](references/troubleshooting.md) when diagnosing `PINIA_COLADA_*` codes, injection-context failures, cache misuse, or infinite-query errors.

These references are intentionally curated rather than copies of upstream documentation. If the user asks for current or version-specific behavior that local declarations do not answer, consult the matching page in the [official Pinia Colada documentation](https://pinia-colada.esm.dev/) and state which version or source you followed.

## Implement deliberately

- Install `PiniaColada` after Pinia at the existing bootstrap point.
- Model query keys as serializable hierarchical arrays and put every reactive input the query function reads into the key.
- Pass the query context `signal: AbortSignal` into `fetch` (or the client's abort option). Cancellation discards the result either way; without `signal`, the HTTP work keeps running.
- Throw or reject from the query/mutation function for HTTP failures — native `fetch()` does not. Previous `data` is kept when a refetch fails; render stale data plus the new `error`.
- `mutate()` swallows the error (state + `onError` only). `mutateAsync()` rethrows after hooks — wrap it in `try/catch`.
- Prefer reusable query definitions and key factories once the project repeats queries or cache operations.
- Use `refresh()` for freshness-aware work and `refetch()` to force a request. Invalidate by key prefix; use `exact: true` for one entry. Make optimistic updates snapshot, cancel, write, and roll back only if the optimistic value is still current.
- Treat SSR, Nuxt, persistence, retry, and auto-refetch as opt-in; read their reference before changing them.
- Use TanStack compatibility helpers only when the migration task calls for them.

## Troubleshoot from evidence

1. Capture the runtime error code, stack, failing component or composable, and relevant query or mutation options.
2. Read the matching error-reference page and inspect the installed implementation or declarations.
3. Check injection context, plugin order, effect scope, query-key completeness, cache entry lifetime, and SSR boundaries as applicable.
4. Fix the narrowest verified cause. Avoid broad cache resets or unrelated rewrites.

## Verify the result

- Run the project's existing typecheck and the narrowest relevant tests.
- Run lint and broader tests when the change crosses shared query, cache, plugin, or SSR infrastructure.
- Exercise success, pending/loading, error, refetch, and stale-data states when they are affected.
- For mutations, verify invalidation or cache updates after both success and failure; test optimistic rollback when used.
- Report any behavior that could not be exercised and the version assumptions used.
