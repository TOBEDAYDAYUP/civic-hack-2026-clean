import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeFetch, jsonSummary } from '../scripts/diagnose-toronto-source.mjs';

// Keep timeout tests alive: AbortSignal.timeout intentionally uses unref timers.
async function keepAlive(job) {
  const timer = setInterval(() => {}, 1000);
  try {
    return await job();
  } finally {
    clearInterval(timer);
  }
}

test('successful diagnostics return counts without credentials or source payloads', async () => {
  const result = await probeFetch('control', 'https://example.test', {
    timeoutMs: 1000,
    headers: { apikey: 'private-header-value' },
    fetcher: async () =>
      Response.json([{ id: 'unreported-notice', contact: 'unreported-contact' }]),
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.json.records, 1);
  assert.ok(
    !/private-header-value|unreported-notice|unreported-contact/.test(JSON.stringify(result)),
  );
});

test('HTTP rejection is retained and never reported as success', async () => {
  const result = await probeFetch('source', 'https://example.test', {
    timeoutMs: 1000,
    fetcher: async () => new Response('<h1>Denied</h1>', { status: 403 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.json, null);
});

test('timeouts before response headers identify the waiting phase', async () => {
  const result = await keepAlive(() =>
    probeFetch('source', 'https://example.test', {
      timeoutMs: 15,
      fetcher: async (_, { signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
        ),
    }),
  );
  assert.equal(result.stage, 'waiting-for-headers');
  assert.equal(result.error.name, 'TimeoutError');
  assert.equal(result.status, null);
});

test('timeouts during a stalled body retain HTTP status and reading phase', async () => {
  const result = await keepAlive(() =>
    probeFetch('source', 'https://example.test', {
      timeoutMs: 15,
      fetcher: async (_, { signal }) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('['));
              signal.addEventListener('abort', () => controller.error(signal.reason), {
                once: true,
              });
            },
          }),
        ),
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.status, 200);
  assert.equal(result.stage, 'reading-body');
  assert.equal(result.error.name, 'TimeoutError');
});

test('a 200 HTML response is not mistaken for valid source JSON', async () => {
  const result = await probeFetch('source', 'https://example.test', {
    timeoutMs: 1000,
    fetcher: async () => new Response('<html>maintenance</html>'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 200);
});

test('CKAN summaries distinguish dataset metadata from notice records', () => {
  assert.deepEqual(jsonSummary('{"success":true,"result":{"resources":[{},{}]}}'), {
    shape: 'object',
    records: undefined,
    ckanSuccess: true,
    resourceCount: 2,
  });
});
