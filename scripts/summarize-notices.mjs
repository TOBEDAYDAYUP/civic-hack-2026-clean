#!/usr/bin/env node
/**
 * Admin-only: take unchanged official source records from Supabase, summarize
 * locally with the project's EXISTING Ollama model and publish hash-matched AI
 * content to the existing civic_notices table. No migration or cron needed.
 */
import { filterSupportedImpacts, IMPACT_ANALYSIS_VERSION } from '../lib/impact-analysis.mjs';
import { analyzeNoticeWithOllama } from '../lib/impact-ollama.mjs';

const SUPABASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);
const dryRun = process.argv.includes('--dry-run');
const KEY =
  process.env.SUPABASE_SECRET_KEY ||
  (dryRun ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : '') ||
  '';
const OLLAMA = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:4b';
const count = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 3);
const limit = Number.isInteger(count) ? Math.max(1, Math.min(count, 10)) : 3;
const force = process.argv.includes('--force');
const all = process.argv.includes('--all');
const maxArg = process.argv.find((arg) => arg.startsWith('--max='));
const max = maxArg ? Number(maxArg.slice(6)) : Infinity;
if (maxArg && (!Number.isInteger(max) || max < 1 || max > 10000)) {
  console.error('--max must be an integer between 1 and 10000');
  process.exit(1);
}
const requestedId = process.argv.find((arg) => arg.startsWith('--id='))?.slice(5) || '';
if (all && requestedId) {
  console.error('Use --all or --id=<id>, not both.');
  process.exit(1);
}
if (requestedId && !/^[\w-]{1,128}$/.test(requestedId)) {
  console.error('Invalid notice ID: expected the ID from /notices/<id>');
  process.exit(1);
}

if (!SUPABASE || !KEY) {
  console.error(
    dryRun
      ? 'Configure the shared URL and a publishable or administrator key to preview.'
      : 'Administrator setup needed: configure SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.',
  );
  process.exit(1);
}

const headers = {
  apikey: KEY,
  ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}),
  'Content-Type': 'application/json',
};

async function database(path, options = {}) {
  const response = await fetch(`${SUPABASE}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
    signal: AbortSignal.timeout(30000),
    cache: 'no-store',
  });
  if (!response.ok)
    throw new Error(`Supabase returned HTTP ${response.status} for ${path.split('?')[0]}`);
  const data = await response.text();
  return data ? JSON.parse(data) : null;
}

async function simplify(source) {
  return analyzeNoticeWithOllama(source, {
    model: MODEL,
    baseUrl: OLLAMA,
    log: (message) => console.log('  ' + message),
  });
}

/** Iterate the whole source table, not just the 3 newest notices.
 * --max=10 processes ten NEW/legacy notices each run. Rerunning progresses
 * through the archive because current records are skipped based on source hash.
 * This never writes to official source records.
 */
async function* sourceRecords() {
  if (requestedId) {
    const rows = await database(
      `civic_source_notices?select=id,source_hash,notice_date,payload&id=eq.${encodeURIComponent(requestedId)}&limit=1`,
    );
    for (const row of rows || []) yield row;
    return;
  }
  if (!all) {
    const rows = await database(
      `civic_source_notices?select=id,source_hash,notice_date,payload&order=notice_date.desc.nullslast,id.desc&limit=${limit}`,
    );
    for (const row of rows || []) yield row;
    return;
  }
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const rows = await database(
      `civic_source_notices?select=id,source_hash,notice_date,payload&order=notice_date.desc.nullslast,id.desc&limit=${pageSize}&offset=${offset}`,
    );
    if (!Array.isArray(rows) || rows.length === 0) break;
    console.log(`Checking source records ${offset + 1}–${offset + rows.length}…`);
    for (const row of rows) yield row;
    if (rows.length < pageSize) break;
  }
}

let published = 0;
let skipped = 0;
let attempted = 0;
let seen = 0;
for await (const row of sourceRecords()) {
  seen++;
  const encoded = encodeURIComponent(row.id);
  try {
    // Even with --force, read the previous result. Qwen may return an empty
    // impacts array on a repeat run; do not discard source-verified impacts
    // from this SAME source revision due to model variability.
    const current = await database(
      `civic_notices?select=source_hash,payload&id=eq.${encoded}&limit=1`,
    );
    const previous = current?.[0];
    if (
      !force &&
      previous?.source_hash === row.source_hash &&
      previous.payload?.analysisVersion === IMPACT_ANALYSIS_VERSION
    ) {
      console.log(`Skipping already analyzed notice ${row.id}`);
      skipped++;
      continue;
    }
    attempted++;
    const { result, diagnostics, model } = await simplify(row.payload);
    const sameSource = previous?.source_hash === row.source_hash;
    const priorImpacts =
      sameSource &&
      ['impact-v4', IMPACT_ANALYSIS_VERSION].includes(previous.payload?.analysisVersion)
        ? filterSupportedImpacts(previous.payload?.simple?.impacts, row.payload)
        : [];
    const existingCategories = new Set(result.impacts.map((impact) => impact.category));
    const missingPriorImpacts = priorImpacts.filter(
      (impact) => !existingCategories.has(impact.category),
    );
    if (missingPriorImpacts.length) {
      // Source hash matches, so previously verified citations still refer to
      // exactly the same official record. Retain them rather than replacing
      // them with a random sparse model answer.
      result.impacts = filterSupportedImpacts(
        [...result.impacts, ...missingPriorImpacts],
        row.payload,
      );
      console.log(
        `  Kept ${missingPriorImpacts.length} previously verified category/categories from the same source revision`,
      );
    }
    console.log(
      `[${row.id}] ${result.plainTitle} | ${result.keyPoints.length} key points | ${result.impacts.length} supported impact categories`,
    );
    console.log(
      `  Qwen first pass: ${diagnostics.originalCandidates} candidates / ${diagnostics.primaryVerified} verified; second pass: ${diagnostics.recovered}; conservative fallback: ${diagnostics.fallback ? 'yes' : 'no'}`,
    );
    if (result.impacts.length === 0) {
      console.log('  No supportable impacts found. No category will be invented for display.');
    }
    if (dryRun) {
      console.log(
        JSON.stringify({ keyPoints: result.keyPoints, impacts: result.impacts }, null, 2),
      );
      continue;
    }
    const fresh = await database(
      `civic_source_notices?select=source_hash&id=eq.${encoded}&limit=1`,
    );
    if (fresh?.[0]?.source_hash !== row.source_hash) {
      console.log(`Skipping notice ${row.id}: the official source changed during analysis`);
      skipped++;
      continue;
    }
    const priorSimple = sameSource ? previous.payload?.simple : undefined;
    const generatedAt = new Date().toISOString();
    await database('civic_notices?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([
        {
          id: row.id,
          notice_date: row.notice_date,
          source_hash: row.source_hash,
          payload: {
            ...(sameSource ? previous.payload : {}),
            ...row.payload,
            simple: priorSimple ? { ...result, ...priorSimple, impacts: result.impacts } : result,
            generatedBy: priorSimple ? previous.payload.generatedBy || model : model,
            generatedAt: priorSimple ? previous.payload.generatedAt || generatedAt : generatedAt,
            impactGeneratedBy: model,
            impactGeneratedAt: generatedAt,
            analysisVersion: IMPACT_ANALYSIS_VERSION,
          },
        },
      ]),
    });
    published++;
  } catch (error) {
    console.error(
      `Could not analyze notice ${row.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    // A failed AI call must never replace the original source or an existing summary.
    process.exitCode = 1;
  }
  if (attempted >= max) {
    console.log(`Reached --max=${max}. Rerun without --force to continue with other records.`);
    break;
  }
}
console.log(
  `Done: examined ${seen}, attempted ${attempted}, published ${published}, skipped ${skipped}${dryRun ? ' (dry run, no database writes)' : ''}.`,
);
if (requestedId && !seen) process.exitCode = 1;
