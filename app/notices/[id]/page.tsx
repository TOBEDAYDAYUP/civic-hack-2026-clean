import { getTranslator } from '@/features/language/server';
import { noticePresentation } from '@/features/records/notice-presentation';
import { introduction } from '@/features/records/introduction.mjs';
import NoticeRefresh from '@/features/notices/NoticeRefresh';
import { notFound } from 'next/navigation';
import { getPublicNoticeById } from '@/lib/public-notices';
import { LiveRecordDetails } from '@/features/records/RecordDetails';
import RecordPageFrame from '@/features/records/RecordPageFrame';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function NoticePage({ params }: PageProps) {
  const { t } = await getTranslator();
  const { id } = await params;
  const notice = await getPublicNoticeById(id);
  if (!notice) notFound();
  const displayed = noticePresentation(notice);
  const summary = displayed.simple;
  return (
    <RecordPageFrame
      introduction={introduction({
        title: notice.title,
        summary: [summary.whatIsHappening, summary.whyItMatters].filter(Boolean).join(' '),
        location: summary.where,
        status: summary.decisionStage,
      })}
      category={notice.topics?.[0] || 'Public notice'}
      title={summary.plainTitle || notice.title}
      status={summary.decisionStage}
      date={notice.noticeDate?.slice(0, 10) || 'Date not specified'}
      area={summary.where}
      backHref="/"
      backLabel="All notices"
    >
      <NoticeRefresh />
      <LiveRecordDetails notice={displayed} />
      {notice.description && (
        <details className="record-source-excerpt">
          <summary>{t('Read the full original notice')}</summary>
          <p lang="en">{notice.description}</p>
        </details>
      )}
    </RecordPageFrame>
  );
}
