'use server';

import { AuthError, CredentialsSignin } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type ActionState, safeRedirectPath } from '@/lib/action-state';
import { signIn, signOut } from '@/server/auth';
import { toActionState } from '@/server/lib/action';
import { clientIp } from '@/server/lib/request';
import * as authService from '@/server/services/auth.service';

const LOGIN_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_verified: 'Please verify your email first. We can send a new link.',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
};

async function ip() {
  return clientIp(await headers());
}

export async function signUpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let result: Awaited<ReturnType<typeof authService.signUp>>;
  try {
    result = await authService.signUp(Object.fromEntries(form), { ip: await ip() });
  } catch (err) {
    return toActionState(err);
  }
  if (result.status === 'joined')
    redirect(`/login?joined=1&callbackUrl=${encodeURIComponent(`/${result.orgSlug}`)}`);
  const email = form.get('email');
  redirect(`/verify?sent=1&email=${encodeURIComponent(typeof email === 'string' ? email : '')}`);
}

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await signIn('credentials', {
      email: form.get('email'),
      password: form.get('password'),
      redirectTo: safeRedirectPath(form.get('callbackUrl')),
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof CredentialsSignin) {
      return {
        ok: false,
        message: LOGIN_MESSAGES[err.code] ?? LOGIN_MESSAGES.invalid_credentials,
        fieldErrors: { code: [err.code] },
      };
    }
    if (err instanceof AuthError)
      return { ok: false, message: 'Sign-in failed. Please try again.' };
    throw err; // NEXT_REDIRECT on success must propagate.
  }
}

export async function googleSignInAction(form: FormData): Promise<void> {
  await signIn('google', { redirectTo: safeRedirectPath(form.get('callbackUrl')) });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}

export async function verifyEmailAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await authService.verifyEmail(form.get('token'));
  } catch (err) {
    return toActionState(err);
  }
  redirect('/login?verified=1');
}

export async function resendVerificationAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await authService.resendVerification(form.get('email'), { ip: await ip() });
    return { ok: true, message: 'If that account needs verifying, a new link is on its way.' };
  } catch (err) {
    return toActionState(err);
  }
}

export async function requestResetAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await authService.requestPasswordReset(Object.fromEntries(form), { ip: await ip() });
    return {
      ok: true,
      message: 'If an account exists for that email, a reset link is on its way.',
    };
  } catch (err) {
    return toActionState(err);
  }
}

export async function resetPasswordAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await authService.resetPassword(Object.fromEntries(form));
  } catch (err) {
    return toActionState(err);
  }
  redirect('/login?reset=1');
}
