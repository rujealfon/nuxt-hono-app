# Drizzle Postgres Skill

Build, migrate, query, and troubleshoot PostgreSQL data layers with Drizzle
ORM and Drizzle Kit.

## Version

- Skill version: **1.1.0** — see [CHANGELOG.md](CHANGELOG.md)
- Tracks: `drizzle-orm` 0.45.x — verified against 0.45.2 on 2026-08-23
- Tracks: `drizzle-kit` 0.31.x — verified against 0.31.10 on 2026-08-23
- Docs: https://orm.drizzle.team/llms.txt
- **Pending upstream: `drizzle-orm` 1.0** is in release candidate (1.0.0-rc.5). 0.45.x remains the primary target. 1.0 breaking changes live in [references/migration-0.45-to-1.0.md](references/migration-0.45-to-1.0.md). When 1.0 ships stable, re-verify that reference, flip the primary target, and bump the tracked line.

## Installation

Install the skill with:

```bash
npx skills add rujealfon/skills --skill drizzle-postgres
```

Then ask your agent:

```text
Use $drizzle-postgres to add a users/posts schema with relations to this Postgres project.
```

## Coverage

Postgres schema, relations (legacy `relations()` and `defineRelations()`), queries, Drizzle Kit migrations, driver setup (including PlanetScale Postgres, Bun SQL, and HTTP proxy), and 0.45.x → 1.0 RC migration. The installed `drizzle-orm`/`drizzle-kit` versions remain the API authority.

Won't add: ESLint plugin, drizzle-graphql, kit web/mobile walkthroughs, community dialects.

## Contents

- [SKILL.md](SKILL.md) contains the core agent workflow.
- [references/schema.md](references/schema.md) covers table/column declaration and Postgres column types.
- [references/relations.md](references/relations.md) covers relation declarations and the relational query API.
- [references/queries.md](references/queries.md) covers CRUD, operators, joins, and transactions.
- [references/migrations.md](references/migrations.md) covers Drizzle Kit config, commands, and seeding.
- [references/connections.md](references/connections.md) covers driver setup per provider.
- [references/postgres-advanced.md](references/postgres-advanced.md) covers RLS, sequences, extensions, and validation integration.
- [references/migration-0.45-to-1.0.md](references/migration-0.45-to-1.0.md) covers the 0.45.x → 1.0 breaking changes and migration checklist.

## License

Repository content is available under the root [MIT License](../../LICENSE).
