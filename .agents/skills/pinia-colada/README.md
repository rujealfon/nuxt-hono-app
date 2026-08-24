# Pinia Colada Skill

Build, review, migrate, test, and troubleshoot asynchronous data workflows
with Pinia Colada in Vue and Nuxt applications.

## Version

- Skill version: **1.0.1** — see [CHANGELOG.md](CHANGELOG.md)
- Tracks: `@pinia/colada` 1.x — verified against 1.4.2 on 2026-08-23
- Docs: https://pinia-colada.esm.dev/llms.txt

## Installation

Install the skill with:

```bash
npx skills add rujealfon/skills --skill pinia-colada
```

Then ask your agent:

```text
Use $pinia-colada to implement and verify async data fetching in this Vue application.
```

## Coverage

Queries, mutations, cache, Vue/Nuxt/SSR, official plugins, persistence, TanStack Vue Query migration, and `PINIA_COLADA_*` diagnostics. The installed `@pinia/colada` declarations remain the API authority.

Won't add: community plugin directory.

## Contents

- [SKILL.md](SKILL.md) contains the core agent workflow.
- [references/queries.md](references/queries.md) covers query design and state.
- [references/cache-and-mutations.md](references/cache-and-mutations.md) covers cache consistency and writes.
- [references/integrations.md](references/integrations.md) covers Vue, Nuxt, SSR, and testing.
- [references/plugins-and-persistence.md](references/plugins-and-persistence.md) covers plugins and persistent caches.
- [references/migration.md](references/migration.md) covers migrations and compatibility.
- [references/troubleshooting.md](references/troubleshooting.md) covers diagnostics and runtime errors.

## License

Repository content is available under the root [MIT License](../../LICENSE).
