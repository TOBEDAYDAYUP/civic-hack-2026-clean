'use client';
import { useLanguage } from '@/features/language/LanguageProvider';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicNotice } from '@/lib/public-notices';
import type { StreetGeocode } from '@/lib/map-geocode.mjs';
import type { Viewport } from '@/lib/map-viewport.mjs';
import { streetAddressCandidates } from '@/lib/map-geocode.mjs';
import { MAP_REGIONS, normalizeMapEntries } from '@/lib/map-regions.mjs';
import { uniqueNoticesInViewport } from '@/lib/map-viewport.mjs';
import { useNoticeUpdates } from '@/features/notices/useNoticeUpdates';
import InteractiveMap from './InteractiveMap';

type NoticeResponse = { ok: boolean; total: number; items: PublicNotice[]; error?: string };
type CachedResult = { points: StreetGeocode[]; timestamp: number; sourceKey: string };
type GeocodeResponse = { ok: boolean; points?: StreetGeocode[]; enabled?: boolean; error?: string };
const cacheKey = 'yc-street-geocodes-v1';
const cacheAge = 14 * 24 * 60 * 60 * 1000;

export default function MapView() {
  const { t } = useLanguage();
  const [notices, setNotices] = useState<PublicNotice[]>([]);
  const [region, setRegion] = useState('all');
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [focusSelection, setFocusSelection] = useState(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [revision, setRevision] = useState(0);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [listLimit, setListLimit] = useState(25);
  const [unknownOpen, setUnknownOpen] = useState(false);
  const [geocodingEnabled, setGeocodingEnabled] = useState(false);

  const [geocodingLimit, setGeocodingLimit] = useState(50);
  const [stored, setStored] = useState<Record<string, CachedResult>>({});
  const [cacheLoaded, setCacheLoaded] = useState(false);

  const inFlight = useRef(new Set<string>());
  const selectedRow = useRef<HTMLButtonElement | null>(null);
  useNoticeUpdates(() => setRevision((v) => v + 1));

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(cacheKey) || '{}') as Record<
        string,
        CachedResult
      >;
      const valid = Object.fromEntries(
        Object.entries(raw).filter(
          ([, r]) =>
            r &&
            Array.isArray(r.points) &&
            typeof r.sourceKey === 'string' &&
            Date.now() - r.timestamp < cacheAge,
        ),
      );
      setStored(valid);
    } catch {}
    setCacheLoaded(true);
    void fetch('/api/map/geocode', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        setGeocodingEnabled(j.enabled === true);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!cacheLoaded) return;
    try {
      const capped = Object.fromEntries(Object.entries(stored).slice(-500));
      localStorage.setItem(cacheKey, JSON.stringify(capped));
    } catch {}
  }, [stored, cacheLoaded]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError('');
      setProgress(t('Reading shared Toronto notices…'));
      const all: PublicNotice[] = [];
      const ids = new Set<string>();
      try {
        const response = await fetch('/api/map/notices', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Map notices are temporarily unavailable');
        const result: NoticeResponse = await response.json();
        if (!result.ok || !Array.isArray(result.items))
          throw new Error('Map notices are temporarily unavailable');
        for (const item of result.items) {
          if (item && typeof item.id === 'string' && !ids.has(item.id)) {
            all.push(item);
            ids.add(item.id);
          }
        }

        if (!controller.signal.aborted) {
          setNotices(all);
          setProgress(t('{count} official notices loaded', { count: all.length }));
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Could not load notices');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [revision]);

  const candidates = useMemo(
    () => notices.filter((n) => streetAddressCandidates(n).length > 0),
    [notices],
  );
  const outstanding = useMemo(
    () =>
      candidates.filter(
        (n) => !stored[n.id] || stored[n.id].sourceKey !== streetAddressCandidates(n).join('|'),
      ),
    [candidates, stored],
  );
  const geocodedById = useMemo(
    () =>
      Object.fromEntries(
        notices
          .filter(
            (n) => stored[n.id] && stored[n.id].sourceKey === streetAddressCandidates(n).join('|'),
          )
          .map((n) => [n.id, stored[n.id].points]),
      ),
    [notices, stored],
  );

  useEffect(() => {
    if (!cacheLoaded || !geocodingEnabled || loading || !outstanding.length) return;
    let stopped = false;
    const group = outstanding.slice(0, geocodingLimit);
    const work = async () => {
      let completed = 0;
      for (const notice of group) {
        if (stopped) break;
        if (inFlight.current.has(notice.id)) continue;
        inFlight.current.add(notice.id);
        try {
          const response = await fetch(`/api/map/geocode?id=${encodeURIComponent(notice.id)}`, {
            cache: 'no-store',
          });
          const body: GeocodeResponse = await response.json();
          if (!response.ok || !body.ok || !Array.isArray(body.points))
            throw new Error(body.error || 'Geocoder unavailable');
          if (!stopped)
            setStored((prev) => ({
              ...prev,
              [notice.id]: {
                points: body.points!,
                timestamp: Date.now(),
                sourceKey: streetAddressCandidates(notice).join('|'),
              },
            }));
        } catch (cause) {
          if (!stopped) {
            // Keep existing source pins if optional address matching is unavailable.
            break;
          }
        } finally {
          inFlight.current.delete(notice.id);
          completed++;
        }
      }
    };
    void work();
    return () => {
      stopped = true;
    };
    // Deliberately exclude outstanding/stored: geocode each bounded batch, not
    // restart requests every time one result enters the cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheLoaded, geocodingEnabled, loading, notices, geocodingLimit]);

  const { entries, unknown } = useMemo(
    () => normalizeMapEntries(notices, geocodedById),
    [notices, geocodedById],
  );
  const normalizedInput = input.trim().toLocaleLowerCase();
  const eligibleEntries = useMemo(
    () =>
      entries.filter(
        (p) =>
          (region === 'all' || p.region === region) &&
          (!normalizedInput ||
            [p.notice.title, p.notice.simple?.plainTitle, p.notice.description, p.location]
              .filter(Boolean)
              .join(' ')
              .toLocaleLowerCase()
              .includes(normalizedInput)),
      ),
    [entries, region, normalizedInput],
  );
  const inView = useMemo(
    () => uniqueNoticesInViewport(eligibleEntries, viewport),
    [eligibleEntries, viewport],
  );
  const unknownFiltered = unknown.filter(
    (n) =>
      !normalizedInput ||
      [n.title, n.description]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedInput),
  );
  const countInRegion = (id: string) =>
    new Set(entries.filter((p) => p.region === id).map((p) => p.id)).size;
  const onViewportChange = useCallback((value: Viewport) => setViewport(value), []);
  const onSelectNotice = useCallback((id: string) => {
    setSelected(id);
    setFocusSelection(false);
  }, []);
  useEffect(() => {
    setListLimit(25);
  }, [viewport?.north, viewport?.south, viewport?.east, viewport?.west, region]);
  useEffect(() => {
    if (!selected) return;
    const index = inView.findIndex((point) => point.id === selected);
    if (index >= 0 && index >= listLimit) setListLimit(Math.ceil((index + 1) / 25) * 25);
    const timer = window.setTimeout(
      () => selectedRow.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [selected, inView, listLimit]);

  const chooseArea = (id: string) => {
    setRegion(id);
    setSelected(null);
    setFocusSelection(false);
    setListLimit(25);
  };
  const selectFromList = (id: string) => {
    setSelected(id);
    setFocusSelection(true);
  };
  const shownAddressCount = new Set(
    entries.filter((p) => p.precision === 'geocoded').map((p) => p.id),
  ).size;
  return (
    <>
      <section className="page-heading map-heading civic-map-intro">
        <div className="eyebrow">{t('CITY EXPLORER · TORONTO')}</div>
        <h1>
          {t('What is happening ')}
          <em>{t('near you?')}</em>
        </h1>
        <p>
          {t(
            'Zoom in to reveal individual street-level notices. Move the map to see the list update automatically. Choose an area or search for an address to explore nearby notices.',
          )}
        </p>
      </section>
      <section className="civic-area-controls" aria-label={t('Toronto area filters')}>
        <div className="civic-area-heading">
          <strong>{t('Explore by area')}</strong>
          <span>{t('Broad geographic groupings · approximate boundaries')}</span>
        </div>
        <div className="civic-area-buttons">
          <button
            className={region === 'all' ? 'civic-area-pill active' : 'civic-area-pill'}
            onClick={() => chooseArea('all')}
            aria-pressed={region === 'all'}
          >
            {t('All Toronto ')}
            <span>{new Set(entries.map((e) => e.id)).size}</span>
          </button>
          {MAP_REGIONS.map((area) => (
            <button
              key={area.id}
              className={region === area.id ? 'civic-area-pill active' : 'civic-area-pill'}
              onClick={() => chooseArea(area.id)}
              aria-pressed={region === area.id}
            >
              {t(area.name)} <span>{countInRegion(area.id)}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="civic-map-workspace" aria-label={t('Toronto municipal notice map')}>
        <aside className="civic-map-sidebar">
          <div className="civic-map-sidehead">
            <div className="eyebrow">{t('VISIBLE ON YOUR MAP')}</div>
            <h2>
              {inView.length}
              {t(' notices in view')}
            </h2>
            <div className="civic-map-update-status" aria-live="polite">
              {loading
                ? progress
                : t('{visible} in current view · {total} in selected areas', {
                    visible: inView.length,
                    total: new Set(eligibleEntries.map((e) => e.id)).size,
                  })}
            </div>
            <button
              className="civic-map-refresh"
              onClick={() => setRevision((v) => v + 1)}
              disabled={loading}
            >
              {t(loading ? 'Loading…' : '↻ Refresh map data')}
            </button>
            {error && !notices.length && (
              <p className="civic-map-alert" role="alert">
                {t(error)}
                <br />
                {t('Previously loaded records are kept.')}
              </p>
            )}
            <label className="civic-map-search-label" htmlFor="civic-map-search">
              {t('Filter visible notices')}
            </label>
            <input
              id="civic-map-search"
              className="civic-map-search"
              placeholder={t('Search title or address')}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setListLimit(25);
              }}
            />
            {geocodingEnabled && (
              <div className="civic-map-geocode-state">
                {shownAddressCount}
                {t(' street addresses matched')}
                {outstanding.length > geocodingLimit && (
                  <button onClick={() => setGeocodingLimit((v) => v + 50)}>
                    {t('Locate more addresses +')}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="civic-map-notice-list">
            {inView.slice(0, listLimit).map((point) => (
              <button
                ref={selected === point.id ? selectedRow : null}
                className={selected === point.id ? 'civic-map-row selected' : 'civic-map-row'}
                key={point.id}
                onClick={() => selectFromList(point.id)}
              >
                <span className="civic-map-row-tag">
                  {point.regionName} ·{' '}
                  {t(
                    point.precision === 'source'
                      ? 'Source coordinates'
                      : point.precision === 'geocoded'
                        ? 'Matched street'
                        : 'Approximate area',
                  )}
                </span>
                <strong lang="en">
                  {point.notice.displayTitle ||
                    point.notice.simple?.plainTitle ||
                    point.notice.title}
                </strong>
                <small>
                  {point.notice.noticeDate?.slice(0, 10) || t('No date')} ·{' '}
                  {t(point.notice.topics?.[0] || 'Notice')}
                </small>
                <span className="civic-map-row-link">{t('Show on map →')}</span>
              </button>
            ))}
            {!inView.length && (
              <div className="civic-map-empty">
                {t(
                  loading
                    ? 'Loading notice locations…'
                    : 'No notices in the visible map area. Pan or zoom out to see more.',
                )}
              </div>
            )}
            {inView.length > listLimit && (
              <button className="civic-map-more" onClick={() => setListLimit((n) => n + 25)}>
                {t('Show more ({count} remaining)', { count: inView.length - listLimit })}
              </button>
            )}
          </div>
          <div className="civic-map-unknown">
            <button
              className="civic-map-unknown-toggle"
              aria-expanded={unknownOpen}
              onClick={() => setUnknownOpen((v) => !v)}
            >
              <span>
                {t('Location unknown ')}
                <b>{unknownFiltered.length}</b>
              </span>
              <span>{t(unknownOpen ? '−' : '+')}</span>
            </button>
            {unknownOpen && (
              <div className="civic-map-unknown-list">
                <p>
                  {t(
                    'These notices lack a reliable map position, or their street address could not be verified. They are not placed at invented coordinates.',
                  )}
                </p>
                {unknownFiltered.slice(0, 30).map((n) => (
                  <Link key={n.id} href={`/notices/${encodeURIComponent(n.id)}`}>
                    {n.displayTitle || n.simple?.plainTitle || n.title}
                  </Link>
                ))}
                {unknownFiltered.length > 30 && (
                  <p>
                    {t('Showing the first 30 of {count} unmapped notices.', {
                      count: unknownFiltered.length,
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>
        <div className="civic-map-right">
          <InteractiveMap
            entries={eligibleEntries}
            region={region}
            selectedId={selected}
            focusSelection={focusSelection}
            onViewportChange={onViewportChange}
            onSelectNotice={onSelectNotice}
          />
          <div className="civic-map-disclosure">
            <strong>{t('How to read this map')}</strong>
            <p>
              {t(
                'Numbered circles automatically split into street pins as you zoom; click a tightly overlapping cluster to fan out individual notices. The list contains only notices within the visible map rectangle. ',
              )}
              <b>{t('Blue')}</b>
              {t(' uses source coordinates; ')}
              <b>{t('teal')}</b>
              {t(' is a high-confidence street-address match from Geoapify; ')}
              <b>{t('amber dashed')}</b>
              {t(
                ' is a broad-area representative point, not the actual address. Toronto area filters are approximate, not official boundaries. Missing markers do not establish that nothing is happening.',
              )}
            </p>
            {geocodingEnabled && (
              <p>
                {t('Geocoding:')}{' '}
                <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
                  {t('Powered by Geoapify')}
                </a>
                {t(
                  '; basemap © OpenStreetMap contributors. For matches, verify the source record before treating the street location as definitive.',
                )}
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
