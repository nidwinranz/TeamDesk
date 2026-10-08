import { Prisma } from '@prisma/client';
import { AppError } from '@/server/lib/errors';

/** Translates known Prisma errors into AppErrors; returns null for anything else. */
export function mapDbError(err: unknown): AppError | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (err.code) {
    case 'P2002':
      return new AppError('CONFLICT', 'A record with these values already exists');
    case 'P2025':
      return new AppError('NOT_FOUND', 'Resource not found');
    case 'P2034':
      return new AppError(
        'CONFLICT',
        'The request conflicted with a concurrent change, please retry',
      );
    default:
      return null;
  }
}
