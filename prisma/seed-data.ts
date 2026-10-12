import type { PrismaClient, RequestPriority, RequestStatus, Role } from '@prisma/client';
import { hash } from '@node-rs/argon2';

export const DEV_PASSWORD = 'teamdesk-dev-123';

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/** Wipes every table. TRUNCATE bypasses the AuditLog append-only row trigger by design. */
export async function wipe(db: PrismaClient) {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

interface SeedUser {
  email: string;
  name: string;
}

interface SeedOrg {
  name: string;
  slug: string;
  members: { email: string; role: Role }[];
  projects: {
    name: string;
    description: string;
    archived?: boolean;
    requests: {
      title: string;
      description?: string;
      status: RequestStatus;
      priority: RequestPriority;
      assignee?: string;
      dueInDays?: number;
      comments?: { author: string; body: string }[];
    }[];
  }[];
}

export async function seedOrgs(
  db: PrismaClient,
  usersIn: SeedUser[],
  orgsIn: SeedOrg[],
  password: string,
) {
  const passwordHash = await hash(password, ARGON);
  const users = new Map<string, string>();
  for (const u of usersIn) {
    const user = await db.user.create({
      data: { email: u.email, name: u.name, passwordHash, emailVerifiedAt: new Date() },
    });
    users.set(u.email, user.id);
  }
  const id = (email: string) => {
    const v = users.get(email);
    if (!v) throw new Error(`seed: unknown user ${email}`);
    return v;
  };

  for (const o of orgsIn) {
    const org = await db.organization.create({ data: { name: o.name, slug: o.slug } });
    const owner = o.members.find((m) => m.role === 'OWNER');
    for (const m of o.members) {
      await db.membership.create({
        data: { organizationId: org.id, userId: id(m.email), role: m.role },
      });
    }
    await db.auditLog.create({
      data: {
        organizationId: org.id,
        actorId: owner ? id(owner.email) : null,
        action: 'org.created',
        targetType: 'organization',
        targetId: org.id,
        metadata: { name: o.name, slug: o.slug, seeded: true },
      },
    });
    for (const p of o.projects) {
      const project = await db.project.create({
        data: {
          organizationId: org.id,
          name: p.name,
          description: p.description,
          archivedAt: p.archived ? new Date() : null,
        },
      });
      for (const r of p.requests) {
        const request = await db.request.create({
          data: {
            organizationId: org.id,
            projectId: project.id,
            title: r.title,
            description: r.description ?? '',
            status: r.status,
            priority: r.priority,
            assigneeId: r.assignee ? id(r.assignee) : null,
            createdById: owner ? id(owner.email) : null,
            dueDate:
              r.dueInDays !== undefined ? new Date(Date.now() + r.dueInDays * 86_400_000) : null,
          },
        });
        for (const c of r.comments ?? []) {
          await db.comment.create({
            data: {
              organizationId: org.id,
              requestId: request.id,
              authorId: id(c.author),
              body: c.body,
            },
          });
        }
      }
    }
  }
  return users;
}
