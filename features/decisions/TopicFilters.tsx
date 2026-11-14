'use client';
import { useLanguage } from '@/features/language/LanguageProvider';
const topics = [
  'All topics',
  'Transportation',
  'Housing',
  'Budget',
  'Infrastructure',
  'News',
] as const;
export default function SecondaryTopics({
  topic,
  setTopic,
}: {
  topic: string;
  setTopic: (value: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <section className="secondary-nav">
      <div className="secondary-label">{t('TOPICS')}</div>
      <div className="filters">
        {topics.map((topicName) => (
          <button
            key={topicName}
            className={`pill ${topic === topicName ? 'selected' : 'g'}`}
            onClick={() => setTopic(topicName)}
          >
            {t(
              topicName === 'Housing'
                ? 'Housing & real estate'
                : topicName === 'Budget'
                  ? 'Taxes & budget'
                  : topicName,
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
