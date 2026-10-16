import { MANAGERS, SITES, ROSTER_GROUPS } from '../../data.js';
import { Drawer, Field, Toggle, useToast, Icon, Select, Phase, Spec } from '../../ui.jsx';
import { CoverDrawer } from '../../lib/cover.jsx';
import { hm, TODAY } from '../../lib/dates.js';
import { useNow, clockTime } from '../../lib/clock.jsx';
import { GEO, LEFT } from '../../lib/geo.js';
import { LiveMap } from '../../lib/livemap.jsx';
import { isAdmin, SCOPE, siteInScope } from '../../lib/scope.js';
import { NOW_MIN, liveOf, LV } from '../../lib/live.js';

const { useState } = React;

// Liveboard: the totals across the top (each one filters the map and the list), the map filling the screen, and a
// column beside it that leads with the people who need action. Opening a location swaps the column for that location
// and puts today's timeline under the map. Status is carried by small dots; text stays in the two neutral tones.
const short = (n) => n.replace(/^(Spinneys|Carrefour) /, '');
const mgrOf = (sid) => MANAGERS.find((m) => m.sites.includes(sid));
const byStatus = (a, b) => LV[a.status][2] - LV[b.status][2];
const NEEDS = ['noshow', 'waiting', 'late'];
const DOT = { noshow: 'crit', late: 'warn', waiting: 'warn', in: 'good', break: 'idle', upcoming: 'ring', covered: 'idle', absent: 'idle' };
const WHEN = { covered: 'Covered', absent: 'Marked absent' };
const initials = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);
const span = (p) => (p.e0 > p.s0 ? p.e0 : p.e0 + 1440) - p.s0;
// What sits on the right of a person's row: a picture of their time rather than a sentence about it.
const Time = ({ p }) => {
  if (WHEN[p.status]) return <span className="live-chip quiet">{WHEN[p.status]}</span>;
  if (p.status === 'late') return <span className="live-chip" title={`In at ${hm(p.inAt)}`}>+{p.late}m</span>;
  if (p.status === 'upcoming') return <span className="live-chip" title={`${p.start} to ${p.end}`}>{p.start}</span>;
  if (p.status === 'in' || p.status === 'break') return (
    <span className="live-shift" title={`${p.status === 'break' ? 'On break' : 'In at ' + hm(p.inAt)} · ${p.start} to ${p.end}`}>
      <i className={p.status}><i style={{ width: `${Math.min(100, ((NOW_MIN - p.s0) / span(p)) * 100)}%` }} /></i><span>{p.end}</span>
    </span>
  );
  return null;
};
const Face = ({ p }) => <span className={'live-face ' + DOT[p.status]} role="img" aria-label={`${p.w.name}, ${LV[p.status][0]}`}>{initials(p.w.name)}</span>;
// The time large, the day small: the data is fixed to Wednesday 7 October, the time is live.
function Clock() {
  const t = useNow();
  return <span className="live-clock" aria-label={`Live, Wednesday 7 October, ${clockTime(t)}`}><span className="lv-live" /><b>{clockTime(t)}</b><span>Wed 7 Oct</span></span>;
}
const places = (n) => (n === 1 ? 'at 1 location' : `at ${n} locations`);

export function LiveBoard({ go }) {
  const [mgr, setMgr] = useState(isAdmin() ? 'all' : SCOPE.mgr);
  const [only, setOnly] = useState('all');
  const [hover, setHover] = useState(null);
  const [panel, setPanel] = useState(null); // the location open in the column
  const [cover, setCover] = useState(null);
  const [handled, setHandled] = useState({});
  const [mark, setMark] = useState(null); // { p, site, how, at, why, excused }
  const toast = useToast();

  const rows = SITES.filter(siteInScope).filter((s) => mgr === 'all' || MANAGERS.find((m) => m.id === mgr).sites.includes(s.id)).map((s) => {
    const ppl = liveOf(s.id).map((p) => (handled[p.w.id] ? { ...p, status: handled[p.w.id] } : p));
    const due = ppl.filter((p) => p.status !== 'upcoming');
    return { s, ppl, due, inn: due.filter((p) => ['in', 'late', 'break'].includes(p.status)).length, bad: ppl.filter((p) => p.status === 'noshow').length, late: ppl.filter((p) => p.status === 'late').length, up: ppl.filter((p) => p.status === 'upcoming') };
  });
  const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
  const next = Math.min(...rows.flatMap((r) => r.up.map((p) => p.s0)));
  const KPIS = [
    { k: 'in', label: 'In now', dot: 'good', n: sum((r) => r.inn), sub: `of ${sum((r) => r.due.length)} due`, has: (r) => r.inn },
    { k: 'noshow', label: 'No-show', dot: 'crit', n: sum((r) => r.bad), sub: places(rows.filter((r) => r.bad).length), has: (r) => r.bad },
    { k: 'late', label: 'Late', dot: 'warn', n: sum((r) => r.late), sub: places(rows.filter((r) => r.late).length), has: (r) => r.late },
    { k: 'later', label: 'Later today', dot: 'ring', n: sum((r) => r.up.length), sub: isFinite(next) ? `first at ${hm(next)}` : 'nobody else today', has: (r) => r.up.length },
  ];
  const f = KPIS.find((x) => x.k === only);
  const list = rows.filter((r) => !f || f.has(r)).sort((a, b) => b.bad * 10 + b.late - (a.bad * 10 + a.late));
  const flat = rows.flatMap((r) => r.ppl.map((p) => ({ ...p, site: r.s })));
  const open = panel && rows.find((r) => r.s.id === panel);
  const pickSite = (id) => { setHover(null); setPanel(id); };

  const person = (p, withSite) => (
    <div key={p.w.id + p.start} className="live-person">
      <Face p={p} />
      <div className="live-who">
        <button className="live-name" onClick={() => go('workforce', { worker: p.w.id })}>{p.w.name}</button>
        {withSite ? <button className="live-site" onClick={() => pickSite(p.site.id)}>{short(p.site.name)}</button>
          : ['noshow', 'waiting'].includes(p.status) && <span className="live-sub">Due {p.start}</span>}
      </div>
      {['noshow', 'waiting'].includes(p.status) ? (
        <span className="live-act">
          <button className="icon-btn" title="Mark attendance" aria-label={`Mark attendance for ${p.w.name}`} onClick={() => setMark({ p, site: p.site, how: 'here', at: p.start, why: 'Phone not working', excused: false })}><Icon name="checkCircle" size={17} /></button>
          {p.status === 'noshow' && <button className="btn sm" onClick={() => setCover(p)}>Cover</button>}
        </span>
      ) : <Time p={p} />}
    </div>
  );
  const group = (title, items, opts = {}) => (items.length > 0 || opts.empty) && (
    <section className="live-sec">
      <h3>{title}<span className="live-count">{items.length}</span></h3>
      {items.length ? items.map((p) => person(p, opts.site)) : <p className="live-sub">{opts.empty}</p>}
    </section>
  );

  return (
    <div className="live">
      <header className="live-head">
        <div className="live-title">
          <h1>Liveboard</h1>
          <span className="screen-tags"><Phase p={1} /><Spec s="5.1" /></span>
          <Clock />
        </div>
        {isAdmin() && (
          <label className="live-mgr">
            <Select id="lb-mgr" value={mgr} onChange={(e) => { setMgr(e.target.value); setPanel(null); }} aria-label="Manager">
              <option value="all">All managers</option>{MANAGERS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </label>
        )}
      </header>

      <div className="live-kpis" role="group" aria-label="Show locations with">
        {KPIS.map((x) => (
          <button key={x.k} className={'live-kpi' + (only === x.k ? ' on' : '')} aria-pressed={only === x.k} disabled={!x.n && only !== x.k} onClick={() => { setOnly(only === x.k ? 'all' : x.k); setPanel(null); }}>
            <span className="live-kpi-label"><span className={'sdot ' + x.dot} />{x.label}</span>
            <span className="live-kpi-n"><b>{x.n}</b><span>{x.sub}</span></span>
          </button>
        ))}
      </div>

      <div className="live-body">
        <div className={'live-mapcol' + (open ? ' with-tl' : '')}>
          <div className="live-map">
            <LiveMap points={list.map((r) => { const [lng, lat] = GEO[r.s.id] || [55.2, 25.1]; return { id: r.s.id, name: short(r.s.name), title: r.s.name, lat, lng, due: r.due.length, inn: r.inn, bad: r.bad, late: r.late, left: LEFT[r.s.id] }; })}
              pick={panel} hover={hover} focus={panel} onPick={pickSite} />
            {f && <button className="live-filter" onClick={() => setOnly('all')}>Locations with {f.label.toLowerCase()} <Icon name="x" size={14} /></button>}
          </div>
          {open && <Timeline row={open} go={go} />}
        </div>

        <aside className="live-side" aria-label={open ? open.s.name : 'Needs you and locations'}>
          {!open ? (
            <div className="live-pane" key="all">
              <div className="live-scroll">
                {group('No-shows', flat.filter((p) => p.status === 'noshow' || p.status === 'waiting').sort(byStatus), { site: true })}
                {group('Running late', flat.filter((p) => p.status === 'late'), { site: true })}
                <section className="live-sec">
                  <h3>Locations<span className="live-count">{list.length}</span></h3>
                  {!list.length && <p className="live-sub">No locations match.</p>}
                  {list.map((r) => (
                    <button key={r.s.id} className={'live-loc' + (hover === r.s.id ? ' hl' : '')} onClick={() => pickSite(r.s.id)}
                      onMouseEnter={() => setHover(r.s.id)} onMouseLeave={() => setHover((x) => (x === r.s.id ? null : x))} onFocus={() => setHover(r.s.id)} onBlur={() => setHover((x) => (x === r.s.id ? null : x))}>
                      <span className="live-who">
                        <b className="live-name">{short(r.s.name)}</b>
                        {/* one segment per person due: who is in, late or missing, at a glance */}
                        <span className="live-segs" role="img" aria-label={`${r.inn} of ${r.due.length} in${r.bad ? `, ${r.bad} no-show` : ''}${r.late ? `, ${r.late} late` : ''}`}>
                          {[...r.due].sort(byStatus).map((p) => <i key={p.w.id + p.start} className={DOT[p.status]} />)}
                        </span>
                      </span>
                      <span className="live-loc-n"><b>{r.inn}</b>/{r.due.length}</span>
                    </button>
                  ))}
                </section>
              </div>
            </div>
          ) : (
            <div className="live-pane" key={open.s.id}>
              <div className="live-site-head">
                <button className="icon-btn" onClick={() => setPanel(null)} aria-label="Back to all locations"><Icon name="chevronLeft" size={18} /></button>
                <div><h2>{open.s.name}</h2><span className="live-sub">{[isAdmin() && mgrOf(open.s.id).name, open.s.hours].filter(Boolean).join(' · ')}</span></div>
              </div>
              <div className="live-stats">
                {[['good', open.inn, 'In now'], ['crit', open.bad, 'No-show'], ['warn', open.late, 'Late'], ['ring', open.up.length, 'Later today']].map(([d, n, l]) => (
                  <div key={l}><b>{n}</b><span><span className={'sdot ' + (n ? d : 'ring')} />{l}</span></div>
                ))}
              </div>
              <div className="live-scroll">
                {group('Needs you', open.ppl.filter((p) => NEEDS.includes(p.status)).sort(byStatus).map((p) => ({ ...p, site: open.s })))}
                {group('In now', open.ppl.filter((p) => ['in', 'break'].includes(p.status)).sort((a, b) => a.s0 - b.s0), { empty: 'Nobody in yet.' })}
                {group('Later today', [...open.up].sort((a, b) => a.s0 - b.s0))}
                {group('Handled', open.ppl.filter((p) => ['covered', 'absent'].includes(p.status)))}
              </div>
              <div className="live-foot"><button className="btn ghost" onClick={() => go('schedule')}><Icon name="calendar" size={16} />Open roster</button></div>
            </div>
          )}
        </aside>
      </div>

      <Drawer open={!!mark} onClose={() => setMark(null)} title="Mark attendance">
        {mark && <>
          <div className="ma-who"><Face p={mark.p} /><div><b>{mark.p.w.name}</b><span>Due {mark.p.start} at {short(mark.site.name)}</span></div></div>
          <div className="ma-opts" role="radiogroup" aria-label="Attendance">
            {[['here', 'checkCircle', 'They are here', 'Clocking in failed, but they are working'], ['absent', 'x', 'They are not coming', 'Close the shift as absent']].map(([k, ic, l, sub]) => (
              <button key={k} role="radio" aria-checked={mark.how === k} className={'ob-opt ma-opt' + (mark.how === k ? ' on' : '')} onClick={() => setMark({ ...mark, how: k })}>
                <span className="ma-ic"><Icon name={ic} size={20} /></span><span className="ma-txt"><b>{l}</b><small>{sub}</small></span><span className="ma-radio" />
              </button>
            ))}
          </div>
          {mark.how === 'here' ? <>
            <Field label="Arrived at"><input type="time" className="input" value={mark.at} onChange={(e) => setMark({ ...mark, at: e.target.value })} /></Field>
            <div className="field"><span className="field-label">Why they couldn't clock in</span>
              <div className="ma-chips" role="radiogroup" aria-label="Why they couldn't clock in">
                {['Phone not working', 'Face check failing', 'Location not detected', 'No phone with them', 'Other'].map((x) => <button key={x} role="radio" aria-checked={mark.why === x} className={'ma-chip' + (mark.why === x ? ' on' : '')} onClick={() => setMark({ ...mark, why: x })}>{x}</button>)}
              </div>
            </div>
          </> : <div className="ma-row"><Toggle id="ma-exc" checked={mark.excused} onChange={(v) => setMark({ ...mark, excused: v })} label={<><b>Excused</b><small>They called in, or there's an emergency</small></>} /></div>}
          <p className="ma-note"><Icon name="document" size={17} />Shows on their timesheet as marked by you, with the reason, so it can be told apart from a real clock-in.</p>
          <div className="drawer-actions"><button className="btn ghost" onClick={() => setMark(null)}>Cancel</button><span className="grow" /><button className="btn" onClick={() => { const n = mark.p.w.name.split(' ')[0]; setHandled({ ...handled, [mark.p.w.id]: mark.how === 'here' ? 'in' : 'absent' }); toast(mark.how === 'here' ? `${n} marked in at ${mark.at} · ${mark.why.toLowerCase()}` : `${n} marked absent${mark.excused ? ' (excused)' : ''}`); setMark(null); }}>{mark.how === 'here' ? 'Mark as here' : 'Mark as absent'}</button></div>
        </>}
      </Drawer>
      <CoverDrawer open={!!cover} onClose={() => setCover(null)}
        ctx={cover && { site: cover.site.id, ci: TODAY, absent: cover.w.id, sh: [cover.t, cover.start], dayLabel: 'Today', groups: ROSTER_GROUPS, why: `No-show: due ${cover.start}, not in after ${NOW_MIN - cover.s0} min` }}
        onSkip={() => { setHandled({ ...handled, [cover.w.id]: 'covered' }); setCover(null); toast('Left uncovered · stays a no-show on the timesheet'); }}
        onAssign={(x) => { setHandled({ ...handled, [cover.w.id]: 'covered' }); setCover(null); toast(`${x.w.name.split(' ')[0]} asked to cover at ${short(cover.site.name)} · push sent · ${cover.w.name.split(' ')[0]}'s day marked excused`); }} />
    </div>
  );
}

// Today at one location, under the map: rostered shifts as dashed outlines, clock-ins as bars, a line at now.
const X = (m) => `${Math.max(0, Math.min(100, ((m - 360) / 1080) * 100))}%`; // 06:00 to 24:00
function Timeline({ row, go }) {
  return (
    <section className="live-tl" aria-label={`Today at ${row.s.name}`}>
      <header className="live-tl-head">
        <h3>Today at {short(row.s.name)}</h3>
        <span className="live-tl-key"><i className="plan" />Rostered<i className="act" />Clocked in</span>
      </header>
      <div className="live-tl-grid">
        <div className="live-tl-over" aria-hidden="true">
          {[6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h} className="live-tl-hour" style={{ left: X(h * 60) }}>{String(h % 24).padStart(2, '0')}:00</span>)}
          <span className="live-tl-now" style={{ left: X(NOW_MIN) }}><span>{hm(NOW_MIN)}</span></span>
        </div>
        {[...row.ppl].sort((a, b) => a.s0 - b.s0 || byStatus(a, b)).map((p) => {
          const end = p.e0 > p.s0 ? p.e0 : p.e0 + 1440;
          return (
            <div key={p.w.id + p.start} className="live-tl-row">
              <button className="live-tl-who" onClick={() => go('workforce', { worker: p.w.id })}>
                <Face p={p} /><b>{p.w.name}</b>
              </button>
              <div className="live-tl-track">
                <span className="live-tl-plan" style={{ left: X(p.s0), width: `calc(${X(Math.min(end, 1440))} - ${X(p.s0)})` }} />
                {p.inAt != null && <span className={'live-tl-act ' + DOT[p.status]} style={{ left: X(p.inAt), width: `calc(${X(NOW_MIN)} - ${X(p.inAt)})` }} />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
