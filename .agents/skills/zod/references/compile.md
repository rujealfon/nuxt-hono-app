# AOT compilation (4.5+)

`z.compile(schema)` walks a schema once and attaches a loop-free fast path. The result is still a normal Zod schema (same `.parse()` / `.safeParse()` / inferred types / issues). Reach for it on a **measured hot path** with object, tuple, or array schemas — not by default, and not in a library.

```typescript
const Player = z.object({ username: z.string(), bio: z.string(), xp: z.number() });
const CompiledPlayer = z.compile(Player);

CompiledPlayer.parse({ username: "ok", bio: "", xp: 1 });
```

Compile the **final** schema. Methods that derive a new schema (`.refine()`, `.extend()`, `.optional()`, `.meta()`, …) return an uncompiled schema:

```typescript
// ❌ the .refine() result is not compiled
z.compile(z.string()).refine((val) => val.length > 1);

// ✅
z.compile(z.string().refine((val) => val.length > 1));
```

## Global mode

`import "zod/compile"` (must run before any schema is defined) compiles each schema lazily on first parse. Apps only — not libraries.

```typescript
import "zod/compile";
import * as z from "zod";

const schema = z.object({ name: z.string() });
schema.parse({ name: "ok" }); // compiled on first parse
```

Equivalent preload: `node --import zod/compile app.js` (ESM) or `node --require zod/compile app.cjs`.

## Fallback

Unsupported features eject: `z.compile()` returns the original schema unchanged.

- async refinements, transforms, and checks
- `z.xor()`, recursive schemas, `z.coerce.*`
- checks with a custom `when`
- `.catch()` given a callback (a constant `.catch(value)` compiles)

An unsupported child inside an object/array/tuple/record/intersection stays on the standard parser; the surrounding structure can still compile. A union with an unsupported member, a `.catch()` callback, or anything async anywhere in the subtree falls the whole schema back. Encoding (`z.encode()`) and async parse always use the standard parser.

Invalid input also falls back to the uncompiled parser, so compilation does not speed up failures. `{ strict: true }` throws instead of falling back (`ZodCompileAsyncError` for async, `ZodCompileUnsupportedError` otherwise).

## CSP and bundle size

Compilation uses `new Function`. Global mode stands down under `z.config({ jitless: true })`. A direct `z.compile()` still tries; if the environment rejects it, the schema comes back uncompiled.

The compiler is ~7 KB gzipped when used and tree-shaken completely when nothing calls `z.compile()` or imports `zod/compile`.
