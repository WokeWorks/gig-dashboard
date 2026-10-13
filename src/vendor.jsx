import { WORKERS, FIN_VENDORS, PROPOSALS, DAYS, SITES, ROSTER_GROUPS, siteOf, vendorOf } from './data.js';
import { todayOf } from './lib/live.js';
import { timesheetOf, missedAt } from './lib/roster.js';
import { GEO } from './lib/geo.js';
import { LiveMap } from './lib/livemap.jsx';
import { ScreenHeader, Pill, Spark, aed, Field, Note, useToast, Icon, Select } from './ui.jsx';

const { useState } = React;
const ME = 'v4'; // GH FZE

/* ---------- the clients this vendor supplies ----------
   A vendor usually supplies more than one client. Deliveroo UAE runs on OpsPro here, so its numbers are the live
   prototype data; the other two are small mock clients so the portal shows how a vendor sees all of them at once. */
export const VCLIENTS = [
  { id: 'deliveroo', name: 'Deliveroo UAE', score: 91, trend: [78, 80, 79, 82, 83, 86, 91], rate: 'AED 2,900 per head per month, prorated by days present ÷ 26, overtime at 1.25×' },
  { id: 'talabat', name: 'Talabat Mart', score: 84, trend: [80, 81, 79, 82, 83, 84, 84], rate: 'AED 13.50 an hour worked, overtime at 1.25×',
    sites: ['Talabat Mart Al Quoz', 'Talabat Mart Al Nahda, Sharjah', 'Talabat Mart Al Jurf, Ajman'], roles: ['Picker', 'Picker', 'Picker', 'Shift lead'], heads: 14 },
  { id: 'aflog', name: 'Al-Futtaim Logistics', score: 88, trend: [84, 85, 85, 86, 87, 88, 88], rate: 'AED 2,700 per head per month, overtime at 1.25×',
    sites: ['Jebel Ali DC', 'KIZAD DC, Abu Dhabi'], roles: ['Warehouse associate', 'Warehouse associate', 'Loader', 'Forklift operator'], heads: 10 },
];
export const vclient = (id) => VCLIENTS.find((c) => c.id === id);
// Where the mock clients' sites are (lng, lat), roughly; Deliveroo's come from GEO.
const VGEO = { 'Talabat Mart Al Quoz': [55.2297, 25.1385], 'Talabat Mart Al Nahda, Sharjah': [55.3725, 25.2995], 'Talabat Mart Al Jurf, Ajman': [55.4710, 25.3920], 'Jebel Ali DC': [55.0626, 24.9857], 'KIZAD DC, Abu Dhabi': [54.6550, 24.7230] };
const geoOf = (where) => { const s = SITES.find((x) => x.name === where); return s ? GEO[s.id] : VGEO[where]; };
const nameOf = (client) => (client === 'all' ? 'your clients' : vclient(client).name);

// Mock people for the other clients, generated so they stay the same on every load.
const POOL = ['Ramesh Thapa', 'Joel Mendoza', 'Kwame Mensah', 'Anwar Hossain', 'Sunil Pillai', 'Ricardo Santos', 'Samuel Ochieng', 'Faizan Ahmed', 'Deepak Rai', 'Arnel Cruz', 'Ibrahim Musa', 'Nirmal Joseph', 'Asif Iqbal', 'Rodel Garcia', 'Peter Kamau', 'Manoj Kumar', 'Habib Rahman', 'Jun Villanueva', 'Yusuf Bello', 'Shibu Thomas', 'Karim Uddin', 'Paolo Reyes', 'Daniel Otieno', 'Vikas Yadav'];
const TODAY_MIX = [['in', 'good', 'In since 06:58'], ['in', 'good', 'In since 07:02'], ['in', 'good', 'In since 06:51'], ['in', 'warn', 'Late · 18 min'], ['off', 'muted', 'Weekly off'], ['in', 'good', 'In since 13:57'], ['notin', 'crit', 'No-show'], ['off', 'info', 'On leave'], ['in', 'good', 'In since 06:55']];
const WEEK_MIX = ['in', 'in', 'late', 'in', 'off', 'in', 'abs', 'in', 'in', 'leave'];
const others = VCLIENTS.filter((c) => c.sites).flatMap((c, ci) => Array.from({ length: c.heads }, (_, i) => {
  const n = ci * 31 + i * 7; const t = TODAY_MIX[n % TODAY_MIX.length]; const off = (n % 7);
  return { id: `${c.id}-${i}`, client: c.id, name: POOL[(ci * 11 + i) % POOL.length], role: c.roles[i % c.roles.length], where: c.sites[i % c.sites.length],
    today: { key: t[0], tone: t[1], text: t[2] }, hours: 150 + (n % 40), days: 14 + (n % 5), absent: n % 9 === 6 ? 1 : 0, score: 74 + (n % 22), docs: n % 13 === 5 ? 1 : 0,
    week: DAYS.map((_, d) => (d === off ? ['off'] : d > 2 ? ['plan', i % 3 === 2 ? '14:00' : '07:00'] : d === 2 ? [t[0] === 'notin' ? 'abs' : t[2].startsWith('Late') ? 'late' : t[0] === 'off' ? (t[2] === 'On leave' ? 'leave' : 'off') : 'in'] : [WEEK_MIX[(n + d) % WEEK_MIX.length]])) };
}));

// Deliveroo people, from the live prototype data. One word per day: what happened, or what is planned.
const dayOf = (w, ci) => {
  const g = ROSTER_GROUPS.find((x) => x.people.includes(w.id)); if (!g) return ['none'];
  const c = g.cells[g.people.indexOf(w.id)][ci];
  if (c === 'O') return ['off']; if (c === 'L') return ['leave']; if (!Array.isArray(c)) return [c === 'A' ? 'standby' : 'none'];
  const [, st, at] = c[0]; const where = at && at !== g.site ? siteOf(at).name.replace(/^(Spinneys|Carrefour) /, '') : '';
  if (ci > 2) return ['plan', st, where];
  if (ci === 2) { const td = todayOf(w); return [td.key === 'notin' ? 'abs' : td.text.startsWith('Late') ? 'late' : td.key === 'in' ? 'in' : 'plan', st, where]; }
  if (missedAt(g.site, w.id, 0, ci)) return ['abs', '', where];
  return [(parseInt(w.id.slice(1), 10) + ci) % 9 === 4 ? 'late' : 'in', '', where];
};
const deliveroo = () => WORKERS.filter((w) => w.vendor === ME).map((w) => { const m = timesheetOf(w).sum; return {
  id: w.id, client: 'deliveroo', name: w.name, role: w.role, where: w.site === 'pool' ? 'Floater, goes where needed' : siteOf(w.site).name,
  today: todayOf(w), hours: m.hours, days: m.full, absent: m.absent, score: w.score, docs: w.docs, week: DAYS.map((_, i) => dayOf(w, i)) }; });

// Everyone this vendor supplies, to one client or to all of them.
export const peopleFor = (client) => [...deliveroo(), ...others].filter((p) => client === 'all' || p.client === client);
const todayCounts = (ps) => ({ due: ps.filter((p) => p.today.key !== 'off').length, in: ps.filter((p) => p.today.key === 'in').length, late: ps.filter((p) => p.today.text.startsWith('Late')).length, ns: ps.filter((p) => p.today.key === 'notin').length });

const Pips = ({ a, b }) => <span className="pips" aria-hidden="true">{Array.from({ length: Math.max(b, 1) }, (_, i) => <span key={i} className={i < a ? 'f' : ''} />)}</span>;
const ClientCell = ({ id }) => <span className="vc-tag">{vclient(id).name}</span>;

export function VendorOverview({ go, client = 'all' }) {
  const [pick, setPick] = useState(null);
  const ps = peopleFor(client); const t = todayCounts(ps);
  const score = client === 'all' ? Math.round(VCLIENTS.reduce((a, c) => a + c.score * peopleFor(c.id).length, 0) / peopleFor('all').length) : vclient(client).score;
  // By location for one client; by client when looking at all of them.
  const groups = client === 'all'
    ? VCLIENTS.map((c) => ({ key: c.id, title: c.name, sub: `${peopleFor(c.id).length} people · score ${c.score}`, ...todayCounts(peopleFor(c.id)) }))
    : [...new Set(ps.map((p) => p.where))].map((w) => ({ key: w, title: w, ...todayCounts(ps.filter((p) => p.where === w)) })).filter((x) => x.due > 0).sort((a, b) => b.ns - a.ns || b.due - a.due);
  return (
    <>
      <ScreenHeader title="Overview" phase={1} spec="6" />
      <section className="card flush lm-wrap vo-map">
        <LiveMap height={420} pick={pick} onPick={setPick} points={[...new Set(ps.filter((p) => p.today.key !== 'off').map((p) => p.where))].map((w) => geoOf(w) && { w, g: geoOf(w), ...todayCounts(ps.filter((p) => p.where === w)) }).filter(Boolean).map((x) => ({ id: x.w, name: x.w.replace(/^(Spinneys|Carrefour|Talabat Mart) /, ''), title: x.w, lat: x.g[1], lng: x.g[0], due: x.due, inn: x.in, bad: x.ns, late: x.late }))} />
        <div className="lm-over lm-stats">
          <div className={t.in ? 'good' : ''}><span className="lm-sv">{t.in}</span><span className="lm-sl">in now</span></div>
          <div className={t.ns ? 'crit' : ''}><span className="lm-sv">{t.ns}</span><span className="lm-sl">no-show</span></div>
          <div className={t.late ? 'warn' : ''}><span className="lm-sv">{t.late}</span><span className="lm-sl">late</span></div>
          <div className="good" title={client === 'all' ? 'Score across clients, weighted by headcount' : `Your score from ${vclient(client).name}`}><span className="lm-sv">{score}</span><span className="lm-sl">score</span></div>
        </div>
      </section>
      <div className="grid-2">
        <section className="card flush">
          <div className="card-head pad"><h3>Today, {client === 'all' ? 'by client' : 'by location'}</h3></div>
          {groups.map((x) => (
            <div key={x.key} className="vo-loc">
              <div><b>{x.title}</b><div className="small muted">{x.sub ? `${x.sub} · ` : ''}{x.in}/{x.due} clocked in{x.late ? ` · ${x.late} late` : ''}</div></div>
              <Pips a={x.in} b={x.due} />
              {x.ns ? <Pill tone="crit">{x.ns} no-show</Pill> : <span className="small muted">All in</span>}
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-head"><h3>Your proposals</h3><button className="btn sm ghost" onClick={() => go && go('v-prop')}>Open</button></div>
          {proposalsFor(client).map((p) => <div key={p.id} className="row-line"><Pill tone={STAGE[p.stage][1]}>{STAGE[p.stage][0]}</Pill><span className="small">{p.name}{client === 'all' ? ` · ${vclient(p.client).name}` : ''}</span></div>)}
          <div className="card-head" style={{ marginTop: 16 }}><h3>Score trend</h3></div>
          <Spark data={client === 'all' ? VCLIENTS[0].trend.map((_, i) => Math.round(VCLIENTS.reduce((a, c) => a + c.trend[i], 0) / VCLIENTS.length)) : vclient(client).trend} w={280} h={56} />
          <div className="small muted">April to October 2026</div>
        </section>
      </div>
    </>
  );
}

export function VendorWorkers({ client = 'all' }) {
  const ps = peopleFor(client);
  return (
    <>
      <ScreenHeader title="My workers" phase={1} spec="6" />
      <section className="card flush"><div className="table-wrap"><table className="table wf-table">
        <thead><tr><th>Worker</th>{client === 'all' && <th>Client</th>}<th>Location</th><th>Today</th><th>October so far</th><th className="num">Score</th><th>Documents</th></tr></thead>
        <tbody>{ps.map((p) => (
          <tr key={p.id}>
            <td><b>{p.name}</b><div className="small muted">{p.role}</div></td>
            {client === 'all' && <td><ClientCell id={p.client} /></td>}
            <td>{p.where}</td>
            <td><span className={'wf-dot ' + p.today.tone} />{p.today.text}</td>
            <td><span className="mono">{p.hours.toFixed(0)} h</span><div className="small muted">{p.days} {p.days === 1 ? 'day' : 'days'}{p.absent ? <span className="neg"> · {p.absent} absent</span> : ''}</div></td>
            <td className="num mono">{p.score}</td>
            <td>{p.docs ? <span className="wf-doc"><Icon name="alert" size={14} />{p.docs}</span> : <span className="muted small">All valid</span>}</td>
          </tr>
        ))}</tbody>
      </table></div></section>
      <Note>Keeping documents in date is yours to do. An expired visa or Emirates ID stops that person clocking in, for every client.</Note>
    </>
  );
}

const DAYWORD = { in: 'In', late: 'Late', abs: 'Absent', leave: 'Leave', off: 'Off', none: '–', standby: 'Standby' };
export function VendorAttendance({ client = 'all' }) {
  const ps = peopleFor(client);
  return (
    <>
      <ScreenHeader title="Attendance" phase={1} spec="6" />
      <div className="legend small va-legend">{['in', 'late', 'abs', 'leave', 'off'].map((k) => <span key={k} className={'dchip ' + k}>{DAYWORD[k]}</span>)}<span className="dchip standby">Standby</span><span className="dchip plan">07:00</span><span className="muted">rostered start, still to come</span></div>
      <section className="card flush"><div className="table-wrap"><table className="table va-table">
        <thead><tr><th>Worker</th>{DAYS.map((d, i) => <th key={d} className={i === 2 ? 'today' : ''}>{d}{i === 2 && <span className="today-tag">Today</span>}</th>)}</tr></thead>
        <tbody>{ps.map((p) => <tr key={p.id}><td><b>{p.name}</b><div className="small muted">{client === 'all' ? `${vclient(p.client).name} · ` : ''}{p.where}</div></td>
          {p.week.map(([k, plan, where], i) => <td key={i} className={i === 2 ? 'today' : ''}><span className={'dchip ' + k}>{k === 'plan' ? plan : DAYWORD[k]}</span>{where && <div className="va-where">{where}</div>}</td>)}</tr>)}</tbody>
      </table></div></section>
    </>
  );
}

export function VendorScorecard({ client = 'all' }) {
  const v = vendorOf(ME);
  if (client === 'all') return (
    <>
      <ScreenHeader title="Scorecard" phase={2} spec="8" />
      <section className="card flush"><table className="table">
        <thead><tr><th>Client</th><th className="num">People</th><th className="num">Score</th><th>Last 7 months</th></tr></thead>
        <tbody>{VCLIENTS.map((c) => <tr key={c.id}><td><b>{c.name}</b></td><td className="num mono">{peopleFor(c.id).length}</td><td className="num mono"><b>{c.score}</b></td><td><Spark data={c.trend} w={140} h={28} /></td></tr>)}</tbody>
      </table></section>
      <Note>Each client scores you on its own terms. Pick a client to see what makes up its score.</Note>
    </>
  );
  const c = vclient(client); const k = c.score - 91; // other clients sit a little off Deliveroo's numbers
  const rows = [['Fill rate', Math.min(100, v.fill + k) + '%', 'Heads supplied ÷ requested', [90, 92, 94, 93, 95, 96]], ['Attendance rate', (97.1 + k / 3).toFixed(1) + '%', 'Rostered shifts attended', [95, 96, 96, 97, 96, 97]], ['No-show rate', (v.noshow - k / 4).toFixed(1) + '%', 'Lower is better', [3.1, 2.8, 2.4, 2.2, 2.0, 1.8]], ['Time to fill', v.ttf - k + ' h', 'Request to candidates proposed', [36, 30, 28, 26, 24, 22]], ['Retention at 90 days', Math.min(100, v.retention + k) + '%', 'Still active after 90 days', [80, 82, 84, 85, 87, 88]], ['Document compliance', Math.min(100, v.compliance + k) + '%', 'Workers with valid documents', [92, 93, 95, 95, 96, 97]]];
  return (
    <>
      <ScreenHeader title="Scorecard" phase={2} spec="8" />
      <div className="score-grid">{rows.map(([n, val, d, s]) => <section key={n} className="card"><div className="stat-label">{n}</div><div className="stat-value">{val}</div><Spark data={s} w={200} h={36} /><div className="small muted">{d}</div></section>)}</div>
    </>
  );
}

const STAGE = { proposed: ['Proposed', 'muted'], review: ['In review', 'info'], client: ['Staff ID pending', 'info'], ready: ['Ready', 'good'], returned: ['Returned', 'warn'] };
const PROPS = [...PROPOSALS.filter((p) => p.vendor === ME).map((p) => ({ ...p, client: 'deliveroo', where: siteOf(p.site).name })),
  { id: 'dp1', client: 'deliveroo', name: 'Santosh Gurung', role: 'Picker', where: 'Carrefour Barsha Heights', stage: 'proposed' },
  { id: 'dp2', client: 'deliveroo', name: 'Aldrin Bautista', role: 'Reliever', where: 'Spinneys Marina Promenade', stage: 'review' },
  { id: 'dp3', client: 'deliveroo', name: 'Moses Adeyemi', role: 'Picker', where: 'Carrefour Marina Mall', stage: 'client' },
  { id: 'tp1', client: 'talabat', name: 'Joel Mendoza', role: 'Picker', where: 'Talabat Mart Al Nahda, Sharjah', stage: 'review' },
  { id: 'ap1', client: 'aflog', name: 'Kwame Mensah', role: 'Forklift operator', where: 'Jebel Ali DC', stage: 'proposed' }];
const proposalsFor = (client) => PROPS.filter((p) => client === 'all' || p.client === client);
const sitesOf = (cid) => (cid === 'deliveroo' ? SITES.map((s) => s.name) : vclient(cid).sites);
const rolesOf = (cid) => (cid === 'deliveroo' ? ['Picker', 'Reliever', 'Shift lead'] : [...new Set(vclient(cid).roles)]);

export function VendorProposals({ client = 'all' }) {
  const [items, setItems] = useState(proposalsFor(client));
  const first = client === 'all' ? 'deliveroo' : client;
  const [form, setForm] = useState({ name: '', phone: '', idno: '', client: first, role: rolesOf(first)[0], where: sitesOf(first)[0] });
  const toast = useToast();
  const setClient = (cid) => setForm({ ...form, client: cid, role: rolesOf(cid)[0], where: sitesOf(cid)[0] });
  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { toast('Add a name and phone number'); return; }
    setItems([{ id: 'n' + Date.now(), client: form.client, name: form.name, role: form.role, where: form.where, stage: 'proposed' }, ...items]);
    setForm({ ...form, name: '', phone: '', idno: '' });
    toast(`Proposal sent to ${vclient(form.client).name} for review`);
  };
  return (
    <>
      <ScreenHeader title="Proposals" phase={1} spec="6" />
      <div className="grid-2">
        <form className="card form" onSubmit={submit}>
          <div className="card-head"><h3>Propose a candidate</h3></div>
          <div className="form-grid">
            {client === 'all' && <Field label="For"><Select id="pr-client" className="input" value={form.client} onChange={(e) => setClient(e.target.value)}>{VCLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
            <Field label="Full name (as on passport)"><input id="pr-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Mobile number"><input id="pr-phone" className="input mono" placeholder="+971 5…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Emirates ID or passport no."><input id="pr-id" className="input mono" value={form.idno} onChange={(e) => setForm({ ...form, idno: e.target.value })} /></Field>
            <Field label="Role"><Select id="pr-role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{rolesOf(form.client).map((r) => <option key={r}>{r}</option>)}</Select></Field>
            <Field label="Preferred location"><Select id="pr-site" className="input" value={form.where} onChange={(e) => setForm({ ...form, where: e.target.value })}>{sitesOf(form.client).map((s) => <option key={s}>{s}</option>)}</Select></Field>
          </div>
          <div className="uploads">{['Passport', 'Visa', 'Emirates ID', 'Photo'].map((d) => <label key={d} className="upload"><input type="file" id={'up-' + d} /><span>{d}</span></label>)}</div>
          <button className="btn" type="submit">Send to {vclient(form.client).name}</button>
        </form>
        <section className="card">
          <div className="card-head"><h3>Status</h3></div>
          {items.map((p) => <div key={p.id} className="row-line"><b>{p.name}</b><span className="small muted">{p.role} · {p.where}{client === 'all' && !p.where.startsWith(vclient(p.client).name.split(' ')[0]) ? ` · ${vclient(p.client).name}` : ''}</span><Pill tone={STAGE[p.stage][1]}>{STAGE[p.stage][0]}</Pill></div>)}
          <Note>A proposal becomes a worker only after the client approves it and issues a staff ID.</Note>
        </section>
      </div>
    </>
  );
}

const REQS = [['deliveroo', '5 Pickers', 'Carrefour Barsha Heights', 'From Mon 12 Oct', '2 proposed'], ['deliveroo', '1 Shift lead', 'Spinneys Majan', 'From Thu 15 Oct', 'None yet'], ['talabat', '4 Pickers', 'Talabat Mart Al Nahda, Sharjah', 'From Sun 18 Oct', '1 proposed'], ['aflog', '2 Forklift operators', 'Jebel Ali DC', 'From Mon 19 Oct', 'None yet'], ['deliveroo', '3 Relievers', 'Any location', 'From Mon 19 Oct', 'None yet']];
export function VendorRequests({ client = 'all' }) {
  const toast = useToast();
  return (
    <>
      <ScreenHeader title="Headcount requests" phase={2} spec="6" />
      <section className="card">
        {REQS.filter(([c]) => client === 'all' || c === client).map(([c, n, s, d, st]) => (
          <div key={c + n + s} className="row-line"><b>{n}</b><span className="small">{client === 'all' ? `${vclient(c).name} · ` : ''}{s} · {d}</span><Pill tone={st === 'None yet' ? 'warn' : 'info'}>{st}</Pill><button className="btn sm" onClick={() => toast('Opened proposal form for this request')}>Propose</button></div>
        ))}
      </section>
    </>
  );
}

// Deliveroo's September line is the same figure the client sees under Vendor costs.
const FV = FIN_VENDORS.find((f) => f.v === ME);
const STMTS = [['deliveroo', 'September 2026', `${FV.days.toLocaleString('en')} days`, FV.buy, FV.penalty, 'Issued'], ['talabat', 'September 2026', '3,110 hours', 41985, -270, 'Issued'], ['aflog', 'September 2026', '254 days', 26380, 0, 'Paid'], ['deliveroo', 'August 2026', `${Math.round(FV.days * 1.01).toLocaleString('en')} days`, Math.round(FV.buy * 1.01 / 10) * 10, -450, 'Paid'], ['talabat', 'August 2026', '3,050 hours', 41175, 0, 'Paid'], ['aflog', 'August 2026', '249 days', 25860, -100, 'Paid']];
export function VendorStatements({ client = 'all' }) {
  const rows = STMTS.filter(([c]) => client === 'all' || c === client);
  return (
    <>
      <ScreenHeader title="Statements" phase={2} spec="9" />
      <section className="card flush"><table className="table">
        <thead><tr><th>Period</th>{client === 'all' && <th>Client</th>}<th className="num">Worked</th><th className="num">Gross</th><th className="num">No-show deductions</th><th className="num">Net payable</th><th>Status</th></tr></thead>
        <tbody>{rows.map(([c, per, worked, gross, ded, st]) => (
          <tr key={c + per}><td>{per}</td>{client === 'all' && <td><ClientCell id={c} /></td>}<td className="num mono">{worked}</td><td className="num mono">{aed(gross)}</td><td className="num mono neg">{ded ? aed(ded) : '–'}</td><td className="num mono"><b>{aed(gross + ded)}</b></td><td><Pill tone={st === 'Paid' ? 'good' : 'info'}>{st}</Pill></td></tr>
        ))}</tbody>
      </table></section>
      {client === 'all' ? <Note>Each client pays you on its own rate card and terms; pick a client to see its rates.</Note> : <Note>Your rate card with {vclient(client).name}: {vclient(client).rate}. Deductions are no-show penalties under that contract.</Note>}
    </>
  );
}

// The client picker in the vendor sidebar.
export function ClientPicker({ value, onChange }) {
  return (
    <div className="vc-pick">
      <label className="side-label" htmlFor="v-client">Client</label>
      <Select id="v-client" className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Client">
        <option value="all">All clients</option>{VCLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
    </div>
  );
}
