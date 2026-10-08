# TODO

Deliberately deferred work. Nothing here is a silent gap; each item has a reason.

- [ ] **API keys (feature):** the `ApiKey` model exists; issuing/revoking keys and Bearer auth for `/api/v1` are not built.
- [ ] **Postgres RLS:** add row-level security as a fifth isolation layer (see ADR 0001).
- [ ] **`router.refresh()` race (mitigated):** a just-created request occasionally did not appear after
      `router.refresh()` (~1 in 8 local runs). New requests are now added to a client store and rendered
      immediately (`components/requests/requests-store.tsx`); 5 consecutive full E2E runs passed afterwards. The
      underlying refresh race was not isolated; the invite list still relies on `router.refresh()`.
- [ ] **Google OAuth E2E:** the Google flow is unit/integration-tested at `resolveOAuthUser` but not end to end
      (needs real credentials).
