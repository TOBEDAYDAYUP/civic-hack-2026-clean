'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicNotice } from '@/lib/public-notices';
import { useNoticeUpdates } from './useNoticeUpdates';
type Item = PublicNotice & { aiReady: boolean };
export default function NoticeFeed() {
  const [items, setItems] = useState<Item[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const [input, setInput] = useState(''),
    [query, setQuery] = useState(''),
    [unavailable, setUnavailable] = useState(false),
    [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notices?${new URLSearchParams({ page: String(page), limit: '12', q: query })}`,
        { cache: 'no-store', signal: AbortSignal.timeout(15000) },
      );
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw new Error('Could not refresh shared notices. Previously loaded records are kept.');
      if (current !== generation.current) return;
      setItems(data.items);
      setTotal(data.total);
      setUnavailable(false);
      if (page > 1 && page > Math.max(1, Math.ceil(data.total / 12))) setPage(1);
    } catch {
      // Keep already displayed records when a background refresh cannot complete.
      if (current === generation.current) setUnavailable(true);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [page, query]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  useNoticeUpdates(() => void refresh());
  return (
    <section className="notice-feed" aria-label="Shared Toronto notices">
      <div className="live-panel-head">
        <div>
          <div className="eyebrow">SHARED OFFICIAL NOTICES</div>
          <h2>Toronto public notices.</h2>
          <p>
            Browse public notices, read the explanation, and follow links to the original City
            records.
          </p>
        </div>
      </div>
      <div className="live-status">
        <span>{total} records</span>
      </div>
      <form
        className="toolbox"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(input.trim());
        }}
      >
        <label className="search">
          <input
            aria-label="Search public notices"
            placeholder="Search all public notices"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button className="primary" type="submit">
          Search
        </button>
      </form>
      <div className="notice-feed-grid">
        {items.map((n) => (
          <article className="notice-feed-card" key={n.id}>
            <span className="notice-category">{n.topics?.[0] || 'Public notice'}</span>
            <h3>
              <Link href={`/notices/${encodeURIComponent(n.id)}`}>
                {n.aiReady ? n.simple?.plainTitle || n.title : n.title}
              </Link>
            </h3>
            <p>{(n.aiReady ? n.simple?.whatIsHappening : n.description)?.slice(0, 260)}</p>
            <div className="notice-feed-meta">
              {n.noticeDate?.slice(0, 10) || 'Date not specified'} ·{' '}
              {n.aiReady ? 'AI explanation available' : 'Official source'}
            </div>
            <Link className="notice-read-link" href={`/notices/${encodeURIComponent(n.id)}`}>
              Read full notice →
            </Link>
          </article>
        ))}
      </div>
      {!items.length && loading && <p>Loading notices…</p>}
      {!items.length && !loading && unavailable && (
        <p>Public notices are temporarily unavailable. Please try again later.</p>
      )}
      {!items.length && !loading && !unavailable && <p>No notices match this search.</p>}
      <div className="toolbox">
        <button onClick={() => setPage((p) => p - 1)} disabled={loading || page <= 1}>
          Previous
        </button>
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / 12))}
        </span>
        <button onClick={() => setPage((p) => p + 1)} disabled={loading || page * 12 >= total}>
          Next
        </button>
      </div>
    </section>
  );
}
