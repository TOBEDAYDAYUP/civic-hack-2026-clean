import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { streetAddressCandidates } from './map-geocode.mjs';
import { estimatedRegionFromCoordinates } from './map-regions.mjs';
const maxAge = 14 * 24 * 60 * 60 * 1000;
const filename = directory => path.join(directory, 'data', '.street-geocodes.json');
let writes = Promise.resolve();
export async function readStreetCache(directory = process.cwd()) {
  try { const data = JSON.parse(await readFile(filename(directory), 'utf8')); return data && typeof data === 'object' && !Array.isArray(data) ? data : {}; }
  catch { return {}; }
}
export function cachedStreetPoints(notice, cache) {
  const addresses = streetAddressCandidates(notice);
  const record = cache[notice.id];
  if (!record || record.sourceKey !== addresses.join('|') || !Number.isFinite(record.timestamp) || Date.now() - record.timestamp > maxAge || record.timestamp > Date.now() || !Array.isArray(record.points)) return [];
  return record.points.filter(p => p && p.precision === 'geocoded' && p.provider === 'Geoapify' && p.approximate === false && addresses.includes(p.address) && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && estimatedRegionFromCoordinates(p.latitude,p.longitude));
}
export function saveStreetPoints(notice, points, directory = process.cwd()) {
  const job = writes.then(async () => {
    const cache = await readStreetCache(directory);
    cache[notice.id] = { sourceKey: streetAddressCandidates(notice).join('|'), timestamp: Date.now(), points };
    const recent = Object.fromEntries(Object.entries(cache).filter(([,r])=>Date.now()-r.timestamp<maxAge).sort((a,b)=>a[1].timestamp-b[1].timestamp).slice(-2000));
    await mkdir(path.dirname(filename(directory)), {recursive:true});
    const temporary = filename(directory)+'.'+randomUUID()+'.tmp';
    await writeFile(temporary,JSON.stringify(recent),{mode:0o600});
    await rename(temporary,filename(directory));
  });
  writes=job.catch(()=>{});
  return job;
}
