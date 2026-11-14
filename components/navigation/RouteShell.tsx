'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { decisions } from '@/data/decisions';
import Shell from './Shell';
import type { View } from './types';

export default function RouteShell({
  view,
  children,
}: {
  view: 'Agendas' | 'Voting';
  children: ReactNode;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    function updateSaved() {
      const read = (key: string): unknown[] => {
        try {
          const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      };
      const notices = new Set(
        read('yc-saved-notices')
          .filter((id) => typeof id === 'string' && /^[\w-]{1,128}$/.test(id))
          .slice(0, 200),
      );
      const archive = new Set(
        read('yc-saved').filter(
          (id) => Number.isInteger(id) && decisions.some((decision) => decision.id === id),
        ),
      );
      setSaved(notices.size + archive.size);
    }
    updateSaved();
    window.addEventListener('storage', updateSaved);
    return () => window.removeEventListener('storage', updateSaved);
  }, []);

  function go(next: View) {
    router.push(next === 'Home' ? '/' : `/?view=${next}`);
  }

  return (
    <Shell view={view} saved={saved} go={go}>
      {children}
    </Shell>
  );
}
