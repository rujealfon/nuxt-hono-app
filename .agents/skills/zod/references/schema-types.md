# Schema types

## Contents

- [Primitives and coercion](#primitives-and-coercion)
- [Literals](#literals)
- [Strings](#strings)
- [String formats](#string-formats)
- [Template literals](#template-literals)
- [Numbers, integers, bigints, booleans, dates](#numbers-integers-bigints-booleans-dates)
- [Enums and stringbool](#enums-and-stringbool)
- [Optional, nullable, nullish, unknown, never](#optional-nullable-nullish-unknown-never)
- [Objects](#objects)
- [Recursive objects](#recursive-objects)
- [Arrays and tuples](#arrays-and-tuples)
- [Unions, XOR, discriminated unions, intersections](#unions-xor-discriminated-unions-intersections)
- [Records](#records)
- [Maps and sets](#maps-and-sets)
- [Files](#files)
- [Instanceof and property](#instanceof-and-property)

## Primitives and coercion

```typescript
import * as z from "zod";

z.string();
z.number();
z.bigint();
z.boolean();
z.symbol();
z.undefined();
z.null();
```

`z.coerce.*` attempts to convert the input using the corresponding JS constructor before validating:

```typescript
z.coerce.string();  // String(input)
z.coerce.number();  // Number(input)
z.coerce.boolean(); // Boolean(input)
z.coerce.bigint();  // BigInt(input)

z.coerce.string().parse(42); // => "42"
```

Coerced schemas have input type `unknown` by default. Pass a generic to narrow it: `z.coerce.number<number>()`.

## Literals

```typescript
const tuna = z.literal("tuna");
const twelve = z.literal(12);
const twobig = z.literal(2n);
const tru = z.literal(true);

// null / undefined
z.null();
z.undefined();
z.void(); // equivalent to z.undefined()

// multiple allowed values
const colors = z.literal(["red", "green", "blue"]);
colors.parse("green"); // ✅
colors.values;         // => Set<"red" | "green" | "blue">
```

## Strings

```typescript
z.string().max(5);
z.string().min(5);
z.string().length(5);
z.string().regex(/^[a-z]+$/);
z.string().startsWith("aaa");
z.string().endsWith("zzz");
z.string().includes("---");
z.string().uppercase();
z.string().lowercase();

// transforms
z.string().trim();
z.string().toLowerCase();
z.string().toUpperCase();
z.string().normalize();
```

## String formats

Top-level format functions (preferred in v4 — see [migration-v3-to-v4.md](migration-v3-to-v4.md)):

```typescript
z.email();
z.uuid();
z.url();
z.httpUrl();  // http/https only
z.hostname();
z.e164();     // E.164 phone numbers
z.emoji();
z.base64();
z.base64url();
z.hex();
z.jwt();
z.nanoid();
z.cuid();
z.cuid2();
z.ulid();
z.ipv4();
z.ipv6();
z.mac();
z.cidrv4();
z.cidrv6();
z.hash("sha256"); // or "sha1" | "sha384" | "sha512" | "md5"
z.iso.date();
z.iso.time();
z.iso.datetime();
z.iso.duration();
```

**Emails**: default regex is comparatively strict (roughly matches Gmail's rules). Customize with `pattern`:

```typescript
z.email({ pattern: z.regexes.html5Email });    // browser input[type=email] behavior
z.email({ pattern: z.regexes.rfc5322Email });  // classic RFC 5322 regex
z.email({ pattern: z.regexes.unicodeEmail });  // permissive, allows Unicode
```

**UUIDs**: `z.uuid()` is RFC 9562/4122-strict (requires the variant bits). For any UUID-shaped string, use `z.guid()`. Version-specific shorthands: `z.uuidv4()`, `z.uuidv6()`, `z.uuidv7()`, or `z.uuid({ version: "v4" })`.

**URLs**: `z.url()` uses `new URL()` internally, so it's permissive (accepts `mailto:`, `http://localhost`, etc). Constrain with `hostname`/`protocol` regexes:

```typescript
const httpUrl = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
});
```

Use `{ normalize: true }` to overwrite the input with `new URL().href`'s normalized form.

**Phone numbers**: `z.e164()` validates leading `+`, non-zero country code, 7–15 digits total. Zod does not provide fuzzier phone validation — layer a `.refine()` on top if you need it.

**ISO datetimes**: regex-based, not a full date library, but convenient for input validation.

```typescript
z.iso.datetime();                     // no offset, no local (2020-01-01T06:15:00Z only)
z.iso.datetime({ offset: true });     // allows +02:00 style offsets (not +02 or +0200)
z.iso.datetime({ local: true });      // allows timezone-less datetimes, seconds optional
z.iso.datetime({ precision: -1 });    // minute precision (no seconds)
z.iso.datetime({ precision: 0 });     // second precision only
z.iso.datetime({ precision: 3 });     // millisecond precision only

z.iso.date();   // YYYY-MM-DD
z.iso.time();   // HH:MM[:SS[.s+]], no offsets of any kind allowed
z.iso.time({ precision: 3 }); // millisecond precision
```

**IP / CIDR / MAC**:

```typescript
z.ipv4().parse("192.168.0.0");
z.ipv6().parse("2001:db8:85a3::8a2e:370:7334");
z.cidrv4().parse("192.168.0.0/24");
z.cidrv6().parse("2001:db8::/32");

z.mac().parse("00:1A:2B:3C:4D:5E");       // colon-delimited by default
z.mac({ delimiter: "-" }).parse("00-1A-2B-3C-4D-5E");
```

**JWTs and hashes**:

```typescript
z.jwt();
z.jwt({ alg: "HS256" });

z.hash("sha256");                          // hex by default
z.hash("sha256", { enc: "base64" });
z.hash("sha256", { enc: "base64url" });
```

**Custom formats**: `z.stringFormat()` produces a more descriptive `"invalid_format"` issue than a `.refine()`/`z.custom()` would.

```typescript
const coolId = z.stringFormat("cool-id", (val) => {
  return val.length === 100 && val.startsWith("cool-");
});
// a regex is also accepted:
z.stringFormat("cool-id", /^cool-[a-z0-9]{95}$/);
```

## Template literals

```typescript
z.templateLiteral(["hello, ", z.string(), "!"]);
// `hello, ${string}!`

z.templateLiteral(["hi there"]);                              // `hi there`
z.templateLiteral(["email: ", z.string()]);                   // `email: ${string}`
z.templateLiteral(["high", z.literal(5)]);                    // `high5`
z.templateLiteral([z.nullable(z.literal("grassy"))]);         // `grassy` | `null`
z.templateLiteral([z.number(), z.enum(["px", "em", "rem"])]); // `${number}px` | `${number}em` | `${number}rem`
```

Any schema whose inferred type is assignable to `string | number | bigint | boolean | null | undefined` can be interpolated.

## Numbers, integers, bigints, booleans, dates

```typescript
z.number(); // any finite number — NaN and Infinity are rejected

z.number().gt(5);
z.number().gte(5);       // alias .min(5)
z.number().lt(5);
z.number().lte(5);       // alias .max(5)
z.number().positive();   // alias .gt(0)
z.number().nonnegative();
z.number().negative();
z.number().nonpositive();
z.number().multipleOf(5); // alias .step(5)

z.nan(); // validates NaN specifically, if you actually need that

z.int();     // safe integer range
z.int32();   // [-2147483648, 2147483647]
z.uint32();  // [0, 4294967295]
z.float32();
z.float64();

z.int64();   // ZodBigInt, signed 64-bit range
z.uint64();  // ZodBigInt, unsigned 64-bit range

z.bigint().gt(5n).gte(5n).lt(5n).lte(5n).positive().nonnegative().negative().nonpositive().multipleOf(5n);

z.boolean();

z.date();
z.date().min(new Date("1900-01-01"), { error: "Too old!" });
z.date().max(new Date(), { error: "Too young!" });
```

## Enums and stringbool

```typescript
const FishEnum = z.enum(["Salmon", "Tuna", "Trout"]);
FishEnum.parse("Salmon"); // => "Salmon"
```

Pass the array literal directly (or use `as const`) — assigning it to a variable first widens the inferred type to `string`.

```typescript
const fish = ["Salmon", "Tuna", "Trout"] as const;
const FishEnum = z.enum(fish);
```

`z.enum()` also accepts enum-like object literals and TypeScript's `enum` — prefer `z.enum()` over the deprecated `z.nativeEnum()`.

```typescript
enum Fish { Salmon = 0, Tuna = 1 }
const FishEnum = z.enum(Fish);
FishEnum.parse(Fish.Salmon); // ✅
```

```typescript
FishEnum.enum;                          // { Salmon: "Salmon", ... } — extract as enum-like object
FishEnum.exclude(["Salmon", "Trout"]);  // new enum schema, excluding values
FishEnum.extract(["Salmon", "Trout"]);  // new enum schema, only these values
```

`z.stringbool()` parses "boolish" strings (env vars, form fields) into a real `boolean`:

```typescript
const strbool = z.stringbool();
strbool.parse("true"); strbool.parse("1"); strbool.parse("yes"); strbool.parse("on"); strbool.parse("y"); strbool.parse("enabled"); // => true
strbool.parse("false"); strbool.parse("0"); strbool.parse("no"); strbool.parse("off"); strbool.parse("n"); strbool.parse("disabled"); // => false

// customize truthy/falsy sets (these are the defaults) and case sensitivity
z.stringbool({
  truthy: ["true", "1", "yes", "on", "y", "enabled"],
  falsy: ["false", "0", "no", "off", "n", "disabled"],
  case: "sensitive", // default is case-insensitive
});
```

## Optional, nullable, nullish, unknown, never

```typescript
z.optional(z.literal("yoda")); // or z.literal("yoda").optional()
optionalYoda.unwrap();         // extract inner schema

z.nullable(z.literal("yoda")); // or .nullable()
nullableYoda.unwrap();

z.nullish(z.literal("yoda"));  // optional AND nullable

z.exactOptional(z.string()); // or z.string().exactOptional() — absent key ok, explicit undefined fails

z.any();     // inferred type: any
z.unknown(); // inferred type: unknown
z.never();   // no value passes
```

## Objects

```typescript
const Person = z.object({
  name: z.string(),
  age: z.number(),
}); // all properties required by default

const Dog = z.object({
  name: z.string(),
  age: z.number().optional(),
});
```

Unknown keys are stripped by default. Use the top-level variants to change that behavior — prefer these over the deprecated `.strict()`/`.passthrough()` methods:

```typescript
z.strictObject({ name: z.string() }); // throws on unknown keys
z.looseObject({ name: z.string() });  // passes unknown keys through
```

```typescript
z.object({ name: z.string(), age: z.number().optional() }).catchall(z.string());
// validates any unrecognized key's *value* against z.string()
```

**Introspection**: `.shape` (access inner schemas), `.keyof()` (build a `ZodEnum` from the keys).

**Extending**: `.extend()` can overwrite existing keys and gets quadratically more expensive when chained. Prefer spread syntax for merges — it works identically in Zod and Zod Mini and is `tsc`-cheaper:

```typescript
const DogWithBreed = z.object({
  ...Animal.shape,
  ...Pet.shape,
  breed: z.string(),
});
```

`.safeExtend()` refuses to overwrite a field with a non-assignable schema (type-checked), and — unlike `.extend()` — works on schemas that already carry a `.refine()`:

```typescript
const Base = z.object({ a: z.string(), b: z.string() }).refine(u => u.a === u.b);
const Extended = Base.safeExtend({ a: z.string().min(10) }); // inherits Base's refinement
```

**Pick / omit / partial / required**:

```typescript
Recipe.pick({ title: true });
Recipe.omit({ id: true });
Recipe.partial();                          // all fields optional
Recipe.partial({ ingredients: true });     // only these fields optional
Recipe.required();                         // all fields required
Recipe.required({ description: true });    // only these fields required
```

## Recursive objects

Use a getter so JavaScript can resolve the cyclical schema at runtime:

```typescript
const Category = z.object({
  name: z.string(),
  get subcategories() {
    return z.array(Category);
  },
});
```

Mutually recursive types work the same way. All object APIs (`.pick()`, `.omit()`, `.required()`, `.partial()`, etc.) work as expected on recursive schemas. Passing cyclical *data* (not just a cyclical schema) into `.parse()` causes an infinite loop.

**Circularity errors**: some recursive getters trigger `ts(7023)` ("implicitly has return type 'any'"). Fix with an explicit return type annotation on the getter:

```typescript
const Activity = z.object({
  name: z.string(),
  get subactivities(): z.ZodNullable<z.ZodArray<typeof Activity>> {
    return z.nullable(z.array(Activity));
  },
});
```

## Arrays and tuples

```typescript
const stringArray = z.array(z.string()); // or z.string().array()
stringArray.unwrap(); // inner element schema

z.array(z.string()).min(5);
z.array(z.string()).max(5);
z.array(z.string()).length(5);
```

Tuples are fixed-length, per-index-typed. A rest argument makes the tail variadic:

```typescript
const MyTuple = z.tuple([z.string(), z.number(), z.boolean()]);
// [string, number, boolean]

const variadicTuple = z.tuple([z.string()], z.number());
// [string, ...number[]]
```

## Unions, XOR, discriminated unions, intersections

Regular unions check each option in order and return the first match:

```typescript
const stringOrNumber = z.union([z.string(), z.number()]);
stringOrNumber.options; // [ZodString, ZodNumber]
```

`z.xor()` requires *exactly one* option to match — it fails on zero matches AND on multiple matches (useful for mutually-exclusive payload shapes). Default `z.object()` strips unknown keys, so two object branches can both match; use `z.strictObject()` on the narrower branch:

```typescript
const payment = z.xor([
  z.strictObject({ type: z.literal("card"), cardNumber: z.string() }),
  z.strictObject({ type: z.literal("bank"), accountNumber: z.string() }),
]);
```

Discriminated unions are faster than regular unions for large object unions that share a literal "tag" key — Zod uses the discriminator to pick the right branch instead of trying each in order:

```typescript
const MyResult = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), data: z.string() }),
  z.object({ status: z.literal("failed"), error: z.string() }),
]);
```

Each branch's discriminator should be a `z.literal()`, `z.enum()`, `z.null()`, or `z.undefined()`.

Intersections (`A & B`) are a logical AND. For merging two *object* schemas, prefer `A.extend(B.shape)` (or spread) over `z.intersection()` — the result stays a full object schema with `.pick()`/`.omit()`/etc, whereas `z.intersection()` returns a bare `ZodIntersection`.

## Records

```typescript
const IdCache = z.record(z.string(), z.string()); // Record<string, string>
```

Numeric key schemas validate the key as a numeric *string*, including further constraints (`z.record(z.int().min(0).max(10), z.string())`).

`z.record()` with an enum/literal key schema exhaustively requires every possible key to be present, mirroring TypeScript's `Record<"a"|"b", T>`. Use `z.partialRecord()` when the keys should be optional:

```typescript
const Keys = z.enum(["id", "name", "email"]).or(z.never());
const Person = z.partialRecord(Keys, z.string()); // { id?: string; name?: string; email?: string }
```

`z.looseRecord()` passes through keys that don't match the key schema instead of erroring — useful combined with `.and()` to model "known field + pattern properties":

```typescript
const schema = z.object({ name: z.string() })
  .and(z.looseRecord(z.string().regex(/_phone$/), z.e164()));
```

## Maps and sets

```typescript
const StringNumberMap = z.map(z.string(), z.number()); // Map<string, number>

const NumberSet = z.set(z.number()); // Set<number>
z.set(z.string()).min(5);
z.set(z.string()).max(5);
z.set(z.string()).size(5);
```

## Files

```typescript
const fileSchema = z.file();
fileSchema.min(10_000);                          // min .size (bytes)
fileSchema.max(1_000_000);                        // max .size (bytes)
fileSchema.mime("image/png");
fileSchema.mime(["image/png", "image/jpeg"]);
```

`z.promise()` is deprecated — `await` the value before parsing it instead.

## Instanceof and property

```typescript
class Test { name: string; }
const TestSchema = z.instanceof(Test);
TestSchema.parse(new Test()); // ✅
```

`z.property()` checks a specific property of any value against a schema — most useful combined with `z.instanceof()`:

```typescript
const httpsOnly = z.instanceof(URL).check(
  z.property("protocol", z.literal("https:"))
);
```
