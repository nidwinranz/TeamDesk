import { ok, orgRoute } from '@/server/lib/api';
import { startCheckout } from '@/server/services/billing.service';

export const POST = orgRoute(async ({ ctx }) => ok(await startCheckout(ctx)));
