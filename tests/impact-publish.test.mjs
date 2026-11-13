import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/summarize-notices.mjs', import.meta.url));
const row = {
  id: '8006',
  source_hash: 'current-source-hash',
  notice_date: null,
  payload: {
    title: 'Notice of Application for Residential Development',
    description: 'The City received a proposal for 155 residential units.',
  },
};
const result = { plainTitle: 'New title', whatIsHappening: 'New summary', impacts: [] };
const previous = {
  source_hash: row.source_hash,
  payload: {
    analysisVersion: 'impact-v3',
    generatedBy: 'previous-model',
    simple: { plainTitle: 'Existing title', whatIsHappening: 'Existing summary' },
  },
};

async function run({ dry = false, changed = false, skip = false } = {}) {
  const writes = [];
  let chatCalls = 0;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let answer;
    if (url.pathname === '/api/chat') {
      chatCalls++;
      answer = { model: 'qwen-test', message: { content: JSON.stringify(result) } };
    } else if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      writes.push({ path: url.pathname, body: JSON.parse(body), key: req.headers.apikey });
      answer = null;
    } else if (url.pathname.endsWith('/civic_source_notices')) {
      answer =
        url.searchParams.get('select') === 'source_hash'
          ? [{ source_hash: changed ? 'new-source-hash' : row.source_hash }]
          : [row];
    } else {
      answer = skip
        ? [{ ...previous, payload: { ...previous.payload, analysisVersion: 'impact-v5' } }]
        : [previous];
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(answer));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const args = ['--id=8006', ...(dry ? ['--dry-run'] : [])];
    const child = spawn(process.execPath, [script, ...args], {
      env: {
        ...process.env,
        SUPABASE_URL: baseUrl,
        OLLAMA_BASE_URL: baseUrl,
        SUPABASE_SECRET_KEY: dry ? '' : 'test-admin',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-public',
      },
    });
    let output = '';
    child.stdout.on('data', (data) => (output += data));
    child.stderr.on('data', (data) => (output += data));
    const [code] = await once(child, 'close');
    assert.equal(code, 0, output);
    return { output, writes, chatCalls };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('preview can use a public key and never writes', async () => {
  const outcome = await run({ dry: true });
  assert.equal(outcome.chatCalls, 2);
  assert.deepEqual(outcome.writes, []);
  assert.match(outcome.output, /dry run, no database writes/);
});

test('administrator publishes only to the existing AI table without replacing existing summary fields', async () => {
  const outcome = await run();
  assert.equal(outcome.writes.length, 1);
  const [
    {
      path,
      body: [stored],
      key,
    },
  ] = outcome.writes;
  assert.equal(path, '/rest/v1/civic_notices');
  assert.equal(key, 'test-admin');
  assert.equal(stored.source_hash, row.source_hash);
  assert.equal(stored.payload.analysisVersion, 'impact-v5');
  assert.equal(stored.payload.generatedBy, 'previous-model');
  assert.equal(stored.payload.impactGeneratedBy, 'qwen-test');
  assert.equal(stored.payload.simple.plainTitle, 'Existing title');
  assert.equal(stored.payload.simple.whatIsHappening, 'Existing summary');
  assert.equal(stored.payload.simple.impacts[0].category, 'Housing & Affordability');
});

test('administrator skips writes when the official source changes during inference', async () => {
  const outcome = await run({ changed: true });
  assert.deepEqual(outcome.writes, []);
  assert.match(outcome.output, /official source changed/);
});

test('the current source revision and analysis version are not processed twice', async () => {
  const outcome = await run({ skip: true });
  assert.equal(outcome.chatCalls, 0);
  assert.deepEqual(outcome.writes, []);
});
