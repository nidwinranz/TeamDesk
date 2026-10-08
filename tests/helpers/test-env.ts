/** Points the app at the dedicated test database and Redis DB 1. Imported before any app module. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/teamdesk_test';
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1';

export function applyTestEnv() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    DIRECT_DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: TEST_REDIS_URL,
    APP_URL: 'http://localhost:3000',
    BILLING_MODE: 'mock',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    STRIPE_PRO_PRICE_ID: 'price_pro_test',
    LOG_LEVEL: 'silent',
  });
}
