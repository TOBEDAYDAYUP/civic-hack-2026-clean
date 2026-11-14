'use client';
import { useLanguage } from '@/features/language/LanguageProvider';
import Link from 'next/link';
import LanguageSwitcher from '@/features/language/LanguageSwitcher';
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
  const { t } = useLanguage();
  const nav: [View, string, string][] = [
    ['Home', '⌂', 'Home'],
    ['Map', '⌖', 'Map'],
    ['Participate', '◎', 'Participate'],
    ['Saved', '♡', 'Saved'],
  ];
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
        <nav>
          {nav.map(([k, i, l]) => (
            <button key={k} className={`nav ${view === k ? 'active' : ''}`} onClick={() => go(k)}>
              <span>{i}</span>
              {t(l)}
              {k === 'Saved' && <b className="saved-number">{saved}</b>}
            </button>
          ))}
          <Link
            href="/agendas"
            className={`nav ${view === 'Agendas' ? 'active' : ''}`}
            aria-current={view === 'Agendas' ? 'page' : undefined}
          >
            <span aria-hidden="true">▦</span>
            {t('Upcoming agendas')}
          </Link>
          <Link
            href="/voting"
            className={`nav ${view === 'Voting' ? 'active' : ''}`}
            aria-current={view === 'Voting' ? 'page' : undefined}
          >
            <span aria-hidden="true">✓</span>
            {t('Voting')}
          </Link>
        </nav>
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
        <main>{children}</main>
        <footer className="footer">
          {t('Your City Council · Independent civic information prototype')}{' '}
          <span>{t('Made for clearer local democracy.')}</span>
        </footer>
      </div>
    </div>
  );
}
