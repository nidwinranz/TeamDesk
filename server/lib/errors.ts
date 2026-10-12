/**
 * Application errors. Services throw these; the API layer maps them to
 * `{ error: { code, message, details } }` with the matching HTTP status.
 */
export const ERROR_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  PLAN_LIMIT_REACHED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = ERROR_STATUS[code];
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError('BAD_REQUEST', message, details);
export const unauthenticated = (message = 'Authentication required') =>
  new AppError('UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission to do that') =>
  new AppError('FORBIDDEN', message);
export const notFound = (resource = 'Resource') =>
  new AppError('NOT_FOUND', `${resource} not found`);
export const conflict = (message: string, details?: unknown) =>
  new AppError('CONFLICT', message, details);
export const validationFailed = (message: string, details?: unknown) =>
  new AppError('VALIDATION_FAILED', message, details);
export const rateLimited = (retryAfterSeconds: number) =>
  new AppError('RATE_LIMITED', 'Too many requests, please try again later', { retryAfterSeconds });
export const planLimitReached = (message: string, details?: unknown) =>
  new AppError('PLAN_LIMIT_REACHED', message, details);

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
