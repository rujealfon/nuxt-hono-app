# JSON Schema conversion

Zod converts natively to/from JSON Schema — useful for OpenAPI definitions and LLM structured-output schemas.

## `z.toJSONSchema()`

```typescript
const schema = z.object({ name: z.string(), age: z.number() });

z.toJSONSchema(schema);
// => { type: 'object', properties: { name: {type:'string'}, age:{type:'number'} },
//      required: ['name','age'], additionalProperties: false }
```

Second-argument params:

```typescript
interface ToJSONSchemaParams {
  target?: "draft-04" | "draft-07" | "draft-2020-12" | "openapi-3.0"; // default: draft-2020-12
  io?: "input" | "output";              // default: output
  metadata?: $ZodRegistry<Record<string, any>>;
  unrepresentable?: "throw" | "any" | ((ctx) => JSONSchema | "throw" | "any"); // default: throw
  cycles?: "ref" | "throw";             // default: ref
  reused?: "ref" | "inline";            // default: inline
  override?: (ctx) => void;             // mutate ctx.jsonSchema directly
  uri?: (id: string) => string;         // for registry-based conversion
}
```

### `io`

Schemas whose input/output types diverge (`ZodPipe`, `ZodDefault`, coerced primitives) default to representing the **output** type. Use `io: "input"` to get the input side instead:

```typescript
const mySchema = z.string().transform(val => val.length).pipe(z.number());
z.toJSONSchema(mySchema);                  // => { type: "number" }
z.toJSONSchema(mySchema, { io: "input" }); // => { type: "string" }
```

### `unrepresentable`

These have no JSON Schema equivalent and **throw by default**: `z.bigint()`, `z.int64()`, `z.symbol()`, `z.undefined()`, `z.void()`, `z.date()`, `z.map()`, `z.set()`, `z.transform()`, `z.nan()`, `z.custom()`. Set `unrepresentable: "any"` to convert them to `{}` (JSON Schema's `unknown`) instead of throwing. Or pass a **function** that returns a JSON Schema, `"any"`, or `"throw"` — prefer that over `"any"` + `override` when only some types need a substitute.

```typescript
z.toJSONSchema(z.object({ createdAt: z.date(), id: z.bigint() }), {
  unrepresentable: ({ zodSchema }) =>
    zodSchema._zod.def.type === "date" ? { type: "string", format: "date-time" } : "throw",
});
```

### `cycles`

Circular schemas are represented with `$ref` by default (`cycles: "ref"`). Set `cycles: "throw"` to error instead.

### `reused`

A schema referenced multiple times is inlined at each occurrence by default. Set `reused: "ref"` to extract it once into `$defs` and reference it from each usage site.

### `metadata`

Fields registered via `.meta()`/`z.globalRegistry` (title, description, examples, arbitrary keys) are copied verbatim into the output JSON Schema and **win over** keywords Zod generates (`z.string().meta({ type: "number" })` emits `{ type: "number" }`). See [metadata-registries.md](metadata-registries.md).

### `override`

Full escape hatch — runs after conversion, with access to both the source Zod schema and the generated JSON Schema:

```typescript
// represent z.date() as an ISO datetime string instead of throwing
z.toJSONSchema(z.date(), {
  unrepresentable: "any",
  override: (ctx) => {
    if (ctx.zodSchema._zod.def.type === "date") {
      ctx.jsonSchema.type = "string";
      ctx.jsonSchema.format = "date-time";
    }
  },
});
```

Unrepresentable types throw *before* `override` runs. Substitute a single type with an `unrepresentable` function (above); `unrepresentable: "any"` + `override` still works but erases every unrepresentable type.

## Conversion reference

**String formats** — via `format`: `z.email()` → `email`, `z.iso.datetime()` → `date-time`, `z.iso.date()` → `date`, `z.iso.duration()` → `duration`, `z.ipv4()`/`z.ipv6()` → `ipv4`/`ipv6`, `z.uuid()`/`z.guid()` → `uuid`, `z.url()` → `uri`. Via `contentEncoding`: `z.base64()`. Via `pattern` (no native JSON Schema format exists): `z.iso.time()`, `z.base64url()`, `z.cuid()`, `z.emoji()`, `z.nanoid()`, `z.cuid2()`, `z.ulid()`, `z.cidrv4()`, `z.cidrv6()`, `z.mac()`.

**Numeric types** — `z.number()` → `{ type: "number" }`; `z.float32()`/`z.float64()` add `exclusiveMinimum`/`exclusiveMaximum`; `z.int()`/`z.int32()` → `{ type: "integer" }` (int32 additionally bounded).

**Objects** — plain `z.object()` sets `additionalProperties: false` (accurately reflecting Zod's default stripping behavior); in `io: "input"` mode `additionalProperties` is omitted entirely. `z.looseObject()` never sets it; `z.strictObject()` always sets it.

**Files** — `z.file()` → `{ type: "string", format: "binary", contentEncoding: "binary" }`, plus `contentMediaType` from `.mime()` and `minLength`/`maxLength` from `.min()`/`.max()`.

**Nullability** — `z.null()` → `{ type: "null" }`. `z.nullable(x)` → `{ oneOf: [x, { type: "null" }] }`. `z.optional(x)` is represented as `x` with an `optional` annotation (JSON Schema has no native concept of an optional property outside of `required`).

## `z.fromJSONSchema()`

Experimental — not considered stable API, may change shape in future releases.

```typescript
const jsonSchema = {
  type: "object",
  properties: { name: { type: "string" }, age: { type: "number" } },
  required: ["name", "age"],
};
const zodSchema = z.fromJSONSchema(jsonSchema);
```

## Registries: multi-schema output

For a set of interlinked schemas (e.g. to write out as separate `.json` files), register each with an `id` and pass the registry itself into `z.toJSONSchema()`. Only schemas with a registered `id` are included.

```typescript
const User = z.object({ name: z.string(), get posts() { return z.array(Post); } });
const Post = z.object({ title: z.string(), get author() { return User; } });

z.globalRegistry.add(User, { id: "User" });
z.globalRegistry.add(Post, { id: "Post" });

z.toJSONSchema(z.globalRegistry);
// => { schemas: { User: {...}, Post: {...} } }, cross-refs like { $ref: "Post" }
```

Use `uri` to turn relative `$ref`s into fully-qualified URIs, e.g. for serving from a file server:

```typescript
z.toJSONSchema(z.globalRegistry, { uri: (id) => `https://example.com/${id}.json` });
```
