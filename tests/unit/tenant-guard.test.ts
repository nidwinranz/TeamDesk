import { describe, expect, it } from 'vitest';
import { assertTenantScoped, TENANT_MODELS, TenantGuardError } from '@/server/lib/tenant-guard';

const ORG = 'org_123';

describe('assertTenantScoped', () => {
  it('ignores non-tenant models', () => {
    expect(() => assertTenantScoped('User', 'findMany', {})).not.toThrow();
    expect(() =>
      assertTenantScoped('Organization', 'findUnique', { where: { slug: 'x' } }),
    ).not.toThrow();
    expect(() => assertTenantScoped(undefined, '$queryRaw', {})).not.toThrow();
  });

  it.each([...TENANT_MODELS])('%s.findMany without organizationId throws', (model) => {
    expect(() => assertTenantScoped(model, 'findMany', { where: { id: 'x' } })).toThrow(
      TenantGuardError,
    );
    expect(() => assertTenantScoped(model, 'findMany', {})).toThrow(TenantGuardError);
    expect(() => assertTenantScoped(model, 'findMany', undefined)).toThrow(TenantGuardError);
  });

  it.each([
    'findUnique',
    'findUniqueOrThrow',
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'count',
    'aggregate',
    'groupBy',
    'updateMany',
    'deleteMany',
  ])('Project.%s requires organizationId in where', (op) => {
    expect(() => assertTenantScoped('Project', op, { where: { name: 'x' } })).toThrow(
      /must filter by organizationId/,
    );
    expect(() =>
      assertTenantScoped('Project', op, { where: { organizationId: ORG } }),
    ).not.toThrow();
  });

  it('accepts { equals } but rejects looser filters', () => {
    expect(() =>
      assertTenantScoped('Request', 'findMany', { where: { organizationId: { equals: ORG } } }),
    ).not.toThrow();
    expect(() =>
      assertTenantScoped('Request', 'findMany', {
        where: { organizationId: { in: [ORG, 'other'] } },
      }),
    ).toThrow();
    expect(() =>
      assertTenantScoped('Request', 'findMany', { where: { organizationId: { not: ORG } } }),
    ).toThrow();
    expect(() =>
      assertTenantScoped('Request', 'findMany', { where: { organizationId: '' } }),
    ).toThrow();
    expect(() =>
      assertTenantScoped('Request', 'findMany', { where: { organizationId: undefined } }),
    ).toThrow();
  });

  it('requires organizationId on create and createMany', () => {
    expect(() => assertTenantScoped('Project', 'create', { data: { name: 'x' } })).toThrow(
      /must set organizationId/,
    );
    expect(() =>
      assertTenantScoped('Project', 'create', { data: { name: 'x', organizationId: ORG } }),
    ).not.toThrow();
    expect(() =>
      assertTenantScoped('Comment', 'createMany', {
        data: [{ organizationId: ORG }, { body: 'no org' }],
      }),
    ).toThrow();
    expect(() => assertTenantScoped('Comment', 'createMany', { data: [] })).toThrow();
    expect(() =>
      assertTenantScoped('Comment', 'createMany', {
        data: [{ organizationId: ORG }, { organizationId: ORG }],
      }),
    ).not.toThrow();
  });

  it('requires organizationId in where and create for upsert', () => {
    expect(() =>
      assertTenantScoped('Subscription', 'upsert', {
        where: { organizationId: ORG },
        create: {},
        update: {},
      }),
    ).toThrow(/create/);
    expect(() =>
      assertTenantScoped('Subscription', 'upsert', {
        where: { organizationId: ORG },
        create: { organizationId: ORG },
        update: {},
      }),
    ).not.toThrow();
  });

  it('requires organizationId for update and delete', () => {
    expect(() =>
      assertTenantScoped('Request', 'update', { where: { id: 'r1' }, data: {} }),
    ).toThrow();
    expect(() => assertTenantScoped('Request', 'delete', { where: { id: 'r1' } })).toThrow();
    expect(() =>
      assertTenantScoped('Request', 'update', {
        where: { id: 'r1', organizationId: ORG },
        data: {},
      }),
    ).not.toThrow();
  });

  it.each(['update', 'updateMany', 'delete', 'deleteMany', 'upsert'])(
    'AuditLog is append-only: %s throws',
    (op) => {
      expect(() =>
        assertTenantScoped('AuditLog', op, {
          where: { organizationId: ORG },
          create: { organizationId: ORG },
          data: {},
        }),
      ).toThrow(/append-only/);
    },
  );

  it('allows appending and reading audit logs with an org filter', () => {
    expect(() =>
      assertTenantScoped('AuditLog', 'create', { data: { organizationId: ORG } }),
    ).not.toThrow();
    expect(() =>
      assertTenantScoped('AuditLog', 'findMany', { where: { organizationId: ORG } }),
    ).not.toThrow();
  });
});
