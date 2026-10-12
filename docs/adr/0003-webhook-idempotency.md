# ADR 0003 — Stripe webhooks: idempotency and ordering

- Status: accepted
- Date: 2026-10-08

## Context

Billing state (`Subscription`, `Organization.plan`) must only change in response to Stripe, never
because a browser was redirected to a success URL. Stripe delivers webhooks **at least once**, **in no
guaranteed order**, and retries on any non-2xx response for up to three days. Two deliveries of the same
event may even arrive concurrently.

## Decision

1. **Raw-body signature verification.** `app/api/webhooks/stripe/route.ts` reads `req.text()` and calls
   `stripe.webhooks.constructEvent(raw, signature, STRIPE_WEBHOOK_SECRET)`. Invalid/missing signatures → 400.
2. **Dedupe ledger in the same transaction.** `WebhookEvent.stripeEventId` is the primary key. Each event
   is inserted with `INSERT … ON CONFLICT DO NOTHING` _inside_ the transaction that applies its effects:
   - replay → insert affects 0 rows → `duplicate`, no state change;
   - concurrent replay → the second insert blocks on the first's row lock, then sees the conflict;
   - handler crash → whole transaction rolls back, including the ledger row → we return 500 → Stripe retries.
3. **Ordering rules** (`applySubscription` in `server/services/stripe-webhooks.service.ts`):
   - `Subscription.lastEventAt` stores `event.created` of the newest applied event; older events for the same
     subscription are `stale`.
   - A `canceled` subscription is terminal (Stripe cannot reactivate it), so a late non-canceled event for the
     same id is ignored even if it shares the same `created` second.
   - A _different_ subscription id replaces the stored one unless that would replace an entitled subscription
     with a non-entitled one (a late cancel of an old subscription after a resubscribe).
4. **Entitlement** is derived in one place: `active`, `trialing`, `past_due` (grace while Stripe retries) → PRO;
   everything else → FREE. `invoice.payment_failed` marks `past_due` and is audited; Stripe's later
   `customer.subscription.updated` (`unpaid`/`canceled`) settles the plan.
5. **Network calls outside the transaction.** `checkout.session.completed` may carry only a subscription id; we
   `subscriptions.retrieve` it _before_ opening the DB transaction to keep it short.

## Version-specific notes

- `stripe@18` pinned to API version `2025-08-27.basil`. Since `2025-03-31.basil`:
  `current_period_end` moved from `Subscription` to `SubscriptionItem`, and `Invoice.subscription` moved to
  `Invoice.parent.subscription_details.subscription`. `normalizeSubscription` encapsulates this.

## Consequences

- Tests (`tests/integration/billing.test.ts`) prove: replay changes state once; concurrent replays dedupe;
  older events are ignored; canceled is terminal; failures roll back the ledger so retries succeed.
- `BILLING_MODE=mock` signs fake events with the webhook secret and passes them through `constructWebhookEvent`
  and `handleStripeEvent` in-process (no self-HTTP call, which hung on CI runners), so local dev and E2E
  exercise the real verification + idempotency code without Stripe credentials.
