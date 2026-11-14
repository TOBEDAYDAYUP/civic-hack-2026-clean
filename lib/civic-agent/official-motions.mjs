import { digest } from './model.mjs';

const officialPage = 'https://secure.toronto.ca/council/agenda-item.do';
const datasetPage =
  'https://open.toronto.ca/dataset/members-of-toronto-city-council-voting-record/';
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const entities = {
  amp: '&',
  nbsp: ' ',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  eacute: 'é',
  Eacute: 'É',
};

function plainText(html) {
  return html
    .replace(/<\/?(?:p|li|tr|div)\b[^>]*>|<br\b[^>]*>/gi, '\n')
    .replace(/<\/(?:th|td)>/gi, ' | ')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(x[0-9a-f]+|[0-9]+);|&([a-z]+);/gi, (entity, numeric, name) => {
      if (!numeric) return entities[name] ?? entity;
      const code =
        numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    })
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n');
}

function voteTime(text) {
  const match = /^(\w{3})-(\d{1,2})-2026(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i.exec(text);
  if (!match) return null;
  const month = months.findIndex((value) => value.toLowerCase() === match[1].toLowerCase()) + 1;
  if (!month) return null;
  const date = '2026-' + String(month).padStart(2, '0') + '-' + match[2].padStart(2, '0');
  if (!match[3]) return date;
  const hour = (Number(match[3]) % 12) + (match[5].toUpperCase() === 'PM' ? 12 : 0);
  return date + ' ' + String(hour).padStart(2, '0') + ':' + match[4];
}

export function parseOfficialMotions(html, reference, title) {
  const officialUrl = new URL(officialPage);
  officialUrl.searchParams.set('item', reference);
  if (
    !html.includes('Agenda Item History ' + reference) &&
    !html.includes('Agenda Item History - ' + reference)
  ) {
    throw new Error('Unexpected official agenda page for ' + reference);
  }

  const motions = [];
  let sectionIndex = 0;
  let decisionText = null;
  let motionStart = null;
  let motionNumber = null;
  let motionIndex = 0;
  const editions = new Map();
  for (const part of html.matchAll(
    /<h4\b[^>]*>\s*(?:City Council |Community Council |Committee |Commission |Board )?Decision\s*<\/h4>\s*<div class="wep">([\s\S]*?)<\/div>|<h4\b[^>]*>\s*Motions(?:\s*\([^<]*\))?\s*<\/h4>|<div class="italics">\s*(?:(\d+[a-z]?)\s*-\s*)?Motion\b[\s\S]*?<\/div>|<h4 class="vote-table-header">([\s\S]*?)<\/h4>\s*<table\b[^>]*>([\s\S]*?)<\/table>/gi,
  )) {
    if (part[1] !== undefined) {
      decisionText = plainText(part[1]) || null;
      continue;
    }
    if (part[3] === undefined) {
      if (part[0].startsWith('<h4')) {
        sectionIndex += 1;
        motionIndex = 0;
        motionStart = null;
      } else {
        motionStart = part.index + part[0].length;
        motionNumber = part[2] ?? null;
        motionIndex += 1;
      }
      continue;
    }
    const type = part[3].match(/<span[^>]*>\s*\(([\s\S]*?)\)\s*<\/span>/i)?.[1];
    const time = part[3].match(/<small[^>]*>([\s\S]*?)<\/small>/i)?.[1];
    const occurredAt = time && voteTime(plainText(time));
    if (!occurredAt) {
      if (time && /\b20(?!26)\d{2}\b/.test(time)) continue;
      throw new Error('Unrecognized official vote date in ' + reference);
    }

    const counts = Object.fromEntries(
      [...part[4].matchAll(/<\/span>\s*(Yes|No|Absent):\s*(\d+)/gi)].map((match) => [
        match[1].toLowerCase(),
        Number(match[2]),
      ]),
    );
    const result = part[4].match(/<th[^>]*>\s*Result:\s*([^<]+)/i)?.[1]?.trim();
    // The second table column contains member names and is never extracted.
    if (
      !type ||
      !result ||
      ['yes', 'no', 'absent'].some((key) => !Number.isSafeInteger(counts[key]))
    ) {
      throw new Error('Incomplete official vote totals in ' + reference);
    }
    const body = motionStart === null ? '' : html.slice(motionStart, part.index);
    const motionText = plainText(body.match(/<div class="wep">([\s\S]*)<\/div>/i)?.[1] ?? '');
    const fingerprint = digest({ occurredAt, type: plainText(type), sectionIndex, motionNumber });
    const edition = (editions.get(fingerprint) ?? 0) + 1;
    editions.set(fingerprint, edition);
    motions.push({
      source: 'toronto_open_data_vote',
      external_id: 'motion:' + reference + ':' + fingerprint + ':' + edition,
      source_url: datasetPage,
      record_type: 'motion_vote',
      agenda_reference: reference,
      title,
      occurred_at_text: occurredAt,
      payload: {
        motion_type: plainText(type),
        motion_number: motionNumber,
        motion_index: motionIndex,
        result,
        ...counts,
        motion_text: motionText || null,
        decision_text: motionText ? null : decisionText,
        official_url: officialUrl.href,
      },
    });
    motionStart = null;
  }
  return motions;
}

export async function getOfficialMotions(reference, title) {
  const url = new URL(officialPage);
  url.searchParams.set('item', reference);
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error('Official motion page returned HTTP ' + response.status);
  const encoding = /charset=iso-8859-1/i.test(response.headers.get('content-type') ?? '')
    ? 'windows-1252'
    : 'utf-8';
  return parseOfficialMotions(
    new TextDecoder(encoding).decode(await response.arrayBuffer()),
    reference,
    title,
  );
}
