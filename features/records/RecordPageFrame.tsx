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
          <div className="record-introduction">
            <p>{introduction}</p>
          </div>
        )}

        <div className="record-page-columns">
          <article className="record-page-body modal">{children}</article>
        </div>
      </main>

      <footer className="record-page-footer">
        <span>Your City Council · Toronto</span>
        <span>Not affiliated with the City of Toronto.</span>
      </footer>
    </div>
  );
}
