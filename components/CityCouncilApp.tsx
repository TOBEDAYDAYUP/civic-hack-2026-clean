'use client';
import { useLanguage } from '@/features/language/LanguageProvider';

import { useEffect, useState } from 'react';
import type { View } from '@/components/navigation/types';
import Shell from '@/components/navigation/Shell';
import MapView from '@/features/map/MapView';
import ParticipationView from '@/features/participation/ParticipationView';
import { decisions } from '@/data/decisions';
import DecisionArchive from '@/features/decisions/DecisionArchive';
import NoticeFeed from '@/features/notices/NoticeFeed';

const SAVED_STORAGE_KEY = 'yc-saved-notices';

export default function CityCouncilApp() {
  const { t } = useLanguage();
  const [view, setView] = useState<View>('Home');
  const [saved, setSaved] = useState<string[]>([]);
  const [savedDecisions, setSavedDecisions] = useState<number[]>([]);
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
    try {
      const value: unknown = JSON.parse(localStorage.getItem('yc-saved') || '[]');
      if (Array.isArray(value))
        setSavedDecisions([
          ...new Set(
            value.filter(
              (id): id is number => Number.isInteger(id) && decisions.some((d) => d.id === id),
            ),
          ),
        ]);
    } catch {}
    setSavedLoaded(true);
    const updateView = () => {
      const requested = new URLSearchParams(window.location.search).get('view');
      setView(
        requested === 'Decisions' ||
          requested === 'Map' ||
          requested === 'Participate' ||
          requested === 'Saved'
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
      localStorage.setItem('yc-saved', JSON.stringify(savedDecisions));
    } catch {
      // Browsing and navigation still work in restricted browser storage modes.
    }
  }, [saved, savedDecisions, savedLoaded]);

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

  function toggleDecision(id: number) {
    setSavedDecisions((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <Shell view={view} saved={saved.length + savedDecisions.length} go={go}>
      {view === 'Decisions' ? (
        <DecisionArchive saved={savedDecisions} toggleSaved={toggleDecision} />
      ) : view === 'Map' ? (
        <MapView />
      ) : view === 'Participate' ? (
        <ParticipationView />
      ) : (
        <>
          <section className="hero">
            <div className="eyebrow">
              {t(view === 'Saved' ? 'YOUR BOOKMARKS' : 'THE TORONTO EDITION')}
            </div>
            <h1>
              {view === 'Saved' ? (
                'Your saved notices.'
              ) : (
                <>
                  {t('Your city. ')}
                  <em>{t('In the open.')}</em>
                </>
              )}
            </h1>
            <p className="lead">
              {t(
                view === 'Saved'
                  ? 'Return to public notices you bookmarked. These are stored only in this browser.'
                  : 'Find Toronto public notices, understand what is happening, and check the official source.',
              )}
            </p>
          </section>
          <NoticeFeed savedOnly={view === 'Saved'} savedIds={saved} onToggleSaved={toggleSaved} />
          {view === 'Saved' && (
            <DecisionArchive savedOnly saved={savedDecisions} toggleSaved={toggleDecision} />
          )}
        </>
      )}
    </Shell>
  );
}
