import { MANAGERS, WORKERS, HOME_AREAS, DESIG_ACCESS, tplOf, spanOf, endOf, vendorOf, siteOf } from '../data.js';
import { Drawer } from '../ui.jsx';
import { toMin } from './dates.js';
import { kmBetween, GEO } from './geo.js';

const { useState } = React;

export const COVER_RULES = { scope: 'anywhere', poolFirst: true, sameVendor: true, closest: true, offDay: 'warn', working: 'no', early: 90, late: 240, billAs: 'covered' };

export const isFloat = (w) => DESIG_ACCESS[w.role] === 'Floater';

export const mgrOfSite = (sid) => (MANAGERS.find((m) => m.sites.includes(sid)) || {}).id;

export const fromOf = (w, gsite) => (w.site === 'pool' ? HOME_AREAS[w.homeArea] : GEO[gsite]);

// Who covered this worker's day, if anyone: the shift that points back at them.
export const coverOf = (groups, wid, ci) => { for (const g of groups) for (let r = 0; r < g.people.length; r++) { const c = g.cells[r][ci]; if (Array.isArray(c)) { const sh = c.find((x) => x[3] === wid); if (sh) return { w: WORKERS.find((w) => w.id === g.people[r]), g: g.site, r, sh }; } } return null; };

// Everyone who could take this shift, judged by the cover rules.
export const coverCands = ({ groups, site, ci, absent, sh }) => {
  const R = COVER_RULES; const T = tplOf(sh[0]); const s0 = toMin(sh[1]); const e0 = s0 + spanOf(T) * 60;
  const absW = WORKERS.find((w) => w.id === absent); const tgtMgr = mgrOfSite(site); const out = [];
  groups.forEach((g) => g.people.forEach((id, r) => {
    if (id === absent) return;
    const w = WORKERS.find((x) => x.id === id); const fl = isFloat(w); const c = g.cells[r][ci];
    if (R.scope === 'manager' && !fl && mgrOfSite(g.site) !== tgtMgr) return;
    if (R.scope === 'location' && !fl && g.site !== site) return;
    let ok = true, warn = false, note;
    if (c === 'L') { ok = false; note = 'On leave'; }
    else if (Array.isArray(c)) {
      const clash = c.find(([t2, st2]) => { const a = toMin(st2), b = a + spanOf(tplOf(t2)) * 60; return a < e0 && s0 < b; });
      if (R.working === 'no') { ok = false; note = fl && c[0][2] ? `Covering at ${siteOf(c[0][2]).name.replace(/^(Spinneys|Carrefour) /, '')}` : 'Already working today'; }
      else if (clash) { ok = false; note = `Clashes with their ${clash[1]} shift`; }
      else { warn = true; note = 'Second shift that day'; }
    }
    else if (c === 'O') { if (R.offDay === 'no') { ok = false; note = 'Weekly off'; } else { warn = true; note = 'Weekly off'; } }
    else if (c === 'A') note = 'Available';
    else note = 'Not rostered that day';
    if (!fl && !ok && c !== 'O') return; // regular workers who are busy aren't worth listing
    out.push({ w, g: g.site, r, c, fl, ok, warn, note, km: kmBetween(fromOf(w, g.site), GEO[site]), sameV: absW && w.vendor === absW.vendor });
  }));
  const ord = (a, b) => (R.sameVendor ? (b.sameV ? 1 : 0) - (a.sameV ? 1 : 0) : 0) || (a.warn ? 1 : 0) - (b.warn ? 1 : 0) || (R.closest ? (a.km ?? 99) - (b.km ?? 99) : 0) || a.w.name.localeCompare(b.w.name);
  const okL = out.filter((x) => x.ok).sort(ord);
  const groupsOut = R.poolFirst ? [['Floaters', okL.filter((x) => x.fl)], ['On a day off', okL.filter((x) => !x.fl)]] : [['Available', okL]];
  return { groups: groupsOut.filter(([, l]) => l.length), best: okL.sort((a, b) => (R.poolFirst ? (b.fl ? 1 : 0) - (a.fl ? 1 : 0) : 0) || ord(a, b)), blocked: out.filter((x) => !x.ok && x.fl).sort(ord) };
};

export const coverLine = (x) => [x.fl ? `Floater · lives in ${x.w.homeArea}` : siteOf(x.g).name, x.km != null ? `${x.km} km` : null].filter(Boolean).join(' · ');

// The cover shift written into the coverer's cell, remembering what was there so Undo can put it back.
export const coverCell = (cand, site, sh, absent) => { const mine = [sh[0], sh[1], site, absent, Array.isArray(cand.c) ? undefined : cand.c]; return Array.isArray(cand.c) ? [...cand.c, mine] : [mine]; };

export const undoCell = (c, absent) => { if (!Array.isArray(c)) return c; const mine = c.find((x) => x[3] === absent); const rest = c.filter((x) => x !== mine); return rest.length ? rest : (mine && mine[4]) || 'A'; };

export function CoverDrawer({ open, onClose, ctx, onAssign, onSkip, skipLabel }) {
  const [all, setAll] = useState(false);
  if (!open || !ctx) return null;
  const { site, ci, absent, sh, dayLabel, groups } = ctx;
  const T = tplOf(sh[0]); const absW = WORKERS.find((w) => w.id === absent);
  const list = coverCands({ groups, site, ci, absent, sh }).best;
  const shown = all ? list : list.slice(0, 6);
  return (
    <Drawer open onClose={onClose} title={`Cover ${absW.name.split(' ')[0]}`} sub={`${dayLabel} · ${sh[1]} to ${endOf(sh[1], T.base + (T.brk || 0)).time} · ${siteOf(site).name}`}>
      {list.length === 0 && <p className="small muted">Nobody is free for this shift.</p>}
      {shown.map((x, i) => (
        <div key={x.w.id} className="cv-row">
          <div className="cv-who"><b>{x.w.name}</b><span className="small muted"><span className="vtag">{vendorOf(x.w.vendor).code}</span> {x.fl ? 'Floater' : 'Day off'}{x.km != null ? ` · ${x.km} km` : ''}{x.c === 'O' && <span className="warnt"> · Weekly off</span>}</span></div>
          <button className={'btn sm' + (i ? ' ghost' : '')} onClick={() => onAssign(x)}>Assign</button>
        </div>
      ))}
      {!all && list.length > 6 && <button className="linkbtn small cv-toggle" onClick={() => setAll(true)}>Show {list.length - 6} more</button>}
      {onSkip && <div className="feed-actions"><button className="btn ghost" onClick={onSkip}>{skipLabel || 'Leave uncovered'}</button></div>}
    </Drawer>
  );
}
