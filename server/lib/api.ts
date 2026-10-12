import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { mapDbError } from '@/server/repos/db-errors';
import { getCurrentUser } from '@/server/services/session';
import { type OrgContext, resolveOrgContext, type SessionUser } from '@/server/services/context';
import { env } from './env';
import { AppError, badRequest, forbidden, isAppError, unauthenticated } from './errors';
import { logger } from './logger';
import { enforceRateLimit, RATE_LIMITS } from './rate-limit';
import { TenantGuardError } from './tenant-guard';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function jsonError(err: AppError, requestId?: string) {
  const body: ApiErrorBody = {
    error: { code: err.code, message: err.message, details: err.details ?? null },
  };
  const headers: Record<string, string> = {};
  if (requestId) headers['x-request-id'] = requestId;
  const retry = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
  if (err.code === 'RATE_LIMITED' && retry) headers['retry-after'] = String(retry);
  return NextResponse.json(body, { status: err.status, headers });
}

/** Maps any thrown value to the public error shape. Internal details are logged, never returned. */
export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err;
  const dbErr = mapDbError(err);
  if (dbErr) return dbErr;
  if (err instanceof TenantGuardError) logger.fatal({ err }, 'tenant guard tripped');
  return new AppError('INTERNAL', 'Internal server error');
}

/**
 * CSRF defence for cookie-authenticated API calls: unsafe methods must come
 * from our own origin (checked via the Origin header, falling back to
 * Sec-Fetch-Site). Session cookies are also SameSite=Lax.
 */
export function assertSameOrigin(req: Request) {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get('origin');
  const allowed = new Set([new URL(env.APP_URL).origin, new URL(req.url).origin]);
  if (origin) {
    if (!allowed.has(origin)) throw forbidden('Cross-origin request blocked');
    return;
  }
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none')
    throw forbidden('Cross-origin request blocked');
}

export async function readJson(req: Request): Promise<unknown> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.includes('application/json'))
    throw badRequest('Expected a JSON body (content-type: application/json)');
  try {
    return await req.json();
  } catch {
    throw badRequest('Malformed JSON body');
  }
}

export function searchParams(req: NextRequest): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}

type RouteParams = Record<string, string | string[] | undefined>;

interface HandlerArgs<P extends RouteParams> {
  req: NextRequest;
  params: P;
  requestId: string;
}

async function run(req: NextRequest, fn: (requestId: string) => Promise<Response>) {
  const requestId = req.headers.get('x-request-id') ?? randomUUID();
  const started = performance.now();
  const log = logger.child({ requestId, method: req.method, path: req.nextUrl.pathname });
  try {
    const res = await fn(requestId);
    res.headers.set('x-request-id', requestId);
    log.info({ status: res.status, ms: Math.round(performance.now() - started) }, 'api request');
    return res;
  } catch (err) {
    const appErr = toAppError(err);
    if (appErr.status >= 500) {
      log.error({ err }, 'api error');
      Sentry.captureException(err, { tags: { requestId } });
    } else log.info({ status: appErr.status, code: appErr.code }, 'api request rejected');
    return jsonError(appErr, requestId);
  }
}

/** Authenticated route: CSRF check, session user, per-user write rate limit. */
export function userRoute<P extends RouteParams>(
  handler: (args: HandlerArgs<P> & { user: SessionUser }) => Promise<Response>,
) {
  return (req: NextRequest, context: { params: Promise<P> }) =>
    run(req, async (requestId) => {
      assertSameOrigin(req);
      const user = await getCurrentUser();
      if (!user) throw unauthenticated();
      if (!SAFE_METHODS.has(req.method))
        await enforceRateLimit(`write:${user.id}`, RATE_LIMITS.write);
      return handler({ req, params: await context.params, requestId, user });
    });
}

/** Authenticated + tenant-scoped route for `/api/v1/orgs/[orgSlug]/...`. Non-members get 404. */
export function orgRoute<P extends RouteParams & { orgSlug: string }>(
  handler: (args: HandlerArgs<P> & { ctx: OrgContext }) => Promise<Response>,
) {
  return userRoute<P>(async ({ user, params, ...rest }) => {
    const ctx = await resolveOrgContext(user, params.orgSlug);
    return handler({ ...rest, params, ctx });
  });
}

/** Unauthenticated route (still gets error mapping and logging). */
export function publicRoute<P extends RouteParams>(
  handler: (args: HandlerArgs<P>) => Promise<Response>,
) {
  return (req: NextRequest, context: { params: Promise<P> }) =>
    run(req, async (requestId) => handler({ req, params: await context.params, requestId }));
}

export const ok = <T>(data: T, status = 200) => NextResponse.json({ data }, { status });
export const created = <T>(data: T) => ok(data, 201);
export const noContent = () => new NextResponse(null, { status: 204 });
export const paged = <T>(page: { items: T[]; nextCursor: string | null }) =>
  NextResponse.json({ data: page.items, nextCursor: page.nextCursor });
