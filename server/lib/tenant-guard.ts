/**
 * Tenant guard: a defence-in-depth check that every query against a
 * tenant-owned model is explicitly scoped by `organizationId`.
 *
 * It is wired into the Prisma client in `server/lib/prisma.ts` and is the last
 * line of defence behind the repository layer (which always takes `orgId`).
 * See docs/adr/0001-tenancy-model.md.
 */

export const TENANT_MODELS = new Set([
  'Membership',
  'Invite',
  'Subscription',
  'Project',
  'Request',
  'Comment',
  'AuditLog',
  'ApiKey',
]);

/** Models that may only be appended to. */
export const APPEND_ONLY_MODELS = new Set(['AuditLog']);

const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
  'upsert',
]);

const CREATE_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn']);
const MUTATING_OPERATIONS = new Set([
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);

export class TenantGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantGuardError';
  }
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** An org filter is a non-empty string, or `{ equals: string }`. Anything looser is rejected. */
function isOrgFilter(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0;
  if (isRecord(value)) return typeof value.equals === 'string' && value.equals.length > 0;
  return false;
}

function hasOrgInData(data: unknown): boolean {
  if (Array.isArray(data)) return data.length > 0 && data.every(hasOrgInData);
  return (
    isRecord(data) && typeof data.organizationId === 'string' && data.organizationId.length > 0
  );
}

export function assertTenantScoped(
  model: string | undefined,
  operation: string,
  args: unknown,
): void {
  if (!model || !TENANT_MODELS.has(model)) return;
  const a = isRecord(args) ? args : {};

  if (APPEND_ONLY_MODELS.has(model) && MUTATING_OPERATIONS.has(operation)) {
    throw new TenantGuardError(`${model} is append-only; "${operation}" is not allowed`);
  }

  if (WHERE_OPERATIONS.has(operation)) {
    const where = isRecord(a.where) ? a.where : undefined;
    if (!where || !isOrgFilter(where.organizationId)) {
      throw new TenantGuardError(`${model}.${operation} must filter by organizationId`);
    }
  }

  if (operation === 'upsert' && !hasOrgInData(a.create)) {
    throw new TenantGuardError(`${model}.upsert must set organizationId in create`);
  }

  if (CREATE_OPERATIONS.has(operation) && !hasOrgInData(a.data)) {
    throw new TenantGuardError(`${model}.${operation} must set organizationId`);
  }
}
