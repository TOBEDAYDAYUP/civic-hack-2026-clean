import Link from 'next/link';
import type { DetailedNotice } from '@/features/records/RecordDetails';
export default function NoticeFeed({
  live,
  sync,
  syncing,
  message,
}: {
  live: DetailedNotice[];
  sync: () => void;
  syncing: boolean;
  message: string;
}) {
  return (
    <section className="live-panel">
      <div className="live-panel-head">
        <div>
          <div className="eyebrow">LIVE DATA BETA</div>
          <h2>Latest Toronto notices, simplified locally.</h2>
          <p>
            Fetch current public notices, then use your local Qwen3.5:4b model to rewrite new or
            changed records in plain English.
          </p>
        </div>
        <button className="primary" onClick={sync} disabled={syncing}>
          {syncing ? 'Updating…' : 'Update data'}
        </button>
      </div>
      <div className="live-status">
        <span>
          <b>{live.length}</b> processed records stored locally
        </span>
        <span>{message || 'The official source remains the source of truth.'}</span>
      </div>
      {live.length ? (
        <div className="live-grid">
          {live.slice(0, 5).map((n) => (
            <article className="live-card" key={n.id}>
              <span className="topic">{n.topics[0] || 'Public notice'}</span>
              <h3>
                <Link href={`/notices/${encodeURIComponent(n.id)}`}>
                  {n.simple.plainTitle || n.title}
                </Link>
              </h3>
              <p>{n.simple.whatIsHappening}</p>
              <div className="live-card-meta">
                {n.simple.decisionStage} · {n.simple.where}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="live-empty">
          No locally processed live records yet. Start Ollama, then click <b>Update data</b>.
        </div>
      )}
    </section>
  );
}
