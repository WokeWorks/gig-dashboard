import { SITES, VENDORS, WORKERS, ROSTER_GROUPS, KPIS, DESIG_ACCESS, tplOf, tplLabel, endOf, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Pill, Tabs, Drawer, Bar, statusTone, Note, useToast, Icon } from '../../ui.jsx';
import { FULL_DAYS, fmtD } from '../../lib/dates.js';
import { todayOf } from '../../lib/live.js';
import { offDaysOf, timesheetOf } from '../../lib/roster.js';

const { useState } = React;

export function Workforce({ params, go }) {
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState(params?.vendor || 'all');
  const [site, setSite] = useState(params?.site || 'all');
  const [role, setRole] = useState('all');
  const [show, setShow] = useState('all');
  const [sel, setSel] = useState(params?.worker ? WORKERS.find((w) => w.id === params.worker) : null);
  const [tab, setTab] = useState(params?.tab || 'Overview');
  const toast = useToast();
  const base = WORKERS.filter((w) => (vendor === 'all' || w.vendor === vendor) && (site === 'all' || w.site === site) && (role === 'all' || w.role === role) && (!q || (w.name + w.code).toLowerCase().includes(q.toLowerCase())));
  const tagged = base.map((w) => ({ w, today: todayOf(w), month: timesheetOf(w).sum }));
  const counts = { all: tagged.length, in: tagged.filter((x) => x.today.key === 'in').length, notin: tagged.filter((x) => x.today.key === 'notin').length, off: tagged.filter((x) => x.today.key === 'off').length, docs: tagged.filter((x) => x.w.docs).length };
  const rows = tagged.filter((x) => show === 'all' || (show === 'docs' ? x.w.docs : x.today.key === show));
  const roles = [...new Set(WORKERS.map((w) => w.role))];
  return (
    <>
      <ScreenHeader title="Workforce" phase={1} spec="5.2" desc="Everyone working at your locations, whichever vendor employs them." actions={<>
        <button className="btn ghost" onClick={() => toast('Bulk import: upload CSV or XLSX, get a per-row error report')}>Bulk import</button>
        <button className="btn" onClick={() => go('onboarding')}>Add worker</button>
      </>} />
      <div className="toolbar">
        <input id="wf-search" className="input" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
        <select id="wf-site" className="input" value={site} onChange={(e) => setSite(e.target.value)} aria-label="Location"><option value="all">All locations</option>{SITES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}<option value="pool">Floaters (no location)</option></select>
        <select id="wf-vendor" className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} aria-label="Vendor"><option value="all">All vendors</option>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
        <select id="wf-role" className="input" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Designation"><option value="all">All designations</option>{roles.map((r) => <option key={r}>{r}</option>)}</select>
      </div>
      <div className="seg" role="tablist" aria-label="Show">
        {[['all', 'Everyone'], ['in', 'Working now'], ['notin', 'Not in'], ['off', 'Off today'], ['docs', 'Document issues']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={show === k} className={'seg-btn' + (show === k ? ' on' : '') + (k === 'notin' && counts.notin ? ' alert' : '')} onClick={() => setShow(k)}>{label}<span className="seg-n">{counts[k]}</span></button>
        ))}
      </div>
      <section className="card flush">
        <div className="table-wrap">
          <table className="table hover wf-table">
            <thead><tr><th>Worker</th><th>Location</th><th>Today</th><th>October so far</th><th>Documents</th></tr></thead>
            <tbody>
              {rows.map(({ w, today, month }) => (
                <tr key={w.id} onClick={() => { setSel(w); setTab('Overview'); }} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(w)}>
                  <td><b>{w.name}</b><div className="small muted"><span className="vtag" title={vendorOf(w.vendor).name}>{vendorOf(w.vendor).code}</span> {w.role}</div></td>
                  <td>{siteOf(w.site).name}</td>
                  <td><span className={'wf-dot ' + today.tone} />{today.text}</td>
                  <td><span className="mono">{month.hours.toFixed(0)} h</span><div className="small muted">{month.full} {month.full === 1 ? 'day' : 'days'}{month.absent ? <span className="neg"> · {month.absent} absent</span> : ''}</div></td>
                  <td>{w.docs ? <span className="wf-doc"><Icon name="alert" size={14} />{w.docs}</span> : <span className="muted small">All valid</span>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="muted small">Nobody matches these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name} sub={sel && `${sel.code} · ${vendorOf(sel.vendor).name} · ${sel.role}`}>
        {sel && <>
          <Tabs tabs={['Overview', 'Timesheet', 'Documents', 'Score', 'Devices']} value={tab} onChange={setTab} />
          {tab === 'Overview' && <dl className="kv">
            <dt>Phone</dt><dd className="mono">{sel.phone}</dd>
            <dt>Employer of record</dt><dd>{vendorOf(sel.vendor).name}</dd>
            {sel.site === 'pool' ? <>
              <dt>Access</dt><dd>Floater · no fixed location · since {fmtD(sel.joined)}</dd>
              <dt>Home area</dt><dd>{sel.homeArea} <span className="small muted">· used to suggest the nearest covers</span></dd>
            </> : <><dt>Access</dt><dd>{DESIG_ACCESS[sel.role] || 'Employee'}</dd><dt>Location</dt><dd>{siteOf(sel.site).name} · since {fmtD(sel.joined)}</dd></>}
            <dt>Deliveroo staff ID</dt><dd className="mono">{sel.clientId}</dd>
            <dt>Usual shift</dt><dd>{sel.site === 'pool' ? 'None · each cover follows the shift being covered' : (() => { const g = ROSTER_GROUPS.find((x) => x.people.includes(sel.id)); const row = g ? g.cells[g.people.indexOf(sel.id)] : []; const c = row.find((x) => Array.isArray(x) && x.length === 1); if (!c) return '—'; const [t, st] = c[0]; return `${st} – ${endOf(st, tplOf(t).base + (tplOf(t).brk || 0)).time} · ${tplLabel(tplOf(t))}`; })()}</dd>
            <dt>Weekly off</dt><dd>{(() => { const ds = offDaysOf(sel.id); return ds === 'rot' || !ds.length ? <span className="muted">None this week</span> : ds.map((k) => FULL_DAYS[k]).join(', '); })()} <span className="small muted">· this week, set on the roster</span> <button className="linkbtn small" onClick={() => go('schedule')}>Open roster</button></dd>
            <dt>Face enrolment</dt><dd><Pill tone="good">Enrolled</Pill></dd>
            <dt>Status</dt><dd><Pill tone={statusTone(sel.status)}>{sel.status}</Pill></dd>
          </dl>}
          {tab === 'Timesheet' && (() => { const ts = timesheetOf(sel); return <>
            <div className="ts-head"><select id="ts-per" className="input sm" defaultValue="oct"><option value="oct">October 2026 · in progress</option><option value="sep">September 2026 · closed</option></select><span className="small muted">Closes with the vendor statements</span></div>
            <div className="ts-sum">
              <div><span className="stat-value">{ts.sum.full}</span><span className="small muted">full days</span></div>
              <div><span className={'stat-value' + (ts.sum.absent ? ' neg' : '')}>{ts.sum.absent}</span><span className="small muted">absent</span></div>
              <div><span className="stat-value">{ts.sum.hours.toFixed(1)}</span><span className="small muted">hours worked</span></div>
              <div><span className="stat-value">{ts.sum.ot}</span><span className="small muted">overtime h</span></div>
            </div>
            <table className="table ts-days"><thead><tr><th>Day</th><th>Shift</th><th>In</th><th>Out</th><th className="num">Worked</th><th>Result</th></tr></thead>
              <tbody>{[...ts.days].reverse().map((d) => (
                <tr key={d.iso} className={d.shift ? '' : 'quiet'}>
                  <td className="nowrap">{fmtD(d.iso)}</td>
                  <td className="mono small">{d.shift || <span className="muted">—</span>}</td>
                  <td className="mono small">{d.inT ? <>{d.inT}{d.late ? <span className="neg"> +{d.late}m</span> : ''}</> : <span className="muted">—</span>}</td>
                  <td className="mono small">{d.outT === 'auto' ? <span title="Closed automatically after the shift">auto</span> : d.outT || <span className="muted">—</span>}</td>
                  <td className="num mono small">{d.worked != null ? d.worked + (d.ot ? ` (+${d.ot})` : '') : <span className="muted">—</span>}</td>
                  <td>{d.kind === 'Full' ? <Pill tone="good">Full</Pill> : d.kind === 'Absent' ? <Pill tone="crit">Absent</Pill> : d.kind === 'Today' ? <Pill tone="info">On shift</Pill> : <span className="small muted">{d.kind}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
            <Note>Built from clock-ins against the roster. No clock-in means absent, unless a manager marks attendance from the Liveboard; those days show as marked, with the reason. A forgotten clock-out is closed automatically after the shift.</Note>
          </>; })()}
          {tab === 'Documents' && <table className="table"><tbody>
            {[['Passport', '2031-04-11', 'good'], ['UAE visa', sel.docs?.includes('Visa') ? '2026-10-19' : '2027-06-02', sel.docs?.includes('Visa') ? 'warn' : 'good'], ['Emirates ID', sel.docs?.includes('Emirates') ? 'Missing' : '2027-06-02', sel.docs?.includes('Emirates') ? 'crit' : 'good'], ['Food handling certificate', '2027-01-30', 'good']].map(([n, d, t]) => <tr key={n}><td>{n}</td><td className="mono">{d}</td><td><Pill tone={t}>{t === 'good' ? 'Valid' : t === 'warn' ? 'Expiring' : 'Missing'}</Pill></td></tr>)}
          </tbody></table>}
          {tab === 'Score' && <>
            <div className="bigscore"><span className="mono">{sel.score}</span><span className="muted">/ 100 this month</span></div>
            {KPIS.map((k, i) => <div key={k.id} className="kpi-row"><span>{k.name} <span className="muted small">· {k.weight}%</span></span><Bar value={[96, 88, 100, 81, 92, 80][i]} /></div>)}
            <Note>Every score links back to the records behind it. Excused absences and false-alarm alerts never count.</Note>
          </>}
          {tab === 'Devices' && <dl className="kv"><dt>Bound device</dt><dd>Samsung Galaxy A34 · Android 14</dd><dt>Integrity</dt><dd><Pill tone="good">Play Integrity passed</Pill></dd><dt>Last punch</dt><dd className="mono">06:58 · 42 m from site</dd><dt>Change device</dt><dd><button className="btn sm ghost" onClick={() => toast('Device reset; worker re-verifies with OTP and face')}>Reset binding</button></dd></dl>}
        </>}
      </Drawer>
    </>
  );
}
