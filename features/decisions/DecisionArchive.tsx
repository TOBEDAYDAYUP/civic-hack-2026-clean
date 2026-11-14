'use client';
import { useLanguage } from '@/features/language/LanguageProvider';

import { useMemo, useState } from 'react';
import { decisions } from '@/data/decisions';
import DecisionList from './DecisionList';
import TopicFilters from './TopicFilters';

export default function DecisionArchive({
  savedOnly = false,
  saved,
  toggleSaved,
}: {
  savedOnly?: boolean;
  saved: number[];
  toggleSaved: (id: number) => void;
}) {
  const { t } = useLanguage();
  const [topic, setTopic] = useState('All topics');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const visible = useMemo(
    () =>
      decisions
        .filter(
          (d) =>
            (!savedOnly || saved.includes(d.id)) &&
            (topic === 'All topics' || d.topic === topic) &&
            [d.title, d.summary, d.area, d.topic]
              .join(' ')
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'oldest'
            ? a.sortDate.localeCompare(b.sortDate)
            : b.sortDate.localeCompare(a.sortDate),
        ),
    [savedOnly, saved, topic, query, sort],
  );

  return (
    <section aria-label={t('Static decision archive')}>
      <section className="hero civic-banner">
        <div className="eyebrow">{t('STATIC CURATED ARCHIVE')}</div>
        <h1>{t(savedOnly ? 'Your saved decisions.' : 'Explore municipal decisions.')}</h1>
        <p className="lead">
          {t(
            'These 14 static curated summaries do not update with the live public-notice feed. Verify status, dates and outcomes against the original Council records.',
          )}
        </p>
      </section>
      <TopicFilters topic={topic} setTopic={setTopic} />
      <section className="toolbox">
        <label className="search">
          <span>⌕</span>
          <input
            aria-label={t('Search decisions')}
            placeholder={t('Search decisions')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label={t('Sort decisions')}
          value={sort}
          onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}
        >
          <option value="newest">{t('Newest first')}</option>
          <option value="oldest">{t('Oldest first')}</option>
        </select>
      </section>
      <div className="list-head">
        <span className="count">
          {visible.length} {t(savedOnly ? 'SAVED' : 'CURATED')}
          {t(' RECORDS')}
        </span>
      </div>
      <DecisionList visible={visible} saved={saved} toggleSaved={toggleSaved} />
    </section>
  );
}
