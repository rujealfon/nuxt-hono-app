# Refinements, transforms, and modifiers

## Refinements

`.refine()` adds custom validation logic Zod doesn't provide natively. Refinement functions must never throw — return a falsy value to signal failure.

```typescript
const myString = z.string().refine((val) => val.length <= 255);

const myString2 = z.string().refine((val) => val.length > 8, {
  error: "Too short!",
});
```

**Continuable vs aborting**: by default all refinements run even after one fails, so `safeParse` can surface every issue at once. Pass `abort: true` to stop after that check fails:

```typescript
z.string()
  .refine((val) => val.length > 8, { error: "Too short!", abort: true })
  .refine((val) => val === val.toLowerCase(), { error: "Must be lowercase" });
```

**Custom path**: use `path` to attach the issue to a specific field, typically inside an object refinement:

```typescript
const passwordForm = z.object({ password: z.string(), confirm: z.string() })
  .refine((data) => data.password === data.confirm, {
    error: "Passwords don't match",
    path: ["confirm"],
  });
```

**Async**: pass an `async` function; you must then call `.parseAsync()` (or `.safeParseAsync()`) — the sync methods throw if they hit an async refinement.

```typescript
const userId = z.string().refine(async (id) => {
  return db.userExists(id);
});
await userId.parseAsync("abc123");
```

**`when`**: refinements normally don't run if any *non-continuable* issue already exists elsewhere on the object (Zod won't hand a refinement bad-shaped data). This can block unrelated checks — e.g. a typo in `anotherField` prevents a `password === confirmPassword` check from ever running. `when` lets a refinement opt into running regardless, as long as the specific fields it needs are individually valid. This is a power-user feature; misuse increases the chance of uncaught errors inside the refinement.

```typescript
const schema = baseSchema.refine((data) => data.password === data.confirmPassword, {
  error: "Passwords do not match",
  path: ["confirmPassword"],
  when(payload) {
    return baseSchema
      .pick({ password: true, confirmPassword: true })
      .safeParse(payload.value).success;
  },
});
```

### `.superRefine()` and `.check()`

`.refine()` only ever produces one `"custom"` issue. `.superRefine()` can push multiple issues, with any built-in issue `code`:

```typescript
const UniqueStringArray = z.array(z.string()).superRefine((val, ctx) => {
  if (val.length > 3) {
    ctx.addIssue({
      code: "too_big", maximum: 3, origin: "array", inclusive: true,
      message: "Too many items 😡", input: val,
    });
  }
  if (val.length !== new Set(val).size) {
    ctx.addIssue({ code: "custom", message: "No duplicates allowed.", input: val });
  }
});
```

`.check()` is a lower-level API doing the same job — more verbose, but usable in performance-sensitive paths and is the only option in Zod Mini (which doesn't implement `.superRefine()`).

## Pipes and transforms

Pipe schemas together with `.pipe()` — most useful alongside transforms:

```typescript
const stringToLength = z.string().pipe(z.transform((val) => val.length));
stringToLength.parse("hello"); // => 5
```

Transforms accept anything and unconditionally produce a new value — they don't validate. They must never throw. To report a validation problem from inside a transform, push onto `ctx.issues` and return `z.NEVER`:

```typescript
const coercedInt = z.transform((val, ctx) => {
  try {
    return Number.parseInt(String(val));
  } catch (e) {
    ctx.issues.push({ code: "custom", message: "Not a number", input: val });
    return z.NEVER; // exits without corrupting the inferred return type
  }
});
```

`.transform()` is the common convenience form of "pipe into a transform":

```typescript
const stringToLength = z.string().transform((val) => val.length);
```

Transforms can be async — this forces `.parseAsync()`/`.safeParseAsync()`:

```typescript
const idToUser = z.string().transform(async (id) => db.getUserById(id));
const user = await idToUser.parseAsync("abc123");
```

**Important**: `.transform()` is one-directional. Calling `.encode()` on a schema that contains a transform throws a runtime `Error` (not a `ZodError`). The output type is a black box, so `z.toJSONSchema()` cannot represent it soundly. If you need the transform to be reversible — a network boundary, a form that round-trips — use `z.codec()` instead; see [codecs.md](codecs.md).

### `.overwrite()`

When the value stays the same inferred type (trim, clamp, square, normalize), use `.overwrite()` instead of `.transform()`. It is stored as a refinement, returns the original schema class, and stays JSON-Schema-able. `.trim()` / `.toLowerCase()` / `.toUpperCase()` are implemented this way.

```typescript
z.number().overwrite((val) => val ** 2).max(100); // still ZodNumber
```

Do not use `.overwrite()` to change types — that is `.transform()` or `z.codec()`.

`.preprocess()` is the inverse convenience form — "pipe a transform into a schema":

```typescript
const coercedInt = z.preprocess((val) => {
  if (typeof val === "string") return Number.parseInt(val);
  return val;
}, z.int());
```

By default the input type of a `z.preprocess()` schema is `unknown`. Annotate the preprocessor's parameter to narrow it — useful when integrating with libraries (e.g. `react-hook-form`) that derive their form value type from `z.input<>`:

```typescript
const trimmed = z.preprocess(
  (val: string | null | undefined) => val?.trim() ?? "",
  z.string()
);
type Input = z.input<typeof trimmed>;   // string | null | undefined
type Output = z.output<typeof trimmed>; // string
```

## Defaults, prefaults, catch

`.default()` supplies a value for `undefined` input and **short-circuits parsing** — the default is returned as-is, so it must match the schema's *output* type:

```typescript
const defaultTuna = z.string().default("tuna");
defaultTuna.parse(undefined); // => "tuna"

// a function re-runs on every undefined input
z.number().default(Math.random);
```

```typescript
const schema = z.string().transform((val) => val.length).default(0); // 0, not a string
schema.parse(undefined); // => 0
```

`.prefault()` ("pre-parse default") instead *parses* the fallback value — useful when you want the default to flow through the schema's own transforms/refinements, or to replicate Zod 3's `.default()` semantics:

```typescript
const a = z.string().trim().toUpperCase().prefault(" tuna ");
a.parse(undefined); // => "TUNA"

const b = z.string().trim().toUpperCase().default(" tuna ");
b.parse(undefined); // => " tuna " (returned as-is, no parsing)
```

`.catch()` supplies a fallback for any validation *failure* (not just `undefined`):

```typescript
const numberWithCatch = z.number().catch(42);
numberWithCatch.parse("tuna"); // => 42

// function form receives the caught ZodError via ctx.error
const numberWithRandomCatch = z.number().catch((ctx) => {
  ctx.error;
  return Math.random();
});
```

## Branded types

TypeScript's structural typing means two shape-identical types are interchangeable by default. `.brand<"Tag">()` simulates nominal typing by attaching a phantom tag to the *inferred type only* — it has zero effect on runtime `.parse()` behavior. Data becomes "branded" only by actually being parsed through the branded schema.

```typescript
const Cat = z.object({ name: z.string() }).brand<"Cat">();
const Dog = z.object({ name: z.string() }).brand<"Dog">();

const pluto = Dog.parse({ name: "pluto" });
const simba: Cat = pluto; // ❌ type error, even though shapes match
```

By default only the output type is branded. Control this with a second generic (Zod 4.2+):

```typescript
z.string().brand<"Cat", "out">();   // output branded (default)
z.string().brand<"Cat", "in">();    // input branded
z.string().brand<"Cat", "inout">(); // both branded
```

## Readonly

```typescript
z.object({ name: z.string() }).readonly(); // { readonly name: string }
z.array(z.string()).readonly();            // readonly string[]
z.tuple([z.string(), z.number()]).readonly();
z.map(z.string(), z.date()).readonly();    // ReadonlyMap
z.set(z.string()).readonly();              // ReadonlySet
```

The parsed result is frozen with `Object.freeze()` — mutating it throws a `TypeError` at runtime, on top of the TS-level `readonly` annotation.

## JSON

```typescript
const jsonSchema = z.json(); // validates any JSON-encodable value
```

Equivalent to a lazily-defined recursive union of string/number/boolean/null/array/record.

## Functions

`z.function()` keeps input/output validation out of your business logic:

```typescript
const MyFunction = z.function({
  input: [z.string()], // array or ZodTuple
  output: z.number(),
});

const computeTrimmedLength = MyFunction.implement((input) => input.trim().length);
computeTrimmedLength("sandwich"); // => 8
computeTrimmedLength(42);         // throws ZodError
```

Omit `output` to validate inputs only. Use `.implementAsync()` for an async implementation.

## Custom

`z.custom<T>()` validates any TypeScript type not covered by a built-in schema — typically third-party types. Prefer `z.instanceof()` for classes and `z.templateLiteral()` for template literal types.

```typescript
import { Decimal } from "decimal.js";
const decimalSchema = z.custom<Decimal>((val) => Decimal.isDecimal(val));
```

Without a validation function, `z.custom<T>()` performs **no validation at all** — it's a type-only assertion. Only omit the function when you're deliberately opting out of runtime checking.

## Apply

`.apply()` folds an external function into the method chain — useful for sharing a bundle of checks across schemas:

```typescript
function setCommonNumberChecks<T extends z.ZodNumber>(schema: T) {
  return schema.min(0).max(100);
}

const schema = z.number().apply(setCommonNumberChecks).nullable();
```
