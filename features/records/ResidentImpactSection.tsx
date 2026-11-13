import type { NoticeImpactPresentation } from '@/lib/impact-analysis.mjs';

export default function ResidentImpactSection({
  impacts,
  fromSavedAnalysis,
}: NoticeImpactPresentation) {
  return (
    <section className="record-section resident-impact" aria-labelledby="resident-impact-heading">
      <div className="record-eyebrow">WHY THIS MAY MATTER</div>
      <h3 id="resident-impact-heading">Why could this matter to residents?</h3>
      {impacts.length ? (
        <>
          <p className="resident-impact-intro">
            {impacts.length} relevant {impacts.length === 1 ? 'area' : 'areas'} identified from the
            available notice. Potential effects are not confirmed outcomes.
          </p>
          <ul className="resident-impact-list">
            {impacts.map((impact) => (
              <li className="resident-impact-card" key={impact.category}>
                <div className="resident-impact-label">
                  <strong>{impact.category}</strong>
                  <span>
                    {impact.certainty === 'confirmed' ? 'Stated in notice' : 'Possible effect'}
                  </span>
                </div>
                <p>{impact.explanation}</p>
                <details className="resident-impact-source">
                  <summary>Why is this included? View source excerpt</summary>
                  <blockquote>{impact.sourceExcerpt}</blockquote>
                </details>
              </li>
            ))}
          </ul>
          <p className="resident-impact-note">
            {fromSavedAnalysis
              ? 'Includes saved AI analysis. Some explanations may be derived directly from the notice.'
              : 'Preliminary explanation based on this notice. Individualized AI analysis may still be pending.'}{' '}
            Excerpts are matched against the notice text. An excerpt does not independently verify
            an interpretation.
          </p>
        </>
      ) : (
        <p>
          The available notice does not give enough detail to identify a specific effect on
          residents. That does not mean there will be no effect. Check the official notice for
          decisions and supporting documents.
        </p>
      )}
    </section>
  );
}
