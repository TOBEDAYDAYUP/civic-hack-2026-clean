export function agendaTopic(title) {
  if (/property standards/i.test(title)) return 'Property standards';
  if (/heritage|designat.*property/i.test(title)) return 'Heritage';
  if (/housing|rental|dwelling/i.test(title)) return 'Housing';
  if (/zoning|planning|development/i.test(title)) return 'Planning';
  if (/transport|traffic|parking|road|transit/i.test(title)) return 'Transportation';
  if (/budget|tax|funding|fees/i.test(title)) return 'Budget';
  return 'City business';
}
export { compactAgendaTitle as fallbackAgendaTitle } from '../../lib/civic-agent/agenda-format.mjs';

export function groupAgendaItems(items, { query = '', committee = 'all', date = 'all' } = {}) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const meetings = new Map();
  for (const item of items) {
    if (committee !== 'all' && item.committee !== committee) continue;
    if (date !== 'all' && item.meetingDate !== date) continue;
    const text = [item.title, item.displayTitle, item.summary, item.reference, item.committee]
      .join(' ')
      .toLowerCase();
    if (!words.every((word) => text.includes(word))) continue;
    const group = meetings.get(item.meetingId) || {
      id: item.meetingId,
      date: item.meetingDate,
      committee: item.committee,
      items: [],
    };
    group.items.push(item);
    meetings.set(item.meetingId, group);
  }
  return [...meetings.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.committee.localeCompare(b.committee),
  );
}
