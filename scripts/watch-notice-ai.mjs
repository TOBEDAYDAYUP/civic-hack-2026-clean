#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createNoticeAiCycle } from '../lib/notice-ai-worker.mjs';
import { syncSource } from '../lib/sync/source-sync.mjs';

const publisher = fileURLToPath(new URL('./summarize-notices.mjs', import.meta.url));
const sourceId = /^[\w-]{1,128}$/;
// PostgREST timestamps can have microseconds. Keep the exact value for keyset pagination.
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function integerOption(value, name, min, max) {
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max)
    throw new Error(`--${name} must be an integer from ${min} to ${max}.`);
  return Number(value);
}

async function main() {
  const { values: options } = parseArgs({
    options: {
      'sync-source': { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      once: { type: 'boolean' },
      help: { type: 'boolean' },
      'since-minutes': { type: 'string', default: '5' },
      'poll-seconds': { type: 'string', default: '30' },
      'sync-minutes': { type: 'string', default: '15' },
    },
  });
  if (options.help) {
    console.log(
      'Usage: npm run data:watch -- [--sync-source] [--since-minutes=5] [--poll-seconds=30] [--sync-minutes=15] [--once] [--dry-run]',
    );
    return;
  }
  const dryRun = options['dry-run'];
  if (dryRun && options['sync-source'])
    throw new Error(
      '--dry-run cannot be combined with --sync-source because source sync writes to Supabase.',
    );
  const lookback = integerOption(options['since-minutes'], 'since-minutes', 0, 10080);
  const pollMs = integerOption(options['poll-seconds'], 'poll-seconds', 1, 3600) * 1000;
  const syncMs = integerOption(options['sync-minutes'], 'sync-minutes', 1, 1440) * 60_000;
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
    /\/$/,
    '',
  );
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    (dryRun ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : '');
  if (!url || !key)
    throw new Error(
      dryRun
        ? 'Set the Supabase URL and a publishable key for a preview.'
        : 'Set SUPABASE_SECRET_KEY and the Supabase URL in the administrator .env.local.',
    );
  const controller = new AbortController();
  const { signal } = controller;
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  const since = new Date(Date.now() - lookback * 60_000).toISOString();
  console.log(
    `Watching source revisions after ${since}; local model: ${process.env.OLLAMA_MODEL || 'qwen3.5:4b'}.`,
  );
  console.log(
    options['sync-source']
      ? `Toronto source sync is enabled every ${syncMs / 60_000} min.`
      : 'Toronto source sync is off. The worker processes changes already synced to Supabase.',
  );
  if (dryRun) console.log('Dry run: no database writes.');

  const cycle = createNoticeAiCycle({
    since,
    signal,
    syncIntervalMs: syncMs,
    sync: options['sync-source'] ? () => syncSource({ url, key }) : undefined,
    async readChanges({ updatedAt, id }, limit) {
      const params = new URLSearchParams({
        select: 'id,source_hash,updated_at',
        order: 'updated_at.asc,id.asc',
        limit: String(limit),
      });
      if (id) {
        params.set(
          'or',
          `(updated_at.gt.${updatedAt},and(updated_at.eq.${updatedAt},id.gt.${id}))`,
        );
      } else {
        params.set('updated_at', `gt.${updatedAt}`);
      }
      const response = await fetch(`${url}/rest/v1/civic_source_notices?${params}`, {
        headers: {
          apikey: key,
          ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
        },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
      const rows = await response.json();
      if (
        !Array.isArray(rows) ||
        rows.some(
          (row) =>
            !sourceId.test(row?.id ?? '') ||
            !timestamp.test(row?.updated_at ?? '') ||
            !row?.source_hash,
        )
      ) {
        throw new Error('Supabase returned an invalid source revision.');
      }
      return rows;
    },
    async analyze(id) {
      await new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [publisher, `--id=${id}`, ...(dryRun ? ['--dry-run'] : [])],
          {
            stdio: 'inherit',
            signal,
          },
        );
        child.once('error', reject);
        child.once('close', (code) =>
          code === 0 ? resolve() : reject(new Error(`analysis exited with status ${code}`)),
        );
      });
    },
  });

  try {
    while (!signal.aborted) {
      const result = await cycle();
      if (options.once) {
        if (result?.failed || result?.sourceFailed) process.exitCode = 1;
        break;
      }
      if (!signal.aborted) await delay(pollMs, undefined, { signal });
    }
  } catch (error) {
    if (!signal.aborted) throw error;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
