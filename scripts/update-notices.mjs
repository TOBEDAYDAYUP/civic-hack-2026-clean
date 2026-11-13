#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';

const TORONTO = 'https://secure.toronto.ca/nm/notices.json';
const OLLAMA = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:4b';
const argLimit = Number(process.argv.find((x) => x.startsWith('--limit='))?.split('=')[1] || 3);
const limit = Number.isFinite(argLimit) ? Math.max(1, Math.min(argLimit, 20)) : 3;

const schema = {
  type: 'object',
  properties: {
    plainTitle: {type:'string'}, whatIsHappening:{type:'string'}, whyItMatters:{type:'string'},
    whoMayBeAffected:{type:'string'}, where:{type:'string'}, decisionStage:{type:'string'},
    howToParticipate:{type:'string'}, participationDeadline:{type:'string'}, uncertainty:{type:'string'}
  },
  required:['plainTitle','whatIsHappening','whyItMatters','whoMayBeAffected','where','decisionStage','howToParticipate','participationDeadline','uncertainty']
};

function stripHtml(s='') { return String(s ?? '').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim(); }
function arr(v){ return v == null ? [] : Array.isArray(v) ? v : [v]; }
function text(v){
  if (v == null) return '';
  if (typeof v === 'object') return Object.values(v).map(text).filter(Boolean).join(' · ');
  return stripHtml(v);
}
function sourceUrl(id){ return id ? `https://secure.toronto.ca/nm/api/individual/notice/${encodeURIComponent(id)}.do` : 'https://secure.toronto.ca/nm/notices/current.do'; }

const system = `You simplify City of Toronto municipal notices for residents. Use only supplied facts. Never invent or infer deadlines, impacts, locations, or decision stages. Preserve proposal/committee/Council distinctions. If missing, say "Not specified in the source." Use short sentences and common English. Return only JSON matching the schema.`;

async function simplify(record){
  const r = await fetch(`${OLLAMA}/api/chat`, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({
    model:MODEL, stream:false, think:false, format:schema, options:{temperature:0.05},
    messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(record)}]
  })});
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
  const j = await r.json();
  return JSON.parse(j.message.content);
}

console.log('Fetching Toronto Public Notices...');
const r = await fetch(TORONTO, {headers:{accept:'application/json'}});
if (!r.ok) throw new Error(`Toronto API HTTP ${r.status}`);
const payload = await r.json();
const rows = Array.isArray(payload) ? payload : (payload.notices || payload.noticeList || payload.results || payload.records || payload.data || []);
const selected = rows.slice(0, limit);
const output=[];
for (let i=0;i<selected.length;i++){
  const x=selected[i];
  const id=String(x.noticeId ?? x.id ?? '');
  const normalized={
    id,
    title:stripHtml(x.title),
    decisionBody:stripHtml(x.decisionBody),
    description:stripHtml(x.noticeDescription ?? x.description),
    noticeDate:x.noticeDate ?? x.date ?? null,
    topics:arr(x.topics).map(text).filter(Boolean),
    addresses:arr(x.addressList ?? x.addresses).map(text).filter(Boolean),
    events:arr(x.eventList ?? x.events).map(text).filter(Boolean),
    references:arr(x.otherReferenceList ?? x.references).map(text).filter(Boolean),
    sourceUrl:sourceUrl(id)
  };
  console.log(`[${i+1}/${selected.length}] ${normalized.title || id}`);
  const simple=await simplify(normalized);
  output.push({...normalized, simple, generatedBy:MODEL, generatedAt:new Date().toISOString()});
}
await mkdir(new URL('../data/', import.meta.url), {recursive:true});
await writeFile(new URL('../data/generated-notices.json', import.meta.url), JSON.stringify(output,null,2)+'\n');
console.log(`Saved ${output.length} simplified notices to data/generated-notices.json`);
