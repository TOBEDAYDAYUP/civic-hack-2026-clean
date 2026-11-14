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
  assert.ok(home.includes('Your city.'), 'Home should render the consolidated public-notice page');
  assert.ok(home.includes('Search public notices'), 'Home should render notice browsing controls');
  assert.ok(home.includes('Transportation'), 'Category filter options should render');
  assert.ok(!home.includes('Selected Council decisions'), 'Curated static archive must not appear');
  assert.ok(home.includes('Decisions'), 'Restored archive navigation should render');
  for (let id = 0; id < 14; id++) {
    const detail = await page(`/decisions/${id}`);
    assert.ok(
      detail.includes('Static curated summary'),
      'Archive details must disclose static data',
    );
    assert.ok(detail.includes('All decisions'), 'Archive details must link back to the library');
    assert.ok(
      detail.includes('What should we check next?') || detail.includes('housing'),
      'Structured detail sections should render',
    );
  }
  const monthOnly = await page('/decisions/11');
  assert.ok(
    monthOnly.includes('JUN 2024') && !monthOnly.includes('Jun 1, 2024'),
    'Archive display must preserve month-only date precision',
  );
  const renter = await page('/decisions/10');
  assert.ok(
    renter.includes('What properties and types of renovation are covered?'),
    'Housing details must retain record-specific follow-up questions',
  );
  await page('/decisions/999', 404);
  await page('/decisions/not-a-number', 404);
  await page('/notices/nonexistent-notice-smoke-test', 404);
  const response = await fetch(base + '/api/processed-notices');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.ok && Array.isArray(result.notices));
  await page('/api/notices?page=0', 400);
  await page('/api/notices?limit=49', 400);
  await page('/api/notices?q=construction');
  await page('/api/notices?category=housing&sort=oldest&q=Toronto');
  await page('/api/notices?category=other');
  await page('/api/notices?savedOnly=1');
  await page('/api/notices?sort=reverse', 400);
  await page('/api/notices?category=does-not-exist', 400);

  await page('/api/map/notices');
  await page('/api/map/geocode');
  for (const endpoint of ['/api/sync', '/api/ai/simplify']) {
    const denied = await fetch(base + endpoint, { method: 'POST' });
    assert.equal(denied.status, 401);
  }
  console.log(
    'Smoke checks passed: consolidated Home, all 14 curated detail routes, filtered notice API and safe local-mode defaults.',
  );
} finally {
  server.kill('SIGTERM');
}
