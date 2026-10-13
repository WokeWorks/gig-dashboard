import { WORKERS, LEAVE, ROSTER_GROUPS, tplOf, endOf, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Pill, Tabs, Drawer, Avatar, Toggle, Note, useToast, Select } from '../../ui.jsx';
import { coverCands } from '../../lib/cover.jsx';
import { WEEK0, fmtD, fmtRange } from '../../lib/dates.js';
import { shiftWeek } from '../../lib/roster.js';

const { useState, useMemo } = React;

export function Leave({ go }) {
  const [items, setItems] = useState(LEAVE);
  const [tab, setTab] = useState('wait');
  const [open, setOpen] = useState(null);
  const [appr, setAppr] = useState(null); // { l, plan: { iso: 'none' | workerId }, notify }
  const WEEKS = useMemo(() => ({ '-1': shiftWeek(ROSTER_GROUPS, -1, false), 0: ROSTER_GROUPS, 1: shiftWeek(ROSTER_GROUPS, 1, true) }), []);
  const groupOf = (wid) => ROSTER_GROUPS.find((g) => g.people.includes(wid));
  const cellOn = (wid, iso) => { const d = Math.round((new Date(iso + 'T00:00:00') - WEEK0) / 864e5); const wk = Math.floor(d / 7); const gs = WEEKS[wk]; if (!gs) return null; const g = gs.find((x) => x.people.includes(wid)); return g ? g.cells[g.people.indexOf(wid)][((d % 7) + 7) % 7] : null; };
  const datesOf = (l) => { const out = []; const d = new Date(l.from + 'T00:00:00'); const end = new Date(l.to + 'T00:00:00'); while (d <= end) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); d.setDate(d.getDate() + 1); } return out; };
  // Cover options for one day of the leave, from the same cover rules the roster and Liveboard use.
  const candsOn = (l, iso, sh) => { const d = Math.round((new Date(iso + 'T00:00:00') - WEEK0) / 864e5); const wk = Math.floor(d / 7); const gs = WEEKS[wk] || WEEKS[1]; return coverCands({ groups: gs, site: groupOf(l.worker).site, ci: ((d % 7) + 7) % 7, absent: l.worker, sh }).best; };
  const startApprove = (l) => { const plan = {}; datesOf(l).forEach((iso) => { const c = cellOn(l.worker, iso); if (Array.isArray(c)) { const b = candsOn(l, iso, c[0]).find((x) => x.fl && !x.warn); plan[iso] = b ? b.w.id : 'none'; } }); setOpen(null); setAppr({ l, plan, notify: true }); };
  const confirmApprove = () => { const { l, plan } = appr; const shifts = Object.keys(plan).length; const covered = Object.values(plan).filter((v) => v !== 'none').length; setItems((xs) => xs.map((x) => (x.id === l.id ? { ...x, status: 'Approved', by: 'You', at: 'Just now', cleared: shifts, covered } : x))); toast(`Approved · ${shifts} ${shifts === 1 ? 'shift' : 'shifts'} cleared${covered ? `, ${covered} covered` : ''} · roster updated`); setAppr(null); };
  const toast = useToast();
  const act = (id, status) => { setItems((xs) => xs.map((l) => (l.id === id ? { ...l, status, by: 'You', at: 'Just now', cleared: status === 'Approved' ? Math.ceil(l.days) : 0 } : l))); toast(status === 'Approved' ? 'Approved · their shifts on those days are cleared from the roster' : 'Rejected · worker notified in the app'); };
  const pending = items.filter((l) => l.status === 'Pending');
  const done = items.filter((l) => l.status !== 'Pending').sort((x, y) => x.from.localeCompare(y.from));
  const who = (l) => WORKERS.find((x) => x.id === l.worker);
  // Others at the same location already off on any of these days (approved leave).
  const overlap = (l) => { const w = who(l); return items.filter((o) => o.id !== l.id && o.status === 'Approved' && who(o).site === w.site && o.from <= l.to && o.to >= l.from).length; };
  return (
    <>
      <ScreenHeader title="Leave" phase={1} spec="5.8" />
      <Tabs tabs={[{ id: 'wait', label: `Waiting for you${pending.length ? ` (${pending.length})` : ''}` }, { id: 'done', label: 'Decided' }]} value={tab} onChange={setTab} />
      {tab === 'wait' && <section className="card flush">
        {pending.length === 0 ? <div className="pad small muted lv-empty">Nothing to review.</div> :
        <div className="table-wrap"><table className="table lv-table">
          <thead><tr><th>Worker</th><th>Type</th><th>Dates</th><th>Note</th><th></th></tr></thead>
          <tbody>{pending.map((l) => { const w = who(l); const ov = overlap(l); return (
            <tr key={l.id} className="rowlink" onClick={() => setOpen(l)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(l)}>
              <td><div className="who"><Avatar name={w.name} /><div><b>{w.name}</b><div className="small muted"><span className="vtag">{vendorOf(w.vendor).code}</span> {siteOf(w.site).name}</div></div></div></td>
              <td><b className="lv-type">{l.type}</b>{l.half && <div className="small muted">Half day</div>}</td>
              <td className="nowrap">{fmtRange(l.from, l.to)}<div className="small muted">{l.days} {l.days === 1 ? 'day' : 'days'}</div></td>
              <td className="small lv-notecell">{l.note ? <span className="lv-note-text" title={l.note}>{l.note}</span> : <span className="muted">No note</span>}{ov > 0 && <div className="lv-warn">{ov} other {ov === 1 ? 'person' : 'people'} off at this location then</div>}</td>
              <td onClick={(e) => e.stopPropagation()}><div className="lv-act"><button className="btn sm ghost" onClick={() => act(l.id, 'Rejected')}>Reject</button><button className="btn sm" onClick={() => startApprove(l)}>Approve</button></div></td>
            </tr>
          ); })}</tbody>
        </table></div>}
      </section>}
      {tab === 'done' && <section className="card flush">
        <div className="table-wrap"><table className="table lv-table">
          <thead><tr><th>Worker</th><th>Type</th><th>Dates</th><th>Status</th></tr></thead>
          <tbody>{done.map((l) => { const w = who(l); return (
            <tr key={l.id} className="rowlink" onClick={() => setOpen(l)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(l)}>
              <td><div className="who"><Avatar name={w.name} /><div><b>{w.name}</b><div className="small muted"><span className="vtag">{vendorOf(w.vendor).code}</span> {siteOf(w.site).name}</div></div></div></td>
              <td>{l.type}{l.half ? ' · half day' : ''}</td>
              <td className="nowrap">{fmtRange(l.from, l.to)}<div className="small muted">{l.days} {l.days === 1 ? 'day' : 'days'}</div></td>
              <td><Pill tone={l.status === 'Approved' ? 'good' : 'crit'}>{l.status}</Pill></td>
            </tr>
          ); })}</tbody>
        </table></div>
      </section>}
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open && who(open).name} sub={open && `${vendorOf(who(open).vendor).name} · ${siteOf(who(open).site).name}`}>
        {open && <>
          <dl className="kv">
            <dt>Type</dt><dd>{open.type}{open.half ? ' · half day' : ''}</dd>
            <dt>Dates</dt><dd>{fmtRange(open.from, open.to)} · {open.days} {open.days === 1 ? 'day' : 'days'}</dd>
            <dt>Attachment</dt><dd>{open.attach ? 'Certificate (PDF)' : <span className="muted">None</span>}</dd>
            <dt>Status</dt><dd><Pill tone={open.status === 'Approved' ? 'good' : open.status === 'Rejected' ? 'crit' : 'warn'}>{open.status === 'Pending' ? 'Waiting for you' : open.status}</Pill></dd>
          </dl>
          <h3 className="pub-h">Note from {who(open).name.split(' ')[0]}</h3>
          <p className="lv-fullnote">{open.note || <span className="muted">No note</span>}</p>
          {open.status !== 'Pending' && <>
            <h3 className="pub-h">What happened</h3>
            <ol className="lv-time">
              <li><b>Requested</b> in the worker app<span className="small muted">{open.asked}</span></li>
              <li className={open.status === 'Approved' ? 'ok' : 'no'}><b>{open.status}</b> by {open.by}<span className="small muted">{open.at}</span>{open.reason && <div className="lv-reason small">“{open.reason}”</div>}</li>
              {open.status === 'Approved' && <li><b>Roster updated</b>: {open.cleared} {open.cleared === 1 ? 'shift' : 'shifts'} cleared at {siteOf(who(open).site).name}{open.covered ? `, ${open.covered} covered` : ''}<span className="small muted">{open.by === 'You' ? 'Just now' : open.at}</span></li>}
              <li><b>{who(open).name.split(' ')[0]} notified</b> in the app{open.status === 'Approved' && <>, and <b>{vendorOf(who(open).vendor).name}</b> told</>}<span className="small muted">Automatic</span></li>
            </ol>
          </>}
          {open.status === 'Pending' && overlap(open) > 0 && <div className="row-line"><Pill tone="warn">Overlap</Pill><span className="small">{overlap(open)} other {overlap(open) === 1 ? 'person' : 'people'} off at this location on some of these days</span></div>}
          {open.status === 'Pending' && <div className="drawer-actions"><span className="grow" /><button className="btn ghost" onClick={() => { act(open.id, 'Rejected'); setOpen(null); }}>Reject</button><button className="btn" onClick={() => { startApprove(open); }}>Approve</button></div>}
        </>}
      </Drawer>
      <Drawer open={!!appr} onClose={() => setAppr(null)} title="Approve leave" sub={appr && `${who(appr.l).name} · ${appr.l.type} · ${fmtRange(appr.l.from, appr.l.to)}`}>
        {appr && (() => {
          const l = appr.l; const days = datesOf(l);
          const shifts = Object.keys(appr.plan).length; const covered = Object.values(appr.plan).filter((v) => v !== 'none').length;
          return <>
            <p className="small muted" style={{ margin: 0 }}>Approving clears {who(l).name.split(' ')[0]}'s shifts on these days. Choose what happens to each one.</p>
            <div className="ap-list">{days.map((iso) => {
              const c = cellOn(l.worker, iso);
              const shift = Array.isArray(c) ? c : null;
              return (
                <div key={iso} className={'ap-row' + (shift ? '' : ' quiet')}>
                  <div className="ap-day"><b>{fmtD(iso)}</b></div>
                  <div className="ap-now">{shift ? shift.map(([t, st, s2], k) => <div key={k}><span className="mono">{st}–{endOf(st, tplOf(t).base + (tplOf(t).brk || 0)).time}</span> <span className="small muted">{siteOf(s2 || groupOf(l.worker).site).name}</span></div>) : <span className="small muted">{c === 'O' ? 'Weekly off · nothing to change' : c === 'L' ? 'Already on leave' : 'Not rostered · nothing to change'}</span>}</div>
                  {shift && <Select className="input sm ap-pick" value={appr.plan[iso]} onChange={(e) => setAppr({ ...appr, plan: { ...appr.plan, [iso]: e.target.value } })} aria-label={`Cover for ${fmtD(iso)}`}>
                    <option value="none">Leave uncovered</option>
                    {candsOn(l, iso, shift[0]).slice(0, 8).map((x) => <option key={x.w.id} value={x.w.id}>{x.w.name} ({x.fl ? 'floater' : x.c === 'O' ? 'weekly off' : 'free'}, {x.km} km)</option>)}
                  </Select>}
                </div>
              );
            })}</div>
            <div className="ap-sum">
              <div><span className="stat-value">{shifts}</span><span className="small muted">{shifts === 1 ? 'shift' : 'shifts'} cleared</span></div>
              <div><span className="stat-value">{covered}</span><span className="small muted">covered</span></div>
              <div><span className={'stat-value' + (shifts - covered ? ' warnv' : '')}>{shifts - covered}</span><span className="small muted">left uncovered</span></div>
            </div>
            <Toggle id="ap-notify" checked={appr.notify} onChange={(v) => setAppr({ ...appr, notify: v })} label={`Notify ${who(l).name.split(' ')[0]}${covered ? ` and the ${covered === 1 ? 'person' : 'people'} covering` : ''} in the app, and tell ${vendorOf(who(l).vendor).name}`} />
            <div className="drawer-actions"><button className="btn ghost" onClick={() => setAppr(null)}>Cancel</button><span className="grow" /><button className="btn" onClick={confirmApprove}>Approve and update roster</button></div>
          </>;
        })()}
      </Drawer>
      <div className="small muted">Leave types, allowances and the people-off limit are set in <button className="linkbtn" onClick={() => go('settings', { tab: 'leave' })}>Settings → Leave types</button>.</div>
    </>
  );
}
