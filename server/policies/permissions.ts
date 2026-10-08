import type { Role } from '@prisma/client';

/**
 * The single source of truth for authorization. Every service function calls
 * `can`/`assertCan` before doing work. Wildcards: `*` (everything) and
 * `resource:*` (every action on a resource).
 *
 * Deviation from the original brief: ADMIN additionally gets `comment:*` —
 * without it admins could manage requests but not read their comments.
 * See docs/adr/0004-permissions.md.
 */
export const PERMISSIONS = {
  OWNER: ['*'],
  ADMIN: [
    'project:*',
    'request:*',
    'comment:*',
    'member:invite',
    'member:remove',
    'member:role',
    'billing:view',
    'audit:read',
  ],
  MEMBER: ['project:read', 'project:create', 'request:*', 'comment:*'],
  VIEWER: ['project:read', 'request:read', 'comment:read'],
} as const satisfies Record<Role, readonly string[]>;

/** Every concrete action used by services. */
export const ACTIONS = [
  'org:update',
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
  'billing:manage',
  'audit:read',
] as const;

export type Action = (typeof ACTIONS)[number];

export interface MembershipLike {
  role: Role;
}

export function can(membership: MembershipLike | null | undefined, action: Action): boolean {
  if (!membership) return false;
  const grants: readonly string[] = PERMISSIONS[membership.role];
  const [resource] = action.split(':');
  return grants.some((g) => g === '*' || g === action || g === `${resource}:*`);
}

/** Role ordering used for "cannot grant a role above your own" checks. */
export const ROLE_RANK: Record<Role, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1, VIEWER: 0 };
