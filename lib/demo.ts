/** Demo-mode accounts (seeded by `pnpm db:seed` / `pnpm demo:reset`). Not secrets: the demo is public. */
export const DEMO_ACCOUNTS = {
  password: 'demo-password-123',
  owner: { email: 'owner@demo.teamdesk.dev', name: 'Olivia Owner' },
  viewer: { email: 'viewer@demo.teamdesk.dev', name: 'Victor Viewer' },
  orgSlug: 'demo',
} as const;
