import { ToastHost, Icon, Logo, useMenu, useToast } from './ui.jsx';
import * as Op from './screens/ops/index.js';
import * as Vd from './vendor.jsx';
import { Forms } from './forms.jsx';
import { PhoneApp } from './phone.jsx';

const { useState, useEffect } = React;

const OPERATOR = [
  ['Operations', [['live', 'Liveboard', 1, Op.LiveBoard], ['alerts', 'Notifications', 1, Op.Alerts], ['schedule', 'Roster', 1, Op.Scheduling], ['leave', 'Leave', 1, Op.Leave]]],
  ['People', [['workforce', 'Workforce', 1, Op.Workforce], ['onboarding', 'Onboarding', 1, Op.Onboarding], ['vendors', 'Vendors', 1, Op.Vendors], ['clients', 'Locations', 1, Op.ClientsSites]]],
  ['Insight', [['performance', 'Performance', 2, Op.Performance], ['finance', 'Vendor costs', 2, Op.Finance], ['forms', 'Forms', 2, Forms], ['comms', 'Announcements', 2, Op.Communication]]],
  ['Admin', [['settings', 'Settings', 1, Op.Settings]]],
];
const VENDOR = [
  ['Vendor', [['v-overview', 'Overview', 1, Vd.VendorOverview], ['v-workers', 'My workers', 1, Vd.VendorWorkers], ['v-att', 'Attendance', 1, Vd.VendorAttendance], ['v-score', 'Scorecard', 2, Vd.VendorScorecard], ['v-prop', 'Proposals', 1, Vd.VendorProposals], ['v-req', 'Requests', 2, Vd.VendorRequests], ['v-stmt', 'Statements', 2, Vd.VendorStatements]]],
];
const NAV_ICONS = { live: 'activity', alerts: 'bell', schedule: 'calendar', timesheets: 'clock', leave: 'umbrella', workforce: 'users', onboarding: 'userPlus', vendors: 'building', clients: 'pin', performance: 'chart', finance: 'wallet', comms: 'megaphone', forms: 'checkCircle', settings: 'gear',
  'v-overview': 'home', 'v-workers': 'users', 'v-att': 'calendar', 'v-score': 'star', 'v-prop': 'userPlus', 'v-req': 'flag', 'v-stmt': 'document' };
const PERSONAS = [
  { id: 'operator', label: 'Ops dashboard', nav: OPERATOR, first: 'live' },
  { id: 'vendor', label: 'Vendor portal', nav: VENDOR, first: 'v-overview' },
  { id: 'phone', label: 'Phone app' },
];

const load = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

// Who is signed in, per surface: their name over the organisation they work for.
const ACCOUNTS = { operator: { name: 'Omar Haddad', org: 'Deliveroo UAE' }, vendor: { name: 'Ravi Menon', org: 'GH FZE' } };
function Account({ who }) {
  const menu = useMenu(); const toast = useToast();
  const initials = who.name.split(' ').map((x) => x[0]).join('').slice(0, 2);
  return <>
    <button className={'acct' + (menu.isOpen(who.name) ? ' open' : '')} aria-haspopup="menu" onClick={(e) => menu.open(e, who.name, [
      { icon: 'logout', label: 'Log out', on: () => toast('Logged out (prototype: nothing happens)') },
    ])}>
      <span className="acct-av" aria-hidden="true">{initials}</span>
      <span className="acct-txt"><b>{who.name}</b><span>{who.org}</span></span>
      <Icon name="down" size={14} />
    </button>
    {menu.el}
  </>;
}

function App() {
  const [persona, setPersona] = useState(() => { const v = load('ops.persona', 'operator'); return ['kiosk', 'worker', 'supervisor'].includes(v) ? (v === 'kiosk' ? 'operator' : 'phone') : v; });
  const [screen, setScreen] = useState(() => load('ops.screen', 'live'));
  useEffect(() => { save('ops.persona', persona); save('ops.screen', screen); }, [persona, screen]);
  // Keep --tb in step with the top bar's height so the sidebar and sticky headers sit right under it.
  useEffect(() => { const tb = document.querySelector('.topbar'); if (!tb) return; const set = () => document.documentElement.style.setProperty('--tb', tb.getBoundingClientRect().height + 'px'); set(); const ro = new ResizeObserver(set); ro.observe(tb); return () => ro.disconnect(); }, []);

  const P = PERSONAS.find((p) => p.id === persona) || PERSONAS[0];
  const items = P.nav ? P.nav.flatMap(([, xs]) => xs) : [];
  const cur = items.find((i) => i[0] === screen) || items[0];
  const [params, setParams] = useState(null);
  const [slim, setSlim] = useState(() => load('ops.slim', '0') === '1');
  const [vClient, setVClient] = useState(() => load('ops.vclient', 'all')); // vendor portal: which client
  useEffect(() => { save('ops.vclient', vClient); }, [vClient]);
  useEffect(() => { save('ops.slim', slim ? '1' : '0'); }, [slim]);
  const go = (id, prm = null) => { setParams(prm); setScreen(id); };
  const pick = (p) => { setPersona(p.id); if (p.first) setScreen(p.first); };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><Logo size={30} tight /><b>OpsPro</b></div>
        <nav className="personas" aria-label="Who is using OpsPro">
          {PERSONAS.map((p) => <button key={p.id} className={persona === p.id ? 'on' : ''} onClick={() => pick(p)}>{p.label}</button>)}
        </nav>
        {P.nav && <Account who={persona === 'vendor' ? ACCOUNTS.vendor : ACCOUNTS.operator} />}
      </header>
      {P.nav ? (
        <div className={'body' + (persona === 'vendor' ? ' vendor' : '') + (slim ? ' slim' : '')}>
          <button className="side-edge" onClick={() => setSlim(!slim)} aria-label={slim ? 'Expand navigation' : 'Collapse navigation'} title={slim ? 'Expand' : 'Collapse'} />
          <aside className="side">
            {persona === 'vendor' && <Vd.ClientPicker value={vClient} onChange={setVClient} />}
            {P.nav.map(([group, xs]) => (
              <div key={group} className="side-group">
                <div className="side-label">{group}</div>
                {xs.map(([id, label, ph]) => (
                  <button key={id} className={'side-item' + (cur[0] === id ? ' on' : '')} onClick={() => go(id)} title={slim ? label : undefined} aria-label={label}>
                    <span className="side-ic"><Icon name={NAV_ICONS[id] || 'document'} size={18} /></span><span className="side-text">{label}</span>
                  </button>
                ))}
              </div>
            ))}
          </aside>
          <main className="main" key={cur[0] + JSON.stringify(params) + (persona === 'vendor' ? vClient : '')}>{React.createElement(cur[3], { go, params, client: vClient })}</main>
        </div>
      ) : (
        <div className="body"><PhoneApp /></div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ToastHost><App /></ToastHost>);
