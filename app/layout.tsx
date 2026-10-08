import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'TeamDesk', template: '%s · TeamDesk' },
  description: 'Projects and client requests, organised per workspace.',
};

export const viewport: Viewport = { themeColor: '#18181b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
