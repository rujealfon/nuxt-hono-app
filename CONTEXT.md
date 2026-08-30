# nuxt-app

Users sign in with email and password. An opaque session cookie is the only proof of who they are.

## Language

**User**:
A person with an email, name, and role. Callers see `AuthUser`; the row PK stays inside identity and session.
_Avoid_: Account, member, profile

**AuthUser**:
The public user: `id` (the `public_id`), email, name, and role. Never the UUID PK.
_Avoid_: User DTO, session user payload

**Session**:
An opaque id stored in the `nuxt_app_session` cookie and a matching row. Login starts it only when admission passes, logout ends it, every request reads the current user from it.
_Avoid_: Token, JWT, auth ticket

**Admin**:
A user whose role is `admin`. `pnpm db:ensure-admin` promotes an email to this role and revokes their sessions. Admin login does not start a Session for a non-admin.
_Avoid_: Superuser, operator

**Route access**:
Whether a visitor may stay on a page: `auth`, `guest`, `guest-admin`, or `admin`. One policy, four Nuxt guards.
_Avoid_: Auth middleware rule, permission check
