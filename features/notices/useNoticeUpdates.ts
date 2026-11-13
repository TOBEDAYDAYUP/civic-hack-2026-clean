'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { publicDataConfig } from '@/lib/supabase/config';

export function useNoticeUpdates(refresh: () => void) {
  const callback = useRef(refresh);
  callback.current = refresh;
  const [connection, setConnection] = useState('Connecting');
  useEffect(() => {
    if (!publicDataConfig.url || !publicDataConfig.key) return;
    const client = createClient(publicDataConfig.url, publicDataConfig.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (document.hidden || timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        callback.current();
      }, 500);
    };
    const channel = client
      .channel('notices-' + crypto.randomUUID())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'civic_source_notices' },
        schedule,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'civic_notices' }, schedule)
      .subscribe((status) => {
        setConnection(status === 'SUBSCRIBED' ? 'Live updates' : 'Reconnecting · 30s refresh');
        if (status === 'SUBSCRIBED') schedule();
      });
    const poll = setInterval(schedule, 30000);
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('online', schedule);
    return () => {
      clearInterval(poll);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('online', schedule);
      void client.removeChannel(channel);
    };
  }, []);
  return connection;
}
