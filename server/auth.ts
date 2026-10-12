import 'server-only';
import NextAuth, { CredentialsSignin, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { authConfig } from '@/server/auth.config';
import { env } from '@/server/lib/env';
import { logger } from '@/server/lib/logger';
import { authenticate, LoginError, resolveOAuthUser } from '@/server/services/auth.service';
import { clientIp } from '@/server/lib/request';

class LoginFailed extends CredentialsSignin {
  constructor(code: LoginError['code']) {
    super();
    this.code = code;
  }
}

export const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

const config: NextAuthConfig = {
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        try {
          const user = await authenticate(credentials, { ip: clientIp(request.headers) });
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            sessionVersion: user.sessionVersion,
          };
        } catch (err) {
          if (err instanceof LoginError) throw new LoginFailed(err.code);
          throw err;
        }
      },
    }),
    ...(googleEnabled
      ? [Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET })]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account, profile }) {
      if (account?.provider === 'google') {
        const resolved = await resolveOAuthUser({
          provider: 'google',
          providerAccountId: account.providerAccountId,
          email: profile?.email,
          emailVerified: profile?.email_verified === true,
          name: profile?.name,
          image: typeof profile?.picture === 'string' ? profile.picture : null,
        });
        token.sub = resolved.id;
        token.sv = resolved.sessionVersion;
      } else if (user) {
        token.sub = user.id;
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
      }
      return token;
    },
  },
  logger: {
    error: (error) => logger.error({ err: error }, 'auth error'),
    warn: (code) => logger.warn({ code }, 'auth warning'),
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
