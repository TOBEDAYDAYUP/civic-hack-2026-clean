#!/usr/bin/env node
// Administrator-only local inference. Visitors only read hash-matched results.
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import {
  analyzeAgenda,
  agendaHash,
  agendaKey,
  currentAgendaAnalysis,
} from '../lib/civic-agent/agenda-analysis.mjs';
import { torontoDate } from '../lib/civic-agent/agendas.mjs';

const { values } = parseArgs({
  options: {
    watch: { type: 'boolean' },
    force: { type: 'boolean' },
    'dry-run': { type: 'boolean' },
    max: { type: 'string', default: '100' },
    'poll-seconds': { type: 'string', default: '60' },
  },
});
if (values.watch && values.force) throw new Error('Use --force for a single run only');
const max = Number(values.max),
  poll = Number(values['poll-seconds']);
if (
  !Number.isInteger(max) ||
  max < 1 ||
  max > 1000 ||
  !Number.isInteger(poll) ||
  poll < 10 ||
  poll > 3600
)
  throw new Error('Use --max=1..1000 and --poll-seconds=10..3600');
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);
const key = values['dry-run']
  ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  : process.env.SUPABASE_SECRET_KEY;
const model = process.env.OLLAMA_MODEL || 'qwen3.5:4b';
const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
if (!url || !key)
  throw new Error(
    'Configure the shared database URL and administrator key; dry-run uses a publishable key',
  );
const headers = {
  apikey: key,
  'Content-Type': 'application/json',
  ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
};
async function db(path, options = {}) {
  const response = await fetch(url + '/rest/v1/' + path, {
    ...options,
    headers: { ...headers, ...options.headers },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Agenda database HTTP ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
let stopping = false;
process.once('SIGINT', () => {
  stopping = true;
});
process.once('SIGTERM', () => {
  stopping = true;
});
async function cycle() {
  const [snapshot] = await db('civic_agenda_snapshot?select=items,collected_at&id=eq.1');
  if (!Array.isArray(snapshot?.items)) throw new Error('No valid agenda snapshot is available');
  const existing = await db(
    'civic_agenda_summaries?select=item_key,source_hash,short_title,summary&order=generated_at.desc&limit=1000',
  );
  const cached = new Map(existing.map((row) => [row.item_key, row]));
  const pending = snapshot.items
    .filter(
      (item) =>
        item.meetingDate >= torontoDate() &&
        (values.force || !currentAgendaAnalysis(item, cached.get(agendaKey(item)))),
    )
    .slice(0, max);
  console.log(
    JSON.stringify({
      queued: pending.length,
      model,
      mode: values['dry-run'] ? 'preview' : 'publish',
    }),
  );
  let saved = 0,
    failed = 0;
  for (const item of pending) {
    if (stopping) break;
    try {
      const analysis = await analyzeAgenda(item, { baseUrl, model });
      if (values['dry-run']) {
        console.log(JSON.stringify({ reference: item.reference, ...analysis }));
        continue;
      }
      // Recheck against the current snapshot after inference; never publish a result
      // for an item that changed while the local model was working.
      const [latest] = await db('civic_agenda_snapshot?select=items&id=eq.1');
      const current = latest?.items?.find((candidate) => agendaKey(candidate) === agendaKey(item));
      if (!current || agendaHash(current) !== agendaHash(item)) {
        console.log(`${item.reference}: source changed, skipped`);
        continue;
      }
      await db('civic_agenda_summaries?on_conflict=item_key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          item_key: agendaKey(item),
          source_hash: agendaHash(item),
          short_title: analysis.shortTitle,
          summary: analysis.summary,
          model,
          generated_at: new Date().toISOString(),
        }),
      });
      saved++;
      console.log(JSON.stringify({ reference: item.reference, saved: true, ...analysis }));
    } catch (error) {
      failed++;
      console.error(`${item.reference}: ${error.message}`);
    }
  }
  console.log(JSON.stringify({ saved, failed }));
  return failed;
}
try {
  do {
    try {
      const failed = await cycle();
      if (failed && !values.watch) process.exitCode = 1;
    } catch (error) {
      console.error(error.message);
      if (!values.watch) process.exitCode = 1;
    }
    if (!values.watch || stopping) break;
    // Short waits allow prompt Ctrl+C; do not kill an in-flight database write.
    for (let elapsed = 0; elapsed < poll && !stopping; elapsed++) await delay(1000);
  } while (!stopping);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
