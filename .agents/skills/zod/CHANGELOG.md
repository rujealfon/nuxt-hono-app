# Changelog

Versions here track this skill's own content (instructions and references), not the `zod` package version — see the [README](README.md#version) for which `zod` line this skill was last verified against.

## 1.2.0 - 2026-09-01

Docs-backed refresh against `zod` 4.5.4 and https://zod.dev/llms.txt.

- AOT compilation: `z.compile()` / `import "zod/compile"` (compile last; apps not libraries; unsupported fallback).
- `z.validate()` / `z.validateAsync()` for boolean-only checks.
- `z.creditCard()`, `.exactPartial()` / `z.exactPartial()`, `z.deepPartial()`, `z.properties()`, `z.getDiscriminatedOption()`, `z.toZod<T>()`, runtime `z.input()` / `z.output()`, symbol keys, tuple `.partial()`.
- Cyclical *data* on recursive schemas (Mini: `z.config({ memoizer: z.memoizer() })`).
- Soundness: ISO datetime seconds required; string `.min()`/`.max()`/`.length()` count code points; record key schemas govern matching keys only.
- JSON Schema: `unrepresentable` as a function; metadata wins over generated keywords.

Won't add: ecosystem catalog, full library-authors guide, compile internals / Moltar / memory-footprint blog, locale inventory, `__proto__` stripping, `fromJSONSchema` draft-edge cases, `z.xor()` multi-match error, `.implement()` exposing the function schema.

## 1.1.0 - 2026-08-23

Docs-backed refresh against `zod` 4.4.3 and https://zod.dev/llms.txt.

- Number formats: `z.uint32()`, `z.float32()`, `z.float64()`, `z.int64()`, `z.uint64()`.
- `.exactOptional()` for `exactOptionalPropertyTypes`.
- `.overwrite()` for same-type transforms (vs `.transform()` / `z.codec()`).
- `z.xor()` needs `z.strictObject()` on object branches (default objects strip unknown keys).
- Correct 4.4.0 notes: `z.record(value)` restored; missing `z.any()`/`z.unknown()` keys fail at parse time.
- Add `/zod` trigger to the skill description.

Won't add: `z.compile()` (canary-only), `z.creditCard()`, `.exactPartial()` (post-4.4.3). Ecosystem catalog, Clerk blog, full library-authors guide (Mini/core section already points at it).

## 1.0.0 - 2026-08-22

Initial versioned release. Covers Zod 4 (schema types, refinements/transforms, error handling, codecs, JSON Schema conversion, metadata/registries) plus Zod 3 → 4 migration guidance. Verified against `zod` 4.4.3.
