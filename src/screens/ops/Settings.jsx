import { WORKERS, DAYS, ROSTER, SHIFT_TEMPLATES, DESIG_ACCESS, tplOf, tplLabel, endOf, vendorOf, siteOf, spanOf, MAX_ON_SITE } from '../../data.js';
import { ScreenHeader, Tabs, Drawer, Avatar, Field, Toggle, Note, useToast, Select, Icon } from '../../ui.jsx';
import { FULL_DAYS, fmtRange } from '../../lib/dates.js';
import { LEAVE_TYPES, UAE_HOL, ltRule } from '../../lib/leave.js';
import { OFF_RULES } from '../../lib/offs.js';

const { useState } = React;

// Settings: the sections in a list on the left (on a phone, tabs); each section is titled groups of rows, the name and a
// line of help on the left and the control on the right, so it reads top to bottom. Each group says who it applies to
// (one access level or the whole organisation). Attendance rules also keeps a plain-words summary of the chosen access
// level beside the rows. Shifts and the full-day rule are drawn as bars on the hours. Logic, defaults and the shared
// rule objects (OFF_RULES, DESIG_ACCESS) are unchanged from the earlier screen. CSS: the "Settings" section, .st-*.
const SECTIONS = [['templates', 'Shifts', 'clock', 'Shift lengths used on the roster'], ['policy', 'Attendance rules', 'checkCircle', 'Lateness, breaks, offs and overtime'], ['leave', 'Leave types', 'umbrella', 'What workers can ask for'], ['roles', 'Roles & access', 'users', 'Who can see and do what']];

function Sec({ title, scope, desc, children, aside }) {
  return (
    <section className="st-sec">
      <header className="st-sec-h"><div><h3>{title}</h3>{desc && <p>{desc}</p>}</div>{scope && <span className="st-scope">{scope}</span>}{aside}</header>
      <div className="st-rows">{children}</div>
    </section>
  );
}
function Row({ label, help, children, wide }) {
  return <div className={'st-row' + (wide ? ' wide' : '')}><div className="st-l"><b>{label}</b>{help && <span>{help}</span>}</div><div className="st-c">{children}</div></div>;
}
function Num({ unit, ...rest }) {
  return <span className="st-num"><input className="input" type="number" {...rest} /><span>{unit}</span></span>;
}
// Where the full-day and half-day lines fall on an 11+1 shift (the optional hour never counts).
const FULL_H = { all: 11, base1: 10, base2: 9, pct90: 9.9 }, HALF_H = { half: 5.5, '4h': 4, none: null };
const hm = (h) => `${Math.floor(h)} h${h % 1 ? ` ${Math.round((h % 1) * 60)} m` : ''}`;

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
  const R = (x) => (x === 'Employee' ? 'Employees' : x === 'Floater' ? 'Floaters' : 'Managers');
  const tracked = role !== 'Manager' || rp.track;
  const fullH = FULL_H[rp.full], halfH = HALF_H[rp.half];
  const summary = !tracked ? ['Managers are not tracked: no clock-in, no timesheet, no attendance alerts.'] : [
    `Late after ${rp.grace} min, a no-show after ${rp.noshow} min.`,
    role === 'Floater' ? `When covering, clock-in opens ${rp.coverEarly} min before and clock-out is allowed until ${rp.coverLate} min after.` : `Can clock in up to ${rp.early} min before the shift.`,
    rp.rounding === '0' ? 'Clock times are not rounded.' : `Clock times round to the nearest ${rp.rounding} min.`,
    `On an 11+1 shift, a full day from ${hm(fullH)} worked${halfH ? `, a half day from ${hm(halfH)}` : '; anything less is absent'}.`,
    rp.breaks ? `${rp.brkMin} min of ${rp.brkPaid} breaks per shift, split as they like.` : 'No breaks during the shift.',
    rp.auto ? `Clocked out ${rp.autoMin} min after the shift if they forget.` : 'Never clocked out automatically.',
    ...(role === 'Manager' ? ['Their no-shows and late starts go to the admins.'] : []),
  ];
  const orgSummary = [
    p.offMode === 'fixed' ? `Everyone is off on ${p.offDays.map((k) => FULL_DAYS[k]).join(' and ')}.` : `${p.offs} weekly ${p.offs === 1 ? 'off' : 'offs'} each, staggered on the roster; at most ${p.sameDay} off at one location on a day.`,
    `At most ${p.maxRun} working days in a row.`,
    { approval: 'Unplanned overtime needs a supervisor to approve it.', allow: 'Unplanned overtime is always allowed.', none: 'No unplanned overtime: the worker is clocked out.' }[p.beyond],
    p.hol ? 'Every hour on a public holiday is overtime.' : 'Public holidays are paid like any other day.',
  ];

  return (
    <>
      <ScreenHeader title="Settings" phase={1} spec="5.10" actions={<button className="btn" onClick={() => toast('Saved · applies from the next shift')}>Save</button>} />
      <div className="st-tabs"><Tabs tabs={SECTIONS.map(([id, label]) => ({ id, label }))} value={tab} onChange={setTab} /></div>
      <div className="st">
        <nav className="st-nav" aria-label="Settings sections">
          <span className="st-nav-h">Sections</span>
          {SECTIONS.map(([id, label, ic, d]) => { const meta = { templates: `${tpl.length} shifts`, policy: '3 access levels', leave: `${lts.length} types`, roles: `${desig.length} designations` }[id]; return (
            <button key={id} className={'st-navi' + (tab === id ? ' on' : '')} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
              <span className="st-navic"><Icon name={ic} size={18} /></span>
              <span className="st-navt"><b>{label}</b><span title={d}>{meta}</span></span>
            </button>
          ); })}
        </nav>

        <div className="st-main" key={tab}>
          {tab === 'templates' && <>
            <Sec title="Shifts" desc="A shift is a length: hours worked plus an unpaid break. The start time is picked on the roster, so one shift works for mornings, evenings and nights." aside={<button className="btn" onClick={() => openEd(null)}><Icon name="plus" size={15} />Add shift</button>}>
              <div className="st-shift st-shift-h" aria-hidden="true"><span>Shift</span><span>On site, out of {MAX_ON_SITE} h at most</span><span>Worked</span><span>Break</span><span>This week</span></div>
              {[...tpl].sort((x, y) => y.base - x.base || (y.brk || 0) - (x.brk || 0)).map((t, i) => (
                <button key={t.id} className="st-shift" style={{ '--i': i }} onClick={() => openEd(t)}>
                  <span className="st-chip">{tplLabel(t)}</span>
                  <span className="st-bar" aria-label={`${t.base} h worked, ${t.brk || 0} h break, ${spanOf(t)} h on site`}><span className="st-bar-t"><i className="w" style={{ width: `${(t.base / MAX_ON_SITE) * 100}%` }} />{t.brk ? <i className="b" style={{ width: `${(t.brk / MAX_ON_SITE) * 100}%` }} /> : null}</span><span>{spanOf(t)} h</span></span>
                  <span>{t.base} h</span>
                  <span className={t.brk ? '' : 'st-none'}>{t.brk ? `${t.brk} h` : 'None'}</span>
                  <span className={t.used ? '' : 'st-none'}>{t.used ? `${t.used} ${t.used === 1 ? 'person' : 'people'}` : 'Nobody'}</span>
                </button>
              ))}
              <div className="st-key"><span><i className="w" />Worked, paid and billed</span><span><i className="b" />Unpaid break</span></div>
            </Sec>
            <div className="st-explain">
              <span className="st-chip ot">+1</span>
              <p>"+1" is one hour of optional overtime after the base hours. A worker can leave at the end of the base hours with a full shift; if they stay, the extra time is overtime. On the roster you pick a shift and a start time; the end is worked out from the length, including shifts that finish after midnight.</p>
            </div>
          </>}

          {tab === 'policy' && <div className="st-policy">
            <div className="st-policy-main">
              <div className="st-rolebar">
                <span>Rules for</span>
                <div className="seg" role="tablist" aria-label="Access level">{['Employee', 'Floater', 'Manager'].map((r) => <button key={r} role="tab" aria-selected={role === r} className={'seg-btn' + (role === r ? ' on' : '')} onClick={() => setRole(r)}>{R(r)}<span className="seg-n">{desig.filter((d) => d.role === r).reduce((a, d) => a + d.n, 0)}</span></button>)}</div>
                <span className="st-rolebar-d">{desig.filter((d) => d.role === role).map((d) => d.name).join(', ') || 'No designations'}</span>
              </div>

              {role === 'Manager' && <Sec title="Tracking" scope="Managers">
                <Row label="Managers clock in and out too" help={rp.track ? 'Their no-shows and late starts go to the admins, not to themselves.' : 'Managers are not tracked: no clock-in, no timesheet, no attendance alerts.'}><Toggle id="pol-track" checked={rp.track} onChange={(v) => setR('track', v)} label={rp.track ? 'On' : 'Off'} /></Row>
              </Sec>}

              {tracked && <>
                <Sec title="Clocking in" scope={R(role)} desc="When someone counts as late or absent">
                  <Row label="Grace period" help="Clocking in within this is still on time"><Num id="pol-grace" unit="min" value={rp.grace} onChange={(e) => setR('grace', +e.target.value)} /></Row>
                  <Row label="No-show after" help="Not clocked in by then: marked absent and the manager is told"><Num id="pol-noshow" unit="min" value={rp.noshow} onChange={(e) => setR('noshow', +e.target.value)} /></Row>
                  {role !== 'Floater' && <Row label="Earliest clock-in" help="How early before the shift they can clock in"><Num id="pol-early" unit="min before" value={rp.early} onChange={(e) => setR('early', +e.target.value)} /></Row>}
                  <Row label="Rounding" help="Clock times are rounded to this"><Select id="pol-round" className="input" value={rp.rounding} onChange={(e) => setR('rounding', e.target.value)}><option value="0">None</option><option value="5">Nearest 5 min</option><option value="15">Nearest 15 min</option></Select></Row>
                </Sec>

                {role === 'Floater' && <Sec title="Covering a shift" scope="Floaters" desc="They clock in at the location they're covering, inside its geofence, and must clock out there too. Days without a cover aren't tracked and aren't paid.">
                  <Row label="Clock-in opens" help="Before the covered shift starts"><Num id="pol-cin" unit="min before" value={rp.coverEarly} onChange={(e) => setR('coverEarly', +e.target.value)} /></Row>
                  <Row label="Clock-out allowed until" help="After the covered shift ends"><Num id="pol-cout" unit="min after" value={rp.coverLate} onChange={(e) => setR('coverLate', +e.target.value)} /></Row>
                </Sec>}

                <Sec title="Full and half days" scope={R(role)} desc="How much of a shift has to be worked to count">
                  <Row label="Full day" help="Counts as a full day when they work"><Select id="pol-full" className="input" value={rp.full} onChange={(e) => setR('full', e.target.value)}><option value="all">All of the base hours</option><option value="base1">All but 1 hour of the base hours</option><option value="base2">All but 2 hours of the base hours</option><option value="pct90">At least 90% of the base hours</option></Select></Row>
                  <Row label="Half day" help="Counts as a half day when they work"><Select id="pol-half" className="input" value={rp.half} onChange={(e) => setR('half', e.target.value)}><option value="half">At least half of the base hours</option><option value="4h">At least 4 hours</option><option value="none">No half days: less than a full day is absent</option></Select></Row>
                  <div className="st-days" aria-label={`On an 11+1 shift: full day from ${hm(fullH)}${halfH ? `, half day from ${hm(halfH)}` : ''}`}>
                    <span className="st-days-t">On an 11+1 shift</span>
                    <span className="st-days-bar">
                      <i className="abs" style={{ width: `${((halfH ?? fullH) / 11) * 100}%` }} />
                      {halfH && <i className="half" style={{ width: `${((fullH - halfH) / 11) * 100}%` }} />}
                      <i className="full" style={{ width: `${((11 - fullH) / 11) * 100}%` }} />
                    </span>
                    <span className="st-days-l"><span style={{ width: `${((halfH ?? fullH) / 11) * 100}%` }}>Absent</span>{halfH && <span style={{ width: `${((fullH - halfH) / 11) * 100}%` }}>Half day from {hm(halfH)}</span>}<span>Full day from {hm(fullH)}</span></span>
                    <span className="st-days-n">The optional hour never counts towards this.</span>
                  </div>
                </Sec>

                <Sec title="Breaks" scope={R(role)}>
                  <Row label="Breaks during the shift" help="Workers take breaks while clocked in"><Toggle id="pol-brk" checked={rp.breaks} onChange={(v) => setR('breaks', v)} label={rp.breaks ? 'On' : 'Off'} /></Row>
                  {rp.breaks && <>
                    <Row label="Allowance per shift" help="Split into as many breaks as they need, for prayer, food or a smoke. When it runs out they're clocked back in automatically."><Num id="pol-brkmin" unit="min" value={rp.brkMin} onChange={(e) => setR('brkMin', +e.target.value)} /></Row>
                    <Row label="Break time is" help="Unpaid breaks are taken off worked hours"><Select id="pol-brkpaid" className="input" value={rp.brkPaid} onChange={(e) => setR('brkPaid', e.target.value)}><option value="unpaid">Unpaid</option><option value="paid">Paid</option></Select></Row>
                  </>}
                </Sec>

                <Sec title="Automatic clock-out" scope={R(role)}>
                  <Row label="Clock workers out if they forget" help="So a forgotten clock-out doesn't run all night"><Toggle id="pol-auto" checked={rp.auto} onChange={(v) => setR('auto', v)} label={rp.auto ? 'On' : 'Off'} /></Row>
                  {rp.auto && <Row label="Clock out after the shift ends" help="Counted from the end of the optional overtime hour, if the shift has one"><Num id="pol-automin" unit="min" value={rp.autoMin} onChange={(e) => setR('autoMin', +e.target.value)} /></Row>}
                </Sec>
              </>}

              <Sec title="Weekly offs" scope="Whole organisation" desc="Set once for the organisation and applies to every role. A weekly off is never counted as absent.">
                <div className="st-choices" role="radiogroup" aria-label="How weekly offs are given">
                  {[['roster', 'Staggered on the roster', "Each worker's off is picked every week, so someone is always on shift"], ['fixed', 'Same day for everyone', "The organisation doesn't work on these days, e.g. Sundays"]].map(([k, l, d]) => (
                    <button key={k} role="radio" aria-checked={p.offMode === k} className={'st-choice' + (p.offMode === k ? ' on' : '')} onClick={() => { set('offMode', k); OFF_RULES.mode = k; }}><span className="st-radio" /><span><b>{l}</b><span>{d}</span></span></button>
                  ))}
                </div>
                {p.offMode === 'fixed'
                  ? <Row label="Weekly off" help={`Everyone is off on these days. A roster with any shift on them is rejected. ${p.offDays.map((k) => FULL_DAYS[k]).join(' and ')} off · ${p.offDays.length} a week.`}>
                      <div className="wk-pick" role="group" aria-label="Weekly off days">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, k) => { const on = p.offDays.includes(k); return (
                        <button key={k} className={'wk-day' + (on ? ' on' : '')} aria-pressed={on} title={FULL_DAYS[k]} onClick={() => { const next = on ? p.offDays.filter((x) => x !== k) : [...p.offDays, k].sort(); if (!next.length) { toast('At least one weekly off is required'); return; } if (next.length > 3) return; set('offDays', next); OFF_RULES.days = next; }}>{d}</button>
                      ); })}</div>
                    </Row>
                  : <>
                      <Row label="Weekly offs per worker" help="At least 1. Enforced: rosters without it are rejected on upload and can't be published."><Num id="pol-offs" unit="a week" min="1" max="3" value={p.offs} onChange={(e) => { const v = Math.max(1, Math.min(3, +e.target.value || 1)); set('offs', v); OFF_RULES.perWeek = v; }} /></Row>
                      <Row label="Most off at one location on a day" help="Keeps offs staggered so someone is always on shift. A warning only."><Num id="pol-sameday" unit="people" min="1" max="9" value={p.sameDay} onChange={(e) => { set('sameDay', +e.target.value); OFF_RULES.sameDay = +e.target.value; }} /></Row>
                    </>}
                <Row label="Most working days in a row"><Num id="pol-run" unit="days" min="1" max="13" value={p.maxRun} onChange={(e) => { set('maxRun', +e.target.value); OFF_RULES.maxRun = +e.target.value; }} /></Row>
                <Row label="Working on a weekly off"><Select id="pol-offwork" className="input" value={p.offWork} onChange={(e) => set('offWork', e.target.value)}><option value="ot">Allowed, paid at the rest-day rate</option><option value="swap">Allowed, with a replacement day off</option><option value="none">Not allowed</option></Select></Row>
              </Sec>

              <Sec title="Overtime" scope="All roles" desc="How much overtime costs comes from each vendor's rate card, under Vendor costs.">
                <div className="st-ot" aria-hidden="true">
                  <div className="st-ot-bar"><i className="base">11 base hours</i><i className="opt">+1</i><i className="beyond">Beyond</i></div>
                  <div className="st-ot-l"><span><b>Base hours</b>The shift itself, at the normal rate</span><span><b>Optional overtime</b>Planned on the shift; they may stay, no approval needed</span><span><b>Unplanned overtime</b>Anything after the optional hour</span></div>
                </div>
                <Row label="Unplanned overtime"><Select id="pol-beyond" className="input" value={p.beyond} onChange={(e) => set('beyond', e.target.value)}><option value="approval">Allowed if a supervisor approves it</option><option value="allow">Always allowed</option><option value="none">Not allowed: clock the worker out</option></Select></Row>
                <Row label="Public holidays"><Select id="pol-hol" className="input" value={p.hol ? 'y' : 'n'} onChange={(e) => set('hol', e.target.value === 'y')}><option value="y">Every hour counts as overtime</option><option value="n">Treated like any other day</option></Select></Row>
              </Sec>
            </div>

            <aside className="st-sum" aria-label="These rules in plain words">
              <h4>In plain words</h4>
              <span className="st-sum-k">{R(role)}</span>
              <ul>{summary.map((x) => <li key={x}>{x}</li>)}</ul>
              <span className="st-sum-k">Everyone</span>
              <ul>{orgSummary.map((x) => <li key={x}>{x}</li>)}</ul>
            </aside>
          </div>}

          {tab === 'leave' && <>
            <Sec title="Leave types" desc="Workers pick from these in the app" aside={<button className="btn" onClick={() => setLed({ id: null, name: '', paid: true, perYear: null, carry: 0, maxReq: null, cert: null, track: false, note: '' })}><Icon name="plus" size={15} />Add leave type</button>}>
              {lts.map((t, i) => (
                <button key={t.id} className="st-lt" style={{ '--i': i }} onClick={() => setLed({ ...t })}>
                  <span className="st-lt-n">{t.perYear ? <><b>{t.perYear}</b><span>days a year</span></> : <><b className="inf">No limit</b><span>days a year</span></>}</span>
                  <span className="st-lt-t"><b>{t.name}</b><span>{ltRule(t)}</span></span>
                  <span className="st-lt-p"><span className={'sdot ' + (t.paid ? 'good' : 'ring')} />{t.paid ? 'Paid' : 'Unpaid'}</span>
                  <span className="st-lt-p">{t.track ? 'Balance kept' : 'No balance'}</span>
                </button>
              ))}
            </Sec>
            <Sec title="Across all leave" desc="Approved leave never counts as absence. Requests past the limit are flagged to the manager, not blocked.">
              <Row label="Most people off at one location on a day"><Num id="lv-maxoff" unit="people" min="1" value={p.maxOff} onChange={(e) => set('maxOff', +e.target.value)} /></Row>
              <Row label="Public holidays" help="Hours worked on these days count as overtime"><Select id="lv-hol" className="input" value={p.holCal} onChange={(e) => set('holCal', e.target.value)}><option value="uae">UAE calendar</option><option value="none">None</option></Select></Row>
            </Sec>
            {p.holCal === 'uae' && <Sec title="UAE public holidays 2026" desc="Dates by moon sighting update when the government confirms them." aside={<span className="st-scope">{UAE_HOL.filter((h) => (h.to || h.from) >= '2026-10-07').length} still to come</span>}>
              {UAE_HOL.map((h, i) => { const past = (h.to || h.from) < '2026-10-07'; const n = h.to ? Math.round((new Date(h.to) - new Date(h.from)) / 864e5) + 1 : 1; return (
                <div key={h.name} className={'st-hol' + (past ? ' past' : '')} style={{ '--i': i }}>
                  <span className="st-hol-d">{fmtRange(h.from, h.to || h.from)}</span>
                  <b>{h.name}</b>
                  <span>{h.moon ? 'By moon sighting' : ''}</span>
                  <span>{n} {n === 1 ? 'day' : 'days'}</span>
                </div>
              ); })}
            </Sec>}
          </>}

          {tab === 'roles' && <>
            <Sec title="Access levels" desc="Every designation maps to one of these four">
              <div className="st-levels">{[
                ['Employee', 'Their own work, mostly on the phone', ['Own schedule, clock in and out, breaks', 'Request leave, see notifications', 'Own timesheet in the dashboard'], 'Only themselves'],
                ['Floater', 'No fixed location; covers leave and no-shows', ['Covers offered to them, clock in at the covered location', 'Request leave, see notifications', 'Own timesheet; only paid for days they cover'], 'Only themselves'],
                ['Manager', 'Runs their locations day to day', ['Roster, leave approvals and notifications', 'Workforce and timesheets for their people', 'Supervisor app'], 'Locations they are assigned to'],
                ['Admin', 'Runs the operation', ['Everything managers can do, everywhere', 'Settings, vendors, onboarding, vendor costs', 'Assign managers to locations'], 'Every location'],
              ].map(([r, d, can, scope], i) => (
                <div key={r} className="st-level" style={{ '--i': i }}>
                  <b>{r}</b><span className="st-level-d">{d}</span>
                  <ul>{can.map((c) => <li key={c}><Icon name="check" size={15} stroke={2.4} />{c}</li>)}</ul>
                  <span className="st-level-s"><span>Sees</span>{scope}</span>
                </div>
              ))}</div>
            </Sec>
            <Sec title="Your designations" desc="Map your own job titles to an access level. Locked once anyone holds the designation." aside={<button className="btn" onClick={() => { const name = 'New designation'; setDesig([...desig, { name: name + ' ' + (desig.length + 1), role: 'Employee', n: 0 }]); }}><Icon name="plus" size={15} />Add designation</button>}>
              {desig.map((d, i) => (
                <Row key={d.name} label={d.name} help={d.n ? `${d.n} ${d.n === 1 ? 'person holds' : 'people hold'} it, so it's locked: move them to another designation to change it` : 'Nobody holds it yet, so it can still change'}>
                  {d.n > 0
                    ? <span className="st-locked"><Icon name="lock" size={15} />{d.role}</span>
                    : <Select id={'rb-' + i} className="input" value={d.role} onChange={(e) => { DESIG_ACCESS[d.name] = e.target.value; setDesig(desig.map((x, j) => (j === i ? { ...x, role: e.target.value } : x))); toast(`${d.name} now has ${e.target.value} access`); }}><option>Employee</option><option>Floater</option><option>Manager</option><option>Admin</option></Select>}
                </Row>
              ))}
            </Sec>
            <Note>Vendor users are separate: they sign in to the vendor portal, see only their own people, and can only propose candidates.</Note>
          </>}
        </div>
      </div>
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
            {clashes.length > 0 && <div className="row-line st-clash"><span className="sdot crit" /><b>{clashes.length} {clashes.length === 1 ? 'overlap' : 'overlaps'}</b><span className="small">The new length makes a shift overlap another one for the people marked below. Fix them on the roster after applying.</span></div>}
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
    </>
  );
}
