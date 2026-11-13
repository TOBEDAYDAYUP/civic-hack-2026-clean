import type { Decision } from '@/data/decisions';
import { recordContext } from '@/features/records/recordContext';
import HousingPipelineDetail from './HousingPipelineDetail';

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
  return (
    <div>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

/** Presentation only: keep every AI sentence, but make lengthy explanations scan-friendly. */
function ShortPoints({ text }: { text: string }) {
  if (notSpecified(text)) return <p>Not specified in the available record.</p>;
  const points = text
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <ul className="record-points">
      {points.map((point, i) => (
        <li key={i}>{point}</li>
      ))}
    </ul>
  );
}

function Questions({ items }: { items: readonly string[] }) {
  return (
    <ul className="record-points">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function CuratedRecordDetails({ decision }: { decision: Decision }) {
  const context = recordContext[decision.id];
  if (decision.topic === 'Housing') {
    return (
      <HousingPipelineDetail
        sourceType="council decision"
        summary={decision.summary}
        recordDate={decision.sortDate}
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
        <div className="record-eyebrow">01 / THE RECORD</div>
        <h3>What did Council decide?</h3>
        <p>{decision.summary}</p>
        <div className="record-facts">
          <Fact label="Record date" value={decision.date} />
          <Fact label="Area mentioned" value={decision.area} />
          <Fact label="Decision status" value={decision.status} />
          <Fact label="Source type" value="Council decision" />
        </div>
      </section>
      <section className="record-section">
        <div className="record-eyebrow">02 / RELEVANCE</div>
        <h3>Why might it matter?</h3>
        <p>
          {context?.significance ||
            'The decision may affect public services or planning. Check the Council report before assuming a particular outcome.'}
        </p>
      </section>
      <section className="record-section">
        <div className="record-eyebrow">03 / WHAT IS NOT YET CLEAR</div>
        <h3>What should we check next?</h3>
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
        <div className="record-eyebrow">04 / SOURCE & NEXT STEPS</div>
        <h3>Where can I verify this?</h3>
        <p>
          Locate the original item using the title and date in the City's Council and committee
          records.
        </p>
        <a
          className="record-source-link"
          href="https://www.toronto.ca/city-government/council/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Browse City of Toronto Council records ↗
        </a>
      </section>
    </div>
  );
}

export function LiveRecordDetails({ notice }: { notice: DetailedNotice }) {
  const housing = notice.topics.some((t) => /housing|planning|development/i.test(t));
  const s = notice.simple;
  if (housing) {
    return (
      <div className="record-details">
        <HousingPipelineDetail
          sourceType="public notice"
          summary={s.whatIsHappening}
          interpretation={s.whyItMatters || undefined}

          recordDate={notice.noticeDate}
          area={s.where}
          noticeStage={s.decisionStage}
          addresses={notice.addresses.map((a) => a.label)}
          references={notice.planningApplicationNumbers}
          sourceUrl={notice.sourceUrl}
        />
        <section className="record-section">
          <div className="record-eyebrow">PUBLIC PARTICIPATION / NOTICE DETAILS</div>
          <h3>What can residents do?</h3>
          <p>
            {notSpecified(s.howToParticipate)
              ? 'The available notice does not specify a participation method.'
              : s.howToParticipate}
          </p>
          <div className="record-facts">
            <Fact
              label="Deadline stated in notice"
              value={
                notSpecified(s.participationDeadline) ? 'Not specified' : s.participationDeadline
              }
            />
            <Fact
              label="Who may be affected"
              value={notSpecified(s.whoMayBeAffected) ? 'Not specified' : s.whoMayBeAffected}
            />
          </div>
          <h3>What remains uncertain?</h3>
          <p>
            {notSpecified(s.uncertainty)
              ? 'Project-level milestones and outcomes are not established here.'
              : s.uncertainty}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="record-details">
      <section className="record-section">
        <div className="record-eyebrow">01 / WHAT THE NOTICE SAYS</div>
        <h3>What is happening?</h3>
        <ShortPoints text={s.whatIsHappening} />
        <div className="record-facts">
          <Fact
            label="Stage described"
            value={notSpecified(s.decisionStage) ? 'Not specified' : s.decisionStage}
          />
          <Fact
            label="Location described"
            value={notSpecified(s.where) ? 'Not specified' : s.where}
          />
          <Fact
            label="Who may be affected"
            value={notSpecified(s.whoMayBeAffected) ? 'Not specified' : s.whoMayBeAffected}
          />
          {notice.noticeDate && (
            <Fact label="Public notice date" value={notice.noticeDate.slice(0, 10)} />
          )}
        </div>
      </section>
      <section className="record-section">
        <div className="record-eyebrow">02 / PERSONAL RELEVANCE</div>
        <h3>Why might this matter?</h3>
        <ShortPoints text={s.whyItMatters} />
      </section>
      <section className="record-section">
        <div className="record-eyebrow">03 / NEXT ACTION</div>
        <h3>How can residents participate?</h3>
        <ShortPoints text={s.howToParticipate} />
        <div className="record-facts">
          <Fact
            label="Deadline"
            value={
              notSpecified(s.participationDeadline)
                ? 'Not specified in source'
                : s.participationDeadline
            }
          />
        </div>
      </section>
      <section className="record-section">
        <div className="record-eyebrow">04 / SOURCE & UNCERTAINTY</div>
        <h3>What remains unclear?</h3>
        <p>
          {notSpecified(s.uncertainty)
            ? 'The available notice may not establish implementation or outcomes.'
            : s.uncertainty}
        </p>
        <a
          className="record-source-link"
          href={notice.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Read the original Toronto notice ↗
        </a>
        {notice.description && (
          <details className="record-source-excerpt">
            <summary>Show notice description provided to the system</summary>
            <p>{notice.description}</p>
          </details>
        )}
      </section>
    </div>
  );
}
