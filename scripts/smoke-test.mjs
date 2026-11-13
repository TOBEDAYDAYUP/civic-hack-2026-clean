import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

// Use a free loopback port and our own production server, not somebody's dev tab.
const probe = createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NOTICE_DATA_MODE: 'local' } },
);
let logs = '';
server.stdout.on('data', (data) => (logs += data));
server.stderr.on('data', (data) => (logs += data));
const base = `http://127.0.0.1:${port}`;
async function page(route, status = 200) {
  const response = await fetch(base + route);
  assert.equal(response.status, status, `${route}: unexpected HTTP status`);
  return response.text();
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try {
      await fetch(base);
      ready = true;
      break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, `Server did not start: ${logs}`);
  const home = await page('/');
  assert.ok(home.includes('/decisions/3'), 'Home must link to the housing detail route');
  const housing = await page('/decisions/3');
  for (const text of [
    'What’s happening?',
    'What this means for you',
    'Project progress',
    'record-introduction',
    'Check the project status',
    'How to check the five development stages',
    '/?view=Decisions',
  ])
    assert.ok(housing.includes(text), `Missing housing content: ${text}`);
  for (const label of [
    'What is missing, and why?',
    'IN PLAIN ENGLISH',
    'Brief introduction',
    'Evidence first.',
    'AI-generated interpretation',
  ])
    assert.ok(!housing.includes(label), label);
  const transport = await page('/decisions/0');
  for (const text of [
    'What did Council decide?',
    'Why might it matter?',
    'What should we check next?',
    'Where can I verify this?',
  ])
    assert.ok(transport.includes(text), `Missing decision content: ${text}`);
  // Every curated record should remain reachable after reorganizing files.
  for (let id = 0; id < 14; id++) await page(`/decisions/${id}`);
  await page('/decisions/not-a-number', 404);
  await page('/decisions/999999', 404);
  await page('/notices/nonexistent-notice-smoke-test', 404);
  const response = await fetch(base + '/api/processed-notices');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.ok && Array.isArray(result.notices));
  await page('/api/notices?page=0', 400);
  await page('/api/notices?limit=49', 400);
  await page('/api/notices?q=construction');
  for (const endpoint of ['/api/sync', '/api/ai/simplify']) {
    const denied = await fetch(base + endpoint, { method: 'POST' });
    assert.equal(denied.status, 401);
  }
  console.log(
    'Smoke checks passed: home links, 14 detail pages, explanation sections, missing records, local notices API.',
  );
} finally {
  server.kill('SIGTERM');
}
