import 'server-only';
import {
  loginSchema,
  requestResetSchema,
  resetPasswordSchema,
  signUpSchema,
  tokenSchema,
  emailSchema,
} from '@/lib/schemas/auth';
import { generateToken, hashToken } from '@/server/lib/crypto';
import { env } from '@/server/lib/env';
import { resetPasswordTemplate, verifyEmailTemplate } from '@/server/lib/email-templates';
import { AppError, badRequest, validationFailed } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import { sendEmail } from '@/server/lib/mailer';
import { dummyVerify, hashPassword, verifyPassword } from '@/server/lib/password';
import { enforceRateLimit, RATE_LIMITS } from '@/server/lib/rate-limit';
import { parse } from '@/server/lib/validation';
import * as authTokens from '@/server/repos/auth-tokens.repo';
import { transaction } from '@/server/repos/transaction';
import * as users from '@/server/repos/users.repo';
import { acceptInvite, getInvitePreview } from './members.service';
import { createOrganization } from './organizations.service';

const VERIFY_TTL_MS = 24 * 60 * 60_000;
const RESET_TTL_MS = 60 * 60_000;

/** Thrown by `authenticate`; the code is surfaced to the login form. */
export class LoginError extends Error {
  constructor(readonly code: 'invalid_credentials' | 'email_not_verified' | 'rate_limited') {
    super(code);
    this.name = 'LoginError';
  }
}

async function issueToken(userId: string, type: 'VERIFY_EMAIL' | 'RESET_PASSWORD', ttlMs: number) {
  const token = generateToken();
  await transaction(async (tx) => {
    await authTokens.invalidateAuthTokens(userId, type, tx);
    await authTokens.createAuthToken(
      { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
      tx,
    );
  });
  return token;
}

async function sendVerification(userId: string, email: string) {
  const token = await issueToken(userId, 'VERIFY_EMAIL', VERIFY_TTL_MS);
  await sendEmail(verifyEmailTemplate(email, `${env.APP_URL}/verify?token=${token}`));
}

/**
 * Creates the user and their first workspace (as OWNER), then emails a
 * verification link. Enumeration-safe: an existing email gets a "you already
 * have an account" email instead of an error.
 */
export async function signUp(input: unknown, meta: { ip: string }) {
  const data = parse(signUpSchema, input);
  await enforceRateLimit(`signup:${meta.ip}`, RATE_LIMITS.signup);

  const existing = await users.findUserByEmail(data.email);
  if (existing) {
    await sendEmail({
      to: existing.email,
      subject: 'You already have a TeamDesk account',
      text: `Someone tried to sign up with this email. Log in at ${env.APP_URL}/login or reset your password at ${env.APP_URL}/reset.`,
      html: `<p>Someone tried to sign up with this email. <a href="${env.APP_URL}/login">Log in</a> or <a href="${env.APP_URL}/reset">reset your password</a>.</p>`,
    });
    return { status: 'check_email' as const, orgSlug: null };
  }

  const passwordHash = await hashPassword(data.password);

  if (data.inviteToken) {
    // The invite link was emailed to this address, which proves inbox ownership:
    // the account starts verified and joins the inviting workspace instead of creating one.
    const inviteToken = data.inviteToken;
    const invite = await getInvitePreview(inviteToken);
    if (invite.status !== 'valid') {
      throw badRequest('This invite has expired, been revoked or already been used');
    }
    if (invite.email.toLowerCase() !== data.email) {
      throw validationFailed('Use the email address the invite was sent to', {
        fieldErrors: { email: [`This invite is for ${invite.email}`] },
      });
    }
    const joined = await transaction(async (tx) => {
      const created = await users.createUser(
        { email: data.email, name: data.name, passwordHash, emailVerifiedAt: new Date() },
        tx,
      );
      await acceptInvite(
        { id: created.id, email: created.email, name: created.name },
        inviteToken,
        tx,
      );
      return created;
    });
    logger.info({ userId: joined.id }, 'user signed up via invite');
    return { status: 'joined' as const, orgSlug: invite.org.slug };
  }

  const user = await transaction(async (tx) => {
    const created = await users.createUser(
      { email: data.email, name: data.name, passwordHash },
      tx,
    );
    await createOrganization({ userId: created.id, name: data.orgName }, tx);
    return created;
  });
  await sendVerification(user.id, user.email);
  logger.info({ userId: user.id }, 'user signed up');
  return { status: 'check_email' as const, orgSlug: null };
}

export async function verifyEmail(token: unknown) {
  const raw = parse(tokenSchema, token);
  const userId = await authTokens.consumeAuthToken(hashToken(raw), 'VERIFY_EMAIL');
  if (!userId) throw badRequest('This verification link is invalid or has expired');
  await users.markEmailVerified(userId);
  return { userId };
}

export async function resendVerification(email: unknown, meta: { ip: string }) {
  const address = parse(emailSchema, email);
  await enforceRateLimit(`verify:${meta.ip}:${address}`, RATE_LIMITS.verifyResend);
  const user = await users.findUserByEmail(address);
  if (user && !user.emailVerifiedAt) await sendVerification(user.id, user.email);
  return { status: 'check_email' as const };
}

/** Always succeeds from the caller's view, so it cannot be used to enumerate accounts. */
export async function requestPasswordReset(input: unknown, meta: { ip: string }) {
  const { email } = parse(requestResetSchema, input);
  await enforceRateLimit(`reset:${meta.ip}:${email}`, RATE_LIMITS.passwordReset);
  const user = await users.findUserByEmail(email);
  if (user) {
    const token = await issueToken(user.id, 'RESET_PASSWORD', RESET_TTL_MS);
    await sendEmail(resetPasswordTemplate(user.email, `${env.APP_URL}/reset?token=${token}`));
  }
  return { status: 'check_email' as const };
}

export async function resetPassword(input: unknown) {
  const { token, password } = parse(resetPasswordSchema, input);
  const passwordHash = await hashPassword(password);
  return transaction(async (tx) => {
    const userId = await authTokens.consumeAuthToken(hashToken(token), 'RESET_PASSWORD', tx);
    if (!userId) throw badRequest('This reset link is invalid or has expired');
    const user = await users.updatePassword(userId, passwordHash, tx);
    // Receiving the reset email proves ownership of the inbox.
    if (!user.emailVerifiedAt) await users.markEmailVerified(userId, tx);
    return { userId };
  });
}

/** Credentials check used by the Auth.js Credentials provider. Rate limited per IP + email. */
export async function authenticate(input: unknown, meta: { ip: string }) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) throw new LoginError('invalid_credentials');
  const { email, password } = parsed.data;

  try {
    await enforceRateLimit(`login:${meta.ip}:${email}`, RATE_LIMITS.login);
  } catch (err) {
    if (err instanceof AppError && err.code === 'RATE_LIMITED')
      throw new LoginError('rate_limited');
    throw err;
  }

  const user = await users.findUserByEmail(email);
  if (!user?.passwordHash) {
    await dummyVerify(password);
    throw new LoginError('invalid_credentials');
  }
  if (!(await verifyPassword(user.passwordHash, password)))
    throw new LoginError('invalid_credentials');
  if (!user.emailVerifiedAt) throw new LoginError('email_not_verified');
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    sessionVersion: user.sessionVersion,
  };
}

/**
 * Finds or creates the user for an OAuth sign-in. An existing email account is
 * only linked when the provider asserts the email is verified.
 */
export async function resolveOAuthUser(profile: {
  provider: string;
  providerAccountId: string;
  email: string | null | undefined;
  emailVerified: boolean;
  name?: string | null;
  image?: string | null;
}) {
  const linked = await users.findAccount(profile.provider, profile.providerAccountId);
  if (linked) return linked.user;

  if (!profile.email || !profile.emailVerified) {
    throw new AppError('FORBIDDEN', 'Your OAuth provider did not return a verified email');
  }
  const email = profile.email.toLowerCase();
  return transaction(async (tx) => {
    const existing = await users.findUserByEmail(email, tx);
    const user =
      existing ??
      (await users.createUser(
        {
          email,
          name: profile.name ?? null,
          image: profile.image ?? null,
          emailVerifiedAt: new Date(),
        },
        tx,
      ));
    if (existing && !existing.emailVerifiedAt) await users.markEmailVerified(existing.id, tx);
    await users.linkAccount(user.id, profile.provider, profile.providerAccountId, tx);
    return user;
  });
}
