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
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(''),
    [syncWarning, setSyncWarning] = useState('');
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
      setError('');
      if (page > 1 && page > Math.max(1, Math.ceil(data.total / 12))) setPage(1);
      const status = await fetch('/api/sync/status', {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      })
        .then((r) => r.json())
        .catch(() => null);
      if (current === generation.current && status?.ok) {
        setSynced(status.last_success_at || '');
        setSyncWarning(
          status.last_error ? 'Latest source sync failed; showing last successful data.' : '',
        );
      }
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : 'Refresh failed');
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
  const connection = useNoticeUpdates(() => void refresh());
  return (
    <section className="live-panel" aria-label="Shared Toronto notices">
      <div className="live-panel-head">
        <div>
          <div className="eyebrow">SHARED OFFICIAL NOTICES</div>
          <h2>Latest Toronto public notices.</h2>
          <p>
            Official records are shared across the team. Available AI explanations are marked
            separately.
          </p>
        </div>
        <button className="primary" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh notices'}
        </button>
      </div>
      <div className="live-status" aria-live="polite">
        <span>
          {total} records · {connection}
        </span>
        <span>
          {synced
            ? `Source checked: ${new Date(synced).toLocaleString()}`
            : 'Waiting for sync status'}
        </span>
      </div>
      {error && <p role="alert">{error}</p>}
      {syncWarning && <p role="status">{syncWarning}</p>}
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
      <div className="live-grid">
        {items.map((n) => (
          <article className="live-card" key={n.id}>
            <span className="topic">{n.topics?.[0] || 'Public notice'}</span>
            <h3>
              <Link href={`/notices/${encodeURIComponent(n.id)}`}>
                {n.aiReady ? n.simple?.plainTitle || n.title : n.title}
              </Link>
            </h3>
            <p>{(n.aiReady ? n.simple?.whatIsHappening : n.description)?.slice(0, 260)}</p>
            <div className="live-card-meta">
              {n.noticeDate?.slice(0, 10) || 'Date not specified'} ·{' '}
              {n.aiReady ? 'AI explanation available' : 'Official source'}
            </div>
            <Link href={`/notices/${encodeURIComponent(n.id)}`}>Read full notice →</Link>
          </article>
        ))}
      </div>
      {!items.length && !loading && !error && <p>No notices match this search.</p>}
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
