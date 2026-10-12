import type { EmailMessage } from './mailer';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout(heading: string, body: string, cta: { label: string; url: string }): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f6f7f9;padding:24px">
<div style="max-width:480px;margin:auto;background:#fff;border-radius:8px;padding:24px">
<h1 style="font-size:18px;margin:0 0 12px">${escape(heading)}</h1>
<p style="color:#333;line-height:1.5">${body}</p>
<p><a href="${escape(cta.url)}" style="display:inline-block;background:#111827;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escape(cta.label)}</a></p>
<p style="color:#888;font-size:12px">If the button does not work, paste this link into your browser:<br>${escape(cta.url)}</p>
</div></body></html>`;
}

export function verifyEmailTemplate(to: string, url: string): EmailMessage {
  return {
    to,
    subject: 'Verify your TeamDesk email',
    text: `Confirm your email address: ${url}\n\nThe link expires in 24 hours.`,
    html: layout(
      'Confirm your email',
      'Click below to verify your email address. The link expires in 24 hours.',
      {
        label: 'Verify email',
        url,
      },
    ),
  };
}

export function resetPasswordTemplate(to: string, url: string): EmailMessage {
  return {
    to,
    subject: 'Reset your TeamDesk password',
    text: `Reset your password: ${url}\n\nThe link expires in 1 hour. If you did not ask for this, ignore this email.`,
    html: layout(
      'Reset your password',
      'Click below to choose a new password. The link expires in 1 hour. If you did not request this, you can ignore this email.',
      { label: 'Reset password', url },
    ),
  };
}

export function inviteTemplate(
  to: string,
  orgName: string,
  inviter: string,
  role: string,
  url: string,
): EmailMessage {
  return {
    to,
    subject: `You're invited to ${orgName} on TeamDesk`,
    text: `${inviter} invited you to join ${orgName} as ${role}: ${url}\n\nThe invite expires in 7 days.`,
    html: layout(
      `Join ${orgName}`,
      `${escape(inviter)} invited you to join <strong>${escape(orgName)}</strong> as ${escape(role)}. The invite expires in 7 days.`,
      { label: 'Accept invite', url },
    ),
  };
}
