# TeamDesk

Multi-tenant SaaS for tracking projects and client requests, sold per workspace.
Full README is written in Phase 6 — see `docs/PLAN.md` for progress and `CLAUDE.md` for commands.

## Testing billing locally with the Stripe CLI

By default (`BILLING_MODE=mock`) no Stripe account is needed: "Upgrade to Pro" opens a local test checkout
that posts **signed** fake events to `/api/webhooks/stripe`, exercising the real verification and idempotency path.

To test against real Stripe (test mode):

1. Create a product with a monthly price in the Stripe dashboard (test mode) and copy its `price_…` id.
2. In `.env`: `BILLING_MODE=live`, `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_PRO_PRICE_ID=price_…`.
3. Forward webhooks and copy the printed signing secret into `STRIPE_WEBHOOK_SECRET`:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe \
     --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed
   ```
4. `pnpm dev`, open Billing → Upgrade to Pro, pay with `4242 4242 4242 4242`.
5. Replay or simulate events:
   ```bash
   stripe events resend evt_…                 # same event twice → state changes once
   stripe trigger invoice.payment_failed      # → subscription past_due, audit entry
   ```
6. Enable the Customer Portal (Settings → Billing → Customer portal) to use "Manage billing".
