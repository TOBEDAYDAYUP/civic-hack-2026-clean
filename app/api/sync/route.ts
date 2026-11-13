import {syncSource} from '@/lib/sync/source-sync.mjs';
import {NextResponse} from 'next/server';
import {authorized} from '@/lib/supabase/admin-auth';
import {publicDataConfig} from '@/lib/supabase/config';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!authorized(request))return NextResponse.json({ok:false,error:'Administrator authentication required'},{status:401});
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!key)return NextResponse.json({ok:false,error:'Administrator sync is not configured on this server'},{status:503});
 try{
  return NextResponse.json(await syncSource({url:publicDataConfig.url,key}));
 }catch{return NextResponse.json({ok:false,error:'Source synchronization failed; existing records are preserved'},{status:502});}
}
