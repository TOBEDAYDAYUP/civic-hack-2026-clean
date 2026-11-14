// Only explicit statements in the original record establish a milestone.
const rules = [
  /(?:\b(?:council|city of toronto)\b.{0,90}\b(?:approved|adopted|passed)\b.{0,70}\b(?:zoning|official plan|planning|by-law)|\bplanning (?:permission|approval) (?:was |has been )?granted\b)/i,
  /\b(?:applied for (?:a |the )?building permit|building permit application (?:was |has been )?(?:received|submitted)|submitted (?:a |the )?building permit application)\b/i,
  /\b(?:building permit (?:was |has been )?issued|issued (?:a |the )?building permit)\b/i,
  /\bconstruction (?:work )?(?:has |had |was )?(?:started|begun|commenced)\b/i,
  /\b(?:occupancy permit (?:was |has been )?issued|construction (?:was |has been )?completed)\b/i,
];
const datePattern =
  /\b(?:\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi;
const negative =
  /\b(?:not|never|may|might|could|will|would|proposed|expected|anticipated|if|should|must|seeks?|requested)\b/i;
const planningReceipt =
  /\b(?:city(?: of toronto)? (?:has )?received (?:a |the (?:following )?)?(?:complete )?(?:planning application|application under (?:section \d+ of )?the planning act)|(?:complete )?planning application (?:was |has been )?received)\b/i;
function validDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString().slice(0, 10);
  if (/^\d{4}-/.test(value)) return value === iso ? iso : null;
  const day = Number(value.match(/\d{1,2}/)?.[0]);
  return day === date.getUTCDate() ? iso : null;
}
export function stageEvidence({ text = '', title = '', sourceUrl = '' } = {}) {
  const safeUrl = /^https?:\/\//i.test(sourceUrl) ? sourceUrl : '';
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z])/);
  const milestones = rules.map((rule, index) => {
    const matches = sentences.filter((s) => s.length <= 650 && rule.test(s) && !negative.test(s));
    // City-wide rule changes do not establish progress for an individual building.
    const evidence = matches.find(
      (s) => index !== 0 || !/city[- ]wide|all (?:of )?the lands|low-carbon/i.test(title + ' ' + s),
    );
    if (!evidence || !safeUrl) return { status: 'unknown', date: null, quote: '', sourceUrl: '' };
    const dates = [...evidence.matchAll(datePattern)].map((m) => validDate(m[0])).filter(Boolean);
    const unique = [...new Set(dates)];
    return {
      status: 'recorded',
      date:
        unique.length === 1 &&
        rules.filter((r) => r.test(evidence)).length === 1 &&
        !/published|deadline|appeal|meeting/i.test(evidence)
          ? unique[0]
          : null,
      quote: evidence.trim(),
      sourceUrl: safeUrl,
    };
  });
  let latest = -1;
  milestones.forEach((m, i) => {
    if (m.status === 'recorded') latest = i;
  });
  if (latest >= 0) milestones[latest].status = 'latest';
  // Toronto notices often continue the receipt statement with a colon and a list.
  const receipt = text
    .replace(/\s+/g, ' ')
    .split(/[:;]|\.(?=\s|$)/)
    .map((part) => part.trim())
    .find((part) => part.length <= 650 && planningReceipt.test(part) && !negative.test(part));
  const receiptDate = receipt?.match(
    /\breceived\b.*?\bon ((?:\d{4}-\d{2}-\d{2})|(?:[A-Za-z]+ \d{1,2},? \d{4}))$/i,
  );
  const planningApplication =
    receipt && safeUrl
      ? { date: receiptDate ? validDate(receiptDate[1]) : null, quote: receipt, sourceUrl: safeUrl }
      : null;
  return { milestones, latest, planningApplication };
}
