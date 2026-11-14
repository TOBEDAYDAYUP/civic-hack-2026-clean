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
  return (
    <section className="secondary-nav">
      <div className="secondary-label">TOPICS</div>
      <div className="filters">
        {topics.map((t) => (
          <button
            key={t}
            className={`pill ${topic === t ? 'selected' : 'g'}`}
            onClick={() => setTopic(t)}
          >
            {t === 'Housing' ? 'Housing & real estate' : t === 'Budget' ? 'Taxes & budget' : t}
          </button>
        ))}
      </div>
    </section>
  );
}
