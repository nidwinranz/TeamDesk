import { z } from 'zod';

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name')
  .max(80, 'Use at most 80 characters');
export const projectDescriptionSchema = z.string().trim().max(2000, 'Use at most 2000 characters');

export const createProjectSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema.default(''),
});

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: projectDescriptionSchema.optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const listProjectsQuerySchema = z.object({
  archived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
