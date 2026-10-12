import type Redis from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { toActionState } from '@/server/lib/action';
import { toCommentDTO, toRequestDTO } from '@/server/lib/dto';
import { parseEnv } from '@/server/lib/env';
import { AppError, validationFailed } from '@/server/lib/errors';
import { MemoryMailer, sendEmail, setMailer } from '@/server/lib/mailer';
import { createRedisRateLimiter } from '@/server/lib/rate-limit';
import { buildCsp, generateNonce, STATIC_SECURITY_HEADERS } from '@/server/lib/security-headers';
import {
  inviteTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from '@/server/lib/email-templates';
import { isWithinLimit, limitFor } from '@/server/config/plans';

describe('env', () => {
  const base = { DATABASE_URL: 'postgresql://x' };

  it('applies defaults and coerces types', () => {
    const e = parseEnv({ ...base, SMTP_PORT: '2525', DEMO_MODE: 'true', AUTH_GOOGLE_ID: '' });
    expect(e).toMatchObject({
      NODE_ENV: 'development',
      SMTP_PORT: 2525,
      DEMO_MODE: true,
      BILLING_MODE: 'mock',
    });
    expect(e.AUTH_GOOGLE_ID).toBeUndefined();
  });

  it('requires secrets and forbids mock billing in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /AUTH_SECRET.*BILLING_MODE/,
    );
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', AUTH_SECRET: 's', BILLING_MODE: 'live' }),
    ).toThrow(/STRIPE_SECRET_KEY/);
    expect(
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        AUTH_SECRET: 's',
        BILLING_MODE: 'mock',
        ALLOW_MOCK_BILLING: 'true',
      }),
    ).toMatchObject({ BILLING_MODE: 'mock' });
  });

  it('can skip validation for builds', () => {
    expect(parseEnv({ SKIP_ENV_VALIDATION: '1', NODE_ENV: 'production' })).toMatchObject({
      NODE_ENV: 'development',
    });
    expect(parseEnv({ SKIP_ENV_VALIDATION: '1', NODE_ENV: 'test' })).toMatchObject({
      NODE_ENV: 'test',
    });
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});

describe('security headers', () => {
  it('builds a strict nonce CSP, with dev relaxations only in dev', () => {
    const prod = buildCsp('abc', { dev: false });
    expect(prod).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain('upgrade-insecure-requests');
    expect(prod).not.toContain('unsafe-eval');
    const dev = buildCsp('abc', { dev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain('upgrade-insecure-requests');
    expect(generateNonce()).not.toBe(generateNonce());
    expect(STATIC_SECURITY_HEADERS.map((h) => h.key)).toContain('Strict-Transport-Security');
  });
});

describe('rate limiter', () => {
  it('counts within a window and reports retry-after', async () => {
    let n = 0;
    const client = { eval: vi.fn(() => Promise.resolve([++n, 900])) } as unknown as Redis;
    const limit = createRedisRateLimiter(client);
    const rule = { limit: 2, windowMs: 1000 };
    expect(await limit('k', rule)).toEqual({ success: true, remaining: 1, retryAfterMs: 0 });
    expect(await limit('k', rule)).toEqual({ success: true, remaining: 0, retryAfterMs: 0 });
    expect(await limit('k', rule)).toEqual({ success: false, remaining: 0, retryAfterMs: 900 });
  });

  it('fails open when Redis is unavailable', async () => {
    const client = {
      eval: vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
    } as unknown as Redis;
    expect(await createRedisRateLimiter(client)('k', { limit: 1, windowMs: 1 })).toMatchObject({
      success: true,
    });
  });
});

describe('action state', () => {
  it('maps AppErrors with field errors and hides unexpected errors', () => {
    expect(toActionState(validationFailed('Invalid', { fieldErrors: { name: ['x'] } }))).toEqual({
      ok: false,
      message: 'Invalid',
      fieldErrors: { name: ['x'] },
    });
    expect(toActionState(new AppError('CONFLICT', 'Taken'))).toMatchObject({ message: 'Taken' });
    expect(toActionState(new Error('db password is hunter2'))).toEqual({
      ok: false,
      message: 'Something went wrong. Please try again.',
    });
  });
});

describe('dto', () => {
  it('serialises dates and strips extra fields', () => {
    const d = new Date('2030-01-01T00:00:00.000Z');
    const dto = toRequestDTO({
      id: 'r',
      title: 't',
      description: '',
      status: 'OPEN',
      priority: 'LOW',
      dueDate: null,
      createdAt: d,
      updatedAt: d,
      assignee: { id: 'u', name: null, email: 'e', passwordHash: 'secret' } as never,
      project: { id: 'p', name: 'P' },
      commentCount: 0,
    });
    expect(dto).toMatchObject({
      dueDate: null,
      createdAt: '2030-01-01T00:00:00.000Z',
      assignee: { id: 'u', name: null, email: 'e' },
    });
    expect(JSON.stringify(dto)).not.toContain('secret');
    expect(toCommentDTO({ id: 'c', body: 'b', createdAt: d, author: null })).toEqual({
      id: 'c',
      body: 'b',
      createdAt: '2030-01-01T00:00:00.000Z',
      author: null,
    });
  });
});

describe('mailer and templates', () => {
  it('sends through the configured transport and escapes HTML', async () => {
    const m = new MemoryMailer();
    setMailer(m);
    await sendEmail(inviteTemplate('a@b.co', '<Evil Org>', 'Ann', 'MEMBER', 'https://x/invite/t'));
    expect(m.last()?.html).toContain('&lt;Evil Org&gt;');
    expect(m.last()?.text).toContain('https://x/invite/t');
    expect(verifyEmailTemplate('a@b.co', 'u').subject).toMatch(/Verify/);
    expect(resetPasswordTemplate('a@b.co', 'u').text).toMatch(/1 hour/);
    m.clear();
    expect(m.sent).toHaveLength(0);
  });

  it('propagates transport failures', async () => {
    setMailer({ send: () => Promise.reject(new Error('smtp down')) });
    await expect(sendEmail(verifyEmailTemplate('a@b.co', 'u'))).rejects.toThrow('smtp down');
    setMailer(new MemoryMailer());
  });
});

describe('plans', () => {
  it('limits FREE and not PRO', () => {
    expect(limitFor('FREE', 'projects')).toBe(3);
    expect(isWithinLimit('FREE', 'members', 4)).toBe(true);
    expect(isWithinLimit('FREE', 'members', 5)).toBe(false);
    expect(isWithinLimit('PRO', 'members', 10_000)).toBe(true);
  });
});
