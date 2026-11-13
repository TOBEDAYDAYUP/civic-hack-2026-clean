import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { LiveRecordDetails, type DetailedNotice } from '@/features/records/RecordDetails';
import RecordPageFrame from '@/features/records/RecordPageFrame';

export const dynamic = 'force-dynamic';
export default async function NoticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let notices: DetailedNotice[] = [];
  try {
    const data: unknown = JSON.parse(
      await readFile(path.join(process.cwd(), 'data/generated-notices.json'), 'utf8'),
    );
    if (Array.isArray(data)) notices = data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const notice = notices.find((n) => n.id === id);
  if (!notice?.simple) notFound();
  return (
    <RecordPageFrame
      category={notice.topics[0] || 'Public notice'}
      title={notice.simple.plainTitle || notice.title}
      status={notice.simple.decisionStage}
      date={notice.noticeDate?.slice(0, 10) || 'Date not specified'}
      area={notice.simple.where}
      backHref="/"
      backLabel="Home"
    >
      <LiveRecordDetails notice={notice} />
    </RecordPageFrame>
  );
}
