import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { wipe } from '@/prisma/seed-data';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './test-env';

/** Raw clients for test setup/assertions; app code under test uses its own clients. */
export const testDb = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
export const testRedis = new Redis(TEST_REDIS_URL, { lazyConnect: true });

export async function resetDatabase() {
  await wipe(testDb);
  await testRedis.flushdb();
}

export async function disconnect() {
  await testDb.$disconnect();
  testRedis.disconnect();
}
