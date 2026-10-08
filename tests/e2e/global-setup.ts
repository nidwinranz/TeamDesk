import Redis from 'ioredis';

/** E2E runs share one IP, so clear rate-limit buckets left over from previous runs. */
export default async function globalSetup() {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
  redis.disconnect();
}
