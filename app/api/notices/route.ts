import {NextRequest, NextResponse} from 'next/server';
import {getPublicNoticePage} from '@/lib/public-notices';
import {NOTICE_CATEGORIES} from '@/lib/notice-browser.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest) {
  const url=new URL(request.url);
  const page=Number(url.searchParams.get('page')||'1');
  const size=Number(url.searchParams.get('limit')||'24');
  const query=url.searchParams.get('q')||'';
  const sort=url.searchParams.get('sort')||'newest';
  const category=url.searchParams.get('category')||'all';
  const savedOnly=url.searchParams.get('savedOnly')==='1';
  const savedIds=savedOnly?(url.searchParams.get('ids')||'').split(',').filter(Boolean):undefined;
  if (!Number.isSafeInteger(page) || page<1 || page>100000 || !Number.isSafeInteger(size) || size<1 || size>48 || !['newest','oldest'].includes(sort) || !NOTICE_CATEGORIES.some(c=>c.value===category) || (savedIds?.length||0)>200 || (savedIds||[]).some(id=>!/^[\w-]{1,128}$/.test(id)) || query.length>100) {
    return NextResponse.json({ok:false,error:'Invalid pagination parameters'},{status:400});
  }
  try {
    const result=await getPublicNoticePage(page,size,query,sort as 'newest'|'oldest',category,savedIds);
    return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({ok:false,error:'The public notice feed is temporarily unavailable'},{status:503});
  }
}
