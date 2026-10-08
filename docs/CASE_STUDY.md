# Case study: TeamDesk — a multi-tenant SaaS built for correctness first

> Draft. Every number below was measured in this repository on 2026-10-08; nothing is projected.

## The problem

Small agencies juggle client requests across email and chat. TeamDesk gives each agency a **workspace**
(tenant) with projects, requests and comments, lets them invite teammates and give clients **read-only**
access, and charges per workspace. The engineering goal was a codebase a hiring team could audit: tenant
isolation that holds even when a developer makes a mistake, billing that never drifts from Stripe, and tests
that prove both.

## What I built

- Next.js 15 (App Router) + TypeScript strict, PostgreSQL + Prisma, Auth.js v5, Redis, Stripe, Resend.
- 23 REST route files (30 handlers) under `/api/v1` with one error shape and cursor pagination.
- 8,458 lines of application TypeScript, 2,829 lines of tests, 5 ADRs.

## Key decisions

### 1. Tenant isolation in layers, so one bug is not a breach

Shared schema with `organizationId` on every tenant table (ADR 0001). Four independent layers:
middleware membership check → `assertCan(ctx, action)` in every service → repositories that _require_
`orgId` → a Prisma client extension that throws if a tenant model is queried without `organizationId`.
Another tenant's IDs return **404**, so workspaces can't even be enumerated. Integration tests attack every
resource type from a second tenant (projects, requests, comments, members, invites, audit entries) by slug
_and_ by ID through the attacker's own workspace.

### 2. Billing that is idempotent and order-safe

Stripe delivers webhooks at least once and out of order (ADR 0003). The event id is inserted with
`ON CONFLICT DO NOTHING` **inside the same transaction** as its effects: replays are no-ops, concurrent
duplicates serialize on the row lock, and a crash rolls back the ledger so Stripe's retry is processed.
`lastEventAt` makes updates monotonic and `canceled` is terminal. A mock mode signs fake events with the real
webhook secret, so local dev and E2E go through the exact production code path without Stripe keys.

### 3. Invariants under concurrency

Plan limits and "keep at least one owner" are enforced in **serializable** transactions with automatic retry.
A test fires five concurrent project creations at a FREE workspace (limit 3) and asserts exactly three succeed.

### 4. Security by default

argon2id; hashed single-use tokens for verification, reset and invites; sessions revoked on password reset
via `sessionVersion`; per-request nonce CSP with `strict-dynamic` (verified in E2E: zero CSP violations);
origin checks on cookie-authenticated API writes; Redis rate limits; append-only audit log backed by a
Postgres trigger.

## Results (measured)

| Metric                                                          | Result                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| Unit tests                                                      | 140 passing                                                       |
| Integration tests (real Postgres + Redis)                       | 80 passing                                                        |
| E2E tests (Playwright, production build)                        | 8 passing                                                         |
| Line coverage of `server/` (unit + integration)                 | 95.1% (branches 93.3%); CI gate 80%                               |
| Lighthouse, 8 signed-in pages (local prod build, mobile preset) | Performance 98–99, Accessibility 100, Best practices 100, SEO 100 |
| Permission matrix                                               | 4 roles × 18 actions, all asserted                                |

## What I'd do next

Postgres Row-Level Security as a DB-enforced fifth layer; per-workspace API keys (model already in place);
SSO; outgoing webhooks. Known gaps are tracked in `docs/TODO.md` (including a mitigated `router.refresh()` race).

## CV bullets

- Built **TeamDesk**, a multi-tenant SaaS (Next.js 15, TypeScript, PostgreSQL/Prisma, Stripe) with four-layer
  tenant isolation — including a Prisma extension that rejects unscoped queries — verified by integration
  tests that return 404 for every cross-tenant access path.
- Implemented **idempotent, order-safe Stripe webhook processing** (dedupe ledger in the same DB transaction,
  monotonic event timestamps, terminal cancellation), covered by 16 billing tests including concurrent replays
  and rollback-and-retry.
- Shipped with **228 automated tests** (140 unit, 80 integration on real Postgres/Redis, 8 Playwright E2E),
  **95% line coverage** of server code enforced in GitHub Actions CI, nonce-based CSP, and Lighthouse scores of
  98+ performance / 100 accessibility on all dashboard pages.
