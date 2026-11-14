/**
 * Street geocoding only uses address fields from the original notice.
 * A district name, AI-generated 'where', or text found in the body is NOT a
 * defensible street coordinate. Never fallback to a street pin on failure.
 */
import { estimatedRegionFromCoordinates } from './map-regions.mjs';

const STREET_SUFFIX = String.raw`(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|lane|ln\.?|court|ct\.?|crescent|cres\.?|terrace|terr\.?|trail|place|pl\.?|parkway|pkwy\.?|way|highway|hwy\.?)`;
const ADDRESS_PATTERN = new RegExp(String.raw`^\s*(\d{1,5}[a-z]?(?:\s*[-–]\s*\d{1,5}[a-z]?)?)\s+([a-z0-9'’ .-]{2,85}\s+${STREET_SUFFIX})(?:\s+(?:east|west|north|south|e|w|n|s)\.?)?(?:\s*,.*)?\s*$`, 'i');

export function extractStreetAddress(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  // An original source may contain several addresses separated by semicolons.
  const parts = value.split(/[;|·]/).map(part=>part.trim());
  for (const part of parts) {
    const normalized = part.replace(/\s+/g,' ').replace(/\s+(?:Toronto|Ontario|Canada)\b.*$/i,'').trim();
    const match = normalized.match(ADDRESS_PATTERN);
    if (match) return normalized;
  }
  return null;
}

export function streetAddressCandidates(notice) {
  const addresses = Array.isArray(notice?.addresses) ? notice.addresses : [];
  const exactPresent = addresses.some(a=>a && a.latitude != null && a.longitude != null && estimatedRegionFromCoordinates(Number(a.latitude),Number(a.longitude)));
  if (exactPresent) return [];
  return [...new Set(addresses.map(a=>extractStreetAddress(a?.label)).filter(Boolean))].slice(0,3);
}

const normalizedNumber = s => String(s || '').replace(/\s/g,'').toLowerCase();
const houseNumber = s => /^\s*(\d{1,5}[a-z]?)(?:\s*[-–]\s*\d{1,5}[a-z]?)?\s/i.exec(s)?.[1]?.toLowerCase() || null;
const textKey = s => String(s||'').toLowerCase().replace(/\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|crescent|cres|place|pl|highway|hwy|west|east|north|south)\b/g,' ').replace(/[^a-z0-9]/g,'');

/** Accept only high-confidence, matched house-number candidates inside Toronto. */
export function validateGeocodeResult(address, result) {
  const p = result?.properties;
  if (!extractStreetAddress(address) || !p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lon))) return null;
  const latitude = Number(p.lat), longitude = Number(p.lon);
  if (!estimatedRegionFromCoordinates(latitude,longitude)) return null;
  if (p.country_code?.toLowerCase() !== 'ca') return null;
  const city = String(p.city||p.county||p.district||'');
  if (!/toronto/i.test([city,p.formatted||'',p.state||''].join(' '))) return null;
  const requestedNumber=houseNumber(address);
  if (!requestedNumber || normalizedNumber(p.housenumber) !== normalizedNumber(requestedNumber)) return null;
  if (!p.street || !textKey(address).includes(textKey(p.street)) || textKey(p.street).length<4) return null;
  if (Number(p.rank?.confidence ?? p.confidence ?? 0) < 0.8) return null;
  return {latitude,longitude,address,provider:'Geoapify',approximate:false,precision:'geocoded'};
}
