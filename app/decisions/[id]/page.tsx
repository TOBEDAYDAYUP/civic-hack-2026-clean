import { getTranslator } from '@/features/language/server';
import { introduction } from '@/features/records/introduction.mjs';
import { notFound } from 'next/navigation';
import { decisions } from '@/data/decisions';
import { CuratedRecordDetails } from '@/features/records/RecordDetails';
import RecordPageFrame from '@/features/records/RecordPageFrame';

type PageProps = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return decisions.map((d) => ({ id: String(d.id) }));
}

export default async function DecisionPage({ params }: PageProps) {
  const { t } = await getTranslator();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const decision = decisions.find((d) => d.id === Number(id));
  if (!decision) notFound();

  return (
    <RecordPageFrame
      introduction={introduction({
        title: decision.title,
        summary: decision.summary,
        location: decision.area,
        status: decision.status,
      })}
      category={decision.topic === 'Housing' ? 'Housing & real estate' : decision.topic}
      title={decision.title}
      status={decision.status}
      date={decision.date}
      area={decision.area}
      backHref="/?view=Decisions"
      backLabel="All decisions"
    >
      <p className="record-introduction">
        {t("Static curated summary restored from the archive. It does not update with the live notice feed. Verify the original Council record before relying on its status or dates.")}
      </p>
      <CuratedRecordDetails decision={decision} />
    </RecordPageFrame>
  );
}
