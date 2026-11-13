import {NextRequest, NextResponse} from 'next/server';
import {getPublicNoticePage} from '@/lib/public-notices';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest) {
  const url=new URL(request.url);
  const page=Number(url.searchParams.get('page')||'1');
  const size=Number(url.searchParams.get('limit')||'24');
  const query=url.searchParams.get('q')||'';
  if (!Number.isSafeInteger(page) || page<1 || page>100000 || !Number.isSafeInteger(size) || size<1 || size>48) {
    return NextResponse.json({ok:false,error:'Invalid pagination parameters'},{status:400});
  }
  try {
    const result=await getPublicNoticePage(page,size,query);
    return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({ok:false,error:'The public notice feed is temporarily unavailable'},{status:503});
  }
}
