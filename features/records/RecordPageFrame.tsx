'use client';
import { useLanguage } from '@/features/language/LanguageProvider';
import type { ReactNode } from 'react';
import Link from 'next/link';
import LanguageSwitcher from '@/features/language/LanguageSwitcher';
import { SourceLanguageNote } from '@/features/language/LanguageProvider';

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
  const { t } = useLanguage();
  return (
    <div className="record-page">
      <header className="record-page-navbar">
        <Link href="/" className="record-page-brand">
          <span className="record-page-logo">
            {t('yc')}
            <span>.</span>
          </span>
          <span>{t('Your City Council')}</span>
        </Link>
        <nav aria-label={t('Main navigation')}>
          <Link href="/">{t('Home')}</Link>
          <LanguageSwitcher />
        </nav>
      </header>

      <main className="record-page-main">
        <div className="record-page-breadcrumb">
          <Link href={backHref}>← {t(backLabel)}</Link>
          <span aria-hidden="true">/</span>
          <span>{t(category)}</span>
        </div>
        <div className="record-page-heading">
          <div className="record-page-tags">
            <span className="topic">{t(category)}</span>
            <span className="status">{t(status)}</span>
          </div>
          <h1 lang="en">{title}</h1>
          <p>{[date, area].filter(Boolean).join(' · ')}</p>
        </div>

        {introduction && (
          <div className="record-introduction">
            <p lang="en">{introduction}</p>
          </div>
        )}

        <SourceLanguageNote />
        <div className="record-page-columns">
          <article className="record-page-body modal">{children}</article>
          <aside className="record-page-aside" aria-label={t('Explore more')}>
            <nav className="record-page-guide" aria-label={t('Related pages')}>
              <h2>{t('Explore Toronto')}</h2>
              <Link href={backHref} className="record-page-back">
                ← {t(backLabel)}
              </Link>
              <Link href="/?view=Participate" className="record-page-back">
                {t('Have your say →')}
              </Link>
            </nav>
          </aside>
        </div>
      </main>

      <footer className="record-page-footer">
        <span>{t('Your City Council · Toronto')}</span>
        <span>{t('Not affiliated with the City of Toronto.')}</span>
      </footer>
    </div>
  );
}
