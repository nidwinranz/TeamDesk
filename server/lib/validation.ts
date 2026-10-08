import { type z } from 'zod';
import { validationFailed } from './errors';

/** Parses input or throws a 422 AppError carrying field-level details. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    throw validationFailed('Invalid input', { fieldErrors });
  }
  return result.data;
}
