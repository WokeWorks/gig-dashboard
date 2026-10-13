import { WORKERS, FIN_VENDORS, PROPOSALS, DAYS, SITES, ROSTER_GROUPS, siteOf, vendorOf } from './data.js';
import { todayOf } from './lib/live.js';
import { timesheetOf, missedAt } from './lib/roster.js';
import { GEO } from './lib/geo.js';
import { LiveMap } from './lib/livemap.jsx';
import { ScreenHeader, Pill, Spark, aed, Field, Note, useToast, Icon, Select } from './ui.jsx';

const { useState, useEffect, useRef } = React;
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

const ClientCell = ({ id }) => <span className="vc-tag">{vclient(id).name}</span>;

// Score trend: the latest score up top with the change since the first month, then a line across the months with
// a hover read-out per month. Sized to its card (measured), so text and strokes stay at their real size.
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
function ScoreTrend({ data, sub }) {
  const box = useRef(null); const [w, setW] = useState(480); const [hov, setHov] = useState(null);
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth || 480)); ro.observe(el); return () => ro.disconnect(); }, []);
  const H = 190, L = 30, R = 14, T = 18, B = 26;
  const lo = Math.floor((Math.min(...data) - 2) / 5) * 5, hi = Math.ceil((Math.max(...data) + 2) / 5) * 5;
  const x = (i) => L + (i / (data.length - 1)) * (w - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const area = `${line}L${x(data.length - 1).toFixed(1)} ${H - B}L${x(0).toFixed(1)} ${H - B}Z`;
  const ticks = []; for (let v = lo; v <= hi; v += 5) ticks.push(v);
  const last = data[data.length - 1], diff = last - data[0];
  const at = hov ?? data.length - 1;
  return (
    <div className="st">
      <div className="st-head">
        <div><h3>Score trend</h3><div className="small muted">{sub}</div></div>
        <div className="st-now"><b>{last}</b><span className={'small ' + (diff > 0 ? 'pos' : diff < 0 ? 'neg' : 'muted')}>{diff > 0 ? '+' : ''}{diff} since April</span></div>
      </div>
      <div ref={box} className="st-plot">
        <svg width={w} height={H} role="img" aria-label={`Score by month, April to October: ${data.map((v, i) => `${MONTHS[i]} ${v}`).join(', ')}`} onMouseLeave={() => setHov(null)}>
          {ticks.map((t) => <g key={t}><line x1={L} x2={w - R} y1={y(t)} y2={y(t)} className="st-grid" /><text x={L - 8} y={y(t) + 4} className="st-ax" textAnchor="end">{t}</text></g>)}
          {MONTHS.slice(0, data.length).map((m, i) => <text key={m} x={x(i)} y={H - 6} className={'st-ax' + (i === at ? ' on' : '')} textAnchor="middle">{m}</text>)}
          <path d={area} className="st-area" />
          <path d={line} className="st-line" />
          {hov != null && <line x1={x(hov)} x2={x(hov)} y1={T} y2={H - B} className="st-cross" />}
          <circle cx={x(at)} cy={y(data[at])} r="5" className="st-dot" />
          <text x={x(at)} y={y(data[at]) - 11} className="st-val" textAnchor={at === 0 ? 'start' : at === data.length - 1 ? 'end' : 'middle'}>{data[at]}</text>
          {data.map((_, i) => <rect key={i} x={x(i) - (w - L - R) / (data.length - 1) / 2} y={T} width={(w - L - R) / (data.length - 1)} height={H - T} fill="transparent" onMouseEnter={() => setHov(i)} />)}
        </svg>
      </div>
    </div>
  );
}

export function VendorOverview({ go, client = 'all' }) {
  const [pick, setPick] = useState(null); // hovered in the list
  const [panel, setPanel] = useState(null); // location open in the side column
  const [only, setOnly] = useState('all'); // 'all' | 'noshow'
  const ps = peopleFor(client); const t = todayCounts(ps);
  const score = client === 'all' ? Math.round(VCLIENTS.reduce((a, c) => a + c.score * peopleFor(c.id).length, 0) / peopleFor('all').length) : vclient(client).score;
  // Every place your people are due today, worst first.
  const locs = [...new Set(ps.filter((p) => p.today.key !== 'off').map((p) => p.where))]
    .map((w) => { const here = ps.filter((p) => p.where === w); return { key: w, title: w, client: here[0].client, ppl: here, g: geoOf(w), ...todayCounts(here) }; })
    .sort((a, b) => b.ns - a.ns || b.due - a.due || a.title.localeCompare(b.title));
  const shown = locs.filter((x) => only === 'all' || x.ns);
  const pd = panel && locs.find((x) => x.key === panel);
  const short = (w) => w.replace(/^(Spinneys|Carrefour|Talabat Mart) /, '');
  return (
    <>
      <ScreenHeader title="Overview" phase={1} spec="6" />
      <section className="card flush lm-wrap lm-split vo-map">
        <div className="lm-mapcol">
          <LiveMap slot="vendor" pick={panel} hover={pick} focus={panel} onPick={(id) => setPanel(id)} points={shown.filter((x) => x.g).map((x) => ({ id: x.key, name: short(x.key), title: x.key, lat: x.g[1], lng: x.g[0], due: x.due, inn: x.in, bad: x.ns, late: x.late }))} />
        </div>
        <aside className="lm-side" aria-label={pd ? pd.title : 'Locations'}>
          {!pd ? <>
            <div className="lm-side-stats">
              <div className={t.in ? 'good' : ''}><b>{t.in}</b><span>in now</span></div>
              <button className={'lm-stat-btn' + (t.ns ? ' crit' : '') + (only === 'noshow' ? ' on' : '')} aria-pressed={only === 'noshow'} disabled={!t.ns && only !== 'noshow'} onClick={() => { setOnly(only === 'noshow' ? 'all' : 'noshow'); setPick(null); }}><b>{t.ns}</b><span>no-show</span></button>
              <div className={t.late ? 'warn' : ''}><b>{t.late}</b><span>late</span></div>
              <div className="good"><b>{score}</b><span>score</span></div>
            </div>
            <div className="lm-side-body lm-locs">
              {only === 'noshow' && <div className="lm-filtered small muted">Locations with a no-show <button className="linkbtn" onClick={() => setOnly('all')}>Show all</button></div>}
              {shown.length === 0 && <div className="small muted lm-none">No locations match.</div>}
              {shown.map((x) => (
                <button key={x.key} className={'lm-loc' + (pick === x.key ? ' on' : '')} onClick={() => { setPick(null); setPanel(x.key); }} onMouseEnter={() => setPick(x.key)} onMouseLeave={() => setPick((k) => (k === x.key ? null : k))} onFocus={() => setPick(x.key)} onBlur={() => setPick((k) => (k === x.key ? null : k))}>
                  <span className={'lm-k ' + (x.ns ? 'crit' : x.due ? 'good' : 'idle')} />
                  <span className="lm-name"><b>{x.title}</b><span className="small muted">{x.ns ? <span className="neg">{x.ns} no-show</span> : null}{x.ns && x.late ? ' · ' : null}{x.late ? `${x.late} late` : null}{!x.ns && !x.late ? 'All in' : null}{client === 'all' ? ` · ${vclient(x.client).name}` : ''}</span></span>
                  <span className="lm-cnt mono">{x.in}<span className="muted">/{x.due}</span></span>
                  <Icon name="chevronRight" size={15} />
                </button>
              ))}
            </div>
          </> : (() => {
            const order = (p) => (p.today.key === 'notin' ? 0 : p.today.text.startsWith('Late') ? 1 : p.today.key === 'in' ? 2 : 3);
            const need = pd.ppl.filter((p) => order(p) < 2), inn = pd.ppl.filter((p) => order(p) === 2), rest = pd.ppl.filter((p) => order(p) === 3);
            const row = (p) => <div key={p.id} className={'lm-pp' + (p.today.key === 'notin' ? ' noshow' : p.today.text.startsWith('Late') ? ' late' : p.today.key === 'in' ? ' in' : '')}><span className="lb-dot" /><span className="lm-pp-who"><b>{p.name}</b><span className="small muted">{p.role} · {p.today.text}</span></span></div>;
            return <>
              <div className="lm-panel-head">
                <button className="lm-panel-x" aria-label="Back to all locations" onClick={() => setPanel(null)}><Icon name="chevronLeft" size={17} /></button>
                <div className="lm-panel-title"><b>{pd.title}</b><span className="small muted">{vclient(pd.client).name} · {pd.ppl.length} of your people</span></div>
              </div>
              <div className="lm-side-stats">
                <div className={pd.in ? 'good' : ''}><b>{pd.in}</b><span>in now</span></div>
                <div className={pd.ns ? 'crit' : ''}><b>{pd.ns}</b><span>no-show</span></div>
                <div className={pd.late ? 'warn' : ''}><b>{pd.late}</b><span>late</span></div>
                <div><b>{pd.due}</b><span>due today</span></div>
              </div>
              <div className="lm-side-body">
                {need.length > 0 && <div className="lm-panel-sec"><h4>No-shows and late</h4>{need.map(row)}</div>}
                <div className="lm-panel-sec"><h4>In now</h4>{inn.length ? inn.map(row) : <div className="small muted">Nobody in yet.</div>}</div>
                {rest.length > 0 && <div className="lm-panel-sec"><h4>Not working today</h4>{rest.map(row)}</div>}
              </div>
              <div className="lm-panel-foot">
                <button className="btn ghost sm" onClick={() => go && go('v-att')}>Attendance</button>
                <button className="btn ghost sm" onClick={() => go && go('v-workers')}>My workers</button>
              </div>
            </>;
          })()}
        </aside>
      </section>
      <div className="grid-2">
        <section className="card">
          {(() => {
            // At most five, the ones that need you first (returned, then ready to start), newest stage last.
            const RANK = { returned: 0, ready: 1, client: 2, review: 3, proposed: 4 };
            const all = [...proposalsFor(client)].sort((a, b) => RANK[a.stage] - RANK[b.stage]);
            const more = all.length - 5;
            return <>
              <div className="card-head"><h3>Your proposals <span className="muted small">{all.length}</span></h3><button className="btn sm ghost" onClick={() => go && go('v-prop')}>See all</button></div>
              {all.length === 0 && <div className="small muted">No proposals with {client === 'all' ? 'any client' : vclient(client).name} yet.</div>}
              {all.slice(0, 5).map((p) => <div key={p.id} className="row-line"><Pill tone={STAGE[p.stage][1]}>{STAGE[p.stage][0]}</Pill><span className="small">{p.name}{client === 'all' ? ` · ${vclient(p.client).name}` : ''}</span></div>)}
              {more > 0 && <button className="linkbtn small vo-more" onClick={() => go && go('v-prop')}>{more} more {more === 1 ? 'proposal' : 'proposals'}</button>}
            </>;
          })()}
        </section>
        <section className="card">
          <ScoreTrend data={client === 'all' ? VCLIENTS[0].trend.map((_, i) => Math.round(VCLIENTS.reduce((a, c) => a + c.trend[i], 0) / VCLIENTS.length)) : vclient(client).trend} sub={client === 'all' ? 'Average across your clients' : `From ${vclient(client).name}`} />
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
