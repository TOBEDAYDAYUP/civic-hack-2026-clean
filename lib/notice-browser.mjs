/**
 * A small, predictable taxonomy for *public notices* (not Council decision stages).
 * Match official topic labels first, then the original notice title.
 * All unrecognized notices remain discoverable under Other.
 */
export const NOTICE_CATEGORIES = Object.freeze([
  { value: 'all', label: 'All topics' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'housing', label: 'Housing' },
  { value: 'budget', label: 'Taxes & Budget' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'other', label: 'Other' },
]);

const rules = [
  ['transportation', /\b(?:transportation|transit|ttc|metrolinx|bus|subway|streetcar|traffic|road|roadway|parking|bike|bicycle|cycling|pedestrian|rail|train|sidewalk|mobility)\b/i],
  ['housing', /\b(?:housing|homes?|residential|rental|tenant|renters?|development|zoning|planning|condominium|apartment|dwelling|affordable housing|land use)\b/i],
  ['budget', /\b(?:tax|taxes|taxation|budget|levy|financial|finance|funding|fees?|charges?|assessment|rates?)\b/i],
  ['infrastructure', /\b(?:infrastructure|watermain|water|sewer|stormwater|bridge|utility|utilities|park|construction|waste|hydro|public works|facility|facilities)\b/i],
];

export function noticeCategory(notice) {
  const topics = Array.isArray(notice?.topics) ? notice.topics.filter(t => typeof t === 'string').join(' ') : '';
  const title = typeof notice?.title === 'string' ? notice.title : '';
  for (const source of [topics, title]) {
    for (const [category, pattern] of rules) if (pattern.test(source)) return category;
  }
  return 'other';
}

export function categoryLabel(value) {
  return NOTICE_CATEGORIES.find(c => c.value === value)?.label ?? 'Other';
}

function searchableText(item) {
  const addressText = Array.isArray(item.addresses)
    ? item.addresses.map(a => (typeof a?.label === 'string' ? a.label : '')).join(' ')
    : '';
  const simple = item.aiReady !== false && item.simple && typeof item.simple === 'object' ? item.simple : {};
  return [item.title, item.displayTitle, item.description, ...(item.topics || []), addressText,
    simple.plainTitle, simple.whatIsHappening, simple.where]
    .filter(v => typeof v === 'string').join(' ').toLocaleLowerCase();
}

function sortableDate(item) {
  const value = item.noticeDate;
  if (!value || typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Filter before pagination and sort by the source's notice date, not the AI update date. */
export function filterAndSortNotices(items, { query = '', category = 'all', sort = 'newest', savedIds } = {}) {
  const term = String(query).trim().slice(0, 100).toLocaleLowerCase();
  const savedSet = Array.isArray(savedIds) ? new Set(savedIds) : null;
  const matches = items.filter(item => {
    if (savedSet && !savedSet.has(item.id)) return false;
    if (category !== 'all' && noticeCategory(item) !== category) return false;
    return !term || searchableText(item).includes(term);
  });
  const direction = sort === 'oldest' ? 1 : -1;
  return matches.sort((a, b) => {
    const ad = sortableDate(a), bd = sortableDate(b);
    if (ad === null && bd !== null) return 1;
    if (bd === null && ad !== null) return -1;
    if (ad !== null && bd !== null && ad !== bd) return (ad - bd) * direction;
    return String(a.id).localeCompare(String(b.id)) * direction;
  });
}
