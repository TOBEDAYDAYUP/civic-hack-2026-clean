import RouteShell from '@/components/navigation/RouteShell';
import AgendasPage from '@/features/agendas/AgendasPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Upcoming agendas | Your City Council' };

export default function Page() {
  return (
    <RouteShell view="Agendas">
      <AgendasPage />
    </RouteShell>
  );
}
