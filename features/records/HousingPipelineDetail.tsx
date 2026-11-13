import React from 'react';
import { addressLabel } from '@/lib/address-label.mjs';

type HousingDetailProps = {
  sourceType: 'council decision' | 'public notice';
  summary: string;
  recordDate?: string | null;
  area?: string | null;
  noticeStage?: string | null;
  sourceUrl?: string;
  interpretation?: string;
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
  interpretation,
  interpretationSource,
  references = [],
  addresses = [],
}: HousingDetailProps) {
  const isLive = sourceType === 'public notice';
  const listedReferences = references.filter(Boolean);
  const listedAddresses = addresses.map(addressLabel).filter(Boolean);
  return (
    <div className="housing-detail">
      <section
        className="housing-panel housing-record-panel"
        aria-labelledby="housing-record-heading"
      >
        <div className="housing-section-label">01 / WHAT THE RECORD SAYS</div>
        <h3 id="housing-record-heading">What do we actually know?</h3>
        <p>{summary || 'This record does not include a plain-language description.'}</p>
        <div className="housing-facts">
          <div>
            <strong>Record type</strong>
            <span>{isLive ? 'City public notice' : 'Curated Council decision summary'}</span>
          </div>
          {recordDate && (
            <div>
              <strong>{isLive ? 'Notice published' : 'Council record date'}</strong>
              <span>{readableDate(recordDate)}</span>
            </div>
          )}
          {area && (
            <div>
              <strong>Area in record</strong>
              <span>{area}</span>
            </div>
          )}
          {noticeStage && (
            <div>
              <strong>Notice decision stage (AI summary)</strong>
              <span>{noticeStage}</span>
            </div>
          )}
          {listedAddresses.length > 0 && (
            <div>
              <strong>Addresses listed</strong>
              <ul className="address-list">
                {listedAddresses.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {listedReferences.length > 0 && (
            <div>
              <strong>Planning application references listed</strong>
              <span>{listedReferences.join(' · ')}</span>
            </div>
          )}
        </div>
        <p className="housing-caution">
          <strong>Important:</strong>{' '}
          {isLive
            ? 'This is a public notice, not a verified development-to-construction history.'
            : 'This is a Council policy/decision summary, not a verified record of an individual housing project.'}{' '}
          A notice date or Council decision date is not automatically a planning approval date.
        </p>
      </section>

      {interpretation && (
        <section className="housing-panel">
          <div className="housing-section-label">WHY THIS MAY MATTER</div>
          <h3>Why could this matter to residents?</h3>
          <p>{interpretation}</p>
          <p className="record-footnote">
            {interpretationSource ||
              'Interpretive context, not a measured or confirmed project outcome.'}
          </p>
        </section>
      )}

      <section className="housing-panel" aria-labelledby="housing-stages-heading">
        <div className="housing-section-label">02 / FROM APPROVAL TO HOMES</div>
        <h3 id="housing-stages-heading">Which project milestones does this notice establish?</h3>
        <p className="housing-subtext">
          This record does not include verified project milestone dates. The steps below explain
          what evidence to look for; they are not a progress report for this address.
        </p>
        <details className="milestone-guide">
          <summary>How to check the five development stages</summary>
          <ol className="housing-timeline">
            {stages.map((stage, index) => (
              <li key={stage.name}>
                <div className="housing-step-number">{index + 1}</div>
                <div className="housing-step-content">
                  <div className="housing-step-head">
                    <strong>{stage.name}</strong>
                  </div>
                  <p>{stage.meaning}</p>
                  <small>Evidence needed: {stage.check}</small>
                </div>
              </li>
            ))}
          </ol>
        </details>
        <p className="housing-caution">
          <strong>No delay calculation:</strong> Without two documented dates for the same
          project/phase, we cannot calculate time between stages or say the project has stalled.
        </p>
      </section>

      <section className="housing-panel housing-next" aria-labelledby="housing-next-heading">
        <div className="housing-section-label">03 / VERIFY THE NEXT STEP</div>
        <h3 id="housing-next-heading">Where can I check the status?</h3>
        <p>
          Search the official project and permit systems, then match records using the address,
          application number and phase before drawing conclusions.
        </p>
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
        <p className="housing-disclaimer">
          Challenge 5 prototype · These are verification steps, not a claim that the records have
          already been linked. Construction and occupancy require their own evidence. AI summaries
          are not a substitute for original records.
        </p>
      </section>
    </div>
  );
}
