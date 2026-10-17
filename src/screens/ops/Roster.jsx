import { MANAGERS, SITES, VENDORS, WORKERS, LEAVE, ROSTER_GROUPS, SHIFT_TEMPLATES, TRAVEL, tplOf, tplLabel, spanOf, MAX_ON_SITE, endOf, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Pill, Drawer, Field, Toggle, Note, useToast, Icon, Marquee, useMenu, Select } from '../../ui.jsx';
import { isFloat, coverOf, coverCell, undoCell, CoverDrawer } from '../../lib/cover.jsx';
import { FULL_DAYS, hm, toMin, TODAY, weekDays, weekLabel } from '../../lib/dates.js';
import { OFF_RULES, fixedOff, offErrors, errText, offPerWeek, offClashes, badUpload } from '../../lib/offs.js';
import { shiftHours, shiftBrk, usual, shiftWeek } from '../../lib/roster.js';
import { copyWeek, emptyWeek, applyLeave, leaveIn, templateRows, parseSheet, detectColumns, findHeader, mergeInto } from '../../lib/rosterio.js';
import { liveOf, LV } from '../../lib/live.js';
import { travelMins } from '../../lib/geo.js';
import { isAdmin, SCOPE } from '../../lib/scope.js';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';

const { useState, useEffect, useRef } = React;

// Has this worker clocked in today? Then today's shifts are locked, as in opspro-app.
const clockedIn = (wid) => SITES.some((s) => liveOf(s.id).some((x) => x.w.id === wid && ['in', 'late', 'break'].includes(x.status)));

export const MAXWK = 4; // how far ahead a roster can be planned, in weeks
export const DAY0 = 5 * 60, DAYLEN = 22 * 60; // timeline window 05:00 → 03:00 next day

export const pos = (min) => Math.max(0, Math.min(1, (min < DAY0 ? min + 1440 - DAY0 : min - DAY0) / DAYLEN));

export function dayChecks(list, home) {
  const iv = list.map(([t, st, s2]) => { const s0 = toMin(st); return { s0, end: s0 + spanOf(tplOf(t)) * 60, site: s2 || home }; }).sort((a, b) => a.s0 - b.s0);
  const out = [];
  for (let k = 1; k < iv.length; k++) {
    const a = iv[k - 1], b = iv[k];
    const travel = travelMins(a.site, b.site, TRAVEL);
    if (b.s0 < a.end) out.push(['crit', 'Blocked', 'These shifts overlap']);
    else if (b.s0 < a.end + travel) out.push(['crit', 'Blocked', `Not enough time to travel to ${siteOf(b.site).name} (about ${travel} min)`]);
    else if (b.s0 - a.end - travel < 60) out.push(['warn', 'Check', 'Less than 1 h between shifts (policy minimum)']);
  }
  // opspro-app allows at most 12 h on site in a day (an 11+1 fills it).
  const onSite = list.reduce((a, [t]) => a + spanOf(tplOf(t)), 0);
  if (onSite > MAX_ON_SITE) out.push(['warn', 'Check', `${onSite} h on site in one day, over the ${MAX_ON_SITE} h maximum; the extra is overtime`]);
  return out;
}

export function MiniBar({ list, home }) {
  return (
    <span className="minibar" aria-hidden="true">
      {list.map(([t, st, s2], k) => { const a = pos(toMin(st)); const b = pos(toMin(st) + spanOf(tplOf(t)) * 60); return <span key={k} className={s2 && s2 !== home ? 'away' : ''} style={{ left: a * 100 + '%', width: Math.max(4, (b - a) * 100) + '%' }} />; })}
    </span>
  );
}

// The day: a slim strip from 05:00 to 03:00 showing where the shifts sit, then one card per shift with its times,
// length, place and status, and the gap (and travel) between shifts. Times after midnight count as the same working day.
export function DayTimeline({ list, home, ghost, acts, note }) {
  const abs = (st) => { const m = toMin(st); return m < DAY0 ? m + 1440 : m; };
  const items = [...list.map((x) => ({ x, ghost: false })), ...(ghost ? [{ x: ghost, ghost: true }] : [])]
    .map((it) => { const s0 = abs(it.x[1]); return { ...it, s0, e0: s0 + spanOf(tplOf(it.x[0])) * 60 }; })
    .sort((a, b) => a.s0 - b.s0);
  if (!items.length) return null;
  const at = (m) => `${Math.max(0, Math.min(1, (m - DAY0) / DAYLEN)) * 100}%`;
  return (
    <div className="dtl">
      <div className="dtl-strip" role="img" aria-label="Where the shifts sit in the day">
        {[6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h} className="dtl-tick" style={{ left: at(h * 60) }}>{String(h % 24).padStart(2, '0')}</span>)}
        {items.map((it, k) => <i key={k} className={(it.ghost ? 'ghost' : '') + ((it.x[2] || home) !== home ? ' away' : '')} style={{ left: at(it.s0), width: `calc(${at(it.e0)} - ${at(it.s0)})` }} />)}
      </div>
      {items.map((it, k) => {
        const site = it.x[2] || home; const T = tplOf(it.x[0]); const e = endOf(it.x[1], spanOf(T)); const prev = items[k - 1];
        const gap = prev ? it.s0 - prev.e0 : 0; const tr = prev ? travelMins(prev.x[2] || home, site, TRAVEL) : 0;
        return (
          <React.Fragment key={k}>
            {prev && gap > 0 && <div className="dtl-gap">{Math.floor(gap / 60) ? `${Math.floor(gap / 60)} h` : ''}{gap % 60 ? ` ${gap % 60} min` : ''} gap{tr ? ` · ${tr} min travel` : ''}</div>}
            <div className={'dtl-card' + (site !== home ? ' away' : '') + (it.ghost ? ' ghost' : '')}>
              <div className="dtl-top">
                <b>{it.x[1]} – {e.time}{e.nextDay && <small>+1</small>}</b>
                {!it.ghost && acts && <div className="dtl-acts">{acts(it.x)}</div>}
              </div>
              <span className="dtl-meta">{tplLabel(T)} · {siteOf(site).name}{it.x[3] ? ` · covering ${WORKERS.find((w) => w.id === it.x[3]).name}` : ''}</span>
              {!it.ghost && note && note(it.x)}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function Scheduling({ go }) {
  const [mgr, setMgr] = useState(isAdmin() ? 'all' : SCOPE.mgr);
  const [loc, setLoc] = useState('all');
  const [clr, setClr] = useState(null); // clear days: { g, r, days }
  const [shot, setShot] = useState(null); // share as picture: { kind: 'worker' | 'loc', sid, r }
  const shotRef = useRef(null);
  const [ed, setEd] = useState(null); // editing one shift in the day drawer: { key, t, st, site }
  const [ven, setVen] = useState('all');
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [cover, setCover] = useState(null);
  const [day, setDay] = useState(null); // { g: siteId, r, c }
  const [wk, setWk] = useState(0); // -1 last week, 0 this week, 1 next week, up to MAXWK weeks ahead
  const [weeks, setWeeks] = useState(() => ({ '-1': shiftWeek(ROSTER_GROUPS, -1, false), 0: ROSTER_GROUPS, 1: shiftWeek(ROSTER_GROUPS, 1, true) }));
  const [pub, setPub] = useState({ '-1': 'published', 0: 'published', 1: 'draft' });
  const [dirty, setDirty] = useState({ '-1': 0, 0: 0, 1: 0 });
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  useEffect(() => { const mq = window.matchMedia('(max-width: 640px)'); const f = (e) => setNarrow(e.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  const [dIdx, setDIdx] = useState(TODAY);
  useEffect(() => { const tb = document.querySelector('.topbar'); if (!tb) return; const set = () => document.documentElement.style.setProperty('--tb', tb.getBoundingClientRect().height + 'px'); set(); const ro = new ResizeObserver(set); ro.observe(tb); return () => ro.disconnect(); }, []);
  const [pubOpen, setPubOpen] = useState(false);
  const [up, setUp] = useState(null); // upload: { wk, step: 'pick' | 'report', file, aoa, map }
  const [cp, setCp] = useState(null); // copy: { from, to, n, sites }
  const [rep, setRep] = useState([]); // "copy this day to" days in the day drawer
  const [adding, setAdding] = useState(false); // the add-a-shift form in the day drawer is open
  const [pubOpt, setPubOpt] = useState({ notify: true, ack: true });
  const has = (w) => !!weeks[w];
  const groups = fixedOff(weeks[wk] || emptyWeek());
  const empty = !has(wk);
  const fixedMode = OFF_RULES.mode === 'fixed';
  const days = weekDays(wk);
  const nowIdx = wk < 0 ? 7 : wk > 0 ? -1 : TODAY; // days before this index have happened
  const [add, setAdd] = useState({ t: 'f7', st: '13:00', site: 's3' });
  const toast = useToast();
  const menu = useMenu();
  const W = (id) => WORKERS.find((w) => w.id === id);
  const G = (sid) => groups.find((g) => g.site === sid);
  const setCells = (g, r, cs, v) => { setWeeks((Wk) => ({ ...Wk, [wk]: Wk[wk].map((x) => (x.site !== g ? x : { ...x, cells: x.cells.map((row, ri) => row.map((y, ci) => (ri === r && cs.includes(ci) ? v : y))) })) })); setDirty((d) => ({ ...d, [wk]: (d[wk] || 0) + 1 })); };
  const setCell = (g, r, c, v) => setCells(g, r, [c], v);
  // Latest week that has a roster, before `w`: the natural thing to copy from.
  const latestBefore = (w) => { for (let k = w - 1; k >= -1; k--) if (has(k)) return k; return 0; };
  // opts: from (default the latest planned week before), sites, workers (just these people), stay (keep looking at this week)
  const openCopy = (to, o = {}) => setCp({ from: o.from ?? latestBefore(to), to, n: 1, sites: o.sites || shown.map((x) => x.id), workers: o.workers, stay: o.stay });
  const doCopy = () => {
    const targets = Array.from({ length: cp.n }, (_, i) => cp.to + i).filter((t) => t <= MAXWK);
    setWeeks((Wk) => { const next = { ...Wk }; targets.forEach((t) => { next[t] = copyWeek(Wk[cp.from], Wk[t], cp.sites, t, cp.workers); }); return next; });
    setPub((x) => { const n = { ...x }; targets.forEach((t) => { if (n[t] !== 'published') n[t] = 'draft'; }); return n; });
    setDirty((d) => { const n = { ...d }; targets.forEach((t) => { n[t] = (n[t] || 0) + 1; }); return n; });
    if (!cp.stay) setWk(cp.to); setCp(null);
    toast(`Copied ${cp.workers ? `${W(cp.workers[0]).name}'s ` : cp.stay ? `${siteOf(cp.sites[0]).name}'s ` : ''}${weekLabel(cp.from)} into ${targets.length === 1 ? weekLabel(cp.to) : `${targets.length} weeks, ${weekLabel(cp.to, true)} onwards`} · drafts, review then publish`);
  };
  const startBlank = () => { setWeeks((Wk) => ({ ...Wk, [wk]: applyLeave(emptyWeek(), wk) })); setPub((x) => ({ ...x, [wk]: 'draft' })); setDirty((d) => ({ ...d, [wk]: 0 })); toast(`Blank roster for ${weekLabel(wk)} · click a day to add shifts`); };
  const publish = () => { setPubOpen(false); setPub((x) => ({ ...x, [wk]: 'published' })); setDirty((d) => ({ ...d, [wk]: 0 })); toast(pub[wk] === 'draft' ? `${weekLabel(wk)} published · workers notified in the app` : `Changes published · ${dirty[wk]} affected workers notified`); };
  const assign = (x) => { setCell(x.g, x.r, cover.ci, coverCell(x, cover.site, cover.sh, cover.absent)); toast(`${x.w.name} covers ${W(cover.absent).name.split(' ')[0]} on ${days[cover.ci]} · push sent`); setCover(null); };
  // sh: the shift to cover (the usual shift for a day on leave, or one that's rostered).
  const findCover = (absent, sid, ci, sh, why) => { setDay(null); setCover({ absent, site: sid, ci, sh, why }); };
  // Who is covering this particular shift of theirs, if anyone.
  const coverFor = (wid, ci, x) => { for (const g of groups) for (let r = 0; r < g.people.length; r++) { const c = g.cells[r][ci]; if (Array.isArray(c)) { const sh = c.find((y) => y[3] === wid && y[1] === x[1] && y[0] === x[0]); if (sh) return { w: W(g.people[r]), g: g.site, r, sh }; } } return null; };
  const covBy = (wid, ci) => coverOf(groups, wid, ci);
  const first = (n) => n.split(' ')[0];
  // Covers are linked both ways. The absent person's cell and the cover's cell share a key: hovering either lights
  // both, and the "Covered by …" / "Covering …" line scrolls to the other one (opening its section) and flashes it.
  const covKey = (absentId, ci) => `${absentId}:${ci}`;
  const covLit = (key, on) => document.querySelectorAll(`[data-cov="${key}"]`).forEach((e) => e.classList.toggle('cov-hl', on));
  const covHover = (key) => (key ? { 'data-cov': key, onMouseEnter: () => covLit(key, true), onMouseLeave: () => covLit(key, false) } : {});
  const groupOf = (wid) => (groups.find((g) => g.people.includes(wid)) || {}).site;
  const covJump = (e, key, gid) => {
    e.stopPropagation(); e.preventDefault();
    const from = e.currentTarget.closest('[data-cov]');
    if (gid) setCollapsed((c) => ({ ...c, [gid]: false }));
    setTimeout(() => {
      const t = [...document.querySelectorAll(`[data-cov="${key}"]`)].find((x) => x !== from); if (!t) return;
      const r = t.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - (window.innerHeight - r.height) / 2, behavior: 'smooth' }); t.classList.remove('cov-flash'); void t.offsetWidth; t.classList.add('cov-flash');
      setTimeout(() => t.classList.remove('cov-flash'), 1800);
    }, 60);
  };
  const covLink = (label, key, gid) => <span className="cell-sub cov cov-link" role="link" onClick={(e) => covJump(e, key, gid)}>{label}</span>;
  // The line on a cover's own cell: who they are covering.
  const covering = (list, ci) => { const x = list.find((y) => y[3]); return x ? <>{covLink(`For ${first(W(x[3]).name)}`, covKey(x[3], ci), groupOf(x[3]))}{x[2] && <span className="cell-sub cov-at"><Icon name="pin" size={10} />{siteOf(x[2]).name.replace(/^(Spinneys|Carrefour) /, '')}</span>}</> : null; };
  const isCover = (c) => Array.isArray(c) && c.some((y) => y[3]);
  const covAttrs = (list, ci) => { const x = Array.isArray(list) && list.find((y) => y[3]); return covHover(x ? covKey(x[3], ci) : null); };
  const site = day ? day.g : 's3';
  const cur = day && G(day.g).cells[day.r][day.c];
  const list = Array.isArray(cur) ? cur : [];
  const norm = (x) => x.filter((v) => v !== undefined);
  const mk = (t, st, s2) => norm([t, st, s2 === site ? undefined : s2]);
  const preview = [...list, mk(add.t, add.st, add.site)];
  const dayWorker = day && W(G(day.g).people[day.r]);
  const isPool = day && day.g === 'pool';
  const checks = [...(cur === 'O' ? [['warn', 'Weekly off', `${dayWorker.name.split(' ')[0]}'s weekly off: this counts as rest-day work, paid at the overtime rate`]] : []), ...dayChecks(preview, site)];
  const fmtShift = ([t, st]) => { const T = tplOf(t); const e = endOf(st, T.base + (T.brk || 0)); return `${st} – ${e.time}${e.nextDay ? ' (overnight)' : ''}`; };
  const openDay = (g, r, c) => {
    // Days that are done, and today once they've clocked in, open as a record of what happened.
    if (c < nowIdx) { setDay({ g, r, c, ro: 'past' }); return; }
    if (wk === 0 && c === TODAY && Array.isArray(G(g).cells[r][c]) && clockedIn(G(g).people[r])) { setDay({ g, r, c, ro: 'today' }); return; } if (fixedMode && OFF_RULES.days.includes(c)) { toast(`${FULL_DAYS[c]} is the weekly off for everyone · change it in Settings → Attendance rules`); return; } { const cell = G(g).cells[r][c]; const ls = Array.isArray(cell) ? cell : []; const last = ls.reduce((m, x) => Math.max(m, toMin(x[1]) + tplOf(x[0]).base * 60), -1);
    // Suggest a start: an hour after their last shift that day, otherwise their usual start.
    const st = last >= 0 ? hm(Math.min(last + 60, 23 * 60)) : (usual(G(g).cells[r])[0] || [null, '07:00'])[1];
    setDay({ g, r, c }); setRep([]); setEd(null); setAdding(!Array.isArray(cell) && cell !== 'O' && cell !== 'L'); setAdd({ ...add, t: last >= 0 ? 'f7' : (usual(G(g).cells[r])[0] || ['f5'])[0], st, site: g === 'pool' ? (shown[0] || SITES[0]).id : g }); } };
  const locsIn = (c, home) => (Array.isArray(c) ? [...new Set(c.map((x) => x[2] || home))] : []);
  const match = (w) => (!q || w.name.toLowerCase().includes(q.toLowerCase())) && (ven === 'all' || w.vendor === ven);
  const mine = SITES.filter((s) => mgr === 'all' || MANAGERS.find((m) => m.id === mgr).sites.includes(s.id));
  // The search box matches worker names, location names and supervisor names; a matching location
  // or supervisor shows everyone at that location (or at all of that supervisor's locations).
  const siteHit = (sid) => { const t = q.trim().toLowerCase(); if (!t || sid === 'pool') return false; const m = MANAGERS.find((x) => x.sites.includes(sid)); return siteOf(sid).name.toLowerCase().includes(t) || (!!m && m.name.toLowerCase().includes(t)); };
  const matchAt = (sid) => (w) => (siteHit(sid) ? ven === 'all' || w.vendor === ven : match(w));
  const shown = mine.filter((s) => loc === 'all' || s.id === loc);
  // The floaters band: floaters in this manager's pool, plus anyone from the pool covering at these locations this week.
  const PG = groups.find((g) => g.float);
  // How many people work each day at the locations on screen, wherever their roster row lives.
  const shownIds = new Set(shown.map((s) => s.id));
  const onDay = (i) => groups.reduce((n, g) => n + g.cells.filter((row) => Array.isArray(row[i]) && row[i].some((x) => shownIds.has(x[2] || g.site))).length, 0);
  const ini = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);
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
  // Today, once they've clocked in: a dotted green border (the day isn't over yet).
  const isTodayIn = (wid, ci) => wk === 0 && ci === TODAY && clockedIn(wid);
  // Today's clocked-in border: evenly spaced dashes that follow the rounded corners.
  const ring = (on) => (on ? <svg className="dotring" aria-hidden="true"><rect /></svg> : null);
  const pastCls = (sid, wid, ci, here) => (ci < nowIdx && here.length ? (missed(sid, wid, ci) ? ' past-miss' : ' past-ok') : here.length && isTodayIn(wid, ci) ? ' today-in' : '');
  const pastTitle = (sid, wid, ci, here) => (ci < nowIdx && here.length ? (missed(sid, wid, ci) ? 'Missed: no clock-in' : 'Clocked in') : here.length && isTodayIn(wid, ci) ? 'Clocked in today' : undefined);
  const segCls = (sid, wid, ci, k) => (ci < nowIdx ? (missed(sid, wid, ci + k * 3) ? ' past-miss' : ' past-ok') : isTodayIn(wid, ci) && k === 0 ? ' today-in' : '');
  const segTitle = (sid, wid, ci, k) => (ci < nowIdx ? (missed(sid, wid, ci + k * 3) ? 'Missed: no clock-in' : 'Clocked in') : undefined);
  // Two or more shifts in a day: the cell splits into side-by-side segments, one per shift, same height as a single shift.
  const split = (list, sid, wid, ci, onOpen, label) => (
    <div className="cell-split">{[...list].sort((a, b) => toMin(a[1]) - toMin(b[1])).map((x, k) => (
      <button key={k} className={'cell one cseg' + segCls(sid, wid, ci, k)} title={segTitle(sid, wid, ci, k)} onClick={onOpen} aria-label={`${label}, shift ${k + 1} of ${list.length}`}>{ring(!!segCls(sid, wid, ci, k).includes('today-in'))}{chip(x, k, sid)}</button>
    ))}</div>
  );
  // Where the upload is: choose a file, check it, import it.
  const upSteps = (at) => <ol className="up-steps2" aria-label="Upload steps">{['Choose a file', 'Check', 'Import'].map((l, i) => <li key={l} className={i < at ? 'done' : i === at ? 'on' : ''} aria-current={i === at ? 'step' : undefined}><span>{i < at ? <Icon name="check" size={12} /> : i + 1}</span>{l}</li>)}</ol>;
  // Upload helpers: the template, reading a file, the error report, and the demo sample.
  const fileWeek = (w) => weekLabel(w, true).replace(/\s+/g, '-').replace(/[–—]/g, '').replace(/-+/g, '-').toLowerCase();
  const sourceFor = (w) => (has(w) ? weeks[w] : copyWeek(weeks[latestBefore(w)], null, shown.map((x) => x.id), w));
  const saveXlsx = async (aoa, name, extra) => {
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = aoa[0].map((h, i) => ({ wch: i === 1 ? 22 : i === 2 ? 26 : i > 2 ? 16 : 10 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Roster');
    if (extra) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(extra), 'How to fill');
    // Inside the published prototype the viewer grants downloads; opened as a plain file, the browser saves it.
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (dl) {
      try { await dl.save({ filename: name, data: XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) }); toast(`Saved ${name}`); }
      catch (e) { if (e && e.code !== 'declined') toast(e && e.code === 'rate_limited' ? 'A save is already waiting for you' : 'Downloads aren\'t available here'); }
      return;
    }
    try { XLSX.writeFile(wb, name); toast(`Downloaded ${name}`); } catch (e) { toast('Downloads aren\'t available here'); }
  };
  // Share a week as a picture (for a WhatsApp group, say). The card is drawn off screen, then saved as a PNG.
  const savePng = async (url, name) => {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (dl) {
      const bin = atob(url.split(',')[1]); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      try { await dl.save({ filename: name, data: bytes.buffer }); toast(`Saved ${name}`); }
      catch (e) { if (e && e.code !== 'declined') toast('Downloads aren\'t available here'); }
      return;
    }
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast(`Downloaded ${name}`);
  };
  useEffect(() => {
    if (!shot) return;
    let gone = false;
    const id = requestAnimationFrame(async () => {
      const node = shotRef.current; if (!node || gone) return;
      const bg = getComputedStyle(document.body).backgroundColor;
      const name = `roster-${(shot.kind === 'worker' ? W(G(shot.sid).people[shot.r]).name : siteOf(shot.sid).name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${fileWeek(wk)}.png`;
      let url = null;
      try { url = await toPng(node, { pixelRatio: 2, backgroundColor: bg }); }
      catch (e) { try { url = await toPng(node, { pixelRatio: 2, backgroundColor: bg, skipFonts: true }); } catch (e2) { toast('Couldn\'t make the picture here'); } }
      if (!gone) setShot(null);
      if (url) savePng(url, name);
    });
    return () => { gone = true; cancelAnimationFrame(id); };
  }, [shot]);
  const shotText = (c, home) => {
    if (c === 'O') return ['Weekly off']; if (c === 'L') return ['Annual leave']; if (c === 'A') return ['Available']; if (!Array.isArray(c)) return ['–'];
    return [...c].sort((a, b) => toMin(a[1]) - toMin(b[1])).map(([t, st, s2, cov]) => `${st}–${endOf(st, spanOf(tplOf(t))).time}${s2 && s2 !== home ? ` @ ${siteOf(s2).name.replace(/^(Spinneys|Carrefour) /, '')}` : ''}${cov ? ` (for ${first(W(cov).name)})` : ''}`);
  };
  const shotRows = () => {
    if (!shot) return [];
    const g = G(shot.sid);
    // One worker: a row per location, as on the roster, so a shift shows under the location it's at.
    if (shot.kind === 'worker') {
      const w = W(g.people[shot.r]); const row = g.cells[shot.r]; const home = shot.sid;
      const at = (c, loc) => (Array.isArray(c) ? c.filter((x) => (x[2] || home) === loc) : []);
      const others = [...new Set(row.flatMap((c) => (Array.isArray(c) ? c.map((x) => x[2] || home) : [])))].filter((loc) => loc !== home);
      const homeRow = { w, key: home, label: home === 'pool' ? 'Floater' : siteOf(home).name, home, cells: row.map((c) => (Array.isArray(c) ? (at(c, home).length ? at(c, home) : 'X') : c)) };
      return [homeRow, ...others.map((loc) => ({ w, key: loc, label: siteOf(loc).name, home: loc, cells: row.map((c) => (at(c, loc).length ? at(c, loc) : 'X')) }))];
    }
    return [...g.people.map((id, r) => ({ w: W(id), cells: g.cells[r], home: shot.sid })).filter((x) => matchAt(shot.sid)(x.w)),
      ...visitorsOf(shot.sid).filter((v) => matchAt(shot.sid)(v.w)).map((v) => ({ w: v.w, cells: v.days.map((d) => (d.length ? d : 'X')), home: shot.sid, visiting: true }))];
  };
  const HOW = [['What to type in a day', 'Means'], ['07:00-19:00', 'One shift, 07:00 to 19:00 on site (11 h worked + 1 h break)'], ['7-7  or  7am to 7pm', 'Same thing'], ['07:00 11h', 'Starts 07:00, 11 hours worked'], ['07:00-11:00 + 17:00-21:00', 'Two shifts in one day'], ['07:00-19:00 @ Barsha Heights', 'A shift at another location'], ['OFF', 'Weekly off'], ['LEAVE', 'On leave'], ['(empty)', 'Not rostered'], [], ['Shifts allowed', SHIFT_TEMPLATES.map((x) => `${x.base}${x.brk ? '+' + x.brk : ''} (${x.base + (x.brk || 0)} h on site)`).join(', ')], ['Weekly off', fixedMode ? `${OFF_RULES.days.map((d) => FULL_DAYS[d]).join(' and ')} for everyone` : `At least ${OFF_RULES.perWeek} per worker per week`]];
  const downloadTemplate = (w) => saveXlsx(templateRows(sourceFor(w), shown.map((x) => x.id), w), `roster-${fileWeek(w)}.xlsx`, HOW);
  const readFile = (f, w) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const wb = /\.csv$/i.test(f.name) ? XLSX.read(r.result, { type: 'string' }) : XLSX.read(new Uint8Array(r.result), { type: 'array' });
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
        setUp({ wk: w, step: 'report', file: f.name, aoa, map: null, sample: false });
      } catch (e) { toast(`Couldn't open ${f.name}. Save it as .xlsx or .csv and try again.`); }
    };
    if (/\.csv$/i.test(f.name)) r.readAsText(f); else r.readAsArrayBuffer(f);
  };
  const downloadErrors = (u, errors) => {
    const byRow = {}; errors.forEach((x) => { if (x.row) (byRow[x.row] = byRow[x.row] || []).push(`${x.col}: ${x.msg}`); });
    const hi = findHeader(u.aoa);
    const aoa = u.aoa.map((row, i) => (i === hi ? [...row, 'Problem'] : i > hi ? [...row, (byRow[i + 1] || []).join(' | ')] : row));
    saveXlsx(aoa, u.file.replace(/(\.[a-z]+)?$/i, ' - to fix.xlsx'));
  };
  // The demo file: the week as a supervisor might send it, with a few typical mistakes (or without).
  const sampleSheet = (w, withMistakes) => {
    const aoa = templateRows(withMistakes ? badUpload(weeks[0]) : sourceFor(w), shown.map((x) => x.id), w);
    aoa[0] = ['Emp No', 'Employee name', 'Store', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (withMistakes) { if (aoa[3]) aoa[3][5] = '9-12'; if (aoa[5]) aoa[5][7] = '7 till late'; aoa.push(['OP-9999', 'Sam New', aoa[1][2], '07:00-18:00', '07:00-18:00', 'OFF', '07:00-18:00', '07:00-18:00', '07:00-18:00', '07:00-18:00']); }
    return aoa;
  };
  // Row and location actions live behind one "more" button that shows on hover (always on touch screens).
  const canCopy = wk >= 0 && wk < MAXWK;
  const moreBtn = (title, items) => <button className={'more-btn' + (menu.isOpen(title) ? ' open' : '')} aria-haspopup="menu" aria-label={`Actions for ${title}`} title="Actions" onClick={(e) => menu.open(e, title, items)}><Icon name="more" size={16} /></button>;
  const rowActs = (sid, r, w) => moreBtn(w.name, [
    canCopy && { icon: 'copy', label: 'Copy week forward', sub: 'Into the coming weeks', on: () => openCopy(wk + 1, { from: wk, sites: sid === 'pool' ? [] : [sid], workers: [w.id], stay: true }) },
    { icon: 'camera', label: 'Save week as picture', sub: 'To share on WhatsApp', on: () => setShot({ kind: 'worker', sid, r }) },
    { icon: 'person', label: 'Open profile', on: () => go('workforce', { worker: w.id }) },
    wk >= 0 && { icon: 'trash', label: 'Clear days…', sub: 'Pick days to empty', danger: true, on: () => setClr({ g: sid, r, days: [] }) },
  ]);
  const locActs = (s) => moreBtn(s.name, [
    canCopy && { icon: 'copy', label: 'Copy week forward', sub: `Everyone at ${s.name.replace(/^(Spinneys|Carrefour) /, '')}`, on: () => openCopy(wk + 1, { from: wk, sites: [s.id], stay: true }) },
    { icon: 'camera', label: 'Save week as picture', sub: 'To share on WhatsApp', on: () => setShot({ kind: 'loc', sid: s.id }) },
  ]);
  const chip = ([t, st, s2, x4], k, home) => {
    const away = s2 && s2 !== home;
    const night = endOf(st, tplOf(t).base + (tplOf(t).brk || 0)).nextDay || toMin(st) >= 17 * 60;
    return <span key={k} className={'shiftchip' + (away ? ' away' : '')} title={away ? `At ${siteOf(s2).name}` : undefined}><span className={'sc-moon filled' + (night ? '' : ' sc-sun')} title={night ? 'Night shift' : 'Day shift'} aria-label={night ? 'Night shift' : 'Day shift'}><Icon name={night ? 'moon' : 'sun'} size={13} /></span><span className="sc-time mono" title={tplLabel(tplOf(t))}><span>{st}</span><span className="sc-to">to</span><span>{endOf(st, tplOf(t).base + (tplOf(t).brk || 0)).time}</span></span>{away && <span className="sc-loc"><Icon name="pin" size={10} />{siteOf(s2).name.replace(/^(Spinneys|Carrefour) /, '')}</span>}</span>;
  };
  return (
    <>
      <ScreenHeader title="Roster" phase={1} spec="5.4" actions={<>
        <button className="btn ghost" onClick={() => toast('Exported the roster for these locations (XLSX and PDF)')}><Icon name="download" size={15} /> Export</button>
        <button className="btn ghost" onClick={() => setUp({ wk: Math.max(wk, wk === 0 ? 0 : 1), step: 'pick' })}><Icon name="upload" size={15} /> Upload</button>
        {wk >= 0 && !empty && <button className="btn" onClick={() => setPubOpen(true)}>Publish…</button>}
      </>} />
      <div className="rbar">
        <div className="rbar-week">
          <div className="wk-step">
            <button disabled={wk <= -1} onClick={() => setWk(wk - 1)} aria-label="Previous week"><Icon name="chevronLeft" size={16} stroke={2.2} /></button>
            <div className="wk-label"><b>{weekLabel(wk)}</b><span>{wk === 0 ? 'This week' : wk === 1 ? 'Next week' : wk < 0 ? 'Last week' : `In ${wk} weeks`}</span></div>
            <button disabled={wk >= MAXWK} onClick={() => setWk(wk + 1)} aria-label="Next week"><Icon name="chevronRight" size={16} stroke={2.2} /></button>
          </div>
          {wk !== 0 && <button className="btn ghost" onClick={() => setWk(0)}>Today</button>}
          {!empty && !narrow && <div className="ro-legend" aria-label="Key">
            <span><i className="k-ok" />Clocked in</span><span><i className="k-miss" />Missed</span><span><i className="k-now" />In now</span>
            <span><Icon name="sun" size={14} />Day</span><span><Icon name="moon" size={14} />Night</span><span><i className="k-cov" />Cover</span>
          </div>}
          {empty ? <Pill>No roster yet</Pill> : wk < 0 ? <Pill>Read-only</Pill> : pub[wk] !== 'draft' && dirty[wk] ? <Pill tone="info">{dirty[wk]} unpublished {dirty[wk] === 1 ? 'change' : 'changes'}</Pill> : null}
        </div>
        <div className="toolbar rbar-filters">
        <label className="search"><Icon name="search" size={16} /><input id="sch-q" className="input" type="search" placeholder="Search employees or locations…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employees or locations" /></label>
        {isAdmin() && <Select id="sch-mgr" className="input" value={mgr} onChange={(e) => { setMgr(e.target.value); setLoc('all'); }} aria-label="Manager">
          <option value="all">All managers</option>{MANAGERS.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.sites.length} locations</option>)}
        </Select>}
        <Select id="sch-loc" className="input" value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Location">
          <option value="all">All locations</option>{mine.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
        <Select id="sch-ven" className="input" value={ven} onChange={(e) => setVen(e.target.value)} aria-label="Vendor">
          <option value="all">All vendors</option>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>
        </div>
      </div>
      {empty ? <section className="card wk-empty">
        <h3>No roster for {weekLabel(wk)} yet</h3>
        <p className="small muted">Start from a week you've already planned, or upload a file. Either way it stays a draft until you publish.</p>
        <div className="wk-starts">
          <button className="wk-start main" onClick={() => openCopy(wk)}><Icon name="copy" size={20} /><b>Copy {weekLabel(latestBefore(wk), true)}</b><span className="small muted">Same shifts and weekly offs. Covers aren't copied; approved leave is filled in.</span></button>
          <button className="wk-start" onClick={() => setUp({ wk, step: 'pick' })}><Icon name="upload" size={20} /><b>Upload a file</b><span className="small muted">Excel or CSV. Download the template, fill it in, upload it back.</span></button>
          <button className="wk-start" onClick={startBlank}><Icon name="grid" size={20} /><b>Start blank</b><span className="small muted">Nobody rostered. Add shifts day by day.</span></button>
        </div>
      </section> : narrow ? <div className="dayview">
        <div className="dv-step">
          <button className="btn ghost sm icon" disabled={dIdx <= 0} onClick={() => setDIdx(dIdx - 1)} aria-label="Previous day"><Icon name="chevronLeft" size={16} stroke={2.2} /></button>
          <div className="dv-day"><b>{days[dIdx]}</b>{wk === 0 && dIdx === TODAY && <span className="today-tag">Today</span>}</div>
          <button className="btn ghost sm icon" disabled={dIdx >= 6} onClick={() => setDIdx(dIdx + 1)} aria-label="Next day"><Icon name="chevronRight" size={16} stroke={2.2} /></button>
        </div>
        {shown.map((s) => {
          const g = G(s.id);
          const rows = g.people.map((id, r) => ({ w: W(id), r, c: g.cells[r][dIdx], g: s.id })).filter((x) => matchAt(s.id)(x.w));
          const vis = visitorsOf(s.id).filter((v) => matchAt(s.id)(v.w) && v.days[dIdx].length).map((v) => ({ w: v.w, r: v.r, c: v.days[dIdx], g: v.g, visiting: true }));
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
                    <span className="dv-who"><span className="namerow"><b>{x.w.name}</b></span><span className="small muted"><span className="vtag">{vendorOf(x.w.vendor).code}</span> {x.w.role}</span></span>
                    <span className="dv-what">
                      {here.map((y, k) => <span key={k} className={'dv-shift' + segCls(s.id, x.w.id, dIdx, k)}>{ring(segCls(s.id, x.w.id, dIdx, k).includes('today-in'))}<span className="mono">{y[1]}–{endOf(y[1], tplOf(y[0]).base + (tplOf(y[0]).brk || 0)).time}</span>{endOf(y[1], tplOf(y[0]).base + (tplOf(y[0]).brk || 0)).nextDay && <span className="sc-moon filled"><Icon name="moon" size={11} /></span>}</span>)}
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
                {Array.isArray(c) && c.map((y, k) => <span key={k} className={'dv-shift' + segCls('pool', w.id, dIdx, k)}>{ring(segCls('pool', w.id, dIdx, k).includes('today-in'))}<span className="mono">{y[1]}–{endOf(y[1], tplOf(y[0]).base + (tplOf(y[0]).brk || 0)).time}</span><span className="small muted"> {siteOf(y[2]).name.replace(/^(Spinneys|Carrefour) /, '')}</span></span>)}
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
            <thead><tr><th aria-label="Name" />{days.map((d, i) => <th key={d} className={(wk === 0 && i === TODAY ? 'today' : '') + (fixedMode && OFF_RULES.days.includes(i) ? ' closed' : '')}>{d}{wk === 0 && i === TODAY && <span className="today-tag">Today</span>}<span className="dh-n">{onDay(i)} on</span>{fixedMode && OFF_RULES.days.includes(i) && <span className="off-tag">Weekly off</span>}</th>)}</tr></thead>
            {shown.map((s, si) => {
              const g = G(s.id);
              const rows = g.people.map((id, r) => ({ w: W(id), r })).filter((x) => matchAt(s.id)(x.w));
              const vis = visitorsOf(s.id).filter((v) => matchAt(s.id)(v.w));
              if ((q || ven !== 'all') && !rows.length && !vis.length) return null;
              const hrs = g.cells.flat().reduce((a, c) => a + (Array.isArray(c) ? c.filter((x) => !x[2] || x[2] === s.id).reduce((b, [t]) => b + tplOf(t).base, 0) : 0), 0)
                + vis.reduce((a, v) => a + v.days.flat().reduce((b, [t]) => b + tplOf(t).base, 0), 0);
              const isCol = collapsed[s.id] && !q && ven === 'all';
              return (
                <tbody key={s.id} className="rgroup">
                  <tr className="rg-head">
                    <td className="rg-name" colSpan={8} style={{ zIndex: 11 + si * 2 }}><div className="rg-inner"><button className="rg-toggle" onClick={() => setCollapsed({ ...collapsed, [s.id]: !collapsed[s.id] })} aria-expanded={!isCol}>
                      <span className={'rg-caret' + (isCol ? ' col' : '')}><Icon name="down" size={14} stroke={2.2} /></span><b className="rg-loc" title={s.name}>{s.name}</b>{(isAdmin() || isCol) && <span className="muted small rg-sup">{[isAdmin() && MANAGERS.find((m) => m.sites.includes(s.id)).name, isCol && `${g.people.length} ${g.people.length === 1 ? 'employee' : 'employees'}`].filter(Boolean).join(' · ')}</span>}
                    </button>
                    <span className="rg-stats">{g.people.length} {g.people.length === 1 ? 'person' : 'people'} · {hrs} h this week</span>{locActs(s)}</div></td>
                  </tr>
                  {!isCol && rows.map(({ w, r }) => (
                    <tr key={w.id}>
                      <td className="mq-host"><span className="r-av" aria-hidden="true">{ini(w.name)}</span><div className="namerow"><button className="namelink" onClick={() => go('workforce', { worker: w.id })}><Marquee>{w.name}</Marquee></button>{rowActs(s.id, r, w)}</div><div className="small muted"><Marquee><span className="vtag">{vendorOf(w.vendor).code}</span> {w.role}{(() => { const row = g.cells[r]; const worked = row.filter((c) => Array.isArray(c)).length; return worked > 7 - offPerWeek() ? <span className="off-warn" title={`Rostered ${worked} days this week; the organisation requires ${OFF_RULES.perWeek} off a week. This week can't be published until it's fixed.`}><Icon name="alert" size={11} /> No weekly off</span> : null; })()}</Marquee></div></td>
                      {g.cells[r].map((c, ci) => {
                        const here = Array.isArray(c) ? c.filter((x) => !x[2] || x[2] === s.id) : [];
                        const away = Array.isArray(c) && here.length === 0;
                        return (
                          <td key={ci} className={wk === 0 && ci === TODAY ? 'today' : ''}>
                            {here.length > 1 ? split(here, s.id, w.id, ci, () => openDay(s.id, r, ci), `${w.name} ${days[ci]}`) :
                            <button {...(c === 'L' ? covHover(covBy(w.id, ci) && covKey(w.id, ci)) : here.length && ci >= nowIdx && coverFor(w.id, ci, here[0]) ? covHover(covKey(w.id, ci)) : covAttrs(here, ci))} className={'cell ' + (Array.isArray(c) ? (away ? 'elsewhere' : 'one') + (isCover(here) ? ' cover' : '') + pastCls(s.id, w.id, ci, here) : c)} title={pastTitle(s.id, w.id, ci, here)} onClick={() => openDay(s.id, r, ci)} aria-label={`${w.name} ${days[ci]}`}>
                              {ring(Array.isArray(c) && pastCls(s.id, w.id, ci, here).includes('today-in'))}
                              {c === 'O' && <span className="cell-main">Weekly off</span>}
                              {c === 'L' && (() => { const cv = covBy(w.id, ci); return <><span className="cell-main">Annual leave</span>{cv ? covLink(`Covered by ${first(cv.w.name)}`, covKey(w.id, ci), cv.g) : <span className={'cell-sub' + (ci >= nowIdx ? ' uncov' : '')}>{ci >= nowIdx ? 'Not covered' : 'Approved'}</span>}</>; })()}
                              {c === 'X' && <span className="cell-main">Not rostered</span>}
                              {away && <span className="cell-sub">Elsewhere</span>}
                              {here.length > 0 && here.map((x, k) => chip(x, k, s.id))}
                              {here.length > 0 && ci >= nowIdx && (() => { const cv = coverFor(w.id, ci, here[0]); return cv ? covLink(`Covered by ${first(cv.w.name)}`, covKey(w.id, ci), cv.g) : null; })()}
                              {here.length > 0 && covering(here, ci)}
                            </button>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {!isCol && vis.map((v) => (
                    <tr key={'v' + v.w.id} className="visitor">
                      <td className="mq-host"><span className="r-av" aria-hidden="true">{ini(v.w.name)}</span><button className="namelink" onClick={() => go('workforce', { worker: v.w.id })}><Marquee>{v.w.name}</Marquee></button><div className="small muted"><Marquee><span className="vtag">{vendorOf(v.w.vendor).code}</span> {v.g === 'pool' ? 'Floater' : `From ${siteOf(v.g).name.replace(/^(Spinneys|Carrefour) /, '')}`}</Marquee></div></td>
                      {v.days.map((d, ci) => (
                        <td key={ci} className={wk === 0 && ci === TODAY ? 'today' : ''}>{d.length > 1 ? split(d, s.id, v.w.id, ci, () => openDay(v.g, v.r, ci), `${v.w.name} ${days[ci]}`) : d.length ? <button className={'cell one' + pastCls(s.id, v.w.id, ci, d)} title={pastTitle(s.id, v.w.id, ci, d)} onClick={() => openDay(v.g, v.r, ci)} aria-label={`${v.w.name} ${days[ci]} at ${s.name}`}>{ring(pastCls(s.id, v.w.id, ci, d).includes('today-in'))}{d.map((x, k) => chip(x, k, s.id))}</button> : <span className="cell vis-empty" aria-hidden="true">–</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              );
            })}
            {poolRows.length > 0 && (() => { const isCol = collapsed.pool && !q && ven === 'all'; const zi = shown.length; return (
              <tbody className="rgroup pool">
                <tr className="rg-head">
                  <td className="rg-name" colSpan={8} style={{ zIndex: 11 + zi * 2 }}><div className="rg-inner"><button className="rg-toggle" onClick={() => setCollapsed({ ...collapsed, pool: !collapsed.pool })} aria-expanded={!isCol}>
                    <span className={'rg-caret' + (isCol ? ' col' : '')}><Icon name="down" size={14} stroke={2.2} /></span><b className="rg-loc">Floaters</b>{isCol && <span className="muted small rg-sup">{poolRows.length} {poolRows.length === 1 ? 'employee' : 'employees'}</span>}
                  </button></div></td>
                </tr>
                {!isCol && poolRows.map(({ w, r }) => (
                  <tr key={w.id}>
                    <td className="mq-host"><span className="r-av" aria-hidden="true">{ini(w.name)}</span><div className="namerow"><button className="namelink" onClick={() => go('workforce', { worker: w.id })}><Marquee>{w.name}</Marquee></button>{rowActs('pool', r, w)}</div><div className="small muted"><Marquee><span className="vtag">{vendorOf(w.vendor).code}</span> {w.role}</Marquee></div></td>
                    {PG.cells[r].map((c, ci) => (
                      <td key={ci} className={wk === 0 && ci === TODAY ? 'today' : ''}>
                        {Array.isArray(c) && c.length > 1 ? split(c, 'pool', w.id, ci, () => openDay('pool', r, ci), `${w.name} ${days[ci]}`) :
                        <button {...covAttrs(c, ci)} className={'cell ' + (Array.isArray(c) ? 'one' + (isCover(c) ? ' cover' : '') + pastCls('pool', w.id, ci, c) : c)} title={pastTitle('pool', w.id, ci, Array.isArray(c) ? c : [])} onClick={() => openDay('pool', r, ci)} aria-label={`${w.name} ${days[ci]}`}>
                          {ring(Array.isArray(c) && pastCls('pool', w.id, ci, c).includes('today-in'))}
                          {c === 'A' && <span className="cell-main">Available</span>}
                          {c === 'O' && <span className="cell-main">Weekly off</span>}
                          {c === 'L' && <span className="cell-main">Annual leave</span>}
                          {c === 'X' && <span className="cell-main">Not rostered</span>}
                          {Array.isArray(c) && c.map((x, k) => chip(x, k, x[3] ? x[2] : 'pool'))}
                          {Array.isArray(c) && covering(c, ci)}
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
            <div className="up-stats big"><div><b>{people}</b><span>workers</span></div><div><b>{shifts}</b><span>shifts</span></div><div><b>{hours}</b><span>base hours</span></div></div>
            <details className="up-help"><summary>{shown.length === SITES.length ? `All ${shown.length} locations` : shown.length === 1 ? shown[0].name : `${shown.length} locations`}</summary>
              <div className="pub-locs">{shown.map((x) => <span key={x.id}>{x.name.replace(/^(Spinneys|Carrefour) /, '')}</span>)}</div>
            </details>
            {errs.length > 0 && <section className="up-result is-bad" role="alert">
              <div className="up-result-head"><span className="up-big">{errs.length}</span><span><b>Can't publish yet</b><span>{errs.length === 1 ? 'One worker breaks' : `${errs.length} workers break`} the organisation's weekly off rule.</span></span></div>
              <ul className="up-errs">{errs.map((x) => <li key={x.wid}><span className="up-at">{x.closed.length ? 'Off day' : 'No off'}</span><span><b>{W(x.wid).name}</b><span>{x.g.float ? 'Floaters' : siteOf(x.g.site).name}: {errText(x)}</span></span></li>)}</ul>
            </section>}
            <section className="up-list">
              <h3>Before you publish<span className="live-count">3</span></h3>
              <ul>
                <li><span className="sdot warn" /><span><b>Rest period</b><span>Bilal Ahmed: 9 h between Thu evening and Fri morning (minimum 10 h)</span></span></li>
                <li><span className="sdot idle" /><span><b>Two locations</b><span>Rajesh Kumar, Mon: Barsha Heights then Marina Promenade, 7 h gap, 25 min travel</span></span></li>
                <li><span className="sdot crit" /><span><b>Document</b><span>Chinedu Okafor's visa expires before Sat 10</span></span></li>
              </ul>
              <p>These don't stop publishing.</p>
            </section>
            <div className="pub-opts">
              <div className="ma-row"><Toggle id="pub-notify" checked={pubOpt.notify} onChange={(v) => setPubOpt({ ...pubOpt, notify: v })} label={pub[wk] === 'draft' ? <><b>Notify workers</b><small>All {people} get their week in the app</small></> : <><b>Notify changed workers</b><small>Only people whose shifts changed hear about it</small></>} /></div>
              <div className="ma-row"><Toggle id="pub-ack" checked={pubOpt.ack} onChange={(v) => setPubOpt({ ...pubOpt, ack: v })} label={<><b>Ask for acknowledgement</b><small>Workers confirm they've seen their week</small></>} /></div>
            </div>
            <div className="drawer-actions">
              <button className="btn ghost" onClick={() => setPubOpen(false)}>Cancel</button>
              <span className="grow" />
              <button className="btn" disabled={nothing || errs.length > 0} onClick={publish}>{errs.length ? 'Fix weekly offs first' : nothing ? 'Nothing to publish' : pub[wk] === 'draft' ? `Publish to ${people} workers` : 'Publish changes'}</button>
            </div>
          </>;
        })()}
      </Drawer>
      <Drawer open={!!cp} onClose={() => setCp(null)} title={cp && (cp.workers ? `Copy ${W(cp.workers[0]).name}'s week` : cp.stay ? `Copy ${siteOf(cp.sites[0]).name}'s week` : `Copy into ${weekLabel(cp.to)}`)} sub={cp && (cp.workers ? `Only their row is copied · drafts until you publish` : 'The copy is a draft until you publish')}>
        {cp && (() => {
          const targets = Array.from({ length: cp.n }, (_, i) => cp.to + i);
          const src = weeks[cp.from];
          // Rows in scope: the chosen worker anywhere, or everyone at the chosen locations.
          const inGroup = (g) => (cp.workers ? true : !g.float && cp.sites.includes(g.site));
          const rowsOf = (g) => g.cells.filter((_, r) => !cp.workers || cp.workers.includes(g.people[r]));
          const covers = src.filter((g) => cp.workers || g.float || cp.sites.includes(g.site)).flatMap((g) => rowsOf(g).flat()).filter((c) => Array.isArray(c) && c.some((x) => x[3])).length;
          const lv = targets.flatMap((t) => leaveIn(t, cp.workers ? null : cp.sites).filter((l) => !cp.workers || cp.workers.includes(l.worker)).map((l) => ({ t, l })));
          const replaced = targets.filter((t) => has(t));
          const fresh = targets.filter((t) => t <= MAXWK && !has(t));
          const result = copyWeek(src, weeks[cp.to], cp.sites, cp.to, cp.workers);
          const errs = offErrors(result.filter(inGroup)).filter((x) => !cp.workers || cp.workers.includes(x.wid));
          const people = result.filter(inGroup).reduce((n, g) => n + rowsOf(g).length, 0);
          const shifts = result.filter(inGroup).flatMap((g) => rowsOf(g).flat()).filter(Array.isArray).length;
          return <>
            <div className="form-grid">
              <Field label="Copy from"><Select id="cp-from" className="input" value={cp.from} onChange={(e) => setCp({ ...cp, from: +e.target.value })}>
                {Array.from({ length: MAXWK + 2 }, (_, i) => i - 1).filter((k) => has(k) && k !== cp.to).map((k) => <option key={k} value={k}>{weekLabel(k)}{k === 0 ? ' · this week' : k === -1 ? ' · last week' : ''}</option>)}
              </Select></Field>
              <Field label="Repeat for"><Select id="cp-n" className="input" value={cp.n} onChange={(e) => setCp({ ...cp, n: +e.target.value })}>
                {Array.from({ length: MAXWK - cp.to + 1 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? `Just ${weekLabel(cp.to, true)}` : `${n} weeks, to ${weekLabel(cp.to + n - 1, true)}`}</option>)}
              </Select></Field>
            </div>
            {!cp.workers && <Field label="Locations">
              <div className="cp-sites">{shown.map((x) => <label key={x.id} className="cp-site"><input type="checkbox" checked={cp.sites.includes(x.id)} onChange={(e) => setCp({ ...cp, sites: e.target.checked ? [...cp.sites, x.id] : cp.sites.filter((y) => y !== x.id) })} />{x.name}</label>)}</div>
            </Field>}
            <div className="pub-stats">
              <div><span className="stat-value">{people}</span><span className="small muted">{people === 1 ? 'worker' : 'workers'}</span></div>
              <div><span className="stat-value">{shifts}</span><span className="small muted">shifts a week</span></div>
              <div><span className="stat-value">{targets.length}</span><span className="small muted">{targets.length === 1 ? 'week' : 'weeks'}</span></div>
            </div>
            <h3 className="pub-h">What happens</h3>
            <div className="row-line"><Pill tone="good">Copied</Pill><span className="small">Every shift and weekly off, on the same days and times.</span></div>
            {covers > 0 && <div className="row-line"><Pill>Left out</Pill><span className="small">{covers} {covers === 1 ? 'cover' : 'covers'} from {weekLabel(cp.from, true)}. Covers were for that week's absences.</span></div>}
            {lv.length > 0 && <div className="row-line"><Pill tone="info">Leave</Pill><span className="small">Approved leave filled in: {lv.map(({ t, l }) => `${WORKERS.find((w) => w.id === l.worker).name} (${weekLabel(t, true)})`).join(', ')}.</span></div>}
            {replaced.length > 0 && <div className="row-line"><Pill tone="warn">Replaces</Pill><span className="small">{replaced.map((t) => `${weekLabel(t, true)} (${pub[t] === 'published' ? 'published, workers are told when you publish again' : 'draft'})`).join(', ')}, {cp.workers ? `${first(W(cp.workers[0]).name)}'s row only` : 'for these locations'}.</span></div>}
            {cp.workers && fresh.length > 0 && <div className="row-line"><Pill tone="info">New week</Pill><span className="small">{fresh.map((t) => weekLabel(t, true)).join(', ')} {fresh.length === 1 ? 'has' : 'have'} no roster yet, so {fresh.length === 1 ? 'it starts' : 'they start'} with just {first(W(cp.workers[0]).name)}. Everyone else shows as not rostered until you copy or upload them.</span></div>}
            {errs.length > 0 && <div className="row-line"><Pill tone="crit">Weekly off</Pill><span className="small">{errs.length} {errs.length === 1 ? 'worker has' : 'workers have'} no weekly off in the copy. Fix before publishing: {errs.map((x) => W(x.wid).name).join(', ')}.</span></div>}
            <div className="drawer-actions">
              <button className="btn ghost" onClick={() => setCp(null)}>Cancel</button>
              <span className="grow" />
              <button className="btn" disabled={!cp.sites.length && !cp.workers} onClick={doCopy}>{cp.n === 1 ? `Copy into ${weekLabel(cp.to, true)}` : `Copy into ${cp.n} weeks`}</button>
            </div>
          </>;
        })()}
      </Drawer>
      <Drawer open={!!up} onClose={() => setUp(null)} title="Upload a roster" sub={up && `${weekLabel(up.wk)} · ${shown.length === SITES.length ? 'all locations' : shown.length === 1 ? shown[0].name : `${shown.length} locations`}`}>
        {up && up.step === 'pick' && <>
          {upSteps(0)}
          <div className="field"><span className="field-label">Week</span>
            <div className="up-weeks" role="radiogroup" aria-label="Week">
              {Array.from({ length: MAXWK + 1 }, (_, k) => k).map((k) => (
                <button key={k} role="radio" aria-checked={up.wk === k} className={'up-week' + (up.wk === k ? ' on' : '')} onClick={() => setUp({ ...up, wk: k })}>
                  <b>{k === 0 ? 'This week' : k === 1 ? 'Next week' : `In ${k} weeks`}</b><span>{weekLabel(k).replace(/ \d{4}$/, '')}</span>
                  <em className={!has(k) ? '' : pub[k] === 'draft' ? 'draft' : 'live'}>{!has(k) ? 'Empty' : pub[k] === 'draft' ? 'Draft' : 'Published'}</em>
                </button>
              ))}
            </div>
          </div>
          <label className={'up-drop' + (up.over ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); if (!up.over) setUp({ ...up, over: true }); }} onDragLeave={() => setUp({ ...up, over: false })} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) readFile(f, up.wk); }}>
            <input id="up-file" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files[0]; if (f) readFile(f, up.wk); e.target.value = ''; }} />
            <span className="up-drop-ic"><Icon name="upload" size={22} /></span><b>Drop your roster here</b><span>or <u>choose a file</u> · Excel or CSV</span>
          </label>
          <div className="up-row">
            <span className="up-row-ic"><Icon name="document" size={18} /></span>
            <span className="up-row-txt"><b>Start from the template</b><span>Your workers, filled in with {has(up.wk) ? 'this week' : weekLabel(latestBefore(up.wk), true)}</span></span>
            <button className="btn ghost sm" onClick={() => downloadTemplate(up.wk)}><Icon name="download" size={14} />Download</button>
          </div>
          <details className="up-help"><summary>What to type in a day</summary>
            {/* The same examples as the template's "How to fill" sheet, grouped so they scan */}
            {[['Shifts', HOW.slice(1, 4)], ['Special days', HOW.slice(4, 6)], ['Days off', HOW.slice(6, 9)]].map(([g, rows]) => (
              <div key={g} className="up-fmt-group"><span>{g}</span>
                <div className="up-fmt-grid">{rows.map(([a, b]) => <div key={a} className="up-fmt-tile"><code>{a}</code><span>{b}</span></div>)}</div>
              </div>
            ))}
            <p>Columns are matched by name, so your own sheet works too.</p>
          </details>
          <p className="up-note"><Icon name="alert" size={15} />{fixedMode ? `${OFF_RULES.days.map((d) => FULL_DAYS[d]).join(' and ')} ${OFF_RULES.days.length === 1 ? 'is' : 'are'} off for everyone. A file with any shift on ${OFF_RULES.days.length === 1 ? 'that day' : 'those days'} is rejected as a whole.` : `Every worker needs at least ${OFF_RULES.perWeek} weekly off. If any row has a problem, nothing is imported and you get a list of exactly what to fix.`}</p>
          <div className="drawer-actions">
            <button className="btn ghost" onClick={() => setUp(null)}>Cancel</button><span className="grow" />
            <button className="btn ghost" onClick={() => setUp({ ...up, step: 'report', file: `roster-${fileWeek(up.wk)} (sample).xlsx`, aoa: sampleSheet(up.wk, true), map: null, sample: true })}>Try a sample file</button>
          </div>
        </>}
        {up && up.step === 'report' && (() => {
          const sites = shown.map((x) => x.id);
          const res = parseSheet(up.aoa, { wk: up.wk, sites, map: up.map, target: has(up.wk) });
          const headers = res.header;
          const idCol = res.map.id;
          const rowOf = (wid) => { const w = W(wid); for (let i = res.hi + 1; i < up.aoa.length; i++) if (idCol >= 0 && String(up.aoa[i][idCol] ?? '').trim().toLowerCase() === w.code.toLowerCase()) return i + 1; return null; };
          const merged = res.groups ? mergeInto(weeks[up.wk], res.groups, sites, res.seen) : null;
          const scoped = merged ? merged.filter((g) => !g.float && sites.includes(g.site)) : [];
          const offE = merged ? offErrors(scoped).map((x) => ({ row: rowOf(x.wid), col: 'Whole week', msg: `${W(x.wid).name}: ${errText(x)}.` })) : [];
          const errors = [...res.errors, ...offE].sort((a, b) => (a.row || 0) - (b.row || 0));
          const warns = [...res.warnings.map((x) => (x.row ? `Row ${x.row}: ${x.msg}` : x.msg)), ...(merged ? offClashes(scoped).map((x) => `${siteOf(x.site).name}, ${weekDays(up.wk)[x.ci]}: ${x.n} people off on the same day (limit ${OFF_RULES.sameDay}).`) : [])];
          const shifts = scoped.flatMap((g) => g.cells.flat()).filter(Array.isArray).reduce((n, c) => n + c.length, 0);
          const hours = scoped.flatMap((g) => g.cells.flat()).reduce((n, c) => n + shiftHours(c), 0);
          const FIELDS = [['id', 'Staff ID'], ['name', 'Name'], ['site', 'Location'], ...['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ['d' + i, d])];
          const getM = (k) => (k[0] === 'd' ? res.map.days[+k.slice(1)] : res.map[k]);
          const setM = (k, v) => { const m = { ...res.map, days: [...res.map.days] }; if (k[0] === 'd') m.days[+k.slice(1)] = v; else m[k] = v; setUp({ ...up, map: m }); };
          return <>
            {upSteps(errors.length || res.missing.length ? 1 : 2)}
            <div className="up-row">
              <span className="up-row-ic"><Icon name="document" size={18} /></span>
              <span className="up-row-txt"><b>{up.file}</b><span>{res.rows} rows · {FIELDS.filter(([k]) => getM(k) >= 0).length} of {FIELDS.length} columns matched</span></span>
              <button className="btn ghost sm" onClick={() => setUp({ wk: up.wk, step: 'pick' })}>Change</button>
            </div>
            <details className="up-map" open={res.missing.length > 0}>
              <summary>{res.missing.length ? <span className="up-miss">Couldn't find {res.missing.join(', ')}. Pick the right columns</span> : 'Check which column is which'}</summary>
              <div className="up-map-grid">{FIELDS.map(([k, l]) => (
                <label key={k} className="small"><span>{l}</span><Select className="input sm" value={getM(k)} onChange={(e) => setM(k, +e.target.value)}><option value={-1}>Not in the file</option>{headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}</Select></label>
              ))}</div>
            </details>
            {res.missing.length > 0 ? null : errors.length ? <section className="up-result is-bad" role="alert">
              <div className="up-result-head"><span className="up-big">{errors.length}</span><span><b>{errors.length === 1 ? 'Problem' : 'Problems'} to fix</b><span>Nothing was imported. Fix {errors.length === 1 ? 'it' : 'these'} in your file and upload it again.</span></span></div>
              <ul className="up-errs">{errors.slice(0, 6).map((x, i) => <li key={i}><span className="up-at">{x.row ? `Row ${x.row}` : 'File'}</span><span><b>{x.col}</b><span>{x.msg}</span></span></li>)}</ul>
              {errors.length > 6 && <p className="up-more">{errors.length - 6} more in the marked-up file</p>}
              <button className="btn ghost sm" onClick={() => downloadErrors(up, errors)}><Icon name="download" size={14} />Download the file with problems marked</button>
            </section> : <section className="up-result is-ok">
              <div className="up-result-head"><span className="up-ok-ic"><Icon name="check" size={20} /></span><span><b>Ready to import</b><span>{has(up.wk) ? (pub[up.wk] === 'published' ? 'Updates the published week. Workers hear about it when you publish.' : 'Updates the draft.') : 'Saved as a draft until you publish.'}</span></span></div>
              <div className="up-stats"><div><b>{res.seen.size}</b><span>workers</span></div><div><b>{shifts}</b><span>shifts</span></div><div><b>{hours}</b><span>base hours</span></div></div>
            </section>}
            {warns.length > 0 && res.missing.length === 0 && <section className="up-list">
              <h3>Worth a look<span className="live-count">{warns.length}</span></h3>
              <ul>{warns.map((x, i) => <li key={i}><span className="sdot warn" /><span>{x}</span></li>)}</ul>
              <p>These don't stop the import.</p>
            </section>}
            <div className="drawer-actions">
              <button className="btn ghost" onClick={() => setUp({ wk: up.wk, step: 'pick' })}>Back</button>
              <span className="grow" />
              {errors.length || res.missing.length ? (up.sample
                ? <button className="btn" onClick={() => setUp({ ...up, file: `roster-${fileWeek(up.wk)} (fixed).xlsx`, aoa: sampleSheet(up.wk, false), map: null, sample: false })}>Upload the fixed file</button>
                : <label className="btn">Upload the fixed file<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { const f = e.target.files[0]; if (f) readFile(f, up.wk); e.target.value = ''; }} /></label>)
                : <button className="btn" onClick={() => { const t = up.wk; setWeeks((Wk) => ({ ...Wk, [t]: merged })); setPub((x) => ({ ...x, [t]: x[t] === 'published' ? 'published' : 'draft' })); setDirty((d) => ({ ...d, [t]: (d[t] || 0) + 1 })); setWk(t); setUp(null); toast(`Imported ${shifts} shifts into ${weekLabel(t)} · review, then publish`); }}>Import as draft</button>}
            </div>
          </>;
        })()}
      </Drawer>
      <Drawer open={!!day} onClose={() => setDay(null)} title={day && W(G(day.g).people[day.r]).name} sub={day && `${FULL_DAYS[day.c]} ${days[day.c].split(' ').slice(1).join(' ')} · ${isPool ? 'Floater' : siteOf(site).name}`}>
        {day && day.ro && (() => {
          const wid = dayWorker.id; const live = day.ro === 'today' ? SITES.flatMap((x) => liveOf(x.id)).filter((x) => x.w.id === wid) : [];
          const sorted = [...list].sort((a, b) => toMin(a[1]) - toMin(b[1]));
          const cv = cur === 'L' && covBy(wid, day.c);
          return <>
            {list.length > 0 && <DayTimeline list={list} home={site} note={(x) => { const k = sorted.indexOf(x); const lv = live.find((y) => y.start === x[1]);
              const [label, tone] = day.ro === 'past' ? (missed(day.g, wid, day.c + k * 3) ? ['Missed', 'crit'] : ['Clocked in', 'good']) : lv ? [['in', 'late', 'break'].includes(lv.status) ? `${LV[lv.status][0]} · since ${hm(lv.inAt)}` : LV[lv.status][0], LV[lv.status][1]] : ['Later today', 'muted'];
              return <span className={'vday-status ' + tone}>{label}</span>; }} />}
            {list.length === 0 && <p className="muted">{cur === 'O' ? 'Weekly off.' : cur === 'L' ? `On annual leave${cv ? `, covered by ${cv.w.name}` : ''}.` : cur === 'A' ? 'Available, not called in.' : 'Not rostered.'}</p>}
            <div className="ro-note">
              <span className="small">{day.ro === 'past' ? 'This day is done, so the roster is fixed. Corrections to hours go in the timesheet.' : `${first(dayWorker.name)} has clocked in, so today's roster is fixed. Corrections go in the timesheet.`}</span>
              <button className="btn sm ghost" onClick={() => go('workforce', { worker: wid, tab: 'Timesheet' })}>Open timesheet</button>
            </div>
          </>;
        })()}
        {day && !day.ro && (() => {
          const editingX = ed && list.find((y) => y.join() === ed.key);
          const tlList = editingX ? list.filter((y) => y !== editingX) : list;
          const ghost = editingX ? mk(ed.t, ed.st, ed.site) : adding ? mk(add.t, add.st, add.site) : null;
          const row = G(day.g).cells[day.r];
          const prevG = has(wk - 1) && weeks[wk - 1].find((g) => g.site === day.g);
          const raw = prevG && prevG.cells[day.r] && prevG.cells[day.r][day.c];
          const prev = Array.isArray(raw) ? (raw.filter((y) => !y[3]).length ? raw.filter((y) => !y[3]) : null) : raw === 'O' || raw === 'X' || raw === 'A' ? raw : null;
          const showPrev = prev && cur !== 'L' && JSON.stringify(prev) !== JSON.stringify(cur);
          const covering = list.some((y) => y[3]) || list.some((y) => coverFor(dayWorker.id, day.c, y));
          const canOff = cur !== 'O' && cur !== 'L' && !covering && !isPool;
          const canRep = (d) => d !== day.c && d >= (nowIdx < 0 ? 0 : nowIdx) && row[d] !== 'L' && !(fixedMode && OFF_RULES.days.includes(d));
          const same = (d) => JSON.stringify(row[d]) === JSON.stringify(cur);
          const fields = (v, set, pre) => (
            <div className="sf-grid">
              <Field label="Length"><Select id={pre + '-t'} className="input" value={v.t} onChange={(e) => set({ ...v, t: e.target.value })}>{SHIFT_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{tplLabel(t)}</option>)}</Select></Field>
              <Field label="Starts" hint={`Ends ${endOf(v.st, spanOf(tplOf(v.t))).time}${endOf(v.st, spanOf(tplOf(v.t))).nextDay ? ' next day' : ''}`}><input id={pre + '-st'} type="time" className="input mono" value={v.st} onChange={(e) => set({ ...v, st: e.target.value || v.st })} /></Field>
              <Field label="Location"><Select id={pre + '-site'} className="input" value={v.site} onChange={(e) => set({ ...v, site: e.target.value })}>{SITES.map((y) => <option key={y.id} value={y.id}>{y.name}{y.id === site ? ' (theirs)' : ''}</option>)}</Select></Field>
            </div>
          );
          const checkLines = (cs) => cs.length > 0 && <ul className="ds-checks">{cs.map(([tone, tag, msg], k) => <li key={k}><span className={'sdot ' + tone} /><span><b>{tag}</b><span>{msg}</span></span></li>)}</ul>;
          return <>
            {cur === 'L' && (() => { const cv = covBy(dayWorker.id, day.c); const sh0 = usual(row)[0]; return (
              <section className={'cv-status' + (cv ? ' ok' : '')}>
                {cv ? <>
                  <div><b>On leave · covered by {cv.w.name}</b><div className="small muted"><span className="vtag">{vendorOf(cv.w.vendor).code}</span> {isFloat(cv.w) ? `Floater · ${cv.w.homeArea}` : siteOf(cv.g).name} · {cv.sh[1]} to {endOf(cv.sh[1], spanOf(tplOf(cv.sh[0]))).time}</div></div>
                  <button className="btn sm ghost" onClick={() => { setCell(cv.g, cv.r, day.c, undoCell(G(cv.g).cells[cv.r][day.c], dayWorker.id)); toast(`Cover removed · ${first(cv.w.name)} notified`); }}>Remove cover</button>
                </> : <>
                  <div><b>On leave · not covered yet</b><div className="small muted">Usual shift {sh0[1]} to {endOf(sh0[1], spanOf(tplOf(sh0[0]))).time}</div></div>
                  <button className="btn sm" onClick={() => findCover(dayWorker.id, day.g, day.c, sh0, 'Annual leave')}>Find cover</button>
                </>}
              </section>
            ); })()}
            {cur === 'O' && !adding && <section className="day-state"><div><b>Weekly off</b><div className="small muted">A shift today is paid as rest-day work.</div></div><button className="btn sm ghost" onClick={() => setAdding(true)}>Add a shift anyway</button></section>}
            {(tlList.length > 0 || ghost) && <DayTimeline list={tlList} ghost={ghost} home={site}
              note={(x) => { const cv = !x[3] && coverFor(dayWorker.id, day.c, x); return cv ? <span className="vday-note">Covered by {cv.w.name}</span> : null; }}
              acts={(x) => { const key = x.join(); const cv = !x[3] && coverFor(dayWorker.id, day.c, x);
                const removeShift = () => { const nl = list.filter((y) => y !== x); setCell(day.g, day.r, day.c, nl.length ? nl : x[3] ? (x[4] || 'A') : isPool ? 'A' : 'X'); if (cv) setCell(cv.g, cv.r, day.c, undoCell(G(cv.g).cells[cv.r][day.c], dayWorker.id)); toast(x[3] ? `Cover removed · ${first(W(x[3]).name)}'s day is uncovered again` : cv ? `Shift removed · ${first(cv.w.name)}'s cover cancelled` : 'Shift removed'); };
                return <>
                  {!x[3] && <button className="vbtn" onClick={() => { setAdding(false); setEd({ key, t: x[0], st: x[1], site: x[2] || (isPool ? (shown[0] || SITES[0]).id : site) }); }}>Edit</button>}
                  <button className="vbtn icon" aria-label="More for this shift" onClick={(e) => menu.open(e, fmtShift(x), [
                    !x[3] && !cv && { icon: 'users', label: 'Find cover', sub: 'Someone else works this shift', on: () => findCover(dayWorker.id, x[2] || day.g, day.c, x, 'Can\'t make this shift') },
                    cv && { icon: 'users', label: 'Remove cover', sub: `${first(cv.w.name)} is told`, on: () => { setCell(cv.g, cv.r, day.c, undoCell(G(cv.g).cells[cv.r][day.c], dayWorker.id)); toast(`Cover removed · ${first(cv.w.name)} notified`); } },
                    { icon: 'trash', label: x[3] ? 'Remove this cover' : 'Remove shift', danger: true, on: removeShift },
                  ])}><Icon name="more" size={16} /></button>
                </>; }} />}
            {editingX && (() => { const x = editingX; const cv = !x[3] && coverFor(dayWorker.id, day.c, x); const swapped = list.map((y) => (y === x ? mk(ed.t, ed.st, ed.site) : y)); const eChecks = dayChecks(swapped.map(norm), site); return (
              <div className="ds-item editing ds-new"><div className="ds-form">
                <div className="ds-form-title">Change {fmtShift(x)}</div>
                {fields(ed, setEd, 'ed')}
                {checkLines(eChecks)}
                {cv && <div className="small muted">{first(cv.w.name)} keeps covering the old times. Remove the cover first if the shift moves.</div>}
                <div className="ds-form-acts"><button className="btn ghost sm" onClick={() => setEd(null)}>Cancel</button><button className="btn sm" disabled={eChecks.some(([t]) => t === 'crit')} onClick={() => { setCell(day.g, day.r, day.c, swapped.map(norm)); setEd(null); toast('Shift updated'); }}>Save</button></div>
              </div></div>
            ); })()}
            {cur !== 'L' && (adding ? <div className="ds-item editing ds-new">
              <div className="ds-form">
                <div className="ds-form-title">{list.length ? 'Another shift' : 'New shift'}</div>
                {fields(add, setAdd, 'as')}
                {checkLines(checks)}
                <div className="ds-form-acts">{(list.length > 0 || cur === 'O') && <button className="btn ghost sm" onClick={() => setAdding(false)}>Cancel</button>}<button className="btn sm" disabled={checks.some(([t]) => t === 'crit')} onClick={() => { setCell(day.g, day.r, day.c, preview.map(norm)); setAdding(false); toast(add.site !== site ? `Shift added · also shows under ${siteOf(add.site).name}` : 'Shift added'); }}>Add shift</button></div>
              </div>
            </div> : cur !== 'O' && !ed && <button className="ds-add" onClick={() => { const last = list.reduce((m, y) => Math.max(m, toMin(y[1]) + spanOf(tplOf(y[0])) * 60), -1); setAdd({ ...add, t: list.length ? 'f7' : add.t, st: last >= 0 ? hm(Math.min(last + 60, 23 * 60)) : add.st }); setAdding(true); }}><Icon name="plus" size={15} /> Add {list.length ? 'another ' : 'a '}shift</button>)}
            {list.length > 0 && !list.some((x) => x[3]) && !adding && !ed && <section className="ds-copy">
              <div className="ds-copy-head"><b>Copy this day to</b><button className="linkbtn small" onClick={() => setRep(days.map((_, i) => i).filter((i) => canRep(i) && row[i] !== 'O' && !same(i)))}>All working days</button></div>
              <div className="rep-days">{days.map((d, i) => <button key={i} className={'wk-day' + (rep.includes(i) ? ' on' : '') + (same(i) && i !== day.c ? ' same' : '')} disabled={!canRep(i)} aria-pressed={rep.includes(i)} title={row[i] === 'L' ? 'On leave' : i === day.c ? 'This day' : same(i) ? 'Already the same' : d} onClick={() => setRep(rep.includes(i) ? rep.filter((x) => x !== i) : [...rep, i])}>{d.slice(0, 2)}</button>)}
                {rep.length > 0 && <button className="btn sm" onClick={() => { setCells(day.g, day.r, rep, cur); toast(`Copied to ${rep.length} ${rep.length === 1 ? 'day' : 'days'}${rep.some((i) => row[i] === 'O') ? ' · that includes a weekly off' : ''}`); setRep([]); }}>Copy to {rep.length} {rep.length === 1 ? 'day' : 'days'}</button>}</div>
            </section>}
            {(showPrev || canOff || cur === 'O') && !ed && <div className="ds-foot">
              {showPrev && <button className="linkbtn small" onClick={() => { setCell(day.g, day.r, day.c, prev); setAdding(false); toast(`Same as last ${days[day.c].split(' ')[0]}`); }}>Same as last week ({shotText(prev, site).join(', ')})</button>}
              {canOff && <button className="linkbtn small" onClick={() => { setCell(day.g, day.r, day.c, 'O'); setAdding(false); toast(`${days[day.c]} is now ${first(dayWorker.name)}'s weekly off`); }}>Make this a weekly off</button>}
              {cur === 'O' && <button className="linkbtn small" onClick={() => { setCell(day.g, day.r, day.c, 'X'); toast('No longer a weekly off'); }}>Not a weekly off</button>}
            </div>}
          </>;
        })()}
      </Drawer>
      <Drawer open={!!clr} onClose={() => setClr(null)} title={clr && `Clear days · ${W(G(clr.g).people[clr.r]).name}`} sub={weekLabel(wk)}>
        {clr && (() => {
          const row = G(clr.g).cells[clr.r]; const blank = clr.g === 'pool' ? 'A' : 'X';
          const can = (i) => i >= (nowIdx < 0 ? 0 : nowIdx) && row[i] !== 'L' && row[i] !== blank && !(wk === 0 && i === TODAY && Array.isArray(row[i]) && clockedIn(G(clr.g).people[clr.r]));
          const covering = clr.days.filter((i) => Array.isArray(row[i]) && row[i].some((y) => y[3]));
          // People covering this worker on the picked days: their cover goes when the shift goes.
          const covered = clr.days.flatMap((i) => (Array.isArray(row[i]) ? row[i].filter((y) => !y[3]).map((y) => ({ i, cv: coverFor(G(clr.g).people[clr.r], i, y) })).filter((x) => x.cv) : []));
          return <>
            <div className="small muted">Picked days become {blank === 'A' ? 'available' : 'not rostered'}. Past days, leave and days already clocked in can't be cleared.</div>
            <div className="rep-days">{days.map((d, i) => <button key={i} className={'wk-day' + (clr.days.includes(i) ? ' on' : '')} disabled={!can(i)} aria-pressed={clr.days.includes(i)} title={row[i] === 'L' ? 'On leave' : !can(i) ? 'Can\'t clear' : d} onClick={() => setClr({ ...clr, days: clr.days.includes(i) ? clr.days.filter((x) => x !== i) : [...clr.days, i] })}>{d.slice(0, 2)}</button>)}
              <button className="linkbtn small" onClick={() => setClr({ ...clr, days: days.map((_, i) => i).filter((i) => can(i) && row[i] !== 'O') })}>All working days</button></div>
            {clr.days.length > 0 && <div className="small">{[...clr.days].sort().map((i) => `${days[i]}: ${shotText(row[i], clr.g).join(', ')}`).join(' · ')}</div>}
            {clr.days.some((i) => row[i] === 'O') && <div className="row-line"><Pill tone="warn">Weekly off</Pill><span className="small">Clearing a weekly off can leave the week without one; it can't be published until there is one again.</span></div>}
            {covered.length > 0 && <div className="row-line"><Pill tone="info">Cover</Pill><span className="small">{covered.map(({ i, cv }) => `${first(cv.w.name)}'s cover on ${days[i]}`).join(', ')} is cancelled too.</span></div>}
            {covering.length > 0 && <div className="row-line"><Pill tone="warn">Cover</Pill><span className="small">They're covering someone on {covering.map((i) => days[i]).join(', ')}. That person's day becomes uncovered again.</span></div>}
            <div className="drawer-actions">
              <button className="btn ghost" onClick={() => setClr(null)}>Cancel</button>
              <span className="grow" />
              <button className="btn ghost danger" disabled={!clr.days.length} onClick={() => { setCells(clr.g, clr.r, clr.days, blank); covered.forEach(({ i, cv }) => setCell(cv.g, cv.r, i, undoCell(G(cv.g).cells[cv.r][i], G(clr.g).people[clr.r]))); toast(`Cleared ${clr.days.length} ${clr.days.length === 1 ? 'day' : 'days'} for ${first(W(G(clr.g).people[clr.r]).name)}`); setClr(null); }}>{clr.days.length ? `Clear ${clr.days.length} ${clr.days.length === 1 ? 'day' : 'days'}` : 'Pick days'}</button>
            </div>
          </>;
        })()}
      </Drawer>
      {shot && <div className="shot-wrap" aria-hidden="true"><div className="shot" ref={shotRef}>
        <div className="shot-head"><b>{shot.kind === 'worker' ? W(G(shot.sid).people[shot.r]).name : siteOf(shot.sid).name}</b><span>{weekLabel(wk)}</span></div>
        <table className="shot-t"><thead><tr><th>{shot.kind === 'loc' ? 'Worker' : 'Location'}</th>{days.map((d) => <th key={d}>{d}</th>)}</tr></thead>
          <tbody>{shotRows().map((x) => <tr key={x.w.id + (x.key || '') + (x.visiting ? 'v' : '')}>{shot.kind === 'loc' ? <td className="shot-who"><b>{x.w.name}</b><span>{x.visiting ? 'From another location' : x.w.role}</span></td> : <td className="shot-who"><b>{x.label}</b>{x.home === shot.sid && shot.sid !== 'pool' && <span>Their location</span>}</td>}{x.cells.map((c, i) => <td key={i} className={c === 'O' || c === 'L' ? 'shot-off' : ''}>{shotText(c, x.home).map((t, k) => <div key={k}>{t}</div>)}</td>)}</tr>)}</tbody></table>
        <div className="shot-foot">OpsPro · {pub[wk] === 'published' ? 'published roster' : 'draft, not yet published'}</div>
      </div></div>}
      {menu.el}
      <CoverDrawer open={!!cover} onClose={() => setCover(null)} onAssign={assign}
        ctx={cover && { site: cover.site, ci: cover.ci, absent: cover.absent, sh: cover.sh, dayLabel: days[cover.ci], groups, why: cover.why || 'Absent' }} />
    </>
  );
}
