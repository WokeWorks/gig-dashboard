import { WORKERS, DAYS, ROSTER, SHIFT_TEMPLATES, DESIG_ACCESS, tplOf, tplLabel, endOf, vendorOf, siteOf, spanOf, MAX_ON_SITE } from '../../data.js';
import { ScreenHeader, Pill, Tabs, Drawer, Avatar, Field, Toggle, Note, useToast, Select } from '../../ui.jsx';
import { FULL_DAYS, fmtRange } from '../../lib/dates.js';
import { LEAVE_TYPES, UAE_HOL, ltRule } from '../../lib/leave.js';
import { OFF_RULES } from '../../lib/offs.js';

const { useState } = React;

export function Settings({ params }) {
  const [tab, setTab] = useState(params?.tab || 'templates');
  const [lts, setLts] = useState(LEAVE_TYPES);
  const [desig, setDesig] = useState([
    { name: 'Picker', role: 'Employee', n: WORKERS.filter((w) => w.role === 'Picker').length },
    { name: 'Reliever', role: 'Floater', n: WORKERS.filter((w) => w.role === 'Reliever').length },
    { name: 'Shift lead', role: 'Employee', n: WORKERS.filter((w) => w.role === 'Shift lead').length },
    { name: 'Supervisor', role: 'Manager', n: 8 },
    { name: 'Senior Supervisor', role: 'Admin', n: 3 },
    { name: 'Operations Manager', role: 'Admin', n: 1 },
  ]);
  const [led, setLed] = useState(null);
  const [role, setRole] = useState('Employee');
  // Defaults from opspro-app: late after 10 min, no-show after 60 min, a 1 h unpaid break,
  // auto clock-out 30 min after the rostered end. Each access level can change them.
  const BASE_R = { grace: 10, noshow: 60, early: 15, rounding: '5', full: 'base2', half: 'half', breaks: true, brkMin: 60, brkPaid: 'unpaid', auto: true, autoMin: 30 };
  const [pr, setPr] = useState({ Employee: BASE_R, Floater: { ...BASE_R, early: 90, coverEarly: 90, coverLate: 240 }, Manager: { ...BASE_R, track: true, breaks: false } });
  const rp = pr[role];
  const setR = (k, v) => setPr({ ...pr, [role]: { ...pr[role], [k]: v } });
  const [p, setP] = useState({ grace: 10, noshow: 60, early: 15, rounding: '5', full: 'base2', half: 'half', breaks: true, brkMin: 60, brkPaid: 'unpaid', auto: true, autoMin: 30, beyond: 'approval', hol: true, maxOff: 2, holCal: 'uae', offs: OFF_RULES.perWeek, sameDay: OFF_RULES.sameDay, offWork: 'ot', maxRun: OFF_RULES.maxRun, offMode: OFF_RULES.mode, offDays: OFF_RULES.days });
  const [tpl, setTpl] = useState(SHIFT_TEMPLATES);
  const toast = useToast();
  const set = (k, v) => setP({ ...p, [k]: v });
  const [ed, setEd] = useState(null); // { id|null, start, base, brk, step, from, notify }
  const edOrig = ed && ed.id ? tpl.find((x) => x.id === ed.id) : null;
  const edChanged = ed && (!edOrig || edOrig.base !== ed.base || edOrig.brk !== ed.brk);
  const openEd = (t) => (setAffQ(''), setEd)(t ? { id: t.id, base: t.base, brk: t.brk || 0, step: 'edit', from: 'next', notify: true } : { id: null, base: 9, brk: 1, step: 'edit', from: 'next', notify: true });
  const clashes = (() => {
    if (!ed || !ed.id) return [];
    const m = (x) => { const [h, mm] = x.split(':').map(Number); return h * 60 + mm; };
    const out = [];
    ROSTER.forEach((row, r) => row.forEach((cell, c) => {
      if (!Array.isArray(cell) || !cell.some((x) => x[0] === ed.id) || cell.length < 2) return;
      const iv = cell.map((x) => x[0] === ed.id ? [m(x[1]), m(x[1]) + (ed.base + ed.brk) * 60] : [m(x[1]), m(x[1]) + spanOf(tplOf(x[0])) * 60]).sort((a, b) => a[0] - b[0]);
      if (iv.some((v, i) => i && v[0] < iv[i - 1][1])) out.push({ wid: WORKERS[r].id, name: WORKERS[r].name, day: DAYS[c] });
    }));
    return out;
  })();
  // Who is on a shift this week: real roster rows first, then the rest of the workforce to match the count.
  const affected = (() => {
    if (!edOrig || !edOrig.used) return [];
    const rows = [];
    ROSTER.forEach((row, r) => {
      const days = []; let loc = null;
      row.forEach((cell, c) => { if (Array.isArray(cell)) cell.forEach((x) => { if (x[0] === edOrig.id) { days.push(c); loc = loc || x[2] || 's3'; } }); });
      if (days.length) rows.push({ w: WORKERS[r], days, site: loc });
    });
    const seed = edOrig.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    for (let k = 0; rows.length < edOrig.used && k < 32; k++) {
      const w = WORKERS[8 + ((seed + k * 5) % 32)];
      if (rows.some((x) => x.w.id === w.id)) continue;
      const off = (seed + k) % 7;
      rows.push({ w, days: [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== off && d !== (off + 3) % 7 || (k % 3 === 0 && d === (off + 3) % 7)), site: w.site });
    }
    return rows.map((x) => ({ ...x, clash: clashes.filter((c) => c.wid === x.w.id).map((c) => c.day) }));
  })();
  const [affQ, setAffQ] = useState('');
  const renderAffected = ({ withClash }) => {
    const list = affected.filter((x) => !affQ || x.w.name.toLowerCase().includes(affQ.toLowerCase())).sort((a, b) => (withClash ? b.clash.length - a.clash.length : 0));
    return (
      <section className="afflist">
        <div className="afflist-head"><h3>{withClash ? 'Affected employees' : 'On this shift this week'} <span className="muted">({affected.length})</span></h3>
          {affected.length > 6 && <input id="aff-q" className="input sm" placeholder="Search" value={affQ} onChange={(e) => setAffQ(e.target.value)} />}</div>
        <div className="afflist-body">{list.map((x) => (
          <div key={x.w.id} className={'affrow' + (withClash && x.clash.length ? ' clash' : '')}>
            <Avatar name={x.w.name} />
            <div className="aff-who"><b>{x.w.name}</b><span className="small muted"><span className="vtag">{vendorOf(x.w.vendor).code}</span> {siteOf(x.site).name} · {x.w.role}</span>
              {withClash && x.clash.length > 0 && <span className="small neg">Overlaps another shift on {x.clash.join(', ')}</span>}</div>
            <div className="aff-days">{DAYS.map((d, i) => <span key={d} className={'affday' + (x.days.includes(i) ? ' on' : '') + (withClash && x.clash.includes(d) ? ' bad' : '')} title={d}>{d[0]}</span>)}</div>
          </div>
        ))}{list.length === 0 && <div className="small muted pad">No one matches.</div>}</div>
      </section>
    );
  };
  const applyEd = () => {
    if (ed.id) { setTpl(tpl.map((t) => (t.id === ed.id ? { ...t, start: ed.start, base: ed.base, brk: ed.brk } : t))); toast(edOrig.used ? `Shift updated for ${edOrig.used} ${edOrig.used === 1 ? 'employee' : 'employees'}${ed.notify ? ' · they have been notified' : ''}` : 'Shift updated'); }
    else { setTpl([...tpl, { id: 'f' + Date.now(), start: ed.start, base: ed.base, brk: ed.brk, used: 0 }]); toast('Shift added · assign it on the roster'); }
    setEd(null);
  };
    return (
    <>
      <ScreenHeader title="Settings" phase={1} spec="5.10" actions={<button className="btn" onClick={() => toast('Saved · applies from the next shift')}>Save</button>} />
      <Tabs tabs={[{ id: 'templates', label: 'Shifts' }, { id: 'policy', label: 'Attendance rules' }, { id: 'leave', label: 'Leave types' }, { id: 'roles', label: 'Roles & access' }]} value={tab} onChange={setTab} />
      {tab === 'templates' && <>
        <section className="card flush">
          <div className="card-head pad"><h3>Shifts</h3><span className="small muted">A shift is a length: hours worked plus an unpaid break. The start time is picked on the roster, so one shift works for mornings, evenings and nights.</span></div>
          <div className="table-wrap"><table className="table tpl">
            <thead><tr><th>Shift</th><th>Worked</th><th>Unpaid break</th><th>On site</th><th>Assigned this week</th><th></th></tr></thead>
            <tbody>{[...tpl].sort((x, y) => y.base - x.base || (y.brk || 0) - (x.brk || 0)).map((t) => { return (
              <tr key={t.id} className="rowlink" onClick={() => openEd(t)} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && openEd(t)}>
                <td><span className="tpl-chip mono">{tplLabel(t)}</span></td>
                <td className="mono">{t.base} h</td>
                <td className="mono">{t.brk ? t.brk + ' h' : <span className="muted">—</span>}</td><td className="mono">{spanOf(t)} h</td>
                <td>{t.used ? <span>{t.used} {t.used === 1 ? 'employee' : 'employees'}</span> : <span className="muted">Nobody</span>}</td>
                <td className="num"><span className="rowedit">Edit</span></td>
              </tr>
            ); })}</tbody>
          </table></div>
          <div className="pad"><button className="btn ghost sm" onClick={() => openEd(null)}>Add shift</button></div>
        </section>
        <Drawer open={!!ed} onClose={() => setEd(null)} title={ed && ed.id ? 'Edit shift' : 'New shift'} sub={ed && tplLabel(ed)}>
          {ed && ed.step === 'edit' && <>
            <div className="form-grid">

              <Field label="Hours worked" hint="What's paid and billed."><div className="unit-in"><input id="ed-base" className="input mono" type="number" min="1" max="12" value={ed.base} onChange={(e) => setEd({ ...ed, base: +e.target.value })} /><span>h</span></div></Field>
              <Field label="Unpaid break" hint={`On site ${ed.base + ed.brk} h${ed.base + ed.brk > MAX_ON_SITE ? `, over the ${MAX_ON_SITE} h maximum` : ''}.`}><div className="unit-in"><input id="ed-brk" className="input mono" type="number" min="0" max="2" value={ed.brk} onChange={(e) => setEd({ ...ed, brk: +e.target.value })} /><span>h</span></div></Field>
            </div>
            {edOrig && (edOrig.used ? renderAffected({}) : <div className="small muted">Nobody is on this shift this week.</div>)}
            <div className="drawer-actions">
              {edOrig && edOrig.used === 0 && <button className="btn ghost danger" onClick={() => { setTpl(tpl.filter((x) => x.id !== ed.id)); setEd(null); toast('Shift removed'); }}>Remove shift</button>}
              <span className="grow" />
              <button className="btn ghost" onClick={() => setEd(null)}>Cancel</button>
              <button className="btn" disabled={!edChanged || ed.base < 1 || ed.base + ed.brk > MAX_ON_SITE} onClick={() => (edOrig && edOrig.used ? setEd({ ...ed, step: 'confirm' }) : applyEd())}>Confirm</button>
            </div>
          </>}
          {ed && ed.step === 'confirm' && edOrig && <>
            <section className="impact">
              <div className="impact-num">{edOrig.used}</div>
              <div><b>{edOrig.used === 1 ? 'employee is' : 'employees are'} on this shift this week</b><div className="small muted">Their start times stay the same; end times and attendance rules follow the new length.</div></div>
            </section>
            <table className="table diff"><thead><tr><th></th><th>Now</th><th>After</th></tr></thead><tbody>
              {[['Hours worked', edOrig.base + ' h', ed.base + ' h'], ['Unpaid break', (edOrig.brk || 0) + ' h', ed.brk + ' h'], ['A 07:00 start ends', endOf('07:00', edOrig.base + (edOrig.brk || 0)).time, endOf('07:00', ed.base + (ed.brk || 0)).time]].map(([k, a, b]) => <tr key={k} className={a !== b ? 'changed' : ''}><td>{k}</td><td className="mono">{a}</td><td className="mono"><b>{b}</b></td></tr>)}
            </tbody></table>
            {clashes.length > 0 && <div className="row-line"><Pill tone="crit">{clashes.length} {clashes.length === 1 ? 'overlap' : 'overlaps'}</Pill><span className="small">The new length makes a shift overlap another one for the people marked below. Fix them on the roster after applying.</span></div>}
            {renderAffected({ withClash: true })}
            <Field label="Apply from"><Select id="ed-from" className="input" value={ed.from} onChange={(e) => setEd({ ...ed, from: e.target.value })}><option value="next">Next week (Mon 12 Oct), this week stays as it is</option><option value="tomorrow">Tomorrow (Thu 8 Oct), including the rest of this week</option></Select></Field>
            <Toggle id="ed-notify" checked={ed.notify} onChange={(v) => setEd({ ...ed, notify: v })} label={`Notify the ${edOrig.used} affected ${edOrig.used === 1 ? 'employee' : 'employees'} in the app`} />
            <div className="drawer-actions">
              <button className="btn ghost" onClick={() => setEd({ ...ed, step: 'edit' })}>Back</button>
              <span className="grow" />
              <button className="btn" onClick={applyEd}>Apply to {edOrig.used} {edOrig.used === 1 ? 'employee' : 'employees'}</button>
            </div>
          </>}
        </Drawer>
        <Note>"+1" is one hour of optional overtime after the base hours. A worker can leave at the end of the base hours with a full shift; if they stay, the extra time is overtime. On the roster you pick a shift and a start time; the end is worked out from the length, including shifts that finish after midnight.</Note>
      </>}
      {tab === 'policy' && <>
        <div className="role-bar">
          <span className="small muted">Rules for</span>
          <div className="seg" role="tablist" aria-label="Access level">{['Employee', 'Floater', 'Manager'].map((r) => <button key={r} role="tab" aria-selected={role === r} className={'seg-btn' + (role === r ? ' on' : '')} onClick={() => setRole(r)}>{r}<span className="seg-n">{desig.filter((d) => d.role === r).reduce((a, d) => a + d.n, 0)}</span></button>)}</div>
          <span className="small muted">{desig.filter((d) => d.role === role).map((d) => d.name).join(', ') || 'No designations'}</span>
        </div>
        {role === 'Manager' && <section className="card form role-track">
          <Toggle id="pol-track" checked={rp.track} onChange={(v) => setR('track', v)} label="Managers clock in and out too" />
          <div className="small muted">{rp.track ? 'Their no-shows and late starts go to the admins, not to themselves.' : 'Managers are not tracked: no clock-in, no timesheet, no attendance alerts.'}</div>
        </section>}
        {(role !== 'Manager' || rp.track) && <div className="policy-grid">
          <section className="card form">
            <div className="card-head"><h3>Attendance</h3><Pill>{role}s</Pill></div>
            <div className="form-grid">
              <Field label="Grace period"><div className="unit-in"><input id="pol-grace" className="input" type="number" value={rp.grace} onChange={(e) => setR('grace', +e.target.value)} /><span>min</span></div></Field>
              <Field label="No-show after"><div className="unit-in"><input id="pol-noshow" className="input" type="number" value={rp.noshow} onChange={(e) => setR('noshow', +e.target.value)} /><span>min</span></div></Field>
{role !== 'Floater' &&               <Field label="Earliest clock-in"><div className="unit-in"><input id="pol-early" className="input" type="number" value={rp.early} onChange={(e) => setR('early', +e.target.value)} /><span>min before</span></div></Field>}
              <Field label="Rounding"><Select id="pol-round" className="input" value={rp.rounding} onChange={(e) => setR('rounding', e.target.value)}><option value="0">None</option><option value="5">Nearest 5 min</option><option value="15">Nearest 15 min</option></Select></Field>
            </div>
            <Field label="A shift counts as a full day when the worker works"><Select id="pol-full" className="input" value={rp.full} onChange={(e) => setR('full', e.target.value)}>
              <option value="all">All of the base hours</option><option value="base1">All but 1 hour of the base hours</option><option value="base2">All but 2 hours of the base hours</option><option value="pct90">At least 90% of the base hours</option></Select></Field>
            <Field label="It counts as a half day when the worker works"><Select id="pol-half" className="input" value={rp.half} onChange={(e) => setR('half', e.target.value)}>
              <option value="half">At least half of the base hours</option><option value="4h">At least 4 hours</option><option value="none">No half days: less than a full day is absent</option></Select></Field>
            <div className="small muted">Example for an 11+1 shift: full day from {{ all: '11 h', base1: '10 h', base2: '9 h', pct90: '9 h 54 m' }[rp.full]} worked{rp.half !== 'none' && `, half day from ${rp.half === 'half' ? '5 h 30 m' : '4 h'}`}. The optional hour never counts towards this.</div>
          </section>
          {role === 'Floater' && <section className="card form">
            <div className="card-head"><h3>Covering a shift</h3><Pill>Floaters</Pill></div>
            <div className="form-grid">
              <Field label="Clock-in opens"><div className="unit-in"><input id="pol-cin" className="input" type="number" value={rp.coverEarly} onChange={(e) => setR('coverEarly', +e.target.value)} /><span>min before</span></div></Field>
              <Field label="Clock-out allowed until"><div className="unit-in"><input id="pol-cout" className="input" type="number" value={rp.coverLate} onChange={(e) => setR('coverLate', +e.target.value)} /><span>min after</span></div></Field>
            </div>
            <div className="small muted">They clock in at the location they're covering, inside its geofence, and must clock out there too. Days without a cover aren't tracked and aren't paid.</div>
          </section>}
          <section className="card form">
            <div className="card-head"><h3>Weekly offs</h3><Pill>Whole organisation</Pill></div>
            <div className="seg off-mode" role="group" aria-label="How weekly offs are given">
              <button className={p.offMode === 'roster' ? 'on' : ''} onClick={() => { set('offMode', 'roster'); OFF_RULES.mode = 'roster'; }}><b>Staggered on the roster</b><span className="small muted">Each worker's off is picked every week, so someone is always on shift</span></button>
              <button className={p.offMode === 'fixed' ? 'on' : ''} onClick={() => { set('offMode', 'fixed'); OFF_RULES.mode = 'fixed'; }}><b>Same day for everyone</b><span className="small muted">The organisation doesn't work on these days, e.g. Sundays</span></button>
            </div>
            {p.offMode === 'fixed' ? <Field label="Weekly off" hint="Everyone is off on these days. A roster with any shift on them is rejected.">
              <div className="wk-pick" role="group" aria-label="Weekly off days">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, k) => { const on = p.offDays.includes(k); return (
                <button key={k} className={'wk-day' + (on ? ' on' : '')} aria-pressed={on} title={FULL_DAYS[k]} onClick={() => { const next = on ? p.offDays.filter((x) => x !== k) : [...p.offDays, k].sort(); if (!next.length) { toast('At least one weekly off is required'); return; } if (next.length > 3) return; set('offDays', next); OFF_RULES.days = next; }}>{d}</button>
              ); })}</div>
              <div className="small muted" style={{ marginTop: 6 }}>{p.offDays.map((k) => FULL_DAYS[k]).join(' and ')} off · {p.offDays.length} a week</div>
            </Field> : <div className="form-grid">
              <Field label="Weekly offs per worker" hint="At least 1. Enforced: rosters without it are rejected on upload and can't be published."><div className="unit-in"><input id="pol-offs" className="input" type="number" min="1" max="3" value={p.offs} onChange={(e) => { const v = Math.max(1, Math.min(3, +e.target.value || 1)); set('offs', v); OFF_RULES.perWeek = v; }} /><span>a week</span></div></Field>
              <Field label="Most people off at one location on the same day" hint="Keeps offs staggered so someone is always on shift. A warning only."><div className="unit-in"><input id="pol-sameday" className="input" type="number" min="1" max="9" value={p.sameDay} onChange={(e) => { set('sameDay', +e.target.value); OFF_RULES.sameDay = +e.target.value; }} /><span>people</span></div></Field>
            </div>}
            <div className="form-grid">
              <Field label="Most working days in a row"><div className="unit-in"><input id="pol-run" className="input" type="number" min="1" max="13" value={p.maxRun} onChange={(e) => { set('maxRun', +e.target.value); OFF_RULES.maxRun = +e.target.value; }} /><span>days</span></div></Field>
              <Field label="Working on a weekly off"><Select id="pol-offwork" className="input" value={p.offWork} onChange={(e) => set('offWork', e.target.value)}><option value="ot">Allowed, paid at the rest-day rate</option><option value="swap">Allowed, with a replacement day off</option><option value="none">Not allowed</option></Select></Field>
            </div>
            <div className="small muted">Set once for the organisation and applies to every role. A weekly off is never counted as absent.</div>
          </section>
          <section className="card form">
            <div className="card-head"><h3>Breaks</h3></div>
            <Toggle id="pol-brk" checked={rp.breaks} onChange={(v) => setR('breaks', v)} label="Workers take breaks during the shift" />
            {rp.breaks && <>
              <Field label="Break allowance per shift" hint="Workers can split it into as many breaks as they need, for prayer, food or a smoke."><div className="unit-in"><input id="pol-brkmin" className="input" type="number" value={rp.brkMin} onChange={(e) => setR('brkMin', +e.target.value)} /><span>min</span></div></Field>
              <Field label="Break time is"><Select id="pol-brkpaid" className="input" value={rp.brkPaid} onChange={(e) => setR('brkPaid', e.target.value)}><option value="unpaid">Unpaid (taken off worked hours)</option><option value="paid">Paid</option></Select></Field>
              <div className="small muted">Time past the allowance is flagged to the supervisor.</div>
            </>}
          </section>
          <section className="card form">
            <div className="card-head"><h3>Automatic clock-out</h3></div>
            <Toggle id="pol-auto" checked={rp.auto} onChange={(v) => setR('auto', v)} label="Clock workers out if they forget" />
            {rp.auto && <Field label="Clock out this long after the shift ends" hint="Counted from the end of the optional overtime hour, if the shift has one."><div className="unit-in"><input id="pol-automin" className="input" type="number" value={rp.autoMin} onChange={(e) => setR('autoMin', +e.target.value)} /><span>min</span></div></Field>}
          </section>
          <section className="card form span2">
            <div className="card-head"><h3>Overtime</h3><Pill>All roles</Pill></div>
            <div className="ot-explain">
              <div><span className="tpl-chip mono">11</span><b>Base hours</b><span className="small muted">The shift itself. Paid at the normal rate.</span></div>
              <div><span className="tpl-chip mono ot">+1</span><b>Optional overtime</b><span className="small muted">Planned on the shift. The worker may stay; no approval needed.</span></div>
              <div><span className="tpl-chip mono extra">beyond</span><b>Unplanned overtime</b><span className="small muted">Anything after the optional hour.</span></div>
            </div>
            <div className="form-grid">
              <Field label="Unplanned overtime"><Select id="pol-beyond" className="input" value={p.beyond} onChange={(e) => set('beyond', e.target.value)}><option value="approval">Allowed if a supervisor approves it</option><option value="allow">Always allowed</option><option value="none">Not allowed: clock the worker out</option></Select></Field>
              <Field label="Public holidays"><Select id="pol-hol" className="input" value={p.hol ? 'y' : 'n'} onChange={(e) => set('hol', e.target.value === 'y')}><option value="y">Every hour counts as overtime</option><option value="n">Treated like any other day</option></Select></Field>
            </div>
            <div className="small muted">How much overtime costs comes from each vendor's rate card, under Vendor costs.</div>
          </section>
        </div>}
      </>}
      {tab === 'leave' && <>
        <section className="card flush">
          <div className="card-head pad"><h3>Leave types</h3><span className="small muted">Workers pick from these in the app</span></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Type</th><th>Pay</th><th className="num">Days a year</th><th>Rules</th><th></th></tr></thead>
            <tbody>{lts.map((t) => (
              <tr key={t.id} className="rowlink" onClick={() => setLed({ ...t })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setLed({ ...t })}>
                <td><b>{t.name}</b></td><td>{t.paid ? 'Paid' : 'Unpaid'}</td><td className="num">{t.perYear ? <b className="lt-days">{t.perYear}</b> : <span className="muted small">No limit</span>}</td><td className="small">{ltRule(t)}</td>
                <td className="num"><span className="rowedit">Edit</span></td>
              </tr>
            ))}</tbody>
          </table></div>
          <div className="pad lv-foot"><button className="btn ghost sm" onClick={() => setLed({ id: null, name: '', paid: true, perYear: null, carry: 0, maxReq: null, cert: null, track: false, note: '' })}>Add leave type</button></div>
        </section>
        <section className="card form">
          <div className="card-head"><h3>Across all leave</h3></div>
          <div className="form-grid">
            <Field label="Most people off at one location on the same day"><div className="unit-in"><input id="lv-maxoff" className="input" type="number" min="1" value={p.maxOff} onChange={(e) => set('maxOff', +e.target.value)} /><span>people</span></div></Field>
            <Field label="Public holidays"><Select id="lv-hol" className="input" value={p.holCal} onChange={(e) => set('holCal', e.target.value)}><option value="uae">UAE calendar</option><option value="none">None</option></Select></Field>
          </div>
          {p.holCal === 'uae' && <div className="hol-list">
            <div className="hol-head small"><b>UAE public holidays 2026</b><span className="muted">{UAE_HOL.filter((h) => (h.to || h.from) >= '2026-10-07').length} still to come</span></div>
            {UAE_HOL.map((h) => { const past = (h.to || h.from) < '2026-10-07'; const n = h.to ? Math.round((new Date(h.to) - new Date(h.from)) / 864e5) + 1 : 1; return (
              <div key={h.name} className={'hol-row' + (past ? ' past' : '')}>
                <span className="hol-date">{fmtRange(h.from, h.to || h.from)}</span>
                <span><b>{h.name}</b>{h.moon && <span className="small muted"> · by moon sighting</span>}</span>
                <span className="small muted">{n} {n === 1 ? 'day' : 'days'}</span>
              </div>
            ); })}
            <div className="small muted">Hours worked on these days count as overtime. Dates by moon sighting update when the government confirms them.</div>
          </div>}
          <div className="small muted">Approved leave never counts as absence. Requests past the limit are flagged to the manager, not blocked.</div>
        </section>
        <Drawer open={!!led} onClose={() => setLed(null)} title={led && led.id ? `Edit ${led.name || 'leave type'}` : 'New leave type'}>
          {led && <>
            <div className="form-grid">
              <Field label="Name"><input id="lt-name" className="input" value={led.name} onChange={(e) => setLed({ ...led, name: e.target.value })} /></Field>
              <Field label="Pay"><Select id="lt-paid" className="input" value={led.paid ? 'y' : 'n'} onChange={(e) => setLed({ ...led, paid: e.target.value === 'y' })}><option value="y">Paid</option><option value="n">Unpaid</option></Select></Field>
              <Field label="Days a year" hint="Leave blank for no yearly limit."><div className="unit-in"><input id="lt-year" className="input" type="number" min="0" value={led.perYear ?? ''} onChange={(e) => setLed({ ...led, perYear: e.target.value === '' ? null : +e.target.value })} /><span>days</span></div></Field>
              <Field label="Carry over to next year"><div className="unit-in"><input id="lt-carry" className="input" type="number" min="0" value={led.carry} onChange={(e) => setLed({ ...led, carry: +e.target.value })} /><span>days</span></div></Field>
              <Field label="Most days per request" hint="Blank for no limit."><div className="unit-in"><input id="lt-max" className="input" type="number" min="0" value={led.maxReq ?? ''} onChange={(e) => setLed({ ...led, maxReq: e.target.value === '' ? null : +e.target.value })} /><span>days</span></div></Field>
              <Field label="Certificate needed after" hint="Blank if never."><div className="unit-in"><input id="lt-cert" className="input" type="number" min="0" value={led.cert ?? ''} onChange={(e) => setLed({ ...led, cert: e.target.value === '' ? null : +e.target.value })} /><span>days</span></div></Field>
            </div>
            <Toggle id="lt-track" checked={led.track} onChange={(v) => setLed({ ...led, track: v })} label="Track a balance for each worker" />
            <div className="small muted lt-trackhint">{led.track ? `Each worker gets ${led.perYear ?? 'their'} days a year. Requests count them down, and the worker sees what is left in the app. Managers see it when approving.` : 'No balance is kept. Requests are checked only against the rules above, such as the most days per request or a certificate.'}</div>
            <Field label="Note for workers (optional)"><input id="lt-note" className="input" value={led.note} onChange={(e) => setLed({ ...led, note: e.target.value })} /></Field>
            <div className="drawer-actions">
              {led.id && <button className="btn ghost danger" onClick={() => { setLts(lts.filter((x) => x.id !== led.id)); setLed(null); toast('Leave type removed · existing requests keep their type'); }}>Remove</button>}
              <span className="grow" />
              <button className="btn ghost" onClick={() => setLed(null)}>Cancel</button>
              <button className="btn" disabled={!led.name.trim()} onClick={() => { setLts(led.id ? lts.map((x) => (x.id === led.id ? led : x)) : [...lts, { ...led, id: 'lt' + Date.now() }]); setLed(null); toast('Leave type saved · shows in the worker app'); }}>Save</button>
            </div>
          </>}
        </Drawer>
      </>}
      {tab === 'roles' && <>
        <div className="rb-grid">
          {[
            ['Employee', 'Their own work, mostly on the phone', ['Own schedule, clock in and out, breaks', 'Request leave, see notifications', 'Own timesheet in the dashboard'], 'Only themselves'],
            ['Floater', 'No fixed location; covers leave and no-shows', ['Covers offered to them, clock in at the covered location', 'Request leave, see notifications', 'Own timesheet; only paid for days they cover'], 'Only themselves'],
            ['Manager', 'Runs their locations day to day', ['Roster, leave approvals and notifications', 'Workforce and timesheets for their people', 'Supervisor app'], 'Locations they are assigned to'],
            ['Admin', 'Runs the operation', ['Everything managers can do, everywhere', 'Settings, vendors, onboarding, vendor costs', 'Assign managers to locations'], 'Every location'],
          ].map(([r, d, can, scope]) => (
            <section key={r} className="card rb-card">
              <div className="rb-name">{r}</div>
              <div className="small muted">{d}</div>
              <ul className="rb-can">{can.map((c) => <li key={c}>{c}</li>)}</ul>
              <div className="rb-scope small"><span className="muted">Sees</span> {scope}</div>
            </section>
          ))}
        </div>
        <section className="card flush">
          <div className="card-head pad"><h3>Your designations</h3><span className="small muted">Map your own job titles to an access level. Locked once anyone holds the designation.</span></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Designation</th><th>Access</th><th className="num">People</th></tr></thead>
            <tbody>{desig.map((d, i) => (
              <tr key={d.name}>
                <td><b>{d.name}</b></td>
                <td><Select id={'rb-' + i} className="input sm" disabled={d.n > 0} title={d.n > 0 ? `Locked: ${d.n} ${d.n === 1 ? 'person holds' : 'people hold'} this designation. Move them to another designation first.` : undefined} value={d.role} onChange={(e) => { DESIG_ACCESS[d.name] = e.target.value; setDesig(desig.map((x, j) => (j === i ? { ...x, role: e.target.value } : x))); toast(`${d.name} now has ${e.target.value} access`); }}><option>Employee</option><option>Floater</option><option>Manager</option><option>Admin</option></Select></td>
                <td className="num mono">{d.n}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <div className="pad lv-foot"><button className="btn ghost sm" onClick={() => { const name = 'New designation'; setDesig([...desig, { name: name + ' ' + (desig.length + 1), role: 'Employee', n: 0 }]); }}>Add designation</button></div>
        </section>
        <Note>Vendor users are separate: they sign in to the vendor portal, see only their own people, and can only propose candidates.</Note>
      </>}
    </>
  );
}
