export const TORONTO_NOTICES_URL = 'https://secure.toronto.ca/nm/notices.json';

export type TorontoNoticeAddress = {
  label: string;
  latitude: number | null;
  longitude: number | null;
};

export type TorontoNoticeEvent = {
  date: string | null;
  label: string;
};

export type TorontoNotice = {
  id: string;
  title: string;
  subheading: string;
  decisionBody: string;
  description: string;
  noticeDate: string | null;
  topics: string[];
  addresses: TorontoNoticeAddress[];
  events: TorontoNoticeEvent[];
  planningApplicationNumbers: string[];
  references: string[];
  backgroundInformation: string[];
  contact: string;
  signedBy: string;
  sourceUrl: string;
  raw: Record<string, unknown>;
};

function asText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(' · ');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const preferred = ['name', 'title', 'label', 'address', 'description', 'url', 'value'];
    for (const key of preferred) {
      if (obj[key] != null && asText(obj[key])) return asText(obj[key]);
    }
    return Object.values(obj).map(asText).filter(Boolean).join(' · ');
  }
  return '';
}

export function stripHtml(input: unknown): string {
  return asText(input)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if(obj[key]===null||obj[key]===undefined||obj[key]==='')continue;
    const n = Number(obj[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function list(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseMillisOrDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const raw = Number(value);
    const millis = raw < 10_000_000_000 ? raw * 1000 : raw;
    const d = new Date(millis);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseAddresses(value: unknown): TorontoNoticeAddress[] {
  return list(value).map((item) => {
    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const label = stripHtml(item);
    return {
      label,
      latitude: firstNumber(obj, ['latitude', 'lat', 'y', 'LATITUDE']),
      longitude: firstNumber(obj, ['longitude', 'lng', 'lon', 'x', 'LONGITUDE']),
    };
  }).filter((x) => x.label || x.latitude != null || x.longitude != null);
}

function parseEvents(value: unknown): TorontoNoticeEvent[] {
  return list(value).map((item) => {
    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const dateValue = obj.eventDate ?? obj.date ?? obj.eventTime ?? obj.time;
    return { date: parseMillisOrDate(dateValue), label: stripHtml(item) };
  }).filter((x) => x.date || x.label);
}

function textList(value: unknown): string[] {
  return list(value).map(stripHtml).filter(Boolean);
}

export function normalizeTorontoNotice(rawInput: unknown): TorontoNotice {
  const raw = (typeof rawInput === 'object' && rawInput !== null ? rawInput : {}) as Record<string, unknown>;
  const id = asText(raw.noticeId ?? raw.id);
  return {
    id,
    title: stripHtml(raw.title),
    subheading: stripHtml(raw.subheading),
    decisionBody: stripHtml(raw.decisionBody),
    description: stripHtml(raw.noticeDescription ?? raw.description),
    noticeDate: parseMillisOrDate(raw.noticeDate ?? raw.date),
    topics: textList(raw.topics),
    addresses: parseAddresses(raw.addressList ?? raw.addresses),
    events: parseEvents(raw.eventList ?? raw.events),
    planningApplicationNumbers: textList(raw.planningApplicationNumbers),
    references: textList(raw.otherReferenceList ?? raw.references),
    backgroundInformation: textList(raw.backgroundInformationList),
    contact: stripHtml(raw.contact),
    signedBy: stripHtml(raw.signedBy),
    sourceUrl: id ? `https://secure.toronto.ca/nm/api/individual/notice/${encodeURIComponent(id)}.do` : 'https://secure.toronto.ca/nm/notices/current.do',
    raw,
  };
}

function extractNoticeArray(payload:unknown):unknown[]{
 const stack=[{value:payload,depth:0}],seen=new WeakSet<object>(),result:unknown[]=[];
 let count=0;
 while(stack.length&&count++<250000){
  const {value,depth}=stack.pop()!;
  if(!value||typeof value!=='object'||seen.has(value)||depth>8)continue;
  seen.add(value);
  const record=value as Record<string,unknown>;
  if(!Array.isArray(value)&&(record.noticeId!=null||record.id!=null)&&(record.title!=null||record.noticeDescription!=null)){result.push(value);continue;}
  for(const child of Object.values(value))stack.push({value:child,depth:depth+1});
 }
 if(!result.length)throw new Error('Toronto source returned no recognizable notices');
 return result;
}

export async function fetchTorontoNotices(): Promise<TorontoNotice[]> {
  const response = await fetch(TORONTO_NOTICES_URL, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'CIVIC-Hack-2026-prototype/1.0' },
    cache: 'no-store',
    signal:AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Toronto Public Notices API returned HTTP ${response.status}`);
  const payload: unknown = await response.json();
  return extractNoticeArray(payload).map(normalizeTorontoNotice);
}
