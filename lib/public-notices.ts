import {addressLabel} from './address-label.mjs';
import {filterAndSortNotices} from './notice-browser.mjs';
import type { ImpactItem } from './impact-analysis.mjs';
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
  analysisVersion?: string;
  simple?: {
    plainTitle:string;
    whatIsHappening:string;
    whyItMatters:string;
    impacts?: ImpactItem[];
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

async function queryView(params:URLSearchParams, count=false, withTitles=true) {
  if(!projectUrl||!apiKey)throw new Error('Supabase environment configuration is missing');
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
  // Derived titles never overwrite the official source title.
  if(records.length&&withTitles){
    const ids=records.map(r=>r.id).filter(id=>/^[\w-]{1,128}$/.test(id));
    if(ids.length)try{
      const params=new URLSearchParams({select:'notice_id,original_title,short_title',notice_id:`in.(${ids.join(',')})`});
      const titles=await fetch(`${projectUrl}/rest/v1/civic_notice_titles?${params}`,{headers:{apikey:apiKey},cache:'no-store',signal:AbortSignal.timeout(4000)});
      if(titles.ok){const rows=await titles.json() as {notice_id:string;original_title:string;short_title:string}[];
        for(const row of records){const match=rows.find(t=>t.notice_id===row.id&&t.original_title===row.payload.title);if(match)row.payload={...row.payload,displayTitle:match.short_title};}
      }
    }catch{/* Keep the original title when the optional title store is unavailable. */}
  }
  const range = response.headers.get('content-range') || '';
  const countText = range.split('/')[1];
  const total = countText && /^\d+$/.test(countText) ? Number(countText) : records.length;
  return {records,total};
}
type BrowseItem = PublicNotice & {aiReady:boolean};
let browseCache: {expires:number; rows: BrowseItem[]} | null = null;
let browsePending: Promise<BrowseItem[]> | null = null;

// Filtering by derived categories must happen *before* pagination. Because the
// historical Supabase view has no normalized category column, fetch the archive
// on the server, scan its official metadata, then return the requested 12 rows.
// A small short-lived cache avoids a full archive read on every filter click.
async function fullNoticeArchive():Promise<BrowseItem[]> {
  if (browseCache && browseCache.expires>Date.now()) return browseCache.rows;
  if (browsePending) return browsePending;
  browsePending=(async()=>{
    const result:BrowseItem[]=[];
    for(let offset=0;offset<20000;offset+=1000){
      const params=new URLSearchParams({select:'id,notice_date,payload,ai_ready',order:'notice_date.desc.nullslast,id.desc',limit:'1000',offset:String(offset)});
      const {records}=await queryView(params,false,false);
      result.push(...records.map(r=>({...r.payload,id:r.id,noticeDate:r.payload.noticeDate||r.notice_date,aiReady:r.ai_ready})));
      if(records.length<1000){browseCache={rows:result,expires:Date.now()+15_000};return result;}
    }
    throw new Error('Notice archive exceeded the supported browsing limit');
  })();
  try{return await browsePending;}finally{browsePending=null;}
}

// Only the current visible page needs the optional short titles lookup.
async function loadDisplayTitles(items:BrowseItem[]):Promise<void>{
  const ids=items.map(n=>n.id).filter(id=>/^[\w-]{1,128}$/.test(id));
  if(!ids.length||!projectUrl||!apiKey)return;
  try{
    const params=new URLSearchParams({select:'notice_id,original_title,short_title',notice_id:`in.(${ids.join(',')})`});
    const response=await fetch(`${projectUrl}/rest/v1/civic_notice_titles?${params}`,{
      headers:{apikey:apiKey},cache:'no-store',signal:AbortSignal.timeout(4000),
    });
    if(response.ok){
      const titles=await response.json() as {notice_id:string;original_title:string;short_title:string}[];
      for(const item of items){
        const match=titles.find(t=>t.notice_id===item.id&&t.original_title===item.title);
        if(match)item.displayTitle=match.short_title;
      }
    }
  }catch{/* Optional title service is not required for browsing. */}
}

export async function getPublicNoticePage(
  page:number,pageSize:number,query:string,sort:'newest'|'oldest'='newest',category='all',savedIds?:string[],
) {
  const size=Math.max(1,Math.min(48,Math.trunc(pageSize)||24));
  const index=Math.max(1,Math.trunc(page)||1);
  const term=query.trim().slice(0,100);
  if(localMode()){
    const all=(await localNotices()).map(n=>({...n,aiReady:!!n.simple}));
    const matches=filterAndSortNotices(all,{query:term,sort,category,savedIds});
    return {items:matches.slice((index-1)*size,index*size),total:matches.length,page:index,pageSize:size};
  }
  // Default browsing can use indexed PostgREST pagination and exact count.
  if(!term&&category==='all'&&savedIds===undefined){
    const order=sort==='oldest'?'notice_date.asc.nullslast,id.asc':'notice_date.desc.nullslast,id.desc';
    const params=new URLSearchParams({select:'id,notice_date,payload,ai_ready',order,limit:String(size),offset:String((index-1)*size)});
    const {records,total}=await queryView(params,true);
    return {items:records.map(r=>({...r.payload,id:r.id,aiReady:r.ai_ready})),total,page:index,pageSize:size};
  }
  if(savedIds?.length===0)return {items:[],total:0,page:index,pageSize:size};
  let items:BrowseItem[];
  if(savedIds){
    // Read only the user's selected public IDs; never use the old numeric static index.
    const valid=[...new Set(savedIds)].filter(id=>/^[\w-]{1,128}$/.test(id)).slice(0,200);
    if(!valid.length)return {items:[],total:0,page:index,pageSize:size};
    const params=new URLSearchParams({select:'id,notice_date,payload,ai_ready',id:`in.(${valid.join(',')})`,limit:String(valid.length)});
    const {records}=await queryView(params,false,false);
    items=records.map(r=>({...r.payload,id:r.id,aiReady:r.ai_ready}));
  }else items=await fullNoticeArchive();
  const matched=filterAndSortNotices(items,{query:term,sort,category,savedIds});
  const pageItems=matched.slice((index-1)*size,index*size).map(n=>({...n}));
  await loadDisplayTitles(pageItems);
  return {items:pageItems,total:matched.length,page:index,pageSize:size};
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
