import { workerInScope } from '../../lib/scope.js';
import { WORKERS, LEAVE, ROSTER_GROUPS, tplOf, endOf, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Tabs, Drawer, Toggle, useToast, Select, Icon } from '../../ui.jsx';
import { coverCands } from '../../lib/cover.jsx';
import { WEEK0, fmtD, fmtRange } from '../../lib/dates.js';
import { shiftWeek } from '../../lib/roster.js';

const { useState, useMemo } = React;

// Leave: requests as rows that lead with their dates. A row opens a drawer with the whole request; Approve opens a
// second drawer that settles each rostered day (cover or leave uncovered) before the roster changes.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const day = (iso) => new Date(iso + 'T00:00:00');
const TYPE_DOT = { Annual: 'good', Sick: 'warn', Emergency: 'crit', Unpaid: 'idle' };
const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

// The dates as day pills, start and end joined by a line that says how long, like the drawer shows them.
const Pill2 = ({ iso }) => { const d = day(iso); return <span className="lvx-day"><small>{WD[d.getDay()]}</small><b>{d.getDate()}</b><small className="lvx-mon">{MON[d.getMonth()]}</small></span>; };
function Dates({ l }) {
  return (
    <span className={'lvr-dates' + (l.from === l.to ? ' one' : '')} aria-label={fmtRange(l.from, l.to)}>
      <Pill2 iso={l.from} />
      {l.from !== l.to ? <><span className="lvr-span"><span>{days(l.days)}</span></span><Pill2 iso={l.to} /></> : <span className="lvr-one">{l.half ? 'Half day' : '1 day'}</span>}
    </span>
  );
}

export function Leave({ go }) {
  const [items, setItems] = useState(() => LEAVE.filter((l) => workerInScope(WORKERS.find((x) => x.id === l.worker))));
  const [tab, setTab] = useState('wait');
  const [open, setOpen] = useState(null);
  const [leaving, setLeaving] = useState({}); // id -> true while its row animates out
  const [appr, setAppr] = useState(null); // { l, plan: { iso: 'none' | workerId }, notify }
  const WEEKS = useMemo(() => ({ '-1': shiftWeek(ROSTER_GROUPS, -1, false), 0: ROSTER_GROUPS, 1: shiftWeek(ROSTER_GROUPS, 1, true) }), []);
  const groupOf = (wid) => ROSTER_GROUPS.find((g) => g.people.includes(wid));
  const cellOn = (wid, iso) => { const d = Math.round((day(iso) - WEEK0) / 864e5); const wk = Math.floor(d / 7); const gs = WEEKS[wk]; if (!gs) return null; const g = gs.find((x) => x.people.includes(wid)); return g ? g.cells[g.people.indexOf(wid)][((d % 7) + 7) % 7] : null; };
  const datesOf = (l) => { const out = []; const d = day(l.from); const end = day(l.to); while (d <= end) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); d.setDate(d.getDate() + 1); } return out; };
  // Cover options for one day of the leave, from the same cover rules the roster and Liveboard use.
  const candsOn = (l, iso, sh) => { const d = Math.round((day(iso) - WEEK0) / 864e5); const wk = Math.floor(d / 7); const gs = WEEKS[wk] || WEEKS[1]; return coverCands({ groups: gs, site: groupOf(l.worker).site, ci: ((d % 7) + 7) % 7, absent: l.worker, sh }).best; };
  const toast = useToast();
  // A decided request leaves the waiting list with a short exit before its status changes.
  const settle = (id, patch, msg) => {
    setLeaving((x) => ({ ...x, [id]: true }));
    setTimeout(() => { setItems((xs) => xs.map((l) => (l.id === id ? { ...l, ...patch } : l))); setLeaving((x) => { const n = { ...x }; delete n[id]; return n; }); toast(msg); }, 280);
  };
  const startApprove = (l) => { const plan = {}; datesOf(l).forEach((iso) => { const c = cellOn(l.worker, iso); if (Array.isArray(c)) { const b = candsOn(l, iso, c[0]).find((x) => x.fl && !x.warn); plan[iso] = b ? b.w.id : 'none'; } }); setOpen(null); setAppr({ l, plan, notify: true }); };
  const confirmApprove = () => { const { l, plan } = appr; const shifts = Object.keys(plan).length; const covered = Object.values(plan).filter((v) => v !== 'none').length; setAppr(null); settle(l.id, { status: 'Approved', by: 'You', at: 'Just now', cleared: shifts, covered }, `Approved · ${shifts} ${shifts === 1 ? 'shift' : 'shifts'} cleared${covered ? `, ${covered} covered` : ''} · roster updated`); };
  const reject = (l) => settle(l.id, { status: 'Rejected', by: 'You', at: 'Just now', cleared: 0 }, 'Rejected · worker notified in the app');
  const pending = items.filter((l) => l.status === 'Pending');
  const done = items.filter((l) => l.status !== 'Pending').sort((x, y) => x.from.localeCompare(y.from));
  const who = (l) => WORKERS.find((x) => x.id === l.worker);
  // Others at the same location already off on any of these days (approved leave).
  const overlap = (l) => { const w = who(l); return items.filter((o) => o.id !== l.id && o.status === 'Approved' && who(o).site === w.site && o.from <= l.to && o.to >= l.from).length; };

  const row = (l, i) => {
    const w = who(l), ov = l.status === 'Pending' ? overlap(l) : 0;
    return (
      <li key={l.id} className={'lvr' + (leaving[l.id] ? ' leaving' : '')} style={{ '--i': i }}>
        <button className="lvr-main" onClick={() => setOpen(l)} aria-label={`${w.name}, ${l.type} leave, ${fmtRange(l.from, l.to)}`}>
          <span className="lvr-who">
            <span className="lvr-name"><b>{w.name}</b><span className="lvr-type"><span className={'sdot ' + TYPE_DOT[l.type]} />{l.type}</span></span>
            <span className="lvr-sub">{siteOf(w.site).name.replace(/^(Spinneys|Carrefour) /, '')} · {vendorOf(w.vendor).code}</span>
            {l.note && !(l.attach && /certificate/i.test(l.note)) && <span className="lvr-note">“{l.note}”</span>}
            {(l.attach || ov > 0) && <span className="lvr-flags">
              {l.attach && <span><Icon name="document" size={14} />Certificate attached</span>}
              {ov > 0 && <span><span className="sdot warn" />{ov} other {ov === 1 ? 'person' : 'people'} off here then</span>}
            </span>}
          </span>
          <Dates l={l} />
        </button>
        {l.status === 'Pending' ? (
          <span className="lvr-act"><button className="btn ghost" onClick={() => reject(l)}>Reject</button><button className="btn" onClick={() => startApprove(l)}>Approve</button></span>
        ) : (
          <span className="lvr-out"><b><span className={'sdot ' + (l.status === 'Approved' ? 'good' : 'crit')} />{l.status}</b><span>by {l.by} · {l.at}</span></span>
        )}
      </li>
    );
  };

  return (
    <>
      <ScreenHeader title="Leave" phase={1} spec="5.8" />
      <Tabs tabs={[{ id: 'wait', label: `Waiting for you${pending.length ? ` (${pending.length})` : ''}` }, { id: 'done', label: `Decided (${done.length})` }]} value={tab} onChange={setTab} />
      {tab === 'wait' && (pending.length === 0
        ? <div className="lv-none">
            <span className="lv-none-ic"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
            <b>You're all caught up</b>
            <span>New leave requests from the worker app land here.</span>
            {done.length > 0 && <button className="btn ghost" onClick={() => setTab('done')}>See {done.length} decided</button>}
          </div>
        : <ul className="lvl" key="wait">{pending.map(row)}</ul>)}
      {tab === 'done' && <ul className="lvl" key="done">{done.map(row)}</ul>}
      <p className="lv-foot2">Leave types, allowances and the people-off limit are set in <button className="linkbtn" onClick={() => go('settings', { tab: 'leave' })}>Settings → Leave types</button>.</p>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open && who(open).name} sub={open && `${siteOf(who(open).site).name} · ${vendorOf(who(open).vendor).name}`}>
        {open && <>
          <section className="lvx-dates">
            <span className="lvx-type"><span className={'sdot ' + TYPE_DOT[open.type]} />{open.type} leave{open.half ? ' · half day' : ''}</span>
            <b className="lvx-range">{fmtRange(open.from, open.to)}</b>
            <div className="lvx-days">{datesOf(open).map((iso) => { const d = day(iso); return <span key={iso} className="lvx-day"><small>{WD[d.getDay()]}</small><b>{d.getDate()}</b></span>; })}</div>
            <span className="lvx-len">{open.half ? 'Half a day' : days(open.days)} · asked {open.asked}</span>
          </section>
          <section className="lvx-sec">
            <h3>Note from {who(open).name.split(' ')[0]}</h3>
            {open.note ? <blockquote className="lvx-quote">{open.note}</blockquote> : <p className="muted">No note</p>}
            {open.attach && <span className="lvx-attach"><Icon name="document" size={16} />Certificate (PDF)</span>}
          </section>
          {open.status === 'Pending' && overlap(open) > 0 && <p className="lvx-warn"><span className="sdot warn" />{overlap(open)} other {overlap(open) === 1 ? 'person' : 'people'} off at this location on some of these days</p>}
          {open.status !== 'Pending' && <section className="lvx-sec">
            <h3>What happened</h3>
            <ol className="lvx-steps">
              <li><b>Requested in the worker app</b><span>{open.asked}</span></li>
              <li className={open.status === 'Approved' ? 'went-ok' : 'went-no'}><b>{open.status} by {open.by}</b><span>{open.at}</span>{open.reason && <blockquote className="lvx-quote">{open.reason}</blockquote>}</li>
              {open.status === 'Approved' && <li><b>Roster updated</b><span>{open.cleared} {open.cleared === 1 ? 'shift' : 'shifts'} cleared at {siteOf(who(open).site).name}{open.covered ? `, ${open.covered} covered` : ''}</span></li>}
              <li><b>{who(open).name.split(' ')[0]} notified{open.status === 'Approved' ? `, ${vendorOf(who(open).vendor).name} told` : ''}</b><span>Automatic</span></li>
            </ol>
          </section>}
          {open.status === 'Pending' && <div className="drawer-actions"><button className="btn ghost" onClick={() => { reject(open); setOpen(null); }}>Reject</button><span className="grow" /><button className="btn" onClick={() => startApprove(open)}>Approve…</button></div>}
        </>}
      </Drawer>

      <Drawer open={!!appr} onClose={() => setAppr(null)} title="Approve leave" sub={appr && `${who(appr.l).name} · ${appr.l.type} · ${fmtRange(appr.l.from, appr.l.to)}`}>
        {appr && (() => {
          const l = appr.l;
          const shifts = Object.keys(appr.plan).length; const covered = Object.values(appr.plan).filter((v) => v !== 'none').length;
          return <>
            <p className="lvx-intro">Approving clears {who(l).name.split(' ')[0]}'s shifts on these days. Pick who covers each one.</p>
            <ul className="apx">{datesOf(l).map((iso) => {
              const c = cellOn(l.worker, iso), shift = Array.isArray(c) ? c : null, d = day(iso);
              return (
                <li key={iso} className={shift ? '' : 'quiet'}>
                  <span className="lvx-day"><small>{WD[d.getDay()]}</small><b>{d.getDate()}</b></span>
                  <span className="apx-now">{shift ? shift.map(([t, st, s2], k) => <span key={k}><b>{st} – {endOf(st, tplOf(t).base + (tplOf(t).brk || 0)).time}</b><span>{siteOf(s2 || groupOf(l.worker).site).name.replace(/^(Spinneys|Carrefour) /, '')}</span></span>) : <span className="apx-none">{c === 'O' ? 'Weekly off, nothing to change' : c === 'L' ? 'Already on leave' : 'Not rostered, nothing to change'}</span>}</span>
                  {shift && <Select className="input apx-pick" value={appr.plan[iso]} onChange={(e) => setAppr({ ...appr, plan: { ...appr.plan, [iso]: e.target.value } })} aria-label={`Cover for ${fmtD(iso)}`}>
                    <option value="none">Leave uncovered</option>
                    {candsOn(l, iso, shift[0]).slice(0, 8).map((x) => <option key={x.w.id} value={x.w.id}>{x.w.name} · {x.fl ? 'floater' : x.c === 'O' ? 'weekly off' : 'free'} · {x.km} km</option>)}
                  </Select>}
                </li>
              );
            })}</ul>
            <div className="up-stats"><div><b>{shifts}</b><span>{shifts === 1 ? 'shift' : 'shifts'} cleared</span></div><div><b>{covered}</b><span>covered</span></div><div><b className={shifts - covered ? 'apx-gap' : ''}>{shifts - covered}</b><span>left uncovered</span></div></div>
            <div className="ma-row"><Toggle id="ap-notify" checked={appr.notify} onChange={(v) => setAppr({ ...appr, notify: v })} label={<><b>Notify everyone involved</b><small>{who(l).name.split(' ')[0]}{covered ? ` and the ${covered === 1 ? 'person' : 'people'} covering` : ''} in the app, and {vendorOf(who(l).vendor).name}</small></>} /></div>
            <div className="drawer-actions"><button className="btn ghost" onClick={() => setAppr(null)}>Cancel</button><span className="grow" /><button className="btn" onClick={confirmApprove}>Approve and update roster</button></div>
          </>;
        })()}
      </Drawer>
    </>
  );
}
