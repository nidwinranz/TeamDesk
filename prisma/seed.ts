import { PrismaClient } from '@prisma/client';
import { DEMO_ACCOUNTS } from '../lib/demo';
import { DEV_PASSWORD, seedOrgs, wipe } from './seed-data';
import { demoOrg, demoUsers } from './demo-data';

const db = new PrismaClient();

const USERS = [
  { email: 'owner@acme.test', name: 'Ada Owner' },
  { email: 'admin@acme.test', name: 'Ben Admin' },
  { email: 'member@acme.test', name: 'Cleo Member' },
  { email: 'viewer@acme.test', name: 'Dev Viewer' },
];

async function main() {
  await wipe(db);
  await seedOrgs(
    db,
    USERS,
    [
      {
        name: 'Acme Studio',
        slug: 'acme',
        members: [
          { email: 'owner@acme.test', role: 'OWNER' },
          { email: 'admin@acme.test', role: 'ADMIN' },
          { email: 'member@acme.test', role: 'MEMBER' },
          { email: 'viewer@acme.test', role: 'VIEWER' },
        ],
        projects: [
          {
            name: 'Website redesign',
            description: 'New marketing site for the spring launch.',
            requests: [
              {
                title: 'Hero section copy',
                status: 'IN_PROGRESS',
                priority: 'HIGH',
                assignee: 'member@acme.test',
                dueInDays: 3,
                comments: [
                  { author: 'owner@acme.test', body: 'Client wants a punchier headline.' },
                  { author: 'member@acme.test', body: 'Drafted three options, sharing tomorrow.' },
                ],
              },
              { title: 'Pricing page layout', status: 'OPEN', priority: 'MEDIUM', dueInDays: 10 },
              {
                title: 'Fix footer links',
                status: 'DONE',
                priority: 'LOW',
                assignee: 'admin@acme.test',
              },
              {
                title: 'Accessibility audit',
                status: 'BLOCKED',
                priority: 'URGENT',
                assignee: 'admin@acme.test',
                dueInDays: -1,
              },
            ],
          },
          {
            name: 'Mobile app',
            description: 'iOS and Android companion app.',
            requests: [
              {
                title: 'Push notification opt-in',
                status: 'OPEN',
                priority: 'HIGH',
                assignee: 'member@acme.test',
              },
              { title: 'App store screenshots', status: 'OPEN', priority: 'LOW' },
            ],
          },
          {
            name: 'Brand refresh 2024',
            description: 'Wrapped up last year.',
            archived: true,
            requests: [],
          },
        ],
      },
      {
        name: 'Globex Agency',
        slug: 'globex',
        members: [
          { email: 'admin@acme.test', role: 'OWNER' },
          { email: 'member@acme.test', role: 'MEMBER' },
        ],
        projects: [
          {
            name: 'Client portal',
            description: 'Self-service portal for Globex clients.',
            requests: [
              {
                title: 'SSO login',
                status: 'OPEN',
                priority: 'MEDIUM',
                assignee: 'member@acme.test',
              },
            ],
          },
        ],
      },
    ],
    DEV_PASSWORD,
  );
  await seedOrgs(db, demoUsers, [demoOrg], DEMO_ACCOUNTS.password);
  console.log(
    `Seeded. Log in as owner@acme.test / ${DEV_PASSWORD} (also admin@, member@, viewer@acme.test).`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
