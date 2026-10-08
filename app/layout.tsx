import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'TeamDesk', template: '%s · TeamDesk' },
  description: 'Projects and client requests, organised per workspace.',
};

export const viewport: Viewport = { themeColor: '#18181b' };

/**
 * Reading request headers opts every page into dynamic rendering, which the
 * per-request CSP nonce requires (Next injects it into its own script tags).
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
