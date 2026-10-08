import pino from 'pino';

/**
 * Structured JSON logger. Secrets and credentials are redacted at the source.
 * Pretty-printing is left to the terminal: `pnpm dev | pnpm exec pino-pretty`.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'teamdesk', env: process.env.NODE_ENV },
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'headers.cookie',
      'headers.authorization',
      '*.passwordHash',
    ],
    censor: '[redacted]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
