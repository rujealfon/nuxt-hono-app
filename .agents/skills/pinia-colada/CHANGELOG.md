# Changelog

Versions here track this skill's own content (instructions and references), not the `@pinia/colada` package version — see the [README](README.md#version) for which line this skill was last verified against.

## 1.0.1 - 2026-08-23

Docs-backed refresh against `@pinia/colada` 1.4.2 and https://pinia-colada.esm.dev/llms.txt.

- Name query-context `signal: AbortSignal` and distinguish cancellation from invalidation.
- Record that refetch failure keeps previous `data`; `mutate()` swallows, `mutateAsync()` rethrows.
- Core `refetchOnWindowFocus` / `refetchOnReconnect` / `refetchOnMount` (auto-refetch plugin is interval-only); SSR-only `PiniaColadaSSRNoGc`.
- Sharpen SKILL.md implement rules; add `/pinia-colada` trigger.

Won't add: community plugin directory; a seventh "error handling" reference (the pieces live in queries, plugins, and troubleshooting).

## 1.0.0 - 2026-08-22

Initial versioned release. Covers queries, cache and mutations, Vue/Nuxt integrations, plugins and persistence, TanStack Vue Query migration, and troubleshooting. Verified against `@pinia/colada` 1.4.2.
