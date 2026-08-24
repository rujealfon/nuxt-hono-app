# Zod Skill

Define, validate, and parse data with Zod (v4) — request bodies, form inputs,
environment variables, API responses, and any other untrusted or external
data in TypeScript/JavaScript.

## Version

- Skill version: **1.1.0** — see [CHANGELOG.md](CHANGELOG.md)
- Tracks: `zod` 4.x — verified against 4.4.3 on 2026-08-23
- Docs: https://zod.dev/llms.txt

## Installation

Install the skill with:

```bash
npx skills add rujealfon/skills --skill zod
```

Then ask your agent:

```text
Use $zod to validate this API request body and infer its TypeScript type.
```

## Coverage

Zod 4 schemas, refinements/transforms (including `.overwrite()`), codecs, errors, JSON Schema, metadata/registries, and Zod 3 → 4 migration. The installed `zod` version is the API authority.

Won't add: `z.compile()` AOT (canary-only as of 4.4.3), `z.creditCard()` / `.exactPartial()` (post-4.4.3), ecosystem catalog, library-authors packaging beyond the existing Mini/core pointer.

## Contents

- [SKILL.md](SKILL.md) contains the core agent workflow.
- [references/schema-types.md](references/schema-types.md) covers every schema type and its modifiers.
- [references/refinements-transforms.md](references/refinements-transforms.md) covers refinements, transforms, pipes, and value modifiers.
- [references/errors.md](references/errors.md) covers error customization and formatting.
- [references/codecs.md](references/codecs.md) covers bidirectional transforms.
- [references/json-schema.md](references/json-schema.md) covers JSON Schema conversion.
- [references/metadata-registries.md](references/metadata-registries.md) covers metadata and registries.
- [references/migration-v3-to-v4.md](references/migration-v3-to-v4.md) covers the Zod 3 → 4 migration and package variant selection.

## License

Repository content is available under the root [MIT License](../../LICENSE).
