import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
    /** Compared against User.sessionVersion to invalidate sessions after a password reset. */
    sessionVersion: number;
  }
}
