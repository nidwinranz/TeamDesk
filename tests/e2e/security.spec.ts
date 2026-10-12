import { expect, test } from '@playwright/test';
import { logIn } from './helpers';

test('pages send a nonce-based CSP and security headers, and hydrate without CSP violations', async ({
  page,
}) => {
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(m.text());
  });

  const res = await page.goto('/login');
  const headers = res!.headers();
  expect(headers['content-security-policy']).toMatch(
    /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/,
  );
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['strict-transport-security']).toContain('max-age=63072000');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-powered-by']).toBeUndefined();

  // Nonces are per request.
  const again = await page.request.get('/login');
  expect(again.headers()['content-security-policy']).not.toBe(headers['content-security-policy']);

  // Client-side behaviour works (hydrated) under the CSP.
  await logIn(page, 'owner@acme.test', 'teamdesk-dev-123');
  await page.getByRole('button', { name: /Switch workspace/ }).click();
  await expect(page.getByRole('menuitem', { name: /Globex|New workspace/ }).first()).toBeVisible();
  expect(violations).toEqual([]);
});

test('API rejects cross-origin writes and reports health', async ({ request }) => {
  const res = await request.post('/api/v1/orgs/acme/projects', {
    data: { name: 'x' },
    headers: { origin: 'https://evil.example' },
  });
  expect([401, 403]).toContain(res.status());
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({
    status: 'ok',
    checks: { database: { ok: true }, redis: { ok: true } },
  });
});
