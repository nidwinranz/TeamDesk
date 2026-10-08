import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/action-state';
import { generateToken, hashToken, safeEqual } from '@/server/lib/crypto';
import { AppError, ERROR_STATUS, rateLimited } from '@/server/lib/errors';
import { cursorArgs, pageQuerySchema, toPage } from '@/server/lib/pagination';
import { clientIp } from '@/server/lib/request';
import { isReservedSlug, slugify, withSuffix } from '@/server/lib/slug';
import { parse } from '@/server/lib/validation';
import { z } from 'zod';

describe('crypto', () => {
  it('generates 32-byte url-safe tokens', () => {
    const t = generateToken();
    expect(Buffer.from(t, 'base64url')).toHaveLength(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateToken()).not.toBe(t);
  });

  it('hashes deterministically with SHA-256', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(safeEqual('a', 'a')).toBe(true);
    expect(safeEqual('a', 'b')).toBe(false);
    expect(safeEqual('a', 'ab')).toBe(false);
  });
});

describe('slug', () => {
  it.each([
    ['Acme Studio', 'acme-studio'],
    ['  Café  Ünïcode! ', 'cafe-unicode'],
    ['A', 'a-workspace'],
    ['!!!', 'team-workspace'],
    ['x'.repeat(80), 'x'.repeat(40)],
  ])('slugify(%j) = %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('adds a random suffix and knows reserved names', () => {
    expect(withSuffix('acme')).toMatch(/^acme-[0-9a-f]{6}$/);
    expect(isReservedSlug('login')).toBe(true);
    expect(isReservedSlug('acme')).toBe(false);
  });
});

describe('pagination', () => {
  it('parses limits with defaults and bounds', () => {
    expect(pageQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(pageQuerySchema.parse({ limit: '5', cursor: 'c1' })).toEqual({ limit: 5, cursor: 'c1' });
    expect(pageQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });

  it('builds cursor args and pages', () => {
    expect(cursorArgs({ limit: 2 })).toEqual({ take: 3 });
    expect(cursorArgs({ limit: 2, cursor: 'x' })).toEqual({
      take: 3,
      cursor: { id: 'x' },
      skip: 1,
    });
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(toPage(rows, 2)).toEqual({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'b' });
    expect(toPage(rows, 3)).toEqual({ items: rows, nextCursor: null });
  });
});

describe('errors and validation', () => {
  it('maps codes to statuses', () => {
    expect(new AppError('NOT_FOUND', 'x').status).toBe(404);
    expect(ERROR_STATUS.VALIDATION_FAILED).toBe(422);
    expect(rateLimited(3).details).toEqual({ retryAfterSeconds: 3 });
  });

  it('parse throws 422 with field errors', () => {
    const schema = z.object({ name: z.string().min(2), nested: z.object({ n: z.number() }) });
    expect(parse(schema, { name: 'ok', nested: { n: 1 } })).toEqual({
      name: 'ok',
      nested: { n: 1 },
    });
    try {
      parse(schema, { name: 'x', nested: {} });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      const err = e as AppError;
      expect(err.status).toBe(422);
      expect(Object.keys((err.details as { fieldErrors: object }).fieldErrors)).toEqual([
        'name',
        'nested.n',
      ]);
    }
  });
});

describe('request helpers', () => {
  it('extracts the client ip', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(clientIp(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(clientIp(new Headers())).toBe('unknown');
  });

  it('only allows relative redirect paths', () => {
    expect(safeRedirectPath('/acme/projects')).toBe('/acme/projects');
    expect(safeRedirectPath('https://evil.test')).toBe('/dashboard');
    expect(safeRedirectPath('//evil.test')).toBe('/dashboard');
    expect(safeRedirectPath('/\\evil.test')).toBe('/dashboard');
    expect(safeRedirectPath(null)).toBe('/dashboard');
  });
});
