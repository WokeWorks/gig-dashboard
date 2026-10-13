import { ROSTER_GROUPS, tplOf, endOf } from '../data.js';
import { coverOf } from './cover.jsx';
import { addMin } from './dates.js';

// A worker's weekly off follows a pattern: the day it falls on in their roster.
export const offDaysOf = (wid) => { for (const g of ROSTER_GROUPS) { const r = g.people.indexOf(wid); if (r >= 0) { const ds = g.cells[r].map((c, i) => (c === 'O' ? i : -1)).filter((i) => i >= 0); return ds.length ? ds : 'rot'; } } return [4]; };

// Timesheet for a worker: built from their roster and clock-ins. No clock-in means absent; a forgotten clock-out is closed automatically.
export let _weeksCache = null;

export const weeksAll = () => (_weeksCache = _weeksCache || { '-1': shiftWeek(ROSTER_GROUPS, -1, false), 0: ROSTER_GROUPS, 1: shiftWeek(ROSTER_GROUPS, 1, true) });

// Whether a rostered shift was missed (deterministic). The original 42 workers keep their scripted misses;
// the rest of the workforce misses about one shift in 40, closer to a real store.
export const missedAt = (sid, wid, wk, ci) => { const n = parseInt(wid.slice(1), 10); const h = sid.charCodeAt(1) * 7 + n * 3 + ci * 5 + (wk + 1) * 11; return n < 42 ? h % 7 === 0 : h % 41 === 0; };

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
    if (date === 7) { days.push({ iso, kind: 'Today', shift: `${st}–${endOf(st, T.base + (T.brk || 0)).time}`, inT: addMin(st, -(n % 6)) }); continue; }
    if (missedAt(g.site, w.id, wk, ci)) { days.push({ iso, kind: 'Absent', shift: `${st}–${endOf(st, T.base + (T.brk || 0)).time}` }); continue; }
    const late = n % 7 === 3 && ci === 1 ? 14 : 0; const stay = T.base >= 10 && n % 3 === 0 ? 1 : 0; /* overtime, verified separately */ const auto = (n + date) % 9 === 0;
    const worked = +(T.base - late / 60 + stay).toFixed(1);
    days.push({ iso, kind: 'Full', shift: `${st}–${endOf(st, T.base + (T.brk || 0)).time}`, inT: addMin(st, late ? late : -(n % 6)), outT: auto ? 'auto' : addMin(st, (T.base + (T.brk || 0) + stay) * 60 + (n % 4)), worked, ot: stay, late });
  }
  const sum = { full: days.filter((x) => x.kind === 'Full').length, absent: days.filter((x) => x.kind === 'Absent').length, hours: days.reduce((a, x) => a + (x.worked || 0), 0), ot: days.reduce((a, x) => a + (x.ot || 0), 0) };
  return { days, sum };
};

export const shiftHours = (cell) => (Array.isArray(cell) ? cell.reduce((a, [t]) => a + tplOf(t).base, 0) : 0);

export const shiftBrk = (cell) => (Array.isArray(cell) ? cell.reduce((a, [t]) => a + (tplOf(t).brk || 0), 0) : 0);

export const UNACK = ['w2', 'w9', 'w14']; // haven't acknowledged the published roster

// Another week of roster: offs start on the same day as the week before (the manager moves them as needed); leave becomes the worker's usual shift; a draft has a few days not yet filled in (Off).
export const usual = (row) => row.find((c) => Array.isArray(c) && c.length === 1) || [['f5', '07:00']];

export const shiftWeek = (groups, n, draft) => groups.map((g, gi) => ({ ...g, cells: g.cells.map((row, r) => {
  const out = row.map((c, d) => { if (c === 'O') return 'O'; if (g.float) return n === 0 ? c : 'A'; if (n !== 0 && draft && (r + gi + d) % 9 === 0) return 'X'; if (n !== 0 && (c === 'L' || c === 'X')) return usual(row); return c; });
  // Someone whose off fell inside their leave still needs one: give it back on the first of those days.
  if (n !== 0 && !out.includes('O')) { const k = row.indexOf('L'); if (k >= 0) out[k] = 'O'; }
  return out;
}) }));
