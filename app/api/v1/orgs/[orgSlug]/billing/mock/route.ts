import { ok, orgRoute, readJson } from '@/server/lib/api';
import { simulateStripe } from '@/server/services/mock-billing.service';

/** Dev/E2E only: simulates Stripe checkout/portal outcomes. 404 unless BILLING_MODE=mock. */
export const POST = orgRoute(async ({ req, ctx }) =>
  ok(await simulateStripe(ctx, await readJson(req))),
);
