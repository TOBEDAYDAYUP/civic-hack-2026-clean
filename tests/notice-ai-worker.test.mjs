import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createNoticeAiCycle } from '../lib/notice-ai-worker.mjs';

const since = '2026-11-13T22:00:00.000Z';
const sameStamp = '2026-11-13T22:01:00.123456+00:00';
const later = '2026-11-13T22:02:00.000Z';
const row = (id, source_hash, updated_at = sameStamp) => ({ id, source_hash, updated_at });
const quiet = { since, log() {}, warn() {} };

test('processes new and changed revisions in order without replaying unchanged rows', async () => {
  const seen = [];
  const cursors = [];
  const batches = [[row('1', 'a'), row('2', 'b')], [row('1', 'c', later)], []];
  const cycle = createNoticeAiCycle({
    ...quiet,
    readChanges(cursor) {
      cursors.push(cursor);
      return batches.shift();
    },
    async analyze(id) {
      seen.push(id);
    },
  });
  await cycle();
  await cycle();
  await cycle();
  assert.deepEqual(seen, ['1', '2', '1']);
  assert.deepEqual(cursors, [
    { updatedAt: since, id: '' },
    { updatedAt: sameStamp, id: '2' },
    { updatedAt: later, id: '1' },
  ]);
});

test('a failed notice waits before retry while other notices continue', async () => {
  let time = 0;
  const calls = [];
  const batches = [[row('1', 'a'), row('2', 'b')], [row('3', 'c', later)], [], []];
  const cycle = createNoticeAiCycle({
    ...quiet,
    now: () => time,
    readChanges: () => batches.shift(),
    async analyze(id) {
      calls.push(id);
      if (id === '1' && calls.length === 1) throw new Error('Ollama unavailable');
    },
  });
  assert.equal((await cycle()).failed, 1);
  await cycle();
  assert.deepEqual(calls, ['1', '2', '3']);
  time = 14_999;
  await cycle();
  assert.deepEqual(calls, ['1', '2', '3']);
  time = 15_000;
  assert.equal((await cycle()).pending, 0);
  assert.deepEqual(calls, ['1', '2', '3', '1']);
});

test('a newer revision replaces the retry timer for the same notice', async () => {
  const batches = [[row('1', 'a')], [row('1', 'b', later)]];
  let calls = 0;
  const cycle = createNoticeAiCycle({
    ...quiet,
    now: () => 0,
    readChanges: () => batches.shift(),
    async analyze() {
      if (++calls === 1) throw new Error('obsolete failed job');
    },
  });
  await cycle();
  assert.equal((await cycle()).pending, 0);
  assert.equal(calls, 2);
});

test('Toronto sync is optional and a failed sync does not prevent queued analysis', async () => {
  let time = 0;
  let syncs = 0;
  let analyses = 0;
  const batches = [[row('1', 'a')], [], []];
  const cycle = createNoticeAiCycle({
    ...quiet,
    now: () => time,
    syncIntervalMs: 60_000,
    readChanges: () => batches.shift(),
    async sync() {
      syncs++;
      throw new Error('timeout');
    },
    async analyze() {
      analyses++;
    },
  });
  assert.equal((await cycle()).sourceFailed, true);
  assert.equal(analyses, 1);
  await cycle();
  assert.equal(syncs, 1);
  time = 60_000;
  await cycle();
  assert.equal(syncs, 2);
});

test('work is serial and the batch is bounded', async () => {
  let active = 0;
  const cycle = createNoticeAiCycle({
    ...quiet,
    readChanges: (() => {
      const batches = [[1, 2, 3, 4, 5].map((id) => row(String(id), String(id))), []];
      return () => batches.shift();
    })(),
    async analyze() {
      assert.equal(++active, 1);
      await Promise.resolve();
      active--;
    },
  });
  assert.equal((await cycle()).pending, 2);
  assert.equal((await cycle()).pending, 0);
});

const watchScript = fileURLToPath(new URL('../scripts/watch-notice-ai.mjs', import.meta.url));

test('one watcher cycle queries changes, calls local Ollama and publishes only AI payloads', async () => {
  const calls = [];
  const current = {
    ...row('8010', 'hash-a'),
    notice_date: null,
    payload: {
      id: '8010',
      title: 'Notice of Application for Residential Development',
      description: 'The City received an application to permit 155 residential units.',
    },
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : null;
    calls.push({ url, method: req.method, body });
    let answer = [];
    if (url.pathname.endsWith('/civic_source_notices')) {
      answer = url.searchParams.has('updated_at')
        ? [current]
        : url.searchParams.get('select') === 'source_hash'
          ? [{ source_hash: current.source_hash }]
          : [current];
    } else if (url.pathname === '/api/chat') {
      answer = {
        model: 'qwen3.5:4b',
        message: {
          content: JSON.stringify({
            whatIsHappening: 'The city received an application.',
            plainTitle: 'Residential application received',
            impacts: [],
          }),
        },
      };
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(answer));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const child = spawn(process.execPath, [watchScript, '--once'], {
      env: {
        ...process.env,
        SUPABASE_URL: base,
        SUPABASE_SECRET_KEY: 'fake-key',
        OLLAMA_BASE_URL: base,
        OLLAMA_MODEL: 'qwen3.5:4b',
      },
    });
    let output = '';
    child.stdout.on('data', (data) => (output += data));
    child.stderr.on('data', (data) => (output += data));
    const [code] = await once(child, 'close');
    assert.equal(code, 0, output);
    const read = calls[0].url.searchParams;
    assert.equal(read.get('order'), 'updated_at.asc,id.asc');
    assert.match(read.get('updated_at'), /^gt\./);
    const modelCalls = calls.filter(({ url }) => url.pathname === '/api/chat');
    assert.equal(modelCalls.length, 2);
    assert.ok(modelCalls.every(({ body }) => body.model === 'qwen3.5:4b'));
    const writes = calls.filter(
      ({ url, method }) => method !== 'GET' && url.pathname !== '/api/chat',
    );
    assert.deepEqual(
      writes.map(({ url }) => url.pathname),
      ['/rest/v1/civic_notices'],
    );
    assert.equal(writes[0].body[0].source_hash, current.source_hash);
    assert.equal(writes[0].body[0].payload.simple.impacts[0].category, 'Housing & Affordability');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
