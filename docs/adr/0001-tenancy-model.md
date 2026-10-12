# ADR 0001 — Tenancy model: shared database, shared schema

- Status: accepted
- Date: 2026-10-08

## Context

TeamDesk is sold per workspace (an `Organization`). We need strong isolation between
tenants, cheap onboarding (a sign-up must not provision infrastructure), and a schema
that a small team can migrate safely. Options considered:

| Option                               | Isolation                        | Cost / ops                                            | Notes                         |
| ------------------------------------ | -------------------------------- | ----------------------------------------------------- | ----------------------------- |
| Database per tenant                  | Strongest                        | High: N migrations, N connection pools                | Overkill for SMB tenants      |
| Schema per tenant                    | Strong                           | Medium: migrations fan out, Prisma support is awkward |                               |
| **Shared schema + `organizationId`** | Enforced in app (+ optional RLS) | Lowest                                                | Industry default for SMB SaaS |

## Decision

Shared database, shared schema. Every tenant-owned table (`Membership`, `Invite`,
`Subscription`, `Project`, `Request`, `Comment`, `AuditLog`, `ApiKey`) has an indexed
`organizationId`. Isolation is enforced in four layers:

1. **Routing / middleware** — `/[orgSlug]` is resolved and membership checked before a page renders.
2. **Services** — every service function receives an `OrgContext` (user, org, membership) built by
   `resolveOrgContext`, and calls `assertCan(ctx, action)` first. Non-members get **404**, not 403,
   so the existence of another tenant's resources is never revealed.
3. **Repositories** — every repo function for a tenant model takes `orgId` as a required argument and
   puts it in the `where` clause (including `update`/`delete`, via Prisma's extended unique `where`).
4. **Prisma client extension** (`server/lib/tenant-guard.ts`) — throws `TenantGuardError` if a
   tenant model is queried without `organizationId` in `where` (or in `data` for creates). It only
   accepts a literal string or `{ equals }` — `in`/`not` are rejected — and also makes `AuditLog`
   append-only (backed by a Postgres trigger).

A small number of deliberate cross-tenant reads (the orgs a user belongs to, invite-token lookup,
Stripe webhook routing) use an explicitly named unguarded client, `systemPrisma`, only from
`server/repos`, in functions suffixed `Unscoped`. ESLint forbids importing the Prisma client
outside `server/repos`.

## Consequences

- One migration path, one connection pool, trivial onboarding.
- A bug in a single layer does not leak data; the guard turns a missing filter into a loud error
  in tests instead of a silent leak in production.
- The guard checks only the top-level `where`; nested relation filters are trusted to the repo layer.
- Next step (roadmap): Postgres Row-Level Security keyed on a per-transaction `app.org_id` setting,
  giving DB-enforced isolation as a fifth layer.
