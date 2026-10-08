import { expect, type Page } from '@playwright/test';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

interface MailpitSummary {
  ID: string;
  Subject: string;
}

/** Polls Mailpit for the newest message to `to` whose subject matches, and returns its first link. */
export async function linkFromEmail(to: string, subject: RegExp): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
        );
        const { messages } = (await res.json()) as { messages: MailpitSummary[] };
        const match = messages.find((m) => subject.test(m.Subject));
        if (!match) return undefined;
        const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${match.ID}`)).json()) as {
          Text: string;
        };
        link = /(https?:\/\/\S+)/.exec(msg.Text)?.[1];
        return link;
      },
      { timeout: 15_000, message: `email "${subject.source}" to ${to}` },
    )
    .toBeTruthy();
  return link!;
}

export const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;

export async function signUp(
  page: Page,
  opts: { name: string; email: string; password: string; orgName: string },
) {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill(opts.name);
  await page.getByLabel('Work email').fill(opts.email);
  await page.getByLabel('Password').fill(opts.password);
  await page.getByLabel('Workspace name').fill(opts.orgName);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

  const verifyLink = await linkFromEmail(opts.email, /Verify your TeamDesk email/);
  await page.goto(verifyLink);
  await page.getByRole('button', { name: 'Confirm my email' }).click();
  await expect(page).toHaveURL(/\/login\?verified=1/);
}

/** Submits the login form without waiting for the outcome (use for negative cases). */
export async function attemptLogIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

/** Logs in and waits until the app has navigated away from /login. */
export async function logIn(page: Page, email: string, password: string) {
  await attemptLogIn(page, email, password);
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
