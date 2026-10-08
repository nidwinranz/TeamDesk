import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { redis } from '@/server/lib/redis';

export const dynamic = 'force-dynamic';

async function check(fn: () => Promise<unknown>) {
  const started = performance.now();
  try {
    await fn();
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - started) };
  }
}

/** Liveness + dependency check for uptime monitors. */
export async function GET() {
  const [database, cache] = await Promise.all([
    check(() => prisma.$queryRaw`SELECT 1`),
    check(() => redis.ping()),
  ]);
  const ok = database.ok && cache.ok;
  return NextResponse.json(
    { status: ok ? 'ok' : 'degraded', checks: { database, redis: cache } },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
