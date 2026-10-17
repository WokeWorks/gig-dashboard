import { workerInScope, siteInScope } from '../../lib/scope.js';
import { SITES, VENDORS, WORKERS, ROSTER_GROUPS, KPIS, DESIG_ACCESS, HOME_AREAS, SHIFT_TEMPLATES, tplOf, tplLabel, endOf, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Tabs, Drawer, Bar, Note, useToast, Icon, Select, Field } from '../../ui.jsx';
import { FULL_DAYS, fmtD } from '../../lib/dates.js';
import { todayOf } from '../../lib/live.js';
import { offDaysOf, timesheetOf } from '../../lib/roster.js';

const { useState } = React;

// Workforce: everyone, one row each, faces first. A row opens the person; Add worker is one sheet of fields from the
// bottom (onboarding, with its steps, is for vendor proposals).
const short = (n) => n.replace(/^(Spinneys|Carrefour) /, '');
const initials = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);
const TONE = { good: 'good', warn: 'warn', crit: 'crit', info: 'idle', muted: 'ring' };
const docTone = (d) => (d && /missing|not uploaded/i.test(d) ? 'crit' : d ? 'warn' : 'good');
const BLANK = { name: '', phone: '+971 5', vendor: VENDORS[0].id, role: 'Picker', site: SITES[0].id, homeArea: Object.keys(HOME_AREAS)[0], tpl: SHIFT_TEMPLATES[0].id, start: '07:00', clientId: '', joined: '2026-10-08' };

export function Workforce({ params, go }) {
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState(params?.vendor || 'all');
  const [site, setSite] = useState(params?.site || 'all');
  const [role, setRole] = useState('all');
  const [show, setShow] = useState('all');
  const [added, setAdded] = useState([]); // people added from the sheet this session
  const [sel, setSel] = useState(params?.worker ? WORKERS.find((w) => w.id === params.worker) : null);
  const [tab, setTab] = useState(params?.tab || 'Overview');
  const [form, setForm] = useState(null); // the add-worker sheet: field values, plus `tried` once Save was pressed
  const toast = useToast();
  const all = [...added, ...WORKERS];
  const base = all.filter((w) => workerInScope(w) && (vendor === 'all' || w.vendor === vendor) && (site === 'all' || w.site === site) && (role === 'all' || w.role === role) && (!q || (w.name + w.code).toLowerCase().includes(q.toLowerCase())));
  const tagged = base.map((w) => ({ w, today: todayOf(w), month: timesheetOf(w).sum }));
  const counts = { all: tagged.length, in: tagged.filter((x) => x.today.key === 'in').length, notin: tagged.filter((x) => x.today.key === 'notin').length, off: tagged.filter((x) => x.today.key === 'off').length, docs: tagged.filter((x) => x.w.docs).length };
  const rows = tagged.filter((x) => show === 'all' || (show === 'docs' ? x.w.docs : x.today.key === show));
  const roles = Object.keys(DESIG_ACCESS);

  // Add worker: required fields checked on Save, errors under the field.
  const floater = form && DESIG_ACCESS[form.role] === 'Floater';
  const errs = form ? { name: !form.name.trim() && 'Enter their full name', phone: !/^\+971 ?5\d[\d ]{6,}$/.test(form.phone.trim()) && 'A UAE mobile number, like +971 50 123 4567' } : {};
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = () => {
    if (errs.name || errs.phone) { setForm({ ...form, tried: true }); return; }
    const n = all.length + 100;
    const w = { id: 'w' + n, code: 'OP-' + (2000 + n), name: form.name.trim(), vendor: form.vendor, role: form.role, site: floater ? 'pool' : form.site, ...(floater ? { homeArea: form.homeArea } : {}), status: 'Off today', score: 0, docs: 'Documents not uploaded yet', phone: form.phone.trim(), clientId: form.clientId.trim() || '—', joined: form.joined };
    setAdded([w, ...added]); setForm(null);
    toast(`${w.name} added · sign-in code sent by SMS · add their shifts on the roster`);
  };

  return (
    <>
      <ScreenHeader title="Workforce" phase={1} spec="5.2" actions={<>
        <button className="btn ghost" onClick={() => toast('Bulk import: upload CSV or XLSX, get a per-row error report')}>Bulk import</button>
        <button className="btn" onClick={() => setForm({ ...BLANK })}><Icon name="plus" size={16} />Add worker</button>
      </>} />
      <div className="wf-bar">
        <label className="wf-search"><Icon name="search" size={16} /><input id="wf-search" placeholder="Search by name or staff ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search by name or staff ID" /></label>
        <Select id="wf-site" className="input" value={site} onChange={(e) => setSite(e.target.value)} aria-label="Location"><option value="all">All locations</option>{SITES.filter((x) => siteInScope(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}<option value="pool">Floaters (no location)</option></Select>
        <Select id="wf-vendor" className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} aria-label="Vendor"><option value="all">All vendors</option>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>
        <Select id="wf-role" className="input" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Designation"><option value="all">All designations</option>{roles.map((r) => <option key={r}>{r}</option>)}</Select>
      </div>
      <div className="wf-chips" role="tablist" aria-label="Show">
        {[['all', 'Everyone'], ['in', 'Working now'], ['notin', 'Not in', 'crit'], ['off', 'Off today'], ['docs', 'Document issues', 'warn']].map(([k, label, dot]) => (
          <button key={k} role="tab" aria-selected={show === k} className={'ma-chip' + (show === k ? ' on' : '')} onClick={() => setShow(k)}>{dot && counts[k] > 0 && <span className={'sdot ' + dot} />}{label}<span className="nt-chip-n">{counts[k]}</span></button>
        ))}
      </div>

      <div className="wf-list" role="table" aria-label="Workers" key={show + site + vendor + role}>
        <div className="wf-row wf-head" role="row"><span role="columnheader">Worker</span><span role="columnheader">Location</span><span role="columnheader">Today</span><span role="columnheader">October so far</span><span role="columnheader">Documents</span></div>
        {rows.map(({ w, today, month }, i) => (
          <button key={w.id} className="wf-row" role="row" style={{ '--i': Math.min(i, 14) }} onClick={() => { setSel(w); setTab('Overview'); }}>
            <span className="wf-who" role="cell"><span className={'live-face ' + TONE[today.tone]}>{initials(w.name)}</span><span><b>{w.name}</b><span>{vendorOf(w.vendor).code} · {w.role}</span></span></span>
            <span role="cell" className="wf-loc">{w.site === 'pool' ? <>Floater<span>{w.homeArea}</span></> : short(siteOf(w.site).name)}</span>
            <span role="cell" className="wf-today">{today.text}</span>
            <span role="cell" className="wf-month"><b>{month.hours.toFixed(0)} h</b><span>{month.full} {month.full === 1 ? 'day' : 'days'}{month.absent > 0 && <><span className="sdot crit" />{month.absent} absent</>}</span></span>
            <span role="cell" className="wf-docs">{w.docs ? <><span className={'sdot ' + docTone(w.docs)} />{w.docs}</> : <span className="muted">All valid</span>}</span>
          </button>
        ))}
        {rows.length === 0 && <p className="wf-none">Nobody matches these filters.</p>}
      </div>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name} sub={sel && `${sel.code} · ${vendorOf(sel.vendor).name} · ${sel.role}`}>
        {sel && (() => { const today = todayOf(sel), ts = timesheetOf(sel); return <>
          <div className="wfx-facts">
            <div><span>Today</span><b><span className={'sdot ' + TONE[today.tone]} />{today.text}</b></div>
            <div><span>October</span><b>{ts.sum.hours.toFixed(0)} h · {ts.sum.full} days</b></div>
            <div><span>Score</span><b>{sel.score || '—'}<small>/100</small></b></div>
          </div>
          <Tabs tabs={['Overview', 'Timesheet', 'Documents', 'Score', 'Devices']} value={tab} onChange={setTab} />
          <div className="wfx-tab" key={tab}>
          {tab === 'Overview' && <dl className="wfx-kv">
            <dt>Phone</dt><dd>{sel.phone}</dd>
            <dt>Employer of record</dt><dd>{vendorOf(sel.vendor).name}</dd>
            {sel.site === 'pool' ? <>
              <dt>Access</dt><dd>Floater · no fixed location · since {fmtD(sel.joined)}</dd>
              <dt>Home area</dt><dd>{sel.homeArea}<small>Used to suggest the nearest covers</small></dd>
            </> : <><dt>Access</dt><dd>{DESIG_ACCESS[sel.role] || 'Employee'}</dd><dt>Location</dt><dd>{siteOf(sel.site).name}<small>Since {fmtD(sel.joined)}</small></dd></>}
            <dt>Deliveroo staff ID</dt><dd>{sel.clientId}</dd>
            <dt>Usual shift</dt><dd>{sel.site === 'pool' ? 'None, each cover follows the shift being covered' : (() => { const g = ROSTER_GROUPS.find((x) => x.people.includes(sel.id)); const row = g ? g.cells[g.people.indexOf(sel.id)] : []; const c = row.find((x) => Array.isArray(x) && x.length === 1); if (!c) return 'Not rostered yet'; const [t, st] = c[0]; return <>{st} – {endOf(st, tplOf(t).base + (tplOf(t).brk || 0)).time}<small>{tplLabel(tplOf(t))}</small></>; })()}</dd>
            <dt>Weekly off</dt><dd>{(() => { const ds = offDaysOf(sel.id); return ds === 'rot' || !ds.length ? 'None this week' : ds.map((k) => FULL_DAYS[k]).join(', '); })()}<small>This week, set on the roster · <button className="linkbtn" onClick={() => go('schedule')}>Open roster</button></small></dd>
            <dt>Face enrolment</dt><dd><span className="sdot good" />Enrolled</dd>
            <dt>Status</dt><dd><span className={'sdot ' + TONE[today.tone]} />{sel.status}</dd>
          </dl>}
          {tab === 'Timesheet' && <>
            <div className="ts-head"><Select id="ts-per" className="input sm" defaultValue="oct"><option value="oct">October 2026 · in progress</option><option value="sep">September 2026 · closed</option></Select><span className="muted">Closes with the vendor statements</span></div>
            <div className="up-stats"><div><b>{ts.sum.full}</b><span>full days</span></div><div><b>{ts.sum.absent}</b><span>absent</span></div><div><b>{ts.sum.hours.toFixed(1)}</b><span>hours worked</span></div><div><b>{ts.sum.ot}</b><span>overtime h</span></div></div>
            <ul className="wfx-days">{[...ts.days].reverse().map((d) => { const dt = new Date(d.iso + 'T00:00:00'); return (
              <li key={d.iso} className={d.shift ? '' : 'quiet'}>
                <span className="lvx-day"><small>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()]}</small><b>{dt.getDate()}</b></span>
                <span className="wfx-day-main"><b>{d.shift || d.kind}</b>{d.inT && <span>In {d.inT}{d.late ? `, ${d.late} min late` : ''}{d.outT ? ` · out ${d.outT === 'auto' ? 'closed automatically' : d.outT}` : ''}</span>}</span>
                <span className="wfx-day-end">{d.worked != null && <b>{d.worked} h{d.ot ? ` +${d.ot}` : ''}</b>}{d.kind === 'Full' ? <span><span className="sdot good" />Full</span> : d.kind === 'Absent' ? <span><span className="sdot crit" />Absent</span> : d.kind === 'Today' ? <span><span className="sdot good" />On shift</span> : null}</span>
              </li>
            ); })}</ul>
            <Note>Built from clock-ins against the roster. No clock-in means absent, unless a manager marks attendance from the Liveboard; those days show as marked, with the reason. A forgotten clock-out is closed automatically after the shift.</Note>
          </>}
          {tab === 'Documents' && <ul className="wfx-docs">
            {[['Passport', '2031-04-11', 'good'], ['UAE visa', sel.docs?.includes('Visa') ? '2026-10-19' : '2027-06-02', sel.docs?.includes('Visa') ? 'warn' : 'good'], ['Emirates ID', sel.docs?.includes('Emirates') ? null : '2027-06-02', sel.docs?.includes('Emirates') ? 'crit' : 'good'], ['Food handling certificate', '2027-01-30', 'good']].map(([n, d, t]) => (
              <li key={n}><span className={'sdot ' + t} /><b>{n}</b><span>{d ? `${t === 'warn' ? 'Expires' : 'Valid until'} ${fmtD(d)}` : 'Missing'}</span></li>
            ))}
          </ul>}
          {tab === 'Score' && <>
            <div className="bigscore"><b>{sel.score}</b><span>/ 100 this month</span></div>
            {KPIS.map((k, i) => <div key={k.id} className="kpi-row"><span>{k.name}<small> · {k.weight}%</small></span><Bar value={[96, 88, 100, 81, 92, 80][i]} /></div>)}
            <Note>Every score links back to the records behind it. Excused absences and false-alarm alerts never count.</Note>
          </>}
          {tab === 'Devices' && <dl className="wfx-kv"><dt>Bound device</dt><dd>Samsung Galaxy A34<small>Android 14</small></dd><dt>Integrity</dt><dd><span className="sdot good" />Play Integrity passed</dd><dt>Last punch</dt><dd>06:58<small>42 m from site</small></dd><dt>Change device</dt><dd><button className="btn sm ghost" onClick={() => toast('Device reset; worker re-verifies with OTP and face')}>Reset binding</button></dd></dl>}
          </div>
        </>; })()}
      </Drawer>

      <Drawer bottom open={!!form} onClose={() => setForm(null)} title="Add a worker" sub="They get a sign-in code by SMS and appear on the roster once you give them shifts.">
        {form && <>
          <div className="wfa-grid">
            <Field label="Full name"><input className={'input' + (form.tried && errs.name ? ' bad' : '')} value={form.name} onChange={set('name')} placeholder="As on their passport" autoFocus />{form.tried && errs.name && <span className="wfa-err">{errs.name}</span>}</Field>
            <Field label="Mobile number"><input className={'input' + (form.tried && errs.phone ? ' bad' : '')} value={form.phone} onChange={set('phone')} inputMode="tel" />{form.tried && errs.phone && <span className="wfa-err">{errs.phone}</span>}</Field>
            <Field label="Vendor"><Select className="input" value={form.vendor} onChange={set('vendor')}>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
            <Field label="Designation"><Select className="input" value={form.role} onChange={set('role')}>{roles.map((r) => <option key={r}>{r}</option>)}</Select></Field>
            {floater
              ? <Field label="Home area"><Select className="input" value={form.homeArea} onChange={set('homeArea')}>{Object.keys(HOME_AREAS).map((a) => <option key={a}>{a}</option>)}</Select><span className="wfa-hint">Floaters have no location; this suggests the nearest covers</span></Field>
              : <Field label="Location"><Select className="input" value={form.site} onChange={set('site')}>{SITES.filter((x) => siteInScope(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>}
            <Field label="Starts on"><input type="date" className="input" value={form.joined} onChange={set('joined')} /></Field>
            <Field label="Usual shift"><Select className="input" value={form.tpl} onChange={set('tpl')}>{SHIFT_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{tplLabel(t)}</option>)}</Select></Field>
            <Field label="Starting at"><input type="time" className="input" value={form.start} onChange={set('start')} /></Field>
            <Field label="Deliveroo staff ID (optional)"><input className="input" value={form.clientId} onChange={set('clientId')} placeholder="DRV-…" /></Field>
          </div>
          <div className="drawer-actions"><button className="btn ghost" onClick={() => setForm(null)}>Cancel</button><span className="grow" /><button className="btn" onClick={save}>Add worker</button></div>
        </>}
      </Drawer>
    </>
  );
}
