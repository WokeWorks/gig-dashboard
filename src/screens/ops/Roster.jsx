import { MANAGERS, SITES, VENDORS, WORKERS, LEAVE, ROSTER_GROUPS, SHIFT_TEMPLATES, TRAVEL, tplOf, tplLabel, endOf, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Pill, Drawer, Field, Toggle, Note, useToast, Icon } from '../../ui.jsx';
import { isFloat, coverOf, coverCell, undoCell, CoverDrawer } from '../../lib/cover.jsx';
import { FULL_DAYS, hm, toMin, TODAY, weekDays, weekLabel } from '../../lib/dates.js';
import { OFF_RULES, fixedOff, offErrors, errText, offPerWeek, offClashes, badUpload } from '../../lib/offs.js';
import { shiftHours, shiftOt, UNACK, usual, shiftWeek } from '../../lib/roster.js';

const { useState, useEffect } = React;

export const DAY0 = 5 * 60, DAYLEN = 22 * 60; // timeline window 05:00 → 03:00 next day

export const pos = (min) => Math.max(0, Math.min(1, (min < DAY0 ? min + 1440 - DAY0 : min - DAY0) / DAYLEN));

export function dayChecks(list, home) {
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

export function MiniBar({ list, home }) {
  return (
    <span className="minibar" aria-hidden="true">
      {list.map(([t, st, s2], k) => { const a = pos(toMin(st)); const b = pos(toMin(st) + tplOf(t).base * 60); return <span key={k} className={s2 && s2 !== home ? 'away' : ''} style={{ left: a * 100 + '%', width: Math.max(4, (b - a) * 100) + '%' }} />; })}
    </span>
  );
}

export function DayTimeline({ list, home }) {
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
