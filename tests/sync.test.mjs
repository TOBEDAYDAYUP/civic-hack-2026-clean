import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareRecords, hash, normalize } from '../supabase/functions/civic-sync/source.mjs';
import { syncSource } from '../lib/sync/source-sync.mjs';
const record = {
  noticeId: 12,
  title: 'Public meeting',
  noticeDescription: '<p>Discuss plans</p>',
  noticeDate: '2026-11-13',
  addressList: [{ address: 'Toronto', latitude: null, longitude: '' }],
};
test('nested official response is deduplicated and missing coordinates remain missing', async () => {
  const rows = await prepareRecords({ data: { nested: { records: [record, record] } } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, '12');
  assert.equal(rows[0].payload.description, 'Discuss plans');
  assert.equal(rows[0].payload.addresses[0].latitude, null);
  assert.equal(rows[0].payload.addresses[0].longitude, null);
});
test('hash is stable across property order and changes for source changes', async () => {
  assert.equal(await hash({ a: 1, b: 2 }), await hash({ b: 2, a: 1 }));
  assert.notEqual(
    await hash(normalize(record)),
    await hash(normalize({ ...record, noticeDescription: 'New deadline' })),
  );
});
test('empty or unrecognized responses fail instead of clearing data', async () => {
  await assert.rejects(prepareRecords({ data: [] }));
  await assert.rejects(prepareRecords({ error: 'Unavailable' }));
});
test('busy database lease skips source request', async () => {
  let calls = 0;
  const result = await syncSource({
    url: 'https://db.test',
    key: 'sb_secret_test',
    fetcher: async () => {
      calls++;
      return Response.json(null);
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.skipped, true);
});
test('successful sync commits a full validated batch', async () => {
  const requests = [];
  const result = await syncSource({
    url: 'https://db.test',
    key: 'sb_secret_test',
    fetcher: async (url, options) => {
      requests.push(url);
      if (url.endsWith('civic_acquire_sync_lease')) return Response.json('lease');
      if (url.includes('secure.toronto.ca')) return Response.json({ notices: [record] });
      const body = JSON.parse(options.body);
      assert.equal(body.token, 'lease');
      assert.equal(body.records.length, 1);
      assert.equal(options.headers.apikey, 'sb_secret_test');
      return Response.json({ fetched: 1, changed: 1 });
    },
  });
  assert.equal(result.changed, 1);
  assert.equal(requests.length, 3);
});
test('upstream failure releases only own lease and never commits', async () => {
  const requests = [];
  await assert.rejects(
    syncSource({
      url: 'https://db.test',
      key: 'sb_secret_test',
      fetcher: async (url, options) => {
        requests.push({ url, options });
        if (url.endsWith('civic_acquire_sync_lease')) return Response.json('my-lease');
        if (url.includes('secure.toronto.ca')) return new Response('Unavailable', { status: 503 });
        assert.equal(options.method, 'PATCH');
        assert.ok(url.includes('lease_token=eq.my-lease'));
        return new Response(null, { status: 204 });
      },
    }),
    /Toronto source unavailable/,
  );
  assert.ok(!requests.some((r) => r.url.includes('civic_commit_source_sync')));
});

test('display address strips coordinates, duplicate city metadata and repeated street', async () => {
  const { addressLabel } = await import('../lib/address-label.mjs');
  assert.equal(
    addressLabel(
      'Toronto · Ontario · 43.700474895 · -79.518505404 · M9N 1W2 · Canada · 1956 Weston Road · 1956 Weston Road Toronto Ontario',
    ),
    '1956 Weston Road',
  );
  assert.equal(addressLabel('1 Little Avenue'), '1 Little Avenue');
});

test('plain-language introduction uses 50–80 words and retains application status', async () => {
  const { introduction } = await import('../features/records/introduction.mjs');
  for (const item of [
    {
      title: 'Planning application',
      summary: 'The City received a planning application.',
      location: '10, 20 and 36 York Mills Road',
      status: 'This is a notice of application. It has not been adopted by Council.',
    },
    {
      title: 'Council budget',
      summary: 'Council adopted the annual budget.',
      status: 'Council adopted',
    },
    { title: 'Public meeting' },
    { title: 'Long source', summary: 'One very long sentence ' + 'details '.repeat(150) },
  ]) {
    const text = introduction(item),
      words = text.split(/\s+/).length;
    assert.ok(words >= 50 && words <= 80, `${words}: ${text}`);
  }
  const text = introduction({
    title: 'Application',
    summary: 'The City received an application.',
    status: 'It has not been adopted by Council.',
  });
  assert.ok(text.includes('not been adopted by Council'));
});

test('introduction keeps dotted references intact and removes URL fragments', async () => {
  const { introduction } = await import('../features/records/introduction.mjs');
  const text = introduction({
    title: 'Notice of passing',
    summary:
      'The City passed the by-law. Please see item PH31.2 at https://secure.toronto.ca/council/agenda-item.do?item=2026.PH31.2.',
  });
  assert.ok(!text.includes('https:'));
  assert.ok(!text.includes('at https://secure.'));
  assert.ok(!text.includes('PH31. 2'));
});

// Stage evidence must come from the original record, never publication or AI dates.
import { stageEvidence } from '../features/records/stage-evidence.mjs';
const sourceUrl = 'https://secure.toronto.ca/nm/notices/1';
test('stage dates are taken from explicit source events and preserve gaps', () => {
  const p = stageEvidence({
    sourceUrl,
    title: '15 Poyntz Avenue',
    text: 'The City of Toronto passed Zoning By-law 1260-2026, on July 30, 2026. A building permit was issued on August 12, 2026.',
  });
  assert.equal(p.latest, 2);
  assert.equal(p.milestones[0].date, '2026-07-30');
  assert.equal(p.milestones[1].status, 'unknown');
  assert.equal(p.milestones[2].date, '2026-08-12');
  assert.equal(p.milestones[2].sourceUrl, sourceUrl);
  assert.match(p.milestones[0].quote, /July 30/);
});
test('planning applications are not building permit applications or approvals', () => {
  const p = stageEvidence({
    sourceUrl,
    title: 'Notice of Application',
    text: 'The City received a planning application on November 6, 2026.',
  });
  assert.equal(p.planningApplication?.date, '2026-11-06');
  assert.equal(p.planningApplication?.sourceUrl, sourceUrl);
  assert.equal(p.latest, -1);
  assert.ok(p.milestones.every((m) => !m.date && m.status === 'unknown'));
});
test('Toronto notice receipts work with a colon and do not borrow publication dates', () => {
  const p = stageEvidence({
    sourceUrl,
    text: 'NOTICE OF APPLICATION(S) (Under the Planning Act) The City has received the following application under the Planning Act: Application Number: 26 215914 NNY 15 OZ. Published November 6, 2026.',
  });
  assert.match(p.planningApplication?.quote, /has received/);
  assert.equal(p.planningApplication.date, null);
  for (const text of [
    'The City has not received a planning application.',
    'If the City received a planning application, it would review it.',
    'The City received a building permit application.',
  ]) {
    assert.equal(stageEvidence({ sourceUrl, text }).planningApplication, null);
  }
});
test('proposed, negated and hypothetical events do not establish milestones', () => {
  for (const text of [
    'Construction will commence on August 1, 2026.',
    'Construction has not started.',
    'If a building permit was issued on August 1, 2026, work could begin.',
    'Planning approval was granted on August 1, 2026, but was not final.',
  ]) {
    assert.equal(stageEvidence({ sourceUrl, text }).latest, -1);
  }
});
test('citywide bylaw changes do not establish a building approval milestone', () => {
  assert.equal(
    stageEvidence({
      sourceUrl,
      title: 'City-wide low-carbon technologies',
      text: 'The City of Toronto passed Zoning By-law 1075-2026 on July 30, 2026.',
    }).latest,
    -1,
  );
});
test('unknown, invalid and ambiguous dates stay unknown; unsafe sources are not evidence', () => {
  for (const text of [
    'Construction has started.',
    'Construction has started on 2026-02-31.',
    'Construction has started between August 1, 2026 and August 5, 2026.',
  ]) {
    assert.equal(stageEvidence({ sourceUrl, text }).milestones[3].date, null);
  }
  assert.equal(
    stageEvidence({
      sourceUrl: 'javascript:alert(1)',
      text: 'Construction has started on August 1, 2026.',
    }).latest,
    -1,
  );
});

test('source timeout identifies the failed phase, releases the lease and never commits', async () => {
  const requests = [];
  await assert.rejects(
    syncSource({
      url: 'https://db.test',
      key: 'sb_secret_test',
      fetcher: async (url, options) => {
        requests.push({ url, options });
        if (url.endsWith('civic_acquire_sync_lease')) return Response.json('timeout-lease');
        if (url.includes('secure.toronto.ca'))
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        assert.equal(options.method, 'PATCH');
        const state = JSON.parse(options.body);
        assert.match(
          state.last_error,
          /Toronto notice export timed out.*waiting for HTTP response headers/,
        );
        assert.equal(state.lease_token, null);
        assert.ok(url.includes('lease_token=eq.timeout-lease'));
        return new Response(null, { status: 204 });
      },
    }),
    /Toronto notice export timed out/,
  );
  assert.equal(requests.length, 3);
  assert.ok(!requests.some((r) => r.url.includes('civic_commit_source_sync')));
});

test('database timeout reports its SQL code without exposing the response payload', async () => {
  const requests = [];
  await assert.rejects(
    syncSource({
      url: 'https://db.test',
      key: 'sb_secret_test',
      fetcher: async (url, options) => {
        requests.push(url);
        if (url.endsWith('civic_acquire_sync_lease')) return Response.json('db-timeout-lease');
        if (url.includes('secure.toronto.ca')) return Response.json({ notices: [record] });
        if (url.endsWith('civic_commit_source_sync'))
          return Response.json(
            { code: '57014', message: 'sensitive-response-must-stay-hidden' },
            { status: 500 },
          );
        assert.equal(options.method, 'PATCH');
        return new Response(null, { status: 204 });
      },
    }),
    (error) => {
      assert.match(error.message, /500, 57014.*database statement timeout/);
      assert.ok(!error.message.includes('sensitive-response-must-stay-hidden'));
      return true;
    },
  );
  assert.equal(requests.length, 4);
});
