import {prepareRecords} from './source.mjs';

const url=Deno.env.get('SUPABASE_URL')!;
const keys=Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')) as string[];
const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(legacy)keys.push(legacy);
const key=keys[0];
const headers={apikey:key,'Content-Type':'application/json',...(key?.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{})};
async function db(endpoint:string,body:unknown,method='POST') {
 const response=await fetch(`${url}/rest/v1/${endpoint}`,{method,headers,body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Database operation failed (${response.status})`);
 const text=await response.text();return text?JSON.parse(text):null;
}
async function matches(value:string|null) {
 if(!value)return false;
 const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const given=await digest(value);
 for(const expected of keys){const other=await digest(expected);let diff=0;for(let i=0;i<given.length;i++)diff|=given[i]^other[i];if(diff===0)return true;}
 return false;
}
Deno.serve(async req=>{
 if(req.method!=='POST')return Response.json({ok:false,error:'Method not allowed'},{status:405});
 // Modern secret keys are not JWTs. Explicit authentication replaces verify_jwt.
 if(!await matches(req.headers.get('apikey')))return Response.json({ok:false,error:'Unauthorized'},{status:401});
 let token:string|null=null;
 try{
  token=await db('rpc/civic_acquire_sync_lease',{});
  if(!token)return Response.json({ok:true,skipped:true,reason:'Sync already running'},{status:202});
  const response=await fetch('https://secure.toronto.ca/nm/notices.json',{headers:{Accept:'application/json','User-Agent':'Civic-notice-sync/1.0'},signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error(`Toronto source unavailable (${response.status})`);
  const records=await prepareRecords(await response.json());
  const result=await db('rpc/civic_commit_source_sync',{token,records});
  return Response.json({ok:true,...result});
 }catch(error){
  const message=error instanceof Error?error.message:'Sync failed';
  if(token)await db(`civic_sync_state?id=eq.toronto-notices&lease_token=eq.${token}`,{lease_token:null,lease_until:null,last_error:message.slice(0,300)},'PATCH').catch(()=>{});
  console.error(message);
  return Response.json({ok:false,error:message},{status:502});
 }
});
