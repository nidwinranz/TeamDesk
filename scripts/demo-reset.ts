/**
 * Resets a *demo deployment* to its seeded state: wipes every table and re-seeds
 * the demo workspace (OWNER + VIEWER logins). Refuses to run unless DEMO_MODE=true,
 * because it deletes all data — including workspaces visitors created.
 *
 *   DEMO_MODE=true pnpm demo:reset
 */
import { PrismaClient } from '@prisma/client';
import { DEMO_ACCOUNTS } from '../lib/demo';
import { demoOrg, demoUsers } from '../prisma/demo-data';
import { seedOrgs, wipe } from '../prisma/seed-data';

async function main() {
  if (process.env.DEMO_MODE !== 'true') {
    console.error('Refusing to reset: DEMO_MODE is not "true". This script deletes ALL data.');
    process.exitCode = 1;
    return;
  }
  const db = new PrismaClient();
  try {
    const started = Date.now();
    await wipe(db);
    await seedOrgs(db, demoUsers, [demoOrg], DEMO_ACCOUNTS.password);
    console.log(
      `Demo reset in ${Date.now() - started} ms. Log in as ${DEMO_ACCOUNTS.owner.email} or ${DEMO_ACCOUNTS.viewer.email} / ${DEMO_ACCOUNTS.password}`,
    );
  } finally {
    await db.$disconnect();
  }
}

void main();
