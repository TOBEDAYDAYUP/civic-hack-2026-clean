const monitor = 'https://secure.toronto.ca/council/api/';
const itemPage = 'https://secure.toronto.ca/council/agenda-item.do';

export function torontoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return [fields.year, fields.month, fields.day].join('-');
}

async function readMonitor(path, fetcher) {
  const response = await fetcher(new URL(path, monitor), {
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Toronto Meeting Monitor returned HTTP ' + response.status);
  const data = await response.json();
  if (data?.Result !== 'OK') throw new Error('Invalid Toronto Meeting Monitor response');
  return data;
}

export async function collectAgendas(fetcher = fetch, now = new Date()) {
  const { Records: meetings } = await readMonitor('multiple/monitor/meeting-list.json', fetcher);
  if (!Array.isArray(meetings)) throw new Error('Invalid Toronto meeting list');
  const today = torontoDate(now);
  const upcoming = meetings.filter((meeting) => {
    if (meeting?.mtgStatusCd !== 'SCHDLPRV') return false;
    if (
      !Number.isSafeInteger(meeting.meetingId) ||
      !Number.isFinite(meeting.meetingDate) ||
      !meeting.decisionBodyName?.trim()
    ) {
      throw new Error('Invalid scheduled Toronto meeting');
    }
    return torontoDate(new Date(meeting.meetingDate)) >= today;
  });
  const items = [];
  for (const meeting of upcoming) {
    const { Record: detail } = await readMonitor(
      'individual/monitor/meeting/' + meeting.meetingId + '.json',
      fetcher,
    );
    if (detail?.meeting?.meetingId !== meeting.meetingId || !Array.isArray(detail.sections)) {
      throw new Error('Invalid agenda for Toronto meeting ' + meeting.meetingId);
    }
    if (detail.meeting.mtgStatusCd !== 'SCHDLPRV') continue;
    for (const section of detail.sections) {
      // A section can be returned without published agenda items.
      if (section.agendaItems == null) continue;
      if (!Array.isArray(section.agendaItems)) throw new Error('Invalid Toronto agenda section');
      for (const item of section.agendaItems) {
        if (
          item.inCamera !== 'N' ||
          item.considerTypeCd !== 'ACTION' ||
          item.itemStatusCd !== 'NO_ACTN'
        )
          continue;
        const reference = item.itemReferenceNumber;
        const title = item.agendaItemTitle?.trim();
        if (!/^[0-9]{4}\.[A-Z]{2,8}\d+\.\d+[A-Z]{0,2}$/i.test(reference) || !title) {
          throw new Error('Invalid published Toronto agenda item');
        }
        const source = new URL(itemPage);
        source.searchParams.set('item', reference);
        items.push({
          meetingId: meeting.meetingId,
          meetingDate: torontoDate(new Date(detail.meeting.meetingDate)),
          committee: meeting.decisionBodyName,
          reference,
          title,
          sourceUrl: source.href,
        });
      }
    }
  }
  return [
    ...new Map(items.map((item) => [item.meetingId + ':' + item.reference, item])).values(),
  ].sort(
    (a, b) =>
      a.meetingDate.localeCompare(b.meetingDate) ||
      a.committee.localeCompare(b.committee) ||
      a.reference.localeCompare(b.reference, 'en', { numeric: true }),
  );
}
