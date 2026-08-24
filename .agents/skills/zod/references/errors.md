# Customizing and formatting errors

## The `error` param

Every Zod API accepts an optional custom error message as a trailing argument, or via an `error` param:

```typescript
z.string("Not a string!");
z.string().min(5, "Too short!");
z.uuid("Bad UUID!");
z.array(z.string()).min(5, { error: "Too few items!" });
```

`error` also accepts a function (an "error map") that runs at parse time and receives the issue:

```typescript
z.string({
  error: (iss) => iss.input === undefined ? "Field is required." : "Invalid input.",
});

// checks expose extra fields specific to that check
z.string().min(5, {
  error: (iss) => `Password must have ${iss.minimum} characters or more`,
});
```

Return `undefined` from an error map to decline to customize that particular issue and fall through to the next map in the precedence chain — useful for overriding only specific error codes:

```typescript
z.int64({
  error: (issue) => {
    if (issue.code === "too_big") return { message: `Value must be <${issue.maximum}` };
    return undefined; // defer to default
  },
});
```

## Per-parse error customization

Pass an error map into the parse call itself:

```typescript
schema.parse(12, { error: (iss) => "per-parse custom error" });
```

This has **lower** precedence than a schema-level error (a schema-level message always wins). Discriminate by `iss.code` for issue-specific messages:

```typescript
schema.safeParse(12, {
  error: (iss) => {
    if (iss.code === "invalid_type") return `invalid type, expected ${iss.expected}`;
    if (iss.code === "too_small") return `minimum is ${iss.minimum}`;
  },
});
```

**Including input in issues**: by default Zod omits the raw input from issues (to avoid unintentionally logging sensitive data). Opt in per-parse with `reportInput`:

```typescript
z.string().parse(12, { reportInput: true });
// issue now includes: "input": 12
```

## Global error customization

```typescript
z.config({
  customError: (iss) => {
    if (iss.code === "invalid_type") return `invalid type, expected ${iss.expected}`;
    return "globally modified error";
  },
});
```

## Internationalization

Regular `zod` auto-loads the `en` locale. Zod Mini loads none by default (messages read `"Invalid input"` until you configure one).

```typescript
import * as z from "zod";
import { en } from "zod/locales";
z.config(en());

// lazy-load
async function loadLocale(locale: string) {
  const { default: mod } = await import(`zod/v4/locales/${locale}.js`);
  z.config(mod());
}

// or, non-tree-shakable convenience export
z.config(z.locales.en());
```

40+ locales are available, including `ar`, `de`, `es`, `fr`, `frCA`, `he`, `id`, `it`, `ja`, `ko`, `pl`, `pt`, `ru`, `th`, `tr`, `uk`, `vi`, `zhCN`, `zhTW`, among others.

## Error precedence

Highest to lowest priority when multiple customizations could apply to the same issue:

1. **Schema-level** — `z.string("Not a string!")`
2. **Per-parse** — `schema.parse(12, { error: (iss) => "..." })`
3. **Global error map** — `z.config({ customError: (iss) => "..." })`
4. **Locale error map** — `z.config(z.locales.en())`

> In Zod 3, per-parse error maps outranked schema-level ones. Zod 4 flipped this — see [migration-v3-to-v4.md](migration-v3-to-v4.md).

## Formatting a `ZodError`

Given:

```typescript
const schema = z.strictObject({
  username: z.string(),
  favoriteNumbers: z.array(z.number()),
});

const result = schema.safeParse({
  username: 1234,
  favoriteNumbers: [1234, "4567"],
  extraKey: 1234,
});
```

`result.error.issues` is a flat array of every issue, each with a `path`.

### `z.treeifyError()`

Nests the errors into a structure mirroring the schema — best when you need to walk a deep/nested schema's errors programmatically.

```typescript
const tree = z.treeifyError(result.error);
tree.properties?.username?.errors;
// => ["Invalid input: expected string, received number"]
tree.properties?.favoriteNumbers?.items?.[1]?.errors;
// => ["Invalid input: expected number, received string"]
```

Use optional chaining (`?.`) throughout — paths that had no error are simply absent.

### `z.prettifyError()`

Human-readable string, useful for logs or CLI output:

```typescript
z.prettifyError(result.error);
// ✖ Unrecognized key: "extraKey"
// ✖ Invalid input: expected string, received number
//   → at username
// ✖ Invalid input: expected number, received string
//   → at favoriteNumbers[1]
```

### `z.flattenError()`

For schemas that are only one level deep (most form schemas), this is simpler than `treeifyError`:

```typescript
const flattened = z.flattenError(result.error);
// { formErrors: string[], fieldErrors: { [key: string]: string[] } }

flattened.formErrors;             // top-level errors (path === [])
flattened.fieldErrors.username;   // ["Invalid input: expected string, received number"]
```

### `z.formatError()`

Deprecated — use `z.treeifyError()` instead.
