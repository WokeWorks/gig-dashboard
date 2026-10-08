import L from 'leaflet';
import { AREAS, MANAGERS, SITES, VENDORS, WORKERS, ALERTS, PROPOSALS, LEAVE, DAYS, ROSTER, ROSTER_GROUPS, KPIS, FIN_VENDORS, RATE_CARDS, COST_BY_SITE, SHIFT_TEMPLATES, HOME_AREAS, DESIG_ACCESS, TRAVEL, tplOf, tplLabel, endOf, ANNOUNCEMENTS, FORMS, METRICS, WORKER_METRICS, vendorOf, siteOf } from './data.js';
import { ScreenHeader, Stat, Pill, Tabs, Drawer, Modal, Bar, Spark, Avatar, statusTone, aed, Field, Toggle, Note, useToast, Phase, Icon } from './ui.jsx';

const { useState, useMemo, useEffect } = React;

const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// A worker's weekly off follows a pattern: the day it falls on in their roster.
export const offDaysOf = (wid) => { for (const g of ROSTER_GROUPS) { const r = g.people.indexOf(wid); if (r >= 0) { const ds = g.cells[r].map((c, i) => (c === 'O' ? i : -1)).filter((i) => i >= 0); return ds.length ? ds : 'rot'; } } return [4]; };

// Timesheet for a worker: built from their roster and clock-ins. No clock-in means absent; a forgotten clock-out is closed automatically.
let _weeksCache = null;
const weeksAll = () => (_weeksCache = _weeksCache || { '-1': shiftWeek(ROSTER_GROUPS, -1, false), 0: ROSTER_GROUPS, 1: shiftWeek(ROSTER_GROUPS, 1, true) });
export const missedAt = (sid, wid, wk, ci) => (sid.charCodeAt(1) * 7 + parseInt(wid.slice(1), 10) * 3 + ci * 5 + (wk + 1) * 11) % 7 === 0;
const addMin = (hhmm, m) => { const [h, mm] = hhmm.split(':').map(Number); const t = ((h * 60 + mm + m) % 1440 + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
export const timesheetOf = (w) => {
  const W = weeksAll(); const n = parseInt(w.id.slice(1), 10); const days = [];
  for (let date = 1; date <= 7; date++) {            // 1–7 Oct so far (today is Wed 7)
    const d = date - 5; const wk = Math.floor(d / 7); const ci = ((d % 7) + 7) % 7;
    const gs = W[wk]; const g = gs && gs.find((x) => x.people.includes(w.id));
    const c = g ? g.cells[g.people.indexOf(w.id)][ci] : 'X';
    const iso = `2026-10-${String(date).padStart(2, '0')}`;
    const here = Array.isArray(c) ? c : null;
    if (!here) { days.push({ iso, kind: c === 'O' ? 'Weekly off' : c === 'L' ? (coverOf(gs, w.id, ci) ? 'Leave · covered' : 'Leave') : c === 'A' ? 'Available' : 'Not rostered' }); continue; }
    const [t, st] = here[0]; const T = tplOf(t);
    if (date === 7) { days.push({ iso, kind: 'Today', shift: `${st}–${endOf(st, T.base).time}`, inT: addMin(st, -(n % 6)) }); continue; }
    if (missedAt(g.site, w.id, wk, ci)) { days.push({ iso, kind: 'Absent', shift: `${st}–${endOf(st, T.base).time}` }); continue; }
    const late = n % 7 === 3 && ci === 1 ? 14 : 0; const stay = T.ot && n % 3 === 0 ? 1 : 0; const auto = (n + date) % 9 === 0;
    const worked = +(T.base - late / 60 + stay).toFixed(1);
    days.push({ iso, kind: 'Full', shift: `${st}–${endOf(st, T.base).time}`, inT: addMin(st, late ? late : -(n % 6)), outT: auto ? 'auto' : addMin(st, (T.base + stay) * 60 + (n % 4)), worked, ot: stay, late });
  }
  const sum = { full: days.filter((x) => x.kind === 'Full').length, absent: days.filter((x) => x.kind === 'Absent').length, hours: days.reduce((a, x) => a + (x.worked || 0), 0), ot: days.reduce((a, x) => a + (x.ot || 0), 0) };
  return { days, sum };
};

/* ---------------- Cover and floaters ---------------- */
// One set of rules per client (Settings → Cover rules). Nothing below knows about a particular client:
// Weekly offs are never set per worker: the roster decides them each week, staggered so every location stays covered.
// These limits are what the roster checks against (edited in Settings → Attendance rules).
export const OFF_RULES = { perWeek: 1, maxRun: 6, sameDay: 1, mode: 'roster', days: [6] }; // mode: 'roster' (staggered) | 'fixed' (same days for everyone; days are 0 = Mon … 6 = Sun)
// With a fixed off, those days are off for everyone on every roster (leave stays leave).
// Offs on any other day turn back into the worker's usual shift (floaters go back to available).
const fixedOff = (groups) => (OFF_RULES.mode !== 'fixed' ? groups : groups.map((g) => ({ ...g, cells: g.cells.map((row) => row.map((c, d) => (OFF_RULES.days.includes(d) ? (c === 'L' ? c : 'O') : c === 'O' ? (g.float ? 'A' : row.find((x) => Array.isArray(x) && x.length === 1) || c) : c))) })));
export const COVER_RULES = { scope: 'anywhere', poolFirst: true, sameVendor: true, closest: true, offDay: 'warn', working: 'no', early: 90, late: 240, billAs: 'covered' };
const isFloat = (w) => DESIG_ACCESS[w.role] === 'Floater';
const mgrOfSite = (sid) => (MANAGERS.find((m) => m.sites.includes(sid)) || {}).id;
const kmBetween = (a, b) => { if (!a || !b) return null; const R = 6371, rad = Math.PI / 180; const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.3 * 10) / 10; }; // ×1.3 for roads
const fromOf = (w, gsite) => (w.site === 'pool' ? HOME_AREAS[w.homeArea] : GEO[gsite]);
// Who covered this worker's day, if anyone: the shift that points back at them.
const coverOf = (groups, wid, ci) => { for (const g of groups) for (let r = 0; r < g.people.length; r++) { const c = g.cells[r][ci]; if (Array.isArray(c)) { const sh = c.find((x) => x[3] === wid); if (sh) return { w: WORKERS.find((w) => w.id === g.people[r]), g: g.site, r, sh }; } } return null; };
// Everyone who could take this shift, judged by the cover rules.
const coverCands = ({ groups, site, ci, absent, sh }) => {
  const R = COVER_RULES; const T = tplOf(sh[0]); const s0 = toMin(sh[1]); const e0 = s0 + (T.base + T.ot) * 60;
  const absW = WORKERS.find((w) => w.id === absent); const tgtMgr = mgrOfSite(site); const out = [];
  groups.forEach((g) => g.people.forEach((id, r) => {
    if (id === absent) return;
    const w = WORKERS.find((x) => x.id === id); const fl = isFloat(w); const c = g.cells[r][ci];
    if (R.scope === 'manager' && !fl && mgrOfSite(g.site) !== tgtMgr) return;
    if (R.scope === 'location' && !fl && g.site !== site) return;
    let ok = true, warn = false, note;
    if (c === 'L') { ok = false; note = 'On leave'; }
    else if (Array.isArray(c)) {
      const clash = c.find(([t2, st2]) => { const a = toMin(st2), b = a + (tplOf(t2).base + tplOf(t2).ot) * 60; return a < e0 && s0 < b; });
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
const coverLine = (x) => [x.fl ? `Floater · lives in ${x.w.homeArea}` : siteOf(x.g).name, x.km != null ? `${x.km} km` : null].filter(Boolean).join(' · ');
// The cover shift written into the coverer's cell, remembering what was there so Undo can put it back.
const coverCell = (cand, site, sh, absent) => { const mine = [sh[0], sh[1], site, absent, Array.isArray(cand.c) ? undefined : cand.c]; return Array.isArray(cand.c) ? [...cand.c, mine] : [mine]; };
const undoCell = (c, absent) => { if (!Array.isArray(c)) return c; const mine = c.find((x) => x[3] === absent); const rest = c.filter((x) => x !== mine); return rest.length ? rest : (mine && mine[4]) || 'A'; };

function CoverDrawer({ open, onClose, ctx, onAssign, onSkip, skipLabel }) {
  const [all, setAll] = useState(false);
  if (!open || !ctx) return null;
  const { site, ci, absent, sh, dayLabel, groups } = ctx;
  const T = tplOf(sh[0]); const absW = WORKERS.find((w) => w.id === absent);
  const list = coverCands({ groups, site, ci, absent, sh }).best;
  const shown = all ? list : list.slice(0, 6);
  return (
    <Drawer open onClose={onClose} title={`Cover ${absW.name.split(' ')[0]}`} sub={`${dayLabel} · ${sh[1]} to ${endOf(sh[1], T.base).time} · ${siteOf(site).name}`}>
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

/* ---------------- Live board ---------------- */
// Live board: who is in right now, location by location. Built from today's roster (Wed 7 Oct) and clock-ins.
const NOW_MIN = 10 * 60 + 24; // 10:24
const toM = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const liveOf = (sid) => {
  const g = ROSTER_GROUPS.find((x) => x.site === sid);
  const out = [];
  const add = (w, sh, visiting) => {
    const [t, st] = sh; const T = tplOf(t); const s0 = toM(st); const e0 = s0 + T.base * 60; const n = parseInt(w.id.slice(1), 10);
    let status, inAt = null, late = 0;
    if (s0 > NOW_MIN) status = 'upcoming';
    else if (missedAt(sid, w.id, 0, 2) || w.status === 'No-show') status = NOW_MIN - s0 >= 60 ? 'noshow' : 'waiting';
    else { late = w.status === 'Late' || n % 11 === 4 ? 14 + (n % 3) * 6 : 0; inAt = s0 + (late || -(n % 5)); status = w.status === 'On break' ? 'break' : late ? 'late' : 'in'; }
    out.push({ w, t, start: st, end: endOf(st, T.base).time, s0, e0, status, inAt, late, visiting, label: tplLabel(T) });
  };
  if (g) g.people.forEach((id, r) => { const c = g.cells[r][2]; if (Array.isArray(c)) c.filter((x) => !x[2] || x[2] === sid).forEach((sh) => add(WORKERS.find((w) => w.id === id), sh, false)); });
  ROSTER_GROUPS.forEach((og) => { if (og.site === sid) return; og.people.forEach((id, r) => { const c = og.cells[r][2]; if (Array.isArray(c)) c.filter((x) => x[2] === sid).forEach((sh) => add(WORKERS.find((w) => w.id === id), sh, true)); }); });
  return out;
};
// Store coordinates (lng, lat) and a simple projection onto the 1000×640 map.
const GEO = { s1: [55.1385, 25.0745], s2: [55.1440, 25.0790], s3: [55.1745, 25.0975], s4: [55.2190, 25.0573], s5: [55.2390, 25.0450], s6: [55.3015, 25.0920], s7: [55.2900, 25.0080], s8: [55.3120, 25.1640] };
const LEFT = { s1: true };
const MX = (lng) => ((lng - 55.09) / (55.37 - 55.09)) * 1000;
const MY = (lat) => ((25.20 - lat) / (25.20 - 24.98)) * 640;
const LV = { noshow: ['No-show', 'crit', 0], late: ['Late', 'warn', 1], waiting: ['Not in yet', 'muted', 2], break: ['On break', 'info', 3], in: ['In', 'good', 4], upcoming: ['Later today', 'faint', 5], covered: ['Covered', 'muted', 6], absent: ['Absent', 'muted', 7] };
const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function LiveMap({ data, pick, onPick }) {
  const el = React.useRef(null); const map = React.useRef(null); const layer = React.useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const m = L.map(el.current, { scrollWheelZoom: false, zoomControl: false, attributionControl: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([25.09, 55.23], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    // Tiles: OpenStreetMap images embedded in the page (window.OSM_TILES, added at build time) so the map works
    // inside the sandboxed preview. Outside the cached area, or if none are embedded, fall back to the live servers.
    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    const T = window.OSM_TILES || {};
    const Cached = L.TileLayer.extend({ getTileUrl(c) { const k = `${c.z}/${c.x}/${c.y}`; return T[k] ? 'data:image/png;base64,' + T[k] : `https://tile.openstreetmap.org/${k}.png`; } });
    let ok = 0, bad = 0;
    if (Object.keys(T).length) { m.setMinZoom(12); m.setMaxZoom(14); m.setMaxBounds([[24.95, 55.05], [25.25, 55.42]]); m.options.maxBoundsViscosity = 1; }
    new Cached('', { attribution }).on('tileload', () => { ok++; }).on('tileerror', () => { bad++; if (bad > 8 && ok === 0) setFailed(true); }).addTo(m);
    layer.current = L.layerGroup().addTo(m); map.current = m;
    let alive = true; const fit = () => { if (alive) try { m.invalidateSize(); } catch (e) { /* map already gone */ } };
    const ro = new ResizeObserver(fit); ro.observe(el.current); const tm = setTimeout(fit, 50);
    return () => { alive = false; clearTimeout(tm); ro.disconnect(); try { m.stop(); m.off(); } catch (e) {} m.remove(); };
  }, []);
  useEffect(() => {
    const m = map.current; if (!m) return; layer.current.clearLayers();
    const pts = [];
    data.forEach((d) => {
      const [lng, lat] = GEO[d.s.id] || [55.2, 25.1]; pts.push([lat, lng]);
      const tone = d.bad ? 'crit' : d.late ? 'warn' : d.due.length ? 'good' : 'idle';
      const html = `<div class="lp ${tone}${pick === d.s.id ? ' on' : ''}"><span class="lp-dot">${d.due.length ? d.inn : '–'}</span><span class="lp-lab${tone === 'good' || tone === 'idle' ? ' quiet' : ''}"><b>${d.s.name.replace(/^(Spinneys|Carrefour) /, '')}</b><small>${d.due.length ? d.inn + '/' + d.due.length + ' in' : 'No one due'}${d.bad ? ' · ' + d.bad + ' no-show' : d.late ? ' · ' + d.late + ' late' : ''}</small></span></div>`;
      L.marker([lat, lng], { icon: L.divIcon({ className: 'lp-wrap' + (LEFT[d.s.id] ? ' left' : ''), html, iconSize: [26, 26], iconAnchor: [13, 13] }), zIndexOffset: d.bad ? 1000 : d.late ? 500 : 0, keyboard: true, title: d.s.name })
        .on('click', () => onPick(d.s.id)).addTo(layer.current);
    });
    if (pick) { const g = GEO[pick]; if (g) m.panTo([g[1], g[0]], { animate: false }); }
    else if (pts.length) m.fitBounds(pts, { padding: [36, 36], maxZoom: 13, animate: false });
  }, [data, pick]);
  return <div className="lm-leaf" ref={el}>{failed && <div className="lm-fail small">Map tiles could not load here.</div>}</div>;
}

export function LiveBoard({ go }) {
  const [mgr, setMgr] = useState('all');
  const [only, setOnly] = useState('all');
  const [openLoc, setOpenLoc] = useState(null);
  const [pick, setPick] = useState(null);
  useEffect(() => { if (pick) { const e = document.getElementById('lm-' + pick); if (e) e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, [pick]);
  const [cover, setCover] = useState(null);
  const [handled, setHandled] = useState({});
  const [mark, setMark] = useState(null); // { p, site, how, at, why, excused }
  const toast = useToast();
  const sites = SITES.filter((s) => mgr === 'all' || MANAGERS.find((m) => m.id === mgr).sites.includes(s.id));
  const data = sites.map((s) => { const ppl = liveOf(s.id).map((p) => (handled[p.w.id] ? { ...p, status: handled[p.w.id] } : p)); const due = ppl.filter((p) => p.status !== 'upcoming'); const inn = due.filter((p) => ['in', 'late', 'break'].includes(p.status)).length; const bad = ppl.filter((p) => p.status === 'noshow').length; const late = ppl.filter((p) => p.status === 'late').length; return { s, ppl, due, inn, bad, late, up: ppl.filter((p) => p.status === 'upcoming') }; });
  const tot = data.reduce((a, d) => ({ due: a.due + d.due.length, inn: a.inn + d.inn, bad: a.bad + d.bad, late: a.late + d.late, up: a.up + d.up.length }), { due: 0, inn: 0, bad: 0, late: 0, up: 0 });
  const shown = data.filter((d) => only === 'all' || (only === 'noshow' ? d.bad : only === 'late' ? d.late : !d.bad && !d.late)).sort((a, b) => b.bad * 10 + b.late - (a.bad * 10 + a.late));
  const actions = data.flatMap((d) => d.ppl.filter((p) => p.status === 'noshow' || p.status === 'late').map((p) => ({ ...p, site: d.s }))).sort((a, b) => LV[a.status][2] - LV[b.status][2]);
  const loc = openLoc && data.find((d) => d.s.id === openLoc);
  return (
    <>
      <ScreenHeader title="Liveboard" phase={1} spec="5.1" desc="Who is in right now, location by location, and who needs chasing." actions={<span className="lv-clock"><span className="lv-live" />Wed 7 Oct · {hm(NOW_MIN)}</span>} />
      <section className="card flush lm-wrap">
        <LiveMap data={shown} pick={pick} onPick={setPick} />
        <div className="lm-over lm-filters">
          <label className="lm-sel"><Icon name="users" size={15} /><select id="lb-mgr" value={mgr} onChange={(e) => { setMgr(e.target.value); setPick(null); }} aria-label="Manager"><option value="all">All managers</option>{MANAGERS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <div className="lm-chips" role="tablist" aria-label="Show">
            {[['all', 'All', null, data.length], ['noshow', 'No-show', 'crit', data.filter((d) => d.bad).length], ['late', 'Late', 'warn', data.filter((d) => d.late).length], ['ok', 'All in', 'good', data.filter((d) => !d.bad && !d.late).length]].map(([k, l, tone, n]) => (
              <button key={k} role="tab" aria-selected={only === k} className={'lm-chip' + (only === k ? ' on' : '')} onClick={() => { setOnly(k); setPick(null); }}>{tone && <span className={'lm-k ' + tone} />}{l}<span className="lm-n">{n}</span></button>
            ))}
          </div>
        </div>
        <div className="lm-over lm-stats">
          <div><span className="lm-sv">{tot.inn}<small>/{tot.due}</small></span><span className="lm-sl">in now</span></div>
          <div className={tot.bad ? 'crit' : ''}><span className="lm-sv">{tot.bad}</span><span className="lm-sl">no-show</span></div>
          <div className={tot.late ? 'warn' : ''}><span className="lm-sv">{tot.late}</span><span className="lm-sl">late</span></div>
          <div><span className="lm-sv">{tot.up}</span><span className="lm-sl">later today</span></div>
        </div>
      </section>
      <section className="card flush lm-list">
        {shown.length === 0 && <div className="pad small muted lv-empty">No locations match.</div>}
        {shown.map((d) => {
          const on = pick === d.s.id;
          const issues = d.ppl.filter((p) => ['noshow', 'late', 'waiting'].includes(p.status)).sort((a, b) => LV[a.status][2] - LV[b.status][2]);
          return (
            <div key={d.s.id} className={'lm-row' + (on ? ' on' : '')} id={'lm-' + d.s.id}>
              <button className="lm-row-head" onClick={() => setPick(on ? null : d.s.id)} aria-expanded={on}>
                <span className={'lm-k ' + (d.bad ? 'crit' : d.late ? 'warn' : d.due.length ? 'good' : 'idle')} />
                <span className="lm-name"><b>{d.s.name}</b><span className="small muted">{MANAGERS.find((m) => m.sites.includes(d.s.id)).name}</span></span>
                <span className="lm-state small">{d.bad ? <span className="neg">{d.bad} no-show</span> : null}{d.bad && d.late ? <span className="muted"> · </span> : null}{d.late ? <span className="warnt">{d.late} late</span> : null}{!d.bad && !d.late ? <span className="muted">{d.due.length ? 'All in' : 'No one due yet'}</span> : null}</span>
                <span className="lm-cnt mono">{d.inn}<span className="muted">/{d.due.length}</span></span>
              </button>
              {on && <div className="lm-detail">
                {issues.map((p) => (
                  <div key={p.w.id + p.start} className={'lm-p ' + p.status}>
                    <span className="lb-dot" /><button className="namelink" onClick={() => go('workforce', { worker: p.w.id })}>{p.w.name}</button>
                    <span className="small muted">{p.status === 'late' ? `in at ${hm(p.inAt)}, ${p.late} min late` : `due ${p.start}, not in`}</span>
                    <span className="lm-p-act">
                      {p.status !== 'late' && <button className="btn sm ghost" onClick={() => setMark({ p, site: d.s, how: 'here', at: p.start, why: 'Phone not working', excused: false })}>Mark attendance</button>}
                      {p.status === 'noshow' && <button className="btn sm" onClick={() => setCover({ ...p, site: d.s })}>Cover</button>}
                    </span>
                  </div>
                ))}
                <div className="lm-ok small muted">{d.ppl.filter((p) => ['in', 'break'].includes(p.status)).map((p) => p.w.name.split(' ')[0] + (p.status === 'break' ? ' (break)' : '')).join(', ') || 'Nobody in yet'}{d.up.length ? ` · ${d.up.length} starting at ${d.up.map((p) => p.start).sort()[0]}` : ''}</div>
                <button className="btn ghost sm" onClick={() => setOpenLoc(d.s.id)}>Today's timeline</button>
              </div>}
            </div>
          );
        })}
      </section>
      <Drawer open={!!loc} onClose={() => setOpenLoc(null)} title={loc && loc.s.name} sub={loc && `Today · ${loc.inn} of ${loc.due.length} due are in · ${loc.up.length} starting later`}>
        {loc && <>
          <div className="lb-tl">
            <div className="lb-tl-axis">{[6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h} style={{ left: `${((h - 6) / 18) * 100}%` }}>{String(h % 24).padStart(2, '0')}:00</span>)}</div>
            <div className="lb-tl-now" style={{ left: `calc(130px + (100% - 130px) * ${(NOW_MIN - 360) / 1080})` }}><span>{hm(NOW_MIN)}</span></div>
            {[...loc.ppl].sort((a, b) => a.s0 - b.s0 || LV[a.status][2] - LV[b.status][2]).map((p) => {
              const X = (m) => `${Math.max(0, Math.min(100, ((m - 360) / 1080) * 100))}%`;
              const endM = p.e0 > p.s0 ? p.e0 : p.e0 + 1440;
              return (
                <div key={p.w.id + p.start} className="lb-tl-row">
                  <button className="lb-tl-who" onClick={() => go('workforce', { worker: p.w.id })}><b>{p.w.name}</b><span className={'small lb-st ' + p.status}>{LV[p.status][0]}{p.status === 'late' ? ` · ${p.late}m` : ''}</span></button>
                  <div className="lb-tl-track">
                    <span className="lb-tl-plan" style={{ left: X(p.s0), width: `calc(${X(Math.min(endM, 1440))} - ${X(p.s0)})` }} />
                    {p.inAt != null && <span className={'lb-tl-act ' + p.status} style={{ left: X(p.inAt), width: `calc(${X(NOW_MIN)} - ${X(p.inAt)})` }} />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="legend small lb-legend"><span className="lb-key plan" /> Rostered <span className="lb-key act" /> Clocked in <span className="lb-key late" /> Late</div>
          <div className="feed-actions"><button className="btn ghost" onClick={() => go('schedule')}>Open roster</button></div>
        </>}
      </Drawer>
      <Drawer open={!!mark} onClose={() => setMark(null)} title={mark && `Mark attendance · ${mark.p.w.name}`} sub={mark && `${mark.site.name} · due ${mark.p.start}`}>
        {mark && <>
          <div className="ma-opts" role="radiogroup" aria-label="Attendance">
            {[['here', 'They are here', 'Clocking in failed, but they are working'], ['absent', 'They are not coming', 'Close the shift as absent']].map(([k, l, sub]) => (
              <button key={k} role="radio" aria-checked={mark.how === k} className={'ob-opt' + (mark.how === k ? ' on' : '')} onClick={() => setMark({ ...mark, how: k })}><b>{l}</b><span className="small muted">{sub}</span></button>
            ))}
          </div>
          {mark.how === 'here' ? <div className="form-grid">
            <Field label="Arrived at"><input type="time" className="input" value={mark.at} onChange={(e) => setMark({ ...mark, at: e.target.value })} /></Field>
            <Field label="Why they couldn't clock in"><select className="input" value={mark.why} onChange={(e) => setMark({ ...mark, why: e.target.value })}>{['Phone not working', 'Face check failing', 'Location not detected', 'No phone with them', 'Other'].map((x) => <option key={x}>{x}</option>)}</select></Field>
          </div> : <Toggle id="ma-exc" checked={mark.excused} onChange={(v) => setMark({ ...mark, excused: v })} label="Excused (they called in, emergency)" />}
          <div className="small muted">Shows on their timesheet as marked by you, with the reason, so it can be told apart from a real clock-in.</div>
          <div className="drawer-actions"><button className="btn ghost" onClick={() => setMark(null)}>Cancel</button><span className="grow" /><button className="btn" onClick={() => { const n = mark.p.w.name.split(' ')[0]; setHandled({ ...handled, [mark.p.w.id]: mark.how === 'here' ? 'in' : 'absent' }); toast(mark.how === 'here' ? `${n} marked in at ${mark.at} · ${mark.why.toLowerCase()}` : `${n} marked absent${mark.excused ? ' (excused)' : ''}`); setMark(null); }}>{mark.how === 'here' ? 'Mark as here' : 'Mark as absent'}</button></div>
        </>}
      </Drawer>
      <CoverDrawer open={!!cover} onClose={() => setCover(null)}
        ctx={cover && { site: cover.site.id, ci: TODAY, absent: cover.w.id, sh: [cover.t, cover.start], dayLabel: 'Today', groups: ROSTER_GROUPS, why: `No-show: due ${cover.start}, not in after ${NOW_MIN - cover.s0} min` }}
        onSkip={() => { setHandled({ ...handled, [cover.w.id]: 'covered' }); setCover(null); toast('Left uncovered · stays a no-show on the timesheet'); }}
        onAssign={(x) => { setHandled({ ...handled, [cover.w.id]: 'covered' }); setCover(null); toast(`${x.w.name.split(' ')[0]} asked to cover at ${cover.site.name.replace(/^(Spinneys|Carrefour) /, '')} · push sent · ${cover.w.name.split(' ')[0]}'s day marked excused`); }} />
    </>
  );
}

/* ---------------- Workforce ---------------- */
// What a worker is doing today, in plain words, for the Workforce list.
export const todayOf = (w) => {
  const t = timesheetOf(w).days.find((d) => d.iso === '2026-10-07');
  if (t && t.kind === 'Weekly off') return { tone: 'muted', text: 'Weekly off', key: 'off' };
  if (t && t.kind === 'Leave') return { tone: 'info', text: 'On leave', key: 'off' };
  if (t && t.kind === 'Not rostered') return { tone: 'muted', text: 'Not rostered', key: 'off' };
  if (t && t.kind === 'Available') return { tone: 'muted', text: 'Available to cover', key: 'off' };
  if (t && t.kind === 'Leave · covered') return { tone: 'info', text: 'On leave', key: 'off' };
  const st = w.status;
  if (st === 'No-show') return { tone: 'crit', text: 'No-show', key: 'notin' };
  if (st === 'Late') return { tone: 'warn', text: 'Late · 14 min', key: 'in' };
  if (st === 'On break') return { tone: 'info', text: 'On break', key: 'in' };
  if (st === 'On leave') return { tone: 'info', text: 'On leave', key: 'off' };
  if (st === 'Off today') return { tone: 'muted', text: 'Weekly off', key: 'off' };
  return { tone: 'good', text: `In since ${(t && t.inT) || '06:58'}`, key: 'in' };
};
export function Workforce({ params, go }) {
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState(params?.vendor || 'all');
  const [site, setSite] = useState(params?.site || 'all');
  const [role, setRole] = useState('all');
  const [show, setShow] = useState('all');
  const [sel, setSel] = useState(params?.worker ? WORKERS.find((w) => w.id === params.worker) : null);
  const [tab, setTab] = useState('Overview');
  const toast = useToast();
  const base = WORKERS.filter((w) => (vendor === 'all' || w.vendor === vendor) && (site === 'all' || w.site === site) && (role === 'all' || w.role === role) && (!q || (w.name + w.code).toLowerCase().includes(q.toLowerCase())));
  const tagged = base.map((w) => ({ w, today: todayOf(w), month: timesheetOf(w).sum }));
  const counts = { all: tagged.length, in: tagged.filter((x) => x.today.key === 'in').length, notin: tagged.filter((x) => x.today.key === 'notin').length, off: tagged.filter((x) => x.today.key === 'off').length, docs: tagged.filter((x) => x.w.docs).length };
  const rows = tagged.filter((x) => show === 'all' || (show === 'docs' ? x.w.docs : x.today.key === show));
  const roles = [...new Set(WORKERS.map((w) => w.role))];
  return (
    <>
      <ScreenHeader title="Workforce" phase={1} spec="5.2" desc="Everyone working at your locations, whichever vendor employs them." actions={<>
        <button className="btn ghost" onClick={() => toast('Bulk import: upload CSV or XLSX, get a per-row error report')}>Bulk import</button>
        <button className="btn" onClick={() => go('onboarding')}>Add worker</button>
      </>} />
      <div className="toolbar">
        <input id="wf-search" className="input" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
        <select id="wf-site" className="input" value={site} onChange={(e) => setSite(e.target.value)} aria-label="Location"><option value="all">All locations</option>{SITES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}<option value="pool">Floaters (no location)</option></select>
        <select id="wf-vendor" className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} aria-label="Vendor"><option value="all">All vendors</option>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
        <select id="wf-role" className="input" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Designation"><option value="all">All designations</option>{roles.map((r) => <option key={r}>{r}</option>)}</select>
      </div>
      <div className="seg" role="tablist" aria-label="Show">
        {[['all', 'Everyone'], ['in', 'Working now'], ['notin', 'Not in'], ['off', 'Off today'], ['docs', 'Document issues']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={show === k} className={'seg-btn' + (show === k ? ' on' : '') + (k === 'notin' && counts.notin ? ' alert' : '')} onClick={() => setShow(k)}>{label}<span className="seg-n">{counts[k]}</span></button>
        ))}
      </div>
      <section className="card flush">
        <div className="table-wrap">
          <table className="table hover wf-table">
            <thead><tr><th>Worker</th><th>Location</th><th>Today</th><th>October so far</th><th>Documents</th></tr></thead>
            <tbody>
              {rows.map(({ w, today, month }) => (
                <tr key={w.id} onClick={() => { setSel(w); setTab('Overview'); }} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(w)}>
                  <td><b>{w.name}</b><div className="small muted"><span className="vtag" title={vendorOf(w.vendor).name}>{vendorOf(w.vendor).code}</span> {w.role}</div></td>
                  <td>{siteOf(w.site).name}</td>
                  <td><span className={'wf-dot ' + today.tone} />{today.text}</td>
                  <td><span className="mono">{month.hours.toFixed(0)} h</span><div className="small muted">{month.full} {month.full === 1 ? 'day' : 'days'}{month.absent ? <span className="neg"> · {month.absent} absent</span> : ''}</div></td>
                  <td>{w.docs ? <span className="wf-doc"><Icon name="alert" size={14} />{w.docs}</span> : <span className="muted small">All valid</span>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="muted small">Nobody matches these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name} sub={sel && `${sel.code} · ${vendorOf(sel.vendor).name} · ${sel.role}`}>
        {sel && <>
          <Tabs tabs={['Overview', 'Timesheet', 'Documents', 'Score', 'Devices']} value={tab} onChange={setTab} />
          {tab === 'Overview' && <dl className="kv">
            <dt>Phone</dt><dd className="mono">{sel.phone}</dd>
            <dt>Employer of record</dt><dd>{vendorOf(sel.vendor).name}</dd>
            {sel.site === 'pool' ? <>
              <dt>Access</dt><dd>Floater · no fixed location · since {fmtD(sel.joined)}</dd>
              <dt>Home area</dt><dd>{sel.homeArea} <span className="small muted">· used to suggest the nearest covers</span></dd>
            </> : <><dt>Access</dt><dd>{DESIG_ACCESS[sel.role] || 'Employee'}</dd><dt>Location</dt><dd>{siteOf(sel.site).name} · since {fmtD(sel.joined)}</dd></>}
            <dt>Deliveroo staff ID</dt><dd className="mono">{sel.clientId}</dd>
            <dt>Usual shift</dt><dd>{sel.site === 'pool' ? 'None · each cover follows the shift being covered' : (() => { const g = ROSTER_GROUPS.find((x) => x.people.includes(sel.id)); const row = g ? g.cells[g.people.indexOf(sel.id)] : []; const c = row.find((x) => Array.isArray(x) && x.length === 1); if (!c) return '—'; const [t, st] = c[0]; return `${st} – ${endOf(st, tplOf(t).base).time} · ${tplLabel(tplOf(t))}`; })()}</dd>
            <dt>Weekly off</dt><dd>{(() => { const ds = offDaysOf(sel.id); return ds === 'rot' || !ds.length ? <span className="muted">None this week</span> : ds.map((k) => FULL_DAYS[k]).join(', '); })()} <span className="small muted">· this week, set on the roster</span> <button className="linkbtn small" onClick={() => go('schedule')}>Open roster</button></dd>
            <dt>Face enrolment</dt><dd><Pill tone="good">Enrolled</Pill></dd>
            <dt>Status</dt><dd><Pill tone={statusTone(sel.status)}>{sel.status}</Pill></dd>
          </dl>}
          {tab === 'Timesheet' && (() => { const ts = timesheetOf(sel); return <>
            <div className="ts-head"><select id="ts-per" className="input sm" defaultValue="oct"><option value="oct">October 2026 · in progress</option><option value="sep">September 2026 · closed</option></select><span className="small muted">Closes with the vendor statements</span></div>
            <div className="ts-sum">
              <div><span className="stat-value">{ts.sum.full}</span><span className="small muted">full days</span></div>
              <div><span className={'stat-value' + (ts.sum.absent ? ' neg' : '')}>{ts.sum.absent}</span><span className="small muted">absent</span></div>
              <div><span className="stat-value">{ts.sum.hours.toFixed(1)}</span><span className="small muted">hours worked</span></div>
              <div><span className="stat-value">{ts.sum.ot}</span><span className="small muted">overtime h</span></div>
            </div>
            <table className="table ts-days"><thead><tr><th>Day</th><th>Shift</th><th>In</th><th>Out</th><th className="num">Worked</th><th>Result</th></tr></thead>
              <tbody>{[...ts.days].reverse().map((d) => (
                <tr key={d.iso} className={d.shift ? '' : 'quiet'}>
                  <td className="nowrap">{fmtD(d.iso)}</td>
                  <td className="mono small">{d.shift || <span className="muted">—</span>}</td>
                  <td className="mono small">{d.inT ? <>{d.inT}{d.late ? <span className="neg"> +{d.late}m</span> : ''}</> : <span className="muted">—</span>}</td>
                  <td className="mono small">{d.outT === 'auto' ? <span title="Closed automatically after the shift">auto</span> : d.outT || <span className="muted">—</span>}</td>
                  <td className="num mono small">{d.worked != null ? d.worked + (d.ot ? ` (+${d.ot})` : '') : <span className="muted">—</span>}</td>
                  <td>{d.kind === 'Full' ? <Pill tone="good">Full</Pill> : d.kind === 'Absent' ? <Pill tone="crit">Absent</Pill> : d.kind === 'Today' ? <Pill tone="info">On shift</Pill> : <span className="small muted">{d.kind}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
            <Note>Built from clock-ins against the roster. No clock-in means absent, unless a manager marks attendance from the Liveboard; those days show as marked, with the reason. A forgotten clock-out is closed automatically after the shift.</Note>
          </>; })()}
          {tab === 'Documents' && <table className="table"><tbody>
            {[['Passport', '2031-04-11', 'good'], ['UAE visa', sel.docs?.includes('Visa') ? '2026-10-19' : '2027-06-02', sel.docs?.includes('Visa') ? 'warn' : 'good'], ['Emirates ID', sel.docs?.includes('Emirates') ? 'Missing' : '2027-06-02', sel.docs?.includes('Emirates') ? 'crit' : 'good'], ['Food handling certificate', '2027-01-30', 'good']].map(([n, d, t]) => <tr key={n}><td>{n}</td><td className="mono">{d}</td><td><Pill tone={t}>{t === 'good' ? 'Valid' : t === 'warn' ? 'Expiring' : 'Missing'}</Pill></td></tr>)}
          </tbody></table>}
          {tab === 'Score' && <>
            <div className="bigscore"><span className="mono">{sel.score}</span><span className="muted">/ 100 this month</span></div>
            {KPIS.map((k, i) => <div key={k.id} className="kpi-row"><span>{k.name} <span className="muted small">· {k.weight}%</span></span><Bar value={[96, 88, 100, 81, 92, 80][i]} /></div>)}
            <Note>Every score links back to the records behind it. Excused absences and false-alarm alerts never count.</Note>
          </>}
          {tab === 'Devices' && <dl className="kv"><dt>Bound device</dt><dd>Samsung Galaxy A34 · Android 14</dd><dt>Integrity</dt><dd><Pill tone="good">Play Integrity passed</Pill></dd><dt>Last punch</dt><dd className="mono">06:58 · 42 m from site</dd><dt>Change device</dt><dd><button className="btn sm ghost" onClick={() => toast('Device reset; worker re-verifies with OTP and face')}>Reset binding</button></dd></dl>}
        </>}
      </Drawer>
    </>
  );
}

/* ---------------- Onboarding ---------------- */
// Same flow as the current OpsPro setup: a short wizard, then an app invite. Gig workers, so no approval pipeline.
const OB_STEPS = [['Personal details', 'Name, mobile, dates'], ['Work', 'Type, location, shift, vendor'], ['Reference photo', 'For face check at clock-in'], ['Review', 'Check, then create']];
const OB_EMPTY = { first: '', last: '', phone: '', nat: '', start: '2026-10-08', end: '2027-04-07', reliever: false, home: 'Al Quoz', site: 's3', shift: 'f5', shiftStart: '07:00', vendor: 'v4', desig: 'Picker', photo: false };
const INVITES = [
  { id: 'i1', name: 'Segun Bello', code: 'OP-1342', phone: '+971 55 210 4471', state: 'Not sent yet' },
  { id: 'i2', name: 'Ravi Nambiar', code: 'OP-1335', phone: '+971 52 774 9012', state: 'Active, expires in 31 h' },
  { id: 'i3', name: 'Ali Raza', code: 'OP-1328', phone: '+971 50 118 2290', state: 'Link expired' },
];
export function Onboarding() {
  const [tab, setTab] = useState('new');
  const [step, setStep] = useState(0);
  const [d, setD] = useState(OB_EMPTY);
  const [done, setDone] = useState(null);
  const [props, setProps] = useState(PROPOSALS.filter((x) => x.stage !== 'ready'));
  const toast = useToast();
  const set = (k, v) => setD({ ...d, [k]: v });
  const phoneOk = /^(\+?971|0)?5\d{8}$/.test(d.phone.replace(/\s/g, ''));
  const can = step === 0 ? d.first && d.last && phoneOk && d.start && d.end : true;
  const T = tplOf(d.shift);
  const startFrom = (p) => { const [first, ...rest] = p.name.split(' '); setD({ ...OB_EMPTY, first, last: rest.join(' '), vendor: p.vendor, site: p.site, desig: p.role, reliever: p.role === 'Reliever', fromProp: p.id }); setStep(0); setDone(null); setTab('new'); };
  const create = () => { setDone({ code: 'OP-' + (1349 + Math.floor(Math.random() * 40)), face: d.photo }); if (d.fromProp) setProps(props.filter((x) => x.id !== d.fromProp)); };
  return (
    <>
      <ScreenHeader title="Onboarding" phase={1} spec="6" desc="Add workers one at a time or in bulk, then send them the app link to set their PIN." />
      <Tabs tabs={[{ id: 'new', label: 'Add a worker' }, { id: 'bulk', label: 'Bulk import' }, { id: 'prop', label: `From vendors (${props.length})` }]} value={tab} onChange={setTab} />
      {tab === 'new' && !done && <div className="ob">
        <ol className="ob-steps">{OB_STEPS.map(([l, sub], i) => <li key={l} className={i === step ? 'on' : i < step ? 'done' : ''}><span className="ob-n">{i < step ? <Icon name="check" size={13} stroke={2.6} /> : i + 1}</span><div><b>{l}</b><span className="small muted">{sub}</span></div></li>)}</ol>
        <section className="card form ob-body">
          <div className="small muted">Step {step + 1} of 4</div>
          <h3 className="ob-h">{OB_STEPS[step][0]}</h3>
          {step === 0 && <div className="form-grid">
            <Field label="First name"><input id="ob-first" className="input" value={d.first} onChange={(e) => set('first', e.target.value)} /></Field>
            <Field label="Last name"><input id="ob-last" className="input" value={d.last} onChange={(e) => set('last', e.target.value)} /></Field>
            <Field label="Mobile number" hint={d.phone && !phoneOk ? 'Enter a UAE mobile, e.g. 05XXXXXXXX' : 'Used to sign in to the app'}><input id="ob-phone" className="input mono" placeholder="05X XXX XXXX" value={d.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Nationality (optional)"><select id="ob-nat" className="input" value={d.nat} onChange={(e) => set('nat', e.target.value)}><option value="">Not set</option>{['India', 'Pakistan', 'Bangladesh', 'Nigeria', 'Philippines', 'Nepal', 'Sri Lanka', 'Other'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Start date"><input id="ob-start" type="date" className="input" value={d.start} onChange={(e) => set('start', e.target.value)} /></Field>
            <Field label="End date" hint="Contract end or last working day"><input id="ob-end" type="date" className="input" value={d.end} onChange={(e) => set('end', e.target.value)} /></Field>
          </div>}
          {step === 1 && <>
            <Field label="Type">
              <div className="ob-type">{[[false, 'Employee', 'Works fixed shifts at one location'], [true, 'Floater', 'No fixed location; covers leave and no-shows where needed']].map(([v, l, sub]) => (
                <button key={l} className={'ob-opt' + (d.reliever === v ? ' on' : '')} onClick={() => setD({ ...d, reliever: v, desig: Object.keys(DESIG_ACCESS).find((k) => DESIG_ACCESS[k] === (v ? 'Floater' : 'Employee')) })}><b>{l}</b><span className="small muted">{sub}</span></button>
              ))}</div>
            </Field>
            <div className="form-grid">
              {d.reliever ? <Field label="Home area" hint="Where they live. Used to suggest the nearest covers."><select id="ob-home" className="input" value={d.home} onChange={(e) => set('home', e.target.value)}>{Object.keys(HOME_AREAS).map((x) => <option key={x}>{x}</option>)}</select></Field>
              : <Field label="Location"><select id="ob-site" className="input" value={d.site} onChange={(e) => set('site', e.target.value)}>{SITES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
              <Field label="Designation"><select id="ob-desig" className="input" value={d.desig} onChange={(e) => set('desig', e.target.value)}>{Object.keys(DESIG_ACCESS).filter((k) => DESIG_ACCESS[k] === (d.reliever ? 'Floater' : 'Employee')).map((x) => <option key={x}>{x}</option>)}</select></Field>
              {!d.reliever && <Field label="Usual shift"><select id="ob-shift" className="input" value={d.shift} onChange={(e) => set('shift', e.target.value)}>{SHIFT_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{tplLabel(t)}</option>)}</select></Field>}
              {!d.reliever && <Field label="Usually starts at" hint={`Ends ${endOf(d.shiftStart, T.base).time}`}><input id="ob-shiftst" type="time" className="input mono" value={d.shiftStart} onChange={(e) => set('shiftStart', e.target.value || d.shiftStart)} /></Field>}
              <Field label="Vendor"><select id="ob-vendor" className="input" value={d.vendor} onChange={(e) => set('vendor', e.target.value)}>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
            </div>
          </>}
          {step === 2 && <>
            <button className={'ob-photo' + (d.photo ? ' has' : '')} onClick={() => set('photo', !d.photo)}>
              {d.photo ? <><span className="ob-face" aria-hidden="true">{(d.first[0] || '') + (d.last[0] || '')}</span><b>photo.jpg</b><span className="small muted">Tap to replace</span></> : <><Icon name="upload" size={22} /><b>Upload a clear, front-facing photo</b><span className="small muted">JPG or PNG. The face is turned into a pattern on this device; the app compares against it at every clock-in.</span></>}
            </button>
            <div className="small muted">You can skip this and add it later, but the worker cannot clock in until a photo is set.</div>
          </>}
          {step === 3 && <dl className="kv ob-review">
            <dt>Name</dt><dd>{d.first} {d.last}</dd>
            <dt>Mobile</dt><dd className="mono">{d.phone}</dd>
            <dt>Dates</dt><dd>{fmtD(d.start)} – {fmtD(d.end)}</dd>
            <dt>Designation</dt><dd>{d.desig} · {d.reliever ? 'Floater' : 'Employee'} access</dd>
            {d.reliever ? <><dt>Home area</dt><dd>{d.home}</dd><dt>Shifts</dt><dd>Each cover follows the shift being covered</dd></> : <><dt>Location</dt><dd>{siteOf(d.site).name}</dd><dt>Usual shift</dt><dd>{d.shiftStart} – {endOf(d.shiftStart, T.base).time} · {tplLabel(T)}</dd></>}
            <dt>Vendor</dt><dd>{vendorOf(d.vendor).name}</dd>
            <dt>Photo</dt><dd>{d.photo ? 'Added' : <span className="neg">Not added: cannot clock in yet</span>}</dd>
          </dl>}
          <div className="drawer-actions">
            {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
            <span className="grow" />
            {step < 3 ? <button className="btn" disabled={!can} onClick={() => setStep(step + 1)}>Continue</button> : <button className="btn" onClick={create}>Create worker</button>}
          </div>
        </section>
      </div>}
      {tab === 'new' && done && <section className="card ob-done">
        <span className="ob-tick"><Icon name="check" size={26} stroke={2.6} /></span>
        <h3>{d.first} {d.last} is set up</h3>
        <div className="muted">Employee ID <b className="mono">{done.code}</b> · {siteOf(d.site).name} · {vendorOf(d.vendor).name}</div>
        <div className="small">{done.face ? 'Face reference saved. They can clock in once they set a PIN.' : 'No photo yet: add one from their Workforce page before their first shift.'}</div>
        <div className="feed-actions">
          <button className="btn" onClick={() => toast('WhatsApp opened with their setup link')}>Send app link on WhatsApp</button>
          <button className="btn ghost" onClick={() => toast('Setup link copied')}>Copy link</button>
          <button className="btn ghost" onClick={() => { setD(OB_EMPTY); setStep(0); setDone(null); }}>Add another</button>
        </div>
      </section>}
      {tab === 'bulk' && <section className="card ob-bulk">
        <h3 className="ob-h">Add many workers at once</h3>
        <ol className="ob-bulk-steps small">
          <li>Download the template. One row per worker: name, mobile, start and end date, location, designation, shift, vendor.</li>
          <li>Upload it back. Every row is checked before anything is created, and you get a report of rows to fix.</li>
          <li>Photos are added afterwards from each worker's page; invites appear under App invites.</li>
        </ol>
        <div className="feed-actions"><button className="btn ghost" onClick={() => toast('Template downloaded (XLSX)')}>Download template</button><button className="btn" onClick={() => toast('Checked 24 rows · 22 ready, 2 to fix (invalid mobile, unknown location)')}>Upload file</button></div>
      </section>}
      {tab === 'prop' && <section className="card flush">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Candidate</th><th>Vendor</th><th>Preferred location</th><th></th></tr></thead>
          <tbody>{props.map((p) => <tr key={p.id}>
            <td><b>{p.name}</b><div className="small muted">{p.role}</div></td>
            <td><span className="vtag" title={vendorOf(p.vendor).name}>{vendorOf(p.vendor).code}</span> {vendorOf(p.vendor).name}</td>
            <td>{siteOf(p.site).name}</td>
            <td><div className="lv-act"><button className="btn sm ghost" onClick={() => { setProps(props.filter((x) => x.id !== p.id)); toast(`${p.vendor === 'v4' ? 'GH FZE' : vendorOf(p.vendor).name} told: not taken forward`); }}>Decline</button><button className="btn sm" onClick={() => startFrom(p)}>Onboard</button></div></td>
          </tr>)}</tbody>
        </table></div>
        <div className="pad lv-foot small muted">Vendors can suggest people from their portal. Onboard fills the form with what they sent.</div>
      </section>}
    </>
  );
}

/* ---------------- Sites ---------------- */
export function ClientsSites() {
  const toast = useToast();
  return (
    <>
      <ScreenHeader title="Locations" phase={1} spec="5.3" desc="Each location has a geofence, operating hours, required headcount by role and attendance rules." actions={<button className="btn" onClick={() => toast('Add a location: draw the geofence on the map, set hours and headcount')}>Add location</button>} />
      {AREAS.map((a) => (
        <section key={a} className="area-group">
          <div className="area-head"><h3>{a}</h3><span className="muted small">{SITES.filter((s) => s.area === a).length} locations · {SITES.filter((s) => s.area === a).reduce((x, s) => x + s.req, 0)} heads required</span></div>
          <div className="site-grid">
            {SITES.filter((s) => s.area === a).map((s) => (
              <article key={s.id} className="card site">
                <svg viewBox="0 0 120 80" className="geo" aria-label={`Geofence radius ${s.radius} metres`}>
                  <rect width="120" height="80" className="geo-bg" />
                  <path d="M0 52 L120 38 M30 0 L44 80 M80 0 L70 80" className="geo-road" />
                  <circle cx="58" cy="44" r={s.radius / 6} className="geo-ring" />
                  <circle cx="58" cy="44" r="3.5" className="geo-pin" />
                </svg>
                <div className="site-body">
                  <div className="feed-top"><b>{s.name}</b><span className="mono small muted">{s.code}</span></div>
                  <div className="small">Geofence {s.radius} m · {s.hours}</div>
                  <div className="small muted">Rules: {s.policy}</div>
                  <div className="chips">{Object.entries(s.roles).map(([r, n]) => <span key={r} className="chip">{r} <b className="mono">{n}</b></span>)}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/* ---------------- Vendors ---------------- */
export function Vendors({ go }) {
  const [sel, setSel] = useState(null);
  return (
    <>
      <ScreenHeader title="Vendors" phase={1} spec="8" desc="Every manpower supplier. Click a vendor to see its workers. Only you see vendors side by side; each vendor sees only its own people." />
      <section className="card flush">
        <div className="table-wrap">
          <table className="table hover">
            <thead><tr><th>Vendor</th><th className="num">Deployed</th><th className="num">Score</th><th className="num">Fill rate</th><th className="num">No-show rate</th><th className="num">Time to fill</th><th>Rate</th><th>Trend</th><th></th></tr></thead>
            <tbody>
              {VENDORS.map((v, i) => (
                <tr key={v.id} onClick={() => go('workforce', { vendor: v.id })} tabIndex={0} title={`Show ${v.name}'s workers`}>
                  <td><span className="vtag">{v.code}</span> <b>{v.name}</b></td>
                  <td className="num mono">{v.heads}</td>
                  <td className="num mono"><b>{v.score}</b></td>
                  <td className="num mono">{v.fill}%</td>
                  <td className="num mono">{v.noshow}%</td>
                  <td className="num mono">{v.ttf ? v.ttf + ' h' : '—'}</td>
                  <td className="mono small">{v.unit.includes('hour') ? `AED ${v.buy}/h` : aed(v.buy) + '/mo'}</td>
                  <td><Spark data={[[80, 82, 81, 84, 85, 86], [82, 80, 81, 78, 79, 79], [78, 76, 75, 73, 74, 72], [89, 90, 90, 91, 90, 91]][i]} /></td>
                  <td><button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); setSel(v); }}>Scorecard</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name} sub="Vendor scorecard · October 2026">
        {sel && <>
          <div className="bigscore"><span className="mono">{sel.score}</span><span className="muted">vendor score</span></div>
          {[['Average worker score', sel.score + 2], ['Fill rate', sel.fill], ['Retention at 90 days', sel.retention], ['Document compliance', sel.compliance], ['Attendance', 100 - sel.noshow * 2]].map(([k, v]) => <div key={k} className="kpi-row"><span>{k}</span><span className="mono small">{Math.round(v)}%</span><Bar value={v} /></div>)}
          <dl className="kv"><dt>Time to fill</dt><dd className="mono">{sel.ttf} h</dd><dt>Replacement speed</dt><dd className="mono">{Math.round(sel.ttf * 0.8)} h</dd><dt>Contract</dt><dd>{sel.unit}, {sel.unit.includes('hour') ? 'hours worked' : 'days present ÷ 26'}</dd><dt>Portal users</dt><dd>2 (1 admin, 1 viewer)</dd></dl>
        </>}
      </Drawer>
    </>
  );
}

/* ---------------- Roster ---------------- */
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const shiftHours = (cell) => (Array.isArray(cell) ? cell.reduce((a, [t]) => a + tplOf(t).base, 0) : 0);
const shiftOt = (cell) => (Array.isArray(cell) ? cell.reduce((a, [t]) => a + tplOf(t).ot, 0) : 0);
const TODAY = 2; // Wed 7 Oct
const DAY0 = 5 * 60, DAYLEN = 22 * 60; // timeline window 05:00 → 03:00 next day
const pos = (min) => Math.max(0, Math.min(1, (min < DAY0 ? min + 1440 - DAY0 : min - DAY0) / DAYLEN));
function dayChecks(list, home) {
  const iv = list.map(([t, st, s2]) => { const s0 = toMin(st); return { s0, endBase: s0 + tplOf(t).base * 60, endOt: s0 + (tplOf(t).base + tplOf(t).ot) * 60, site: s2 || home }; }).sort((a, b) => a.s0 - b.s0);
  const out = [];
  for (let k = 1; k < iv.length; k++) {
    const a = iv[k - 1], b = iv[k];
    const travel = a.site !== b.site ? (TRAVEL[a.site + '|' + b.site] || 30) : 0;
    if (b.s0 < a.endBase) out.push(['crit', 'Blocked', 'These shifts overlap']);
    else if (b.s0 < a.endBase + travel) out.push(['crit', 'Blocked', `Not enough time to travel to ${siteOf(b.site).name} (about ${travel} min)`]);
    else if (b.s0 < a.endOt + travel) out.push(['warn', 'Check', 'The optional overtime hour would run into the next shift']);
    else if (b.s0 - a.endOt < 60) out.push(['warn', 'Check', 'Less than 1 h between shifts (policy minimum)']);
  }
  const hrs = list.reduce((a, [t]) => a + tplOf(t).base, 0);
  if (hrs > 12) out.push(['warn', 'Check', `${hrs} base hours in one day`]);
  return out;
}
function MiniBar({ list, home }) {
  return (
    <span className="minibar" aria-hidden="true">
      {list.map(([t, st, s2], k) => { const a = pos(toMin(st)); const b = pos(toMin(st) + tplOf(t).base * 60); return <span key={k} className={s2 && s2 !== home ? 'away' : ''} style={{ left: a * 100 + '%', width: Math.max(4, (b - a) * 100) + '%' }} />; })}
    </span>
  );
}
function DayTimeline({ list, home }) {
  const W = 460, H = 96, L = 8, R = 8, top = 22, bh = 30;
  const X = (min) => L + pos(min) * (W - L - R);
  const ticks = [6, 9, 12, 15, 18, 21, 0, 3];
  const sorted = [...list].sort((a, b) => toMin(a[1]) - toMin(b[1]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="daytl" role="img" aria-label="Shifts across the day">
      {ticks.map((h) => <g key={h}><line x1={X(h * 60)} x2={X(h * 60)} y1={top - 4} y2={top + bh + 4} className="tl-grid" /><text x={X(h * 60)} y={H - 6} textAnchor={h === 3 ? "end" : h === 6 ? "start" : "middle"} className="tl-tick">{String(h).padStart(2, '0')}:00</text></g>)}
      {sorted.map(([t, st, s2], k) => {
        const T = tplOf(t), s0 = toMin(st), site = s2 || home;
        const x0 = X(s0), x1 = X(s0 + T.base * 60), x2 = X(s0 + (T.base + T.ot) * 60);
        return (
          <g key={k}>
            <rect x={x0} y={top} width={Math.max(2, x1 - x0)} height={bh} rx="5" className={'tl-seg' + (site !== home ? ' away' : '')} />
            {T.ot > 0 && <rect x={x1} y={top} width={Math.max(2, x2 - x1)} height={bh} rx="5" className={'tl-ot' + (site !== home ? ' away' : '')} />}
            <text x={x0 + 6} y={top + 13} className={'tl-lab' + (site !== home ? ' away' : '')}>{siteOf(site).name}</text>
            <text x={x0 + 6} y={top + 25} className={'tl-sub' + (site !== home ? ' away' : '')}>{st} · {tplLabel(T)}</text>
          </g>
        );
      })}
      {sorted.slice(1).map((b, k) => {
        const a = sorted[k]; const ea = toMin(a[1]) + tplOf(a[0]).base * 60; const sb = toMin(b[1]); const gap = sb - ea;
        const sa = a[2] || home, sb2 = b[2] || home; const tr = sa !== sb2 ? (TRAVEL[sa + '|' + sb2] || 30) : 0;
        if (gap <= 0) return null;
        return <text key={'g' + k} x={(X(ea) + X(sb)) / 2} y={top - 8} textAnchor="middle" className="tl-gap">{Math.floor(gap / 60)}h{gap % 60 ? ` ${gap % 60}m` : ''} gap{tr ? ` · ${tr} min travel` : ''}</text>;
      })}
    </svg>
  );
}

const UNACK = ['w2', 'w9', 'w14']; // haven't acknowledged the published roster
const WEEK0 = new Date(2026, 9, 5); // Mon 5 Oct 2026
const weekDays = (wk) => Array.from({ length: 7 }, (_, i) => { const d = new Date(WEEK0); d.setDate(d.getDate() + wk * 7 + i); return d.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ' + d.getDate(); });
const weekLabel = (wk, short) => { const a = new Date(WEEK0); a.setDate(a.getDate() + wk * 7); const b = new Date(a); b.setDate(b.getDate() + 6); const f = (d, m) => d.getDate() + (m ? ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] : ''); return short ? `week of ${f(a, true)}` : `${f(a, a.getMonth() !== b.getMonth())} – ${f(b, true)} ${b.getFullYear()}`; };
// Another week of roster: offs start on the same day as the week before (the manager moves them as needed); leave becomes the worker's usual shift; a draft has a few days not yet filled in (Off).
const usual = (row) => row.find((c) => Array.isArray(c) && c.length === 1) || [['f5', '07:00']];
const shiftWeek = (groups, n, draft) => groups.map((g, gi) => ({ ...g, cells: g.cells.map((row, r) => {
  const out = row.map((c, d) => { if (c === 'O') return 'O'; if (g.float) return n === 0 ? c : 'A'; if (n !== 0 && draft && (r + gi + d) % 9 === 0) return 'X'; if (n !== 0 && (c === 'L' || c === 'X')) return usual(row); return c; });
  // Someone whose off fell inside their leave still needs one: give it back on the first of those days.
  if (n !== 0 && !out.includes('O')) { const k = row.indexOf('L'); if (k >= 0) out[k] = 'O'; }
  return out;
}) }));

// Weekly off checks, used on upload and before publishing. A worker rostered on more days than 7 minus the
// org's weekly offs is an error: the roster is rejected. Too many off at one location on one day is only a warning.
const offErrors = (groups) => groups.flatMap((g) => g.cells.map((row, r) => ({ g, r, wid: g.people[r], worked: row.filter((c) => Array.isArray(c)).length, closed: OFF_RULES.mode === 'fixed' ? OFF_RULES.days.filter((d) => Array.isArray(row[d])) : [] })).filter((x) => x.closed.length || x.worked > 7 - OFF_RULES.perWeek));
const errText = (x) => (x.closed.length ? `rostered on ${x.closed.map((d) => FULL_DAYS[d]).join(' and ')}, the organisation's weekly off` : `all ${x.worked} days rostered`);
const offPerWeek = () => (OFF_RULES.mode === 'fixed' ? OFF_RULES.days.length : OFF_RULES.perWeek);
const offClashes = (groups) => OFF_RULES.mode === 'fixed' ? [] : groups.filter((g) => !g.float).flatMap((g) => [0, 1, 2, 3, 4, 5, 6].map((ci) => ({ site: g.site, ci, n: g.cells.filter((row) => row[ci] === 'O').length })).filter((x) => x.n > OFF_RULES.sameDay));
// The uploaded file in the demo: next week, with two people rostered all seven days.
const badUpload = (groups) => { const w = fixedOff(shiftWeek(groups, 1, false)); return w.map((g, gi) => (gi === 0 || gi === 3 ? { ...g, cells: g.cells.map((row, r) => (r === 1 ? row.map((c) => (c === 'O' ? usual(row) : c)) : row)) } : g)); };

export function Scheduling({ go }) {
  const [mgr, setMgr] = useState('m1');
  const [ven, setVen] = useState('all');
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [cover, setCover] = useState(null);
  const [day, setDay] = useState(null); // { g: siteId, r, c }
  const [wk, setWk] = useState(0); // -1 last week, 0 this week, 1 next week
  const [weeks, setWeeks] = useState(() => ({ '-1': shiftWeek(ROSTER_GROUPS, -1, false), 0: ROSTER_GROUPS, 1: shiftWeek(ROSTER_GROUPS, 1, true) }));
  const [pub, setPub] = useState({ '-1': 'published', 0: 'published', 1: 'draft' });
  const [dirty, setDirty] = useState({ '-1': 0, 0: 0, 1: 0 });
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  useEffect(() => { const mq = window.matchMedia('(max-width: 640px)'); const f = (e) => setNarrow(e.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  const [dIdx, setDIdx] = useState(TODAY);
  useEffect(() => { const tb = document.querySelector('.topbar'); if (!tb) return; const set = () => document.documentElement.style.setProperty('--tb', tb.getBoundingClientRect().height + 'px'); set(); const ro = new ResizeObserver(set); ro.observe(tb); return () => ro.disconnect(); }, []);
  const [pubOpen, setPubOpen] = useState(false);
  const [up, setUp] = useState(null); // upload: { step: 'pick' | 'report', data, file }
  const [pubOpt, setPubOpt] = useState({ notify: true, ack: true });
  const groups = fixedOff(weeks[wk]);
  const fixedMode = OFF_RULES.mode === 'fixed';
  const days = weekDays(wk);
  const nowIdx = wk < 0 ? 7 : wk > 0 ? -1 : TODAY; // days before this index have happened
  const [add, setAdd] = useState({ t: 'f7', st: '13:00', site: 's3' });
  const toast = useToast();
  const W = (id) => WORKERS.find((w) => w.id === id);
  const G = (sid) => groups.find((g) => g.site === sid);
  const setCell = (g, r, c, v) => { setWeeks((Wk) => ({ ...Wk, [wk]: Wk[wk].map((x) => (x.site !== g ? x : { ...x, cells: x.cells.map((row, ri) => row.map((y, ci) => (ri === r && ci === c ? v : y))) })) })); setDirty((d) => ({ ...d, [wk]: d[wk] + 1 })); };
  const copyPrev = () => { setWeeks((Wk) => ({ ...Wk, [wk]: shiftWeek(Wk[wk - 1], 1, false) })); setDirty((d) => ({ ...d, [wk]: d[wk] + 1 })); toast(`Copied ${weekLabel(wk - 1)} into ${weekLabel(wk)} · review, then publish`); };
  const publish = () => { setPubOpen(false); setPub((x) => ({ ...x, [wk]: 'published' })); setDirty((d) => ({ ...d, [wk]: 0 })); toast(pub[wk] === 'draft' ? `${weekLabel(wk)} published · workers notified in the app` : `Changes published · ${dirty[wk]} affected workers notified`); };
  const assign = (x) => { setCell(x.g, x.r, cover.ci, coverCell(x, cover.site, cover.sh, cover.absent)); toast(`${x.w.name} covers ${W(cover.absent).name.split(' ')[0]} on ${days[cover.ci]} · push sent`); setCover(null); };
  const findCover = (absent, sid, ci, row) => { setDay(null); setCover({ absent, site: sid, ci, sh: usual(row)[0] }); };
  const covBy = (wid, ci) => coverOf(groups, wid, ci);
  const first = (n) => n.split(' ')[0];
  const site = day ? day.g : 's3';
  const cur = day && G(day.g).cells[day.r][day.c];
  const list = Array.isArray(cur) ? cur : [];
  const norm = (x) => x.filter((v) => v !== undefined);
  const mk = (t, st, s2) => norm([t, st, s2 === site ? undefined : s2]);
  const preview = [...list, mk(add.t, add.st, add.site)];
  const dayWorker = day && W(G(day.g).people[day.r]);
  const isPool = day && day.g === 'pool';
  const checks = [...(cur === 'O' ? [['warn', 'Weekly off', `${dayWorker.name.split(' ')[0]}'s weekly off: this counts as rest-day work, paid at the overtime rate`]] : []), ...dayChecks(preview, site)];
  const fmtShift = ([t, st]) => { const T = tplOf(t); const e = endOf(st, T.base); return `${st} – ${e.time}${e.nextDay ? ' (overnight)' : ''}`; };
  const openDay = (g, r, c) => { if (wk < 0) { toast('Past weeks are read-only. Timesheets has what was worked.'); return; } if (fixedMode && OFF_RULES.days.includes(c)) { toast(`${FULL_DAYS[c]} is the weekly off for everyone · change it in Settings → Attendance rules`); return; } { const cell = G(g).cells[r][c]; const ls = Array.isArray(cell) ? cell : []; const last = ls.reduce((m, x) => Math.max(m, toMin(x[1]) + tplOf(x[0]).base * 60), -1);
    // Suggest a start: an hour after their last shift that day, otherwise their usual start.
    const st = last >= 0 ? hm(Math.min(last + 60, 23 * 60)) : (usual(G(g).cells[r])[0] || [null, '07:00'])[1];
    setDay({ g, r, c }); setAdd({ ...add, t: last >= 0 ? 'f7' : add.t, st, site: g === 'pool' ? (shown[0] || SITES[0]).id : g }); } };
  const locsIn = (c, home) => (Array.isArray(c) ? [...new Set(c.map((x) => x[2] || home))] : []);
  const match = (w) => (!q || w.name.toLowerCase().includes(q.toLowerCase())) && (ven === 'all' || w.vendor === ven);
  const shown = SITES.filter((s) => mgr === 'all' || MANAGERS.find((m) => m.id === mgr).sites.includes(s.id));
  // The floaters band: floaters in this manager's pool, plus anyone from the pool covering at these locations this week.
  const PG = groups.find((g) => g.float);
  const poolRows = PG ? PG.people.map((id, r) => ({ w: W(id), r })).filter(({ w }) => match(w) && isFloat(w)) : [];
  // People from other locations who have at least one shift here this week.
  const visitorsOf = (sid) => {
    const out = [];
    groups.forEach((g) => { if (g.site === sid) return; g.cells.forEach((row, r) => {
      if (g.float && !isFloat(W(g.people[r]))) return;
      const days = row.map((c) => (Array.isArray(c) ? c.filter((x) => x[2] === sid && !x[3]) : []));
      if (days.some((d) => d.length)) out.push({ g: g.site, r, w: W(g.people[r]), days });
    }); });
    return out;
  };
  // Attendance for days already gone: clocked in (green) or missed (red).
  const missed = (sid, wid, ci) => (sid.charCodeAt(1) * 7 + parseInt(wid.slice(1), 10) * 3 + ci * 5 + (wk + 1) * 11) % 7 === 0;
  const pastCls = (sid, wid, ci, here) => (ci < nowIdx && here.length ? (missed(sid, wid, ci) ? ' past-miss' : ' past-ok') : '');
  const pastTitle = (sid, wid, ci, here) => (ci < nowIdx && here.length ? (missed(sid, wid, ci) ? 'Missed: no clock-in' : 'Clocked in') : undefined);
  const segCls = (sid, wid, ci, k) => (ci < nowIdx ? (missed(sid, wid, ci + k * 3) ? ' past-miss' : ' past-ok') : '');
  const segTitle = (sid, wid, ci, k) => (ci < nowIdx ? (missed(sid, wid, ci + k * 3) ? 'Missed: no clock-in' : 'Clocked in') : undefined);
  // Two or more shifts in a day: the cell splits into side-by-side segments, one per shift, same height as a single shift.
  const split = (list, sid, wid, ci, onOpen, label) => (
    <div className="cell-split">{[...list].sort((a, b) => toMin(a[1]) - toMin(b[1])).map((x, k) => (
      <button key={k} className={'cell one seg' + segCls(sid, wid, ci, k)} title={segTitle(sid, wid, ci, k)} onClick={onOpen} aria-label={`${label}, shift ${k + 1} of ${list.length}`}>{chip(x, k, sid)}</button>
    ))}</div>
  );
  const chip = ([t, st, s2, x4], k, home) => {
    const away = s2 && s2 !== home;
    const night = endOf(st, tplOf(t).base).nextDay;
    return <span key={k} className={'shiftchip' + (away ? ' away' : '')} title={away ? `At ${siteOf(s2).name}` : undefined}>{night && <span className="sc-moon filled" title="Overnight: ends after midnight" aria-label="Overnight shift"><Icon name="moon" size={12} /></span>}<span className="sc-time mono" title={tplLabel(tplOf(t))}><span>{st}</span><span className="sc-to">to</span><span>{endOf(st, tplOf(t).base).time}</span></span>{away && <span className="sc-loc"><Icon name="pin" size={10} />{siteOf(s2).name.replace(/^(Spinneys|Carrefour) /, '')}</span>}</span>;
  };
  return (
    <>
      <ScreenHeader title="Roster" phase={1} spec="5.4" desc="The week broken down by location. Click a day to assign shifts; a worker can get more than one shift a day." actions={<>
        <button className="btn ghost" onClick={() => setUp({ step: 'pick' })}><Icon name="upload" size={15} /> Upload roster</button>
        <button className="btn ghost" onClick={() => toast('Exported the roster for these locations (XLSX and PDF)')}>Export</button>
        <button className="btn ghost" onClick={() => go('settings')}>Shifts and rules</button>
      </>} />
      <div className="toolbar">
        <select id="sch-mgr" className="input" value={mgr} onChange={(e) => setMgr(e.target.value)} aria-label="Manager">
          <option value="all">All managers</option>{MANAGERS.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.sites.length} locations</option>)}
        </select>
        <select id="sch-ven" className="input" value={ven} onChange={(e) => setVen(e.target.value)} aria-label="Vendor">
          <option value="all">All vendors</option>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <input id="sch-q" className="input" placeholder="Find a worker" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="weekbar">
        <div className="wk-nav">
          <button className="btn ghost sm icon" disabled={wk <= -1} onClick={() => setWk(wk - 1)} aria-label="Previous week">‹</button>
          <div className="wk-label"><b>{weekLabel(wk)}</b><span className="small muted">{wk === 0 ? 'This week' : wk === 1 ? 'Next week' : 'Last week'}</span></div>
          <button className="btn ghost sm icon" disabled={wk >= 1} onClick={() => setWk(wk + 1)} aria-label="Next week">›</button>
          {wk !== 0 && <button className="btn ghost sm" onClick={() => setWk(0)}>This week</button>}
          {pub[wk] === 'draft' ? <Pill tone="warn">Draft · not visible to workers</Pill> : dirty[wk] ? <Pill tone="info">{dirty[wk]} unpublished {dirty[wk] === 1 ? 'change' : 'changes'}</Pill> : <Pill tone="good">Published</Pill>}
        </div>
        <div className="wk-actions">
          {wk >= 1 && <button className="btn ghost sm" onClick={copyPrev}>Copy from {weekLabel(wk - 1, true)}</button>}
          {wk >= 0 && <button className="btn sm" onClick={() => setPubOpen(true)}>Publish…</button>}
          {wk < 0 && <span className="small muted">Past weeks are read-only</span>}
        </div>
      </div>
      {narrow ? <div className="dayview">
        <div className="dv-step">
          <button className="btn ghost sm icon" disabled={dIdx <= 0} onClick={() => setDIdx(dIdx - 1)} aria-label="Previous day">‹</button>
          <div className="dv-day"><b>{days[dIdx]}</b>{wk === 0 && dIdx === TODAY && <span className="today-tag">Today</span>}</div>
          <button className="btn ghost sm icon" disabled={dIdx >= 6} onClick={() => setDIdx(dIdx + 1)} aria-label="Next day">›</button>
        </div>
        {shown.map((s) => {
          const g = G(s.id);
          const rows = g.people.map((id, r) => ({ w: W(id), r, c: g.cells[r][dIdx], g: s.id })).filter((x) => match(x.w));
          const vis = visitorsOf(s.id).filter((v) => match(v.w) && v.days[dIdx].length).map((v) => ({ w: v.w, r: v.r, c: v.days[dIdx], g: v.g, visiting: true }));
          const all = [...rows, ...vis];
          if (!all.length) return null;
          const on = all.filter((x) => Array.isArray(x.c) && x.c.some((y) => !y[2] || y[2] === s.id)).length;
          return (
            <section key={s.id} className="card flush dv-loc">
              <div className="dv-head"><b>{s.name}</b></div>
              {all.map((x) => {
                const here = Array.isArray(x.c) ? x.c.filter((y) => !y[2] || y[2] === s.id).sort((a, b2) => toMin(a[1]) - toMin(b2[1])) : [];
                const elsewhere = Array.isArray(x.c) && !here.length;
                return (
                  <button key={x.w.id + (x.visiting ? 'v' : '')} className="dv-row" onClick={() => openDay(x.g, x.r, dIdx)}>
                    <span className="dv-who"><span className="namerow"><b>{x.w.name}</b>{pub[wk] === 'published' && wk >= 0 && UNACK.includes(x.w.id) && <span className="unack"><Icon name="alert" size={12} /></span>}</span><span className="small muted"><span className="vtag">{vendorOf(x.w.vendor).code}</span> {x.w.role}</span></span>
                    <span className="dv-what">
                      {here.map((y, k) => <span key={k} className={'dv-shift' + segCls(s.id, x.w.id, dIdx, k)}><span className="mono">{y[1]}–{endOf(y[1], tplOf(y[0]).base).time}</span>{endOf(y[1], tplOf(y[0]).base).nextDay && <span className="sc-moon filled"><Icon name="moon" size={11} /></span>}</span>)}
                      {x.c === 'O' && <span className="dv-tag">Weekly off</span>}
                      {x.c === 'L' && <span className="dv-tag">Annual leave{covBy(x.w.id, dIdx) ? ` · covered by ${first(covBy(x.w.id, dIdx).w.name)}` : ''}</span>}
                      {x.c === 'X' && <span className="dv-tag faint">Not rostered</span>}
                      {elsewhere && <span className="dv-tag">Elsewhere</span>}
                    </span>
                  </button>
                );
              })}
            </section>
          );
        })}
        {poolRows.length > 0 && <section className="card flush dv-loc">
          <div className="dv-head"><b>Floaters</b></div>
          {poolRows.map(({ w, r }) => { const c = PG.cells[r][dIdx]; return (
            <button key={w.id} className="dv-row" onClick={() => openDay('pool', r, dIdx)}>
              <span className="dv-who"><b>{w.name}</b><span className="small muted"><span className="vtag">{vendorOf(w.vendor).code}</span> {w.role}</span></span>
              <span className="dv-what">
                {Array.isArray(c) && c.map((y, k) => <span key={k} className={'dv-shift' + segCls('pool', w.id, dIdx, k)}><span className="mono">{y[1]}–{endOf(y[1], tplOf(y[0]).base).time}</span><span className="small muted"> {siteOf(y[2]).name.replace(/^(Spinneys|Carrefour) /, '')}</span></span>)}
                {c === 'A' && <span className="dv-tag faint">Available</span>}
                {c === 'O' && <span className="dv-tag">Weekly off</span>}
              </span>
            </button>
          ); })}
        </section>}
      </div> :
      <section className="card flush roster-card">
        <div className="table-wrap roster-wrap">
          <table className="roster">
            <thead><tr><th>Worker</th>{days.map((d, i) => <th key={d} className={(wk === 0 && i === TODAY ? 'today' : '') + (fixedMode && OFF_RULES.days.includes(i) ? ' closed' : '')}>{d}{wk === 0 && i === TODAY && <span className="today-tag">Today</span>}{fixedMode && OFF_RULES.days.includes(i) && <span className="off-tag">Weekly off</span>}</th>)}</tr></thead>
            {shown.map((s, si) => {
              const g = G(s.id);
              const rows = g.people.map((id, r) => ({ w: W(id), r })).filter((x) => match(x.w));
              const vis = visitorsOf(s.id).filter((v) => match(v.w));
              if ((q || ven !== 'all') && !rows.length && !vis.length) return null;
              const hrs = g.cells.flat().reduce((a, c) => a + (Array.isArray(c) ? c.filter((x) => !x[2] || x[2] === s.id).reduce((b, [t]) => b + tplOf(t).base, 0) : 0), 0)
                + vis.reduce((a, v) => a + v.days.flat().reduce((b, [t]) => b + tplOf(t).base, 0), 0);
              const isCol = collapsed[s.id] && !q && ven === 'all';
              return (
                <tbody key={s.id} className="rgroup">
                  <tr className="rg-head">
                    <td className="rg-name" style={{ zIndex: 11 + si * 2 }}><button className="rg-toggle" onClick={() => setCollapsed({ ...collapsed, [s.id]: !collapsed[s.id] })} aria-expanded={!isCol}>
                      <span className={'rg-caret' + (isCol ? ' col' : '')}>▾</span><b>{s.name}</b><span className="muted small">{MANAGERS.find((m) => m.sites.includes(s.id)).name}{isCol ? ` · ${g.people.length} ${g.people.length === 1 ? 'employee' : 'employees'}` : ''}</span>
                    </button></td>
                    {days.map((d, ci) => { const offs = g.people.filter((id, r) => g.cells[r][ci] === 'O').length; const over = !fixedMode && offs > OFF_RULES.sameDay; if (fixedMode && OFF_RULES.days.includes(ci)) return <td key={ci} className={'rg-rest rg-day' + (wk === 0 && ci === TODAY ? ' today' : '')} style={{ zIndex: 10 + si * 2 }}><span className="rg-off">Everyone off</span></td>; return (
                      <td key={ci} className={'rg-rest rg-day' + (wk === 0 && ci === TODAY ? ' today' : '')} style={{ zIndex: 10 + si * 2 }}>
                        {offs > 0 && <span className={'rg-off' + (over ? ' over' : '')} title={over ? `${offs} people off on the same day here; the limit is ${OFF_RULES.sameDay}` : `${offs} on weekly off`}>{over && <Icon name="alert" size={11} />}{offs} off</span>}
                      </td>
                    ); })}
                  </tr>
                  {!isCol && rows.map(({ w, r }) => (
                    <tr key={w.id}>
                      <td><div className="namerow"><button className="namelink" onClick={() => go('workforce', { worker: w.id })}>{w.name}</button>{pub[wk] === 'published' && wk >= 0 && UNACK.includes(w.id) && <span className="unack" title="Hasn't acknowledged this week's roster in the app" aria-label="Roster not acknowledged"><Icon name="alert" size={13} /></span>}</div><div className="small muted"><span className="vtag">{vendorOf(w.vendor).code}</span> {w.role}{(() => { const row = g.cells[r]; const worked = row.filter((c) => Array.isArray(c)).length; return worked > 7 - offPerWeek() ? <span className="off-warn" title={`Rostered ${worked} days this week; the organisation requires ${OFF_RULES.perWeek} off a week. This week can't be published until it's fixed.`}><Icon name="alert" size={11} /> No weekly off</span> : null; })()}</div></td>
                      {g.cells[r].map((c, ci) => {
                        const here = Array.isArray(c) ? c.filter((x) => !x[2] || x[2] === s.id) : [];
                        const away = Array.isArray(c) && here.length === 0;
                        return (
                          <td key={ci} className={wk === 0 && ci === TODAY ? 'today' : ''}>
                            {here.length > 1 ? split(here, s.id, w.id, ci, () => openDay(s.id, r, ci), `${w.name} ${days[ci]}`) :
                            <button className={'cell ' + (Array.isArray(c) ? (away ? 'elsewhere' : 'one') + pastCls(s.id, w.id, ci, here) : c)} title={pastTitle(s.id, w.id, ci, here)} onClick={() => openDay(s.id, r, ci)} aria-label={`${w.name} ${days[ci]}`}>
                              {c === 'O' && <span className="cell-main">Weekly off</span>}
                              {c === 'L' && (() => { const cv = covBy(w.id, ci); return <><span className="cell-main">Annual leave</span>{cv ? <span className="cell-sub cov">Covered by {first(cv.w.name)}</span> : <span className={'cell-sub' + (ci >= nowIdx ? ' uncov' : '')}>{ci >= nowIdx ? 'Not covered' : 'Approved'}</span>}</>; })()}
                              {c === 'X' && <span className="cell-main">Not rostered</span>}
                              {away && <span className="cell-sub">Elsewhere</span>}
                              {here.length > 0 && here.map((x, k) => chip(x, k, s.id))}
                            </button>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {!isCol && vis.map((v) => (
                    <tr key={'v' + v.w.id} className="visitor">
                      <td><button className="namelink" onClick={() => go('workforce', { worker: v.w.id })}>{v.w.name}</button><div className="small muted"><span className="vtag">{vendorOf(v.w.vendor).code}</span> {v.w.role}</div></td>
                      {v.days.map((d, ci) => (
                        <td key={ci} className={wk === 0 && ci === TODAY ? 'today' : ''}>{d.length > 1 ? split(d, s.id, v.w.id, ci, () => openDay(v.g, v.r, ci), `${v.w.name} ${days[ci]}`) : d.length ? <button className={'cell one' + pastCls(s.id, v.w.id, ci, d)} title={pastTitle(s.id, v.w.id, ci, d)} onClick={() => openDay(v.g, v.r, ci)} aria-label={`${v.w.name} ${days[ci]} at ${s.name}`}>{d.map((x, k) => chip(x, k, s.id))}</button> : <span className="cell vis-empty" />}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              );
            })}
            {poolRows.length > 0 && (() => { const isCol = collapsed.pool && !q && ven === 'all'; const zi = shown.length; return (
              <tbody className="rgroup pool">
                <tr className="rg-head">
                  <td className="rg-name" style={{ zIndex: 11 + zi * 2 }}><button className="rg-toggle" onClick={() => setCollapsed({ ...collapsed, pool: !collapsed.pool })} aria-expanded={!isCol}>
                    <span className={'rg-caret' + (isCol ? ' col' : '')}>▾</span><b>Floaters</b>{isCol && <span className="muted small">{poolRows.length} {poolRows.length === 1 ? 'employee' : 'employees'}</span>}
                  </button></td>
                  {days.map((d, ci) => { const offs = poolRows.filter(({ r }) => PG.cells[r][ci] === 'O').length; return <td key={ci} className={'rg-rest rg-day' + (wk === 0 && ci === TODAY ? ' today' : '')} style={{ zIndex: 10 + zi * 2 }}>{offs > 0 && <span className="rg-off">{offs} off</span>}</td>; })}
                </tr>
                {!isCol && poolRows.map(({ w, r }) => (
                  <tr key={w.id}>
                    <td><div className="namerow"><button className="namelink" onClick={() => go('workforce', { worker: w.id })}>{w.name}</button></div><div className="small muted"><span className="vtag">{vendorOf(w.vendor).code}</span> {w.role}</div></td>
                    {PG.cells[r].map((c, ci) => (
                      <td key={ci} className={wk === 0 && ci === TODAY ? 'today' : ''}>
                        {Array.isArray(c) && c.length > 1 ? split(c, 'pool', w.id, ci, () => openDay('pool', r, ci), `${w.name} ${days[ci]}`) :
                        <button className={'cell ' + (Array.isArray(c) ? 'one' + pastCls('pool', w.id, ci, c) : c)} title={pastTitle('pool', w.id, ci, Array.isArray(c) ? c : [])} onClick={() => openDay('pool', r, ci)} aria-label={`${w.name} ${days[ci]}`}>
                          {c === 'A' && <span className="cell-main">Available</span>}
                          {c === 'O' && <span className="cell-main">Weekly off</span>}
                          {c === 'L' && <span className="cell-main">Annual leave</span>}
                          {c === 'X' && <span className="cell-main">Not rostered</span>}
                          {Array.isArray(c) && c.map((x, k) => chip(x, k, 'pool'))}
                        </button>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ); })()}
          </table>
        </div>
      </section>}
      <Drawer open={pubOpen} onClose={() => setPubOpen(false)} title={`Publish ${weekLabel(wk)}`} sub={pub[wk] === 'draft' ? 'First publish · workers can\'t see this week yet' : dirty[wk] ? `${dirty[wk]} ${dirty[wk] === 1 ? 'change' : 'changes'} since the last publish` : 'Already published · no changes since'}>
        {pubOpen && (() => {
          const scope = shown.map((s) => G(s.id));
          const cells = scope.flatMap((g) => g.cells.flat());
          const shifts = cells.reduce((a, c) => a + (Array.isArray(c) ? c.length : 0), 0);
          const people = scope.reduce((a, g) => a + g.people.length, 0);
          const hours = cells.reduce((a, c) => a + shiftHours(c), 0);
          const nothing = pub[wk] === 'published' && !dirty[wk];
          const errs = offErrors(scope.concat(groups.filter((g) => g.float)));
          return <>
            <div className="pub-stats">
              <div><span className="stat-value">{people}</span><span className="small muted">workers</span></div>
              <div><span className="stat-value">{shifts}</span><span className="small muted">shifts</span></div>
              <div><span className="stat-value">{hours}</span><span className="small muted">base hours</span></div>
            </div>
            <div className="small muted">Covers {shown.map((s) => s.name).join(', ')}{ven !== 'all' ? '' : ''}.</div>
            {errs.length > 0 && <div className="up-block"><b>Can't publish yet</b><div className="small">{errs.length === 1 ? 'One worker breaks' : `${errs.length} workers break`} the organisation's weekly off rule this week.</div>
              {errs.map((x) => <div key={x.wid} className="row-line"><Pill tone="crit">{x.closed.length ? 'Works on the off day' : 'No weekly off'}</Pill><span className="small">{W(x.wid).name}, {x.g.float ? 'Floaters' : siteOf(x.g.site).name}: {errText(x)}</span></div>)}</div>}
            <h3 className="pub-h">Before you publish</h3>
            <div className="row-line"><Pill tone="warn">Rest period</Pill><span className="small">Bilal Ahmed: 9 h between Thu evening and Fri morning (minimum 10 h)</span></div>
            <div className="row-line"><Pill tone="info">Two locations</Pill><span className="small">Rajesh Kumar, Mon: Barsha Heights then Marina Promenade, 7 h gap, 25 min travel</span></div>
            <div className="row-line"><Pill tone="crit">Document</Pill><span className="small">Chinedu Okafor's visa expires before Sat 10</span></div>
            <h3 className="pub-h">Workers</h3>
            <Toggle id="pub-notify" checked={pubOpt.notify} onChange={(v) => setPubOpt({ ...pubOpt, notify: v })} label={pub[wk] === 'draft' ? `Notify all ${people} workers in the app` : 'Notify only workers whose shifts changed'} />
            <Toggle id="pub-ack" checked={pubOpt.ack} onChange={(v) => setPubOpt({ ...pubOpt, ack: v })} label="Ask workers to acknowledge their week" />
            <div className="drawer-actions">
              <button className="btn ghost" onClick={() => setPubOpen(false)}>Cancel</button>
              <span className="grow" />
              <button className="btn" disabled={nothing || errs.length > 0} onClick={publish}>{errs.length ? 'Fix weekly offs first' : nothing ? 'Nothing to publish' : pub[wk] === 'draft' ? `Publish to ${people} workers` : 'Publish changes'}</button>
            </div>
          </>;
        })()}
      </Drawer>
      <Drawer open={!!up} onClose={() => setUp(null)} title="Upload a roster" sub={`For ${weekLabel(1)} · next week`}>
        {up && up.step === 'pick' && <>
          <ol className="up-steps small">
            <li>Download the template: one row per worker, one column per day. Put a start time and shift length, <span className="mono">OFF</span>, or <span className="mono">LEAVE</span> in each day.</li>
            <li>Upload it back. Every row is checked before anything is imported.</li>
          </ol>
          <div className="up-rule"><Icon name="alert" size={14} /><span className="small">{fixedMode ? `${OFF_RULES.days.map((d) => FULL_DAYS[d]).join(' and ')} ${OFF_RULES.days.length === 1 ? 'is' : 'are'} off for everyone. A file with any shift on ${OFF_RULES.days.length === 1 ? 'that day' : 'those days'} is rejected as a whole.` : `Every worker needs at least ${OFF_RULES.perWeek} weekly off. A file where anyone works all seven days is rejected as a whole.`}</span></div>
          <div className="drawer-actions">
            <button className="btn ghost" onClick={() => toast('Template downloaded (XLSX) · pre-filled with this week')}>Download template</button>
            <span className="grow" />
            <button className="btn" onClick={() => setUp({ step: 'report', file: 'roster-12-18-oct.xlsx', data: badUpload(weeks[0]) })}>Choose file…</button>
          </div>
        </>}
        {up && up.step === 'report' && (() => {
          const errs = offErrors(up.data); const warns = offClashes(up.data); const rows = up.data.reduce((a, g) => a + g.people.length, 0);
          return <>
            <div className="up-file"><Icon name="upload" size={15} /><b>{up.file}</b><span className="small muted">{rows} rows checked</span></div>
            {errs.length ? <div className="up-block">
              <b>Not imported</b>
              <div className="small">{errs.length === 1 ? '1 row breaks' : `${errs.length} rows break`} the weekly off rule. Fix {errs.length === 1 ? 'it' : 'them'} in the file and upload again; nothing was changed.</div>
              {errs.slice(0, 6).map((x) => <div key={x.wid} className="row-line"><Pill tone="crit">{x.closed.length ? 'Works on the off day' : 'No weekly off'}</Pill><span className="small"><b>{W(x.wid).name}</b> ({W(x.wid).code}), {x.g.float ? 'Floaters' : siteOf(x.g.site).name}: {errText(x)}</span></div>)}
              {errs.length > 6 && <div className="small muted">and {errs.length - 6} more in the error report</div>}
            </div> : <div className="up-ok"><b>Ready to import</b><div className="small">All {rows} rows keep the weekly off{fixedMode ? ` on ${OFF_RULES.days.map((d) => FULL_DAYS[d]).join(' and ')}` : ''}.</div></div>}
            {warns.length > 0 && <>
              <h3 className="pub-h">Worth a look</h3>
              {warns.map((x) => <div key={x.site + x.ci} className="row-line"><Pill tone="warn">{x.n} off</Pill><span className="small">{siteOf(x.site).name}, {weekDays(1)[x.ci]}: more than {OFF_RULES.sameDay} off on the same day</span></div>)}
              <div className="small muted">Warnings don't stop the import.</div>
            </>}
            <div className="drawer-actions">
              <button className="btn ghost" onClick={() => setUp({ step: 'pick' })}>Back</button>
              <span className="grow" />
              {errs.length ? <button className="btn" onClick={() => setUp({ step: 'report', file: 'roster-12-18-oct (fixed).xlsx', data: fixedOff(shiftWeek(weeks[0], 1, false)) })}>Upload corrected file…</button>
                : <button className="btn" onClick={() => { setWeeks((Wk) => ({ ...Wk, 1: up.data })); setPub((x) => ({ ...x, 1: 'draft' })); setDirty((d) => ({ ...d, 1: 0 })); setWk(1); setUp(null); toast(`Imported ${rows} rows into ${weekLabel(1)} as a draft · review, then publish`); }}>Import as draft</button>}
            </div>
          </>;
        })()}
      </Drawer>
      <Drawer open={!!day} onClose={() => setDay(null)} title={day && `${W(G(day.g).people[day.r]).name} · ${days[day.c]}`} sub={day && (list.length ? `${list.length} ${list.length === 1 ? 'shift' : 'shifts'} · ${shiftHours(cur)} h${shiftOt(cur) ? ` + ${shiftOt(cur)} h optional` : ''} · ${locsIn(cur, site).map((x) => siteOf(x).name).join(', ')}` : cur === 'L' ? 'Annual leave' : cur === 'O' ? 'Weekly off' : cur === 'A' ? 'Available to cover · not paid' : 'Not rostered')}>
        {day && <>
          <div className="small muted">{isPool ? `Floater · lives in ${dayWorker.homeArea} · no fixed location` : `Works from ${siteOf(site).name}`}</div>
          {cur === 'L' && (() => { const cv = covBy(dayWorker.id, day.c); const sh0 = usual(G(day.g).cells[day.r])[0]; return (
            <section className={'cv-status' + (cv ? ' ok' : '')}>
              {cv ? <>
                <div><b>Covered by {cv.w.name}</b><div className="small muted"><span className="vtag">{vendorOf(cv.w.vendor).code}</span> {isFloat(cv.w) ? `Floater · ${cv.w.homeArea}` : siteOf(cv.g).name} · {cv.sh[1]} to {endOf(cv.sh[1], tplOf(cv.sh[0]).base).time}</div></div>
                {day.c >= nowIdx && <button className="btn sm ghost" onClick={() => { setCell(cv.g, cv.r, day.c, undoCell(G(cv.g).cells[cv.r][day.c], dayWorker.id)); toast(`Cover removed · ${first(cv.w.name)} notified`); }}>Remove cover</button>}
              </> : <>
                <div><b>{day.c >= nowIdx ? 'Not covered yet' : 'Was not covered'}</b><div className="small muted">Usual shift {sh0[1]} to {endOf(sh0[1], tplOf(sh0[0]).base).time} · {tplLabel(tplOf(sh0[0]))}</div></div>
                {day.c >= nowIdx && <button className="btn sm" onClick={() => findCover(dayWorker.id, day.g, day.c, G(day.g).cells[day.r])}>Find cover</button>}
              </>}
            </section>
          ); })()}
          {list.length > 0 && <DayTimeline list={list} home={site} />}
          {list.length === 0 && cur !== 'L' && <p className="muted">{isPool ? 'Available. Assign a cover from the absent worker\'s day, or add a shift below.' : 'Nothing planned. Add one or more shifts below.'}</p>}
          {[...list].sort((a, b) => toMin(a[1]) - toMin(b[1])).map((x) => (
            <div key={x.join()} className="dayshift">
              <span className={'locbar' + (x[2] && x[2] !== site ? ' away' : '')} />
              <div><b className="mono">{fmtShift(x)}</b><div className="small muted">{siteOf(x[2] || site).name} · {tplLabel(tplOf(x[0]))}{x[3] ? ` · covering ${W(x[3]).name}` : ''}</div></div>
              <button className="btn sm ghost" onClick={() => { const nl = list.filter((y) => y !== x); setCell(day.g, day.r, day.c, nl.length ? nl : x[3] ? (x[4] || 'A') : isPool ? 'A' : 'X'); toast(x[3] ? `Cover removed · ${first(W(x[3]).name)}'s day is uncovered again` : 'Shift removed'); }}>Remove</button>
            </div>
          ))}
          {cur !== 'L' && <section className="addshift">
            <h3>{list.length ? 'Add another shift' : 'Add a shift'}</h3>
            <div className="form-grid">
              <Field label="Shift"><select id="as-t" className="input" value={add.t} onChange={(e) => setAdd({ ...add, t: e.target.value })}>{SHIFT_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{tplLabel(t)}</option>)}</select></Field>
              <Field label="Starts" hint={`Ends ${endOf(add.st, tplOf(add.t).base).time}${endOf(add.st, tplOf(add.t).base).nextDay ? ', after midnight' : ''}`}><input id="as-st" type="time" className="input mono" value={add.st} onChange={(e) => setAdd({ ...add, st: e.target.value || add.st })} /></Field>
              <Field label="Location"><select id="as-site" className="input" value={add.site} onChange={(e) => setAdd({ ...add, site: e.target.value })}>{SITES.map((x) => <option key={x.id} value={x.id}>{x.name}{x.id === site ? ' (their location)' : ''}</option>)}</select></Field>
            </div>
            <DayTimeline list={preview.map(norm)} home={site} />
            {checks.map(([tone, tag, msg], k) => <div key={k} className="row-line"><Pill tone={tone}>{tag}</Pill><span className="small">{msg}</span></div>)}
            <button className="btn" disabled={checks.some(([t]) => t === 'crit')} onClick={() => { setCell(day.g, day.r, day.c, preview.map(norm)); toast(add.site !== site ? `Shift added · also shows under ${siteOf(add.site).name}` : 'Shift added · add another if needed'); }}>Add shift</button>
          </section>}
          <Note>Each shift has its own clock-in and clock-out at its own location, and attendance is judged per shift. A shift at another location also appears under that location's roster.</Note>
        </>}
      </Drawer>
      <CoverDrawer open={!!cover} onClose={() => setCover(null)} onAssign={assign}
        ctx={cover && { site: cover.site, ci: cover.ci, absent: cover.absent, sh: cover.sh, dayLabel: days[cover.ci], groups, why: 'Annual leave' }} />
    </>
  );
}

/* ---------------- Timesheets ---------------- */
export function Timesheets() {
  const [sel, setSel] = useState(null);
  const [approved, setApproved] = useState({});
  const toast = useToast();
  const rows = WORKERS.slice(0, 10).map((w, i) => ({ w, full: 20 - (i % 3), half: i % 4 === 0 ? 1 : 0, abs: i % 5 === 1 ? 1 : 0, hrs: (20 - (i % 3)) * 11 + (i % 4 === 0 ? 5.5 : 0), ot: [2, 0, 4.5, 0, 1, 0, 0, 3, 0, 0][i], confirmed: i % 3 !== 2 }));
  return (
    <>
      <ScreenHeader title="Timesheets" phase={1} spec="5.5" desc="Computed from punches by each location's policy. Review exceptions, approve, and the period locks." actions={
        <button className="btn" onClick={() => { const a = {}; rows.forEach((r) => (a[r.w.id] = true)); setApproved(a); toast('Approved all timesheets for the period'); }}>Approve all</button>
      } />
      <div className="toolbar"><select id="ts-period" className="input"><option>1 – 31 Oct 2026 (in progress)</option><option>1 – 30 Sep 2026 (locked)</option></select><span className="small muted">Policy: Deliveroo dark store · per-day classification</span></div>
      <section className="card flush">
        <div className="table-wrap">
          <table className="table hover">
            <thead><tr><th>Worker</th><th className="num">Full</th><th className="num">Half</th><th className="num">Absent</th><th className="num">Worked h</th><th className="num">OT h</th><th>Exceptions</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.w.id} onClick={() => setSel(r)} tabIndex={0}>
                  <td><b>{r.w.name}</b><div className="small muted"><span className="vtag">{vendorOf(r.w.vendor).code}</span> {siteOf(r.w.site).name}</div></td>
                  <td className="num mono">{r.full}</td><td className="num mono">{r.half}</td><td className="num mono">{r.abs}</td>
                  <td className="num mono">{r.hrs.toFixed(1)}</td><td className="num mono">{r.ot}</td>
                  <td>{r.confirmed ? <span className="muted">—</span> : <Pill tone="warn">1 correction</Pill>}</td>
                  <td>{approved[r.w.id] ? <Pill tone="good">Approved</Pill> : <Pill tone="info">Open</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.w.name} sub="Tue 6 Oct · Carrefour Barsha Heights · 07:00 11+1 hr">
        {sel && <>
          <table className="table">
            <thead><tr><th>Event</th><th>Captured</th><th>Corrected</th><th>Check</th></tr></thead>
            <tbody>
              <tr><td>Clock in</td><td className="mono">06:58</td><td className="muted">—</td><td><Pill tone="good">42 m · face 0.91</Pill></td></tr>
              <tr><td>Break start</td><td className="mono">12:02</td><td className="muted">—</td><td><Pill tone="good">In geofence</Pill></td></tr>
              <tr><td>Break end</td><td className="mono">13:01</td><td className="muted">—</td><td><Pill tone="good">59 min unpaid</Pill></td></tr>
              <tr><td>Clock out</td><td className="mono">19:00 (auto)</td><td className="mono">19:06</td><td><Pill tone="warn">Corrected by ops</Pill></td></tr>
            </tbody>
          </table>
          <Note>Correction by Amina (Ops) · reason "Phone died; supervisor confirmed exit at 19:06". The captured value is kept beside the correction.</Note>
          <dl className="kv"><dt>Worked</dt><dd className="mono">11 h 08 m → Full day</dd><dt>Rounding</dt><dd>Nearest 5 min</dd><dt>Overtime</dt><dd className="mono">0 (daily threshold 11 h + 15 min)</dd></dl>
          <div className="feed-actions"><button className="btn sm" onClick={() => toast('Correction saved with reason')}>Add correction</button></div>
        </>}
      </Drawer>
    </>
  );
}

/* ---------------- Alerts ---------------- */
export function Alerts() {
  const [type, setType] = useState('All');
  const [items, setItems] = useState(ALERTS);
  const [sel, setSel] = useState(null);
  const toast = useToast();
  const types = ['All', 'No-show', 'Late', 'Face mismatch', 'Outside geofence', 'Break overrun', 'Missing clock-out', 'Document expiry'];
  const rows = items.filter((a) => type === 'All' || a.type === type);
  const resolve = (outcome) => { setItems((xs) => xs.map((a) => (a.id === sel.id ? { ...a, open: false, outcome } : a))); toast(`Marked ${outcome.toLowerCase()}`); setSel(null); };
  return (
    <>
      <ScreenHeader title="Notifications" phase={1} spec="5.6" desc="Things that need a look: no-shows, late starts, face mismatches, missing clock-outs, expiring documents. Each review outcome feeds the worker's score: false alarms and excused cases never count." />
      <div className="nt-tiles" role="tablist" aria-label="Filter by type">{types.map((t) => { const all = t === 'All' ? items : items.filter((a) => a.type === t); const open = all.filter((a) => a.open).length; const sev = all.some((a) => a.open && a.sev === 'critical') ? 'crit' : all.some((a) => a.open && a.sev === 'warning') ? 'warn' : ''; return (
        <button key={t} role="tab" aria-selected={type === t} className={'nt-tile' + (type === t ? ' on' : '') + (sev ? ' ' + sev : '')} onClick={() => setType(t)}>
          <span className="nt-n">{open}</span><span className="nt-l">{{ All: 'All open', 'Outside geofence': 'Off-site punch', 'Missing clock-out': 'No clock-out', 'Document expiry': 'Documents' }[t] || t}</span><span className="nt-s small">{all.length - open ? `${all.length - open} reviewed` : 'Open'}</span>
        </button>
      ); })}</div>
      <section className="card flush">
        <ul className="alert-list">
          {rows.map((a) => {
            const w = WORKERS.find((x) => x.id === a.worker);
            return (
              <li key={a.id} className={'alert-row sev-' + a.sev} onClick={() => setSel(a)} tabIndex={0}>
                <div><b>{a.type}</b> <span className="muted small">· {w.name} · {siteOf(a.site).name} · {vendorOf(w.vendor).code}</span><div className="small">{a.detail}</div></div>
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

/* ---------------- Leave ---------------- */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtD = (iso) => { const d = new Date(iso + 'T00:00:00'); return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtRange = (a, b) => (a === b ? fmtD(a) : `${fmtD(a)} – ${fmtD(b)}`);
const LEAVE_TYPES = [
  { id: 'lt1', name: 'Annual', paid: true, perYear: 30, carry: 10, maxReq: null, cert: null, track: true, note: 'After the first year' },
  { id: 'lt2', name: 'Sick', paid: true, perYear: null, carry: 0, maxReq: null, cert: 1, track: false, note: '' },
  { id: 'lt3', name: 'Emergency', paid: true, perYear: null, carry: 0, maxReq: 3, cert: null, track: false, note: '' },
  { id: 'lt4', name: 'Unpaid', paid: false, perYear: null, carry: 0, maxReq: null, cert: null, track: false, note: 'Not billed by the vendor' },
];
// UAE federal public holidays, 2026. Islamic holidays follow the moon and are confirmed by the government shortly before.
const UAE_HOL = [
  { name: "New Year's Day", from: '2026-01-01' },
  { name: 'Eid Al Fitr', from: '2026-03-20', to: '2026-03-22', moon: true },
  { name: 'Arafat Day', from: '2026-05-26', moon: true },
  { name: 'Eid Al Adha', from: '2026-05-27', to: '2026-05-29', moon: true },
  { name: 'Hijri New Year', from: '2026-06-16', moon: true },
  { name: "Prophet Muhammad's Birthday", from: '2026-08-25', moon: true },
  { name: 'UAE National Day', from: '2026-12-02', to: '2026-12-03' },
];
const ltRule = (t) => [t.carry ? `${t.carry} days carry over` : null, t.maxReq ? `Up to ${t.maxReq} days per request` : null, t.cert ? `Certificate after ${t.cert} ${t.cert === 1 ? 'day' : 'days'}` : null, t.note || null].filter(Boolean).join(' · ') || 'No limits';
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
      <ScreenHeader title="Leave" phase={1} spec="5.8" desc="Requests come from the worker app. Approving clears their shifts on those days and never counts as absence. The vendor is told, not asked." />
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
                  <div className="ap-now">{shift ? shift.map(([t, st, s2], k) => <div key={k}><span className="mono">{st}–{endOf(st, tplOf(t).base).time}</span> <span className="small muted">{siteOf(s2 || groupOf(l.worker).site).name}</span></div>) : <span className="small muted">{c === 'O' ? 'Weekly off · nothing to change' : c === 'L' ? 'Already on leave' : 'Not rostered · nothing to change'}</span>}</div>
                  {shift && <select className="input sm ap-pick" value={appr.plan[iso]} onChange={(e) => setAppr({ ...appr, plan: { ...appr.plan, [iso]: e.target.value } })} aria-label={`Cover for ${fmtD(iso)}`}>
                    <option value="none">Leave uncovered</option>
                    {candsOn(l, iso, shift[0]).slice(0, 8).map((x) => <option key={x.w.id} value={x.w.id}>{x.w.name} ({x.fl ? 'floater' : x.c === 'O' ? 'weekly off' : 'free'}, {x.km} km)</option>)}
                  </select>}
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

/* ---------------- Performance ---------------- */
const fmtM = (m, v) => (m.step < 1 ? (+v).toFixed(m.step < 0.5 ? 1 : 1) : Math.round(v)) + m.unit;
const fails = (m, v, th) => (m.dir === 'higher' ? v < th : v > th);

function StripPlot({ m, th, values }) {
  const W = 280, H = 78, padX = 8, base = 58;
  const span = m.max - m.min;
  const discrete = m.step >= 1 && span / m.step <= 20;
  const bins = discrete ? Math.round(span / m.step) + 1 : 18;
  const binOf = (v) => discrete ? Math.min(bins - 1, Math.max(0, Math.round((v - m.min) / m.step))) : Math.min(bins - 1, Math.max(0, Math.floor(((v - m.min) / span) * bins)));
  const cols = Array.from({ length: bins }, () => []);
  [...values].sort((a, b) => a[1] - b[1]).forEach(([id, v]) => cols[binOf(v)].push([id, v]));
  const cw = (W - 2 * padX) / bins;
  const maxCount = Math.max(1, ...cols.map((c) => c.length));
  let r = 3.1, d = 7, perRow = 1;
  for (let k = 0; k < 8; k++) {
    const maxRows = Math.max(1, Math.floor((base - 4) / d));
    perRow = Math.max(1, Math.ceil(maxCount / maxRows));
    if (perRow * d <= cw - 1) break;
    r *= 0.85; d *= 0.85;
  }
  const cx0 = (bi) => padX + cw * bi + cw / 2;
  const dotX = (bi, k) => { const n = Math.min(perRow, cols[bi].length); const col = k % perRow; return cx0(bi) + (col - (n - 1) / 2) * d; };
  const dotY = (k) => base - 3 - Math.floor(k / perRow) * d;
  const x = (v) => discrete ? cx0(Math.round((Math.min(m.max, Math.max(m.min, v)) - m.min) / m.step)) : padX + ((Math.min(m.max, Math.max(m.min, v)) - m.min) / span) * (W - 2 * padX);
  const tx = discrete ? x(th) + (m.dir === 'higher' ? -cw / 2 : cw / 2) : x(th);
  const fmt = (v) => fmtM(m, v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="strip" aria-label={`${m.name}: distribution of ${values.length} workers, threshold ${fmt(th)}`}>
      <rect x={m.dir === 'higher' ? padX : tx} y="2" width={Math.max(0, m.dir === 'higher' ? tx - padX : W - padX - tx)} height={base - 1} className="strip-zone" rx="4" />
      <line x1={padX} x2={W - padX} y1={base + 1} y2={base + 1} className="strip-axis" />
      {cols.map((c, bi) => c.map(([id, v], k) => {
        const w = WORKERS.find((q) => q.id === id);
        return <circle key={id} cx={dotX(bi, k)} cy={dotY(k)} r={r} className={fails(m, v, th) ? 'strip-dot bad' : 'strip-dot'}><title>{`${w.name}: ${fmt(v)}`}</title></circle>;
      }))}
      <line x1={tx} x2={tx} y1="0" y2={base + 4} className="strip-th" />
      <text x={discrete ? x(m.min) : padX} y={H - 4} textAnchor={discrete ? "middle" : "start"} className="strip-tick">{fmt(m.min)}</text>
      <text x={discrete ? x(m.max) : W - padX} y={H - 4} textAnchor={discrete ? "middle" : "end"} className="strip-tick">{fmt(m.max)}</text>
      <text x={Math.min(W - 30, Math.max(30, discrete ? x(th) : tx))} y={H - 4} textAnchor="middle" className="strip-thlabel">{fmt(th)}</text>
    </svg>
  );
}

export function Performance() {
  const [tab, setTab] = useState('th');
  const [th, setTh] = useState(Object.fromEntries(METRICS.map((m) => [m.id, m.def])));
  const [sel, setSel] = useState('att');
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState('all');
  const [open, setOpen] = useState(null);
  const [weights, setWeights] = useState(Object.fromEntries(METRICS.map((m) => [m.id, m.weight])));
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const vals = (id) => WORKERS.map((w) => [w.id, WORKER_METRICS[w.id][id]]);
  const flaggedOn = (w) => METRICS.filter((m) => fails(m, WORKER_METRICS[w.id][m.id], th[m.id]));
  const anyFlag = WORKERS.filter((w) => flaggedOn(w).length > 0).length;
  const multi = WORKERS.filter((w) => flaggedOn(w).length > 1).length;
  const m = METRICS.find((x) => x.id === sel);
  const rows = WORKERS
    .filter((w) => showAll || fails(m, WORKER_METRICS[w.id][m.id], th[m.id]))
    .filter((w) => (vendor === 'all' || w.vendor === vendor) && (w.name + w.code).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (m.dir === 'higher' ? 1 : -1) * (WORKER_METRICS[a.id][m.id] - WORKER_METRICS[b.id][m.id]));
  const word = (mm) => (mm.dir === 'higher' ? 'below' : 'above');
  return (
    <>
      <ScreenHeader title="Performance" phase={2} spec="8" desc="Set the line for each metric and see how many workers fall short. Pick a metric to list them." />
      <Tabs tabs={[{ id: 'th', label: 'Thresholds' }, { id: 'w', label: 'Score weights' }]} value={tab} onChange={setTab} />
      {tab === 'th' && <>
        <div className="stats">
          <Stat label="Workers tracked" value={WORKERS.length} sub="Deliveroo pickers · October" />
          <Stat label="Flagged on any metric" value={anyFlag} sub={`${Math.round((anyFlag / WORKERS.length) * 100)}% of workers`} tone="warn" />
          <Stat label="Flagged on 2 or more" value={multi} sub="Worth a conversation" tone="crit" />
        </div>
        <div className="metric-grid">
          {METRICS.map((mm) => {
            const n = WORKERS.filter((w) => fails(mm, WORKER_METRICS[w.id][mm.id], th[mm.id])).length;
            return (
              <section key={mm.id} className={'card metric' + (sel === mm.id ? ' on' : '')} onClick={() => { setSel(mm.id); setShowAll(false); }}>
                <div className="metric-top">
                  <div><b>{mm.name}</b><div className="small muted">{mm.src}</div></div>
                  <div className={'metric-count' + (n ? ' bad' : '')}><span className="mono">{n}</span><small>{n === 1 ? 'worker' : 'workers'}</small></div>
                </div>
                <StripPlot m={mm} th={th[mm.id]} values={vals(mm.id)} />
                <label className="metric-slider" onClick={(e) => e.stopPropagation()}>
                  <span className="small">Flag {word(mm)} <b className="mono">{fmtM(mm, th[mm.id])}</b></span>
                  <input id={'th-' + mm.id} type="range" min={mm.min} max={mm.max} step={mm.step} value={th[mm.id]} onChange={(e) => { setTh({ ...th, [mm.id]: +e.target.value }); setSel(mm.id); }} aria-label={`${mm.name} threshold`} />
                </label>
              </section>
            );
          })}
        </div>
        <section className="card flush">
          <div className="list-head">
            <div><h3>{showAll ? `All workers by ${m.name.toLowerCase()}` : `${rows.length} ${rows.length === 1 ? 'worker' : 'workers'} ${word(m)} ${fmtM(m, th[m.id])} on ${m.name.toLowerCase()}`}</h3><div className="small muted">Worst first · {m.desc}</div></div>
            <div className="toolbar">
              <input id="pf-q" className="input sm" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
              <select id="pf-v" className="input sm" value={vendor} onChange={(e) => setVendor(e.target.value)}><option value="all">All vendors</option>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
              <div className="seg"><button className={!showAll ? 'on' : ''} onClick={() => setShowAll(false)}>Flagged</button><button className={showAll ? 'on' : ''} onClick={() => setShowAll(true)}>Everyone</button></div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table hover">
              <thead><tr><th>Worker</th><th>Vendor</th><th>Location</th><th className="num">{m.name}</th><th>Gap to line</th><th>Also flagged on</th></tr></thead>
              <tbody>
                {rows.map((w) => {
                  const v = WORKER_METRICS[w.id][m.id];
                  const bad = fails(m, v, th[m.id]);
                  const gap = m.dir === 'higher' ? v - th[m.id] : th[m.id] - v;
                  const others = flaggedOn(w).filter((x) => x.id !== m.id);
                  return (
                    <tr key={w.id} onClick={() => setOpen(w)} tabIndex={0}>
                      <td><div className="who"><Avatar name={w.name} /><div><b>{w.name}</b><div className="small muted mono">{w.code}</div></div></div></td>
                      <td><span className="vtag">{vendorOf(w.vendor).code}</span></td>
                      <td>{siteOf(w.site).name}</td>
                      <td className={'num mono ' + (bad ? 'neg' : '')}><b>{fmtM(m, v)}</b></td>
                      <td style={{ minWidth: 120 }}><div className={'gap ' + (bad ? 'bad' : 'ok')}><span style={{ width: Math.min(100, (Math.abs(gap) / ((m.max - m.min) / 3)) * 100) + '%' }} /></div><span className="small muted mono">{gap >= 0 ? '+' : '−'}{fmtM(m, Math.abs(gap))}</span></td>
                      <td>{others.length ? <div className="chips">{others.map((o) => <span key={o.id} className="chip warnchip">{o.name}</span>)}</div> : <span className="muted">—</span>}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan="6" className="muted" style={{ textAlign: 'center', padding: 24 }}>Nobody falls {word(m)} this line. Move the slider to tighten it.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>}
      {tab === 'w' && <div className="grid-2">
        <section className="card">
          <div className="card-head"><h3>Score weights · Deliveroo pickers</h3><span className={'mono small ' + (total === 100 ? 'ok' : 'bad')}>{total}%</span></div>
          {METRICS.map((k) => (
            <div key={k.id} className="weight">
              <div className="feed-top"><span>{k.name}</span><span className="mono small">{weights[k.id]}%</span></div>
              <input id={'w-' + k.id} type="range" min="0" max="50" value={weights[k.id]} onChange={(e) => setWeights({ ...weights, [k.id]: +e.target.value })} aria-label={k.name + ' weight'} />
            </div>
          ))}
          {total !== 100 && <Note>Weights must add up to 100% before saving.</Note>}
        </section>
        <section className="card"><div className="card-head"><h3>Vendors compared</h3><span className="small muted">Only you see this</span></div>
          {VENDORS.map((v) => <div key={v.id} className="kpi-row"><span><span className="vtag">{v.code}</span> {v.name}</span><span className="mono small">{v.score}</span><Bar value={v.score} /></div>)}
          <Note>Excused absences, approved leave and false-alarm alerts never count against anyone.</Note>
        </section>
      </div>}
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.name} sub={open && `${open.code} · ${vendorOf(open.vendor).name} · ${siteOf(open.site).name}`}>
        {open && <table className="table"><thead><tr><th>Metric</th><th className="num">Value</th><th className="num">Line</th><th></th></tr></thead><tbody>
          {METRICS.map((mm) => { const v = WORKER_METRICS[open.id][mm.id]; const b = fails(mm, v, th[mm.id]); return <tr key={mm.id}><td>{mm.name}</td><td className={'num mono ' + (b ? 'neg' : '')}>{fmtM(mm, v)}</td><td className="num mono muted">{word(mm)} {fmtM(mm, th[mm.id])}</td><td>{b ? <Pill tone="crit">Flagged</Pill> : <Pill tone="good">OK</Pill>}</td></tr>; })}
        </tbody></table>}
      </Drawer>
    </>
  );
}

/* ---------------- Vendor costs ---------------- */
export function Finance({ go }) {
  const [tab, setTab] = useState('close');
  const toast = useToast();
  const gross = FIN_VENDORS.reduce((a, v) => a + v.buy, 0);
  const pen = FIN_VENDORS.reduce((a, v) => a + v.penalty, 0);
  const net = FIN_VENDORS.reduce((a, v) => a + v.net, 0);
  return (
    <>
      <ScreenHeader title="Vendor costs" phase={2} spec="9" desc="What you owe each vendor, priced from approved timesheets and each vendor's rate card." />
      <Tabs tabs={[{ id: 'close', label: 'Period close' }, { id: 'rates', label: 'Rate cards' }, { id: 'sites', label: 'Cost by location' }]} value={tab} onChange={setTab} />
      {tab === 'close' && <>
        <div className="stats">
          <Stat label="Gross payable" value={aed(gross)} sub="September 2026, ex-VAT" />
          <Stat label="No-show deductions" value={aed(pen)} sub="Per vendor contract" />
          <Stat label="Net payable" value={aed(net)} sub="+2.1% on August" tone="good" />
          <Stat label="Exceptions" value="2" sub="Fix before issuing" tone="warn" />
        </div>
        <section className="card flush">
          <div className="card-head pad"><h3>Vendor statements</h3></div>
          <div className="table-wrap"><table className="table"><thead><tr><th>Vendor</th><th className="num">Heads</th><th className="num">Basis</th><th className="num">Gross</th><th className="num">Deductions</th><th className="num">Net</th><th>Status</th></tr></thead>
            <tbody>{FIN_VENDORS.map((v, i) => <tr key={v.v}><td><span className="vtag">{vendorOf(v.v).code}</span> {vendorOf(v.v).name}</td><td className="num mono">{v.heads}</td><td className="num mono small">{v.days ? v.days + ' days' : v.hours.toLocaleString() + ' h'}</td><td className="num mono">{aed(v.buy)}</td><td className="num mono neg">{v.penalty ? aed(v.penalty) : '—'}</td><td className="num mono"><b>{aed(v.net)}</b></td><td>{i === 3 ? <Pill tone="good">Issued</Pill> : <Pill tone="info">Draft</Pill>}</td></tr>)}</tbody></table></div>
        </section>
        <section className="card">
          <div className="card-head"><h3>Exceptions</h3></div>
          <div className="row-line"><Pill tone="crit">Missing rate</Pill><span className="small">6 shifts · Shift lead from Falcon Crew has no rate card</span><button className="btn sm ghost" onClick={() => setTab('rates')}>Add rate</button></div>
          <div className="row-line"><Pill tone="warn">Overtime</Pill><span className="small">Carrefour Barsha Heights: overtime is 14% of its cost, about twice the other locations</span><button className="btn sm ghost" onClick={() => setTab('sites')}>See locations</button></div>
          <div className="small muted">Issuing statements closes the month: every worker's timesheet for the period locks.</div>
          <div className="feed-actions"><button className="btn" onClick={() => toast('Statements issued · September timesheets locked')}>Issue statements</button></div>
        </section>
      </>}
      {tab === 'rates' && <section className="card flush"><div className="table-wrap"><table className="table"><thead><tr><th>Vendor</th><th>Role</th><th className="num">Rate</th><th>Overtime</th><th>Proration</th></tr></thead>
        <tbody>{RATE_CARDS.map((r, i) => <tr key={i}><td><span className="vtag">{vendorOf(r.vendor).code}</span> {vendorOf(r.vendor).name}</td><td>{r.role}</td><td className="num mono">{r.unit === 'hour' ? `AED ${r.rate}/h` : aed(r.rate) + ' / ' + r.unit}</td><td>{r.ot}</td><td className="small">{r.basis}</td></tr>)}</tbody></table></div>
        <div className="pad"><Note>Each vendor charges its own way: monthly per head, daily or hourly. Optional overtime hours (the "+1") are paid at the overtime rate only when worked. Rates are dated, so a mid-month change splits the period.</Note></div></section>}
      {tab === 'sites' && (() => { const rows = [...COST_BY_SITE].sort((a, b) => b.cost - a.cost); const T = rows.reduce((a, c) => ({ days: a.days + c.days, cost: a.cost + c.cost, otc: a.otc + c.cost * c.ot, cover: a.cover + c.cover }), { days: 0, cost: 0, otc: 0, cover: 0 }); const avgDay = T.cost / T.days; return (
        <section className="card flush">
          <div className="card-head pad"><h3>September 2026</h3><span className="small muted">Vendor charges, split by where each shift was worked</span></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Location</th><th className="num">Days worked</th><th className="num">Cost</th><th className="num">Cost per day</th><th className="num">Overtime</th><th className="num">Cover days</th></tr></thead>
            <tbody>{rows.map((c) => { const pd = c.cost / c.days; return (
              <tr key={c.site} className="rowlink" tabIndex={0} title={`Show who works at ${siteOf(c.site).name}`} onClick={() => go('workforce', { site: c.site })} onKeyDown={(e) => e.key === 'Enter' && go('workforce', { site: c.site })}>
                <td>{siteOf(c.site).name}</td>
                <td className="num mono">{c.days}</td>
                <td className="num mono">{aed(c.cost)}</td>
                <td className={'num mono' + (pd > avgDay * 1.05 ? ' neg' : '')}>{aed(Math.round(pd))}</td>
                <td className={'num mono' + (c.ot >= 0.1 ? ' neg' : '')}>{Math.round(c.ot * 100)}%</td>
                <td className="num mono">{c.cover}</td>
              </tr>
            ); })}
              <tr className="tot"><td><b>All locations</b></td><td className="num mono"><b>{T.days.toLocaleString()}</b></td><td className="num mono"><b>{aed(T.cost)}</b></td><td className="num mono"><b>{aed(Math.round(avgDay))}</b></td><td className="num mono"><b>{Math.round((T.otc / T.cost) * 100)}%</b></td><td className="num mono"><b>{T.cover}</b></td></tr>
            </tbody>
          </table></div>
          <div className="pad small muted">Overtime is the share of cost paid at the overtime rate. Cover days are days worked by someone covering for an absent worker. Red marks cost per day 5% above average, or overtime at 10% or more.</div>
        </section>
      ); })()}
    </>
  );
}

/* ---------------- Communication ---------------- */
export function Communication() {
  const [tab, setTab] = useState('ann');
  const toast = useToast();
  return (
    <>
      <ScreenHeader title="Announcements" phase={2} spec="5.11" desc="Posts to workers with read receipts and, when needed, a required acknowledgement." actions={<button className="btn" onClick={() => toast('New announcement draft')}>New announcement</button>} />
      {tab === 'ann' && <section className="card">{ANNOUNCEMENTS.map((a) => (
        <div key={a.id} className="ann">
          <div><b>{a.title}</b><div className="small muted">{a.to} · sent {a.sent} {a.ack && '· acknowledgement required'}</div></div>
          <div className="ann-read"><span className="mono small">{a.read}/{a.total} read</span><Bar value={a.read} max={a.total} /></div>
        </div>
      ))}</section>}

    </>
  );
}

/* ---------------- Settings ---------------- */
export function Settings({ params }) {
  const [tab, setTab] = useState(params?.tab || 'templates');
  const [lts, setLts] = useState(LEAVE_TYPES);
  const [desig, setDesig] = useState([
    { name: 'Picker', role: 'Employee', n: WORKERS.filter((w) => w.role === 'Picker').length },
    { name: 'Reliever', role: 'Floater', n: WORKERS.filter((w) => w.role === 'Reliever').length },
    { name: 'Shift lead', role: 'Employee', n: WORKERS.filter((w) => w.role === 'Shift lead').length },
    { name: 'Supervisor', role: 'Manager', n: 8 },
    { name: 'Senior Supervisor', role: 'Admin', n: 3 },
    { name: 'Operations Manager', role: 'Admin', n: 1 },
  ]);
  const [led, setLed] = useState(null);
  const [role, setRole] = useState('Employee');
  const BASE_R = { grace: 10, noshow: 60, early: 15, rounding: '5', full: 'base2', half: 'half', breaks: true, brkMin: 60, brkPaid: 'unpaid', auto: true, autoMin: 30 };
  const [pr, setPr] = useState({ Employee: BASE_R, Floater: { ...BASE_R, early: 90, noshow: 30, coverEarly: 90, coverLate: 240 }, Manager: { ...BASE_R, track: true, grace: 15, breaks: false } });
  const rp = pr[role];
  const setR = (k, v) => setPr({ ...pr, [role]: { ...pr[role], [k]: v } });
  const [p, setP] = useState({ grace: 10, noshow: 60, early: 15, rounding: '5', full: 'base2', half: 'half', breaks: true, brkMin: 60, brkPaid: 'unpaid', auto: true, autoMin: 30, beyond: 'approval', hol: true, maxOff: 2, holCal: 'uae', offs: OFF_RULES.perWeek, sameDay: OFF_RULES.sameDay, offWork: 'ot', maxRun: OFF_RULES.maxRun, offMode: OFF_RULES.mode, offDays: OFF_RULES.days });
  const [tpl, setTpl] = useState(SHIFT_TEMPLATES);
  const toast = useToast();
  const set = (k, v) => setP({ ...p, [k]: v });
  const [ed, setEd] = useState(null); // { id|null, start, base, ot, step, from, notify }
  const edOrig = ed && ed.id ? tpl.find((x) => x.id === ed.id) : null;
  const edChanged = ed && (!edOrig || edOrig.base !== ed.base || edOrig.ot !== ed.ot);
  const openEd = (t) => (setAffQ(''), setEd)(t ? { id: t.id, base: t.base, ot: t.ot, step: 'edit', from: 'next', notify: true } : { id: null, base: 9, ot: 0, step: 'edit', from: 'next', notify: true });
  const clashes = (() => {
    if (!ed || !ed.id) return [];
    const m = (x) => { const [h, mm] = x.split(':').map(Number); return h * 60 + mm; };
    const out = [];
    ROSTER.forEach((row, r) => row.forEach((cell, c) => {
      if (!Array.isArray(cell) || !cell.some((x) => x[0] === ed.id) || cell.length < 2) return;
      const iv = cell.map((x) => x[0] === ed.id ? [m(x[1]), m(x[1]) + ed.base * 60] : [m(x[1]), m(x[1]) + tplOf(x[0]).base * 60]).sort((a, b) => a[0] - b[0]);
      if (iv.some((v, i) => i && v[0] < iv[i - 1][1])) out.push({ wid: WORKERS[r].id, name: WORKERS[r].name, day: DAYS[c] });
    }));
    return out;
  })();
  // Who is on a shift this week: real roster rows first, then the rest of the workforce to match the count.
  const affected = (() => {
    if (!edOrig || !edOrig.used) return [];
    const rows = [];
    ROSTER.forEach((row, r) => {
      const days = []; let loc = null;
      row.forEach((cell, c) => { if (Array.isArray(cell)) cell.forEach((x) => { if (x[0] === edOrig.id) { days.push(c); loc = loc || x[2] || 's3'; } }); });
      if (days.length) rows.push({ w: WORKERS[r], days, site: loc });
    });
    const seed = edOrig.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    for (let k = 0; rows.length < edOrig.used && k < 32; k++) {
      const w = WORKERS[8 + ((seed + k * 5) % 32)];
      if (rows.some((x) => x.w.id === w.id)) continue;
      const off = (seed + k) % 7;
      rows.push({ w, days: [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== off && d !== (off + 3) % 7 || (k % 3 === 0 && d === (off + 3) % 7)), site: w.site });
    }
    return rows.map((x) => ({ ...x, clash: clashes.filter((c) => c.wid === x.w.id).map((c) => c.day) }));
  })();
  const [affQ, setAffQ] = useState('');
  const renderAffected = ({ withClash }) => {
    const list = affected.filter((x) => !affQ || x.w.name.toLowerCase().includes(affQ.toLowerCase())).sort((a, b) => (withClash ? b.clash.length - a.clash.length : 0));
    return (
      <section className="afflist">
        <div className="afflist-head"><h3>{withClash ? 'Affected employees' : 'On this shift this week'} <span className="muted">({affected.length})</span></h3>
          {affected.length > 6 && <input id="aff-q" className="input sm" placeholder="Search" value={affQ} onChange={(e) => setAffQ(e.target.value)} />}</div>
        <div className="afflist-body">{list.map((x) => (
          <div key={x.w.id} className={'affrow' + (withClash && x.clash.length ? ' clash' : '')}>
            <Avatar name={x.w.name} />
            <div className="aff-who"><b>{x.w.name}</b><span className="small muted"><span className="vtag">{vendorOf(x.w.vendor).code}</span> {siteOf(x.site).name} · {x.w.role}</span>
              {withClash && x.clash.length > 0 && <span className="small neg">Overlaps another shift on {x.clash.join(', ')}</span>}</div>
            <div className="aff-days">{DAYS.map((d, i) => <span key={d} className={'affday' + (x.days.includes(i) ? ' on' : '') + (withClash && x.clash.includes(d) ? ' bad' : '')} title={d}>{d[0]}</span>)}</div>
          </div>
        ))}{list.length === 0 && <div className="small muted pad">No one matches.</div>}</div>
      </section>
    );
  };
  const applyEd = () => {
    if (ed.id) { setTpl(tpl.map((t) => (t.id === ed.id ? { ...t, start: ed.start, base: ed.base, ot: ed.ot } : t))); toast(edOrig.used ? `Shift updated for ${edOrig.used} ${edOrig.used === 1 ? 'employee' : 'employees'}${ed.notify ? ' · they have been notified' : ''}` : 'Shift updated'); }
    else { setTpl([...tpl, { id: 'f' + Date.now(), start: ed.start, base: ed.base, ot: ed.ot, used: 0 }]); toast('Shift added · assign it on the roster'); }
    setEd(null);
  };
    return (
    <>
      <ScreenHeader title="Settings" phase={1} spec="5.10" desc="Everything that used to be hardcoded lives here: shifts, attendance rules, leave types and roles." actions={<button className="btn" onClick={() => toast('Saved · applies from the next shift')}>Save</button>} />
      <Tabs tabs={[{ id: 'templates', label: 'Shifts' }, { id: 'policy', label: 'Attendance rules' }, { id: 'leave', label: 'Leave types' }, { id: 'roles', label: 'Roles & access' }]} value={tab} onChange={setTab} />
      {tab === 'templates' && <>
        <section className="card flush">
          <div className="card-head pad"><h3>Shifts</h3><span className="small muted">A shift is a length. The start time is picked on the roster, so one shift works for mornings, evenings and nights.</span></div>
          <div className="table-wrap"><table className="table tpl">
            <thead><tr><th>Shift</th><th>Base hours</th><th>Overtime</th><th>Assigned this week</th><th></th></tr></thead>
            <tbody>{[...tpl].sort((x, y) => y.base - x.base || y.ot - x.ot).map((t) => { return (
              <tr key={t.id} className="rowlink" onClick={() => openEd(t)} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && openEd(t)}>
                <td><span className="tpl-chip mono">{tplLabel(t)}</span></td>
                <td className="mono">{t.base} h</td>
                <td className="mono">{t.ot ? t.ot + ' h' : <span className="muted">—</span>}</td>
                <td>{t.used ? <span>{t.used} {t.used === 1 ? 'employee' : 'employees'}</span> : <span className="muted">Nobody</span>}</td>
                <td className="num"><span className="rowedit">Edit</span></td>
              </tr>
            ); })}</tbody>
          </table></div>
          <div className="pad"><button className="btn ghost sm" onClick={() => openEd(null)}>Add shift</button></div>
        </section>
        <Drawer open={!!ed} onClose={() => setEd(null)} title={ed && ed.id ? 'Edit shift' : 'New shift'} sub={ed && tplLabel(ed)}>
          {ed && ed.step === 'edit' && <>
            <div className="form-grid">

              <Field label="Base hours"><div className="unit-in"><input id="ed-base" className="input mono" type="number" min="1" max="16" value={ed.base} onChange={(e) => setEd({ ...ed, base: +e.target.value })} /><span>h</span></div></Field>
              <Field label="Overtime" hint="Optional hours after the base. 0 for none."><div className="unit-in"><input id="ed-ot" className="input mono" type="number" min="0" max="4" value={ed.ot} onChange={(e) => setEd({ ...ed, ot: +e.target.value })} /><span>h</span></div></Field>
            </div>
            {edOrig && (edOrig.used ? renderAffected({}) : <div className="small muted">Nobody is on this shift this week.</div>)}
            <div className="drawer-actions">
              {edOrig && edOrig.used === 0 && <button className="btn ghost danger" onClick={() => { setTpl(tpl.filter((x) => x.id !== ed.id)); setEd(null); toast('Shift removed'); }}>Remove shift</button>}
              <span className="grow" />
              <button className="btn ghost" onClick={() => setEd(null)}>Cancel</button>
              <button className="btn" disabled={!edChanged || ed.base < 1} onClick={() => (edOrig && edOrig.used ? setEd({ ...ed, step: 'confirm' }) : applyEd())}>Confirm</button>
            </div>
          </>}
          {ed && ed.step === 'confirm' && edOrig && <>
            <section className="impact">
              <div className="impact-num">{edOrig.used}</div>
              <div><b>{edOrig.used === 1 ? 'employee is' : 'employees are'} on this shift this week</b><div className="small muted">Their start times stay the same; end times, attendance rules and overtime follow the new length.</div></div>
            </section>
            <table className="table diff"><thead><tr><th></th><th>Now</th><th>After</th></tr></thead><tbody>
              {[['Base hours', edOrig.base + ' h', ed.base + ' h'], ['Overtime', edOrig.ot + ' h', ed.ot + ' h'], ['A 07:00 start ends', endOf('07:00', edOrig.base).time, endOf('07:00', ed.base).time]].map(([k, a, b]) => <tr key={k} className={a !== b ? 'changed' : ''}><td>{k}</td><td className="mono">{a}</td><td className="mono"><b>{b}</b></td></tr>)}
            </tbody></table>
            {clashes.length > 0 && <div className="row-line"><Pill tone="crit">{clashes.length} {clashes.length === 1 ? 'overlap' : 'overlaps'}</Pill><span className="small">The new length makes a shift overlap another one for the people marked below. Fix them on the roster after applying.</span></div>}
            {renderAffected({ withClash: true })}
            <Field label="Apply from"><select id="ed-from" className="input" value={ed.from} onChange={(e) => setEd({ ...ed, from: e.target.value })}><option value="next">Next week (Mon 12 Oct), this week stays as it is</option><option value="tomorrow">Tomorrow (Thu 8 Oct), including the rest of this week</option></select></Field>
            <Toggle id="ed-notify" checked={ed.notify} onChange={(v) => setEd({ ...ed, notify: v })} label={`Notify the ${edOrig.used} affected ${edOrig.used === 1 ? 'employee' : 'employees'} in the app`} />
            <div className="drawer-actions">
              <button className="btn ghost" onClick={() => setEd({ ...ed, step: 'edit' })}>Back</button>
              <span className="grow" />
              <button className="btn" onClick={applyEd}>Apply to {edOrig.used} {edOrig.used === 1 ? 'employee' : 'employees'}</button>
            </div>
          </>}
        </Drawer>
        <Note>"+1" is one hour of optional overtime after the base hours. A worker can leave at the end of the base hours with a full shift; if they stay, the extra time is overtime. On the roster you pick a shift and a start time; the end is worked out from the length, including shifts that finish after midnight.</Note>
      </>}
      {tab === 'policy' && <>
        <div className="role-bar">
          <span className="small muted">Rules for</span>
          <div className="seg" role="tablist" aria-label="Access level">{['Employee', 'Floater', 'Manager'].map((r) => <button key={r} role="tab" aria-selected={role === r} className={'seg-btn' + (role === r ? ' on' : '')} onClick={() => setRole(r)}>{r}<span className="seg-n">{desig.filter((d) => d.role === r).reduce((a, d) => a + d.n, 0)}</span></button>)}</div>
          <span className="small muted">{desig.filter((d) => d.role === role).map((d) => d.name).join(', ') || 'No designations'}</span>
        </div>
        {role === 'Manager' && <section className="card form role-track">
          <Toggle id="pol-track" checked={rp.track} onChange={(v) => setR('track', v)} label="Managers clock in and out too" />
          <div className="small muted">{rp.track ? 'Their no-shows and late starts go to the admins, not to themselves.' : 'Managers are not tracked: no clock-in, no timesheet, no attendance alerts.'}</div>
        </section>}
        {(role !== 'Manager' || rp.track) && <div className="policy-grid">
          <section className="card form">
            <div className="card-head"><h3>Attendance</h3><Pill>{role}s</Pill></div>
            <div className="form-grid">
              <Field label="Grace period"><div className="unit-in"><input id="pol-grace" className="input" type="number" value={rp.grace} onChange={(e) => setR('grace', +e.target.value)} /><span>min</span></div></Field>
              <Field label="No-show after"><div className="unit-in"><input id="pol-noshow" className="input" type="number" value={rp.noshow} onChange={(e) => setR('noshow', +e.target.value)} /><span>min</span></div></Field>
{role !== 'Floater' &&               <Field label="Earliest clock-in"><div className="unit-in"><input id="pol-early" className="input" type="number" value={rp.early} onChange={(e) => setR('early', +e.target.value)} /><span>min before</span></div></Field>}
              <Field label="Rounding"><select id="pol-round" className="input" value={rp.rounding} onChange={(e) => setR('rounding', e.target.value)}><option value="0">None</option><option value="5">Nearest 5 min</option><option value="15">Nearest 15 min</option></select></Field>
            </div>
            <Field label="A shift counts as a full day when the worker works"><select id="pol-full" className="input" value={rp.full} onChange={(e) => setR('full', e.target.value)}>
              <option value="all">All of the base hours</option><option value="base1">All but 1 hour of the base hours</option><option value="base2">All but 2 hours of the base hours</option><option value="pct90">At least 90% of the base hours</option></select></Field>
            <Field label="It counts as a half day when the worker works"><select id="pol-half" className="input" value={rp.half} onChange={(e) => setR('half', e.target.value)}>
              <option value="half">At least half of the base hours</option><option value="4h">At least 4 hours</option><option value="none">No half days: less than a full day is absent</option></select></Field>
            <div className="small muted">Example for an 11+1 shift: full day from {{ all: '11 h', base1: '10 h', base2: '9 h', pct90: '9 h 54 m' }[rp.full]} worked{rp.half !== 'none' && `, half day from ${rp.half === 'half' ? '5 h 30 m' : '4 h'}`}. The optional hour never counts towards this.</div>
          </section>
          {role === 'Floater' && <section className="card form">
            <div className="card-head"><h3>Covering a shift</h3><Pill>Floaters</Pill></div>
            <div className="form-grid">
              <Field label="Clock-in opens"><div className="unit-in"><input id="pol-cin" className="input" type="number" value={rp.coverEarly} onChange={(e) => setR('coverEarly', +e.target.value)} /><span>min before</span></div></Field>
              <Field label="Clock-out allowed until"><div className="unit-in"><input id="pol-cout" className="input" type="number" value={rp.coverLate} onChange={(e) => setR('coverLate', +e.target.value)} /><span>min after</span></div></Field>
            </div>
            <div className="small muted">They clock in at the location they're covering, inside its geofence, and must clock out there too. Days without a cover aren't tracked and aren't paid.</div>
          </section>}
          <section className="card form">
            <div className="card-head"><h3>Weekly offs</h3><Pill>Whole organisation</Pill></div>
            <div className="seg off-mode" role="group" aria-label="How weekly offs are given">
              <button className={p.offMode === 'roster' ? 'on' : ''} onClick={() => { set('offMode', 'roster'); OFF_RULES.mode = 'roster'; }}><b>Staggered on the roster</b><span className="small muted">Each worker's off is picked every week, so someone is always on shift</span></button>
              <button className={p.offMode === 'fixed' ? 'on' : ''} onClick={() => { set('offMode', 'fixed'); OFF_RULES.mode = 'fixed'; }}><b>Same day for everyone</b><span className="small muted">The organisation doesn't work on these days, e.g. Sundays</span></button>
            </div>
            {p.offMode === 'fixed' ? <Field label="Weekly off" hint="Everyone is off on these days. A roster with any shift on them is rejected.">
              <div className="wk-pick" role="group" aria-label="Weekly off days">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, k) => { const on = p.offDays.includes(k); return (
                <button key={k} className={'wk-day' + (on ? ' on' : '')} aria-pressed={on} title={FULL_DAYS[k]} onClick={() => { const next = on ? p.offDays.filter((x) => x !== k) : [...p.offDays, k].sort(); if (!next.length) { toast('At least one weekly off is required'); return; } if (next.length > 3) return; set('offDays', next); OFF_RULES.days = next; }}>{d}</button>
              ); })}</div>
              <div className="small muted" style={{ marginTop: 6 }}>{p.offDays.map((k) => FULL_DAYS[k]).join(' and ')} off · {p.offDays.length} a week</div>
            </Field> : <div className="form-grid">
              <Field label="Weekly offs per worker" hint="At least 1. Enforced: rosters without it are rejected on upload and can't be published."><div className="unit-in"><input id="pol-offs" className="input" type="number" min="1" max="3" value={p.offs} onChange={(e) => { const v = Math.max(1, Math.min(3, +e.target.value || 1)); set('offs', v); OFF_RULES.perWeek = v; }} /><span>a week</span></div></Field>
              <Field label="Most people off at one location on the same day" hint="Keeps offs staggered so someone is always on shift. A warning only."><div className="unit-in"><input id="pol-sameday" className="input" type="number" min="1" max="9" value={p.sameDay} onChange={(e) => { set('sameDay', +e.target.value); OFF_RULES.sameDay = +e.target.value; }} /><span>people</span></div></Field>
            </div>}
            <div className="form-grid">
              <Field label="Most working days in a row"><div className="unit-in"><input id="pol-run" className="input" type="number" min="1" max="13" value={p.maxRun} onChange={(e) => { set('maxRun', +e.target.value); OFF_RULES.maxRun = +e.target.value; }} /><span>days</span></div></Field>
              <Field label="Working on a weekly off"><select id="pol-offwork" className="input" value={p.offWork} onChange={(e) => set('offWork', e.target.value)}><option value="ot">Allowed, paid at the rest-day rate</option><option value="swap">Allowed, with a replacement day off</option><option value="none">Not allowed</option></select></Field>
            </div>
            <div className="small muted">Set once for the organisation and applies to every role. A weekly off is never counted as absent.</div>
          </section>
          <section className="card form">
            <div className="card-head"><h3>Breaks</h3></div>
            <Toggle id="pol-brk" checked={rp.breaks} onChange={(v) => setR('breaks', v)} label="Workers take breaks during the shift" />
            {rp.breaks && <>
              <Field label="Break allowance per shift" hint="Workers can split it into as many breaks as they need, for prayer, food or a smoke."><div className="unit-in"><input id="pol-brkmin" className="input" type="number" value={rp.brkMin} onChange={(e) => setR('brkMin', +e.target.value)} /><span>min</span></div></Field>
              <Field label="Break time is"><select id="pol-brkpaid" className="input" value={rp.brkPaid} onChange={(e) => setR('brkPaid', e.target.value)}><option value="unpaid">Unpaid (taken off worked hours)</option><option value="paid">Paid</option></select></Field>
              <div className="small muted">Time past the allowance is flagged to the supervisor.</div>
            </>}
          </section>
          <section className="card form">
            <div className="card-head"><h3>Automatic clock-out</h3></div>
            <Toggle id="pol-auto" checked={rp.auto} onChange={(v) => setR('auto', v)} label="Clock workers out if they forget" />
            {rp.auto && <Field label="Clock out this long after the shift ends" hint="Counted from the end of the optional overtime hour, if the shift has one."><div className="unit-in"><input id="pol-automin" className="input" type="number" value={rp.autoMin} onChange={(e) => setR('autoMin', +e.target.value)} /><span>min</span></div></Field>}
          </section>
          <section className="card form span2">
            <div className="card-head"><h3>Overtime</h3><Pill>All roles</Pill></div>
            <div className="ot-explain">
              <div><span className="tpl-chip mono">11</span><b>Base hours</b><span className="small muted">The shift itself. Paid at the normal rate.</span></div>
              <div><span className="tpl-chip mono ot">+1</span><b>Optional overtime</b><span className="small muted">Planned on the shift. The worker may stay; no approval needed.</span></div>
              <div><span className="tpl-chip mono extra">beyond</span><b>Unplanned overtime</b><span className="small muted">Anything after the optional hour.</span></div>
            </div>
            <div className="form-grid">
              <Field label="Unplanned overtime"><select id="pol-beyond" className="input" value={p.beyond} onChange={(e) => set('beyond', e.target.value)}><option value="approval">Allowed if a supervisor approves it</option><option value="allow">Always allowed</option><option value="none">Not allowed: clock the worker out</option></select></Field>
              <Field label="Public holidays"><select id="pol-hol" className="input" value={p.hol ? 'y' : 'n'} onChange={(e) => set('hol', e.target.value === 'y')}><option value="y">Every hour counts as overtime</option><option value="n">Treated like any other day</option></select></Field>
            </div>
            <div className="small muted">How much overtime costs comes from each vendor's rate card, under Vendor costs.</div>
          </section>
        </div>}
      </>}
      {tab === 'leave' && <>
        <section className="card flush">
          <div className="card-head pad"><h3>Leave types</h3><span className="small muted">Workers pick from these in the app</span></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Type</th><th>Pay</th><th className="num">Days a year</th><th>Rules</th><th></th></tr></thead>
            <tbody>{lts.map((t) => (
              <tr key={t.id} className="rowlink" onClick={() => setLed({ ...t })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setLed({ ...t })}>
                <td><b>{t.name}</b></td><td>{t.paid ? 'Paid' : 'Unpaid'}</td><td className="num">{t.perYear ? <b className="lt-days">{t.perYear}</b> : <span className="muted small">No limit</span>}</td><td className="small">{ltRule(t)}</td>
                <td className="num"><span className="rowedit">Edit</span></td>
              </tr>
            ))}</tbody>
          </table></div>
          <div className="pad lv-foot"><button className="btn ghost sm" onClick={() => setLed({ id: null, name: '', paid: true, perYear: null, carry: 0, maxReq: null, cert: null, track: false, note: '' })}>Add leave type</button></div>
        </section>
        <section className="card form">
          <div className="card-head"><h3>Across all leave</h3></div>
          <div className="form-grid">
            <Field label="Most people off at one location on the same day"><div className="unit-in"><input id="lv-maxoff" className="input" type="number" min="1" value={p.maxOff} onChange={(e) => set('maxOff', +e.target.value)} /><span>people</span></div></Field>
            <Field label="Public holidays"><select id="lv-hol" className="input" value={p.holCal} onChange={(e) => set('holCal', e.target.value)}><option value="uae">UAE calendar</option><option value="none">None</option></select></Field>
          </div>
          {p.holCal === 'uae' && <div className="hol-list">
            <div className="hol-head small"><b>UAE public holidays 2026</b><span className="muted">{UAE_HOL.filter((h) => (h.to || h.from) >= '2026-10-07').length} still to come</span></div>
            {UAE_HOL.map((h) => { const past = (h.to || h.from) < '2026-10-07'; const n = h.to ? Math.round((new Date(h.to) - new Date(h.from)) / 864e5) + 1 : 1; return (
              <div key={h.name} className={'hol-row' + (past ? ' past' : '')}>
                <span className="hol-date">{fmtRange(h.from, h.to || h.from)}</span>
                <span><b>{h.name}</b>{h.moon && <span className="small muted"> · by moon sighting</span>}</span>
                <span className="small muted">{n} {n === 1 ? 'day' : 'days'}</span>
              </div>
            ); })}
            <div className="small muted">Hours worked on these days count as overtime. Dates by moon sighting update when the government confirms them.</div>
          </div>}
          <div className="small muted">Approved leave never counts as absence. Requests past the limit are flagged to the manager, not blocked.</div>
        </section>
        <Drawer open={!!led} onClose={() => setLed(null)} title={led && led.id ? `Edit ${led.name || 'leave type'}` : 'New leave type'}>
          {led && <>
            <div className="form-grid">
              <Field label="Name"><input id="lt-name" className="input" value={led.name} onChange={(e) => setLed({ ...led, name: e.target.value })} /></Field>
              <Field label="Pay"><select id="lt-paid" className="input" value={led.paid ? 'y' : 'n'} onChange={(e) => setLed({ ...led, paid: e.target.value === 'y' })}><option value="y">Paid</option><option value="n">Unpaid</option></select></Field>
              <Field label="Days a year" hint="Leave blank for no yearly limit."><div className="unit-in"><input id="lt-year" className="input" type="number" min="0" value={led.perYear ?? ''} onChange={(e) => setLed({ ...led, perYear: e.target.value === '' ? null : +e.target.value })} /><span>days</span></div></Field>
              <Field label="Carry over to next year"><div className="unit-in"><input id="lt-carry" className="input" type="number" min="0" value={led.carry} onChange={(e) => setLed({ ...led, carry: +e.target.value })} /><span>days</span></div></Field>
              <Field label="Most days per request" hint="Blank for no limit."><div className="unit-in"><input id="lt-max" className="input" type="number" min="0" value={led.maxReq ?? ''} onChange={(e) => setLed({ ...led, maxReq: e.target.value === '' ? null : +e.target.value })} /><span>days</span></div></Field>
              <Field label="Certificate needed after" hint="Blank if never."><div className="unit-in"><input id="lt-cert" className="input" type="number" min="0" value={led.cert ?? ''} onChange={(e) => setLed({ ...led, cert: e.target.value === '' ? null : +e.target.value })} /><span>days</span></div></Field>
            </div>
            <Toggle id="lt-track" checked={led.track} onChange={(v) => setLed({ ...led, track: v })} label="Track a balance for each worker" />
            <div className="small muted lt-trackhint">{led.track ? `Each worker gets ${led.perYear ?? 'their'} days a year. Requests count them down, and the worker sees what is left in the app. Managers see it when approving.` : 'No balance is kept. Requests are checked only against the rules above, such as the most days per request or a certificate.'}</div>
            <Field label="Note for workers (optional)"><input id="lt-note" className="input" value={led.note} onChange={(e) => setLed({ ...led, note: e.target.value })} /></Field>
            <div className="drawer-actions">
              {led.id && <button className="btn ghost danger" onClick={() => { setLts(lts.filter((x) => x.id !== led.id)); setLed(null); toast('Leave type removed · existing requests keep their type'); }}>Remove</button>}
              <span className="grow" />
              <button className="btn ghost" onClick={() => setLed(null)}>Cancel</button>
              <button className="btn" disabled={!led.name.trim()} onClick={() => { setLts(led.id ? lts.map((x) => (x.id === led.id ? led : x)) : [...lts, { ...led, id: 'lt' + Date.now() }]); setLed(null); toast('Leave type saved · shows in the worker app'); }}>Save</button>
            </div>
          </>}
        </Drawer>
      </>}
      {tab === 'roles' && <>
        <div className="rb-grid">
          {[
            ['Employee', 'Their own work, mostly on the phone', ['Own schedule, clock in and out, breaks', 'Request leave, see notifications', 'Own timesheet in the dashboard'], 'Only themselves'],
            ['Floater', 'No fixed location; covers leave and no-shows', ['Covers offered to them, clock in at the covered location', 'Request leave, see notifications', 'Own timesheet; only paid for days they cover'], 'Only themselves'],
            ['Manager', 'Runs their locations day to day', ['Roster, leave approvals and notifications', 'Workforce and timesheets for their people', 'Supervisor app'], 'Locations they are assigned to'],
            ['Admin', 'Runs the operation', ['Everything managers can do, everywhere', 'Settings, vendors, onboarding, vendor costs', 'Assign managers to locations'], 'Every location'],
          ].map(([r, d, can, scope]) => (
            <section key={r} className="card rb-card">
              <div className="rb-name">{r}</div>
              <div className="small muted">{d}</div>
              <ul className="rb-can">{can.map((c) => <li key={c}>{c}</li>)}</ul>
              <div className="rb-scope small"><span className="muted">Sees</span> {scope}</div>
            </section>
          ))}
        </div>
        <section className="card flush">
          <div className="card-head pad"><h3>Your designations</h3><span className="small muted">Map your own job titles to an access level. Locked once anyone holds the designation.</span></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Designation</th><th>Access</th><th className="num">People</th></tr></thead>
            <tbody>{desig.map((d, i) => (
              <tr key={d.name}>
                <td><b>{d.name}</b></td>
                <td><select id={'rb-' + i} className="input sm" disabled={d.n > 0} title={d.n > 0 ? `Locked: ${d.n} ${d.n === 1 ? 'person holds' : 'people hold'} this designation. Move them to another designation first.` : undefined} value={d.role} onChange={(e) => { DESIG_ACCESS[d.name] = e.target.value; setDesig(desig.map((x, j) => (j === i ? { ...x, role: e.target.value } : x))); toast(`${d.name} now has ${e.target.value} access`); }}><option>Employee</option><option>Floater</option><option>Manager</option><option>Admin</option></select></td>
                <td className="num mono">{d.n}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <div className="pad lv-foot"><button className="btn ghost sm" onClick={() => { const name = 'New designation'; setDesig([...desig, { name: name + ' ' + (desig.length + 1), role: 'Employee', n: 0 }]); }}>Add designation</button></div>
        </section>
        <Note>Vendor users are separate: they sign in to the vendor portal, see only their own people, and can only propose candidates.</Note>
      </>}
    </>
  );
}
