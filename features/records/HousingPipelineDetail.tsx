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
  },
  {
    name: 'Permit application',
  },
  {
    name: 'Permit issued',
  },
  {
    name: 'Construction started',
  },
  {
    name: 'Completion / occupancy',
  },
];

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
  const recordedStages = stages.flatMap((stage, index) => {
    const evidence = progress.milestones[index];
    return evidence.status === 'unknown' ? [] : [{ name: stage.name, ...evidence }];
  });
  if (progress.planningApplication) {
    recordedStages.unshift({
      name: 'Planning application received',
      status: recordedStages.length ? 'recorded' : 'latest',
      ...progress.planningApplication,
    });
  }
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
              <span lang="en">{area}</span>
            </div>
          )}
          {noticeStage && (
            <div>
              <strong>{t('Status')}</strong>
              <span lang="en">{noticeStage}</span>
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

      {recordedStages.length > 0 && (
        <section className="housing-panel" aria-labelledby="housing-timeline-heading">
          <h3 id="housing-timeline-heading">{t('Recorded project milestones')}</h3>
          <ol className="housing-timeline">
            {recordedStages.map(({ name, status, date, quote, sourceUrl }) => (
              <li
                key={name}
                className={'housing-stage-' + status}
                aria-current={status === 'latest' ? 'step' : undefined}
              >
                <div className="housing-step-number" aria-hidden="true">
                  ✓
                </div>
                <div className="housing-step-content">
                  <div className="housing-step-head">
                    <strong>{t(name)}</strong>
                    {status === 'latest' && recordedStages.length > 1 && (
                      <span className="housing-stage-badge">{t('Latest recorded')}</span>
                    )}
                  </div>
                  {date && (
                    <div className="housing-stage-date">
                      <time dateTime={date}>{readableDate(date, intlLocale)}</time>
                    </div>
                  )}
                  <details className="housing-stage-source">
                    <summary>{t('View source')}</summary>
                    <blockquote lang="en">{quote}</blockquote>
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                      {t('Read original notice ↗')}
                    </a>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

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
