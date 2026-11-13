import {addressLabel} from './address-label.mjs';
// Public, read-only notice archive. The database view joins raw official data
// with AI summaries only when their source hashes are still identical.
export type PublicNotice = {
  id: string;
  title: string;
  displayTitle?: string;
  description?: string;
  noticeDate?: string | null;
  topics?: string[];
  addresses?: {label:string;latitude:number|null;longitude:number|null}[];
  sourceUrl?: string;
  planningApplicationNumbers?: string[];
  generatedBy?: string;
  generatedAt?: string;
  simple?: {
    plainTitle:string;
    whatIsHappening:string;
    whyItMatters:string;
    whoMayBeAffected:string;
    where:string;
    decisionStage:string;
    howToParticipate:string;
    participationDeadline:string;
    uncertainty:string;
  };
};
type Row = { id:string; payload:PublicNotice; ai_ready:boolean; notice_date:string|null };
import {publicDataConfig} from '@/lib/supabase/config';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const {url:projectUrl,key:apiKey}=publicDataConfig;
export const localMode=()=>process.env.NOTICE_DATA_MODE==='local';
async function localNotices():Promise<PublicNotice[]> {
 const parsed=JSON.parse(await readFile(path.join(process.cwd(),'data/generated-notices.json'),'utf8'));
 return Array.isArray(parsed)?parsed:[];
}

async function queryView(params:URLSearchParams, count=false) {
  const response = await fetch(`${projectUrl}/rest/v1/civic_notice_feed?${params.toString()}`, {
    headers: {
      apikey: apiKey,
      ...(apiKey.startsWith('eyJ') ? {Authorization:`Bearer ${apiKey}`} : {}),
      ...(count ? {Prefer:'count=exact'} : {}),
    },
    cache:'no-store',
    signal:AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Public notices unavailable: HTTP ${response.status}`);
  const records = await response.json() as Row[];
  for(const row of records){row.payload={...row.payload,addresses:row.payload.addresses?.map(a=>({...a,label:addressLabel(a.label)}))};}
  const range = response.headers.get('content-range') || '';
  const countText = range.split('/')[1];
  const total = countText && /^\d+$/.test(countText) ? Number(countText) : records.length;
  return {records,total};
}
export async function getPublicNoticePage(page:number, pageSize:number, query:string) {
  if(localMode()){const all=(await localNotices()).filter(n=>n.title.toLowerCase().includes(query.toLowerCase()));return {items:all.slice((page-1)*pageSize,page*pageSize).map(n=>({...n,aiReady:!!n.simple})),total:all.length,page,pageSize};}
  const size = Math.max(1,Math.min(48,Math.trunc(pageSize)||24));
  const index = Math.max(1,Math.trunc(page)||1);
  const params = new URLSearchParams({
    select:'id,notice_date,payload,ai_ready',
    order:'notice_date.desc.nullslast,id.desc',
    limit:String(size),
    offset:String((index-1)*size),
  });
  // Search across all records on the server, not only the currently visible page.
  // Strip PostgREST filter punctuation rather than allowing raw filter expressions.
  const term = query.trim().slice(0,70).replace(/[^\p{L}\p{N} -]/gu,'').trim();
  if (term) params.set('payload->>title', `ilike.*${term.replace(/\s+/g,'*')}*`);
  const {records,total} = await queryView(params,true);
  return {items:records.map(r=>({...r.payload,id:r.id,aiReady:r.ai_ready})),total,page:index,pageSize:size};
}
export async function getPublicNoticeById(id:string) {
  if(localMode()){const n=(await localNotices()).find(n=>n.id===id);return n?{...n,aiReady:!!n.simple}:null;}
  if (!/^[\w-]{1,128}$/.test(id)) return null;
  const params = new URLSearchParams({select:'id,payload,ai_ready',id:`eq.${id}`,limit:'1'});
  const {records} = await queryView(params);
  const match=records[0];
  return match ? {...match.payload,id:match.id,aiReady:match.ai_ready} : null;
}

export async function getProcessedNotices(){
 if(localMode())return (await localNotices()).filter(n=>n.simple);
 const {records}=await queryView(new URLSearchParams({select:'id,payload,ai_ready',ai_ready:'eq.true',order:'notice_date.desc.nullslast,id.desc',limit:'100'}));
 return records.map(r=>({...r.payload,id:r.id}));
}
export async function getSyncStatus(){
 if(localMode())return {mode:'local',last_success_at:null};
 const res=await fetch(`${projectUrl}/rest/v1/civic_sync_state?select=last_started_at,last_success_at,last_error,fetched,changed&id=eq.toronto-notices`,{headers:{apikey:apiKey},cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw new Error('Sync status unavailable');
 const rows=await res.json();return {mode:'shared',...(rows[0]||{}),automaticSourceSync:false};
}


export async function getMapNotices(){
 if(localMode())return await localNotices();
 const items:PublicNotice[]=[];
 for(let offset=0;offset<20000;offset+=1000){
  const {records}=await queryView(new URLSearchParams({select:'id,payload,ai_ready',order:'notice_date.desc.nullslast,id.asc',limit:'1000',offset:String(offset)}));
  items.push(...records.map(r=>({id:r.id,title:r.payload.title,description:r.payload.description?.slice(0,600),noticeDate:r.payload.noticeDate,topics:r.payload.topics,addresses:r.payload.addresses,sourceUrl:r.payload.sourceUrl,...(r.ai_ready&&r.payload.simple?{simple:r.payload.simple}:{})})));
  if(records.length<1000)return items;
 }
 throw new Error('Map record limit exceeded');
}
