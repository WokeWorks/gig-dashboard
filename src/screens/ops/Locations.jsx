import { siteInScope } from '../../lib/scope.js';
import { AREAS, SITES } from '../../data.js';
import { GEO } from '../../lib/geo.js';
import { SiteMap } from '../../lib/livemap.jsx';
import { ScreenHeader, useToast } from '../../ui.jsx';

const { useState } = React;

// Locations: every location on one shared day axis, grouped by area, so opening hours, team and geofence compare at
// a glance. Picking a row opens it on the right: map with the geofence, hours as a 24-hour dial, the team, the rules.
const AX0 = 5 * 60, AX = 22 * 60; // axis runs 05:00 to 03:00 the next day
const TICKS = [6, 12, 18, 24];
const at = (m) => `${((m - AX0) / AX) * 100}%`;
const mins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
// '06:00 – 02:00' → [360, 1560]: a close at or before the open is the next day
const span = (hours) => { const [a, b] = hours.split(/\s*[–-]\s*/).map(mins); return [a, b <= a ? b + 1440 : b]; };
const team = (s) => Object.values(s.roles).reduce((n, x) => n + x, 0);
// shift leads first, so the dots read the same way in every row
const people = (s) => Object.entries(s.roles).sort(([a], [b]) => (b === 'Shift lead') - (a === 'Shift lead')).flatMap(([r, n]) => Array(n).fill(r));
const plural = (n, w) => `${n} ${w.toLowerCase()}${n === 1 ? '' : 's'}`;

function Dots({ s, big }) {
  return <span className={'lc-dots' + (big ? ' big' : '')} aria-hidden="true">{people(s).map((r, i) => <i key={i} className={r === 'Shift lead' ? 'lead' : ''} style={{ '--i': i }} />)}</span>;
}

function Dial({ hours }) {
  const [a, b] = span(hours), S = 200, r = 84, c = 2 * Math.PI * r, arc = ((b - a) / 1440) * c;
  return (
    <span className="lc-dial" role="img" aria-label={`Open ${hours}, ${(b - a) / 60} hours a day`}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
        <circle cx={S / 2} cy={S / 2} r={r} className="lc-dial-track" />
        <circle cx={S / 2} cy={S / 2} r={r} className="lc-dial-arc" strokeDasharray={`${arc} ${c}`} style={{ '--len': arc }} transform={`rotate(${(a / 1440) * 360 - 90} ${S / 2} ${S / 2})`} />
        {[0, 6, 12, 18].map((h) => { const t = (h / 24) * 2 * Math.PI; return <text key={h} x={S / 2 + Math.sin(t) * 60} y={S / 2 - Math.cos(t) * 60 + 5}>{String(h).padStart(2, '0')}</text>; })}
      </svg>
      <span className="lc-dial-c"><b>{(b - a) / 60} h</b><span>open a day</span></span>
    </span>
  );
}

export function ClientsSites() {
  const toast = useToast();
  const sites = SITES.filter((s) => siteInScope(s.id));
  const [pick, setPick] = useState(sites[0]?.id);
  const sel = sites.find((s) => s.id === pick) || sites[0];
  const areas = AREAS.filter((a) => sites.some((s) => s.area === a));
  const maxR = Math.max(...sites.map((s) => s.radius));
  let n = 0; // running row index for the entrance stagger

  return (
    <>
      <ScreenHeader title="Locations" phase={1} spec="5.3" actions={<button className="btn" onClick={() => toast('Add a location: draw the geofence on the map, set hours and headcount')}>Add location</button>} />
      <p className="lc-lead"><b>{sites.length} locations</b> across {areas.length} areas · {sites.reduce((x, s) => x + team(s), 0)} people</p>

      <div className="lc">
        <section className="lc-list" aria-label="Locations">
          <div className="lc-row lc-head" aria-hidden="true">
            <span>Location</span><span>Team</span>
            <span className="lc-axis">{TICKS.map((h) => <span key={h} style={{ left: at(h * 60) }}>{String(h % 24).padStart(2, '0')}:00</span>)}</span>
            <span>Geofence</span>
          </div>
          {areas.map((a) => {
            const here = sites.filter((s) => s.area === a);
            return (
              <div key={a} className="lc-area">
                <h3 className="lc-area-h">{a}<span>{plural(here.length, 'location')} · {here.reduce((x, s) => x + team(s), 0)} people</span></h3>
                {here.map((s) => {
                  const [o, cl] = span(s.hours), d = 8 + (s.radius / maxR) * 22;
                  return (
                    <button key={s.id} className={'lc-row' + (s.id === sel?.id ? ' on' : '')} aria-pressed={s.id === sel?.id} onClick={() => { setPick(s.id); if (matchMedia('(max-width: 1100px)').matches) document.querySelector('.lc')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ '--i': n++ }}>
                      <span className="lc-name"><b>{s.name}</b><span>{s.code}</span></span>
                      <span className="lc-team"><Dots s={s} /><span>{team(s)}</span></span>
                      <span className="lc-hours">
                        {TICKS.map((h) => <i key={h} className="lc-tick" style={{ left: at(h * 60) }} />)}
                        <span className="lc-bar" style={{ left: at(o), width: `${((cl - o) / AX) * 100}%` }}>{s.hours}</span>
                      </span>
                      <span className="lc-fence"><i style={{ width: d, height: d }} />{s.radius} m</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </section>

        {sel && (
          <aside className="lc-panel" key={sel.id} aria-label={sel.name}>
            <div className="lc-map">
              <SiteMap lat={GEO[sel.id][1]} lng={GEO[sel.id][0]} radius={sel.radius} name={sel.name} height={300} width={560} />
              <span className="lc-map-tag">Geofence {sel.radius} m · opens Google Maps</span>
            </div>
            <div className="lc-title"><h2>{sel.name}</h2><span>{sel.code} · {sel.area}</span></div>
            <div className="lc-facts">
              <Dial hours={sel.hours} />
              <div className="lc-side">
                <div><span className="lc-k">Hours</span><b>{sel.hours}</b></div>
                <div>
                  <span className="lc-k">Team of {team(sel)}</span><Dots s={sel} big />
                  <span className="lc-roles">{Object.entries(sel.roles).map(([r, k]) => <span key={r}><i className={r === 'Shift lead' ? 'lead' : ''} />{plural(k, r)}</span>)}</span>
                </div>
              </div>
            </div>
            <dl className="wfx-kv">
              <dt>Rules</dt><dd>{sel.policy}</dd>
              <dt>Geofence</dt><dd>{sel.radius} m around the store<small>A clock-in outside it raises an alert</small></dd>
              <dt>Time zone</dt><dd>{sel.tz}</dd>
            </dl>
          </aside>
        )}
      </div>
    </>
  );
}
