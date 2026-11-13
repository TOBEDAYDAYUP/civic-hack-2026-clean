import {NextResponse} from 'next/server';
import {getSyncStatus} from '@/lib/public-notices';
export const dynamic='force-dynamic';
export async function GET(){try{return NextResponse.json({ok:true,...await getSyncStatus()},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({ok:false,error:'Sync status unavailable'},{status:503});}}
