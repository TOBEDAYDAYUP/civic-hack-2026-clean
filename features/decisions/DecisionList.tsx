import Link from 'next/link';
import type { Decision } from '@/data/decisions';
const topicLabels: Record<string, string> = {
  Housing: 'Housing & real estate',
  Budget: 'Taxes & budget',
};
export default function DecisionList({
  visible,
  saved,
  toggleSaved,
}: {
  visible: Decision[];
  saved: number[];
  toggleSaved: (id: number) => void;
}) {
  return visible.length ? (
    <section className="grid">
      {visible.map((d) => (
        <article className="story" key={d.id}>
          <div className="story-tags">
            <span className="topic">{topicLabels[d.topic] || d.topic}</span>
            <span className="status">{d.status}</span>
          </div>
          <h3>
            <Link href={`/decisions/${d.id}`}>{d.title}</Link>
          </h3>
          <p className="summary">{d.summary}</p>
          <div className="story-bottom">
            <div className="story-meta">
              <span>{d.date}</span>
              <span>Toronto · {d.area}</span>
            </div>
            <Link className="story-open-link" href={`/decisions/${d.id}`}>
              Read full details →
            </Link>
            <button
              className={`save ${saved.includes(d.id) ? 'saved' : ''}`}
              onClick={() => toggleSaved(d.id)}
            >
              {saved.includes(d.id) ? '♥ Saved' : '♡ Save'}
            </button>
          </div>
        </article>
      ))}
    </section>
  ) : (
    <div className="empty">
      <h3>No matching decisions.</h3>
      <p>Change your filters or return to the full feed.</p>
    </div>
  );
}
