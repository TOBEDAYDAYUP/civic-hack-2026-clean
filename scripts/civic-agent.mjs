import { writeFile } from 'node:fs/promises';
import { buildPreview, digest, normalizeNotice, normalizeVote } from '../lib/civic-agent/model.mjs';

const ckanOrigin = 'https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/';
const voteDataset = 'members-of-toronto-city-council-voting-record';

function parseArguments(args) {
  const options = { source: 'all', write: false };
  for (const arg of args) {
    if (arg === '--write') options.write = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--source=')) options.source = arg.slice('--source='.length);
    else if (arg.startsWith('--report=')) options.report = arg.slice('--report='.length);
    else throw new Error('Unknown argument: ' + arg);
  }
  if (!['all', 'notices', 'votes'].includes(options.source)) {
    throw new Error('--source must be all, notices, or votes');
  }
  if (options.report === '' || (options.write && options.report)) {
    throw new Error('--report requires a path and can only be used for a dry run');
  }
  return options;
}

function databaseConfig(write) {
  const project = write ? process.env.SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = write
    ? process.env.SUPABASE_SECRET_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!project || !key) {
    throw new Error(
      write
        ? 'Set SUPABASE_URL and SUPABASE_SECRET_KEY for the write target'
        : 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for notices',
    );
  }
  const url = new URL(project);
  if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS');
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  return { url, headers };
}

async function getJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(url.hostname + ' returned HTTP ' + response.status);
  return response.json();
}

async function ckan(action, params) {
  const url = new URL(action, ckanOrigin);
  url.search = new URLSearchParams(params);
  const body = await getJson(url);
  if (!body.success || !body.result) throw new Error('Invalid Toronto Open Data response');
  return body.result;
}

async function getNotices(database) {
  const records = [];
  let lastId;
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const url = new URL('/rest/v1/civic_source_notices', database.url);
    url.search = new URLSearchParams({
      select: 'id,notice_date,payload',
      order: 'id.asc',
      limit: '1000',
    });
    if (lastId !== undefined) url.searchParams.set('id', 'gt.' + lastId);
    const page = await getJson(url, { headers: database.headers });
    if (!Array.isArray(page)) throw new Error('Invalid notice response');
    if (!page.length) return records;
    records.push(...page.map(normalizeNotice));
    const nextId = page.at(-1).id;
    if (nextId === lastId) throw new Error('Notice pagination did not advance');
    lastId = nextId;
  }
  throw new Error('Notice page limit reached');
}

async function getVotes() {
  const dataset = await ckan('package_show', { id: voteDataset });
  const resources = (dataset.resources || []).filter(
    (resource) =>
      resource.datastore_active && /^member-voting-record-\d{4}-\d{4}$/.test(resource.name),
  );
  resources.sort((a, b) => b.name.localeCompare(a.name));
  const resource = resources[0];
  if (!resource?.id) throw new Error('No active voting resource');
  const data = await ckan('datastore_search', {
    resource_id: resource.id,
    limit: '100',
    sort: '_id desc',
  });
  if (!Array.isArray(data.records)) throw new Error('Invalid voting records');
  return data.records.map((row) => normalizeVote(row, resource.id));
}

async function saveRecords(database, records) {
  const url = new URL('/rest/v1/rpc/agent_ingest_source_batch', database.url);
  for (let start = 0; start < records.length; start += 500) {
    const batch = records.slice(start, start + 500);
    const count = await getJson(url, {
      method: 'POST',
      headers: database.headers,
      body: JSON.stringify({ records: batch }),
    });
    if (count !== batch.length) {
      throw new Error('Unexpected saved record count at batch starting at ' + start);
    }
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(
      'Usage: node scripts/civic-agent.mjs [--source=all|notices|votes] [--report=PATH | --write]',
    );
    return;
  }

  const writeDatabase = options.write ? databaseConfig(true) : null;
  const collectors = {
    notices: () => getNotices(databaseConfig(false)),
    votes: getVotes,
  };
  const sources = [];
  for (const [name, collect] of Object.entries(collectors)) {
    if (options.source !== 'all' && options.source !== name) continue;
    try {
      const records = (await collect()).map((record) => ({
        ...record,
        content_hash: digest(record),
      }));
      if (!records.length) throw new Error('No records found');
      if (writeDatabase) await saveRecords(writeDatabase, records);
      sources.push({ name, records });
      console.log(
        name + ': ' + records.length + (options.write ? ' records saved' : ' records validated'),
      );
    } catch (error) {
      sources.push({ name, error: error.message });
      console.error(name + ': ' + error.message);
      process.exitCode = 1;
    }
  }

  if (!options.write) {
    const preview = buildPreview(sources);
    console.log(preview.issues.length + ' agenda items pending review');
    if (options.report) {
      await writeFile(options.report, JSON.stringify(preview, null, 2) + '\n', { flag: 'wx' });
      console.log('Preview saved to ' + options.report);
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
