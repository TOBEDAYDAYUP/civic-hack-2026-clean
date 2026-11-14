'use client';
import { useLanguage } from '@/features/language/LanguageProvider';
import type { Decision } from '@/data/decisions';
import { recordContext } from '@/features/records/recordContext';
import HousingPipelineDetail from './HousingPipelineDetail';
import ResidentImpactSection from './ResidentImpactSection';
import type { NoticeImpactPresentation } from '@/lib/impact-analysis.mjs';

export type DetailedNotice = {
  id: string;
  title: string;
  description: string;
  noticeDate: string | null;
  topics: string[];
  addresses: { label: string; latitude: number | null; longitude: number | null }[];
  planningApplicationNumbers?: string[];
  sourceUrl: string;
  generatedBy: string;
  generatedAt: string;
  residentImpact: NoticeImpactPresentation;
  simple: {
    plainTitle: string;
    whatIsHappening: string;
    whyItMatters: string;
    whoMayBeAffected: string;
    where: string;
    decisionStage: string;
    howToParticipate: string;
    participationDeadline: string;
    uncertainty: string;
  };
};

const notSpecified = (s: string | undefined | null) =>
  !s || /^(not specified|not provided|unknown|n\/a)/i.test(s.trim());

function Fact({ label, value }: { label: string; value: string }) {
  const { t } = useLanguage();
  return (
    <div>
      <strong>{t(label)}</strong>
      <span lang={t(value) === value ? 'en' : undefined}>{t(value)}</span>
    </div>
  );
}

/** Presentation only: keep every AI sentence, but make lengthy explanations scan-friendly. */
function ShortPoints({ text }: { text: string }) {
  const { t } = useLanguage();
  if (notSpecified(text)) return <p>{t('Not specified in the available record.')}</p>;
  const points = text
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <ul className="record-points">
      {points.map((point, i) => (
        <li key={i} lang="en">
          {point}
        </li>
      ))}
    </ul>
  );
}

function Questions({ items }: { items: readonly string[] }) {
  return (
    <ul className="record-points">
      {items.map((item, i) => (
        <li key={i} lang="en">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function CuratedRecordDetails({ decision }: { decision: Decision }) {
  const { t } = useLanguage();
  const context = recordContext[decision.id];
  if (decision.topic === 'Housing') {
    return (
      <HousingPipelineDetail
        sourceType="council decision"
        summary={decision.summary}
        recordDate={decision.date}
        area={decision.area}
        interpretation={context?.significance}
        followUpQuestions={context?.followUpQuestions}
        sourceUrl="https://www.toronto.ca/city-government/council/"
      />
    );
  }

  return (
    <div className="record-details">
      <section className="record-section">
        <div className="record-eyebrow">{t('01 / THE RECORD')}</div>
        <h3>{t('What did Council decide?')}</h3>
        <p lang="en">{decision.summary}</p>
        <div className="record-facts">
          <Fact label={t('Record date')} value={decision.date} />
          <Fact label={t('Area mentioned')} value={decision.area} />
          <Fact label={t('Decision status')} value={decision.status} />
          <Fact label={t('Source type')} value="Council decision" />
        </div>
      </section>
      <section className="record-section">
        <div className="record-eyebrow">{t('02 / RELEVANCE')}</div>
        <h3>{t('Why might it matter?')}</h3>
        <p>
          {context?.significance ||
            'The decision may affect public services or planning. Check the Council report before assuming a particular outcome.'}
        </p>
      </section>
      <section className="record-section">
        <div className="record-eyebrow">{t('03 / WHAT IS NOT YET CLEAR')}</div>
        <h3>{t('What should we check next?')}</h3>
        <Questions
          items={
            context?.followUpQuestions || [
              'Which follow-up report documents implementation?',
              'Are any outcomes or deadlines confirmed by an official source?',
            ]
          }
        />
      </section>
      <section className="record-section">
        <div className="record-eyebrow">{t('04 / SOURCE & NEXT STEPS')}</div>
        <h3>{t('Where can I verify this?')}</h3>
        <p>
          {t(
            "Locate the original item using the title and date in the City's Council and committee records.",
          )}
        </p>
        <a
          className="record-source-link"
          href="https://www.toronto.ca/city-government/council/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Browse City of Toronto Council records ↗')}
        </a>
      </section>
    </div>
  );
}

export function LiveRecordDetails({ notice }: { notice: DetailedNotice }) {
  const { t } = useLanguage();
  const housing = notice.topics.some((t) => /housing|planning|development/i.test(t));
  const s = notice.simple;
  const residentImpactSection = <ResidentImpactSection {...notice.residentImpact} />;
  if (housing) {
    return (
      <div className="record-details">
        <HousingPipelineDetail
          sourceType="public notice"
          sourceText={notice.description}
          sourceTitle={notice.title}
          summary={s.whatIsHappening}
          residentImpactSection={residentImpactSection}
          recordDate={notice.noticeDate}
          area={s.where}
          noticeStage={s.decisionStage}
          addresses={notice.addresses.map((a) => a.label)}
          references={notice.planningApplicationNumbers}
          sourceUrl={notice.sourceUrl}
        />
        <section className="record-section">
          <div className="record-eyebrow">{t('PUBLIC PARTICIPATION / NOTICE DETAILS')}</div>
          <h3>{t('What can residents do?')}</h3>
          <p>
            {t(
              notSpecified(s.howToParticipate)
                ? 'The available notice does not specify a participation method.'
                : s.howToParticipate,
            )}
          </p>
          <div className="record-facts">
            <Fact
              label={t('Deadline stated in notice')}
              value={
                notSpecified(s.participationDeadline) ? 'Not specified' : s.participationDeadline
              }
            />
            <Fact
              label={t('Who may be affected')}
              value={notSpecified(s.whoMayBeAffected) ? 'Not specified' : s.whoMayBeAffected}
            />
          </div>
          <h3>{t('What remains uncertain?')}</h3>
          <p>
            {t(
              notSpecified(s.uncertainty)
                ? 'Project-level milestones and outcomes are not established here.'
                : s.uncertainty,
            )}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="record-details">
      <section className="record-section">
        <div className="record-eyebrow">{t('01 / WHAT THE NOTICE SAYS')}</div>
        <h3>{t('What is happening?')}</h3>
        <ShortPoints text={s.whatIsHappening} />
        <div className="record-facts">
          <Fact
            label={t('Stage described')}
            value={notSpecified(s.decisionStage) ? 'Not specified' : s.decisionStage}
          />
          <Fact
            label={t('Location described')}
            value={notSpecified(s.where) ? 'Not specified' : s.where}
          />
          <Fact
            label={t('Who may be affected')}
            value={notSpecified(s.whoMayBeAffected) ? 'Not specified' : s.whoMayBeAffected}
          />
          {notice.noticeDate && (
            <Fact label={t('Public notice date')} value={notice.noticeDate.slice(0, 10)} />
          )}
        </div>
      </section>
      {residentImpactSection}
      <section className="record-section">
        <div className="record-eyebrow">{t('03 / NEXT ACTION')}</div>
        <h3>{t('How can residents participate?')}</h3>
        <ShortPoints text={s.howToParticipate} />
        <div className="record-facts">
          <Fact
            label={t('Deadline')}
            value={
              notSpecified(s.participationDeadline)
                ? 'Not specified in source'
                : s.participationDeadline
            }
          />
        </div>
      </section>
      <section className="record-section">
        <div className="record-eyebrow">{t('04 / SOURCE & UNCERTAINTY')}</div>
        <h3>{t('What remains unclear?')}</h3>
        <p>
          {t(
            notSpecified(s.uncertainty)
              ? 'The available notice may not establish implementation or outcomes.'
              : s.uncertainty,
          )}
        </p>
        <a
          className="record-source-link"
          href={notice.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Read the original Toronto notice ↗')}
        </a>
        {notice.description && (
          <details className="record-source-excerpt">
            <summary>{t('Show notice description provided to the system')}</summary>
            <p>{notice.description}</p>
          </details>
        )}
      </section>
    </div>
  );
}
