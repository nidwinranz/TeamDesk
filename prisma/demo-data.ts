import { DEMO_ACCOUNTS } from '../lib/demo';

export const demoUsers = [
  { email: DEMO_ACCOUNTS.owner.email, name: DEMO_ACCOUNTS.owner.name },
  { email: DEMO_ACCOUNTS.viewer.email, name: DEMO_ACCOUNTS.viewer.name },
];

export const demoOrg = {
  name: 'Demo Agency',
  slug: DEMO_ACCOUNTS.orgSlug,
  members: [
    { email: DEMO_ACCOUNTS.owner.email, role: 'OWNER' as const },
    { email: DEMO_ACCOUNTS.viewer.email, role: 'VIEWER' as const },
  ],
  projects: [
    {
      name: 'Northwind onboarding',
      description: 'Kick-off and setup for our newest client.',
      requests: [
        {
          title: 'Collect brand assets',
          status: 'DONE' as const,
          priority: 'MEDIUM' as const,
          assignee: DEMO_ACCOUNTS.owner.email,
          comments: [{ author: DEMO_ACCOUNTS.owner.email, body: 'Logo pack received, thanks!' }],
        },
        {
          title: 'Set up staging site',
          status: 'IN_PROGRESS' as const,
          priority: 'HIGH' as const,
          assignee: DEMO_ACCOUNTS.owner.email,
          dueInDays: 2,
        },
        {
          title: 'Weekly status report',
          status: 'OPEN' as const,
          priority: 'LOW' as const,
          dueInDays: 5,
        },
      ],
    },
    {
      name: 'Q3 campaign',
      description: 'Paid social campaign for the autumn launch.',
      requests: [
        {
          title: 'Ad copy variants',
          status: 'OPEN' as const,
          priority: 'URGENT' as const,
          dueInDays: 1,
        },
        { title: 'Landing page A/B test', status: 'BLOCKED' as const, priority: 'HIGH' as const },
      ],
    },
  ],
};
