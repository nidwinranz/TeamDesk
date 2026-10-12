import '@testing-library/jest-dom/vitest';

process.env.DATABASE_URL ??= 'postgresql://unit-tests-do-not-connect';
