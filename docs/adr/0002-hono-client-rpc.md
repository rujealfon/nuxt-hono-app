# hono/client RPC for the auth client

`packages/auth` is the fetch layer between the Nuxt SPAs and `apps/api`. It used to be a hand-written client: literal paths from `packages/types`' `authHttp`, Zod validation of both request inputs and success responses. This ADR records why it now builds on `hono/client` (`hc<AppType>`), what coupling that buys, and what it costs.

## Decision

`createAuthClient` is built on `hc<AppType>`:

- `apps/api/src/app.ts` exports `type AppType = typeof app` from the un-annotated `base.route(...).route(...)` chain, exposed types-only via the `./app` package export.
- `packages/auth` imports it **type-only** and lists `@nuxt-app/api` as a **devDependency** — the import is erased at runtime, so nothing from the API ships to the browser and no runtime dependency exists.
- Paths come from route inference (`client.v1.auth.login.$post({ json: input })`), request types from the route's Zod body schema, response types from the route's success responses. `authHttp`'s `.path` strings and the client-side success schemas (`authResponseSchema` etc.) are no longer consumed by the client.
- A wrapped `fetch` preserves what the hand-written client earned: `credentials: 'include'`, `redirect: 'manual'`, Vercel SSO protection-redirect detection (preview-locked error; `me()` returns `{ user: null }`), and error-body mapping through `messageFromFailedBody`.

## Why

Request shapes were already shared through `packages/types` (`loginSchema`/`registerSchema`), so the hand-written client's remaining duplication was paths and response shapes — exactly what RPC infers. Trusting compile-time response types (instead of re-validating with Zod at runtime) is the trade: the client validates error bodies (their shape varies and they surface to users) and trusts typed success bodies.

## Consequences

- **Type-only coupling is real.** Type-checking `packages/auth` (and transitively the Nuxt apps) now compiles `apps/api`'s route chain. One un-typed handler or non-chained `.route()` silently degrades `AppType` and the client stops compiling — self-checking, but it widens the Turbo type-check graph (`packages/auth` type-check depends on the API's sources).
- **`app.ts` must stay inference-friendly**: keep `const app = base.route(...)...` un-annotated (an explicit `Hono<AppEnv>` annotation erases route types) and keep route definitions chained.
- Success-body drift is caught at type-check time, not runtime; a malformed 200 now flows through instead of throwing `'Invalid response'`.
- Runtime responses must still be JSON — non-JSON bodies throw `'Request failed'` at the `res.json()` boundary.
