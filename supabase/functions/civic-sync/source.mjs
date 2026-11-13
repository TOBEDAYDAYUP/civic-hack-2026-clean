const stripHtml = value => String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];
const toIsoDate = value => {
  if (value == null || value === '') return null;
  const n = Number(value);
  const date = Number.isFinite(n) && String(value).trim() !== ''
    ? new Date(n < 1e10 ? n * 1000 : n) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const coordinate = value => value === null || value === undefined || value === '' ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const asText = value => value == null ? '' : typeof value === 'object' ? Object.values(value).map(asText).filter(Boolean).join(' · ') : stripHtml(value);
const asList = value => arr(value).map(asText).filter(Boolean);
function sourceLink(id) {
  return id ? `https://secure.toronto.ca/nm/api/individual/notice/${encodeURIComponent(id)}.do` : 'https://secure.toronto.ca/nm/notices/current.do';
}
export function normalize(x) {
  const id = String(x.noticeId ?? x.id ?? '');
  return {
    id,
    title: stripHtml(x.title),
    subheading: stripHtml(x.subheading),
    decisionBody: stripHtml(x.decisionBody),
    description: stripHtml(x.noticeDescription ?? x.description),
    noticeDate: toIsoDate(x.noticeDate ?? x.date),
    topics: asList(x.topics),
    addresses: arr(x.addressList ?? x.addresses).map(a => {
      if (!a || typeof a !== 'object') return {label: asText(a), latitude: null, longitude: null};
      const latitude = coordinate(a.latitude ?? a.lat ?? a.y);
      const longitude = coordinate(a.longitude ?? a.lng ?? a.lon ?? a.x);
      return {
        label: asText(a),
        latitude,
        longitude,
      };
    }),
    events: asList(x.eventList ?? x.events),
    planningApplicationNumbers: asList(x.planningApplicationNumbers),
    references: asList(x.otherReferenceList ?? x.references),
    backgroundInformation: asList(x.backgroundInformationList),
    contact: asText(x.contact),
    signedBy: asText(x.signedBy),
    sourceUrl: sourceLink(id),
  };
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
export async function hash(source) {
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(source))));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}

export function extractNotices(root) {
  const stack = [{value:root,depth:0}];
  const seenObjects = new WeakSet();
  const matches = [];
  let visited = 0;
  while (stack.length && visited++ < 250000) {
    const {value,depth} = stack.pop();
    if (value === null || typeof value !== 'object' || seenObjects.has(value) || depth > 8) continue;
    seenObjects.add(value);
    if (!Array.isArray(value) &&
        (value.noticeId !== undefined || value.id !== undefined) &&
        (value.title !== undefined || value.noticeDescription !== undefined)) {
      matches.push(value);
      continue;
    }
    const nested = Array.isArray(value) ? value : Object.values(value);
    for (const child of nested) {
      if (child !== null && typeof child === 'object') stack.push({value:child,depth:depth+1});
    }
  }
  return matches;
}
export async function prepareRecords(json) {
 const unique=new Map();
 for(const raw of extractNotices(json)) {
  const source=normalize(raw);
  if(source.id && source.title && !unique.has(source.id))unique.set(source.id,source);
 }
 if(!unique.size)throw new Error('Source returned no recognizable notices; existing data preserved');
 if(unique.size>20000)throw new Error('Source batch exceeds safe limit');
 return Promise.all([...unique.values()].map(async payload=>({id:payload.id,notice_date:payload.noticeDate,source_hash:await hash(payload),payload})));
}
