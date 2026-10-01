import React from 'react';
import { AppHeader } from '../components/AppHeader';
import './globals.css';

export const metadata = {
  title: 'Voicings — Jazz Piano Library',
  description:
    'Find jazz piano voicings for any chord in any key, see their guide tones, and voice-lead them through a ii–V–I.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <AppHeader />
        <main id="main-content">{children}</main>
        <footer className="app-footer">
          <span>Voicings</span>
          <span>Find. Listen. Make it yours.</span>
        </footer>
      </body>
    </html>
  );
}
