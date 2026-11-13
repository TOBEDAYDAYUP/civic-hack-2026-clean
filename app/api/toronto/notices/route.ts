import { NextRequest, NextResponse } from 'next/server';
import { fetchTorontoNotices } from '@/lib/toronto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = (searchParams.get('q') || '').trim().toLowerCase();
    const topic = (searchParams.get('topic') || '').trim().toLowerCase();
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 25), 1), 200);

    let notices = await fetchTorontoNotices();
    if (query) {
      notices = notices.filter((n) => [
        n.title, n.subheading, n.description, n.decisionBody,
        ...n.topics, ...n.addresses.map((a) => a.label),
      ].join(' ').toLowerCase().includes(query));
    }
    if (topic) notices = notices.filter((n) => n.topics.some((t) => t.toLowerCase().includes(topic)));

    notices.sort((a, b) => (b.noticeDate || '').localeCompare(a.noticeDate || ''));
    const sliced = notices.slice(0, limit).map(({ raw, ...notice }) => notice);

    return NextResponse.json({
      ok: true,
      source: 'City of Toronto Public Notices Open Data API',
      sourceUrl: 'https://secure.toronto.ca/nm/opendata.do',
      fetchedAt: new Date().toISOString(),
      totalMatched: notices.length,
      returned: sliced.length,
      notices: sliced,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      hint: 'The Toronto source may be temporarily unavailable. Existing curated website data remains usable.',
    }, { status: 502 });
  }
}
