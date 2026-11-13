import {NextRequest, NextResponse} from 'next/server';
import {getPublicNoticeById} from '@/lib/public-notices';
import {streetAddressCandidates,validateGeocodeResult, type StreetGeocode} from '@/lib/map-geocode.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const cache = new Map<string,{date:number;points:StreetGeocode[]}>();
const CACHE_MILLISECONDS=1000*60*60*24*7;
const MAX_CACHE_ENTRIES=2000;
let nextAllowed=0;
let queue=Promise.resolve();

/** One queue for this Node process; deployments with several workers need shared rate limits. */
function pacedRequest<T>(job:()=>Promise<T>):Promise<T>{
 const item=queue.then(async()=>{
   const now=Date.now();
   const pause=Math.max(0,nextAllowed-now);
   if(pause)await new Promise(resolve=>setTimeout(resolve,pause));
   nextAllowed=Date.now()+550; // Stay below the Geoapify free 5 req/s account limit.
   return job();
 });
 queue=item.then(()=>{},()=>{});
 return item;
}

export async function GET(request:NextRequest){
 const key=process.env.GEOAPIFY_API_KEY?.trim();
 const id=new URL(request.url).searchParams.get('id');
 if(!id)return NextResponse.json({ok:true,enabled:!!key,provider:'Geoapify'});
 if(!key)return NextResponse.json({ok:false,enabled:false,error:'Street geocoding is not configured; supply GEOAPIFY_API_KEY in .env.local.'},{status:503});
 if(!/^[\w-]{1,128}$/.test(id))return NextResponse.json({ok:false,error:'Invalid notice ID'},{status:400});
 try{
   // Never act as a general-purpose geocoding proxy. Only geocode source
   // street addresses belonging to a real notice from the official archive.
   const notice=await getPublicNoticeById(id);
   if(!notice)return NextResponse.json({ok:false,error:'Notice not found'},{status:404});
   const addresses=streetAddressCandidates(notice);
   if(!addresses.length)return NextResponse.json({ok:true,points:[],reason:'No eligible source street address'});
   const results:StreetGeocode[]=[];
   for(const address of addresses){
     const cacheKey=`${id}|${address}`;
     const cached=cache.get(cacheKey);
     if(cached && Date.now()-cached.date<CACHE_MILLISECONDS){results.push(...cached.points);continue;}
     const found=await pacedRequest(async()=>{
       const endpoint=new URL('https://api.geoapify.com/v1/geocode/search');
       endpoint.searchParams.set('text',`${address}, Toronto, Ontario, Canada`);
       endpoint.searchParams.set('filter','rect:-79.66,43.55,-79.10,43.87');
       endpoint.searchParams.set('format','geojson');
       endpoint.searchParams.set('lang','en');
       endpoint.searchParams.set('limit','3');
       endpoint.searchParams.set('apiKey',key);
       const response=await fetch(endpoint.toString(),{signal:AbortSignal.timeout(9000),cache:'no-store'});
       if(!response.ok)throw new Error(`Geocoder rejected the request (${response.status})`);
       const body=await response.json() as {features?:unknown[]};
       for(const feature of body.features||[]){
         const validated=validateGeocodeResult(address,feature);
         if(validated)return [validated];
       }
       return [];
     });
     // Cache both confirmed results and negative matches to control API use.
     cache.set(cacheKey,{date:Date.now(),points:found});
     if(cache.size>MAX_CACHE_ENTRIES)cache.delete(cache.keys().next().value!);
     results.push(...found);
   }
   return NextResponse.json({ok:true,points:results},{headers:{'Cache-Control':'private, max-age=3600'}});
 }catch(e){
   return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Geocoding unavailable'},{status:502});
 }
}
