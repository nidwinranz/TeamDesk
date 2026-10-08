# ADR 0005 — Dependency versions and version-specific choices

- Status: accepted
- Date: 2026-10-08

Pinned to versions with stable, well-documented APIs at build time; newer majors were available but
would have added migration risk without product benefit.

| Package          | Version       | Note                                                                                                                                                                                                               |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| next             | 15.5.x        | Node.js runtime middleware (stable in 15.5) lets the middleware check membership with Prisma. Async `params`/`searchParams`.                                                                                       |
| react            | 19.1          | `useOptimistic`, `useActionState` for optimistic UI and forms.                                                                                                                                                     |
| typescript       | 5.9           | TS 7 (native) was available; 5.9 keeps typescript-eslint/Next tooling compatible.                                                                                                                                  |
| prisma           | 6.19          | Prisma 7 requires driver adapters + `prisma.config.ts`; 6.x keeps the classic engine and `$extends` query extensions used by the tenant guard. Uses extended `where` on unique queries (`{ id, organizationId }`). |
| next-auth        | 5.0.0-beta.32 | Auth.js v5 for App Router; see ADR 0002.                                                                                                                                                                           |
| zod              | 4.x           | `z.email()`, `z.iso.date()`; shared between client forms and services.                                                                                                                                             |
| tailwindcss      | 4.x           | CSS-first config (`@theme inline`) with shadcn "new-york" tokens.                                                                                                                                                  |
| shadcn/ui        | vendored      | The shadcn registry was unreachable from the build environment, so components in `components/ui` were written in the same copy-in style (Radix + cva). They are owned code either way.                             |
| stripe           | 18.5          | API `2025-08-27.basil`; period end on subscription items, invoice → `parent.subscription_details` (ADR 0003).                                                                                                      |
| @node-rs/argon2  | 2.x           | Prebuilt binaries (no node-gyp) for argon2id on Vercel.                                                                                                                                                            |
| ioredis          | 5.x           | Redis protocol works with local Redis and Upstash (`rediss://`), so one client and real-Redis integration tests.                                                                                                   |
| @sentry/nextjs   | 10.x          | `instrumentation.ts` + `instrumentation-client.ts`, `onRequestError`, tunnel route.                                                                                                                                |
| vitest           | 3.2           | `projects` for unit vs integration (single fork, real Postgres).                                                                                                                                                   |
| @playwright/test | 1.56          | Matches the preinstalled Chromium build in the dev container.                                                                                                                                                      |

Tool behaviour worth knowing: Prisma's CLI blocks `migrate reset` when run by an AI agent without
explicit consent, so the integration test setup drops/recreates the _test_ schema itself and runs
`prisma migrate deploy` (it refuses any database whose name does not end in `test`).
