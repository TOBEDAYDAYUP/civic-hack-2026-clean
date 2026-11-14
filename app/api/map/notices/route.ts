import {NextResponse} from 'next/server';
import {getMapNotices} from '@/lib/public-notices';
export const dynamic='force-dynamic';
export async function GET(){
 try{const items=await getMapNotices();return NextResponse.json({ok:true,total:items.length,items},{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({ok:false,error:'Map notices are temporarily unavailable'},{status:503});}
}
