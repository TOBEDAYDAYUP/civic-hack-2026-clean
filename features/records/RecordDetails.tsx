import type { Decision } from '@/data/decisions';
import { recordContext } from '@/features/records/recordContext';
import HousingPipelineDetail from './HousingPipelineDetail';
import ResidentImpactSection from './ResidentImpactSection';
import { cleanResidentText, residentActions } from './resident-copy.mjs';
import { addressLabel } from '@/lib/address-label.mjs';
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
  !s ||
  /^(not specified|not provided|not applicable|unknown|n\/a|no (?:specific )?(?:deadline|date) (?:is )?(?:provided|specified|stated)|see (?:the )?(?:original|official) notice)/i.test(
    s.trim(),
  );

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
  const actions = residentActions(s.howToParticipate, notice.description);
  const deadline = cleanResidentText(s.participationDeadline);
  const addresses = notice.addresses.map((a) => addressLabel(a.label)).filter(Boolean);
  return (
    <div className="record-details">
      {housing ? (
        <HousingPipelineDetail
          sourceType="public notice"
          sourceText={notice.description}
          sourceTitle={notice.title}
          summary={cleanResidentText(s.whatIsHappening)}
          residentImpactSection={
            <ResidentImpactSection
              {...notice.residentImpact}
              addressLabels={notice.addresses.map((a) => a.label)}
            />
          }
          recordDate={notice.noticeDate}
          area={addressLabel(s.where)}
          noticeStage={s.decisionStage}
          addresses={addresses}
          references={notice.planningApplicationNumbers}
          sourceUrl={notice.sourceUrl}
        />
      ) : (
        <>
          <section className="record-section">
            <h3>What’s happening?</h3>
            <ShortPoints text={cleanResidentText(s.whatIsHappening)} />
            {addresses.length > 0 && <p>{addresses.join('; ')}</p>}
          </section>
          <ResidentImpactSection
            {...notice.residentImpact}
            addressLabels={notice.addresses.map((a) => a.label)}
          />
        </>
      )}
      {(actions.length > 0 || !notSpecified(deadline)) && (
        <section className="record-section">
          <h3>What can residents do?</h3>
          {actions.map((action) => (
            <p key={action}>{action}</p>
          ))}
          {!notSpecified(deadline) && (
            <p>
              <strong>Deadline:</strong> {deadline}
            </p>
          )}
        </section>
      )}
      <section className="record-section">
        <a
          className="record-source-link"
          href={notice.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Original source ↗
        </a>
      </section>
    </div>
  );
}
