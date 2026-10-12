import { WORKERS, ROSTER_GROUPS, tplOf, tplLabel, endOf } from '../data.js';
import { toM } from './dates.js';
import { missedAt, timesheetOf } from './roster.js';

// Live board: who is in right now, location by location. Built from today's roster (Wed 7 Oct) and clock-ins.
export const NOW_MIN = 10 * 60 + 24; // 10:24

export const liveOf = (sid) => {
  const g = ROSTER_GROUPS.find((x) => x.site === sid);
  const out = [];
  const add = (w, sh, visiting) => {
    const [t, st] = sh; const T = tplOf(t); const s0 = toM(st); const e0 = s0 + (T.base + (T.brk || 0)) * 60; const n = parseInt(w.id.slice(1), 10);
    let status, inAt = null, late = 0;
    if (s0 > NOW_MIN) status = 'upcoming';
    else if (missedAt(sid, w.id, 0, 2) || w.status === 'No-show') status = NOW_MIN - s0 >= 60 ? 'noshow' : 'waiting';
    else { late = w.status === 'Late' || n % 11 === 4 ? 14 + (n % 3) * 6 : 0; inAt = s0 + (late || -(n % 5)); status = w.status === 'On break' ? 'break' : late ? 'late' : 'in'; }
    out.push({ w, t, start: st, end: endOf(st, T.base + (T.brk || 0)).time, s0, e0, status, inAt, late, visiting, label: tplLabel(T) });
  };
  if (g) g.people.forEach((id, r) => { const c = g.cells[r][2]; if (Array.isArray(c)) c.filter((x) => !x[2] || x[2] === sid).forEach((sh) => add(WORKERS.find((w) => w.id === id), sh, false)); });
  ROSTER_GROUPS.forEach((og) => { if (og.site === sid) return; og.people.forEach((id, r) => { const c = og.cells[r][2]; if (Array.isArray(c)) c.filter((x) => x[2] === sid).forEach((sh) => add(WORKERS.find((w) => w.id === id), sh, true)); }); });
  return out;
};

export const LV = { noshow: ['No-show', 'crit', 0], late: ['Late', 'warn', 1], waiting: ['Not in yet', 'muted', 2], break: ['On break', 'info', 3], in: ['In', 'good', 4], upcoming: ['Later today', 'faint', 5], covered: ['Covered', 'muted', 6], absent: ['Absent', 'muted', 7] };

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
