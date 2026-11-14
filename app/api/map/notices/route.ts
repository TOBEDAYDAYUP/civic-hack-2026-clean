import {NextResponse} from 'next/server';
import {getMapNotices} from '@/lib/public-notices';
import {readStreetCache,cachedStreetPoints} from '@/lib/map-geocode-cache.mjs';
export const dynamic='force-dynamic';
export async function GET(){
 try{const notices=await getMapNotices();const cache=await readStreetCache();const items=notices.map(n=>({...n,streetMatches:cachedStreetPoints(n,cache)}));return NextResponse.json({ok:true,total:items.length,items},{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({ok:false,error:'Map notices are temporarily unavailable'},{status:503});}
}
