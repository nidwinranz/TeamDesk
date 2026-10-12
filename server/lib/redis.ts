import 'server-only';
import Redis from 'ioredis';
import { env } from './env';

const globalForRedis = globalThis as unknown as { redis?: Redis };

/**
 * Redis connection (works with local Redis and Upstash via `rediss://`).
 * `lazyConnect` keeps builds and tests that never touch Redis from opening sockets.
 */
export const redis: Redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true,
  });

if (process.env.NODE_ENV === 'development') globalForRedis.redis = redis;
