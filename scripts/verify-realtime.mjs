// Administrator diagnostic: writes an existing updated_at value back unchanged.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL, pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_fcPeKnXAFMGzkq37iWvAdQ_H5_g8VwT', secret=process.env.SUPABASE_SECRET_KEY;
assert.ok(url&&pub&&secret,'Configure administrator environment first');
const read=await fetch(`${url}/rest/v1/civic_source_notices?select=id,updated_at&limit=1`,{headers:{apikey:pub},signal:AbortSignal.timeout(15000)});
assert.equal(read.status,200);
const [row]=await read.json();assert.ok(row,'Need one existing source record');
const client=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
let resolveEvent;
const event=new Promise(resolve=>{resolveEvent=resolve;});
const channel=client.channel('civic-verification-'+Date.now()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'civic_source_notices',filter:`id=eq.${row.id}`},()=>resolveEvent(true));
try {
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Realtime subscribe timeout')),15000);
  channel.subscribe(status=>{
   if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}
   if(status==='CHANNEL_ERROR'){clearTimeout(timeout);reject(Error(status));}
  });
 });
 console.log('Realtime subscription: connected');
 const endpoint=`${url}/rest/v1/civic_source_notices?id=eq.${encodeURIComponent(row.id)}`;
 const update=key=>fetch(endpoint,{method:'PATCH',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({updated_at:row.updated_at}),signal:AbortSignal.timeout(15000)});
 const denied=await update(pub);assert.ok(denied.status>=400,'Visitors must not write');
 console.log('Public write denied:',denied.status);
 const written=await update(secret);assert.ok(written.ok);
 let timeout;
 const received=await Promise.race([event,new Promise(resolve=>{timeout=setTimeout(()=>resolve(false),15000);})]);
 clearTimeout(timeout);assert.ok(received,'Realtime event must arrive');
 console.log('Verified: shared read, denied public write, administrator write and realtime event.');
} finally {await client.removeChannel(channel);client.realtime.disconnect();}
