'use client';
import { useLanguage } from '@/features/language/LanguageProvider';
import Link from 'next/link';
import LanguageSwitcher from '@/features/language/LanguageSwitcher';
import { useRef } from 'react';
import type { View } from './types';
export default function Shell({
  view,
  saved,
  go,
  children,
}: {
  view: View | 'Agendas' | 'Voting';
  saved: number;
  go: (v: View) => void;
  children: React.ReactNode;
}) {
  const { t, intlLocale } = useLanguage();
  const nav: [View, string, string][] = [
    ['Home', '⌂', 'Home'],
    ['Map', '⌖', 'Map'],
    ['Participate', '◎', 'Participate'],
    ['Saved', '♡', 'Saved'],
  ];
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const mobileToggle = useRef<HTMLElement>(null);

  function closeMobileMenu() {
    if (!mobileMenu.current?.open) return;
    mobileMenu.current.open = false;
    mobileToggle.current?.focus();
  }

  const navigation = (
    <nav aria-label={t('Main navigation')}>
      {nav.map(([key, icon, label]) => (
        <button
          key={key}
          className={`nav ${view === key ? 'active' : ''}`}
          aria-current={view === key ? 'page' : undefined}
          onClick={() => {
            closeMobileMenu();
            go(key);
          }}
        >
          <span aria-hidden="true">{icon}</span>
          {t(label)}
          {key === 'Saved' && <b className="saved-number">{saved}</b>}
        </button>
      ))}
      <Link
        href="/agendas"
        className={`nav ${view === 'Agendas' ? 'active' : ''}`}
        aria-current={view === 'Agendas' ? 'page' : undefined}
        onClick={closeMobileMenu}
      >
        <span aria-hidden="true">▦</span>
        {t('Upcoming agendas')}
      </Link>
      <Link
        href="/voting"
        className={`nav ${view === 'Voting' ? 'active' : ''}`}
        aria-current={view === 'Voting' ? 'page' : undefined}
        onClick={closeMobileMenu}
      >
        <span aria-hidden="true">✓</span>
        {t('Voting')}
      </Link>
    </nav>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="mark">
          {t('yc')}
          <span>.</span>
        </div>
        <div className="brand-title">
          {t('Your City')}
          <br />
          {t('Council')}
        </div>
        <div className="locale">{t('◉ Toronto, Ontario')}</div>
        <div className="nav-label">{t('Explore your city')}</div>
        {navigation}
        <div className="sidebar-foot">
          {t('INDEPENDENT CIVIC PROTOTYPE')}
          <br />
          {t('Not affiliated with the City of Toronto.')}
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <span>
            {t('YOUR CITY COUNCIL ')}
            <i>/</i>
            {t(' TORONTO')}
          </span>
          <LanguageSwitcher />
          <span className="top-right">
            {t('THE TORONTO EDITION ')}
            <span className="dot" />
          </span>
        </header>
        <header className="mobile-topbar">
          <Link href="/" className="mobile-brand">
            {t('Your City Council')}
          </Link>
          <LanguageSwitcher />
          <details
            className="mobile-menu"
            ref={mobileMenu}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeMobileMenu();
            }}
          >
            <summary ref={mobileToggle}>
              <span aria-hidden="true">☰</span>
              {t(' Menu')}
            </summary>
            {navigation}
          </details>
        </header>
        <main>{children}</main>
        <footer className="footer">
          {t('Your City Council · Independent civic information prototype')}{' '}
          <span>{t('Made for clearer local democracy.')}</span>
        </footer>
      </div>
    </div>
  );
}
