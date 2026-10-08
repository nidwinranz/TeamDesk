import { expect, test } from '@playwright/test';
import { linkFromEmail, logIn, signUp, uniqueEmail } from './helpers';

const PASSWORD = 'e2e-password-123';

test('sign up → create org → invite → accept in a second browser context', async ({ page, browser }) => {
  const ownerEmail = uniqueEmail('owner');
  const inviteeEmail = uniqueEmail('invitee');

  await signUp(page, { name: 'Olive Owner', email: ownerEmail, password: PASSWORD, orgName: 'Olive Studio' });
  await logIn(page, ownerEmail, PASSWORD);
  await expect(page.getByRole('heading', { name: 'Olive Studio' })).toBeVisible();

  await page.getByRole('link', { name: 'Members' }).click();
  await page.getByLabel('Email').fill(inviteeEmail);
  await page.getByLabel('Role', { exact: true }).selectOption('MEMBER');
  await page.getByRole('button', { name: 'Send invite' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Invite sent to ${inviteeEmail}` })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: inviteeEmail })).toBeVisible();

  const inviteLink = await linkFromEmail(inviteeEmail, /invited to Olive Studio/);

  const invitee = await browser.newContext();
  const p2 = await invitee.newPage();
  await p2.goto(inviteLink);
  await expect(p2.getByRole('heading', { name: 'Join Olive Studio' })).toBeVisible();
  await p2.getByRole('link', { name: 'Create an account' }).click();
  await expect(p2.getByLabel('Work email')).toHaveValue(inviteeEmail);
  await expect(p2.getByLabel('Workspace name')).toHaveCount(0);
  await p2.getByLabel('Your name').fill('Ivy Invitee');
  await p2.getByLabel('Password').fill(PASSWORD);
  await p2.getByRole('button', { name: 'Create account' }).click();
  await expect(p2.getByText('invite accepted')).toBeVisible();
  await p2.getByLabel('Password').fill(PASSWORD);
  await p2.getByLabel('Email').fill(inviteeEmail);
  await p2.getByRole('button', { name: 'Log in' }).click();
  await expect(p2.getByRole('heading', { name: 'Olive Studio' })).toBeVisible();
  await expect(p2.getByText('signed in as member')).toBeVisible();
  await invitee.close();

  await page.reload();
  await expect(page.getByRole('cell', { name: new RegExp(inviteeEmail) })).toBeVisible();
});
