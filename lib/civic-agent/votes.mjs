import { agendaReference, digest } from './model.mjs';
import { getOfficialMotions } from './official-motions.mjs';

const votingDataset = 'members-of-toronto-city-council-voting-record';
const voteYear = 2026;
const voteDate = /^2026[-/]\d{1,2}[-/]\d{1,2}(?:$|[ T])/;
const pageSize = 1000;

export async function collectVotes(ckan) {
  const dataset = await ckan('package_show', { id: votingDataset });
  const resources = (dataset.resources || []).filter((resource) => {
    const term = /^member-voting-record-(\d{4})-(\d{4})$/.exec(resource.name);
    return (
      resource.datastore_active &&
      term &&
      Number(term[1]) <= voteYear &&
      Number(term[2]) >= voteYear
    );
  });
  if (!resources.length || resources.some((resource) => !resource.id)) {
    throw new Error('No active voting resource covers ' + voteYear);
  }

  const titles = new Map();
  const aggregates = new Map();
  for (const resource of resources) {
    let offset = 0;
    let expectedTotal;
    let previousId = 0;
    do {
      const page = await ckan('datastore_search', {
        resource_id: resource.id,
        q: JSON.stringify({ 'Date/Time': String(voteYear) }),
        fields: '_id,Committee,Date/Time,Agenda Item #,Agenda Item Title,Motion Type,Vote,Result',
        sort: '_id asc',
        limit: String(pageSize),
        offset: String(offset),
      });
      expectedTotal ??= page.total;
      if (
        !Array.isArray(page.records) ||
        !Number.isSafeInteger(expectedTotal) ||
        expectedTotal < 0 ||
        page.total !== expectedTotal ||
        offset + page.records.length > expectedTotal ||
        (!page.records.length && offset < expectedTotal)
      ) {
        throw new Error('Incomplete Toronto voting data for resource ' + resource.id);
      }

      for (const row of page.records) {
        if (!Number.isSafeInteger(row._id) || row._id <= previousId) {
          throw new Error('Toronto voting rows out of order for resource ' + resource.id);
        }
        previousId = row._id;
        if (voteDate.test(String(row['Date/Time']).trim())) {
          const reference = agendaReference(row['Agenda Item #']);
          if (!reference)
            throw new Error('Invalid official agenda reference in vote row ' + row._id);
          const title = String(row['Agenda Item Title'] ?? '').trim();
          titles.set(reference, title);
          const date = row['Date/Time'].trim();
          const motionType = row['Motion Type'];
          const result = row.Result;
          const key = digest([reference, date, row.Committee, motionType, result]);
          let record = aggregates.get(key);
          if (!record) {
            record = {
              source: 'toronto_open_data_vote',
              external_id: 'aggregate:' + reference + ':' + key,
              source_url:
                'https://open.toronto.ca/dataset/members-of-toronto-city-council-voting-record/',
              record_type: 'motion_vote',
              agenda_reference: reference,
              title,
              occurred_at_text: date,
              payload: {
                motion_type: motionType,
                result,
                yes: 0,
                no: 0,
                absent: 0,
                motion_text: null,
                official_url: 'https://secure.toronto.ca/council/agenda-item.do?item=' + reference,
              },
            };
            aggregates.set(key, record);
          }
          const vote = String(row.Vote).trim().toLowerCase();
          if (vote === 'yes' || vote === 'no') record.payload[vote] += 1;
          else if (vote === 'absent' || vote === 'absent(interest declared)')
            record.payload.absent += 1;
          else throw new Error('Unexpected official vote value in ' + reference);
        }
      }
      offset += page.records.length;
    } while (offset < expectedTotal);
  }
  const records = [];
  const missing = [];
  const items = [...titles];
  for (let start = 0; start < items.length; start += 5) {
    const batch = await Promise.all(
      items.slice(start, start + 5).map(async ([reference, title]) => {
        try {
          return { reference, motions: await getOfficialMotions(reference, title) };
        } catch (error) {
          return { reference, error: error.message };
        }
      }),
    );
    for (const item of batch) {
      if (item.motions?.length) records.push(...item.motions);
      else missing.push(item.reference + (item.error ? ' (' + item.error + ')' : ''));
    }
  }
  const referencesWithTables = new Set(records.map((record) => record.agenda_reference));
  for (const summary of aggregates.values()) {
    if (!referencesWithTables.has(summary.agenda_reference)) records.push(summary);
  }
  if (missing.length)
    console.warn(
      'Official vote tables unavailable for ' +
        missing.length +
        ' agenda items: ' +
        missing.join(', '),
    );
  return records;
}
