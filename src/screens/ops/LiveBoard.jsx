import L from 'leaflet';
import { MANAGERS, SITES, ROSTER_GROUPS } from '../../data.js';
import { ScreenHeader, Drawer, Field, Toggle, useToast, Icon } from '../../ui.jsx';
import { CoverDrawer } from '../../lib/cover.jsx';
import { hm, TODAY } from '../../lib/dates.js';
import { GEO, LEFT, MAP_TILES } from '../../lib/geo.js';
import { NOW_MIN, liveOf, LV } from '../../lib/live.js';

const { useState, useEffect, useRef } = React;

export function LiveMap({ data, pick, onPick }) {
  const el = React.useRef(null); const map = React.useRef(null); const layer = React.useRef(null);
  const [failed, setFailed] = useState(false);
  const pts = useRef([]); const moved = useRef(false); const fitKey = useRef('');
  // Frame every store: room on the right for the labels (left for the few whose label sits on the left),
  // quarter-step zoom so the fit is snug, and never closer than street level for a single store.
  const fitAll = () => {
    const m = map.current; if (!m || !pts.current.length || !el.current || !el.current.clientWidth) return;
    // The filter bar and the count tiles sit on top of the map: keep stores out from under them.
    const box = el.current.getBoundingClientRect();
    // Each overlay pads whichever edge it sits on (on narrow screens the tiles move to the bottom).
    let top = 0, bottom = 0;
    el.current.parentElement.querySelectorAll('.lm-over').forEach((e) => { const r = e.getBoundingClientRect(); if (r.top + r.height / 2 < box.top + box.height / 2) top = Math.max(top, r.bottom - box.top); else bottom = Math.max(bottom, box.bottom - r.top); });
    m.fitBounds(pts.current, { paddingTopLeft: [70, Math.max(50, top + 40)], paddingBottomRight: [190, Math.max(50, bottom + 30)], maxZoom: 15, animate: false });
    moved.current = false;
  };
  useEffect(() => {
    const m = L.map(el.current, { zoomSnap: 0.25, zoomDelta: 0.5, scrollWheelZoom: false, zoomControl: false, attributionControl: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, maxZoom: MAP_TILES.maxZoom }).setView([25.09, 55.23], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    // Scrolling the page shouldn't zoom the map; once someone clicks into it, the wheel zooms.
    m.on('focus click', () => m.scrollWheelZoom.enable()); m.on('blur mouseout', () => m.scrollWheelZoom.disable());
    // Live basemap tiles, light or dark to match the dashboard's theme.
    const dark = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; };
    let ok = 0, bad = 0;
    const tiles = L.tileLayer(dark() ? MAP_TILES.dark : MAP_TILES.light, { subdomains: MAP_TILES.subdomains, maxZoom: MAP_TILES.maxZoom, attribution: MAP_TILES.attribution, detectRetina: true })
      .on('tileload', () => { if (++ok === 1) setFailed(false); }).on('tileerror', () => { bad++; if (bad > 8 && ok === 0) setFailed(true); }).addTo(m);
    const retheme = () => tiles.setUrl(dark() ? MAP_TILES.dark : MAP_TILES.light);
    const mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', retheme);
    const mo = new MutationObserver(retheme); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    layer.current = L.layerGroup().addTo(m); map.current = m;
    // Once someone drags or zooms, leave their view alone until they ask for "Show all".
    m.on('dragstart', () => { moved.current = true; }); m.getContainer().addEventListener('wheel', () => { moved.current = true; }, { passive: true });
    const All = L.Control.extend({ options: { position: 'bottomright' }, onAdd() { const b = L.DomUtil.create('button', 'lm-fit'); b.type = 'button'; b.textContent = 'Show all'; b.title = 'Fit every location in view'; L.DomEvent.disableClickPropagation(b); b.onclick = fitAll; return b; } });
    new All().addTo(m);
    let alive = true; const fit = () => { if (!alive) return; try { m.invalidateSize(); if (!moved.current) fitAll(); } catch (e) { /* map already gone */ } };
    const ro = new ResizeObserver(fit); ro.observe(el.current); const tm = setTimeout(fit, 50);
    return () => { alive = false; clearTimeout(tm); ro.disconnect(); mo.disconnect(); mq.removeEventListener('change', retheme); try { m.stop(); m.off(); } catch (e) {} m.remove(); };
  }, []);
  useEffect(() => {
    const m = map.current; if (!m) return; layer.current.clearLayers();
    const list = [];
    data.forEach((d) => {
      const [lng, lat] = GEO[d.s.id] || [55.2, 25.1]; list.push([lat, lng]);
      const tone = d.bad ? 'crit' : d.late ? 'warn' : d.due.length ? 'good' : 'idle';
      const html = `<div class="lp ${tone}${pick === d.s.id ? ' on' : ''}"><span class="lp-dot">${d.due.length ? d.inn : '–'}</span><span class="lp-lab${tone === 'good' || tone === 'idle' ? ' quiet' : ''}"><b>${d.s.name.replace(/^(Spinneys|Carrefour) /, '')}</b><small>${d.due.length ? d.inn + '/' + d.due.length + ' in' : 'No one due'}${d.bad ? ' · ' + d.bad + ' no-show' : d.late ? ' · ' + d.late + ' late' : ''}</small></span></div>`;
      L.marker([lat, lng], { icon: L.divIcon({ className: 'lp-wrap' + (LEFT[d.s.id] ? ' left' : ''), html, iconSize: [26, 26], iconAnchor: [13, 13] }), zIndexOffset: d.bad ? 1000 : d.late ? 500 : 0, keyboard: true, title: d.s.name })
        .on('click', () => onPick(d.s.id)).addTo(layer.current);
    });
    pts.current = list;
    // Refit only when the set of stores changes (e.g. another manager), not on every live update.
    const key = data.map((d) => d.s.id).join(',');
    if (key !== fitKey.current) { fitKey.current = key; fitAll(); }
    if (pick) { const g = GEO[pick]; if (g && !m.getBounds().pad(-0.15).contains([g[1], g[0]])) m.panTo([g[1], g[0]], { animate: false }); }
  }, [data, pick]);
  return <div className="lm-leaf" ref={el}>{failed && <div className="lm-fail small">The map couldn't load. Check the internet connection.</div>}</div>;
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
