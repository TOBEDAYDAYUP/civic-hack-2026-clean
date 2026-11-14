'use client';
import { useLanguage } from '@/features/language/LanguageProvider';
import type { NoticeImpactPresentation } from '@/lib/impact-analysis.mjs';

export default function ResidentImpactSection({
  impacts,
  fromSavedAnalysis,
}: NoticeImpactPresentation) {
  const { t } = useLanguage();
  return (
    <section className="record-section resident-impact" aria-labelledby="resident-impact-heading">
      <div className="record-eyebrow">{t('WHY THIS MAY MATTER')}</div>
      <h3 id="resident-impact-heading">{t('Why could this matter to residents?')}</h3>
      {impacts.length ? (
        <>
          <p className="resident-impact-intro">
            {t(
              '{count} relevant areas identified from the available notice. Potential effects are not confirmed outcomes.',
              { count: impacts.length },
            )}
          </p>
          <ul className="resident-impact-list">
            {impacts.map((impact) => (
              <li className="resident-impact-card" key={impact.category}>
                <div className="resident-impact-label">
                  <strong>{impact.category}</strong>
                  <span>
                    {t(impact.certainty === 'confirmed' ? 'Stated in notice' : 'Possible effect')}
                  </span>
                </div>
                <p lang="en">{impact.explanation}</p>
                <details className="resident-impact-source">
                  <summary>{t('Why is this included? View source excerpt')}</summary>
                  <blockquote lang="en">{impact.sourceExcerpt}</blockquote>
                </details>
              </li>
            ))}
          </ul>
          <p className="resident-impact-note">
            {t(
              fromSavedAnalysis
                ? 'Includes saved AI analysis. Some explanations may be derived directly from the notice.'
                : 'Preliminary explanation based on this notice. Individualized AI analysis may still be pending.',
            )}{' '}
            {t(
              'Excerpts are matched against the notice text. An excerpt does not independently verify an interpretation.',
            )}
          </p>
        </>
      ) : (
        <p>
          {t(
            'The available notice does not give enough detail to identify a specific effect on residents. That does not mean there will be no effect. Check the official notice for decisions and supporting documents.',
          )}
        </p>
      )}
    </section>
  );
}
