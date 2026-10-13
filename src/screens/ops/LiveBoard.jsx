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
  useEffect(() => { if (pick) { const e = document.getElementById('lm-' + pick); if (e) e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, [pick]);
  const [cover, setCover] = useState(null);
  const [handled, setHandled] = useState({});
  const [mark, setMark] = useState(null); // { p, site, how, at, why, excused }
  const toast = useToast();
  const sites = SITES.filter(siteInScope).filter((s) => mgr === 'all' || MANAGERS.find((m) => m.id === mgr).sites.includes(s.id));
  const data = sites.map((s) => { const ppl = liveOf(s.id).map((p) => (handled[p.w.id] ? { ...p, status: handled[p.w.id] } : p)); const due = ppl.filter((p) => p.status !== 'upcoming'); const inn = due.filter((p) => ['in', 'late', 'break'].includes(p.status)).length; const bad = ppl.filter((p) => p.status === 'noshow').length; const late = ppl.filter((p) => p.status === 'late').length; return { s, ppl, due, inn, bad, late, up: ppl.filter((p) => p.status === 'upcoming') }; });
  const tot = data.reduce((a, d) => ({ due: a.due + d.due.length, inn: a.inn + d.inn, bad: a.bad + d.bad, late: a.late + d.late, up: a.up + d.up.length }), { due: 0, inn: 0, bad: 0, late: 0, up: 0 });
  const shown = data.filter((d) => only === 'all' || (only === 'noshow' ? d.bad : !d.bad)).sort((a, b) => b.bad * 10 + b.late - (a.bad * 10 + a.late));
  const actions = data.flatMap((d) => d.ppl.filter((p) => p.status === 'noshow' || p.status === 'late').map((p) => ({ ...p, site: d.s }))).sort((a, b) => LV[a.status][2] - LV[b.status][2]);
  const loc = openLoc && data.find((d) => d.s.id === openLoc);
  return (
    <>
      <ScreenHeader title="Liveboard" phase={1} spec="5.1" actions={<span className="lv-clock"><span className="lv-live" /><LiveClock /></span>} />
      <section className="card flush lm-wrap">
        <LiveMap points={shown.map((d) => { const [lng, lat] = GEO[d.s.id] || [55.2, 25.1]; return { id: d.s.id, name: d.s.name.replace(/^(Spinneys|Carrefour) /, ''), title: d.s.name, lat, lng, due: d.due.length, inn: d.inn, bad: d.bad, late: d.late, left: LEFT[d.s.id] }; })} pick={pick} onPick={setPick} />
        <div className="lm-over lm-filters">
          {isAdmin() && <label className="lm-sel"><Icon name="users" size={15} /><Select id="lb-mgr" value={mgr} onChange={(e) => { setMgr(e.target.value); setPick(null); }} aria-label="Manager"><option value="all">All managers</option>{MANAGERS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></label>}
          <div className="lm-chips" role="tablist" aria-label="Show">
            {[['all', 'All locations', null], ['noshow', 'With a no-show', 'crit'], ['ok', 'Everyone in', 'good']].map(([k, l, tone]) => (
              <button key={k} role="tab" aria-selected={only === k} className={'lm-chip' + (only === k ? ' on' : '')} onClick={() => { setOnly(k); setPick(null); }}>{tone && <span className={'lm-k ' + tone} />}{l}</button>
            ))}
          </div>
        </div>
        <div className="lm-over lm-stats">
          <div className={tot.inn ? 'good' : ''}><span className="lm-sv">{tot.inn}</span><span className="lm-sl">in now</span></div>
          <div className={tot.bad ? 'crit' : ''}><span className="lm-sv">{tot.bad}</span><span className="lm-sl">no-show</span></div>
          <div className={tot.late ? 'warn' : ''}><span className="lm-sv">{tot.late}</span><span className="lm-sl">late</span></div>
          <div><span className="lm-sv">{tot.up}</span><span className="lm-sl">later today</span></div>
        </div>
      </section>
      <section className="card flush lm-list">
        {shown.length === 0 && <div className="pad small muted lv-empty">No locations match.</div>}
        {shown.map((d) => {
          const on = pick === d.s.id;
          const issues = d.ppl.filter((p) => ['noshow', 'late', 'waiting'].includes(p.status)).sort((a, b) => LV[a.status][2] - LV[b.status][2]);
          return (
            <div key={d.s.id} className={'lm-row' + (on ? ' on' : '')} id={'lm-' + d.s.id}>
              <button className="lm-row-head" onClick={() => setPick(on ? null : d.s.id)} aria-expanded={on}>
                <span className={'lm-k ' + (d.bad ? 'crit' : d.due.length ? 'good' : 'idle')} />
                <span className="lm-name"><b>{d.s.name}</b>{isAdmin() && <span className="small muted">{MANAGERS.find((m) => m.sites.includes(d.s.id)).name}</span>}</span>
                <span className="lm-state small">{d.bad ? <span className="neg">{d.bad} no-show</span> : null}{d.bad && d.late ? <span className="muted"> · </span> : null}{d.late ? <span className="muted">{d.late} late</span> : null}{!d.bad && !d.late ? <span className="muted">{d.due.length ? 'All in' : 'No one due yet'}</span> : null}</span>
                <span className="lm-cnt mono">{d.inn}<span className="muted">/{d.due.length}</span></span>
              </button>
              {on && <div className="lm-detail">
                {issues.map((p) => (
                  <div key={p.w.id + p.start} className={'lm-p ' + p.status}>
                    <span className="lb-dot" /><button className="namelink" onClick={() => go('workforce', { worker: p.w.id })}>{p.w.name}</button>
                    <span className="small muted">{p.status === 'late' ? `in at ${hm(p.inAt)}, ${p.late} min late` : `due ${p.start}, not in`}</span>
                    <span className="lm-p-act">
                      {p.status !== 'late' && <button className="btn sm ghost" onClick={() => setMark({ p, site: d.s, how: 'here', at: p.start, why: 'Phone not working', excused: false })}>Mark attendance</button>}
                      {p.status === 'noshow' && <button className="btn sm" onClick={() => setCover({ ...p, site: d.s })}>Cover</button>}
                    </span>
                  </div>
                ))}
                <div className="lm-ok small muted">{d.ppl.filter((p) => ['in', 'break'].includes(p.status)).map((p) => p.w.name.split(' ')[0] + (p.status === 'break' ? ' (break)' : '')).join(', ') || 'Nobody in yet'}{d.up.length ? ` · ${d.up.length} starting at ${d.up.map((p) => p.start).sort()[0]}` : ''}</div>
                <button className="btn ghost sm" onClick={() => setOpenLoc(d.s.id)}>Today's timeline</button>
              </div>}
            </div>
          );
        })}
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
