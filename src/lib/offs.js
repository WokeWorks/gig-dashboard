import { FULL_DAYS } from './dates.js';
import { usual, shiftWeek } from './roster.js';

// One set of rules per client (Settings → Cover rules). Nothing below knows about a particular client:
// Weekly offs are never set per worker: the roster decides them each week, staggered so every location stays covered.
// These limits are what the roster checks against (edited in Settings → Attendance rules).
export const OFF_RULES = { perWeek: 1, maxRun: 6, sameDay: 5, mode: 'roster', days: [6] }; // mode: 'roster' (staggered) | 'fixed' (same days for everyone; days are 0 = Mon … 6 = Sun)

// With a fixed off, those days are off for everyone on every roster (leave stays leave).
// Offs on any other day turn back into the worker's usual shift (floaters go back to available).
export const fixedOff = (groups) => (OFF_RULES.mode !== 'fixed' ? groups : groups.map((g) => ({ ...g, cells: g.cells.map((row) => row.map((c, d) => (OFF_RULES.days.includes(d) ? (c === 'L' ? c : 'O') : c === 'O' ? (g.float ? 'A' : row.find((x) => Array.isArray(x) && x.length === 1) || c) : c))) })));

// Weekly off checks, used on upload and before publishing. A worker rostered on more days than 7 minus the
// org's weekly offs is an error: the roster is rejected. Too many off at one location on one day is only a warning.
export const offErrors = (groups) => groups.flatMap((g) => g.cells.map((row, r) => ({ g, r, wid: g.people[r], worked: row.filter((c) => Array.isArray(c)).length, closed: OFF_RULES.mode === 'fixed' ? OFF_RULES.days.filter((d) => Array.isArray(row[d])) : [] })).filter((x) => x.closed.length || x.worked > 7 - OFF_RULES.perWeek));

export const errText = (x) => (x.closed.length ? `rostered on ${x.closed.map((d) => FULL_DAYS[d]).join(' and ')}, the organisation's weekly off` : `all ${x.worked} days rostered`);

export const offPerWeek = () => (OFF_RULES.mode === 'fixed' ? OFF_RULES.days.length : OFF_RULES.perWeek);

export const offClashes = (groups) => OFF_RULES.mode === 'fixed' ? [] : groups.filter((g) => !g.float).flatMap((g) => [0, 1, 2, 3, 4, 5, 6].map((ci) => ({ site: g.site, ci, n: g.cells.filter((row) => row[ci] === 'O').length })).filter((x) => x.n > OFF_RULES.sameDay));

// The uploaded file in the demo: next week, with two people rostered all seven days.
export const badUpload = (groups) => { const w = fixedOff(shiftWeek(groups, 1, false)); return w.map((g, gi) => (gi === 0 || gi === 3 ? { ...g, cells: g.cells.map((row, r) => (r === 1 ? row.map((c) => (c === 'O' ? usual(row) : c)) : row)) } : g)); };
