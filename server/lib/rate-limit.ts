import 'server-only';
import type Redis from 'ioredis';
import { rateLimited } from './errors';
import { logger } from './logger';
import { redis } from './redis';

export interface RateLimitRule {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterMs: number;
}

/** Central catalogue of limits, so they are reviewed in one place. */
export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 15 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 3, windowMs: 60 * 60_000 },
  verifyResend: { limit: 3, windowMs: 60 * 60_000 },
  write: { limit: 60, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

// Atomic fixed-window counter: INCR then set expiry on the first hit.
const SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

export function createRedisRateLimiter(client: Redis) {
  return async function limit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    try {
      const [count, ttl] = (await client.eval(SCRIPT, 1, `rl:${key}`, rule.windowMs)) as [
        number,
        number,
      ];
      const success = count <= rule.limit;
      return {
        success,
        remaining: Math.max(0, rule.limit - count),
        retryAfterMs: success ? 0 : Math.max(ttl, 0),
      };
    } catch (err) {
      // Fail open: an unavailable Redis must not lock every user out. Alerting comes from the log/Sentry.
      logger.error({ err, key }, 'rate limiter unavailable; allowing request');
      return { success: true, remaining: rule.limit, retryAfterMs: 0 };
    }
  };
}

export const rateLimit = createRedisRateLimiter(redis);

/** Throws a 429 AppError when the key is over its limit. */
export async function enforceRateLimit(key: string, rule: RateLimitRule): Promise<void> {
  const result = await rateLimit(key, rule);
  if (!result.success) throw rateLimited(Math.ceil(result.retryAfterMs / 1000));
}
