import Link from 'next/link';
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
    <nav aria-label="Main navigation">
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
          {label}
          {key === 'Saved' && <b className="saved-number">{saved}</b>}
        </button>
      ))}
      <Link
        href="/agendas"
        className={`nav ${view === 'Agendas' ? 'active' : ''}`}
        aria-current={view === 'Agendas' ? 'page' : undefined}
        onClick={closeMobileMenu}
      >
        <span aria-hidden="true">▦</span>Upcoming agendas
      </Link>
      <Link
        href="/voting"
        className={`nav ${view === 'Voting' ? 'active' : ''}`}
        aria-current={view === 'Voting' ? 'page' : undefined}
        onClick={closeMobileMenu}
      >
        <span aria-hidden="true">✓</span>Voting
      </Link>
    </nav>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="mark">
          yc<span>.</span>
        </div>
        <div className="brand-title">
          Your City
          <br />
          Council
        </div>
        <div className="locale">◉ Toronto, Ontario</div>
        <div className="nav-label">Explore your city</div>
        {navigation}
        <div className="sidebar-foot">
          INDEPENDENT CIVIC PROTOTYPE
          <br />
          Not affiliated with the City of Toronto.
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <span>
            YOUR CITY COUNCIL <i>/</i> TORONTO
          </span>
          <span className="top-right">
            THE TORONTO EDITION <span className="dot" />
          </span>
        </header>
        <header className="mobile-topbar">
          <Link href="/" className="mobile-brand">
            Your City Council
          </Link>
          <details
            className="mobile-menu"
            ref={mobileMenu}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeMobileMenu();
            }}
          >
            <summary ref={mobileToggle}>
              <span aria-hidden="true">☰</span> Menu
            </summary>
            {navigation}
          </details>
        </header>
        <main>{children}</main>
        <footer className="footer">
          Your City Council · Independent civic information prototype{' '}
          <span>Made for clearer local democracy.</span>
        </footer>
      </div>
    </div>
  );
}
