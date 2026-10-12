import { expect, test } from '@playwright/test';
import { logIn } from './helpers';

// Uses the seeded Acme workspace (pnpm db:seed): member@ and viewer@acme.test.
const PASSWORD = 'teamdesk-dev-123';

test('a MEMBER runs a request end to end, keyboard-only where it matters', async ({ page }) => {
  await logIn(page, 'member@acme.test', PASSWORD);
  await expect(page.getByRole('heading', { name: 'Acme Studio' })).toBeVisible();

  await page.getByRole('link', { name: 'Projects' }).click();
  await page.waitForURL(/\/acme\/projects$/);
  await page.getByRole('link', { name: /Website redesign/ }).click();
  await page.waitForURL(/\/acme\/projects\/\w+/);
  await expect(page.getByRole('heading', { name: 'Website redesign' })).toBeVisible();

  const title = `E2E request ${Date.now()}`;
  await page.getByRole('button', { name: 'New request' }).click();
  const dialog = page.getByRole('dialog', { name: 'New request' });
  await dialog.getByLabel('Title').fill(title);
  await dialog.getByLabel('Priority').selectOption('URGENT');
  await dialog.getByLabel('Due date').fill('2031-05-01');
  await dialog.getByLabel('Title').press('Enter'); // submit from the keyboard
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('link', { name: title })).toBeVisible();

  // Inline optimistic status change from the table.
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.ok());
  await page.getByRole('combobox', { name: `Status of ${title}` }).selectOption('IN_PROGRESS');
  await saved;
  await page.getByRole('link', { name: title }).click();
  await page.waitForURL(/\/acme\/requests\/\w+/);
  await expect(page.getByLabel('Status')).toHaveValue('IN_PROGRESS');

  await page.getByLabel('Add a comment').fill('Working on it');
  await page.getByRole('button', { name: 'Comment' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Working on it' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Comments (1)' })).toBeVisible();

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Delete request' }).click();
  await expect(page).toHaveURL(/\/acme\/requests$/);
  await expect(page.getByRole('link', { name: title })).toHaveCount(0);
});

test('filters are reflected in the URL', async ({ page }) => {
  await logIn(page, 'member@acme.test', PASSWORD);
  await page.goto('/acme/requests');
  await page.getByLabel('Status', { exact: true }).selectOption('BLOCKED');
  await expect(page).toHaveURL(/status=BLOCKED/);
  await expect(page.getByRole('link', { name: 'Accessibility audit' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hero section copy' })).toHaveCount(0);
});

test('a VIEWER is read-only in the UI and the API', async ({ page }) => {
  await logIn(page, 'viewer@acme.test', PASSWORD);
  await page.goto('/acme/requests');
  await expect(page.getByRole('link', { name: 'Hero section copy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New request' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: /^Status of/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Hero section copy' }).click();
  await expect(page.getByLabel('Add a comment')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Members' })).toHaveCount(0);

  const res = await page.request.post('/api/v1/orgs/acme/projects', {
    data: { name: 'Sneaky' },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.status()).toBe(403);
  expect(await res.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
});
