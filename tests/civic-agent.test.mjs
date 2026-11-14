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
