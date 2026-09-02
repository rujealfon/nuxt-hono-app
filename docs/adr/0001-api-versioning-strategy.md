# API versioning strategy

`apps/api` mounts all business routes (`auth`, `admin`, and future modules) under `/v1` in `app.ts`, via a `v1` sub-router. `health` and `docs` (`/`, `/health`, `/docs`, `/openapi.json`) stay unversioned at root — they're infra endpoints, not part of the versioned contract.

There is no `v2` today. This records the plan for when one becomes necessary, so the decision isn't re-litigated or done ad hoc under deadline pressure.

## Decision

When a breaking change is needed, do a **full cutover**, not per-endpoint versioning: add a `v2` sub-router mounted alongside `v1` in `app.ts`, keep `v1` running for a deprecation window, and point the mount (and every module path in `packages/types`' `authHttp` and any sibling `*Http` objects) at `v2` in one shot — with `hono/client` the client's paths follow `AppType` automatically (see `docs/adr/0002-hono-client-rpc.md`). Modules whose contract didn't change are mounted on _both_ `v1` and `v2` by reusing the same router instance — they are not duplicated into a `v2` copy.

## Why full cutover, not per-module versioning

The API has exactly two consumers — `apps/app` and `apps/admin` — both owned in this repo, both deployed together. There's no third-party integrator that needs some endpoints to move to v2 while others stay on v1. Per-module versioning (tracking which version each endpoint is on, in both the client and the server) is real complexity that only pays off with independent external consumers. Given single-owner clients, that complexity isn't worth it — the client just points at v2 everywhere once v2 is ready.

## Consequences

- `v1` stays mounted (undeleted) until the deprecation window closes, so `app.ts` briefly carries two sub-routers.
- `configureOpenAPI` generates one spec from whatever's mounted — `v1` and `v2` paths will appear side by side in Scalar during the overlap. Splitting into two specs is only worth doing once `v1` is actually being sunset, not just coexisting briefly.
- A module with an unchanged contract is mounted twice (`v1` and `v2`) rather than forked — keeps one source of truth instead of two copies drifting apart.
