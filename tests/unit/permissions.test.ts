import type { Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ACTIONS, type Action, can } from '@/server/policies/permissions';

/** Expected grants, written out explicitly so any change to the map is a deliberate test change. */
const EXPECTED: Record<Role, readonly Action[]> = {
  OWNER: ACTIONS,
  ADMIN: [
    'project:read',
    'project:create',
    'project:update',
    'project:archive',
    'request:read',
    'request:create',
    'request:update',
    'request:delete',
    'comment:read',
    'comment:create',
    'comment:delete',
    'member:invite',
    'member:remove',
    'member:role',
    'billing:view',
    'audit:read',
  ],
  MEMBER: [
    'project:read',
    'project:create',
    'request:read',
    'request:create',
    'request:update',
    'request:delete',
    'comment:read',
    'comment:create',
    'comment:delete',
  ],
  VIEWER: ['project:read', 'request:read', 'comment:read'],
};

const ROLES: Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
const cases = ROLES.flatMap((role) =>
  ACTIONS.map((action) => [role, action, EXPECTED[role].includes(action)] as const),
);

describe('can(membership, action)', () => {
  it.each(cases)('%s → %s = %s', (role, action, allowed) => {
    expect(can({ role }, action)).toBe(allowed);
  });

  it('denies everything without a membership', () => {
    for (const action of ACTIONS) {
      expect(can(null, action)).toBe(false);
      expect(can(undefined, action)).toBe(false);
    }
  });

  it('ADMIN cannot manage billing or org settings (OWNER only)', () => {
    expect(can({ role: 'ADMIN' }, 'billing:manage')).toBe(false);
    expect(can({ role: 'ADMIN' }, 'org:update')).toBe(false);
    expect(can({ role: 'OWNER' }, 'billing:manage')).toBe(true);
  });
});
