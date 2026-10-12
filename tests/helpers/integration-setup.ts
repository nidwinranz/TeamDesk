import { afterAll, beforeEach } from 'vitest';
import { applyTestEnv } from './test-env';

applyTestEnv();

const { resetDatabase, disconnect } = await import('./db');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnect();
});
