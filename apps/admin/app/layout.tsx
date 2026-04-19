import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Voicings Admin',
  description: 'Capture and manage voicings',
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
