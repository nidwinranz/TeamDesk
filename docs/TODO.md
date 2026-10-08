# TODO

Deliberately deferred work. Nothing here is a silent gap; each item has a reason.

- [ ] **API keys (feature):** the `ApiKey` model exists; issuing/revoking keys and Bearer auth for `/api/v1` are not built.
- [ ] **Postgres RLS:** add row-level security as a fifth isolation layer (see ADR 0001).
- [ ] **E2E flake (rare):** in ~1 of 8 local runs of `product.spec.ts`, the table does not show a just-created
      request after `router.refresh()`. CI retries once; root cause not yet isolated (suspect a refresh racing an
      in-flight soft navigation). Row-link prefetching was disabled, which reduced but did not eliminate it.
