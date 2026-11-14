#!/usr/bin/env node
// Read-only diagnostics: no sync imports, administrator keys, leases or database writes.
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { lookup } from 'node:dns/promises';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SOURCE = 'https://secure.toronto.ca/nm/notices.json';
const VOTES =
  'https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=members-of-toronto-city-council-voting-record';
const syncHeaders = { Accept: 'application/json', 'User-Agent': 'Civic-notice-sync/1.0' };
const maxBytes = 32 * 1024 * 1024;

export function jsonSummary(text) {
  const body = JSON.parse(text);
  return {
    shape: Array.isArray(body) ? 'array' : typeof body,
    records: Array.isArray(body) ? body.length : undefined,
    ckanSuccess: typeof body?.success === 'boolean' ? body.success : undefined,
    resourceCount: Array.isArray(body?.result?.resources)
      ? body.result.resources.length
      : undefined,
  };
}

export async function probeFetch(name, url, { timeoutMs, headers = {}, fetcher = fetch } = {}) {
  const started = performance.now();
  const result = {
    name,
    transport: 'Node fetch',
    timeoutMs,
    stage: 'waiting-for-headers',
    status: null,
    bytes: 0,
  };
  try {
    const response = await fetcher(url, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    result.headersMs = Math.round(performance.now() - started);
    result.status = response.status;
    result.contentType = response.headers.get('content-type');
    result.stage = 'reading-body';
    const chunks = [];
    if (response.body) {
      for await (const chunk of response.body) {
        result.bytes += chunk.byteLength;
        if (result.bytes > maxBytes) throw new Error('Response exceeded 32 MiB diagnostic limit');
        chunks.push(Buffer.from(chunk));
      }
    }
    result.bodyMs = Math.round(performance.now() - started) - result.headersMs;
    result.stage = 'parsing-json';
    const text = Buffer.concat(chunks).toString('utf8');
    try {
      result.json = jsonSummary(text);
    } catch {
      result.json = null;
    }
    result.ok = response.ok && result.json !== null;
    result.stage = 'complete';
  } catch (error) {
    result.ok = false;
    // Never serialize an error's request headers, URL, stack or environment.
    result.error = { name: error.name, code: error.cause?.code ?? error.code ?? null };
  }
  result.totalMs = Math.round(performance.now() - started);
  return result;
}

async function probeCurl(timeoutMs) {
  const folder = await mkdtemp(join(tmpdir(), 'toronto-source-diagnostic-'));
  const bodyPath = join(folder, 'response');
  const started = performance.now();
  try {
    const { code, output } = await new Promise((resolve, reject) => {
      const child = spawn(
        'curl',
        [
          '--silent',
          '--show-error',
          '--ipv4',
          '--max-time',
          String(timeoutMs / 1000),
          '--max-filesize',
          String(maxBytes),
          '--output',
          bodyPath,
          '--write-out',
          '%{json}',
          SOURCE,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let output = '';
      child.stdout.on('data', (data) => {
        output += data;
      });
      // curl stderr can echo URLs; the structured exit code is sufficient here.
      child.stderr.resume();
      child.once('error', reject);
      child.once('close', (code) => resolve({ code, output }));
    });
    const metrics = JSON.parse(output);
    let json = null;
    if (code === 0) {
      try {
        json = jsonSummary(await readFile(bodyPath, 'utf8'));
      } catch {}
    }
    return {
      name: 'source-curl-ipv4-default-headers',
      transport: 'curl',
      timeoutMs,
      ok: code === 0 && metrics.http_code >= 200 && metrics.http_code < 300 && json !== null,
      exitCode: code,
      status: metrics.http_code || null,
      bytes: metrics.size_download,
      dnsMs: Math.round(metrics.time_namelookup * 1000),
      connectMs: Math.round(metrics.time_connect * 1000),
      tlsMs: Math.round(metrics.time_appconnect * 1000),
      headersMs: Math.round(metrics.time_starttransfer * 1000),
      totalMs: Math.round(metrics.time_total * 1000),
      json,
    };
  } catch (error) {
    return {
      name: 'source-curl-ipv4-default-headers',
      ok: false,
      error: { name: error.name, code: error.code ?? null },
      totalMs: Math.round(performance.now() - started),
    };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      'timeout-seconds': { type: 'string', default: '45' },
      'long-timeout-seconds': { type: 'string' },
      report: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node --env-file=.env.local scripts/diagnose-toronto-source.mjs [--timeout-seconds=45] [--long-timeout-seconds=120] [--report=/tmp/new-report.json]',
    );
    return;
  }
  const seconds = (value) => {
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 180)
      throw new Error('Timeout must be an integer from 1 to 180 seconds');
    return Number(value) * 1000;
  };
  const timeoutMs = seconds(values['timeout-seconds']);
  const longTimeoutMs = values['long-timeout-seconds']
    ? seconds(values['long-timeout-seconds'])
    : null;
  const report = {
    startedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    proxyConfigured: Boolean(
      process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY,
    ),
    nodeEnvProxyEnabled: process.env.NODE_USE_ENV_PROXY === '1',
    source: SOURCE,
    controls: {
      votes: VOTES,
      noticeArchive: 'Supabase civic_source_notices (public read-only, limit 1)',
    },
    results: [],
  };
  try {
    report.sourceDns = await lookup(new URL(SOURCE).hostname, { all: true });
  } catch (error) {
    report.sourceDnsError = { code: error.code };
  }
  console.log(JSON.stringify({ event: 'start', ...report }));
  const finish = (result) => {
    report.results.push(result);
    console.log(JSON.stringify(result));
    return result;
  };
  const jobs = [
    probeFetch('source-current-sync-headers', SOURCE, { timeoutMs, headers: syncHeaders }).then(
      finish,
    ),
    probeFetch('source-default-fetch-headers', SOURCE, {
      timeoutMs,
      headers: { Accept: 'application/json' },
    }).then(finish),
    probeCurl(timeoutMs).then(finish),
    probeFetch('control-teammate-voting-api', VOTES, { timeoutMs }).then(finish),
  ];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Never fall back to SUPABASE_SECRET_KEY, even when available in the environment.
  if (url && key)
    jobs.push(
      probeFetch(
        'control-teammate-notice-archive',
        `${url.replace(/\/$/, '')}/rest/v1/civic_source_notices?select=id,notice_date&limit=1`,
        {
          timeoutMs,
          headers: {
            apikey: key,
            ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
          },
        },
      ).then(finish),
    );
  else
    console.log(
      JSON.stringify({
        name: 'control-teammate-notice-archive',
        skipped: 'Public read-only settings unavailable; administrator keys are never used',
      }),
    );
  await Promise.all(jobs);
  if (longTimeoutMs && !report.results.some((r) => r.name.startsWith('source-') && r.ok)) {
    await probeFetch('source-long-timeout-current-headers', SOURCE, {
      timeoutMs: longTimeoutMs,
      headers: syncHeaders,
    }).then(finish);
  }
  report.completedAt = new Date().toISOString();
  if (values.report) {
    await writeFile(values.report, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log('Diagnostic report saved. No source payloads or credentials included.');
  }
  if (!report.results.some((r) => r.name.startsWith('source-') && r.ok)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      `${error.name}: diagnostic setup failed (${error.code ?? 'invalid options or report path'})`,
    );
    process.exitCode = 1;
  });
}
