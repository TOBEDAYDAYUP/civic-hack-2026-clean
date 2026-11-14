import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agendaHash,
  agendaKey,
  validateAgendaAnalysis,
  analyzeAgenda,
  currentAgendaAnalysis,
} from '../lib/civic-agent/agenda-analysis.mjs';
import {
  fallbackAgendaTitle,
  groupAgendaItems,
  agendaTopic,
} from '../features/agendas/agenda-view.mjs';

const item = {
  meetingId: 10,
  reference: '2027.SZ1.1',
  title:
    '1123 Lansdowne Avenue - Appeal of Property Standards Order - Folder Number: 26 218156 PRS 00 IV',
  committee: 'Property Standards Panel',
  meetingDate: '2026-11-16',
  sourceUrl: 'https://secure.toronto.ca/council/agenda-item.do?item=2027.SZ1.1',
};
const analysis = {
  shortTitle: '1123 Lansdowne Avenue: property standards appeal',
  summary:
    'The panel will consider a request to review an order about the condition of this property.',
};

test('agenda analysis identity changes with source updates but not collection timestamps', () => {
  assert.equal(agendaKey(item), '10:2027.SZ1.1');
  assert.equal(agendaHash(item), agendaHash({ ...item, collected_at: 'later' }));
  for (const update of [
    { title: 'A revised official title' },
    { meetingDate: '2026-11-17' },
    { meetingId: 11 },
  ])
    assert.notEqual(agendaHash(item), agendaHash({ ...item, ...update }));
});
test('only valid, current summaries may be displayed', () => {
  const row = {
    source_hash: agendaHash(item),
    short_title: analysis.shortTitle,
    summary: analysis.summary,
  };
  assert.deepEqual(currentAgendaAnalysis(item, row), analysis);
  assert.equal(currentAgendaAnalysis({ ...item, title: 'New title' }, row), null);
  assert.equal(currentAgendaAnalysis(item, { ...row, short_title: 'Now approved' }), null);
});
test('generated headline must retain the exact property address', () => {
  assert.deepEqual(validateAgendaAnalysis(analysis, item), analysis);
  assert.throws(
    () =>
      validateAgendaAnalysis(
        { ...analysis, shortTitle: '1123 Bloor Street: property standards appeal' },
        item,
      ),
    /address/,
  );
});
test('new numbers, parties and decisions are rejected', () => {
  assert.throws(
    () =>
      validateAgendaAnalysis(
        { ...analysis, summary: 'The panel approved the appeal for this property.' },
        item,
      ),
    /decision/,
  );
  assert.throws(
    () =>
      validateAgendaAnalysis(
        { ...analysis, summary: 'The property must pay a penalty of 999 dollars.' },
        item,
      ),
    /number/,
  );
  assert.throws(
    () =>
      validateAgendaAnalysis(
        { ...analysis, shortTitle: '1123 Lansdowne Avenue: residents appeal an order' },
        item,
      ),
    /unsupported party/,
  );
});
test('a non-appeal agenda cannot acquire an invented appeal or order', () => {
  const heritage = { ...item, title: '1123 Lansdowne Avenue - Proposed Heritage Designation' };
  assert.throws(() => validateAgendaAnalysis(analysis, heritage), /unsupported party or process/);
});
test('local model uses structured, non-streaming inference and corrects one rejected result', async () => {
  let calls = 0;
  const fetcher = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'qwen3.5:4b');
    assert.equal(body.think, false);
    assert.equal(body.stream, false);
    assert.ok(body.format.required.includes('summary'));
    return Response.json({
      message: {
        content: JSON.stringify(
          ++calls === 1
            ? { ...analysis, shortTitle: '1123 Bloor Street: property standards appeal' }
            : analysis,
        ),
      },
    });
  };
  assert.deepEqual(await analyzeAgenda(item, { fetcher }), analysis);
  assert.equal(calls, 2);
});
test('repeated invalid model output is rejected rather than silently published', async () => {
  let calls = 0;
  await assert.rejects(
    analyzeAgenda(item, {
      fetcher: async () => {
        calls++;
        return Response.json({ message: { content: 'not json' } });
      },
    }),
    /rejected/,
  );
  assert.equal(calls, 2);
});
test('readable source fallback removes folder metadata without inventing a summary', () => {
  assert.equal(fallbackAgendaTitle(item.title), '1123 Lansdowne Avenue: property standards appeal');
  assert.equal(agendaTopic(item.title), 'Property standards');
});
test('search, committee and date filters compose before meetings are grouped', () => {
  const first = {
    ...item,
    displayTitle: analysis.shortTitle,
    summary: analysis.summary,
    topic: 'Property standards',
    aiReady: true,
  };
  const second = {
    ...first,
    meetingId: 11,
    reference: '2027.PB1.1',
    committee: 'Heritage Board',
    meetingDate: '2026-11-17',
  };
  assert.equal(groupAgendaItems([second, first])[0].id, 10);
  assert.equal(
    groupAgendaItems([first, second], {
      query: 'Lansdowne review',
      committee: 'Heritage Board',
      date: '2026-11-17',
    })[0].id,
    11,
  );
  assert.deepEqual(groupAgendaItems([first, second], { query: 'unmatched street' }), []);
  assert.equal(groupAgendaItems([first, second], { date: '2026-11-16' }).length, 1);
});

test('heritage headlines keep the proposal and address while omitting statutory clutter', () => {
  const title =
    '8 Arnold Avenue - Notice of Intention to Designate a Property under Part IV, Section 29 of the Ontario Heritage Act';
  assert.equal(fallbackAgendaTitle(title), '8 Arnold Avenue: proposed heritage designation');
  const record = { ...item, title };
  const clean = validateAgendaAnalysis(
    {
      shortTitle: title,
      summary:
        'The board will consider a proposed heritage designation under Part IV, Section 29 of the Ontario Heritage Act.',
    },
    record,
  );
  assert.equal(clean.shortTitle, '8 Arnold Avenue: proposed heritage designation');
  assert.equal(clean.summary, 'The board will consider a proposed heritage designation.');
});

test('a policy review is not rewritten as a new policy proposal with invented goals', () => {
  const policy = {
    ...item,
    title: 'People and Culture - Policy Review',
    committee: 'CreateTO - Human Resources Committee',
  };
  const result = validateAgendaAnalysis(
    {
      shortTitle: 'People and Culture policy review',
      summary:
        'The committee will review proposed policies for people and culture to ensure alignment with organizational goals and best practices.',
    },
    policy,
  );
  assert.equal(result.summary, 'The committee will review policies for people and culture.');
});
