import { prepareRecords } from '../../supabase/functions/civic-sync/source.mjs';
// Official full-history exports can take over 90 seconds before sending headers.
// Leave room for normalization and commit within the existing 180-second lease.
const SOURCE_TIMEOUT_MS = 120_000;
export async function syncSource({ url, key, fetcher = fetch }) {
  if (!url || !key)
    throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY on the administrator computer');
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
  };
  async function db(endpoint, body, method = 'POST') {
    const res = await fetcher(`${url.replace(/\/$/, '')}/rest/v1/${endpoint}`, {
      method,
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Database operation failed (${res.status})`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  const token = await db('rpc/civic_acquire_sync_lease', {});
  if (!token) return { ok: true, skipped: true };
  let phase = 'waiting for HTTP response headers';
  try {
    const res = await fetcher('https://secure.toronto.ca/nm/notices.json', {
      headers: { Accept: 'application/json', 'User-Agent': 'Civic-notice-sync/1.0' },
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Toronto source unavailable (${res.status})`);
    phase = 'downloading the JSON response';
    const body = await res.json();
    phase = 'validating the source records';
    const records = await prepareRecords(body);
    phase = 'committing the database transaction';
    return { ok: true, ...(await db('rpc/civic_commit_source_sync', { token, records })) };
  } catch (error) {
    const sourceTimeout =
      error?.name === 'TimeoutError' &&
      (phase === 'waiting for HTTP response headers' || phase === 'downloading the JSON response');
    const failure = sourceTimeout
      ? new Error(
          `Toronto notice export timed out after ${SOURCE_TIMEOUT_MS / 1000} seconds while ${phase}`,
          { cause: error },
        )
      : error;
    await db(
      `civic_sync_state?id=eq.toronto-notices&lease_token=eq.${token}`,
      {
        lease_token: null,
        lease_until: null,
        last_error: failure instanceof Error ? failure.message.slice(0, 300) : 'Sync failed',
      },
      'PATCH',
    ).catch(() => {});
    throw failure;
  }
}
