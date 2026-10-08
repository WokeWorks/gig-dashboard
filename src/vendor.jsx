import { WORKERS, PROPOSALS, DAYS, SITES, ROSTER_GROUPS, tplOf, endOf, siteOf, vendorOf } from './data.js';
import { todayOf, timesheetOf, missedAt } from './operator.jsx';
import { ScreenHeader, Stat, Pill, Bar, Spark, Avatar, statusTone, aed, Field, Note, useToast, Icon } from './ui.jsx';

const { useState } = React;
const ME = 'v4';

const mineAll = () => WORKERS.filter((w) => w.vendor === ME);
const Pips = ({ a, b }) => <span className="pips" aria-hidden="true">{Array.from({ length: Math.max(b, 1) }, (_, i) => <span key={i} className={i < a ? 'f' : ''} />)}</span>;

export function VendorOverview({ go }) {
  const mine = mineAll();
  const v = vendorOf(ME);
  const t = mine.map((w) => todayOf(w));
  const inN = t.filter((x) => x.key === 'in').length, late = t.filter((x) => x.text.startsWith('Late')).length, ns = t.filter((x) => x.key === 'notin').length, due = t.filter((x) => x.key !== 'off').length;
  const bySite = [...new Set(mine.map((w) => w.site))].map((sid) => { const ws = mine.filter((w) => w.site === sid); const tt = ws.map((w) => todayOf(w)); return { sid, due: tt.filter((x) => x.key !== 'off').length, in: tt.filter((x) => x.key === 'in').length, late: tt.filter((x) => x.text.startsWith('Late')).length, ns: tt.filter((x) => x.key === 'notin').length }; }).filter((x) => x.due > 0).sort((a, b) => b.ns - a.ns || b.due - a.due);
  return (
    <>
      <ScreenHeader title="Overview" phase={1} spec="6" desc="Your own people only. Nothing about other vendors or what they charge." />
      <div className="stats">
        <Stat label="Clocked in now" value={`${inN}/${due}`} sub="Of those rostered today" />
        <Stat label="Late" value={late} tone={late ? 'warn' : undefined} />
        <Stat label="No-show" value={ns} tone={ns ? 'crit' : undefined} />
        <Stat label="Vendor score" value={v.score} sub="+3 on September" tone="good" />
      </div>
      <div className="grid-2">
        <section className="card flush">
          <div className="card-head pad"><h3>Today, by location</h3><span className="small muted">Where your people are working</span></div>
          {bySite.map((x) => (
            <div key={x.sid} className="vo-loc">
              <div><b>{x.sid === 'pool' ? 'Floaters' : siteOf(x.sid).name}</b><div className="small muted">{x.in}/{x.due} clocked in{x.late ? ` · ${x.late} late` : ''}{x.ns ? '' : ''}</div></div>
              <Pips a={x.in} b={x.due} />
              {x.ns ? <Pill tone="crit">{x.ns} no-show</Pill> : <span className="small muted">All in</span>}
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-head"><h3>Your proposals</h3><button className="btn sm ghost" onClick={() => go && go('v-prop')}>Open</button></div>
          <div className="row-line"><Pill>Proposed</Pill><span className="small">1 candidate</span></div>
          <div className="row-line"><Pill tone="info">In review</Pill><span className="small">1 candidate</span></div>
          <div className="row-line"><Pill tone="info">Staff ID pending</Pill><span className="small">1 candidate, waiting for a Deliveroo staff ID</span></div>
          <div className="card-head" style={{ marginTop: 16 }}><h3>Score trend</h3></div>
          <Spark data={[78, 80, 79, 82, 83, 86]} w={280} h={56} />
          <div className="small muted">May to October 2026</div>
        </section>
      </div>
    </>
  );
}

export function VendorWorkers() {
  const mine = mineAll();
  return (
    <>
      <ScreenHeader title="My workers" phase={1} spec="6" desc="Everyone you employ who works at Deliveroo locations. View only: changes go through a proposal or a message to ops." />
      <section className="card flush"><div className="table-wrap"><table className="table wf-table">
        <thead><tr><th>Worker</th><th>Location</th><th>Today</th><th>October so far</th><th className="num">Score</th><th>Documents</th></tr></thead>
        <tbody>{mine.map((w) => { const today = todayOf(w); const m = timesheetOf(w).sum; return (
          <tr key={w.id}>
            <td><b>{w.name}</b><div className="small muted">{w.role}</div></td>
            <td>{w.site === 'pool' ? <span className="muted">Floater, goes where needed</span> : siteOf(w.site).name}</td>
            <td><span className={'wf-dot ' + today.tone} />{today.text}</td>
            <td><span className="mono">{m.hours.toFixed(0)} h</span><div className="small muted">{m.full} {m.full === 1 ? 'day' : 'days'}{m.absent ? <span className="neg"> · {m.absent} absent</span> : ''}</div></td>
            <td className="num mono">{w.score}</td>
            <td>{w.docs ? <span className="wf-doc"><Icon name="alert" size={14} />{w.docs}</span> : <span className="muted small">All valid</span>}</td>
          </tr>
        ); })}</tbody>
      </table></div></section>
      <Note>Keeping documents in date is yours to do. An expired visa or Emirates ID stops that person clocking in.</Note>
    </>
  );
}

// One word per day: what actually happened, or what is planned.
const DAYWORD = { in: 'In', late: 'Late', abs: 'Absent', leave: 'Leave', off: 'Off', none: '–', standby: 'Standby' };
const dayOf = (w, ci) => {
  const g = ROSTER_GROUPS.find((x) => x.people.includes(w.id)); if (!g) return ['none'];
  const c = g.cells[g.people.indexOf(w.id)][ci];
  if (c === 'O') return ['off']; if (c === 'L') return ['leave']; if (!Array.isArray(c)) return [c === 'A' ? 'standby' : 'none'];
  const [t, st, at] = c[0]; const plan = `${st}`; const where = at && at !== g.site ? siteOf(at).name.replace(/^(Spinneys|Carrefour) /, '') : '';
  if (ci > 2) return ['plan', plan, where];
  if (ci === 2) { const td = todayOf(w); return [td.key === 'notin' ? 'abs' : td.text.startsWith('Late') ? 'late' : td.key === 'in' ? 'in' : 'plan', plan, where]; }
  if (missedAt(g.site, w.id, 0, ci)) return ['abs', '', where];
  return [(parseInt(w.id.slice(1), 10) + ci) % 9 === 4 ? 'late' : 'in', '', where];
};
export function VendorAttendance() {
  const mine = mineAll();
  return (
    <>
      <ScreenHeader title="Attendance" phase={1} spec="6" desc="What each of your workers did this week, wherever they worked. Days still to come show their rostered start." />
      <div className="legend small va-legend">{['in', 'late', 'abs', 'leave', 'off'].map((k) => <span key={k} className={'dchip ' + k}>{DAYWORD[k]}</span>)}<span className="dchip standby">Standby</span><span className="dchip plan">07:00</span><span className="muted">rostered start, still to come</span></div>
      <section className="card flush"><div className="table-wrap"><table className="table va-table">
        <thead><tr><th>Worker</th>{DAYS.map((d, i) => <th key={d} className={i === 2 ? 'today' : ''}>{d}{i === 2 && <span className="today-tag">Today</span>}</th>)}</tr></thead>
        <tbody>{mine.map((w) => <tr key={w.id}><td><b>{w.name}</b><div className="small muted">{w.site === 'pool' ? 'Floater, goes where needed' : siteOf(w.site).name}</div></td>
          {DAYS.map((d, i) => { const [k, plan, where] = dayOf(w, i); return <td key={d} className={i === 2 ? 'today' : ''}><span className={'dchip ' + k}>{k === 'plan' ? plan : DAYWORD[k]}</span>{where && <div className="va-where">{where}</div>}</td>; })}</tr>)}</tbody>
      </table></div></section>
    </>
  );
}

export function VendorScorecard() {
  const v = vendorOf(ME);
  const rows = [['Fill rate', v.fill + '%', 'Heads supplied ÷ requested', [90, 92, 94, 93, 95, 96]], ['Attendance rate', '97.1%', 'Rostered shifts attended', [95, 96, 96, 97, 96, 97]], ['No-show rate', v.noshow + '%', 'Lower is better', [3.1, 2.8, 2.4, 2.2, 2.0, 1.8]], ['Time to fill', v.ttf + ' h', 'Request to candidates proposed', [36, 30, 28, 26, 24, 22]], ['Retention at 90 days', v.retention + '%', 'Still active after 90 days', [80, 82, 84, 85, 87, 88]], ['Document compliance', v.compliance + '%', 'Workers with valid documents', [92, 93, 95, 95, 96, 97]]];
  return (
    <>
      <ScreenHeader title="Scorecard" phase={2} spec="8" desc="Your vendor score is built from these metrics plus your workers' average score. Your rank against other vendors is never shown." />
      <div className="score-grid">{rows.map(([k, val, d, s]) => <section key={k} className="card"><div className="stat-label">{k}</div><div className="stat-value">{val}</div><Spark data={s} w={200} h={36} /><div className="small muted">{d}</div></section>)}</div>
    </>
  );
}

export function VendorProposals() {
  const [items, setItems] = useState(PROPOSALS.filter((p) => p.vendor === ME));
  const [form, setForm] = useState({ name: '', phone: '', idno: '', role: 'Picker', site: 's1' });
  const toast = useToast();
  const stageLabel = { proposed: ['Proposed', 'muted'], review: ['In review', 'info'], client: ['Staff ID pending', 'info'], ready: ['Ready', 'good'], returned: ['Returned', 'warn'] };
  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { toast('Add a name and phone number'); return; }
    setItems([{ id: 'n' + Date.now(), name: form.name, role: form.role, site: form.site, stage: 'proposed', docs: 0, docsReq: 4 }, ...items]);
    setForm({ name: '', phone: '', idno: '', role: 'Picker', site: 's1' });
    toast('Proposal sent to Deliveroo for review');
  };
  return (
    <>
      <ScreenHeader title="Proposals" phase={1} spec="6" desc="The one thing a vendor can create. Deliveroo reviews every proposal before the person is rostered." />
      <div className="grid-2">
        <form className="card form" onSubmit={submit}>
          <div className="card-head"><h3>Propose a candidate</h3></div>
          <div className="form-grid">
            <Field label="Full name (as on passport)"><input id="pr-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Mobile number"><input id="pr-phone" className="input mono" placeholder="+971 5…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Emirates ID or passport no."><input id="pr-id" className="input mono" value={form.idno} onChange={(e) => setForm({ ...form, idno: e.target.value })} /></Field>
            <Field label="Role"><select id="pr-role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option>Picker</option><option>Reliever</option><option>Shift lead</option></select></Field>
            <Field label="Preferred location"><select id="pr-site" className="input" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })}>{SITES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Replaces (optional)"><select id="pr-rep" className="input"><option>New headcount</option><option>Rizwan Khan (no-show 3×)</option></select></Field>
          </div>
          <div className="uploads">{['Passport', 'Visa', 'Emirates ID', 'Photo'].map((d) => <label key={d} className="upload"><input type="file" id={'up-' + d} /><span>{d}</span></label>)}</div>
          <button className="btn" type="submit">Send proposal</button>
        </form>
        <section className="card">
          <div className="card-head"><h3>Status</h3></div>
          {items.map((p) => <div key={p.id} className="row-line"><b>{p.name}</b><span className="small muted">{p.role} · {siteOf(p.site).name}</span><Pill tone={stageLabel[p.stage][1]}>{stageLabel[p.stage][0]}</Pill></div>)}
          <Note>A proposal becomes a worker only after Deliveroo approves it and issues a staff ID.</Note>
        </section>
      </div>
    </>
  );
}

export function VendorRequests() {
  const toast = useToast();
  return (
    <>
      <ScreenHeader title="Headcount requests" phase={2} spec="6" desc="Deliveroo asks for people; you answer by proposing candidates." />
      <section className="card">
        {[['5 Pickers', 'Carrefour Barsha Heights', 'From Mon 12 Oct', '2 proposed'], ['1 Shift lead', 'Spinneys Majan', 'From Thu 15 Oct', 'None yet'], ['3 Relievers', 'Any location', 'From Mon 19 Oct', 'None yet']].map(([n, s, d, st]) => (
          <div key={n + s} className="row-line"><b>{n}</b><span className="small">{s} · {d}</span><Pill tone={st === 'None yet' ? 'warn' : 'info'}>{st}</Pill><button className="btn sm" onClick={() => toast('Opened proposal form for this request')}>Propose</button></div>
        ))}
      </section>
    </>
  );
}

export function VendorStatements() {
  return (
    <>
      <ScreenHeader title="Statements" phase={2} spec="9" desc="What Deliveroo owes you, from approved timesheets." />
      <section className="card flush"><table className="table">
        <thead><tr><th>Period</th><th className="num">Days present</th><th className="num">Gross</th><th className="num">No-show deductions</th><th className="num">Net payable</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>September 2026</td><td className="num mono">1,786</td><td className="num mono">{aed(199210)}</td><td className="num mono neg">{aed(-600)}</td><td className="num mono"><b>{aed(198610)}</b></td><td><Pill tone="info">Issued</Pill></td></tr>
          <tr><td>August 2026</td><td className="num mono">1,810</td><td className="num mono">{aed(201880)}</td><td className="num mono neg">{aed(-450)}</td><td className="num mono">{aed(201430)}</td><td><Pill tone="good">Paid</Pill></td></tr>
        </tbody>
      </table></section>
      <Note>Your rate card: AED 2,900 per head per month, prorated by days present ÷ 26, optional overtime at 1.25×. Deductions are no-show penalties under your contract.</Note>
    </>
  );
}
