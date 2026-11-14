import { publicDataConfig } from '@/lib/supabase/config';

export type VoteResult = {
  id: string;
  reference: string;
  title: string;
  vote_date: string;
  vote_time: string;
  motion_type: string | null;
  result: string | null;
  yes: number;
  no: number;
  absent: number;
  motion_text: string | null;
  decision_text: string | null;
};

export const votesPerPage = 12;

export async function readVoteResults(query: string, page: number) {
  const { url, key } = publicDataConfig;
  if (!url || !key) throw new Error('Missing public Supabase configuration');

  const endpoint = new URL('/rest/v1/civic_vote_results', url);
  endpoint.searchParams.set('order', 'vote_date.desc,vote_time.desc,reference.asc,id.asc');
  endpoint.searchParams.set('limit', String(votesPerPage));
  endpoint.searchParams.set('offset', String((page - 1) * votesPerPage));
  if (query) {
    const pattern = JSON.stringify('%' + query.replace(/[\\%_]/g, '\\$&') + '%');
    endpoint.searchParams.set(
      'or',
      '(reference.ilike.' + pattern + ',title.ilike.' + pattern + ')',
    );
  }

  const response = await fetch(endpoint, {
    headers: { apikey: key, Prefer: 'count=exact' },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  });
  if (response.status === 416 && page > 1) return null;
  if (!response.ok) throw new Error('Vote results returned HTTP ' + response.status);
  const total = Number(response.headers.get('content-range')?.split('/').at(-1));
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Missing vote results count');
  const rows: VoteResult[] = await response.json();
  return { rows, total };
}
