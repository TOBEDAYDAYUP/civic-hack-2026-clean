'use client';
import { useLanguage } from '@/features/language/LanguageProvider';

import Link from 'next/link';
import { SourceLanguageNote } from '@/features/language/LanguageProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicNotice } from '@/lib/public-notices';
import { NOTICE_CATEGORIES, categoryLabel, noticeCategory } from '@/lib/notice-browser.mjs';
import { useNoticeUpdates } from './useNoticeUpdates';

type Item = PublicNotice & { aiReady: boolean };
type Props = {
  savedOnly: boolean;
  savedIds: string[];
  onToggleSaved: (id: string) => void;
};
const PAGE_SIZE = 12;

export default function NoticeFeed({ savedOnly, savedIds, onToggleSaved }: Props) {
  const { t } = useLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [category, setCategory] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jumpPage, setJumpPage] = useState('1');
  const savedLookup = savedIds.join(',');
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setJumpPage(String(page));
  }, [page]);
  // Home and Saved are two views of the same feed, not the same search session.
  useEffect(() => {
    setPage(1);
    setInput('');
    setQuery('');
    setSort('newest');
    setCategory('all');
  }, [savedOnly]);
  useEffect(() => {
    if (savedOnly) setPage(1);
  }, [savedOnly, savedLookup]);

  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (savedOnly && !savedLookup) {
      setItems([]);
      setTotal(0);
      setUnavailable(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        q: query,
        sort,
        category,
      });
      if (savedOnly) {
        params.set('savedOnly', '1');
        params.set('ids', savedLookup);
      }
      const res = await fetch(`/api/notices?${params}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw new Error('Could not refresh shared notices. Previously loaded records are kept.');
      if (current !== generation.current) return;
      setItems(data.items);
      setTotal(data.total);
      setUnavailable(false);
      if (page > 1 && page > Math.max(1, Math.ceil(data.total / PAGE_SIZE))) setPage(1);
    } catch {
      if (current === generation.current) setUnavailable(true);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [page, query, sort, category, savedOnly, savedLookup]);

  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  useNoticeUpdates(() => void refresh());

  function changeSort(next: 'newest' | 'oldest') {
    setPage(1);
    setSort(next);
  }
  function changeCategory(next: string) {
    setPage(1);
    setCategory(next);
  }

  return (
    <section
      className="notice-feed"
      aria-label={t(savedOnly ? 'Saved Toronto notices' : 'Shared Toronto notices')}
    >
      <div className="live-panel-head">
        <div>
          <div className="eyebrow">
            {t(savedOnly ? 'YOUR BOOKMARKED NOTICES' : 'SHARED OFFICIAL NOTICES')}
          </div>
          <h2>{t(savedOnly ? 'Saved public notices.' : 'Explore Toronto decisions.')}</h2>
          <p>
            {t(
              'Search City of Toronto notices, read explanations and check original sources. Public notices are not necessarily final Council decisions.',
            )}
          </p>
        </div>
      </div>

      <form
        className="notice-search-row"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(input.trim());
        }}
      >
        <label className="notice-search-box">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label={t('Search public notices')}
            placeholder={t('Search public notices, streets, or topics...')}
            value={input}
            maxLength={100}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button className="notice-search-submit" type="submit">
          {t('Search')}
        </button>
        <button
          className={`notice-filter-toggle ${filtersOpen ? 'is-open' : ''}`}
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="notice-filter-options"
          onClick={() => setFiltersOpen((shown) => !shown)}
        >
          <span aria-hidden="true">☷</span>
          {t(' Filters')}
        </button>
      </form>
      {filtersOpen && (
        <div id="notice-filter-options" className="notice-filter-options">
          <label>
            <span>{t('SORT BY')}</span>
            <select
              aria-label={t('Sort notices by date')}
              value={sort}
              onChange={(e) => changeSort(e.target.value as 'newest' | 'oldest')}
            >
              <option value="newest">{t('Newest first')}</option>
              <option value="oldest">{t('Oldest first')}</option>
            </select>
          </label>
          <label>
            <span>{t('CATEGORY')}</span>
            <select
              aria-label={t('Filter notice category')}
              value={category}
              onChange={(e) => changeCategory(e.target.value)}
            >
              {NOTICE_CATEGORIES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {t(choice.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <SourceLanguageNote />
      <div className="notice-results-heading" aria-live="polite">
        <h3>{t(savedOnly ? 'Saved municipal notices' : 'Municipal notices')}</h3>
        <span>
          {loading
            ? t('Updating results…')
            : t(total === 1 ? '{count} matching notice' : '{count} matching notices', {
                count: total,
              })}
        </span>
      </div>
      {unavailable && (
        <p role="alert" className="notice-feed-error">
          {t('Could not refresh notices. Previously loaded records are still shown.')}
        </p>
      )}
      <div className="notice-feed-grid">
        {items.map((n) => {
          const marked = savedIds.includes(n.id);
          return (
            <article className="notice-feed-card" key={n.id}>
              <span className="notice-category">{t(categoryLabel(noticeCategory(n)))}</span>
              <h3 lang="en">
                <Link href={`/notices/${encodeURIComponent(n.id)}`}>
                  {n.displayTitle || (n.aiReady ? n.simple?.plainTitle || n.title : n.title)}
                </Link>
              </h3>
              <p lang="en">
                {(n.aiReady ? n.simple?.whatIsHappening : n.description)?.slice(0, 260)}
              </p>
              <div className="notice-feed-meta">
                {n.noticeDate?.slice(0, 10) || t('Date not specified')} ·{' '}
                {t(n.aiReady ? 'AI explanation available' : 'Official source')}
              </div>
              <div className="notice-card-actions">
                <Link className="notice-read-link" href={`/notices/${encodeURIComponent(n.id)}`}>
                  {t('Read full notice →')}
                </Link>
                <button
                  type="button"
                  aria-pressed={marked}
                  aria-label={`${t(marked ? 'Remove saved notice' : 'Save notice')}: ${n.title}`}
                  onClick={() => onToggleSaved(n.id)}
                >
                  {t(marked ? '♥ Saved' : '♡ Save')}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!items.length && loading && <p>{t('Loading notices…')}</p>}
      {!items.length && !loading && !unavailable && (
        <p>
          {t(
            savedOnly && savedIds.length === 0
              ? 'You have not saved any notices yet. Return to Home to bookmark one.'
              : 'No notices match your search and filters.',
          )}
        </p>
      )}
      <div className="notice-pagination">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1}>
          {t('Previous')}
        </button>
        <span>{t('Page {page} of {total}', { page, total: maxPage })}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={loading || page * PAGE_SIZE >= total}
        >
          {t('Next')}
        </button>
        <form
          className="notice-page-jump"
          onSubmit={(e) => {
            e.preventDefault();
            const requested = Number(jumpPage);
            if (!loading && Number.isInteger(requested) && requested >= 1 && requested <= maxPage)
              setPage(requested);
          }}
        >
          <label>
            {t('Go to page')}{' '}
            <input
              aria-label={t('Go to page')}
              type="number"
              min="1"
              max={maxPage}
              step="1"
              required
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              disabled={loading || !total}
            />
          </label>
          <button type="submit" disabled={loading || !total}>
            {t('Go')}
          </button>
        </form>
      </div>
    </section>
  );
}
