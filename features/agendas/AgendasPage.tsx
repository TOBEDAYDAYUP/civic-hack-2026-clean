import { getTranslator } from '@/features/language/server';
import { collectAgendas, torontoDate, type AgendaItem } from '@/lib/civic-agent/agendas.mjs';
import { publicDataConfig } from '@/lib/supabase/config';
import { agendaKey, currentAgendaAnalysis } from '@/lib/civic-agent/agenda-analysis.mjs';
import AgendaExplorer from './AgendaExplorer';
import { agendaTopic, fallbackAgendaTitle, type AgendaDisplayItem } from './agenda-view.mjs';
import './agendas.css';
import { SourceLanguageNote } from '@/features/language/LanguageProvider';

const official = 'https://www.toronto.ca/city-government/council/council-committee-meetings/';

type AgendaSnapshot = { items: AgendaItem[]; collected_at: string };

async function readAgendas(): Promise<AgendaSnapshot | null> {
  const { url, key } = publicDataConfig;
  let snapshot: AgendaSnapshot | undefined;
  if (url && key) {
    try {
      const response = await fetch(
        new URL('/rest/v1/civic_agenda_snapshot?select=items,collected_at&id=eq.1', url),
        { headers: { apikey: key }, cache: 'no-store', signal: AbortSignal.timeout(5_000) },
      );
      if (response.ok) {
        const [row] = await response.json();
        if (Array.isArray(row?.items) && Number.isFinite(Date.parse(row.collected_at)))
          snapshot = row;
      }
    } catch {
      // The city's public feed is also available directly.
    }
  }

  if (snapshot && Date.now() - Date.parse(snapshot.collected_at) < 2 * 60 * 60 * 1000) {
    return snapshot;
  }
  try {
    return { items: await collectAgendas(), collected_at: new Date().toISOString() };
  } catch {
    return snapshot ?? null;
  }
}

type SummaryRow = { item_key: string; source_hash: string; short_title: string; summary: string };
async function displayItems(items: AgendaItem[]): Promise<AgendaDisplayItem[]> {
  const summaries = new Map<string, SummaryRow>();
  if (items.length) {
    try {
      const endpoint = new URL('/rest/v1/civic_agenda_summaries', publicDataConfig.url);
      endpoint.search = new URLSearchParams({
        select: 'item_key,source_hash,short_title,summary',
        item_key: `in.(${items.map((item) => JSON.stringify(agendaKey(item))).join(',')})`,
      }).toString();
      const response = await fetch(endpoint, {
        headers: { apikey: publicDataConfig.key },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        for (const row of (await response.json()) as SummaryRow[]) summaries.set(row.item_key, row);
      }
    } catch {
      /* Official agenda items remain available without local AI. */
    }
  }
  return items.map((item) => {
    const row = summaries.get(agendaKey(item));
    const current = currentAgendaAnalysis(item, row);
    return {
      ...item,
      displayTitle: current?.shortTitle || fallbackAgendaTitle(item.title),
      summary: current?.summary || '',
      aiReady: !!current,
      topic: agendaTopic(item.title),
    };
  });
}

export default async function AgendasPage() {
  const { t, intlLocale } = await getTranslator();
  const updateTime = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Toronto',
  });
  const snapshot = await readAgendas();
  const today = torontoDate();
  const items = await displayItems(
    (snapshot?.items || []).filter((item) => item.meetingDate >= today),
  );
  const meetingCount = new Set(items.map((item) => item.meetingId)).size;
  const hasAnalysis = items.some((item) => item.aiReady);
  return (
    <section className="route-page agendas">
      <header className="agenda-hero">
        <div>
          <div className="agenda-eyebrow">{t('COUNCIL & COMMITTEES')}</div>
          <h1>
            {t('Upcoming agendas')}
            <span>.</span>
          </h1>
          <p>{t('A clearer look at what Toronto is considering next.')}</p>
        </div>
        <div className="agenda-overview">
          <div>
            <strong>{meetingCount}</strong>
            <span>{t('upcoming meetings')}</span>
          </div>
          <div>
            <strong>{items.length}</strong>
            <span>{t('agenda items')}</span>
          </div>
        </div>
      </header>
      <div className="agenda-update">
        <span>
          {t(
            snapshot
              ? t('Updated {date}', { date: updateTime.format(new Date(snapshot.collected_at)) })
              : 'Meeting updates are temporarily unavailable',
          )}
        </span>
        <a href={official} target="_blank" rel="noopener noreferrer">
          {t('Official meeting calendar ')}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
      <SourceLanguageNote />
      <AgendaExplorer items={items} />
      {hasAnalysis && (
        <p className="agenda-footnote">
          {t('Summaries are simplified with AI. Follow the official item for the full record.')}
        </p>
      )}
    </section>
  );
}
