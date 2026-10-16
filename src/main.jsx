import { ToastHost, Icon, Logo, useMenu, useToast } from './ui.jsx';
import * as Op from './screens/ops/index.js';
import * as Vd from './vendor.jsx';
import { Forms } from './forms.jsx';
import { PhoneApp } from './phone.jsx';
import { SCOPE, ADMIN_ONLY } from './lib/scope.js';
import { applyTheme } from './lib/theme.js';
import { AlertsHost } from './lib/alerts.jsx';
applyTheme();

const { useState, useEffect } = React;

const OPERATOR = [
  ['Operations', [['live', 'Liveboard', 1, Op.LiveBoard], ['schedule', 'Roster', 1, Op.Scheduling], ['leave', 'Leave', 1, Op.Leave]]],
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
  { id: 'operator', label: 'Client', icon: 'building', nav: OPERATOR, first: 'live' },
  { id: 'vendor', label: 'Vendor', icon: 'users', nav: VENDOR, first: 'v-overview' },
  { id: 'phone', label: 'Phone', icon: 'phone' },
];

const load = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

// Who is signed in, per surface: their name over the organisation they work for.
const ACCOUNTS = { admin: { name: 'Nadia Karim', role: 'Head of operations · admin', org: 'Deliveroo UAE' }, manager: { name: 'Omar Haddad', role: 'Operations manager · 3 locations', org: 'Deliveroo UAE' }, vendor: { name: 'Ravi Menon', role: 'Account manager', org: 'GH FZE' } };
function Account({ who, viewAs, setViewAs }) {
  const menu = useMenu(); const toast = useToast();
  const initials = who.name.split(' ').map((x) => x[0]).join('').slice(0, 2);
  return <>
    <button className={'rail-item acct' + (menu.isOpen(who.name) ? ' open' : '')} aria-haspopup="menu" title={who.name} onClick={(e) => menu.open(e, who.name, [
      // Temporary, until real sign-in: see the client dashboard as an admin or as one manager.
      setViewAs && { icon: viewAs === 'admin' ? 'check' : 'person', label: 'View as admin', sub: 'Every location and every screen', on: () => setViewAs('admin') },
      setViewAs && { icon: viewAs === 'manager' ? 'check' : 'person', label: 'View as manager', sub: 'Only Omar Haddad\'s 3 locations', on: () => setViewAs('manager') },
      { icon: 'logout', label: 'Log out', danger: !!setViewAs, on: () => toast('Logged out (prototype: nothing happens)') },
    ], who.role)}>
      <span className="acct-av" aria-hidden="true">{initials}</span>
      <span className="rail-label acct-txt"><b>{who.name}</b><span>{who.org}</span></span>
    </button>
    {menu.el}
  </>;
}

function App() {
  const [persona, setPersona] = useState(() => { const v = load('ops.persona', 'operator'); return ['kiosk', 'worker', 'supervisor'].includes(v) ? (v === 'kiosk' ? 'operator' : 'phone') : v; });
  const [screen, setScreen] = useState(() => load('ops.screen', 'live'));
  useEffect(() => { save('ops.persona', persona); save('ops.screen', screen); }, [persona, screen]);

  const [viewAs, setViewAs] = useState(() => load('ops.viewas', 'admin')); // client dashboard: admin or manager (temporary)
  SCOPE.role = viewAs;
  const P0 = PERSONAS.find((p) => p.id === persona) || PERSONAS[0];
  const P = P0.id === 'operator' && viewAs === 'manager' ? { ...P0, nav: P0.nav.map(([g, xs]) => [g, xs.filter((x) => !ADMIN_ONLY.includes(x[0]))]).filter(([, xs]) => xs.length) } : P0;
  const items = P.nav ? P.nav.flatMap(([, xs]) => xs) : [];
  const cur = items.find((i) => i[0] === screen) || items[0];
  const [params, setParams] = useState(null);
  const [vClient, setVClient] = useState(() => load('ops.vclient', 'all')); // vendor portal: which client
  useEffect(() => { save('ops.viewas', viewAs); }, [viewAs]);
  useEffect(() => { save('ops.vclient', vClient); }, [vClient]);
  const toast = useToast();
  const go = (id, prm = null) => { setParams(prm); setScreen(id); };
  const changeView = (v) => { setViewAs(v); setParams(null); if (v === 'manager' && ADMIN_ONLY.includes(screen)) setScreen('live'); toast(v === 'admin' ? 'Viewing as an admin: everything' : 'Viewing as Omar Haddad: his 3 locations'); };
  const pick = (p) => { setPersona(p.id); if (p.first) setScreen(p.first); };

  // Which side of the product is on show: at the foot of the rail, on every surface.
  const switcher = (
    <div className="rail-group persona-sw" role="group" aria-label="Show the product as">
      {PERSONAS.map((p) => <button key={p.id} className={'rail-item' + (persona === p.id ? ' on' : '')} onClick={() => pick(p)} title={p.label} aria-pressed={persona === p.id}><Icon name={p.icon} size={19} /><span className="rail-label">{p.label} view</span></button>)}
    </div>
  );
  // One icon rail for every surface: it opens to show labels on hover or keyboard focus. Pages run edge to edge beside it.
  return (
    <AlertsHost on={persona === 'operator'}>
    <div className="app">
      <nav className="rail" aria-label="Main">
        <div className="rail-logo"><Logo size={26} /><b className="rail-label">OpsPro</b></div>
        {P.nav && P.nav.map(([group, xs]) => (
          <div key={group} className="rail-group" role="group" aria-label={group}>
            {xs.map(([id, label]) => (
              <button key={id} className={'rail-item' + (cur[0] === id ? ' on' : '')} onClick={() => go(id)} title={label} aria-current={cur[0] === id ? 'page' : undefined}>
                <Icon name={NAV_ICONS[id] || 'document'} size={19} /><span className="rail-label">{label}</span>
              </button>
            ))}
          </div>
        ))}
        <div className="rail-foot">
          {switcher}
          {P.nav && (persona === 'vendor' ? <Account who={ACCOUNTS.vendor} /> : <Account who={ACCOUNTS[viewAs]} viewAs={viewAs} setViewAs={changeView} />)}
        </div>
      </nav>
      {P.nav ? (
        <main className={'main' + (persona === 'vendor' ? ' vendor' : '')} key={cur[0] + JSON.stringify(params) + (persona === 'vendor' ? vClient : viewAs)}>
          {persona === 'vendor' && <Vd.ClientPicker value={vClient} onChange={setVClient} />}
          {React.createElement(cur[3], { go, params, client: vClient })}
        </main>
      ) : (
        <div className="body"><PhoneApp /></div>
      )}
    </div>
    </AlertsHost>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ToastHost><App /></ToastHost>);
