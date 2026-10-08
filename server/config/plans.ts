import type { Plan } from '@prisma/client';

/**
 * The single source of truth for plan limits. `null` means unlimited.
 * Enforced server-side only (see services); the UI merely reflects them.
 *
 * - `projects` counts non-archived projects.
 * - `members` counts current members plus pending (unexpired, unrevoked) invites,
 *   so invites cannot be used to exceed the limit.
 */
export const PLANS = {
  FREE: { name: 'Free', priceLabel: '$0', limits: { projects: 3, members: 5 } },
  PRO: { name: 'Pro', priceLabel: '$29 / month', limits: { projects: null, members: null } },
} as const satisfies Record<
  Plan,
  { name: string; priceLabel: string; limits: { projects: number | null; members: number | null } }
>;

export type LimitKey = keyof (typeof PLANS)['FREE']['limits'];

export function limitFor(plan: Plan, key: LimitKey): number | null {
  return PLANS[plan].limits[key];
}

export function isWithinLimit(plan: Plan, key: LimitKey, currentCount: number): boolean {
  const limit = limitFor(plan, key);
  return limit === null || currentCount < limit;
}
