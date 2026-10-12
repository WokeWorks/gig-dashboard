// Getting rosters in and out: copying weeks, the upload template, and reading an uploaded file.
// A supervisor should be able to fill a week in seconds, so the file format is forgiving:
// columns are found by name, times can be "07:00-18:00", "7-18", "7am to 6pm" or "07:00 11h",
// and every problem is reported against the exact row and day it came from.
import { WORKERS, SITES, LEAVE, ROSTER_GROUPS, SHIFT_TEMPLATES, endOf, siteOf } from '../data.js';
import { WEEK0 } from './dates.js';
import { usual } from './roster.js';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ISO date and short label for each day of a week (wk = weeks from the week of Mon 5 Oct 2026).
export const isoOf = (wk, d) => { const x = new Date(WEEK0); x.setDate(x.getDate() + wk * 7 + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const dayHead = (wk, d) => { const x = new Date(WEEK0); x.setDate(x.getDate() + wk * 7 + d); return `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]} ${x.getDate()} ${MON[x.getMonth()]}`; };

// A week with nobody rostered yet: floaters available, everyone else not rostered.
export const emptyWeek = (base = ROSTER_GROUPS) => base.map((g) => ({ ...g, cells: g.people.map(() => Array(7).fill(g.float ? 'A' : 'X')) }));

// Approved leave that falls in the week replaces whatever was planned that day.
export const applyLeave = (groups, wk) => {
  const dates = DAY_KEYS.map((_, d) => isoOf(wk, d));
  const off = {};
  LEAVE.filter((l) => l.status === 'Approved' && !l.half).forEach((l) => dates.forEach((iso, d) => { if (iso >= l.from && iso <= l.to) (off[l.worker] = off[l.worker] || new Set()).add(d); }));
  return groups.map((g) => ({ ...g, cells: g.cells.map((row, r) => row.map((c, d) => (off[g.people[r]] && off[g.people[r]].has(d) ? 'L' : c))) }));
};
export const leaveIn = (wk, sites) => {
  const dates = DAY_KEYS.map((_, d) => isoOf(wk, d));
  return LEAVE.filter((l) => l.status === 'Approved' && !l.half && dates.some((iso) => iso >= l.from && iso <= l.to) && (!sites || sites.includes(WORKERS.find((w) => w.id === l.worker)?.site)));
};

// Copy one week onto another, for the chosen locations only. What carries over is the plan:
// shifts and weekly offs. One-off things don't: covers are undone, leave turns back into the usual shift,
// and floaters go back to available (keeping their offs). Approved leave in the target week is filled in after.
export const copyWeek = (src, target, sites, wk) => {
  const tgt = target || emptyWeek();
  const clean = (g) => g.cells.map((row) => row.map((c) => {
    if (c === 'L') return g.float ? 'A' : usual(row);
    if (!Array.isArray(c)) return c;
    const mine = c.filter((x) => !x[3]);
    if (mine.length === c.length) return c;
    if (mine.length) return mine;
    const was = c.find((x) => x[3])?.[4];
    return was && was !== 'L' ? was : g.float ? 'A' : 'X';
  }));
  const out = tgt.map((g) => {
    const s = src.find((x) => x.site === g.site);
    const inScope = g.float || sites.includes(g.site);
    return inScope && s ? { ...g, cells: clean(s) } : g;
  });
  return applyLeave(out, wk);
};

/* ---------- writing the template ---------- */
const short = (name) => name.replace(/^(Spinneys|Carrefour) /, '');
export const cellText = (c, home) => {
  if (c === 'O') return 'OFF';
  if (c === 'L') return 'LEAVE';
  if (!Array.isArray(c)) return '';
  return c.filter((x) => !x[3]).map(([t, st, s2]) => {
    const T = SHIFT_TEMPLATES.find((x) => x.id === t);
    return `${st}-${endOf(st, T.base).time}${s2 && s2 !== home ? ' @ ' + short(siteOf(s2).name) : ''}`;
  }).join(' + ');
};
// One row per worker at the chosen locations, one column per day, filled from `groups` (or blank).
export const templateRows = (groups, sites, wk) => {
  const head = ['Staff ID', 'Name', 'Location', ...DAY_KEYS.map((_, d) => dayHead(wk, d))];
  const rows = [];
  sites.forEach((sid) => {
    const g = groups && groups.find((x) => x.site === sid);
    const base = ROSTER_GROUPS.find((x) => x.site === sid);
    base.people.forEach((wid, r) => {
      const w = WORKERS.find((x) => x.id === wid);
      rows.push([w.code, w.name, siteOf(sid).name, ...DAY_KEYS.map((_, d) => (g ? cellText(g.cells[r][d], sid) : ''))]);
    });
  });
  return [head, ...rows];
};

/* ---------- reading a file ---------- */
const norm = (s) => String(s ?? '').trim().toLowerCase();
const FIELDS = {
  id: /^(staff|emp(loyee)?|worker|op)?\s*(id|no\.?|number|code|#)$|^id$|^code$|staff id|emp(loyee)? (id|no|code)/,
  name: /name/,
  site: /loc|store|site|branch|outlet/,
};
// Which column holds what. Days are found by weekday name or by a date in the week.
export function detectColumns(header, wk) {
  const h = header.map(norm);
  const map = { id: -1, name: -1, site: -1, days: Array(7).fill(-1) };
  h.forEach((x, i) => {
    if (!x) return;
    const dk = DAY_KEYS.findIndex((k) => x.startsWith(k));
    if (dk >= 0 && map.days[dk] < 0) { map.days[dk] = i; return; }
    const iso = DAY_KEYS.map((_, d) => isoOf(wk, d));
    const asDate = /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : null;
    if (asDate && iso.includes(asDate)) { map.days[iso.indexOf(asDate)] = i; return; }
    if (map.id < 0 && FIELDS.id.test(x)) { map.id = i; return; }
    if (map.name < 0 && FIELDS.name.test(x)) { map.name = i; return; }
    if (map.site < 0 && FIELDS.site.test(x)) { map.site = i; }
  });
  return map;
}
// The header row is the first of the top few rows that names at least three days.
export const findHeader = (aoa) => {
  for (let i = 0; i < Math.min(aoa.length, 6); i++) if ((aoa[i] || []).filter((x) => DAY_KEYS.some((k) => norm(x).startsWith(k))).length >= 3) return i;
  return 0;
};

const toMinOf = (h, m, ap) => { let hh = +h; if (ap) { ap = ap.toLowerCase(); if (ap === 'pm' && hh < 12) hh += 12; if (ap === 'am' && hh === 12) hh = 0; } return hh * 60 + (+m || 0); };
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const findSite = (txt) => { const t = norm(txt); if (!t) return null; return SITES.find((s) => norm(s.name) === t || norm(short(s.name)) === t || norm(s.code) === t || norm(s.name).includes(t)) || null; };
const RANGE = /^(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)?$/i;
const LENGTH = /^(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)?\s+(\d{1,2}(?:\.5)?)\s*h(?:rs?|ours?)?$/i;

// One cell of the file → a roster cell, or an error message.
export function parseCell(raw, home) {
  const t = String(raw ?? '').trim();
  if (!t || /^(-|–|x|n\/?a)$/i.test(t)) return { cell: 'X' };
  if (/^(off|o|wo|w\/o|weekly off|rest|rest day)$/i.test(t)) return { cell: 'O' };
  if (/^(leave|l|al|annual leave|sick|sl|vacation)$/i.test(t)) return { cell: 'L' };
  const parts = t.split(/\s*(?:\+|,|;|\/|&|\band\b)\s*/i).filter(Boolean);
  const shifts = [];
  for (const p of parts) {
    const [when, where] = p.split(/\s*@\s*/);
    let s0, len;
    let m = when.match(RANGE);
    if (m) {
      s0 = toMinOf(m[1], m[2], m[3]); let e = toMinOf(m[4], m[5], m[6]);
      // "7-6" with no am/pm means 7 in the morning to 6 in the evening; "14-1" runs past midnight.
      if (!m[3] && !m[6] && s0 < 12 * 60 && e <= s0 && e < 12 * 60) e += 12 * 60;
      len = (((e - s0) % 1440) + 1440) % 1440 / 60;
    }
    else if ((m = when.match(LENGTH))) { s0 = toMinOf(m[1], m[2], m[3]); len = +m[4]; }
    else return { error: `Can't read "${p}". Use a time range like 07:00-18:00, or OFF, or LEAVE.` };
    const T = SHIFT_TEMPLATES.find((x) => x.base === len) || SHIFT_TEMPLATES.find((x) => x.base + x.ot === len);
    if (!T) return { error: `"${p}" is ${len} h. Shifts in Settings are ${SHIFT_TEMPLATES.map((x) => x.base + ' h').join(', ')}.` };
    let site;
    if (where) { const s = findSite(where); if (!s) return { error: `No location called "${where}".` }; site = s.id; }
    shifts.push(site && site !== home ? [T.id, hhmm(s0), site] : [T.id, hhmm(s0)]);
  }
  shifts.sort((a, b) => a[1].localeCompare(b[1]));
  for (let k = 1; k < shifts.length; k++) {
    const a = shifts[k - 1], b = shifts[k]; const ta = SHIFT_TEMPLATES.find((x) => x.id === a[0]);
    const [ah, am] = a[1].split(':').map(Number); const [bh, bm] = b[1].split(':').map(Number);
    if (bh * 60 + bm < ah * 60 + am + ta.base * 60) return { error: `Shifts overlap: ${t}` };
  }
  return { cell: shifts };
}

// Read a whole sheet (array of rows) into a week. Everything is checked; nothing is half-imported.
// errors: [{ row, col, msg }] with 1-based spreadsheet row numbers and the column's header text.
export function parseSheet(aoa, { wk, sites, map: given, target }) {
  const hi = findHeader(aoa);
  const header = (aoa[hi] || []).map((x) => String(x ?? ''));
  const map = given || detectColumns(header, wk);
  const errors = [], warnings = [];
  const missing = [];
  if (map.id < 0 && map.name < 0) missing.push('Staff ID or Name');
  map.days.forEach((c, d) => { if (c < 0) missing.push(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]); });
  if (missing.length) return { header, hi, map, missing, errors, warnings, groups: null, rows: 0 };
  const groups = emptyWeek();
  const seen = new Set();
  let rows = 0;
  for (let i = hi + 1; i < aoa.length; i++) {
    const row = aoa[i] || [];
    if (row.every((x) => !String(x ?? '').trim())) continue;
    rows++;
    const R = i + 1;
    const idTxt = map.id >= 0 ? String(row[map.id] ?? '').trim() : '';
    const nameTxt = map.name >= 0 ? String(row[map.name] ?? '').trim() : '';
    // Match on our staff ID, the client's staff ID, or a mobile number; fall back to the exact name.
    const digits = idTxt.replace(/\D/g, '');
    const w = (idTxt && WORKERS.find((x) => norm(x.code) === norm(idTxt) || norm(x.clientId) === norm(idTxt) || (digits.length >= 7 && x.phone.replace(/\D/g, '').endsWith(digits))))
      || (!idTxt && nameTxt && WORKERS.find((x) => norm(x.name) === norm(nameTxt)));
    if (!w) { errors.push({ row: R, col: map.id >= 0 ? header[map.id] : header[map.name], msg: `No worker with ${idTxt ? `staff ID ${idTxt}` : `the name "${nameTxt}"`}.` }); continue; }
    if (seen.has(w.id)) { errors.push({ row: R, col: header[map.id] || 'Name', msg: `${w.name} is listed twice.` }); continue; }
    seen.add(w.id);
    const g = groups.find((x) => x.people.includes(w.id));
    if (!g || (!g.float && !sites.includes(g.site))) { errors.push({ row: R, col: header[map.id] || 'Name', msg: `${w.name} works at ${siteOf(w.site).name}, which isn't one of the locations you're uploading for.` }); continue; }
    if (g.float) { warnings.push({ row: R, msg: `${w.name} is a floater. Floaters are given covers, not a roster, so this row was skipped.` }); continue; }
    if (map.site >= 0 && String(row[map.site] ?? '').trim()) { const s = findSite(row[map.site]); if (s && s.id !== g.site) warnings.push({ row: R, msg: `${w.name} is listed at ${s.name} but works at ${siteOf(g.site).name}. Kept at ${siteOf(g.site).name}; use "@ ${short(s.name)}" on a day for a shift elsewhere.` }); }
    const r = g.people.indexOf(w.id);
    map.days.forEach((c, d) => {
      const res = parseCell(row[c], g.site);
      if (res.error) errors.push({ row: R, col: header[c], msg: res.error });
      else g.cells[r][d] = res.cell;
    });
  }
  // Anyone at these locations who isn't in the file stays not rostered: worth saying, not an error.
  const absent = sites.flatMap((sid) => ROSTER_GROUPS.find((x) => x.site === sid).people).filter((id) => !seen.has(id));
  // With a week already planned, they keep what they have, so a file can carry just the rows that changed.
  if (absent.length) warnings.push({ row: null, msg: `${absent.length} ${absent.length === 1 ? 'worker at these locations isn\'t' : 'workers at these locations aren\'t'} in the file ${target ? 'and keep what they have now' : 'and will show as not rostered'}: ${absent.map((id) => WORKERS.find((x) => x.id === id).name).join(', ')}.` });
  return { header, hi, map, missing: [], errors, warnings, groups: applyLeave(groups, wk), rows, seen };
}

// A roster file only describes its own locations; everything else in the week stays as it was.
// Workers not in the file keep their row from the existing week.
export const mergeInto = (target, parsed, sites, seen) => (target || emptyWeek()).map((g) => {
  if (g.float || !sites.includes(g.site)) return g;
  const p = parsed.find((x) => x.site === g.site);
  return { ...g, cells: g.cells.map((row, r) => (!target || seen.has(g.people[r]) ? p.cells[r] : row)) };
});
