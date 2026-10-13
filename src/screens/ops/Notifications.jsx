import { WORKERS, ALERTS, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Pill, Drawer, Note, useToast } from '../../ui.jsx';

const { useState } = React;

export function Alerts() {
  const [type, setType] = useState('All');
  const [items, setItems] = useState(ALERTS);
  const [sel, setSel] = useState(null);
  const toast = useToast();
  const types = ['All', 'No-show', 'Late', 'Face mismatch', 'Outside geofence', 'Break overrun', 'Missing clock-out', 'Document expiry'];
  // Short names for alert types, used on the tiles and in the list.
  const label = (t) => ({ All: 'All open', 'Outside geofence': 'Off-site punch', 'Missing clock-out': 'No clock-out', 'Document expiry': 'Document issue' }[t] || t);
  const rows = items.filter((a) => type === 'All' || a.type === type);
  const resolve = (outcome) => { setItems((xs) => xs.map((a) => (a.id === sel.id ? { ...a, open: false, outcome } : a))); toast(`Marked ${outcome.toLowerCase()}`); setSel(null); };
  return (
    <>
      <ScreenHeader title="Notifications" phase={1} spec="5.6" />
      <div className="nt-tiles" role="tablist" aria-label="Filter by type">{types.map((t) => { const all = t === 'All' ? items : items.filter((a) => a.type === t); const open = all.filter((a) => a.open).length; const sev = all.some((a) => a.open && a.sev === 'critical') ? 'crit' : all.some((a) => a.open && a.sev === 'warning') ? 'warn' : ''; return (
        <button key={t} role="tab" aria-selected={type === t} className={'nt-tile' + (type === t ? ' on' : '') + (open ? '' : ' none')} onClick={() => setType(t)}>
          <span className={'nt-n' + (t === 'All' || !open ? '' : t === 'No-show' ? ' crit' : ' mustard')}>{open}</span><span className="nt-l">{label(t)}</span>
        </button>
      ); })}</div>
      <section className="card flush">
        <ul className="alert-list">
          {rows.map((a) => {
            const w = WORKERS.find((x) => x.id === a.worker);
            return (
              <li key={a.id} className={'alert-row sev-' + a.sev} onClick={() => setSel(a)} tabIndex={0}>
                <div><b>{label(a.type)}</b> <span className="muted small">· {w.name} · {siteOf(a.site).name} · {vendorOf(w.vendor).code}</span><div className="small">{a.detail}</div></div>
                <div className="alert-meta"><span className="mono small">{a.time}</span>{a.open ? <Pill tone="info">Open</Pill> : <Pill>{a.outcome}</Pill>}</div>
              </li>
            );
          })}
        </ul>
      </section>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.type} sub={sel && `${WORKERS.find((x) => x.id === sel.worker).name} · ${siteOf(sel.site).name}`}>
        {sel && <>
          <p>{sel.detail}</p>
          {sel.type === 'Face mismatch' && <div className="faces"><div className="face">Enrolled photo</div><div className="face alt">Punch selfie 07:04</div></div>}
          <div className="feed-actions">
            <button className="btn sm" onClick={() => resolve('Confirmed')}>Confirm</button>
            <button className="btn sm ghost" onClick={() => resolve('False alarm')}>False alarm</button>
            <button className="btn sm ghost" onClick={() => resolve('Excused')}>Excused</button>
          </div>
          <Note>Routed to the site supervisor by push and to ops on WhatsApp. The vendor sees confirmed no-shows in a daily digest.</Note>
        </>}
      </Drawer>
    </>
  );
}
