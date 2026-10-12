import { NextResponse, type NextRequest } from 'next/server';
import { logger } from '@/server/lib/logger';
import { constructWebhookEvent } from '@/server/lib/stripe';
import { handleStripeEvent } from '@/server/services/stripe-webhooks.service';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhook endpoint. The signature is verified against the *raw* body
 * (`req.text()`), so this route must never parse JSON first.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Missing stripe-signature', details: null } },
      { status: 400 },
    );
  }
  const raw = await req.text();
  let event;
  try {
    event = constructWebhookEvent(raw, signature);
  } catch (err) {
    logger.warn({ err }, 'stripe webhook signature verification failed');
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid signature', details: null } },
      { status: 400 },
    );
  }
  try {
    const outcome = await handleStripeEvent(event);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    // 5xx makes Stripe retry; nothing was recorded because the transaction rolled back.
    logger.error({ err, eventId: event.id, type: event.type }, 'stripe webhook processing failed');
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Webhook processing failed', details: null } },
      { status: 500 },
    );
  }
}
