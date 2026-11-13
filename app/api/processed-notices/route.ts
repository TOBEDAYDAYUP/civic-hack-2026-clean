import {NextResponse} from 'next/server';
import {getProcessedNotices} from '@/lib/public-notices';
export const dynamic='force-dynamic';
export async function GET(){
 try{const notices=await getProcessedNotices();return NextResponse.json({ok:true,count:notices.length,notices},{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({ok:false,error:'Shared notices are temporarily unavailable'},{status:503});}
}
