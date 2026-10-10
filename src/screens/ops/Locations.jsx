import { AREAS, SITES } from '../../data.js';
import { ScreenHeader, useToast } from '../../ui.jsx';

export function ClientsSites() {
  const toast = useToast();
  return (
    <>
      <ScreenHeader title="Locations" phase={1} spec="5.3" desc="Each location has a geofence, operating hours, required headcount by role and attendance rules." actions={<button className="btn" onClick={() => toast('Add a location: draw the geofence on the map, set hours and headcount')}>Add location</button>} />
      {AREAS.map((a) => (
        <section key={a} className="area-group">
          <div className="area-head"><h3>{a}</h3><span className="muted small">{SITES.filter((s) => s.area === a).length} locations · {SITES.filter((s) => s.area === a).reduce((x, s) => x + s.req, 0)} heads required</span></div>
          <div className="site-grid">
            {SITES.filter((s) => s.area === a).map((s) => (
              <article key={s.id} className="card site">
                <svg viewBox="0 0 120 80" className="geo" aria-label={`Geofence radius ${s.radius} metres`}>
                  <rect width="120" height="80" className="geo-bg" />
                  <path d="M0 52 L120 38 M30 0 L44 80 M80 0 L70 80" className="geo-road" />
                  <circle cx="58" cy="44" r={s.radius / 6} className="geo-ring" />
                  <circle cx="58" cy="44" r="3.5" className="geo-pin" />
                </svg>
                <div className="site-body">
                  <div className="feed-top"><b>{s.name}</b><span className="mono small muted">{s.code}</span></div>
                  <div className="small">Geofence {s.radius} m · {s.hours}</div>
                  <div className="small muted">Rules: {s.policy}</div>
                  <div className="chips">{Object.entries(s.roles).map(([r, n]) => <span key={r} className="chip">{r} <b className="mono">{n}</b></span>)}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
