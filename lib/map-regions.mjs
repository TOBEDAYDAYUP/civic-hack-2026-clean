/** Broad, approximate Toronto districts for browsing — not official boundary polygons. */
export const MAP_REGIONS = [
  { id: 'central', name: 'Downtown & Central', center: [43.6609, -79.3832], zoom: 12 },
  { id: 'north-york', name: 'North York', center: [43.7615, -79.4111], zoom: 11 },
  { id: 'scarborough', name: 'Scarborough', center: [43.7719, -79.2577], zoom: 11 },
  { id: 'etobicoke', name: 'Etobicoke', center: [43.6592, -79.5280], zoom: 11 },
  { id: 'york', name: 'York', center: [43.6906, -79.4703], zoom: 12 },
  { id: 'east-york', name: 'East York', center: [43.6912, -79.3291], zoom: 12 },
];

const hints = [
  ['scarborough', /\b(scarborough|agincourt|malvern|rouge park|highland creek|guildwood|birch cliff|port union|woburn|cliffside|bendale)\b/i],
  ['etobicoke', /\b(etobicoke|mimico|long branch|new toronto|rexdale|humber bay|islington|the kingsway|kipling|albion road)\b/i],
  ['north-york', /\b(north york|willowdale|downsview|don mills|flemingdon park|bayview village|york mills|bathurst manor|lawrence heights|newtonbrook)\b/i],
  ['east-york', /\b(east york|leaside|thorncliffe park|woodbine heights|pape village|o['’]?connor)\b/i],
  ['york', /\b(weston|mount dennis|keelesdale|silverthorn|rockcliffe|cal edonia|york district)\b/i],
  ['central', /\b(downtown|cityplace|kensington(-chinatown| market)?|the annex|harbourfront|trinity[- ]bellwoods|liberty village|little italy|parkdale|university[- ]rosedale|regent park|cabbagetown|toronto centre)\b/i],
];

function knownRegion(id) {
  return MAP_REGIONS.find(r => r.id === id) || null;
}

/** Only explicit named-district mentions are used for approximate positions. */
export function explicitRegionFromText(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const found = hints.filter(([, pattern]) => pattern.test(value)).map(([id]) => id);
  return found.length === 1 ? knownRegion(found[0]) : null;
}

/** A rough browser filter, not an official political/administrative boundary. */
export function estimatedRegionFromCoordinates(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 43.55 || lat > 43.87 || lon < -79.66 || lon > -79.10) return null;
  if (lon > -79.30) return knownRegion('scarborough');
  if (lon < -79.49) return knownRegion('etobicoke');
  if (lat > 43.73) return knownRegion('north-york');
  if (lat > 43.673 && lon > -79.38 && lon <= -79.30) return knownRegion('east-york');
  if (lat > 43.674 && lon < -79.43) return knownRegion('york');
  return knownRegion('central');
}

export function normalizeMapEntries(notices, geocodedById={}) {
  const entries = [];
  const unknown = [];
  const seen = new Set();
  for (const notice of notices) {
    if (!notice || typeof notice.id !== 'string' || seen.has(notice.id)) continue;
    seen.add(notice.id);
    const addresses = Array.isArray(notice.addresses) ? notice.addresses : [];
    const valid = addresses.filter(a => a && Number.isFinite(Number(a.latitude)) && a.latitude != null && Number.isFinite(Number(a.longitude)) && a.longitude != null)
      .map(a => ({ ...a, latitude: Number(a.latitude), longitude: Number(a.longitude) }))
      .filter(a => estimatedRegionFromCoordinates(a.latitude, a.longitude));
    const uniqueCoordinates = [];
    const usedCoords = new Set();
    for (const a of valid) {
      const key = `${a.latitude.toFixed(6)},${a.longitude.toFixed(6)}`;
      if (!usedCoords.has(key)) {uniqueCoordinates.push(a);usedCoords.add(key);}
      if (uniqueCoordinates.length >= 8) break;
    }
    if (uniqueCoordinates.length) {
      for (const address of uniqueCoordinates) {
        const region = estimatedRegionFromCoordinates(address.latitude, address.longitude);
        if (!region) continue;
        entries.push({ id: notice.id, notice, region: region.id, regionName: region.name, latitude: address.latitude, longitude: address.longitude, approximate: false, precision: 'source', location: address.label || 'Source coordinates', locationSource: 'Coordinates provided by the source; district is a geographic estimate' });
      }
      continue;
    }
    // Street geocoding is separately verified by a server-side provider. Do not
    // copy guessed district centroids into street-level results.
    const geocoded = Array.isArray(geocodedById[notice.id]) ? geocodedById[notice.id] : [];
    const accepted = geocoded.filter(point=>point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && estimatedRegionFromCoordinates(point.latitude,point.longitude));
    if(accepted.length){
      for(const point of accepted.slice(0,8)){
        const region=estimatedRegionFromCoordinates(point.latitude,point.longitude);
        entries.push({id:notice.id,notice,region:region.id,regionName:region.name,latitude:point.latitude,longitude:point.longitude,approximate:false,precision:'geocoded',location:point.address,locationSource:'Address matched by Geoapify geocoding; not source coordinates'});
      }
      continue;
    }
    // Explicit place names only. AI-generated `simple.where` and general body text
    // are not proof a notice is located at any particular street or neighbourhood.
    const addressRegions = addresses.map(a => explicitRegionFromText(a.label)).filter(Boolean);
    const ids = [...new Set(addressRegions.map(r => r.id))];
    const fromAddress = ids.length === 1 ? knownRegion(ids[0]) : null;
    const fromTitle = ids.length === 0 ? explicitRegionFromText(notice.title) : null;
    const region = fromAddress || fromTitle;
    if (region) entries.push({ id: notice.id, notice, region: region.id, regionName: region.name, latitude: region.center[0], longitude: region.center[1], approximate: true, precision:'district', location: region.name, locationSource: fromAddress ? 'District name stated in source address data' : 'District name stated in source title' });
    else unknown.push(notice);
  }
  return { entries, unknown };
}
