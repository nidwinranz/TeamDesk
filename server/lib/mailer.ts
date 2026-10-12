import 'server-only';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { env } from './env';
import { logger } from './logger';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

class ResendMailer implements Mailer {
  private readonly client: Resend;
  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }
  async send(m: EmailMessage) {
    const { error } = await this.client.emails.send({ from: env.EMAIL_FROM, ...m });
    if (error) throw new Error(`Resend: ${error.message}`);
  }
}

class SmtpMailer implements Mailer {
  private readonly transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
  });
  async send(m: EmailMessage) {
    await this.transport.sendMail({ from: env.EMAIL_FROM, ...m });
  }
}

/** Captures messages in memory; used by unit and integration tests. */
export class MemoryMailer implements Mailer {
  readonly sent: EmailMessage[] = [];
  send(m: EmailMessage) {
    this.sent.push(m);
    return Promise.resolve();
  }
  last(): EmailMessage | undefined {
    return this.sent.at(-1);
  }
  clear() {
    this.sent.length = 0;
  }
}

function createMailer(): Mailer {
  if (env.NODE_ENV === 'test') return new MemoryMailer();
  if (env.RESEND_API_KEY) return new ResendMailer(env.RESEND_API_KEY);
  return new SmtpMailer();
}

let current: Mailer = createMailer();

export function getMailer(): Mailer {
  return current;
}

/** Test seam: swap the transport. */
export function setMailer(mailer: Mailer) {
  current = mailer;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    await current.send(message);
    logger.info({ to: message.to, subject: message.subject }, 'email sent');
  } catch (err) {
    logger.error({ err, subject: message.subject }, 'email send failed');
    throw err;
  }
}
