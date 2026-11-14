'use client';
import { useLanguage } from '@/features/language/LanguageProvider';

import { useMemo, useState } from 'react';
import { groupAgendaItems, type AgendaDisplayItem } from './agenda-view.mjs';

export default function AgendaExplorer({ items }: { items: AgendaDisplayItem[] }) {
  const { t, intlLocale } = useLanguage();
  const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intlLocale, { ...options, timeZone: 'UTC' }).format(
      new Date(date + 'T00:00:00Z'),
    );
  const [query, setQuery] = useState('');
  const [committee, setCommittee] = useState('all');
  const [date, setDate] = useState('all');
  const [expanded, setExpanded] = useState<number | 'auto' | null>('auto');
  const dates = useMemo(() => [...new Set(items.map((item) => item.meetingDate))].sort(), [items]);
  const committees = useMemo(
    () => [...new Set(items.map((item) => item.committee))].sort(),
    [items],
  );
  const meetings = useMemo(
    () => groupAgendaItems(items, { query, committee, date }),
    [items, query, committee, date],
  );
  const count = meetings.reduce((total, meeting) => total + meeting.items.length, 0);
  return (
    <>
      <div className="agenda-tools">
        <label className="agenda-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label={t('Search upcoming agenda items')}
            placeholder={t('Search a topic, address or item…')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setExpanded('auto');
            }}
          />
        </label>
        <select
          aria-label={t('Filter by committee')}
          value={committee}
          onChange={(event) => {
            setCommittee(event.target.value);
            setExpanded('auto');
          }}
        >
          <option value="all">{t('All committees')}</option>
          {committees.map((name) => (
            <option key={name} value={name} lang="en">
              {name}
            </option>
          ))}
        </select>
      </div>
      {dates.length > 0 && (
        <div className="agenda-dates" role="group" aria-label={t('Filter by meeting date')}>
          <button
            type="button"
            className={date === 'all' ? 'is-selected' : ''}
            aria-pressed={date === 'all'}
            onClick={() => {
              setDate('all');
              setExpanded('auto');
            }}
          >
            {t('All dates')}
          </button>
          {dates.map((value) => (
            <button
              type="button"
              key={value}
              className={date === value ? 'is-selected' : ''}
              aria-pressed={date === value}
              onClick={() => {
                setDate(value);
                setExpanded('auto');
              }}
            >
              {dateLabel(value, { weekday: 'short', month: 'short', day: 'numeric' })}
            </button>
          ))}
        </div>
      )}
      <div className="agenda-results" aria-live="polite">
        <span>
          <strong>{count}</strong> {t(count === 1 ? 'item' : 'items')} · {meetings.length}{' '}
          {t(meetings.length === 1 ? 'meeting' : 'meetings')}
        </span>
        <span>{t('Earliest meeting first')}</span>
      </div>
      {!meetings.length && (
        <div className="agenda-empty">
          <h2>{t(items.length ? 'No matching agenda items' : 'No upcoming items yet')}</h2>
          <p>
            {t(
              items.length
                ? 'Try another topic, committee or date.'
                : 'New items will appear when the City publishes them.',
            )}
          </p>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCommittee('all');
                setDate('all');
                setExpanded('auto');
              }}
            >
              {t('Clear filters')}
            </button>
          )}
        </div>
      )}
      <div className="agenda-meetings">
        {meetings.map((meeting, index) => {
          const open = expanded === 'auto' ? index === 0 : expanded === meeting.id;
          return (
            <section className={`agenda-meeting ${open ? 'is-open' : ''}`} key={meeting.id}>
              <h2 className="agenda-meeting-heading">
                <button
                  type="button"
                  className="agenda-meeting-toggle"
                  aria-expanded={open}
                  aria-controls={`agenda-items-${meeting.id}`}
                  onClick={() => setExpanded(open ? null : meeting.id)}
                >
                  <span className="agenda-date-block">
                    <span>{dateLabel(meeting.date, { month: 'short' })}</span>
                    <strong>{dateLabel(meeting.date, { day: 'numeric' })}</strong>
                  </span>
                  <span className="agenda-meeting-name">
                    <strong lang="en">{meeting.committee}</strong>
                    <span>
                      <time dateTime={meeting.date}>
                        {dateLabel(meeting.date, {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                      <span className="agenda-item-count">
                        {meeting.items.length} {t(meeting.items.length === 1 ? 'item' : 'items')}
                      </span>
                    </span>
                  </span>
                  <span className="agenda-chevron" aria-hidden="true">
                    {t(open ? '−' : '+')}
                  </span>
                </button>
              </h2>
              {open && (
                <div className="agenda-card-grid" id={`agenda-items-${meeting.id}`}>
                  {meeting.items.map((item) => (
                    <article className="agenda-card" key={item.reference}>
                      <div className="agenda-card-meta">
                        <span className="agenda-topic">{t(item.topic)}</span>
                        <span>{item.reference}</span>
                      </div>
                      <h3 lang="en">{item.displayTitle}</h3>
                      {item.summary && <p lang="en">{item.summary}</p>}
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('View official item {reference}', {
                          reference: item.reference,
                        })}
                      >
                        {t('View official item ')}
                        <span aria-hidden="true">↗</span>
                      </a>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
