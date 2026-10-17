import { WORKERS, FIN_VENDORS, PROPOSALS, DAYS, SITES, ROSTER_GROUPS, siteOf, vendorOf } from './data.js';
import { todayOf } from './lib/live.js';
import { timesheetOf, missedAt } from './lib/roster.js';
import { GEO } from './lib/geo.js';
import { LiveMap } from './lib/livemap.jsx';
import { ScreenHeader, aed, Field, Note, useToast, Icon, Select, Drawer, Phase, Spec } from './ui.jsx';
import { Ring, Trend } from './lib/charts.jsx';

const { useState, useEffect } = React;
const ME = 'v4'; // GH FZE

/* ---------- Vendor portal ----------
   Built on the same rules as the client screens (see CLAUDE.md, Design): no cards, rows with status dots, plain words,
   readable sizes, drawers for anything with steps, entrance animations. The client picker sits at the top right of every
   page, like the manager picker on the Liveboard. Each screen mirrors its client counterpart: Overview is the Liveboard
   layout (it reuses the live-* classes), My workers is Workforce, Scorecard uses the Vendors rings and trends,
   Proposals works like Onboarding, Statements like Vendor costs. Vendor-only CSS: the "Vendor portal" section, .vn-*.

   ---------- the clients this vendor supplies ----------
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


const initials = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);
const short = (w) => w.replace(/^(Spinneys|Carrefour|Talabat Mart) /, '');
const isLate = (p) => p.today.text.startsWith('Late');
// The dot for a person today, and their place in a "needs you first" order.
const dotOf = (p) => (p.today.key === 'notin' ? 'crit' : isLate(p) ? 'warn' : p.today.key === 'in' ? 'good' : 'ring');
const rank = (p) => (p.today.key === 'notin' ? 0 : isLate(p) ? 1 : p.today.key === 'in' ? 2 : 3);
// What sits on the right of a person's row, short: the minutes late, the time they came in, or why they're off.
const todayChip = (p) => { const m = p.today.text.match(/(\d+) min/); if (isLate(p) && m) return `+${m[1]}m`; if (p.today.text.startsWith('In since ')) return p.today.text.replace('In since ', 'In '); return p.today.text; };
const Face = ({ p }) => <span className={'live-face ' + dotOf(p)} role="img" aria-label={`${p.name}, ${p.today.text}`}>{initials(p.name)}</span>;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// The client picker, at the top right of every vendor page.
export function ClientPicker({ value, onChange }) {
  return (
    <label className="vn-pick">
      <span>Client</span>
      <Select id="v-client" className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Client">
        <option value="all">All clients</option>{VCLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
    </label>
  );
}
const Head = ({ title, phase, spec, client, setClient, children }) => <ScreenHeader title={title} phase={phase} spec={spec} actions={<>{children}{setClient && <ClientPicker value={client} onChange={setClient} />}</>} />;

/* ---------- Overview: the Liveboard layout for your people at every client ---------- */
const OV_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
export function VendorOverview({ go, client = 'all', setClient }) {
  const [hover, setHover] = useState(null);
  const [panel, setPanel] = useState(null);
  const [only, setOnly] = useState('all');
  const ps = peopleFor(client); const t = todayCounts(ps);
  const score = client === 'all' ? Math.round(VCLIENTS.reduce((a, c) => a + c.score * peopleFor(c.id).length, 0) / peopleFor('all').length) : vclient(client).score;
  const trend = client === 'all' ? VCLIENTS[0].trend.map((_, i) => Math.round(VCLIENTS.reduce((a, c) => a + c.trend[i], 0) / VCLIENTS.length)) : vclient(client).trend;
  // Every place your people are due today, worst first.
  const locs = [...new Set(ps.filter((p) => p.today.key !== 'off').map((p) => p.where))]
    .map((w) => { const here = ps.filter((p) => p.where === w); return { key: w, client: here[0].client, ppl: here, g: geoOf(w), ...todayCounts(here) }; })
    .sort((a, b) => b.ns - a.ns || b.late - a.late || b.due - a.due || a.key.localeCompare(b.key));
  const KPIS = [
    { k: 'in', label: 'In now', dot: 'good', n: t.in, sub: `of ${t.due} due`, has: (x) => x.in },
    { k: 'noshow', label: 'No-show', dot: 'crit', n: t.ns, sub: `at ${plural(locs.filter((x) => x.ns).length, 'location')}`, has: (x) => x.ns },
    { k: 'late', label: 'Late', dot: 'warn', n: t.late, sub: `at ${plural(locs.filter((x) => x.late).length, 'location')}`, has: (x) => x.late },
  ];
  const f = KPIS.find((x) => x.k === only);
  const shown = locs.filter((x) => !f || f.has(x));
  const open = panel && locs.find((x) => x.key === panel);
  const pick = (k) => { setHover(null); setPanel(k); };
  const RANK = { returned: 0, ready: 1, client: 2, review: 3, proposed: 4 };
  const props = [...proposalsFor(client)].sort((a, b) => RANK[a.stage] - RANK[b.stage]);

  const person = (p, withSite) => (
    <div key={p.id} className="live-person">
      <Face p={p} />
      <div className="live-who">
        <b className="live-name">{p.name}</b>
        {withSite ? <button className="live-site" onClick={() => pick(p.where)}>{short(p.where)}{client === 'all' ? ` · ${vclient(p.client).name}` : ''}</button> : <span className="live-sub">{p.role}</span>}
      </div>
      {p.today.key !== 'notin' && <span className={'live-chip' + (rank(p) > 1 ? ' quiet' : '')}>{todayChip(p)}</span>}
    </div>
  );
  const group = (title, items, opts = {}) => (items.length > 0 || opts.empty) && (
    <section className="live-sec">
      <h3>{title}<span className="live-count">{items.length}</span></h3>
      {items.length ? items.map((p) => person(p, opts.site)) : <p className="live-sub">{opts.empty}</p>}
    </section>
  );

  return (
    <div className="live vn-live">
      <header className="live-head">
        <div className="live-title"><h1>Overview</h1><span className="screen-tags"><Phase p={1} /><Spec s="6" /></span></div>
        <div className="live-tools"><ClientPicker value={client} onChange={setClient || (() => {})} /></div>
      </header>

      <div className="live-kpis" role="group" aria-label="Show locations with">
        {KPIS.map((x) => (
          <button key={x.k} className={'live-kpi' + (only === x.k ? ' on' : '')} aria-pressed={only === x.k} disabled={!x.n && only !== x.k} onClick={() => { setOnly(only === x.k ? 'all' : x.k); setPanel(null); }}>
            <span className="live-kpi-label"><span className={'sdot ' + x.dot} />{x.label}</span>
            <span className="live-kpi-n"><b>{x.n}</b><span>{x.sub}</span></span>
          </button>
        ))}
        <button className="live-kpi vn-kpi-score" onClick={() => go && go('v-score')} title="Open the scorecard">
          <span className="live-kpi-label">Score<span className="vn-kpi-from">{client === 'all' ? 'average across clients' : `from ${vclient(client).name}`}</span></span>
          <span className="live-kpi-n"><b>{score}</b><Trend data={trend} w={110} h={30} months={OV_MONTHS} /></span>
        </button>
      </div>

      <div className="live-body">
        <div className="live-mapcol">
          <div className="live-map">
            <LiveMap slot="vendor" pick={panel} hover={hover} focus={panel} onPick={pick} points={shown.filter((x) => x.g).map((x) => ({ id: x.key, name: short(x.key), title: x.key, lat: x.g[1], lng: x.g[0], due: x.due, inn: x.in, bad: x.ns, late: x.late }))} />
            {f && <button className="live-filter" onClick={() => setOnly('all')}>Locations with {f.label.toLowerCase()} <Icon name="x" size={14} /></button>}
          </div>
        </div>

        <aside className="live-side" aria-label={open ? open.key : 'Needs you and locations'}>
          {!open ? (
            <div className="live-pane" key="all">
              <div className="live-scroll">
                {group('No-shows', ps.filter((p) => p.today.key === 'notin'), { site: true })}
                {group('Running late', ps.filter(isLate), { site: true })}
                <section className="live-sec">
                  <h3>Locations<span className="live-count">{shown.length}</span></h3>
                  {!shown.length && <p className="live-sub">No locations match.</p>}
                  {shown.map((x) => (
                    <button key={x.key} className={'live-loc' + (hover === x.key ? ' hl' : '')} onClick={() => pick(x.key)}
                      onMouseEnter={() => setHover(x.key)} onMouseLeave={() => setHover((k) => (k === x.key ? null : k))} onFocus={() => setHover(x.key)} onBlur={() => setHover((k) => (k === x.key ? null : k))}>
                      <span className="live-who">
                        <b className="live-name">{short(x.key)}{client === 'all' && <span className="vn-loc-c"> · {vclient(x.client).name}</span>}</b>
                        <span className="live-segs" role="img" aria-label={`${x.in} of ${x.due} in${x.ns ? `, ${x.ns} no-show` : ''}${x.late ? `, ${x.late} late` : ''}`}>
                          {x.ppl.filter((p) => p.today.key !== 'off').sort((a, b) => rank(a) - rank(b)).map((p) => <i key={p.id} className={dotOf(p)} />)}
                        </span>
                      </span>
                      <span className="live-loc-n"><b>{x.in}</b>/{x.due}</span>
                    </button>
                  ))}
                </section>
                <section className="live-sec">
                  <h3>Your proposals<span className="live-count">{props.length}</span><button className="linkbtn vn-seeall" onClick={() => go && go('v-prop')}>See all</button></h3>
                  {!props.length && <p className="live-sub">No proposals yet.</p>}
                  {props.slice(0, 5).map((p) => (
                    <div key={p.id} className="live-person vn-prop-mini">
                      <span className={'sdot ' + STAGE[p.stage][1]} />
                      <div className="live-who"><b className="live-name">{p.name}</b><span className="live-sub">{p.role}{client === 'all' ? ` · ${vclient(p.client).name}` : ''}</span></div>
                      <span className="live-chip quiet">{STAGE[p.stage][0]}</span>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          ) : (
            <div className="live-pane" key={open.key}>
              <div className="live-site-head">
                <button className="icon-btn" onClick={() => setPanel(null)} aria-label="Back to all locations"><Icon name="chevronLeft" size={18} /></button>
                <div><h2>{open.key}</h2><span className="live-sub">{vclient(open.client).name} · {open.ppl.length} of your people</span></div>
              </div>
              <div className="live-stats">
                {[['good', open.in, 'In now'], ['crit', open.ns, 'No-show'], ['warn', open.late, 'Late'], ['ring', open.due, 'Due today']].map(([d, n, l]) => (
                  <div key={l}><b>{n}</b><span><span className={'sdot ' + (n ? d : 'ring')} />{l}</span></div>
                ))}
              </div>
              <div className="live-scroll">
                {group('No-shows and late', open.ppl.filter((p) => rank(p) < 2).sort((a, b) => rank(a) - rank(b)))}
                {group('In now', open.ppl.filter((p) => rank(p) === 2), { empty: 'Nobody in yet.' })}
                {group('Not working today', open.ppl.filter((p) => rank(p) === 3))}
              </div>
              <div className="live-foot vn-foot"><button className="btn ghost" onClick={() => go && go('v-att')}><Icon name="calendar" size={16} />Attendance</button><button className="btn ghost" onClick={() => go && go('v-workers')}><Icon name="users" size={16} />My workers</button></div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ---------- My workers: one row each, faces first, like Workforce ---------- */
export function VendorWorkers({ client = 'all', setClient }) {
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('all');
  const ps = peopleFor(client);
  const CHIPS = [['all', 'Everyone', () => true], ['notin', 'Not in', (p) => p.today.key === 'notin'], ['late', 'Late', isLate], ['docs', 'Documents to renew', (p) => p.docs > 0]];
  const rows = ps.filter(CHIPS.find(([k]) => k === chip)[2]).filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => rank(a) - rank(b));
  const all = client === 'all';
  return (
    <>
      <Head title="My workers" phase={1} spec="6" client={client} setClient={setClient} />
      <div className="vn-tools">
        <div className="ma-chips">{CHIPS.map(([k, l, fn]) => <button key={k} className={'ma-chip' + (chip === k ? ' on' : '')} onClick={() => setChip(k)}>{l}<span className="nt-chip-n">{ps.filter(fn).length}</span></button>)}</div>
        <input id="vw-q" className="input vn-search" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className={'vn-list' + (all ? ' all' : '')} role="table" aria-label="My workers">
        <div className="vn-row vn-rh" role="row"><span>Worker</span>{all && <span>Client</span>}<span>Location</span><span>Today</span><span>October so far</span><span>Score</span><span>Documents</span></div>
        {rows.map((p, i) => (
          <div key={p.id} className="vn-row" role="row" style={{ '--i': Math.min(i, 14) }}>
            <span className="vn-who"><Face p={p} /><span><b>{p.name}</b><span>{p.role}</span></span></span>
            {all && <span>{vclient(p.client).name}</span>}
            <span>{p.where}</span>
            <span className="vn-today"><span className={'sdot ' + dotOf(p)} />{p.today.text}</span>
            <span className="vn-month"><b>{p.hours.toFixed(0)} h</b><span>{plural(p.days, 'day')}{p.absent ? ` · ${p.absent} absent` : ''}</span></span>
            <span className="vn-score"><b>{p.score}</b><i className="vd-bar"><i style={{ width: `${p.score}%` }} /></i></span>
            <span className="vn-today">{p.docs ? <><span className="sdot warn" />{p.docs} to renew</> : <><span className="sdot good" />All valid</>}</span>
          </div>
        ))}
        {!rows.length && <p className="vn-empty">Nobody matches.</p>}
      </div>
      <Note>Keeping documents in date is yours to do. An expired visa or Emirates ID stops that person clocking in, for every client.</Note>
    </>
  );
}

/* ---------- Attendance: the week, one word per day ---------- */
const DAYWORD = { in: 'In', late: 'Late', abs: 'Absent', leave: 'Leave', off: 'Off', none: '–', standby: 'Standby' };
export function VendorAttendance({ client = 'all', setClient }) {
  const ps = peopleFor(client);
  return (
    <>
      <Head title="Attendance" phase={1} spec="6" client={client} setClient={setClient} />
      <div className="vn-key">{['in', 'late', 'abs', 'leave', 'off', 'standby'].map((k) => <span key={k}><i className={'vn-d ' + k}>{DAYWORD[k]}</i></span>)}<span><i className="vn-d plan">07:00</i>Rostered start, still to come</span></div>
      <div className="vn-att" role="table" aria-label="This week's attendance">
        <div className="vn-arow vn-ah" role="row"><span>Worker</span>{DAYS.map((d, i) => <span key={d} className={i === 2 ? 'today' : ''}>{d}{i === 2 && <small>Today</small>}</span>)}</div>
        {ps.map((p, r) => (
          <div key={p.id} className="vn-arow" role="row" style={{ '--i': Math.min(r, 14) }}>
            <span className="vn-who"><Face p={p} /><span><b>{p.name}</b><span>{client === 'all' ? `${vclient(p.client).name} · ` : ''}{short(p.where)}</span></span></span>
            {p.week.map(([k, plan, where], i) => <span key={i} className={'vn-acell' + (i === 2 ? ' today' : '')}><i className={'vn-d ' + k}>{k === 'plan' ? plan : DAYWORD[k]}</i>{where && <small>{where}</small>}</span>)}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Scorecard: each client's score, then what makes it up ---------- */
const SC_MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
export function VendorScorecard({ client = 'all', setClient }) {
  const v = vendorOf(ME);
  if (client === 'all') return (
    <>
      <Head title="Scorecard" phase={2} spec="8" client={client} setClient={setClient} />
      <p className="vn-lead">Each client scores you on its own terms. Pick one to see what makes up its score.</p>
      <div className="vn-sc">
        {VCLIENTS.map((c, i) => (
          <button key={c.id} className="vn-sc-row" style={{ '--i': i }} onClick={() => setClient && setClient(c.id)}>
            <span className="vn-sc-name"><b>{c.name}</b><span>{peopleFor(c.id).length} of your people with them</span></span>
            <Ring value={c.score} size={72} stroke={7} />
            <Trend data={c.trend} w={260} h={54} months={OV_MONTHS} labels />
            <span className="vn-sc-go">See the breakdown<Icon name="chevronRight" size={16} /></span>
          </button>
        ))}
      </div>
    </>
  );
  const c = vclient(client); const k = c.score - 91; // other clients sit a little off Deliveroo's numbers
  // [name, shown value, bar 0-100, lower is better, what it means, last six months]
  const rows = [
    ['Fill rate', Math.min(100, v.fill + k) + '%', Math.min(100, v.fill + k), false, 'Heads supplied ÷ requested', [90, 92, 94, 93, 95, 96]],
    ['Attendance rate', (97.1 + k / 3).toFixed(1) + '%', 97.1 + k / 3, false, 'Rostered shifts attended', [95, 96, 96, 97, 96, 97]],
    ['No-show rate', (v.noshow - k / 4).toFixed(1) + '%', ((v.noshow - k / 4) / 5) * 100, true, 'Share of shifts missed', [3.1, 2.8, 2.4, 2.2, 2.0, 1.8]],
    ['Time to fill', v.ttf - k + ' h', ((v.ttf - k) / 48) * 100, true, 'Request to candidates proposed', [36, 30, 28, 26, 24, 22]],
    ['Retention at 90 days', Math.min(100, v.retention + k) + '%', Math.min(100, v.retention + k), false, 'Still active after 90 days', [80, 82, 84, 85, 87, 88]],
    ['Document compliance', Math.min(100, v.compliance + k) + '%', Math.min(100, v.compliance + k), false, 'Workers with valid documents', [92, 93, 95, 95, 96, 97]],
  ];
  return (
    <>
      <Head title="Scorecard" phase={2} spec="8" client={client} setClient={setClient} />
      <section className="vn-sc-top">
        <Ring value={c.score} size={112} stroke={10} />
        <div><span>Your score from {c.name}</span><b>{c.score} of 100</b><button className="linkbtn" onClick={() => setClient && setClient('all')}>All clients</button></div>
        <div className="vn-sc-trend"><span>Last 7 months</span><Trend data={c.trend} w={420} h={80} months={OV_MONTHS} labels /></div>
      </section>
      <div className="vn-kpis" role="table" aria-label={`What makes up your score from ${c.name}`}>
        <div className="vn-kpi vn-rh" role="row"><span>Measure</span><span>Now</span><span /><span>Last 6 months</span></div>
        {rows.map(([n, val, bar, low, d, s], i) => (
          <div key={n} className={'vn-kpi' + (low ? ' low' : '')} role="row" style={{ '--i': i }}>
            <span className="vn-kpi-n"><b>{n}</b><span>{d}{low ? ' · lower is better' : ''}</span></span>
            <b className="vn-kpi-v">{val}</b>
            <i className="vd-bar"><i style={{ width: `${Math.max(4, Math.min(100, bar))}%` }} /></i>
            <Trend data={s} w={180} h={40} months={SC_MONTHS} better={low ? 'down' : 'up'} />
          </div>
        ))}
      </div>
    </>
  );
}

// Stages a proposal goes through, with the dot each shows. Returned means the client sent it back: it needs you.
const STAGE = { proposed: ['Proposed', 'ring'], review: ['In review', 'idle'], client: ['Staff ID pending', 'idle'], ready: ['Ready', 'good'], returned: ['Returned', 'warn'] };
const STEPS = ['proposed', 'review', 'client', 'ready'];
const PROPS = [...PROPOSALS.filter((p) => p.vendor === ME).map((p) => ({ ...p, client: 'deliveroo', where: siteOf(p.site).name })),
  { id: 'dp1', client: 'deliveroo', name: 'Santosh Gurung', role: 'Picker', where: 'Carrefour Barsha Heights', stage: 'proposed' },
  { id: 'dp2', client: 'deliveroo', name: 'Aldrin Bautista', role: 'Reliever', where: 'Spinneys Marina Promenade', stage: 'review' },
  { id: 'dp3', client: 'deliveroo', name: 'Moses Adeyemi', role: 'Picker', where: 'Carrefour Marina Mall', stage: 'client' },
  { id: 'tp1', client: 'talabat', name: 'Joel Mendoza', role: 'Picker', where: 'Talabat Mart Al Nahda, Sharjah', stage: 'review' },
  { id: 'ap1', client: 'aflog', name: 'Kwame Mensah', role: 'Forklift operator', where: 'Jebel Ali DC', stage: 'proposed' }];
const proposalsFor = (client) => PROPS.filter((p) => client === 'all' || p.client === client);
const sitesOf = (cid) => (cid === 'deliveroo' ? SITES.map((s) => s.name) : vclient(cid).sites);
const rolesOf = (cid) => (cid === 'deliveroo' ? ['Picker', 'Reliever', 'Shift lead'] : [...new Set(vclient(cid).roles)]);


/* ---------- Proposals: the people you've put forward, and a drawer to propose someone ---------- */
const PROP_CHIPS = [['all', 'All'], ['returned', 'Returned'], ['proposed', 'Proposed'], ['review', 'In review'], ['client', 'Staff ID pending'], ['ready', 'Ready']];
export function VendorProposals({ client = 'all', setClient, params }) {
  const [items, setItems] = useState(proposalsFor(client));
  const [chip, setChip] = useState('all');
  const first = client === 'all' ? 'deliveroo' : client;
  const blank = (pre = {}) => { const cid = pre.client || first; return { name: '', phone: '', idno: '', client: cid, role: pre.role && rolesOf(cid).includes(pre.role) ? pre.role : rolesOf(cid)[0], where: pre.where && sitesOf(cid).includes(pre.where) ? pre.where : sitesOf(cid)[0], files: [] }; };
  const [form, setForm] = useState(null);
  const toast = useToast();
  // Opened from a headcount request: start the form for that request.
  useEffect(() => { if (params?.prefill) setForm(blank(params.prefill)); }, []);
  const setClient2 = (cid) => setForm({ ...form, client: cid, role: rolesOf(cid)[0], where: sitesOf(cid)[0] });
  const errs = form ? { name: !form.name.trim() && 'Add their full name', phone: !/^\+?[\d\s]{9,}$/.test(form.phone.trim()) && 'Add a mobile number' } : {};
  const submit = () => {
    if (errs.name || errs.phone) return setForm({ ...form, tried: true });
    setItems([{ id: 'n' + Date.now(), client: form.client, name: form.name.trim(), role: form.role, where: form.where, stage: 'proposed', fresh: true }, ...items]);
    toast(`Proposal sent to ${vclient(form.client).name} for review`);
    setForm(null); setChip('all');
  };
  const rows = items.filter((p) => chip === 'all' || p.stage === chip);
  return (
    <>
      <Head title="Proposals" phase={1} spec="6" client={client} setClient={setClient}><button className="btn" onClick={() => setForm(blank())}><Icon name="plus" size={15} />Propose a candidate</button></Head>
      <div className="vn-tools"><div className="ma-chips">{PROP_CHIPS.map(([k, l]) => { const n = items.filter((p) => k === 'all' || p.stage === k).length; return (k === 'all' || n > 0) && <button key={k} className={'ma-chip' + (chip === k ? ' on' : '')} onClick={() => setChip(k)}>{l}<span className="nt-chip-n">{n}</span></button>; })}</div></div>
      <div className="vn-props">
        {rows.map((p, i) => { const at = STEPS.indexOf(p.stage); return (
          <div key={p.id} className={'vn-prop' + (p.fresh ? ' fresh' : '')} style={{ '--i': i }}>
            <span className="vn-who"><span className={'live-face ' + STAGE[p.stage][1]}>{initials(p.name)}</span><span><b>{p.name}</b><span>{p.role} · {p.where}{client === 'all' && !p.where.startsWith(vclient(p.client).name.split(' ')[0]) ? ` · ${vclient(p.client).name}` : ''}</span></span></span>
            {p.stage === 'returned'
              ? <span className="vn-returned"><span className="sdot warn" />Returned by the client: check what they asked for</span>
              : <span className="vn-steps" role="img" aria-label={`Stage: ${STAGE[p.stage][0]}`}>{STEPS.map((s, k) => <span key={s} className={k < at ? 'done' : k === at ? 'now' : ''}><i />{STAGE[s][0]}</span>)}</span>}
          </div>
        ); })}
        {!rows.length && <p className="vn-empty">Nothing at this stage.</p>}
      </div>
      <Note>A proposal becomes a worker only after the client approves it and issues a staff ID.</Note>

      <Drawer open={!!form} onClose={() => setForm(null)} title="Propose a candidate" sub={form && `They go to ${vclient(form.client).name} for review. Nothing is shared until you send.`}>
        {form && <>
          <div className="wfa-grid">
            {client === 'all' && <Field label="For"><Select id="pr-client" className="input" value={form.client} onChange={(e) => setClient2(e.target.value)}>{VCLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
            <Field label="Full name, as on passport"><input id="pr-name" className={'input' + (form.tried && errs.name ? ' bad' : '')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />{form.tried && errs.name && <span className="wfa-err">{errs.name}</span>}</Field>
            <Field label="Mobile number"><input id="pr-phone" className={'input' + (form.tried && errs.phone ? ' bad' : '')} inputMode="tel" placeholder="+971 5…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />{form.tried && errs.phone && <span className="wfa-err">{errs.phone}</span>}</Field>
            <Field label="Emirates ID or passport no."><input id="pr-id" className="input" value={form.idno} onChange={(e) => setForm({ ...form, idno: e.target.value })} /></Field>
            <Field label="Role"><Select id="pr-role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{rolesOf(form.client).map((r) => <option key={r}>{r}</option>)}</Select></Field>
            <Field label="Preferred location"><Select id="pr-site" className="input" value={form.where} onChange={(e) => setForm({ ...form, where: e.target.value })}>{sitesOf(form.client).map((x) => <option key={x}>{x}</option>)}</Select></Field>
          </div>
          <div className="field"><span className="field-label">Documents</span>
            <div className="vn-docs">{['Passport', 'Visa', 'Emirates ID', 'Photo'].map((d) => { const has = form.files.includes(d); return (
              <label key={d} className={'vn-doc' + (has ? ' has' : '')}><input type="file" id={'up-' + d} onChange={(e) => e.target.files.length && setForm({ ...form, files: [...new Set([...form.files, d])] })} /><Icon name={has ? 'check' : 'upload'} size={18} /><span>{d}</span><small>{has ? 'Added' : 'Add a file'}</small></label>
            ); })}</div>
          </div>
          <div className="drawer-actions"><button className="btn ghost" onClick={() => setForm(null)}>Cancel</button><span className="grow" /><button className="btn" onClick={submit}>Send to {vclient(form.client).name}</button></div>
        </>}
      </Drawer>
    </>
  );
}

const REQS = [['deliveroo', '5 Pickers', 'Carrefour Barsha Heights', 'From Mon 12 Oct', '2 proposed'], ['deliveroo', '1 Shift lead', 'Spinneys Majan', 'From Thu 15 Oct', 'None yet'], ['talabat', '4 Pickers', 'Talabat Mart Al Nahda, Sharjah', 'From Sun 18 Oct', '1 proposed'], ['aflog', '2 Forklift operators', 'Jebel Ali DC', 'From Mon 19 Oct', 'None yet'], ['deliveroo', '3 Relievers', 'Any location', 'From Mon 19 Oct', 'None yet']];
// '5 Pickers' → { n: 5, role: 'Picker' }
const parseReq = (s) => { const [n, ...w] = s.split(' '); const role = w.join(' '); return { n: +n, role: +n > 1 ? role.replace(/s$/, '') : role }; };
export function VendorRequests({ go, client = 'all', setClient }) {
  const rows = REQS.filter(([c]) => client === 'all' || c === client);
  return (
    <>
      <Head title="Headcount requests" phase={2} spec="6" client={client} setClient={setClient} />
      <p className="vn-lead">What your clients have asked you for. Propose someone and they go to the client for review.</p>
      <div className="vn-reqs">
        {rows.map(([c, need, where, from, st], i) => { const r = parseReq(need); const none = st === 'None yet'; return (
          <div key={c + need + where} className="vn-req" style={{ '--i': i }}>
            <span className="vn-req-n"><b>{r.n}</b><span>{r.n > 1 ? need.split(' ').slice(1).join(' ') : r.role}</span></span>
            <span className="vn-req-w"><b>{where}</b><span>{vclient(c).name}</span></span>
            <span className="vn-req-d"><b>{from.replace('From ', '')}</b><span>Starts</span></span>
            <span className="vn-today"><span className={'sdot ' + (none ? 'warn' : 'good')} />{st}</span>
            <button className="btn" onClick={() => go && go('v-prop', { prefill: { client: c, role: r.role, where } })}>Propose</button>
          </div>
        ); })}
        {!rows.length && <p className="vn-empty">No open requests from {nameOf(client)}.</p>}
      </div>
    </>
  );
}

// Deliveroo's September line is the same figure the client sees under Vendor costs.
const FV = FIN_VENDORS.find((f) => f.v === ME);
const STMTS = [['deliveroo', 'September 2026', `${FV.days.toLocaleString('en')} days`, FV.buy, FV.penalty, 'Issued'], ['talabat', 'September 2026', '3,110 hours', 41985, -270, 'Issued'], ['aflog', 'September 2026', '254 days', 26380, 0, 'Paid'], ['deliveroo', 'August 2026', `${Math.round(FV.days * 1.01).toLocaleString('en')} days`, Math.round(FV.buy * 1.01 / 10) * 10, -450, 'Paid'], ['talabat', 'August 2026', '3,050 hours', 41175, 0, 'Paid'], ['aflog', 'August 2026', '249 days', 25860, -100, 'Paid']];
export function VendorStatements({ client = 'all', setClient }) {
  const rows = STMTS.filter(([c]) => client === 'all' || c === client);
  const periods = [...new Set(rows.map((r) => r[1]))];
  const latest = rows.filter((r) => r[1] === periods[0]);
  const gross = latest.reduce((a, r) => a + r[3], 0), ded = latest.reduce((a, r) => a + r[4], 0);
  return (
    <>
      <Head title="Statements" phase={2} spec="9" client={client} setClient={setClient} />
      <section className="vc-sum vn-stsum" aria-label={`${periods[0]} totals`}>
        <div className="vc-net"><span>Net payable to you · {periods[0]}, ex-VAT{client === 'all' ? ` · ${plural(latest.length, 'client')}` : ''}</span><b>{aed(gross + ded)}</b></div>
        <div className="vc-bridge" aria-hidden="true"><i className="vc-b-net" style={{ flexGrow: gross + ded }} />{ded ? <i className="vc-b-ded" style={{ flexGrow: -ded }} /> : null}</div>
        <dl className="vc-eq">
          <div><dt>Gross</dt><dd>{aed(gross)}</dd></div>
          <span className="vc-op" aria-hidden="true">−</span>
          <div><dt><span className="sdot crit" />No-show deductions</dt><dd>{aed(-ded)}<small>Under each client's contract</small></dd></div>
          <span className="vc-op" aria-hidden="true">=</span>
          <div><dt><span className="sdot good" />Net payable</dt><dd>{aed(gross + ded)}</dd></div>
        </dl>
      </section>
      {periods.map((per) => (
        <section key={per} className="vn-period">
          <h3 className="vc-h">{per}</h3>
          <div className={'vn-st vn-rh' + (client === 'all' ? ' all' : '')} aria-hidden="true">{client === 'all' && <span>Client</span>}<span>Worked</span><span>Gross</span><span>Deductions</span><span>Net payable</span><span>Status</span></div>
          {rows.filter((r) => r[1] === per).map(([c, , worked, g, d, st], i) => (
            <div key={c + per} className={'vn-st' + (client === 'all' ? ' all' : '')} style={{ '--i': i }}>
              {client === 'all' && <b>{vclient(c).name}</b>}
              <span>{worked}</span>
              <span className="vn-num">{aed(g)}</span>
              <span className="vn-num">{d ? `− ${aed(-d)}` : 'None'}</span>
              <b className="vn-num">{aed(g + d)}</b>
              <span className="vn-today"><span className={'sdot ' + (st === 'Paid' ? 'good' : 'ring')} />{st}</span>
            </div>
          ))}
        </section>
      ))}
      {client === 'all' ? <Note>Each client pays you on its own rate card and terms; pick a client to see its rates.</Note> : <Note>Your rate card with {vclient(client).name}: {vclient(client).rate}. Deductions are no-show penalties under that contract.</Note>}
    </>
  );
}
