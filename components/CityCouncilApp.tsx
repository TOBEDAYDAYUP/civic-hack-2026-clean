'use client';

import { useEffect, useState } from 'react';
import type { View } from '@/components/navigation/types';
import Shell from '@/components/navigation/Shell';
import MapView from '@/features/map/MapView';
import ParticipationView from '@/features/participation/ParticipationView';
import NoticeFeed from '@/features/notices/NoticeFeed';

const SAVED_STORAGE_KEY = 'yc-saved-notices';

export default function CityCouncilApp() {
  const [view, setView] = useState<View>('Home');
  const [saved, setSaved] = useState<string[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(SAVED_STORAGE_KEY) || '[]');
      if (Array.isArray(stored)) {
        setSaved(
          [
            ...new Set(
              stored.filter(
                (id): id is string => typeof id === 'string' && /^[\w-]{1,128}$/.test(id),
              ),
            ),
          ].slice(0, 200),
        );
      }
    } catch {
      // A damaged local bookmark store must not prevent browsing.
    }
    setSavedLoaded(true);
    const updateView = () => {
      const requested = new URLSearchParams(window.location.search).get('view');
      // Old Decisions URLs now open the single Home feed instead.
      if (requested === 'Decisions') window.history.replaceState(null, '', '/');
      setView(
        requested === 'Map' || requested === 'Participate' || requested === 'Saved'
          ? requested
          : 'Home',
      );
    };
    updateView();
    window.addEventListener('popstate', updateView);
    return () => window.removeEventListener('popstate', updateView);
  }, []);

  useEffect(() => {
    if (!savedLoaded) return;
    try {
      localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Browsing and navigation still work in restricted browser storage modes.
    }
  }, [saved, savedLoaded]);

  function go(next: View) {
    setView(next);
    window.history.pushState(null, '', next === 'Home' ? '/' : `/?view=${next}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleSaved(id: string) {
    setSaved((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id].slice(-200),
    );
  }

  return (
    <Shell view={view} saved={saved.length} go={go}>
      {view === 'Map' ? (
        <MapView />
      ) : view === 'Participate' ? (
        <ParticipationView />
      ) : (
        <>
          <section className="hero">
            <div className="eyebrow">
              {view === 'Saved' ? 'YOUR BOOKMARKS' : 'THE TORONTO EDITION'}
            </div>
            <h1>
              {view === 'Saved' ? (
                'Your saved notices.'
              ) : (
                <>
                  Your city. <em>In the open.</em>
                </>
              )}
            </h1>
            <p className="lead">
              {view === 'Saved'
                ? 'Return to public notices you bookmarked. These are stored only in this browser.'
                : 'Find Toronto public notices, understand what is happening, and check the official source.'}
            </p>
          </section>
          <NoticeFeed savedOnly={view === 'Saved'} savedIds={saved} onToggleSaved={toggleSaved} />
        </>
      )}
    </Shell>
  );
}
