import { MANAGERS, SITES, ROSTER_GROUPS } from '../../data.js';
import { ScreenHeader, Drawer, Field, Toggle, useToast, Icon, Select } from '../../ui.jsx';
import { CoverDrawer } from '../../lib/cover.jsx';
import { hm, TODAY } from '../../lib/dates.js';
import { LiveClock } from '../../lib/clock.jsx';
import { GEO, LEFT } from '../../lib/geo.js';
import { LiveMap } from '../../lib/livemap.jsx';
import { isAdmin, SCOPE, siteInScope } from '../../lib/scope.js';
import { NOW_MIN, liveOf, LV } from '../../lib/live.js';

const { useState, useEffect, useRef } = React;

export function LiveBoard({ go }) {
  const [mgr, setMgr] = useState(isAdmin() ? 'all' : SCOPE.mgr);
  const [only, setOnly] = useState('all');
  const [openLoc, setOpenLoc] = useState(null);
  const [pick, setPick] = useState(null);
  const [panel, setPanel] = useState(null); // location open in the side panel (from a pin)
  const [cover, setCover] = useState(null);
  const [handled, setHandled] = useState({});
  const [mark, setMark] = useState(null); // { p, site, how, at, why, excused }
  const toast = useToast();
  const sites = SITES.filter(siteInScope).filter((s) => mgr === 'all' || MANAGERS.find((m) => m.id === mgr).sites.includes(s.id));
  const data = sites.map((s) => { const ppl = liveOf(s.id).map((p) => (handled[p.w.id] ? { ...p, status: handled[p.w.id] } : p)); const due = ppl.filter((p) => p.status !== 'upcoming'); const inn = due.filter((p) => ['in', 'late', 'break'].includes(p.status)).length; const bad = ppl.filter((p) => p.status === 'noshow').length; const late = ppl.filter((p) => p.status === 'late').length; return { s, ppl, due, inn, bad, late, up: ppl.filter((p) => p.status === 'upcoming') }; });
  const tot = data.reduce((a, d) => ({ due: a.due + d.due.length, inn: a.inn + d.inn, bad: a.bad + d.bad, late: a.late + d.late, up: a.up + d.up.length }), { due: 0, inn: 0, bad: 0, late: 0, up: 0 });
  const shown = data.filter((d) => only === 'all' || d.bad).sort((a, b) => b.bad * 10 + b.late - (a.bad * 10 + a.late));
  const actions = data.flatMap((d) => d.ppl.filter((p) => p.status === 'noshow' || p.status === 'late').map((p) => ({ ...p, site: d.s }))).sort((a, b) => LV[a.status][2] - LV[b.status][2]);
  const loc = openLoc && data.find((d) => d.s.id === openLoc);
  const pd = panel && data.find((d) => d.s.id === panel);
  return (
    <>
      <ScreenHeader title="Liveboard" phase={1} spec="5.1" actions={<span className="lv-clock"><span className="lv-live" /><LiveClock /></span>} />
      <section className="card flush lm-wrap lm-split">
        <div className="lm-mapcol">
          <LiveMap points={shown.map((d) => { const [lng, lat] = GEO[d.s.id] || [55.2, 25.1]; return { id: d.s.id, name: d.s.name.replace(/^(Spinneys|Carrefour) /, ''), title: d.s.name, lat, lng, due: d.due.length, inn: d.inn, bad: d.bad, late: d.late, left: LEFT[d.s.id] }; })} pick={panel} hover={pick} focus={panel} onPick={(id) => setPanel(id)} />
        </div>
        <aside className="lm-side" aria-label={pd ? pd.s.name : 'Locations'}>
          {!pd ? <>
            {isAdmin() && <div className="lm-side-mgr"><label className="lm-sel"><Icon name="users" size={15} /><Select id="lb-mgr" value={mgr} onChange={(e) => { setMgr(e.target.value); setPick(null); setPanel(null); }} aria-label="Manager"><option value="all">All managers</option>{MANAGERS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></label></div>}
            <div className="lm-side-stats">
              <div className={tot.inn ? 'good' : ''}><b>{tot.inn}</b><span>in now</span></div>
              <button className={'lm-stat-btn' + (tot.bad ? ' crit' : '') + (only === 'noshow' ? ' on' : '')} aria-pressed={only === 'noshow'} disabled={!tot.bad && only !== 'noshow'} onClick={() => { setOnly(only === 'noshow' ? 'all' : 'noshow'); setPick(null); }}><b>{tot.bad}</b><span>no-show</span></button>
              <div className={tot.late ? 'warn' : ''}><b>{tot.late}</b><span>late</span></div>
              <div><b>{tot.up}</b><span>later today</span></div>
            </div>
            <div className="lm-side-body lm-locs">
              {only === 'noshow' && <div className="lm-filtered small muted">Locations with a no-show <button className="linkbtn" onClick={() => setOnly('all')}>Show all</button></div>}
              {shown.length === 0 && <div className="small muted lm-none">No locations match.</div>}
              {shown.map((d) => (
                <button key={d.s.id} className={'lm-loc' + (pick === d.s.id ? ' on' : '')} onClick={() => { setPick(null); setPanel(d.s.id); }} onMouseEnter={() => setPick(d.s.id)} onMouseLeave={() => setPick((x) => (x === d.s.id ? null : x))} onFocus={() => setPick(d.s.id)} onBlur={() => setPick((x) => (x === d.s.id ? null : x))}>
                  <span className={'lm-k ' + (d.bad ? 'crit' : d.due.length ? 'good' : 'idle')} />
                  <span className="lm-name"><b>{d.s.name}</b><span className="small muted">{d.bad ? <span className="neg">{d.bad} no-show</span> : null}{d.bad && d.late ? ' · ' : null}{d.late ? `${d.late} late` : null}{!d.bad && !d.late ? (d.due.length ? 'All in' : 'No one due yet') : null}{isAdmin() ? ` · ${MANAGERS.find((m) => m.sites.includes(d.s.id)).name}` : ''}</span></span>
                  <span className="lm-cnt mono">{d.inn}<span className="muted">/{d.due.length}</span></span>
                  <Icon name="chevronRight" size={15} />
                </button>
              ))}
            </div>
          </> : (() => {
            const need = pd.ppl.filter((p) => ['noshow', 'waiting', 'late'].includes(p.status)).sort((a, b) => LV[a.status][2] - LV[b.status][2]);
            const inn = pd.ppl.filter((p) => ['in', 'break'].includes(p.status)).sort((a, b) => a.s0 - b.s0);
            const ups = [...pd.up].sort((a, b) => a.s0 - b.s0);
            const who = (p) => <button className="namelink" onClick={() => go('workforce', { worker: p.w.id })}>{p.w.name}</button>;
            return <>
              <div className="lm-panel-head">
                <button className="lm-panel-x" aria-label="Back to all locations" onClick={() => setPanel(null)}><Icon name="chevronLeft" size={17} /></button>
                <div className="lm-panel-title"><b>{pd.s.name}</b><span className="small muted">{[isAdmin() && MANAGERS.find((m) => m.sites.includes(pd.s.id)).name, pd.s.hours].filter(Boolean).join(' · ')}</span></div>
              </div>
              <div className="lm-side-stats">
                <div className={pd.inn ? 'good' : ''}><b>{pd.inn}</b><span>in now</span></div>
                <div className={pd.bad ? 'crit' : ''}><b>{pd.bad}</b><span>no-show</span></div>
                <div className={pd.late ? 'warn' : ''}><b>{pd.late}</b><span>late</span></div>
                <div><b>{pd.up.length}</b><span>later today</span></div>
              </div>
              <div className="lm-side-body">
                {need.length > 0 && <div className="lm-panel-sec"><h4>Needs you</h4>
                  {need.map((p) => (
                    <div key={p.w.id + p.start} className={'lm-pp ' + p.status}>
                      <span className="lb-dot" /><span className="lm-pp-who">{who(p)}<span className="small muted">{p.status === 'late' ? `In at ${hm(p.inAt)}, ${p.late} min late` : p.status === 'noshow' ? `No-show · due ${p.start}` : `Due ${p.start}, not in yet`}</span></span>
                      <span className="lm-p-act">
                        {p.status !== 'late' && <button className="btn sm ghost" onClick={() => setMark({ p, site: pd.s, how: 'here', at: p.start, why: 'Phone not working', excused: false })}>Mark attendance</button>}
                        {p.status === 'noshow' && <button className="btn sm" onClick={() => setCover({ ...p, site: pd.s })}>Cover</button>}
                      </span>
                    </div>
                  ))}
                </div>}
                <div className="lm-panel-sec"><h4>In now</h4>
                  {inn.length ? inn.map((p) => <div key={p.w.id + p.start} className="lm-pp in"><span className="lb-dot" /><span className="lm-pp-who">{who(p)}<span className="small muted">{p.status === 'break' ? 'On break' : `In at ${hm(p.inAt)}`} · until {p.end}</span></span></div>) : <div className="small muted">Nobody in yet.</div>}
                </div>
                {ups.length > 0 && <div className="lm-panel-sec"><h4>Later today</h4>
                  {ups.map((p) => <div key={p.w.id + p.start} className="lm-pp"><span className="lb-dot" /><span className="lm-pp-who">{who(p)}<span className="small muted">{p.start} – {p.end}</span></span></div>)}
                </div>}
              </div>
              <div className="lm-panel-foot">
                <button className="btn ghost sm" onClick={() => setOpenLoc(pd.s.id)}>Today's timeline</button>
                <button className="btn ghost sm" onClick={() => go('schedule')}>Open roster</button>
              </div>
            </>;
          })()}
        </aside>
      </section>
      <Drawer open={!!loc} onClose={() => setOpenLoc(null)} title={loc && loc.s.name} sub={loc && `Today · ${loc.inn} of ${loc.due.length} due are in · ${loc.up.length} starting later`}>
        {loc && <>
          <div className="lb-tl">
            <div className="lb-tl-axis">{[6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h} style={{ left: `${((h - 6) / 18) * 100}%` }}>{String(h % 24).padStart(2, '0')}:00</span>)}</div>
            <div className="lb-tl-now" style={{ left: `calc(130px + (100% - 130px) * ${(NOW_MIN - 360) / 1080})` }}><span>{hm(NOW_MIN)}</span></div>
            {[...loc.ppl].sort((a, b) => a.s0 - b.s0 || LV[a.status][2] - LV[b.status][2]).map((p) => {
              const X = (m) => `${Math.max(0, Math.min(100, ((m - 360) / 1080) * 100))}%`;
              const endM = p.e0 > p.s0 ? p.e0 : p.e0 + 1440;
              return (
                <div key={p.w.id + p.start} className="lb-tl-row">
                  <button className="lb-tl-who" onClick={() => go('workforce', { worker: p.w.id })}><b>{p.w.name}</b><span className={'small lb-st ' + p.status}>{LV[p.status][0]}{p.status === 'late' ? ` · ${p.late}m` : ''}</span></button>
                  <div className="lb-tl-track">
                    <span className="lb-tl-plan" style={{ left: X(p.s0), width: `calc(${X(Math.min(endM, 1440))} - ${X(p.s0)})` }} />
                    {p.inAt != null && <span className={'lb-tl-act ' + p.status} style={{ left: X(p.inAt), width: `calc(${X(NOW_MIN)} - ${X(p.inAt)})` }} />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="legend small lb-legend"><span className="lb-key plan" /> Rostered <span className="lb-key act" /> Clocked in <span className="lb-key late" /> Late</div>
          <div className="feed-actions"><button className="btn ghost" onClick={() => go('schedule')}>Open roster</button></div>
        </>}
      </Drawer>
      <Drawer open={!!mark} onClose={() => setMark(null)} title={mark && `Mark attendance · ${mark.p.w.name}`} sub={mark && `${mark.site.name} · due ${mark.p.start}`}>
        {mark && <>
          <div className="ma-opts" role="radiogroup" aria-label="Attendance">
            {[['here', 'They are here', 'Clocking in failed, but they are working'], ['absent', 'They are not coming', 'Close the shift as absent']].map(([k, l, sub]) => (
              <button key={k} role="radio" aria-checked={mark.how === k} className={'ob-opt' + (mark.how === k ? ' on' : '')} onClick={() => setMark({ ...mark, how: k })}><b>{l}</b><span className="small muted">{sub}</span></button>
            ))}
          </div>
          {mark.how === 'here' ? <div className="form-grid">
            <Field label="Arrived at"><input type="time" className="input" value={mark.at} onChange={(e) => setMark({ ...mark, at: e.target.value })} /></Field>
            <Field label="Why they couldn't clock in"><Select className="input" value={mark.why} onChange={(e) => setMark({ ...mark, why: e.target.value })}>{['Phone not working', 'Face check failing', 'Location not detected', 'No phone with them', 'Other'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          </div> : <Toggle id="ma-exc" checked={mark.excused} onChange={(v) => setMark({ ...mark, excused: v })} label="Excused (they called in, emergency)" />}
          <div className="small muted">Shows on their timesheet as marked by you, with the reason, so it can be told apart from a real clock-in.</div>
          <div className="drawer-actions"><button className="btn ghost" onClick={() => setMark(null)}>Cancel</button><span className="grow" /><button className="btn" onClick={() => { const n = mark.p.w.name.split(' ')[0]; setHandled({ ...handled, [mark.p.w.id]: mark.how === 'here' ? 'in' : 'absent' }); toast(mark.how === 'here' ? `${n} marked in at ${mark.at} · ${mark.why.toLowerCase()}` : `${n} marked absent${mark.excused ? ' (excused)' : ''}`); setMark(null); }}>{mark.how === 'here' ? 'Mark as here' : 'Mark as absent'}</button></div>
        </>}
      </Drawer>
      <CoverDrawer open={!!cover} onClose={() => setCover(null)}
        ctx={cover && { site: cover.site.id, ci: TODAY, absent: cover.w.id, sh: [cover.t, cover.start], dayLabel: 'Today', groups: ROSTER_GROUPS, why: `No-show: due ${cover.start}, not in after ${NOW_MIN - cover.s0} min` }}
        onSkip={() => { setHandled({ ...handled, [cover.w.id]: 'covered' }); setCover(null); toast('Left uncovered · stays a no-show on the timesheet'); }}
        onAssign={(x) => { setHandled({ ...handled, [cover.w.id]: 'covered' }); setCover(null); toast(`${x.w.name.split(' ')[0]} asked to cover at ${cover.site.name.replace(/^(Spinneys|Carrefour) /, '')} · push sent · ${cover.w.name.split(' ')[0]}'s day marked excused`); }} />
    </>
  );
}
