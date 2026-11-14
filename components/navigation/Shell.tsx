import Link from 'next/link';
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
        <nav>
          {nav.map(([k, i, l]) => (
            <button key={k} className={`nav ${view === k ? 'active' : ''}`} onClick={() => go(k)}>
              <span>{i}</span>
              {l}
              {k === 'Saved' && <b className="saved-number">{saved}</b>}
            </button>
          ))}
          <Link
            href="/agendas"
            className={`nav ${view === 'Agendas' ? 'active' : ''}`}
            aria-current={view === 'Agendas' ? 'page' : undefined}
          >
            <span aria-hidden="true">▦</span>Upcoming agendas
          </Link>
          <Link
            href="/voting"
            className={`nav ${view === 'Voting' ? 'active' : ''}`}
            aria-current={view === 'Voting' ? 'page' : undefined}
          >
            <span aria-hidden="true">✓</span>Voting
          </Link>
        </nav>
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
        <main>{children}</main>
        <footer className="footer">
          Your City Council · Independent civic information prototype{' '}
          <span>Made for clearer local democracy.</span>
        </footer>
      </div>
    </div>
  );
}
