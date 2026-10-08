import 'server-only';
import { PrismaClient } from '@prisma/client';
import { assertTenantScoped } from './tenant-guard';

function createBaseClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export function withTenantGuard(client: PrismaClient) {
  return client.$extends({
    name: 'tenant-guard',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          assertTenantScoped(model, operation, args);
          return query(args);
        },
      },
    },
  });
}

type GuardedClient = ReturnType<typeof withTenantGuard>;

const globalForPrisma = globalThis as unknown as {
  basePrisma?: PrismaClient;
  prisma?: GuardedClient;
};

const basePrisma = globalForPrisma.basePrisma ?? createBaseClient();

/** Default client: every tenant-model query must be scoped by organizationId. */
export const prisma: GuardedClient = globalForPrisma.prisma ?? withTenantGuard(basePrisma);

/**
 * Unguarded client for the few deliberate cross-tenant lookups (e.g. "which
 * orgs does this user belong to", invite-token lookup, Stripe webhooks).
 * Only `server/repos/*` may import it, and call sites are named `...Unscoped`.
 */
export const systemPrisma: PrismaClient = basePrisma;

if (process.env.NODE_ENV === 'development') {
  globalForPrisma.basePrisma = basePrisma;
  globalForPrisma.prisma = prisma;
}

export type Db = GuardedClient;
/** Client handle usable both at top level and inside `$transaction(async (tx) => ...)`. */
export type Tx = Omit<
  GuardedClient,
  '$extends' | '$transaction' | '$disconnect' | '$connect' | '$on'
>;
