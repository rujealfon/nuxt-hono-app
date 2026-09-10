# Codecs

Every Zod schema already processes data in two directions: forward (`Input → Output`, via `.parse()`/`.decode()`) and backward (`Output → Input`, via `.encode()`). For most schemas input and output types are identical, so the distinction doesn't matter. `z.codec()` is for the cases where they diverge on purpose — a genuine bidirectional transformation between two different types.

```typescript
const stringToDate = z.codec(
  z.iso.datetime(), // input schema: ISO date string
  z.date(),          // output schema: Date object
  {
    decode: (isoString) => new Date(isoString), // ISO string → Date
    encode: (date) => date.toISOString(),        // Date → ISO string
  }
);

stringToDate.decode("2024-01-15T10:30:00.000Z"); // => Date
stringToDate.encode(new Date("2024-01-15"));       // => "2024-01-15T00:00:00.000Z"

// top-level equivalents, usable with any schema (not just codecs)
z.decode(stringToDate, "2024-01-15T10:30:00.000Z");
z.encode(stringToDate, new Date("2024-01-15"));
```

Reach for a codec instead of `.transform()` whenever the same schema needs to serialize data back to its original shape — a network boundary shared between client and server, or a form that needs to round-trip. A plain `.transform()` is one-directional; calling `.encode()` on a schema containing one throws a runtime error.

## Runtime `z.input()` / `z.output()` (4.5+)

Distinct from the type helpers `z.input<typeof schema>` / `z.output<typeof schema>`. The functions project a schema onto its input or output side — useful for validating the two halves of a codec nested inside an object, where `.in` / `.out` cannot reach.

```typescript
const Event = z.object({ name: z.string(), at: stringToDate });

z.input(Event).parse({ name: "launch", at: "2024-01-01T00:00:00Z" }); // ✅
z.output(Event).parse({ name: "launch", at: new Date() });            // ✅
```

Only codecs have two real sides. `z.output()` on a one-way `.transform()` returns the transform (validates nothing); `z.input()` on a `z.preprocess()` returns the schema the preprocessor feeds. With a codec underneath, `z.input()` drops a `.default()`/`.catch()` and `z.output()` drops a `.prefault()`.

## Inverting codecs

```typescript
const dateToString = z.invertCodec(stringToDate);
dateToString.decode(new Date("2024-01-15T10:30:00.000Z")); // => string
dateToString.encode("2024-01-15T10:30:00.000Z");             // => Date
```

`z.invertCodec()` only inverts the codec passed to it directly — it doesn't recursively invert codecs nested inside another schema.

## Composability

Codecs nest inside objects, arrays, pipes, etc., like any other schema:

```typescript
const payloadSchema = z.object({ startDate: stringToDate });
payloadSchema.decode({ startDate: "2024-01-15T10:30:00.000Z" }); // => { startDate: Date }
```

## Type-safe inputs

`.parse()` accepts `unknown` and returns the inferred output — type errors only show up at runtime. `z.decode()`/`z.encode()` are strongly typed, catching mismatches at compile time:

```typescript
stringToDate.parse(12345);  // no TS complaint (fails at runtime)
stringToDate.decode(12345); // ❌ TS error: number not assignable to string
```

## Async and safe variants

```typescript
stringToDate.decodeAsync("...");     // Promise<Date>
stringToDate.safeDecode("...");      // { success, data } | { success, error }
stringToDate.safeDecodeAsync("...");  // Promise<...>
```

## How encoding interacts with other schema features

- **Pipes** — encoding reverses the pipe direction (encode with the second schema, then the first).
- **Refinements** (`.refine()`, `.min()`, etc.) — run in *both* directions. Zod does a type-check pass before running refinement logic during `encode()`, so mutating transforms like `.trim()`/`.toLowerCase()` behave consistently either way.
- **Defaults / prefaults** — only applied on the *forward* (decode) direction. `undefined` is not a valid `encode()` input once a default is attached.
- **Catch** — only applied on the forward direction; `encode()` on invalid data still throws.
- **`z.stringbool()`** — internally a codec; encoding a boolean produces the *first* string in the matching `truthy`/`falsy` array.
- **`.transform()`** — one-directional. `encode()` on a schema containing one throws `Error: Encountered unidirectional transform during encode`.

## Useful codecs (copy/paste)

These aren't first-class Zod APIs — copy them into your project and adjust as needed.

```typescript
// string ↔ number
const stringToNumber = z.codec(z.string().regex(z.regexes.number), z.number(), {
  decode: (str) => Number.parseFloat(str),
  encode: (num) => num.toString(),
});

// string ↔ int
const stringToInt = z.codec(z.string().regex(z.regexes.integer), z.int(), {
  decode: (str) => Number.parseInt(str, 10),
  encode: (num) => num.toString(),
});

// ISO datetime string ↔ Date
const isoDatetimeToDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

// Unix seconds ↔ Date
const epochSecondsToDate = z.codec(z.int().min(0), z.date(), {
  decode: (seconds) => new Date(seconds * 1000),
  encode: (date) => Math.floor(date.getTime() / 1000),
});

// JSON string ↔ parsed/validated value
const jsonCodec = <T extends z.core.$ZodType>(schema: T) =>
  z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString);
      } catch (err: any) {
        ctx.issues.push({ code: "invalid_format", format: "json", input: jsonString, message: err.message });
        return z.NEVER;
      }
    },
    encode: (value) => JSON.stringify(value),
  });

// base64 ↔ Uint8Array
const base64ToBytes = z.codec(z.base64(), z.instanceof(Uint8Array), {
  decode: (base64String) => z.util.base64ToUint8Array(base64String),
  encode: (bytes) => z.util.uint8ArrayToBase64(bytes),
});
```

Other implementations documented upstream, following the same pattern: `stringToBigInt`, `numberToBigInt`, `epochMillisToDate`, `utf8ToBytes`, `bytesToUtf8`, `base64urlToBytes`, `hexToBytes`, `stringToURL`, `stringToHttpURL`, `uriComponent` (encode/decode via `encodeURIComponent`/`decodeURIComponent`).
