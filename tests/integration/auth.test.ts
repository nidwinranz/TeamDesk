import { beforeEach, describe, expect, it } from 'vitest';
import { getMailer, type MemoryMailer } from '@/server/lib/mailer';
import { verifyPassword } from '@/server/lib/password';
import * as auth from '@/server/services/auth.service';
import { LoginError } from '@/server/services/auth.service';
import { testDb } from '../helpers/db';
import { createUser, PASSWORD } from '../helpers/factories';

const mailer = getMailer() as MemoryMailer;
const meta = { ip: '203.0.113.7' };

const tokenFrom = (text: string | undefined) => {
  const m = /token=([A-Za-z0-9_-]+)/.exec(text ?? '');
  if (!m?.[1]) throw new Error('no token in email');
  return m[1];
};

beforeEach(() => mailer.clear());

describe('sign up → verify → login', () => {
  const input = {
    name: 'Ada',
    email: 'Ada@Example.com',
    password: 'a-long-password',
    orgName: 'Ada Labs',
  };

  it('creates user, workspace (OWNER) and audit entry, and emails a verification link', async () => {
    await expect(auth.signUp(input, meta)).resolves.toEqual({
      status: 'check_email',
      orgSlug: null,
    });

    const user = await testDb.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } });
    expect(user.emailVerifiedAt).toBeNull();
    expect(await verifyPassword(user.passwordHash!, 'a-long-password')).toBe(true);
    const membership = await testDb.membership.findFirstOrThrow({
      where: { userId: user.id },
      include: { organization: true },
    });
    expect(membership.role).toBe('OWNER');
    expect(membership.organization.slug).toBe('ada-labs');
    expect(await testDb.auditLog.count({ where: { action: 'org.created' } })).toBe(1);

    const token = tokenFrom(mailer.last()?.text);
    const stored = await testDb.authToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).not.toBe(token); // only the hash is stored

    await expect(
      auth.authenticate({ email: input.email, password: input.password }, meta),
    ).rejects.toMatchObject({
      code: 'email_not_verified',
    });
    await auth.verifyEmail(token);
    await expect(auth.verifyEmail(token)).rejects.toThrow(/invalid or has expired/); // single use
    const ok = await auth.authenticate({ email: input.email, password: input.password }, meta);
    expect(ok.email).toBe('ada@example.com');
  });

  it('is enumeration-safe for existing emails', async () => {
    await createUser({ email: 'taken@example.com' });
    await expect(auth.signUp({ ...input, email: 'taken@example.com' }, meta)).resolves.toEqual({
      status: 'check_email',
      orgSlug: null,
    });
    expect(mailer.last()?.subject).toMatch(/already have/);
    expect(await testDb.user.count()).toBe(1);
  });

  it('gives unique slugs to same-named workspaces', async () => {
    await auth.signUp(input, meta);
    await auth.signUp({ ...input, email: 'other@example.com' }, meta);
    const slugs = (await testDb.organization.findMany()).map((o) => o.slug).sort();
    expect(slugs[0]).toBe('ada-labs');
    expect(slugs[1]).toMatch(/^ada-labs-[0-9a-f]{6}$/);
  });

  it('rejects invalid input with field errors', async () => {
    await expect(auth.signUp({ ...input, password: 'short' }, meta)).rejects.toMatchObject({
      status: 422,
      details: { fieldErrors: { password: expect.any(Array) as unknown } },
    });
  });

  it('resends verification only for unverified users', async () => {
    await auth.signUp(input, meta);
    mailer.clear();
    await auth.resendVerification('ada@example.com', meta);
    expect(mailer.sent).toHaveLength(1);
    await createUser({ email: 'verified@example.com' });
    await auth.resendVerification('verified@example.com', meta);
    expect(mailer.sent).toHaveLength(1);
  });
});

describe('login', () => {
  it('rejects wrong passwords and unknown emails with the same error', async () => {
    const user = await createUser();
    await expect(
      auth.authenticate({ email: user.email, password: 'nope-nope-nope' }, meta),
    ).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    await expect(
      auth.authenticate({ email: 'ghost@example.com', password: PASSWORD }, meta),
    ).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    await expect(auth.authenticate({ email: 'not-an-email' }, meta)).rejects.toBeInstanceOf(
      LoginError,
    );
  });

  it('rate limits per IP + email after 5 attempts', async () => {
    const user = await createUser();
    for (let i = 0; i < 5; i++) {
      await expect(
        auth.authenticate({ email: user.email, password: 'wrong-password' }, meta),
      ).rejects.toMatchObject({
        code: 'invalid_credentials',
      });
    }
    await expect(
      auth.authenticate({ email: user.email, password: PASSWORD }, meta),
    ).rejects.toMatchObject({
      code: 'rate_limited',
    });
    // A different IP is a different bucket.
    await expect(
      auth.authenticate({ email: user.email, password: PASSWORD }, { ip: '198.51.100.1' }),
    ).resolves.toMatchObject({
      id: user.id,
    });
  });
});

describe('password reset', () => {
  it('issues a single-use 1h token, updates the password and bumps sessionVersion', async () => {
    const user = await createUser({ verified: false });
    await auth.requestPasswordReset({ email: user.email }, meta);
    const token = tokenFrom(mailer.last()?.text);

    await auth.resetPassword({ token, password: 'brand-new-password' });
    const updated = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.sessionVersion).toBe(user.sessionVersion + 1);
    expect(updated.emailVerifiedAt).not.toBeNull();
    expect(await verifyPassword(updated.passwordHash!, 'brand-new-password')).toBe(true);
    await expect(auth.resetPassword({ token, password: 'another-password' })).rejects.toThrow(
      /invalid or has expired/,
    );
  });

  it('does not reveal whether the email exists', async () => {
    await expect(auth.requestPasswordReset({ email: 'ghost@example.com' }, meta)).resolves.toEqual({
      status: 'check_email',
    });
    expect(mailer.sent).toHaveLength(0);
  });

  it('invalidates older reset links when a new one is issued', async () => {
    const user = await createUser();
    await auth.requestPasswordReset({ email: user.email }, meta);
    const first = tokenFrom(mailer.last()?.text);
    await auth.requestPasswordReset({ email: user.email }, meta);
    await expect(
      auth.resetPassword({ token: first, password: 'brand-new-password' }),
    ).rejects.toThrow();
  });

  it('rejects expired tokens', async () => {
    const user = await createUser();
    await auth.requestPasswordReset({ email: user.email }, meta);
    const token = tokenFrom(mailer.last()?.text);
    await testDb.authToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(auth.resetPassword({ token, password: 'brand-new-password' })).rejects.toThrow(
      /expired/,
    );
  });
});

describe('OAuth user resolution', () => {
  const google = {
    provider: 'google',
    providerAccountId: 'g-1',
    email: 'g@example.com',
    emailVerified: true,
    name: 'G',
  };

  it('creates a verified user and links the account, then reuses it', async () => {
    const u1 = await auth.resolveOAuthUser(google);
    expect(u1.emailVerifiedAt).not.toBeNull();
    const u2 = await auth.resolveOAuthUser(google);
    expect(u2.id).toBe(u1.id);
    expect(await testDb.account.count()).toBe(1);
  });

  it('links to an existing password account with the same verified email', async () => {
    const existing = await createUser({ email: 'g@example.com', verified: false });
    const u = await auth.resolveOAuthUser(google);
    expect(u.id).toBe(existing.id);
    expect(
      (await testDb.user.findUniqueOrThrow({ where: { id: existing.id } })).emailVerifiedAt,
    ).not.toBeNull();
  });

  it('refuses unverified provider emails', async () => {
    await expect(auth.resolveOAuthUser({ ...google, emailVerified: false })).rejects.toThrow(
      /verified email/,
    );
  });
});
