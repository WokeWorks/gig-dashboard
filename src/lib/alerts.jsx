import { WORKERS, ALERTS, vendorOf, siteOf } from '../data.js';
import { Drawer, Icon, useToast } from '../ui.jsx';
import { siteInScope } from './scope.js';

const { useState, createContext, useContext } = React;

// Notifications live behind a bell at the top right of every client page, not on a page of their own. The list is
// held here, above the pages, so what you resolve stays resolved as you move around.
const Ctx = createContext(null);
const TYPES = ['All', 'No-show', 'Late', 'Face mismatch', 'Outside geofence', 'Missing clock-out', 'Document expiry'];
const label = (t) => ({ All: 'All', 'Outside geofence': 'Off-site punch', 'Missing clock-out': 'No clock-out', 'Document expiry': 'Document issue' }[t] || t);
const DOT = { critical: 'crit', warning: 'warn', info: 'idle' };

export function AlertsHost({ on, children }) {
  const [items, setItems] = useState(() => ALERTS.map((a) => ({ ...a })));
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('All');
  const [sel, setSel] = useState(null);
  const toast = useToast();
  const mine = items.filter((a) => siteInScope(a.site)); // scope can change with "View as"
  const live = mine.filter((a) => a.open);
  const rows = mine.filter((a) => type === 'All' || a.type === type).sort((a, b) => b.open - a.open);
  const resolve = (a, outcome) => { setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, open: false, outcome } : x))); setSel(null); toast(`${label(a.type)} marked ${outcome.toLowerCase()}`); };
  return (
    <Ctx.Provider value={on ? { count: live.length, urgent: live.some((a) => a.sev === 'critical'), show: () => setOpen(true) } : null}>
      {children}
      <Drawer open={on && open} onClose={() => { setOpen(false); setSel(null); }} title="Notifications" sub={live.length ? `${live.length} open` : 'All caught up'}>
        <div className="nt-chips" role="tablist" aria-label="Filter by type">
          {TYPES.map((t) => { const n = (t === 'All' ? live : live.filter((a) => a.type === t)).length; return (t === 'All' || n > 0) && (
            <button key={t} role="tab" aria-selected={type === t} className={'ma-chip' + (type === t ? ' on' : '')} onClick={() => { setType(t); setSel(null); }}>{label(t)}<span className="nt-chip-n">{n}</span></button>
          ); })}
        </div>
        <ul className="nt-list" key={type}>{/* keyed by filter, so the list plays in again when it changes */}
          {rows.map((a, i) => {
            const w = WORKERS.find((x) => x.id === a.worker), on = sel === a.id;
            return (
              <li key={a.id} className={'nt-item' + (a.open ? '' : ' done') + (on ? ' on' : '')} style={{ '--i': i }}>
                <button className="nt-head" aria-expanded={on} onClick={() => setSel(on ? null : a.id)}>
                  <span className={'sdot ' + (a.open ? DOT[a.sev] : 'ring')} />
                  <span className="nt-what"><b>{label(a.type)}</b><span>{w.name} · {siteOf(a.site).name.replace(/^(Spinneys|Carrefour) /, '')}</span></span>
                  <span className="nt-when">{a.open ? a.time : a.outcome}</span>
                </button>
                {on && <div className="nt-body">
                  <p>{a.detail}</p>
                  {a.type === 'Face mismatch' && <div className="faces"><div className="face">Enrolled photo</div><div className="face alt">Punch selfie {a.time}</div></div>}
                  {a.open && <div className="nt-act">
                    <button className="btn sm" onClick={() => resolve(a, 'Confirmed')}>Confirm</button>
                    <button className="btn sm ghost" onClick={() => resolve(a, 'False alarm')}>False alarm</button>
                    <button className="btn sm ghost" onClick={() => resolve(a, 'Excused')}>Excused</button>
                  </div>}
                  <span className="nt-route">{vendorOf(w.vendor).name} · sent to the site supervisor by push and to ops on WhatsApp</span>
                </div>}
              </li>
            );
          })}
        </ul>
      </Drawer>
    </Ctx.Provider>
  );
}

// The bell: page headers put it at their top right. Nothing shows outside the client dashboard.
export function Bell() {
  const c = useContext(Ctx);
  if (!c) return null;
  return (
    <button className="bell icon-btn" onClick={c.show} aria-label={`Notifications, ${c.count} open`} title="Notifications">
      <Icon name="bell" size={18} />{c.count > 0 && <span key={c.count} className={'bell-n' + (c.urgent ? ' urgent' : '')}>{c.count}</span>}
    </button>
  );
}
