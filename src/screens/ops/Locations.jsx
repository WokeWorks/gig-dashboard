import { siteInScope } from '../../lib/scope.js';
import { AREAS, SITES } from '../../data.js';
import { GEO } from '../../lib/geo.js';
import { SiteMap } from '../../lib/livemap.jsx';
import { ScreenHeader, useToast } from '../../ui.jsx';

export function ClientsSites() {
  const toast = useToast();
  return (
    <>
      <ScreenHeader title="Locations" phase={1} spec="5.3" actions={<button className="btn" onClick={() => toast('Add a location: draw the geofence on the map, set hours and headcount')}>Add location</button>} />
      {AREAS.filter((a) => SITES.some((s) => s.area === a && siteInScope(s.id))).map((a) => (
        <section key={a} className="area-group">
          <div className="area-head"><h3>{a}</h3><span className="muted small">{SITES.filter((s) => s.area === a && siteInScope(s.id)).length} locations · {SITES.filter((s) => s.area === a && siteInScope(s.id)).reduce((x, s) => x + s.req, 0)} heads required</span></div>
          <div className="site-grid">
            {SITES.filter((s) => s.area === a && siteInScope(s.id)).map((s) => (
              <article key={s.id} className="card site">
                <SiteMap lat={GEO[s.id][1]} lng={GEO[s.id][0]} radius={s.radius} name={s.name} />
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
