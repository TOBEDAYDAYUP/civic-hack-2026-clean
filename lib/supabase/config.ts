// Public read-only project connection. RLS denies all visitor writes.
// These publishable values are intentionally safe to share with teammates.
export const publicDataConfig={
 url:process.env.NEXT_PUBLIC_SUPABASE_URL||'https://johoelklvlszzjgrkudw.supabase.co',
 key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_fcPeKnXAFMGzkq37iWvAdQ_H5_g8VwT',
};
