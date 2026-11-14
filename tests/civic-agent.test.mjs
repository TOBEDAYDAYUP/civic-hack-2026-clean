import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNotice,
  normalizeVote,
  agendaReference,
  proposedLink,
  digest,
  buildPreview,
} from '../lib/civic-agent/model.mjs';

test('votes retain original fields and are never classified as decisions', () => {
  const record = normalizeVote(
    { _id: 5, 'Agenda Item #': '2026.PH31.2', 'Motion Type': 'Amend Item', Result: 'Carried' },
    'resource',
  );
  assert.equal(record.record_type, 'motion_vote');
  assert.equal(record.payload.Result, 'Carried');
  assert.equal(record.agenda_reference, '2026.PH31.2');
  assert.equal(proposedLink(record).status, 'pending_review');
});
test('ambiguous references never produce a link', () => {
  for (const value of ['PH31.2', '2026.PH31.2 and EX2.1', '2026.PH31.2?', ''])
    assert.equal(agendaReference(value), null);
  assert.equal(
    proposedLink(normalizeVote({ _id: 1, 'Agenda Item #': 'PH31.2' }, 'resource')),
    null,
  );
});
test('notice must have an official source URL and no guessed link', () => {
  const row = {
    id: '12',
    payload: { title: 'Notice', sourceUrl: 'https://secure.toronto.ca/nm/12' },
  };
  assert.equal(proposedLink(normalizeNotice(row)), null);
  assert.throws(() =>
    normalizeNotice({ ...row, payload: { ...row.payload, sourceUrl: 'https://evil.example/' } }),
  );
});
test('hash is stable and changes when the source changes', () => {
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }));
  assert.notEqual(digest({ a: 1 }), digest({ a: 2 }));
});

test('preview groups vote evidence by exact agenda item and retains source failures', () => {
  const vote = (id, agenda) => normalizeVote({ _id: id, 'Agenda Item #': agenda }, 'resource');
  const sources = [
    { name: 'notices', error: 'unavailable' },
    {
      name: 'votes',
      records: [vote(1, '2026.PH31.2'), vote(2, '2026.ph31.2'), vote(3, 'PH31.2')],
    },
  ];
  const preview = buildPreview(sources);
  assert.deepEqual(preview.sources, sources);
  assert.equal(preview.issues.length, 1);
  const [issue] = preview.issues;
  assert.equal(issue.issue_key, 'agenda:2026.PH31.2');
  assert.equal(issue.status, 'pending_review');
  assert.deepEqual(
    issue.source_links.map((link) => link.external_id),
    ['resource:1', 'resource:2'],
  );
});

test('agendas include only upcoming public items with official no-action status', async () => {
  const { collectAgendas } = await import('../lib/civic-agent/agendas.mjs');
  const timestamp = Date.parse('2026-11-17T05:00:00Z');
  const meeting = {
    meetingId: 10,
    meetingDate: timestamp,
    decisionBodyName: 'Planning Committee',
    mtgStatusCd: 'SCHDLPRV',
  };
  const item = {
    inCamera: 'N',
    itemStatusCd: 'NO_ACTN',
    itemReferenceNumber: '2026.PH2.1A',
    agendaItemTitle: 'Planning report',
  };
  const requests = [];
  const fetcher = async (url) => {
    requests.push(url.pathname);
    if (requests.length === 1)
      return Response.json({
        Result: 'OK',
        Records: [meeting, { ...meeting, meetingId: 11, mtgStatusCd: 'COMPLETE' }],
      });
    return Response.json({
      Result: 'OK',
      Record: {
        meeting,
        sections: [
          {
            agendaItems: [
              item,
              item,
              { ...item, itemReferenceNumber: '2026.PH2.2', itemStatusCd: 'ADOPTED' },
              { ...item, itemReferenceNumber: '2026.PH2.3', inCamera: 'Y' },
            ],
          },
        ],
      },
    });
  };
  const records = await collectAgendas(fetcher, new Date('2026-11-17T01:00:00Z'));
  assert.equal(requests.length, 2);
  assert.deepEqual(
    records.map(({ reference, meetingDate }) => [reference, meetingDate]),
    [['2026.PH2.1A', '2026-11-17']],
  );
  assert.equal(new URL(records[0].sourceUrl).searchParams.get('item'), '2026.PH2.1A');
});

test('agenda collector fails if official meeting details fail', async () => {
  const { collectAgendas } = await import('../lib/civic-agent/agendas.mjs');
  const response = await collectAgendas(async () => Response.json({ Result: 'OK', Records: [] }));
  assert.deepEqual(response, []);
  await assert.rejects(
    collectAgendas(async () => new Response(null, { status: 503 })),
    /HTTP 503/,
  );
});

test('official vote tables keep each motion separate and omit voter names', async () => {
  const { parseOfficialMotions } = await import('../lib/civic-agent/official-motions.mjs');
  const vote = (number, body) => `
    <div class="italics">${number} - Motion to Amend Item moved by Councillor Example</div>
    <div class="wep"><p>${body}</p></div>
    <h4 class="vote-table-header">Vote <span>(Amend Item)</span><small>Jul-29-2026</small></h4>
    <table><thead><tr><th>Result: Carried</th></tr></thead><tbody>
    <tr><td><span>Count</span>Yes: 4</td><td>Example Voter</td></tr>
    <tr><td><span>Count</span>No: 2</td></tr>
    <tr><td><span>Count</span>Absent: 1</td></tr></tbody></table>
  `;
  const header = '<title>Agenda Item History - 2026.PH31.2</title><h4>Motions</h4>';
  const records = parseOfficialMotions(
    header + vote(1, 'First') + vote(2, 'Second'),
    '2026.PH31.2',
    'Title',
  );
  assert.equal(records.length, 2);
  assert.notEqual(records[0].external_id, records[1].external_id);
  assert.deepEqual(
    records.map(({ payload: { yes, no, absent, motion_text } }) => [yes, no, absent, motion_text]),
    [
      [4, 2, 1, 'First'],
      [4, 2, 1, 'Second'],
    ],
  );
  assert.doesNotMatch(JSON.stringify(records), /Example/);
});
