# Changelog

Versions here track this skill's own content (instructions and references), not the `zod` package version — see the [README](README.md#version) for which `zod` line this skill was last verified against.

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
