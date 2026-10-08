import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.url().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    AUTH_SECRET: optionalString,
    AUTH_GOOGLE_ID: optionalString,
    AUTH_GOOGLE_SECRET: optionalString,
    EMAIL_FROM: z.string().default('TeamDesk <no-reply@teamdesk.local>'),
    RESEND_API_KEY: optionalString,
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().default(1025),
    BILLING_MODE: z.enum(['live', 'mock']).default('mock'),
    STRIPE_SECRET_KEY: optionalString,
    STRIPE_WEBHOOK_SECRET: z.string().default('whsec_local_development_secret'),
    STRIPE_PRO_PRICE_ID: z.string().default('price_pro_monthly_mock'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SENTRY_DSN: optionalString,
    // Lets a production *build* use mock billing for E2E tests. Never set on a real deployment.
    ALLOW_MOCK_BILLING: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    DEMO_MODE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== 'production') return;
    if (!e.AUTH_SECRET)
      ctx.addIssue({ code: 'custom', path: ['AUTH_SECRET'], message: 'required in production' });
    if (e.BILLING_MODE === 'mock' && !e.ALLOW_MOCK_BILLING) {
      ctx.addIssue({
        code: 'custom',
        path: ['BILLING_MODE'],
        message: 'mock billing is not allowed in production',
      });
    }
    if (e.BILLING_MODE === 'live' && !e.STRIPE_SECRET_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['STRIPE_SECRET_KEY'],
        message: 'required when BILLING_MODE=live',
      });
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  // `next build` evaluates server modules without runtime secrets; allow opting out there.
  const source =
    input.SKIP_ENV_VALIDATION === '1'
      ? {
          ...input,
          NODE_ENV: 'development',
          DATABASE_URL: input.DATABASE_URL ?? 'postgresql://build',
        }
      : input;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

export const env: Env = parseEnv(process.env);
