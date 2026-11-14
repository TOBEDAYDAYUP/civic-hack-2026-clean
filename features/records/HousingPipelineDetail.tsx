'use client';
import { useLanguage } from '@/features/language/LanguageProvider';
import React from 'react';
import { stageEvidence } from './stage-evidence.mjs';
import { addressLabel } from '@/lib/address-label.mjs';

type HousingDetailProps = {
  sourceType: 'council decision' | 'public notice';
  summary: string;
  recordDate?: string | null;
  area?: string | null;
  noticeStage?: string | null;
  sourceUrl?: string;
  sourceText?: string;
  sourceTitle?: string;
  interpretation?: string;
  residentImpactSection?: React.ReactNode;
  interpretationSource?: string;
  followUpQuestions?: readonly string[];
  references?: string[];
  addresses?: string[];
};

const stages = [
  {
    name: 'Planning approval',
    meaning:
      'A planning decision may allow a development to proceed, sometimes with remaining conditions.',
    check: 'Look for the approval decision and its actual approval date.',
  },
  {
    name: 'Permit application',
    meaning:
      'The developer has applied for a building permit. Applying is not the same as receiving a permit.',
    check: 'Look for a building-permit application ID and application date.',
  },
  {
    name: 'Permit issued',
    meaning: 'A building permit has been issued, but this alone does not prove work has begun.',
    check: 'Verify the permit issue date and match it to the correct project or phase.',
  },
  {
    name: 'Construction started',
    meaning: 'Physical work has begun. This needs separate evidence, not merely a permit.',
    check: 'Look for a documented construction-start event or other credible confirmation.',
  },
  {
    name: 'Completion / occupancy',
    meaning: 'The completed building or phase has reached occupancy or completion.',
    check: 'Confirm an occupancy/completion record for the same project or phase.',
  },
] as const;

const sources = [
  {
    label: 'Toronto Development Pipeline',
    href: 'https://www.toronto.ca/city-government/data-research-maps/research-reports/planning-development/development-pipeline/',
    detail: 'Find the project and compare its reported planning/permit stage.',
  },
  {
    label: 'Application Information Centre',
    href: 'https://www.toronto.ca/city-government/planning-development/application-information-centre/',
    detail: 'Search by address or planning application number for current planning records.',
  },
  {
    label: 'Active Building Permits',
    href: 'https://open.toronto.ca/dataset/building-permits-active-permits/',
    detail: 'Check permit application and issue dates; verify project and phase matches.',
  },
];

function readableDate(value: string, locale = 'en-CA') {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
}

export default function HousingPipelineDetail({
  sourceType,
  summary,
  recordDate,
  area,
  noticeStage,
  sourceUrl,
  sourceText = '',
  sourceTitle = '',
  interpretation,
  residentImpactSection,
  followUpQuestions = [],
  references = [],
  addresses = [],
}: HousingDetailProps) {
  const { t, intlLocale } = useLanguage();
  const progress = stageEvidence({ text: sourceText, title: sourceTitle, sourceUrl });
  const isLive = sourceType === 'public notice';
  const listedReferences = references.filter(Boolean);
  const listedAddresses = addresses.map(addressLabel).filter(Boolean);
  return (
    <div className="housing-detail">
      <section
        className="housing-panel housing-record-panel"
        aria-labelledby="housing-record-heading"
      >
        <div className="housing-section-label">{t('01 / WHAT THE RECORD SAYS')}</div>
        <h3 id="housing-record-heading">{t('What’s happening?')}</h3>
        <p lang={summary ? 'en' : undefined}>
          {summary || t('This record does not include a plain-language description.')}
        </p>
        <div className="housing-facts">
          <div>
            <strong>{t('Record type')}</strong>
            <span>{t(isLive ? 'City public notice' : 'Council decision')}</span>
          </div>
          {recordDate && (
            <div>
              <strong>{t(isLive ? 'Notice published' : 'Council record date')}</strong>
              <span>{readableDate(recordDate, intlLocale)}</span>
            </div>
          )}
          {area && (
            <div>
              <strong>{t('Area in record')}</strong>
              <span>{area}</span>
            </div>
          )}
          {noticeStage && (
            <div>
              <strong>{t('Status')}</strong>
              <span>{noticeStage}</span>
            </div>
          )}
          {listedAddresses.length > 0 && (
            <div>
              <strong>{t('Addresses listed')}</strong>
              <ul className="address-list">
                {listedAddresses.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {listedReferences.length > 0 && (
            <div>
              <strong>{t('Planning application references listed')}</strong>
              <span>{listedReferences.join(' · ')}</span>
            </div>
          )}
        </div>
      </section>

      {residentImpactSection ??
        (interpretation && (
          <section className="housing-panel">
            <div className="housing-section-label">{t('WHY THIS MAY MATTER')}</div>
            <h3>{t('What this means for you')}</h3>
            <p>{interpretation}</p>
          </section>
        ))}

      <section className="housing-panel" aria-label={t('Development stages')}>
        <div className="housing-section-label">{t('02 / FROM APPROVAL TO HOMES')}</div>
        <p className="housing-current-stage">
          <strong>
            {t(
              progress.latest >= 0
                ? t('Latest recorded stage: {stage}', { stage: t(stages[progress.latest].name) })
                : progress.review
                  ? 'Planning application received · approval not recorded'
                  : 'Project stage not recorded',
            )}
          </strong>
        </p>
        <div className="housing-stage-legend">
          <span>{t('✓ Recorded')}</span>
          <span>{t('● Latest recorded stage')}</span>
          <span>{t('○ No record')}</span>
        </div>
        <ol className="housing-timeline">
          {stages.map((stage, index) => {
            const evidence = progress.milestones[index];
            return (
              <li
                key={stage.name}
                className={`housing-stage-${evidence.status}`}
                aria-current={evidence.status === 'latest' ? 'step' : undefined}
              >
                <div className="housing-step-number">
                  {t(evidence.status === 'recorded' ? '✓' : index + 1)}
                </div>
                <div className="housing-step-content">
                  <div className="housing-step-head">
                    <strong>{t(stage.name)}</strong>
                    <span className="housing-stage-badge">
                      {t(
                        evidence.status === 'latest'
                          ? 'Latest recorded'
                          : evidence.status === 'recorded'
                            ? 'Recorded'
                            : 'No record',
                      )}
                    </span>
                  </div>
                  <p>{t(stage.meaning)}</p>
                  <div className="housing-stage-date">
                    {evidence.date ? (
                      <time dateTime={evidence.date}>
                        {readableDate(evidence.date, intlLocale)}
                      </time>
                    ) : (
                      t('Date not recorded')
                    )}
                  </div>
                  {evidence.quote && (
                    <details className="housing-stage-source">
                      <summary>{t('View source')}</summary>
                      <blockquote lang="en">{evidence.quote}</blockquote>
                      <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {t('Read original notice ↗')}
                      </a>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="housing-panel housing-next" aria-labelledby="housing-next-heading">
        <div className="housing-section-label">{t('03 / VERIFY THE NEXT STEP')}</div>
        <h3 id="housing-next-heading">{t('Check the project status')}</h3>
        <p>
          {t(
            'Search the official project and permit systems, then match records using the address, application number and phase before drawing conclusions.',
          )}
        </p>
        {followUpQuestions.length > 0 && (
          <ul className="record-points">
            {followUpQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        )}
        <div className="housing-resources">
          {sources.map((s) => (
            <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">
              <strong>{t(s.label)} ↗</strong>
              <span>{t(s.detail)}</span>
            </a>
          ))}
        </div>
        {sourceUrl && (
          <p className="housing-original">
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              {t(
                isLive
                  ? 'Read the original Toronto public notice'
                  : 'Browse official City Council records',
              )}{' '}
              ↗
            </a>
          </p>
        )}
      </section>
    </div>
  );
}
