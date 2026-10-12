# Lighthouse results

Measured 2026-10-08 with Lighthouse 12 (default mobile emulation + throttling), headless Chromium,
against a local **production build** (`pnpm build && pnpm start`) with the seeded database, signed in
as `owner@acme.test`. Localhost has no real network latency, so treat these as an upper bound;
re-measure on the deployed URL.

| Page                 | Performance | Accessibility | Best practices | SEO |
| -------------------- | ----------- | ------------- | -------------- | --- |
| `/login`             | 99          | 100           | 100            | 100 |
| `/acme` (overview)   | 98          | 100           | 100            | 100 |
| `/acme/projects`     | 98          | 100           | 100            | 100 |
| `/acme/requests`     | 98          | 100           | 100            | 100 |
| `/acme/requests/:id` | 98          | 100           | 100            | 100 |
| `/acme/members`      | 98          | 100           | 100            | 100 |
| `/acme/billing`      | 99          | 100           | 100            | 100 |
| `/acme/audit`        | 98          | 100           | 100            | 100 |

Findings fixed: missing favicon (404 logged to console → best-practices 96 → 100); row links in tables no
longer prefetch every request detail page on render.

Reproduce:

```bash
pnpm build && pnpm start --port 3200
# get a session cookie (log in once in a browser, copy `authjs.session-token`), then:
npx lighthouse http://localhost:3200/acme/requests --extra-headers='{"Cookie":"authjs.session-token=…"}'
```
