# TeamDesk build plan

Each phase ends with lint + typecheck + all tests green, this file updated, and a commit.

## Phase 1 — Foundation

- [x] Scaffold Next.js 15 + TS strict + Tailwind + shadcn/ui, ESLint (type-aware), Prettier, Vitest
- [x] docker-compose: Postgres 16, Redis 7, Mailpit
- [x] Full Prisma schema + initial migration (+ AuditLog append-only trigger)
- [x] Seed: 2 orgs, 4 users covering all roles, projects/requests/comments (+ demo org)
- [x] Auth: sign up, verify email, login, logout, password reset, Google OAuth; login rate limit per IP+email
- [x] Tenant-guard Prisma extension + unit and integration tests
- [x] `permissions.ts` + unit tests for every role × action
- [x] Auth pages + dashboard shell at `/[orgSlug]`
- [x] CI: install, lint, typecheck, unit tests
- [x] `docs/adr/0001-tenancy-model.md`

**Acceptance:** `docker compose up -d && pnpm i && pnpm db:migrate && pnpm db:seed && pnpm dev` works; full
auth flow via Mailpit (verified by `tests/e2e/auth.spec.ts`).

## Phase 2 — Organisations, invites, roles

- [x] Org created at sign-up; unique slug; workspace switcher; middleware resolves org + checks membership
- [x] Invites: 32-byte token, SHA-256 hash stored, 7-day expiry, single use; email; accept page; revoke; resend
- [x] Members page: list, change role, remove; last OWNER cannot be removed/demoted
- [x] AuditLog: invite sent/accepted/revoked, role changed, member removed
- [x] Integration tests on real Postgres incl. "Org A user gets 404 on Org B resources"

**Acceptance:** invite → accept flow works end to end (`tests/e2e/onboarding.spec.ts`); cross-tenant access
returns 404 (`tests/integration/members.test.ts`, `api-members.test.ts`).

Decisions: invitee email must match the invited address; signing up through an invite joins that
workspace (account starts verified) instead of creating a new one; pending invites count as seats;
listing members requires `member:invite` (assignee pickers use `listAssignees`, gated on `request:read`).

## Phase 3 — Core product

- [x] Projects CRUD + archive; Requests CRUD (status, priority, assignee, due date); comments
- [x] Filters, sorting, cursor pagination, optimistic UI, loading/empty/error states
- [x] VIEWER read-only in UI and server
- [x] Service unit + integration tests; keyboard and label accessibility

**Acceptance:** a MEMBER can run a project end to end; a VIEWER cannot mutate anything (403 from API) —
`tests/e2e/product.spec.ts`, `tests/integration/projects-requests.test.ts`, `api-product.test.ts`.

Decisions: filters live in the URL (shareable, server-rendered first page); limit-sensitive writes use
serializable transactions with automatic retry; comment authors (or ADMIN+) may delete comments;
archived projects reject new requests (409) and do not count toward the project limit.

## Phase 4 — Billing

- [x] Plans in one config (`server/config/plans.ts`): FREE (3 projects, 5 members), PRO (unlimited)
- [x] Checkout + Customer Portal endpoints; Subscription updated only by webhooks
- [x] Webhook: raw-body signature check; dedupe by `WebhookEvent.stripeEventId`; checkout.session.completed,
      customer.subscription.updated/deleted, invoice.payment_failed
- [x] Server-side limit checks; upgrade prompts; billing page
- [x] Tests: replayed event changes state once; out-of-order events safe
- [x] README: local testing with Stripe CLI; `docs/adr/0003-webhook-idempotency.md`

**Acceptance:** FREE org blocked at limits (403 `PLAN_LIMIT_REACHED`); webhook tests prove idempotency
(`tests/integration/billing.test.ts`); E2E upgrade via mock checkout (`tests/e2e/onboarding.spec.ts`).

Decisions: `BILLING_MODE=mock` posts signed fake events to the real webhook so dev/E2E need no Stripe keys;
`past_due` keeps PRO (grace period); only OWNER can start checkout / open the portal.

## Phase 5 — Hardening

- [x] Audit log page (ADMIN+), cursor paginated, filter by action
- [x] Redis rate limits on auth and write endpoints
- [x] Security headers (CSP, HSTS, …), CSRF review, Sentry, pino logs, `/api/health` (DB + Redis)
- [x] Playwright: sign up → create org → invite → accept (second context) → upgrade (mocked Stripe)
- [x] CI: integration (Postgres service) + E2E jobs; coverage ≥ 80% on `server/` (measured 95.1% lines)
- [x] `docs/adr/0002-auth.md`

**Acceptance:** coverage gate enforced in `vitest.config.mts` (80% lines/statements/functions, 70% branches).
Coverage excludes `server/auth.ts`, `server/auth.config.ts` (Auth.js wiring, covered by E2E) and
`server/lib/redis.ts` (connection bootstrap). Also added: workspace settings page (rename / change URL).

## Phase 6 — Ship and showcase

- [x] `docs/DEPLOYMENT.md` (Vercel + Neon + Upstash + Resend + Stripe; `prisma migrate deploy` in release step)
- [x] Demo mode: seeded demo org with OWNER + VIEWER logins + `pnpm demo:reset` (+ nightly workflow)
- [x] Lighthouse 90+ on dashboard pages (measured 98–100, `docs/LIGHTHOUSE.md`)
- [x] Final README (pitch, demo, features, Mermaid diagram, decisions, setup, testing, roadmap)
- [x] `docs/CASE_STUDY.md` + 3 CV bullets based only on what was built and measured
