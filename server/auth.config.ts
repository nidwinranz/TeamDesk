import type { NextAuthConfig } from 'next-auth';

/**
 * Provider-free Auth.js config shared by the middleware (which only needs to
 * decode the session JWT) and the full config in `server/auth.ts`.
 */
export const authConfig = {
  secret:
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-insecure-secret'),
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.sessionVersion = typeof token.sv === 'number' ? token.sv : -1;
      return session;
    },
  },
} satisfies NextAuthConfig;
