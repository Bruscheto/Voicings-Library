'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/', label: 'Find' },
  { href: '/paths', label: 'ii–V–I' },
  { href: '/voicings', label: 'Library' },
];

export function AppHeader() {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const override = document.documentElement.dataset.theme;
      setDark(override ? override === 'dark' : media.matches);
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  function toggleTheme() {
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    setDark(!dark);
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="wordmark">
          Voicings
        </Link>
        <nav aria-label="Main navigation" className="main-nav">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'page' : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
        >
          {dark ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
