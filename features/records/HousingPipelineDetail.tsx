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

function readableDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-CA', {
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
        {!isLive && <div className="housing-section-label">01 / WHAT THE RECORD SAYS</div>}
        <h3 id="housing-record-heading">What’s happening?</h3>
        <p>{summary || 'This record does not include a plain-language description.'}</p>
        <div className="housing-facts">
          {!isLive && recordDate && (
            <div>
              <strong>{isLive ? 'Notice published' : 'Council record date'}</strong>
              <span>{readableDate(recordDate)}</span>
            </div>
          )}
          {!isLive && area && (
            <div>
              <strong>Area in record</strong>
              <span>{area}</span>
            </div>
          )}
          {!isLive && noticeStage && (
            <div>
              <strong>Status</strong>
              <span>{noticeStage}</span>
            </div>
          )}
          {listedAddresses.length > 0 && (
            <div>
              <strong>Location</strong>
              <ul className="address-list">
                {listedAddresses.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {listedReferences.length > 0 && (
            <div>
              <strong>Application number</strong>
              <span>{listedReferences.join(' · ')}</span>
            </div>
          )}
        </div>
      </section>

      {residentImpactSection ??
        (interpretation && (
          <section className="housing-panel">
            <div className="housing-section-label">WHY THIS MAY MATTER</div>
            <h3>What this means for you</h3>
            <p>{interpretation}</p>
          </section>
        ))}

      {progress.latest >= 0 && (
        <section className="housing-panel" aria-label="Project status">
          <h3>Project status</h3>
          <ul className="record-status-list">
            {stages.map((stage, index) => {
              const evidence = progress.milestones[index];
              if (evidence.status === 'unknown') return null;
              return (
                <li key={stage.name}>
                  <strong>{stage.name}</strong>
                  {evidence.date && (
                    <time dateTime={evidence.date}>{readableDate(evidence.date)}</time>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!isLive && (
        <section className="housing-panel housing-next" aria-labelledby="housing-next-heading">
          <div className="housing-section-label">03 / VERIFY THE NEXT STEP</div>
          <h3 id="housing-next-heading">Check the project status</h3>
          <p>
            Search the official project and permit systems, then match records using the address,
            application number and phase before drawing conclusions.
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
                <strong>{s.label} ↗</strong>
                <span>{s.detail}</span>
              </a>
            ))}
          </div>
          {sourceUrl && (
            <p className="housing-original">
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                {isLive
                  ? 'Read the original Toronto public notice'
                  : 'Browse official City Council records'}{' '}
                ↗
              </a>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
