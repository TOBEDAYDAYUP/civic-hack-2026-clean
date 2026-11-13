import { notFound } from 'next/navigation';
import { decisions } from '@/data/decisions';
import { CuratedRecordDetails } from '@/features/records/RecordDetails';
import RecordPageFrame from '@/features/records/RecordPageFrame';

type PageProps = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return decisions.map((d) => ({ id: String(d.id) }));
}

export default async function DecisionPage({ params }: PageProps) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const decision = decisions.find((d) => d.id === Number(id));
  if (!decision) notFound();

  return (
    <RecordPageFrame
      category={decision.topic === 'Housing' ? 'Housing & real estate' : decision.topic}
      title={decision.title}
      status={decision.status}
      date={decision.date}
      area={decision.area}
      backHref="/?view=Decisions"
      backLabel="All decisions"
    >
      <CuratedRecordDetails decision={decision} />
    </RecordPageFrame>
  );
}
