import { createHash } from 'node:crypto';

// Never infer a final decision from a vote or a public notice.
export function sourceIdentity(source, externalId) {
  if (!source || !externalId) throw new Error('Missing source identity');
  return `${source}:${externalId}`;
}

export function agendaReference(value) {
  const match = String(value || '')
    .trim()
    .match(/^(\d{4})\.([A-Z]{2,8}\d+\.\d+)$/i);
  return match ? `${match[1]}.${match[2].toUpperCase()}` : null;
}

export function normalizeVote(row, resourceId) {
  const rowId = row._id;
  if (rowId === undefined || rowId === null || !resourceId)
    throw new Error('Missing official vote row identity');
  const agenda = agendaReference(row['Agenda Item #']);
  const payload = Object.fromEntries(Object.entries(row).filter(([key]) => key !== '_full_text'));
  return {
    source: 'toronto_open_data_vote',
    external_id: `${resourceId}:${rowId}`,
    source_url: 'https://open.toronto.ca/dataset/members-of-toronto-city-council-voting-record/',
    record_type: 'motion_vote',
    agenda_reference: agenda,
    title: String(row['Agenda Item Title'] || '').trim(),
    occurred_at_text: String(row['Date/Time'] || '').trim() || null,
    payload,
  };
}

export function normalizeNotice(row) {
  if (!row?.id || !row?.payload?.sourceUrl || !row?.payload?.title)
    throw new Error('Invalid source notice');
  const url = new URL(row.payload.sourceUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'secure.toronto.ca')
    throw new Error('Unofficial notice URL');
  return {
    source: 'toronto_public_notice',
    external_id: String(row.id),
    source_url: url.href,
    record_type: 'public_notice',
    agenda_reference: null,
    title: row.payload.title,
    occurred_at_text: row.notice_date || null,
    payload: row.payload,
  };
}

export function digest(record) {
  function stable(v) {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, stable(v[k])]),
      );
    return v;
  }
  return createHash('sha256')
    .update(JSON.stringify(stable(record)))
    .digest('hex');
}

// An explicit agenda identifier may suggest a link. It remains pending until reviewed.
export function proposedLink(record) {
  return record.agenda_reference
    ? {
        issue_key: `agenda:${record.agenda_reference}`,
        status: 'pending_review',
        method: 'official_agenda_identifier',
        evidence: record.agenda_reference,
      }
    : null;
}

export function buildPreview(sources) {
  const issues = new Map();
  for (const { records = [] } of sources) {
    for (const record of records) {
      const link = proposedLink(record);
      if (!link) continue;

      if (!issues.has(link.issue_key)) {
        issues.set(link.issue_key, {
          issue_key: link.issue_key,
          agenda_reference: link.evidence,
          title: record.title,
          status: link.status,
          source_links: [],
        });
      }
      issues.get(link.issue_key).source_links.push({
        source: record.source,
        external_id: record.external_id,
        method: link.method,
        evidence: link.evidence,
      });
    }
  }
  return { generated_at: new Date().toISOString(), sources, issues: [...issues.values()] };
}
