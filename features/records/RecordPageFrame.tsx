import type { ReactNode } from 'react';
import Link from 'next/link';

type RecordPageFrameProps = {
  introduction?: string;
  category: string;
  title: string;
  status: string;
  date: string;
  area?: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
};

export default function RecordPageFrame({
  introduction,
  category,
  title,
  status,
  date,
  area,
  backHref,
  backLabel,
  children,
}: RecordPageFrameProps) {
  return (
    <div className="record-page">
      <header className="record-page-navbar">
        <Link href="/" className="record-page-brand">
          <span className="record-page-logo">
            yc<span>.</span>
          </span>
          <span>Your City Council</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/?view=Decisions">Decisions</Link>
        </nav>
      </header>

      <main className="record-page-main">
        <div className="record-page-breadcrumb">
          <Link href={backHref}>← {backLabel}</Link>
          <span aria-hidden="true">/</span>
          <span>{category}</span>
        </div>
        <div className="record-page-heading">
          <div className="record-page-tags">
            <span className="topic">{category}</span>
            <span className="status">{status}</span>
          </div>
          <h1>{title}</h1>
          <p>{[date, area].filter(Boolean).join(' · ')}</p>
        </div>

        {introduction && (
          <section className="record-introduction" aria-labelledby="brief-introduction">
            <div className="record-eyebrow">IN PLAIN ENGLISH</div>
            <h2 id="brief-introduction">Brief introduction</h2>
            <p>{introduction}</p>
          </section>
        )}

        <div className="record-page-columns">
          <article className="record-page-body modal">{children}</article>
          <aside className="record-page-aside" aria-label="Reading guide">
            <div className="record-page-guide">
              <div className="record-page-guide-label">READING THIS RECORD</div>
              <h2>Evidence first.</h2>
              <p>
                Look for what the source actually confirms, what it might mean, and what still needs
                to be checked.
              </p>
              <div className="record-page-guide-divider" />
              <p>
                A Council decision, building permit and construction start are different events. A
                missing record is not proof of a delay.
              </p>
              <Link href={backHref} className="record-page-back">
                ← {backLabel}
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <footer className="record-page-footer">
        <span>Your City Council · Independent civic prototype</span>
        <span>Not affiliated with the City of Toronto.</span>
      </footer>
    </div>
  );
}
