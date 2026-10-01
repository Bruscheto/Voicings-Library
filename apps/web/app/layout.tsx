import React from 'react';
import Link from 'next/link';
import './globals.css';

export const metadata = {
  title: 'Voicings — Jazz Piano Library',
  description:
    'Find jazz piano voicings for any chord in any key, see their guide tones, and voice-lead them through a ii–V–I.',
};

const NAV = [
  { href: '/', label: 'Find' },
  { href: '/paths', label: 'ii–V–I' },
  { href: '/voicings', label: 'Library' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Voicings
            </Link>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
