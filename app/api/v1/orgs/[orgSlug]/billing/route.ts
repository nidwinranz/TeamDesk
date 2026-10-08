import { ok, orgRoute } from '@/server/lib/api';
import { getBillingOverview } from '@/server/services/billing.service';

export const GET = orgRoute(async ({ ctx }) => ok(await getBillingOverview(ctx)));
