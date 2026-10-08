import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RoleSwitcher } from '@/components/RoleSwitcher';

export const metadata: Metadata = {
  title: 'CabHub - Premier Ride-Hailing Platform',
  description: 'Book rides, track nearby drivers live, and travel seamlessly across the city.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚕</text></svg>" />
      </head>
      <body className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-black">
        <RoleSwitcher />
        <main className="flex-1 flex flex-col relative">{children}</main>
      </body>
    </html>
  );
}
