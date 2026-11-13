import type { PublicNotice } from '@/lib/public-notices';
import type { DetailedNotice } from './RecordDetails';

export function noticePresentation(notice: PublicNotice & { aiReady?: boolean }): DetailedNotice {
  const current = notice.aiReady && notice.simple;
  const title = notice.title;
  const source = (notice.description || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const start = source.search(/(?:TAKE NOTICE that|The City (?:received|is|has)|City Council)/i);
  const text = (start >= 0 ? source.slice(start) : source).replace(/^TAKE NOTICE that\s*/i, '');
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const main = sentences.find(
    (s) => s.split(/\s+/).length <= 65 && !/attached to this Notice|please see item/i.test(s),
  );
  const summary = main || title.replace(/^Notice of /i, '');
  const status = /notice of (passing|adoption)/i.test(title)
    ? 'Adoption notice'
    : /application/i.test(title)
      ? 'Application notice'
      : /meeting/i.test(title)
        ? 'Public meeting'
        : 'Public notice';
  return {
    ...notice,
    description: notice.description || '',
    noticeDate: notice.noticeDate || null,
    topics: notice.topics || [],
    addresses: notice.addresses || [],
    sourceUrl: notice.sourceUrl || 'https://secure.toronto.ca/nm/notices/current.do',
    generatedBy: notice.generatedBy || 'Official source',
    generatedAt: notice.generatedAt || '',
    simple: current || {
      plainTitle: title,
      whatIsHappening: summary,
      whyItMatters: '',
      whoMayBeAffected: '',
      where: notice.addresses?.map((a) => a.label).join('; ') || '',
      decisionStage: status,
      howToParticipate: 'See the original notice for participation details and any deadlines.',
      participationDeadline: '',
      uncertainty: '',
    },
  };
}
