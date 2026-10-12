import { z } from 'zod';

export const idSchema = z.string().min(1).max(64);

export const slugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and single dashes only');
