import Link from 'next/link';
import type { DetailedNotice } from '@/features/records/RecordDetails';
export default function MapView({
  live,
  mapReadyLive,
}: {
  live: DetailedNotice[];
  mapReadyLive: DetailedNotice[];
}) {
  return (
    <>
      <section className="page-heading map-heading">
        <div className="eyebrow">EXPLORE BY PLACE</div>
        <h1>
          What is happening
          <br />
          near you?
        </h1>
        <p>
          Use location to connect municipal notices with neighbourhoods. Only verified source
          coordinates will be plotted.
        </p>
      </section>

      <section className="map-workspace">
        <aside className="map-list">
          <div className="map-list-head">
            <strong>{mapReadyLive.length}</strong>
            <span>location-ready live records</span>
          </div>
          {mapReadyLive.length ? (
            mapReadyLive.slice(0, 8).map((n) => (
              <Link key={n.id} className="map-record" href={`/notices/${encodeURIComponent(n.id)}`}>
                <span className="topic">{n.topics[0] || 'Public notice'}</span>
                <b>{n.simple.plainTitle || n.title}</b>
                <small>
                  {n.addresses.find((a) => a.latitude !== null && a.longitude !== null)?.label ||
                    n.simple.where}
                </small>
              </Link>
            ))
          ) : (
            <div className="map-empty">
              No processed records with verified coordinates yet. Use <b>Update data</b> on Home,
              then return here.
            </div>
          )}
        </aside>
        <div className="map-stage">
          <div className="map-stage-inner">
            <span className="map-badge">MAP DEVELOPMENT AREA</span>
            <h2>Toronto basemap + verified municipal locations</h2>
            <p>
              The next implementation step will render these coordinate-ready records on an
              interactive map, with the same topic filters shown above.
            </p>
            <div className="map-readiness">
              <span>
                <b>{live.length}</b> processed live records
              </span>
              <span>
                <b>{mapReadyLive.length}</b> have coordinates
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
