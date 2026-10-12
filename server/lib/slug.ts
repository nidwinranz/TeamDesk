import { randomBytes } from 'node:crypto';

/** Slugs that would collide with top-level routes. */
export const RESERVED_SLUGS = new Set([
  'api',
  'login',
  'logout',
  'signup',
  'verify',
  'reset',
  'invite',
  'onboarding',
  'settings',
  'billing',
  'admin',
  'app',
  'auth',
  'dashboard',
  'static',
  '_next',
  'new',
  'help',
  'docs',
  'about',
  'pricing',
  'terms',
  'privacy',
  'www',
  'demo',
  'health',
  'not-found',
]);

export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base.length >= 3 ? base : `${base || 'team'}-workspace`.replace(/^-/, '');
}

export function withSuffix(slug: string): string {
  return `${slug.slice(0, 40)}-${randomBytes(3).toString('hex')}`;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
