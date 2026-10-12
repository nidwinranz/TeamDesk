import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'prisma/migrations/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...tseslint.configs.recommendedTypeChecked.map((c) => ({ ...c, files: ['**/*.{ts,tsx}'] })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Architecture rule: only repositories may touch the database client.
    files: ['**/*.{ts,tsx}'],
    ignores: [
      'server/repos/**',
      'server/lib/prisma.ts',
      'prisma/**',
      'tests/**',
      'scripts/**',
      'app/api/health/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              allowTypeImports: true,
              message: 'Use server/repos for DB access.',
            },
            { name: '@/server/lib/prisma', message: 'Use server/repos for DB access.' },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**', 'prisma/seed.ts', 'tests/**'],
    rules: { 'no-console': 'off' },
  },
);
