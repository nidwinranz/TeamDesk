import { expect, test } from '@playwright/test';
import { attemptLogIn, linkFromEmail, logIn, signUp, uniqueEmail } from './helpers';

test('sign up, verify via email, log in, log out, reset password', async ({ page }) => {
  const email = uniqueEmail('auth');
  const password = 'e2e-password-123';
  await signUp(page, { name: 'Erin E2E', email, password, orgName: 'Erin Co' });

  await logIn(page, email, password);
  await expect(page.getByRole('heading', { name: 'Erin Co' })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/reset');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText(/reset link is on its way/)).toBeVisible();
  await page.goto(await linkFromEmail(email, /Reset your TeamDesk password/));
  await page.getByLabel('New password').fill('a-brand-new-password');
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page).toHaveURL(/\/login\?reset=1/);

  await attemptLogIn(page, email, password);
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  await logIn(page, email, 'a-brand-new-password');
  await expect(page.getByRole('heading', { name: 'Erin Co' })).toBeVisible();
});

test('protected pages redirect to login and other workspaces 404', async ({ page }) => {
  await page.goto('/acme/projects');
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Facme%2Fprojects/);

  const email = uniqueEmail('tenant');
  await signUp(page, { name: 'Tia', email, password: 'e2e-password-123', orgName: 'Tia Co' });
  await logIn(page, email, 'e2e-password-123');
  await expect(page.getByRole('heading', { name: 'Tia Co' })).toBeVisible();
  const res = await page.goto('/acme');
  expect(res?.status()).toBe(404);
});
