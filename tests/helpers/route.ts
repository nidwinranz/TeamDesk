import { NextRequest } from 'next/server';
import { vi } from 'vitest';
import type { SessionUser } from '@/server/services/context';

/** The signed-in user seen by route handlers; `null` = anonymous. */
export const session = { user: null as SessionUser | null };

// Replaces the Auth.js-backed session module: tests pick the acting user via `session.user`.
vi.mock('@/server/services/session', async () => {
  const { resolveOrgContext } = await import('@/server/services/context');
  const { unauthenticated } = await import('@/server/lib/errors');
  const requireUser = () =>
    session.user ? Promise.resolve(session.user) : Promise.reject(unauthenticated());
  return {
    getCurrentUser: () => Promise.resolve(session.user),
    requireUser,
    getOrgContext: async (slug: string) => resolveOrgContext(await requireUser(), slug),
  };
});

interface CallOptions {
  method?: string;
  path?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  as?: SessionUser | null;
}

export async function call<P extends Record<string, string>>(
  handler: (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>,
  opts: CallOptions & { params?: P } = {},
) {
  session.user = opts.as === undefined ? session.user : opts.as;
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { origin: 'http://localhost:3000', ...opts.headers };
  let body: string | undefined;
  if (opts.rawBody !== undefined) body = opts.rawBody;
  else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers['content-type'] ??= 'application/json';
  }
  const req = new NextRequest(`http://localhost:3000${opts.path ?? '/api/v1/test'}`, {
    method,
    headers,
    body,
  });
  const res = await handler(req, { params: Promise.resolve((opts.params ?? {}) as P) });
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : null;
  return {
    status: res.status,
    json: json as Record<string, unknown> & { data?: unknown; error?: { code: string } },
    headers: res.headers,
  };
}
