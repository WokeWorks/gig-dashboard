import { WORKERS, ALERTS, ANNOUNCEMENTS, SITES, vendorOf, siteOf } from '../data.js';
import { Drawer, Icon, useToast, Field, Select, Toggle } from '../ui.jsx';
import { siteInScope } from './scope.js';

const { useState, createContext, useContext } = React;

// Notifications live behind a bell at the top right of every client page, not on a page of their own. The list is
// held here, above the pages, so what you resolve stays resolved as you move around.
// Announcements sit beside it behind a megaphone: the bell is what comes in, the megaphone is what goes out to workers.
// Both open as a panel from the bottom right corner (Drawer corner). The announcement list scrolls and filters, so it
// copes with years of them; writing one opens in place at the top of the panel.
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
  const [anns, setAnns] = useState(() => ANNOUNCEMENTS.map((a) => ({ ...a })));
  const [annOpen, setAnnOpen] = useState(false);
  const resolve = (a, outcome) => { setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, open: false, outcome } : x))); setSel(null); toast(`${label(a.type)} marked ${outcome.toLowerCase()}`); };
  return (
    <Ctx.Provider value={on ? { count: live.length, urgent: live.some((a) => a.sev === 'critical'), show: () => setOpen(true), showAnn: () => setAnnOpen(true) } : null}>
      {children}
      <Drawer corner open={on && annOpen} onClose={() => setAnnOpen(false)} title="Announcements" sub="What you have sent to workers, and who has read it">
        <Announcements list={anns} setList={setAnns} />
      </Drawer>
      <Drawer corner open={on && open} onClose={() => { setOpen(false); setSel(null); }} title="Notifications" sub={live.length ? `${live.length} open` : 'All caught up'}>
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

// Who an announcement can go to, and how many people that is today.
const audiences = () => [
  ['All workers', WORKERS.length],
  ['Pickers', WORKERS.filter((w) => w.role === 'Picker').length],
  ['Shift leads', WORKERS.filter((w) => w.role === 'Shift lead').length],
  ...SITES.filter((x) => siteInScope(x.id)).map((x) => [x.name, WORKERS.filter((w) => w.site === x.id).length]),
];
const ANN_FILTERS = [['all', 'All', () => true], ['reading', 'Not everyone has read', (a) => a.read < a.total], ['ack', 'Acknowledgement', (a) => a.ack]];
const blank = () => ({ title: '', body: '', to: 'All workers', ack: false });

// A small ring for how many have read it.
function ReadRing({ read, total }) {
  const r = 15, c = 2 * Math.PI * r, p = total ? read / total : 0;
  return (
    <span className="an-ring" role="img" aria-label={`${read} of ${total} read`}>
      <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r={r} className="an-ring-t" /><circle cx="19" cy="19" r={r} className="an-ring-v" strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ '--c': c }} transform="rotate(-90 19 19)" /></svg>
      <b>{Math.round(p * 100)}</b>
    </span>
  );
}

function Announcements({ list, setList }) {
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState(null);
  const [sel, setSel] = useState(null);
  const toast = useToast();
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const send = () => {
    if (!draft.title.trim()) return setDraft({ ...draft, tried: true });
    const total = audiences().find(([n]) => n === draft.to)?.[1] || 0;
    setList([{ id: 'n' + Date.now(), title: draft.title.trim(), body: draft.body.trim(), to: draft.to, sent: 'Just now', read: 0, total, ack: draft.ack, fresh: true }, ...list]);
    setDraft(null); setFilter('all');
    toast(`Announcement sent to ${total} ${total === 1 ? 'person' : 'people'}`);
  };
  const rows = list.filter(ANN_FILTERS.find(([k]) => k === filter)[2]);
  return (
    <>
      {draft ? (
        <div className="an-compose">
          <Field label="Title"><input className={'input' + (draft.tried && !draft.title.trim() ? ' bad' : '')} value={draft.title} onChange={set('title')} placeholder="What's it about?" autoFocus />{draft.tried && !draft.title.trim() && <span className="wfa-err">Give it a title</span>}</Field>
          <Field label="Message"><textarea className="input an-body" rows={3} value={draft.body} onChange={set('body')} placeholder="Write the announcement" /></Field>
          <Field label="Send to"><Select className="input" value={draft.to} onChange={set('to')}>{audiences().map(([n, k]) => <option key={n} value={n}>{`${n} · ${k}`}</option>)}</Select></Field>
          <Toggle id="an-ack" checked={draft.ack} onChange={(v) => setDraft({ ...draft, ack: v })} label="Ask them to acknowledge it" />
          <div className="an-compose-act"><button className="btn ghost" onClick={() => setDraft(null)}>Cancel</button><button className="btn" onClick={send}><Icon name="megaphone" size={16} />Send</button></div>
        </div>
      ) : (
        <button className="an-new" onClick={() => setDraft(blank())}><span className="an-new-ic"><Icon name="plus" size={18} stroke={2.4} /></span>New announcement</button>
      )}
      <div className="nt-chips" role="tablist" aria-label="Filter announcements">
        {ANN_FILTERS.map(([k, l, fn]) => <button key={k} role="tab" aria-selected={filter === k} className={'ma-chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}<span className="nt-chip-n">{list.filter(fn).length}</span></button>)}
      </div>
      <ul className="nt-list an-list" key={filter}>
        {rows.map((a, i) => { const on = sel === a.id, waiting = a.total - a.read; return (
          <li key={a.id} className={'nt-item' + (on ? ' on' : '') + (a.fresh ? ' fresh' : '')} style={{ '--i': i }}>
            <button className="nt-head an-head" aria-expanded={on} onClick={() => setSel(on ? null : a.id)}>
              <ReadRing read={a.read} total={a.total} />
              <span className="nt-what"><b>{a.title}</b><span>{a.to}</span></span>
              <span className="an-meta"><span className="nt-when">{a.sent}</span>{a.ack && <span className="an-ack">Acknowledge</span>}</span>
            </button>
            {on && <div className="nt-body an-detail">
              {a.body && <p>{a.body}</p>}
              <dl className="an-kv">
                <div><dt>Read</dt><dd>{a.read} of {a.total}</dd></div>
                <div><dt>Not read yet</dt><dd>{waiting ? waiting : 'Everyone has read it'}</dd></div>
                <div><dt>Acknowledgement</dt><dd>{a.ack ? 'Asked for' : 'Not asked'}</dd></div>
              </dl>
            </div>}
          </li>
        ); })}
        {!rows.length && <li className="an-none">Nothing here.</li>}
      </ul>
    </>
  );
}

// The megaphone: beside the bell in every page header. Announcements are a client dashboard thing too.
export function Megaphone() {
  const c = useContext(Ctx);
  if (!c) return null;
  return (
    <button className="bell icon-btn" onClick={c.showAnn} aria-label="Announcements" title="Announcements"><Icon name="megaphone" size={18} /></button>
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
