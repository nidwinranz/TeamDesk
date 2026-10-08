import { ok, orgRoute } from '@/server/lib/api';
import { openBillingPortal } from '@/server/services/billing.service';

export const POST = orgRoute(async ({ ctx }) => ok(await openBillingPortal(ctx)));
