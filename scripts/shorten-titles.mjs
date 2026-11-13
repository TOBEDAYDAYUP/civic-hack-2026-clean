// Administrator only. Reuses existing titles and writes no changes to source notices.
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
const model=process.env.OLLAMA_MODEL||'qwen3.5:4b';
const ollama=process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434';
const limit=Number(process.argv.find(x=>x.startsWith('--limit='))?.split('=')[1]||10);
if(!url||!key||!Number.isInteger(limit)||limit<1)throw Error('Configure administrator environment and a positive --limit');
const headers={apikey:key,'Content-Type':'application/json',...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{})};
async function db(route,options={}){const r=await fetch(`${url}/rest/v1/${route}`,{headers,...options,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`Title database HTTP ${r.status}`);const text=await r.text();return text?JSON.parse(text):null;}
async function all(table,select){let result=[];for(let offset=0;;offset+=1000){const rows=await db(`${table}?${new URLSearchParams({select,order:table==='civic_source_notices'?'notice_date.desc.nullslast,id.asc':'notice_id.asc',limit:'1000',offset:String(offset)})}`);result.push(...rows);if(rows.length<1000)return result;}}
try{
 const [sources,existing]=await Promise.all([all('civic_source_notices','id,title:payload->>title'),all('civic_notice_titles','notice_id,original_title')]);
 const done=new Map(existing.map(r=>[r.notice_id,r.original_title]));
 const pending=sources.filter(r=>r.title?.length>70&&done.get(r.id)!==r.title).slice(0,limit);
 console.log(`${pending.length} long titles queued for ${model}`);
 let generated=0;
 for(const row of pending){
  console.log(`Shortening notice ${row.id} (${generated+1}/${pending.length})…`);
  const response=await fetch(`${ollama}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),body:JSON.stringify({model,stream:false,think:false,options:{temperature:0},format:{type:'object',properties:{title:{type:'string'}},required:['title']},messages:[{role:'system',content:'Rewrite the supplied Toronto notice title as a clear English headline: 6–10 words, at most 70 characters. Preserve the main subject and whether it is an application, proposal, meeting or adopted by-law. Do not change an application into an approval. Use only facts in the title. Do not add names, numbers or claims. Return JSON {"title":"..."}.'},{role:'user',content:row.title}]})});
  if(!response.ok)throw Error(`Ollama HTTP ${response.status}`);
  const data=await response.json();const title=JSON.parse(data.message.content).title?.trim();
  const digits=title?.match(/\d+/g)||[];
  if(typeof title!=='string'||title.length<5||title.length>90||title.split(/\s+/).length>12||digits.some(n=>!row.title.includes(n))||(/application/i.test(row.title)&&!/application|proposal|proposed|request/i.test(title))){console.log(`Skipped ${row.id}: generated title failed validation`);continue;}
  await db('civic_notice_titles?on_conflict=notice_id',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({notice_id:row.id,original_title:row.title,short_title:title,model,generated_at:new Date().toISOString()})});
  console.log(`Saved: ${title}`);generated++;
 }
 console.log(JSON.stringify({ok:true,generated}));
}catch(error){console.error(error.message);process.exitCode=1;}
