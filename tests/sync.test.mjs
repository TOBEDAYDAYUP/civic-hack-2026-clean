import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareRecords,hash,normalize} from '../supabase/functions/civic-sync/source.mjs';
import {syncSource} from '../lib/sync/source-sync.mjs';
const record={noticeId:12,title:'Public meeting',noticeDescription:'<p>Discuss plans</p>',noticeDate:'2026-11-13',addressList:[{address:'Toronto',latitude:null,longitude:''}]};
test('nested official response is deduplicated and missing coordinates remain missing',async()=>{
 const rows=await prepareRecords({data:{nested:{records:[record,record]}}});
 assert.equal(rows.length,1);assert.equal(rows[0].id,'12');assert.equal(rows[0].payload.description,'Discuss plans');
 assert.equal(rows[0].payload.addresses[0].latitude,null);assert.equal(rows[0].payload.addresses[0].longitude,null);
});
test('hash is stable across property order and changes for source changes',async()=>{
 assert.equal(await hash({a:1,b:2}),await hash({b:2,a:1}));
 assert.notEqual(await hash(normalize(record)),await hash(normalize({...record,noticeDescription:'New deadline'})));
});
test('empty or unrecognized responses fail instead of clearing data',async()=>{
 await assert.rejects(prepareRecords({data:[]}));await assert.rejects(prepareRecords({error:'Unavailable'}));
});
test('busy database lease skips source request',async()=>{
 let calls=0;const result=await syncSource({url:'https://db.test',key:'sb_secret_test',fetcher:async()=>{calls++;return Response.json(null);}});
 assert.equal(calls,1);assert.equal(result.skipped,true);
});
test('successful sync commits a full validated batch',async()=>{
 const requests=[];
 const result=await syncSource({url:'https://db.test',key:'sb_secret_test',fetcher:async(url,options)=>{
  requests.push(url);
  if(url.endsWith('civic_acquire_sync_lease'))return Response.json('lease');
  if(url.includes('secure.toronto.ca'))return Response.json({notices:[record]});
  const body=JSON.parse(options.body);assert.equal(body.token,'lease');assert.equal(body.records.length,1);
  assert.equal(options.headers.apikey,'sb_secret_test');return Response.json({fetched:1,changed:1});
 }});
 assert.equal(result.changed,1);assert.equal(requests.length,3);
});
test('upstream failure releases only own lease and never commits',async()=>{
 const requests=[];
 await assert.rejects(syncSource({url:'https://db.test',key:'sb_secret_test',fetcher:async(url,options)=>{
  requests.push({url,options});
  if(url.endsWith('civic_acquire_sync_lease'))return Response.json('my-lease');
  if(url.includes('secure.toronto.ca'))return new Response('Unavailable',{status:503});
  assert.equal(options.method,'PATCH');assert.ok(url.includes('lease_token=eq.my-lease'));return new Response(null,{status:204});
 }}),/Toronto source unavailable/);
 assert.ok(!requests.some(r=>r.url.includes('civic_commit_source_sync')));
});
