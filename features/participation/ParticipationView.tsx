'use client';
import { useLanguage } from '@/features/language/LanguageProvider';
export default function ParticipationView() {
  const { t } = useLanguage();
  return (
    <>
      <section className="page-heading">
        <div className="eyebrow">{t('YOUR VOICE MATTERS')}</div>
        <h1>
          {t('Have a say in')}
          <br />
          {t('your city.')}
        </h1>
        <p>
          {t(
            'Use official City of Toronto channels to find meetings, committee speaking opportunities, public consultations and your councillor.',
          )}
        </p>
      </section>
      <section className="participation-grid">
        {[
          ['Find an upcoming meeting', 'https://www.toronto.ca/city-government/council/'],
          [
            'Contact your councillor',
            'https://www.toronto.ca/city-government/council/members-of-council/',
          ],
          [
            'Explore public consultations',
            'https://www.toronto.ca/community-people/get-involved/public-consultations/',
          ],
        ].map((x, i) => (
          <div className="info-card" key={x[0]}>
            <span className="number">
              0{i + 1}
              {t(' / GET INVOLVED')}
            </span>
            <h3>{t(x[0])}</h3>
            <p>{t('Check the official City source for current dates, rules and deadlines.')}</p>
            <a href={x[1]} target="_blank" rel="noreferrer">
              {t('Official City page ↗')}
            </a>
          </div>
        ))}
      </section>
    </>
  );
}
