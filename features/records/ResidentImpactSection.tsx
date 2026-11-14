import type { NoticeImpactPresentation } from '@/lib/impact-analysis.mjs';
import { impactCopy } from './resident-copy.mjs';

export default function ResidentImpactSection({
  impacts,
  addressLabels = [],
}: NoticeImpactPresentation & { addressLabels?: string[] }) {
  const relevant = impacts
    .map((impact) => ({ ...impact, explanation: impactCopy(impact.explanation, addressLabels) }))
    .filter((impact) => impact.explanation);
  if (!relevant.length) return null;
  return (
    <section className="record-section resident-impact" aria-labelledby="resident-impact-heading">
      <h3 id="resident-impact-heading">How this could affect you</h3>
      <ul className="resident-impact-list">
        {relevant.map((impact) => (
          <li className="resident-impact-card" key={impact.category}>
            <strong>{impact.category}</strong>
            <p>{impact.explanation}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
