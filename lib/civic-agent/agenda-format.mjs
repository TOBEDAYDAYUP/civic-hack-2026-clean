// Readability edits only: the complete official title stays in the source record.
export function compactAgendaTitle(value) {
  const clean = String(value || '')
    .replace(/\s*[-–—]\s*Folder Number\s*[:–—-]?.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const appeal = /^(.+?)\s*[-–—]\s*Appeal of Property Standards Order$/i.exec(clean);
  if (appeal) return `${appeal[1]}: property standards appeal`;
  const heritage = /^(.+?)\s*[-–—]\s*Notice of Intention to Designate a Property\b/i.exec(clean);
  if (heritage) return `${heritage[1]}: proposed heritage designation`;
  const works =
    /^(.+?)\s*[-–—]\s*Demolition and New Construction on a Designated Heritage Property\b/i.exec(
      clean,
    );
  if (works) return `${works[1]}: proposed demolition and new construction`;
  return clean;
}
export function compactAgendaSummary(value, sourceTitle = '') {
  let summary = String(value || '')
    .replace(/\s+under Part [IVX]+,?\s+Section \d+\s+of (?:the )?Ontario Heritage Act/gi, '')
    .replace(/\s+under Ontario law/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/policy review/i.test(sourceTitle) && !/propos|draft/i.test(sourceTitle))
    summary = summary.replace(/review proposed policies/gi, 'review policies');
  return summary.replace(/ to ensure alignment with organizational goals and best practices/gi, '');
}
