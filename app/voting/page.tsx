import RouteShell from '@/components/navigation/RouteShell';
import VotingPage from '@/features/voting/VotingPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Voting | Your City Council' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  return (
    <RouteShell view="Voting">
      <VotingPage params={await searchParams} />
    </RouteShell>
  );
}
