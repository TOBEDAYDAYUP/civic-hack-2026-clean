import Link from 'next/link';
import { collectAgendas, torontoDate, type AgendaItem } from '@/lib/civic-agent/agendas.mjs';
import { publicDataConfig } from '@/lib/supabase/config';
import '@/features/records/records.css';
import './agendas.css';

const official = 'https://www.toronto.ca/city-government/council/council-committee-meetings/';
const meetingDate = new Intl.DateTimeFormat('en-CA', {
  dateStyle: 'long',
  timeZone: 'UTC',
});
const updateTime = new Intl.DateTimeFormat('en-CA', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Toronto',
});

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

export default async function AgendasPage() {
  const snapshot = await readAgendas();
  const today = torontoDate();
  const meetings = new Map<number, AgendaItem[]>();

  for (const item of snapshot?.items ?? []) {
    if (item.meetingDate < today) continue;
    const meeting = meetings.get(item.meetingId);
    if (meeting) meeting.push(item);
    else meetings.set(item.meetingId, [item]);
  }

  return (
    <div className="record-page">
      <header className="record-page-navbar">
        <Link href="/" className="record-page-brand">
          Your City Council
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/">Home</Link>
        </nav>
      </header>
      <main className="record-page-main agendas">
        <div className="record-page-heading">
          <h1>Upcoming agendas</h1>
          <p>
            See public items scheduled for action at upcoming Toronto meetings, where the city has
            recorded no action for that meeting yet. This list uses the Toronto Meeting Monitor.
          </p>
          <p>
            <a href={official}>See all meeting schedules on the City of Toronto website ↗</a>
          </p>
          {snapshot && (
            <p>Last checked {updateTime.format(new Date(snapshot.collected_at))} Toronto time</p>
          )}
        </div>
        {!snapshot && <p role="status">Agendas are temporarily unavailable.</p>}
        {snapshot && meetings.size === 0 && (
          <p>The Meeting Monitor lists no upcoming items scheduled for action.</p>
        )}
        {[...meetings].map(([id, items]) => (
          <section className="agendas-meeting" key={id}>
            <header>
              <h2>{items[0].committee}</h2>
              <time dateTime={items[0].meetingDate}>
                {meetingDate.format(new Date(items[0].meetingDate + 'T00:00:00Z'))}
              </time>
            </header>
            <ul>
              {items.map((item) => (
                <li key={item.reference}>
                  <span>{item.reference}</span>
                  <a href={item.sourceUrl}>{item.title} ↗</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
