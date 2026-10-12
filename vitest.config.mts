import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const serverOnlyStub = new URL('./tests/helpers/server-only-stub.ts', import.meta.url).pathname;

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: { alias: { 'server-only': serverOnlyStub } },
  test: {
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts'],
      exclude: [
        'server/auth.ts',
        'server/auth.config.ts',
        'server/lib/redis.ts',
        'server/lib/sentry.ts',
      ],
      reporter: ['text-summary', 'text', 'json-summary', 'lcov'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          environment: 'node',
          setupFiles: ['tests/helpers/unit-setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['tests/helpers/integration-global-setup.ts'],
          setupFiles: ['tests/helpers/integration-setup.ts'],
          fileParallelism: false,
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
