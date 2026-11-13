// Public connection settings are supplied by each environment, not source code.
export const publicDataConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
};
