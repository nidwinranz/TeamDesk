/** Canonical audit-log action names. The audit page filters on these. */
export const AUDIT_ACTIONS = [
  'org.created',
  'org.updated',
  'invite.sent',
  'invite.resent',
  'invite.accepted',
  'invite.revoked',
  'member.role_changed',
  'member.removed',
  'project.created',
  'project.updated',
  'project.archived',
  'project.unarchived',
  'request.created',
  'request.updated',
  'request.deleted',
  'billing.checkout_started',
  'billing.subscription_updated',
  'billing.payment_failed',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
