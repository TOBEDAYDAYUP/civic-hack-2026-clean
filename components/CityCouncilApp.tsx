'use client';

import { useEffect, useMemo, useState } from 'react';
import { decisions } from '@/data/decisions';

import type { View } from '@/components/navigation/types';
import Shell from '@/components/navigation/Shell';
import SecondaryTopics from '@/features/decisions/TopicFilters';
import DecisionList from '@/features/decisions/DecisionList';
import MapView from '@/features/map/MapView';
import ParticipationView from '@/features/participation/ParticipationView';
import NoticeFeed from '@/features/notices/NoticeFeed';

export default function CityCouncilApp() {
  const [view, setView] = useState<View>('Home');
  const [topic, setTopic] = useState<string>('All topics');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [saved, setSaved] = useState<number[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('yc-saved') || '[]');
      if (Array.isArray(stored))
        setSaved(stored.filter((id): id is number => Number.isInteger(id)));
    } catch {}
    setSavedLoaded(true);
    const updateView = () => {
      const requested = new URLSearchParams(window.location.search).get('view');
      if (['Home', 'Map', 'Decisions', 'Participate', 'Saved'].includes(requested || ''))
        setView(requested as View);
      else setView('Home');
    };
    updateView();
    window.addEventListener('popstate', updateView);
    return () => window.removeEventListener('popstate', updateView);
  }, []);
  useEffect(() => {
    if (!savedLoaded) return;
    try {
      localStorage.setItem('yc-saved', JSON.stringify(saved));
    } catch {}
  }, [saved, savedLoaded]);

  function go(v: View) {
    setView(v);
    window.history.pushState(null, '', v === 'Home' ? '/' : `/?view=${v}`);
    setQuery('');
    if (v !== 'Map' && v !== 'Decisions') setTopic('All topics');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const filtered = useMemo(() => {
    let x = decisions.filter(
      (d) =>
        (view !== 'Saved' || saved.includes(d.id)) && (topic === 'All topics' || d.topic === topic),
    );
    const q = query.trim().toLowerCase();
    if (q)
      x = x.filter((d) =>
        [d.title, d.summary, d.topic, d.area].join(' ').toLowerCase().includes(q),
      );
    return [...x].sort((a, b) =>
      sort === 'oldest'
        ? a.sortDate.localeCompare(b.sortDate)
        : b.sortDate.localeCompare(a.sortDate),
    );
  }, [view, saved, topic, query, sort]);

  if (view === 'Participate')
    return (
      <Shell view={view} saved={saved.length} go={go}>
        <ParticipationView />
      </Shell>
    );
  if (view === 'Map')
    return (
      <Shell view={view} saved={saved.length} go={go}>
        <MapView />
      </Shell>
    );

  const showDecisionTools = view === 'Decisions';
  const visible = view === 'Home' ? filtered.slice(0, 6) : filtered;

  return (
    <Shell view={view} saved={saved.length} go={go}>
      <section className="hero">
        <div className="eyebrow">
          {view === 'Decisions'
            ? 'DECISION LIBRARY'
            : view === 'Saved'
              ? 'YOUR FOLLOWING'
              : 'THE TORONTO EDITION'}
        </div>
        <h1>
          {view === 'Decisions' ? (
            'Explore municipal decisions.'
          ) : view === 'Saved' ? (
            'Stories you saved.'
          ) : (
            <>
              Your city. <em>In the open.</em>
            </>
          )}
        </h1>
        <p className="lead">
          {view === 'Decisions'
            ? 'Browse by topic, search the archive, and open the source-backed details.'
            : view === 'Saved'
              ? 'Keep important local decisions in one place.'
              : 'The decisions shaping your neighbourhood, made easier to understand.'}
        </p>
        {view === 'Home' && (
          <p className="disclaimer">
            Selected Toronto decisions · 2024–2026. Archive summaries are curated; live records are
            fetched from Toronto Public Notices.
          </p>
        )}
      </section>

      {(view === 'Home' || view === 'Decisions') && <NoticeFeed />}
      {view === 'Decisions' && (
        <div className="archive-intro">
          <h2>Selected Council decisions</h2>
          <p>
            The shared records above update from the database. The 14 summaries below are a curated
            archive; public notices may describe applications or meetings rather than adopted
            decisions.
          </p>
        </div>
      )}

      {showDecisionTools && (
        <>
          <SecondaryTopics topic={topic} setTopic={setTopic} />
          <section className="toolbox">
            <label className="search">
              <span>⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search decisions"
              />
            </label>
            <select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </section>
        </>
      )}

      <div className="list-head">
        <span className="count">
          {visible.length} {view === 'Saved' ? 'SAVED' : 'CURATED'} RECORDS
        </span>
        {view === 'Home' && (
          <button className="text-link" onClick={() => go('Decisions')}>
            View all decisions →
          </button>
        )}
      </div>
      <DecisionList
        visible={visible}
        saved={saved}
        toggleSaved={(id) =>
          setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
        }
      />
    </Shell>
  );
}
