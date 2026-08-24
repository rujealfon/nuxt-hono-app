# Migrating Zod 3 → Zod 4, and choosing a package variant

```bash
npm install zod@^4.0.0
```

Zod 3 is functionally end-of-life (security/bug fixes only). This page lists the highest-impact breaking changes, in the order you're most likely to hit them, plus when to reach for Zod Mini or `zod/v4/core` instead of regular `zod`. A community codemod (`zod-v3-to-v4`) exists for mechanical parts of this migration. This is not exhaustive — for undocumented/internal v3 APIs, check the full upstream changelog.

## Error customization — unified under `error`

`message`, `invalid_type_error`, `required_error`, and `errorMap` are all superseded by a single `error` param, which accepts a string or a function:

```typescript
// v3
z.string({ invalid_type_error: "Not a string", required_error: "Required" });
z.string().min(5, { message: "Too short." });

// v4
z.string({
  error: (issue) => issue.input === undefined ? "Required" : "Not a string",
});
z.string().min(5, { error: "Too short." });
```

Error maps can now return a plain `string` (not just `{ message }`), or `undefined` to defer to the next map in the precedence chain.

**Precedence flipped**: in v3, a per-parse error map beat a schema-level one. In v4, schema-level always wins:

```typescript
const mySchema = z.string({ error: () => "Schema-level error" });
mySchema.parse(12, { error: () => "Contextual error" });
// v3: "Contextual error"    v4: "Schema-level error"
```

## `ZodError` formatting

- `.format()` and `.flatten()` are **deprecated** → use `z.treeifyError()` (see [errors.md](errors.md)).
- `.formErrors` (alias of `.flatten()`) and `.errors` (alias of `.issues`) are **dropped** → use `.issues`.
- `.addIssue()`/`.addIssues()` deprecated → push directly onto `err.issues`.
- Issue *types* were consolidated (e.g. `ZodInvalidEnumValueIssue` and `ZodInvalidLiteralIssue` merged into `$ZodIssueInvalidValue`; `ZodInvalidUnionDiscriminatorIssue` now throws a regular `Error` at schema-creation time instead of producing an issue). The base issue shape (`code`, `input`, `path`, `message`) is unchanged, so most generic error-handling code keeps working.

## `z.string()` format methods → top-level functions

```typescript
// v3 (still works, but deprecated)
z.string().email();
z.string().uuid();
z.string().ip();       // dropped entirely — no v4 equivalent
z.string().cidr();     // dropped entirely — no v4 equivalent

// v4
z.email();
z.uuid();               // now stricter: enforces RFC 9562/4122 variant bits — use z.guid() for any UUID-shaped string
z.ipv4(); z.ipv6();     // separate methods; z.union([z.ipv4(), z.ipv6()]) if you need both
z.cidrv4(); z.cidrv6(); // same split
z.base64url();          // no padding allowed by default now
```

## `z.number()` tightened

- `Infinity`/`-Infinity` are no longer valid `z.number()` values.
- `.safe()` is deprecated and now behaves like `.int()` — it no longer accepts floats.
- `.int()` only accepts safe integers (`Number.MIN_SAFE_INTEGER`–`MAX_SAFE_INTEGER`); prefer the new top-level `z.int()`.

## `z.coerce` input type

`z.coerce.*` schemas now have input type `unknown` (was the target type in v3):

```typescript
const schema = z.coerce.number();
type In = z.input<typeof schema>; // v3: number   v4: unknown
```

## `.default()` semantics changed — `.prefault()` added

v4's `.default()` short-circuits parsing entirely; the default value must match the schema's **output** type. v3's `.default()` instead *parsed* the default, so it had to match the **input** type. To keep v3 behavior, use the new `.prefault()`:

```typescript
// v3: default value flows through the transform
const schema = z.string().transform(v => v.length).default("tuna");
schema.parse(undefined); // => 4

// v4 equivalent, using .prefault()
const schema = z.string().transform(v => v.length).prefault("tuna");
schema.parse(undefined); // => 4

// v4 .default() short-circuits — value must already match the OUTPUT type
const schema2 = z.string().transform(v => v.length).default(0);
schema2.parse(undefined); // => 0
```

See [refinements-transforms.md](refinements-transforms.md) for more on this distinction.

## `z.object()` changes

- **Defaults inside optional fields now apply.** `z.object({ a: z.string().default("tuna").optional() }).parse({})` yields `{ a: "tuna" }` in v4 (v3 left the key absent). Audit code that branches on key presence.
- `.strict()`/`.passthrough()` deprecated (kept, not removed) in favor of `z.strictObject()`/`z.looseObject()`.
- `.strip()` deprecated — it was always the default; use `z.object(A.shape)` to convert a strict schema to a regular one.
- `.deepPartial()` **removed**, no direct replacement — it was flagged as an anti-pattern with implementation footguns.
- `z.any()`/`z.unknown()` fields are no longer implicitly optional: `z.object({ a: z.any() })` infers `{ a: any }` (not `{ a?: any }`), and as of 4.4.0 a missing key also fails at parse time (`{ a: undefined }` still passes).
- `.merge()` deprecated in favor of `.extend()` (or spread syntax, which also has better `tsc` performance): `BaseSchema.merge(Other)` → `BaseSchema.extend(Other.shape)`.

## `z.nativeEnum()` deprecated

`z.enum()` now accepts TS enums and enum-like objects directly:

```typescript
enum Color { Red = "red", Green = "green", Blue = "blue" }
const ColorSchema = z.enum(Color); // ✅ replaces z.nativeEnum(Color)
```

`.Enum`/`.Values` aliases on `ZodEnum` were removed — use `.enum` (canonical).

## `z.array().nonempty()` no longer changes the tuple type

```typescript
const NonEmpty = z.array(z.string()).nonempty();
type T = z.infer<typeof NonEmpty>;
// v3: [string, ...string[]]   v4: string[] (runtime check is unchanged: still requires length >= 1)
```

For an actual tuple-with-rest type, use `z.tuple([z.string()], z.string())`.

## `z.function()` is no longer a schema

It's now a standalone factory — define `input`/`output` upfront instead of chaining `.args()`/`.returns()`:

```typescript
// v3
const fn = z.function().args(z.string()).returns(z.number());

// v4
const fn = z.function({ input: [z.string()], output: z.number() });
fn.implement((s) => s.length);
fn.implementAsync(async (s) => s.length); // new — dedicated async variant
```

## `.refine()` changes

- Passing a TS type predicate as the refinement function no longer narrows the inferred type (undocumented v3 behavior, removed).
- `ctx.path` is no longer available inside `.superRefine()`/`.check()` — the new parsing architecture doesn't eagerly compute paths (this enabled the v4 performance gains).
- The `(fn, fn)` two-function-argument overload of `.refine()` is gone; use the `error` param.

## Other removals worth knowing about

- `z.ostring()`, `z.onumber()`, etc. (undocumented optional-string shorthands) — removed.
- `z.literal()` no longer accepts `symbol` values.
- Static `.create()` factories (`z.ZodString.create()`) — removed; use the top-level `z.string()` etc.
- `z.record(valueSchema)` single-argument form was dropped in 4.0, then restored in 4.4.0 (key defaults to `z.string()`). Prefer the two-arg form `z.record(z.string(), z.string())` anyway.
- `z.record()` with an enum/literal key schema is now exhaustive (requires every key present) rather than partial — use `z.partialRecord()` for the old partial behavior.
- `z.intersection()` throws a plain `Error` (not a `ZodError`) when the two branches produce unmergeable results — this indicates a structurally broken schema, not a validation failure.
- `z.promise()` deprecated — `await` the value before parsing.

## Zod Mini and `zod/v4/core`

**Zod Mini** (`import * as z from "zod/mini"`) is a tree-shakable, functional-API variant with identical runtime behavior to regular Zod, built around `.check()` instead of chained methods:

```typescript
// regular Zod
z.string().min(5).max(10).trim();

// Zod Mini
z.string().check(z.minLength(5), z.maxLength(10), z.trim());
```

It cuts gzipped bundle size roughly in half to two-thirds depending on the schema (a trivial boolean schema: 5.91kb → 2.12kb; a small object schema: 13.1kb → 4.0kb). That's a real front-end win **only** for users on slow connections or highly bundle-size-constrained apps — on the backend (including Lambda cold starts) or on typical broadband, Zod's ~10-17kb gzipped is noise. Default to regular Zod; reach for Mini only when you have a measured, hard bundle-size constraint, and accept the tradeoff of a more verbose, less autocomplete-friendly API. Zod Mini doesn't auto-load the `en` locale — call `z.config(z.locales.en())` explicitly if you want non-generic messages.

**`zod/v4/core`** (`import * as z4 from "zod/v4/core"`) is the shared foundation both `zod` and `zod/mini` build on — base classes, issue types, and utilities with no schema-building sugar layered on top. This is the right import for **library authors** who want to support both `zod` and `zod/mini` users, or both Zod 3 and Zod 4 simultaneously (differentiate at runtime by checking for the `_zod` property, which only exists on v4 schemas). Regular app code should keep importing from `zod` — `zod/v4/core` is a low-level integration surface, not a general-purpose entry point. See the [official library-authors guide](https://zod.dev/library-authors) for peer-dependency setup and subpath-import conventions if you're building on top of Zod rather than just using it.
