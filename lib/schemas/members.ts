import { z } from 'zod';
import { emailSchema } from './auth';

export const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export const roleSchema = z.enum(ROLES);

export const inviteSchema = z.object({ email: emailSchema, role: roleSchema.default('MEMBER') });
export const changeRoleSchema = z.object({ role: roleSchema });
