import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { applyTestEnv, TEST_DATABASE_URL } from './test-env';

/** Recreates the test database schema and applies all migrations, once per run. */
export default async function setup() {
  applyTestEnv();
  if (!/_test\b|test$/.test(new URL(TEST_DATABASE_URL).pathname)) {
    throw new Error(`Refusing to wipe a non-test database: ${TEST_DATABASE_URL}`);
  }
  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
  await db.$executeRawUnsafe('CREATE SCHEMA public');
  await db.$disconnect();
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_DATABASE_URL: TEST_DATABASE_URL,
    },
  });
}
