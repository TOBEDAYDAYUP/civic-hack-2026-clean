#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { IMPACT_ANALYSIS_VERSION } from '../lib/impact-analysis.mjs';
import { analyzeNoticeWithOllama } from '../lib/impact-ollama.mjs';
import { extractNotices, normalize } from '../supabase/functions/civic-sync/source.mjs';

const TORONTO = 'https://secure.toronto.ca/nm/notices.json';
const argLimit = Number(process.argv.find((x) => x.startsWith('--limit='))?.split('=')[1] || 3);
const limit = Number.isFinite(argLimit) ? Math.max(1, Math.min(argLimit, 20)) : 3;

console.log('Fetching Toronto Public Notices...');
const response = await fetch(TORONTO, { headers: { accept: 'application/json' } });
if (!response.ok) throw new Error(`Toronto API HTTP ${response.status}`);
const selected = extractNotices(await response.json())
  .map(normalize)
  .filter((notice) => notice.id && notice.title)
  .slice(0, limit);
if (!selected.length)
  throw new Error('No recognizable Toronto notices. Local data was not changed.');
const output = [];
for (const [i, notice] of selected.entries()) {
  console.log(`[${i + 1}/${selected.length}] ${notice.title}`);
  const { model, result } = await analyzeNoticeWithOllama(notice);
  output.push({
    ...notice,
    simple: result,
    generatedBy: model,
    generatedAt: new Date().toISOString(),
    analysisVersion: IMPACT_ANALYSIS_VERSION,
  });
}
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../data/generated-notices.json', import.meta.url),
  JSON.stringify(output, null, 2) + '\n',
);
console.log(`Saved ${output.length} simplified notices to data/generated-notices.json`);
