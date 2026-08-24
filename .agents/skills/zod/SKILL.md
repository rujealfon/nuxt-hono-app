---
name: zod
description: Define, validate, and parse data with Zod (v4) in TypeScript/JavaScript — request bodies, form inputs, environment variables, API responses, config files, CLI args, and any other untrusted or external data. Use when writing a `z.object`/`z.string`/`z.array` schema, calling `.parse()`/`.safeParse()`, inferring types with `z.infer<>`, adding refinements/transforms/codecs, customizing Zod errors, converting to JSON Schema, or migrating Zod 3 → 4 — even if they just say "validate this input" or "parse this form." Use when the user runs /zod. Also covers Zod Mini and Zod Core.
---

# Zod

Zod's API changed substantially between major versions — v4 replaced many chained string methods (`.email()`, `.uuid()`) with top-level functions (`z.email()`, `z.uuid()`), changed error customization and formatting APIs, and altered how `.default()` interacts with transforms. Treat the target project's installed `zod` version as the source of truth for which API surface is valid; use the references below as a curated starting point, not a substitute for checking what's actually installed.

## Start from the project

1. Check `package.json`/lockfile for the installed `zod` version. Zod 3 is functionally end-of-life (security/bug fixes only); new code should target Zod 4 unless the project is deliberately pinned to v3.
2. If the version is ambiguous, check for `zod/v4` or `zod/v3` subpath imports, or look for tell-tale v3 patterns (`z.string().email()`, `z.nativeEnum()`, `.merge()`, `errorMap`) versus v4 patterns (`z.email()`, spread-based extension, `error` param).
3. Read existing schema files to match the project's conventions — where schemas live, whether they're colocated with types, how errors get formatted for the client, and whether `zod/mini` is in use for a bundle-size-sensitive package.
4. Preserve the project's organization unless the task explicitly asks for a refactor.

## Read the relevant reference

- [references/schema-types.md](references/schema-types.md) — primitives, string formats (email/URL/UUID/ISO dates/etc.), numbers, objects and their modifiers, arrays/tuples, unions/discriminated unions/intersections, records, maps/sets, files, recursive schemas, template literals.
- [references/refinements-transforms.md](references/refinements-transforms.md) — `.refine()`/`.superRefine()`/`.check()`, transforms and pipes, `.preprocess()`, defaults/prefaults/catch, branded types, readonly, `z.function()`, `z.custom()`.
- [references/errors.md](references/errors.md) — customizing error messages (schema-level, per-parse, global, i18n locales) and formatting `ZodError` (`treeifyError`, `prettifyError`, `flattenError`).
- [references/codecs.md](references/codecs.md) — bidirectional transforms with `z.codec()`, `.encode()`/`.decode()`, and copy-paste implementations for common codecs (string↔number, ISO string↔Date, base64↔bytes, etc.).
- [references/json-schema.md](references/json-schema.md) — `z.toJSONSchema()` / `z.fromJSONSchema()`, target versions, handling unrepresentable types, registries for multi-schema output.
- [references/metadata-registries.md](references/metadata-registries.md) — `.meta()`, `.describe()`, `z.globalRegistry`, custom registries.
- [references/migration-v3-to-v4.md](references/migration-v3-to-v4.md) — the highest-impact Zod 3 → Zod 4 breaking changes with before/after code, plus when Zod Mini or `zod/v4/core` are the right call.

These are condensed and curated, not full copies of the upstream docs. For behavior not covered here or that looks version-sensitive, check the installed package's type declarations or the [official Zod docs](https://zod.dev/) and note which version you followed.

## Implement deliberately

- Reach for `.safeParse()`/`.safeParseAsync()` at trust boundaries (API handlers, form submissions, third-party responses) where an invalid input is an expected, recoverable case — the discriminated `{ success, data }` / `{ success, error }` result avoids a `try/catch`. Reach for `.parse()`/`.parseAsync()` when an invalid input represents a programmer error or a truly exceptional case you want to fail loudly and let bubble up.
- `z.object()` strips unknown keys by default — the right default for most APIs. Use `z.strictObject()` when unrecognized keys should be rejected outright (catching client typos), and `z.looseObject()` when you need passthrough (proxying to another service, preserving unknown fields). When the project has TypeScript `exactOptionalPropertyTypes` and an absent key must not accept explicit `undefined`, use `.exactOptional()` instead of `.optional()`.
- Prefer spread syntax (`z.object({ ...Base.shape, extra: z.string() })`) over repeated `.extend()` chains on large or frequently-extended schemas — it's equivalent, works identically in Zod and Zod Mini, and avoids the quadratic `tsc` cost `.extend()` chains can incur. Use `.safeExtend()` instead of `.extend()` on any schema that already carries a `.refine()` — plain `.extend()` throws on those.
- A single `.refine()` produces one `"custom"` issue; reach for `.superRefine()` (or the lower-level `.check()`) when a validation needs to report multiple issues, use a specific issue `code`, or target a nested `path`.
- `.transform()` is one-directional and changes the output type (and makes JSON Schema conversion unsound). If the value stays the same type (trim, clamp, square), use `.overwrite()` so the schema stays a `ZodNumber`/`ZodString`/etc. If the same schema needs to serialize data back (a network boundary, a form that round-trips, anything using `z.encode()`), model it as `z.codec()` instead; see [references/codecs.md](references/codecs.md) and [references/refinements-transforms.md](references/refinements-transforms.md).
- `.default()` short-circuits parsing and its value must be assignable to the schema's *output* type. When you instead want a fallback value that itself gets parsed/transformed (matching Zod 3's `.default()` behavior), use `.prefault()`.
- `z.coerce.*` is for genuinely coercible sources — `URLSearchParams`, env vars, form-encoded values — not a substitute for sending correctly-typed data from a client you control.
- Use `z.infer<typeof schema>` for the common case. Reach for `z.input<>`/`z.output<>` independently whenever the schema contains a `.transform()`, `.default()`, `.coerce`, or a codec, since input and output types diverge — this matters in particular for libraries (e.g. `react-hook-form`) that key off the input type.
- Don't introduce Zod 4-only syntax into a project still pinned to Zod 3, and don't add newly-deprecated v3 patterns (`.merge()`, `.nativeEnum()`, `z.string().email()`) to a v4 project just because they still work — check [references/migration-v3-to-v4.md](references/migration-v3-to-v4.md) when unsure which side of the line an API is on.
- Only reach for `zod/mini` when bundle size is a demonstrated, hard constraint (typically front-end code shipped to bandwidth-constrained users) — on the backend, in serverless functions, and in most front-end apps the size difference is not worth the more verbose, less discoverable functional API. See [references/migration-v3-to-v4.md](references/migration-v3-to-v4.md) for the tradeoff in more detail.
- Treat the schema as the single source of truth for the shape: derive types with `z.infer<>`/`z.input<>`/`z.output<>` rather than hand-writing a parallel `interface`/`type` that has to be kept in sync by hand.
- Validate environment variables once, at process startup, against a schema — fail fast with a clear error before the app starts serving traffic, rather than discovering a missing/malformed env var deep in a request handler. Export the parsed, typed result and import that everywhere instead of touching `process.env` directly elsewhere in the codebase.
- Extract and reuse sub-schemas for fields or shapes that repeat across multiple schemas (an `Email`, an `Id`, a `Pagination` object) instead of redefining the same chain of checks in each place — keeps validation rules consistent and gives you one place to change them.
- Zod's validation cost is real but small; don't reach for micro-optimizations (skipping `safeParse`, hand-rolling checks) on ordinary request-sized payloads. Do avoid re-parsing the same already-validated data repeatedly in a hot loop, and avoid `z.custom()` without a validation function (see [references/refinements-transforms.md](references/refinements-transforms.md)) — it silently performs no validation at all.

## Verify the result

- Run the project's typecheck — a mismatched `.refine()`/`.transform()` return type or an incorrect `z.input`/`z.output` usage at a call site usually surfaces there rather than at runtime.
- Exercise both the success and failure paths with representative fixtures, including the edge cases the schema exists to catch (boundary numbers, empty arrays/strings, malformed formats, extra/missing keys).
- If a schema contains an async `.refine()`, `.transform()`, or codec, confirm the code path uses `.parseAsync()`/`.safeParseAsync()` — the sync variants throw when they encounter an async check.
- When user-facing error copy matters, inspect the actual `result.error.issues` (or `z.prettifyError()`/`z.flattenError()` output), not just the `success` boolean — message wording and `path` targeting are easy to get subtly wrong.
- If the project or its tests were written against Zod 3, check whether they rely on removed/changed APIs (`.format()`, `.flatten()`, `errorMap`, `ZodInvalidEnumValueIssue`) before assuming a failure is unrelated to your change.
