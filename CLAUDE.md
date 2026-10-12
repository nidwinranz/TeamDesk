# CLAUDE.md — TeamDesk

Multi-tenant SaaS: projects + client-request tracker sold per workspace (Organization).

## Stack

Next.js 15 (App Router, TS strict) · Tailwind v4 + shadcn/ui (vendored in `components/ui`) · pnpm ·
PostgreSQL 16 + Prisma 6 · Auth.js v5 (Credentials + Google, JWT sessions, argon2id) · Redis (ioredis,
Upstash-compatible) · Stripe (Checkout, Portal, webhooks) · Resend / Mailpit · Zod 4 · Vitest ·
Testing Library · Playwright · pino · Sentry · GitHub Actions → Vercel + Neon + Upstash.

## Commands

| Task                                       | Command                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| Start deps                                 | `docker compose up -d` (Postgres :5432, Redis :6379, Mailpit :1025/:8025) |
| Install                                    | `pnpm i` (runs `prisma generate`)                                         |
| Migrate / seed                             | `pnpm db:migrate` · `pnpm db:seed`                                        |
| Dev server                                 | `pnpm dev`                                                                |
| Lint / types / format                      | `pnpm lint` · `pnpm typecheck` · `pnpm format`                            |
| Unit tests                                 | `pnpm test`                                                               |
| Integration tests (real Postgres + Redis)  | `pnpm test:integration`                                                   |
| Coverage (unit + integration, `server/**`) | `pnpm test:coverage`                                                      |
| E2E (needs `pnpm build` first)             | `pnpm test:e2e`                                                           |

## Architecture rules (non-negotiable)

1. Shared DB/schema; every tenant-owned table has indexed `organizationId`.
2. Business logic only in `server/services`; DB access only in `server/repos`. Every repo function
   for a tenant model takes `orgId`. ESLint blocks Prisma imports elsewhere.
3. `server/lib/tenant-guard.ts` (Prisma extension) throws if a tenant model is queried without
   `organizationId`. Cross-tenant reads use `systemPrisma` in `...Unscoped` repo functions only.
4. Permissions: one map in `server/policies/permissions.ts`; every service calls `assertCan(ctx, action)`.
5. Other tenants' resources → **404**, never 403.
6. API lives under `/api/v1`; errors are `{ error: { code, message, details } }`; cursor pagination;
   statuses 400/401/403/404/409/422/429 (see `server/lib/errors.ts`, `server/lib/api.ts`).
7. Plan limits and billing state are enforced server-side only (`server/config/plans.ts`).
8. Secrets only via env (`server/lib/env.ts` validates; `.env.example` documents each variable).
9. No `any`, no disabled lint rules, no silent TODOs — log them in `docs/TODO.md`.

## Conventions

- Services: `fn(ctx: OrgContext, input: unknown)`; validate with `parse(zodSchema, input)` → 422.
- Shared Zod schemas live in `lib/schemas` (used by both client forms and services).
- Audit every security-relevant mutation via `appendAuditLog` inside the same transaction.
- UI: server components read via services; client components mutate via `/api/v1` (`lib/api-client.ts`)
  or server actions (auth/onboarding forms).
- Tests: `tests/unit` (pure, mocked), `tests/integration` (real DB, wiped per test), `tests/e2e` (Playwright).
- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`).
- Version-specific decisions go in `docs/adr/`.
