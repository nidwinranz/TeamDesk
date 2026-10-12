import { describe, expect, it } from 'vitest';
import { prisma } from '@/server/lib/prisma';
import { TenantGuardError } from '@/server/lib/tenant-guard';
import { testDb } from '../helpers/db';
import { createOrg, createProject } from '../helpers/factories';

describe('tenant guard on a real Prisma client', () => {
  it('rejects an unscoped tenant query before it reaches the database', async () => {
    await expect(prisma.project.findMany()).rejects.toBeInstanceOf(TenantGuardError);
    await expect(prisma.request.count({ where: { title: 'x' } })).rejects.toThrow(/organizationId/);
  });

  it('allows scoped queries and only returns rows of that org', async () => {
    const a = await createOrg();
    const b = await createOrg();
    await createProject(a.id, 'A1');
    await createProject(b.id, 'B1');
    const rows = await prisma.project.findMany({ where: { organizationId: a.id } });
    expect(rows.map((r) => r.name)).toEqual(['A1']);
  });

  it('applies inside interactive transactions too', async () => {
    await expect(prisma.$transaction((tx) => tx.project.findMany())).rejects.toBeInstanceOf(
      TenantGuardError,
    );
  });

  it('blocks audit log mutation in Prisma and in the database', async () => {
    const org = await createOrg();
    const log = await prisma.auditLog.create({
      data: {
        organizationId: org.id,
        action: 'org.created',
        targetType: 'organization',
        targetId: org.id,
      },
    });
    await expect(
      prisma.auditLog.update({
        where: { id: log.id, organizationId: org.id },
        data: { action: 'x' },
      }),
    ).rejects.toThrow(/append-only/);
    // Bypassing Prisma's guard still hits the DB trigger.
    await expect(
      testDb.$executeRaw`UPDATE "AuditLog" SET action = 'x' WHERE id = ${log.id}`,
    ).rejects.toThrow(/append-only/);
    await expect(testDb.$executeRaw`DELETE FROM "AuditLog" WHERE id = ${log.id}`).rejects.toThrow(
      /append-only/,
    );
  });
});
