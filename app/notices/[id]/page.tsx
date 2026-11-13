import { introduction } from '@/features/records/introduction.mjs';
import NoticeRefresh from '@/features/notices/NoticeRefresh';
import { notFound } from 'next/navigation';
import { getPublicNoticeById } from '@/lib/public-notices';
import { LiveRecordDetails, type DetailedNotice } from '@/features/records/RecordDetails';
import RecordPageFrame from '@/features/records/RecordPageFrame';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function NoticePage({ params }: PageProps) {
  const { id } = await params;
  const notice = await getPublicNoticeById(id);
  if (!notice) notFound();
  const aiReady =
    notice.aiReady && notice.simple && typeof notice.simple.whatIsHappening === 'string';
  const summary = notice.simple;
  return (
    <RecordPageFrame
      introduction={introduction({
        title: notice.title,
        summary: aiReady
          ? [summary?.whatIsHappening, summary?.whyItMatters].filter(Boolean).join(' ')
          : notice.description,
        location: aiReady ? summary?.where : notice.addresses?.map((a) => a.label).join('; '),
        status: aiReady ? summary?.decisionStage : undefined,
      })}
      category={notice.topics?.[0] || 'Public notice'}
      title={aiReady ? summary?.plainTitle || notice.title : notice.title}
      status={aiReady ? summary?.decisionStage || 'Stage not specified' : 'Public notice'}
      date={notice.noticeDate?.slice(0, 10) || 'Date not specified'}
      area={aiReady ? summary?.where : notice.addresses?.[0]?.label || ''}
      backHref="/?view=Decisions"
      backLabel="All records"
    >
      <NoticeRefresh />
      {aiReady ? (
        <LiveRecordDetails notice={notice as DetailedNotice} />
      ) : (
        <div className="record-details">
          <section className="record-section">
            <div className="record-eyebrow">OFFICIAL SOURCE RECORD</div>
            <h3>What does the original notice say?</h3>
            <p>{notice.description || 'No description was provided in the source record.'}</p>
            {notice.addresses?.length ? (
              <p>
                <strong>Locations:</strong>{' '}
                {notice.addresses
                  .map((a) => a.label)
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
          </section>
          <section className="record-section">
            <div className="record-eyebrow">SOURCE & PARTICIPATION</div>
            <h3>Verify dates and participation opportunities</h3>
            <p>
              Check the original City notice to verify decision status, meeting times, consultation
              deadlines and how to respond.
            </p>
            {notice.sourceUrl ? (
              <a
                className="record-source-link"
                href={notice.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View original Toronto notice ↗
              </a>
            ) : (
              <a
                className="record-source-link"
                href="https://secure.toronto.ca/nm/notices/current.do"
                target="_blank"
                rel="noopener noreferrer"
              >
                Browse City public notices ↗
              </a>
            )}
          </section>
        </div>
      )}
    </RecordPageFrame>
  );
}
