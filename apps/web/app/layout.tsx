import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Voicings — Jazz Piano Library',
  description:
    'A curated library of jazz piano voicings. Search by chord, view on staff, play back with real piano samples.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
