import { loadGoogleMaps, MAP_STYLES, staticMapUrl } from './geo.js';

const { useState, useEffect, useRef } = React;

// Maps are created once and reused. Google bills every new google.maps.Map as a map load, and a reused map comes back
// instantly, where it was left. Each slot keeps one map on its own div, which is moved into whichever container is
// showing it and taken out (not destroyed) when that container goes away. Theme changes are applied to every kept map.
const POOL = new Map();
const isDark = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; };
const rethemeAll = () => POOL.forEach((e) => { if (!e.map) return; e.map.setOptions({ styles: isDark() ? MAP_STYLES.dark : MAP_STYLES.light }); if (e.retheme) e.retheme(); });
let themeWatch = false;
// A kept map waits off screen at the size it was shown, so it doesn't redraw when it comes back.
let park = null;
const parkMap = (div, host) => {
  if (!park) { park = document.createElement('div'); park.setAttribute('aria-hidden', 'true'); park.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;'; document.body.appendChild(park); }
  const r = host && host.getBoundingClientRect(); if (r && r.width) { div.style.width = r.width + 'px'; div.style.height = r.height + 'px'; }
  park.appendChild(div);
};
function pooledMap(slot, host, G, opts) {
  if (!themeWatch) { themeWatch = true; window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rethemeAll); new MutationObserver(rethemeAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); }
  let e = POOL.get(slot); const fresh = !e;
  if (!e) { const div = document.createElement('div'); div.className = 'gm-canvas'; e = { div, map: null, st: {} }; POOL.set(slot, e); }
  e.div.style.width = ''; e.div.style.height = ''; host.appendChild(e.div);
  if (!e.map) e.map = new G.Map(e.div, { ...opts, styles: isDark() ? MAP_STYLES.dark : MAP_STYLES.light });
  return { e, fresh };
}

// Store pins are our own HTML (count, name, status), drawn together on one Google overlay so they can be laid out as a
// set on every zoom: pins that would sit on top of each other merge into one (click it to zoom in), and labels are
// placed in order of importance (selected, then no-shows), right or left of their pin, and left off when there is no
// room (they still show on hover). Pins are reused between draws and only rewritten when what they show changes, so
// selecting a store or zooming doesn't restart the others.
const NEAR = 30; // px: closer than this and two pins merge
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let PinLayer = null;
function makePinLayer(G, m) {
  if (!PinLayer) PinLayer = class extends G.OverlayView {
    onAdd() { this.box = document.createElement('div'); this.box.className = 'lp-layer'; this.els = new Map(); this.getPanes().overlayMouseTarget.appendChild(this.box); }
    onRemove() { if (this.box) { this.box.remove(); this.box = null; } }
    draw() {
      const pr = this.getProjection(), D = this.data; if (!pr || !this.box || !D) return;
      const map = this.mapRef;
      const rank = (d) => (D.pick === d.id ? 1e6 : 0) + (d.bad ? 1e3 : 0) + (d.due || 0);
      const at = D.points.map((d) => { const q = pr.fromLatLngToDivPixel(new G.LatLng(d.lat, d.lng)); return { d, x: q.x, y: q.y }; }).sort((x, y) => rank(y.d) - rank(x.d));
      const groups = [];
      at.forEach((a) => { const g = groups.find((k) => Math.hypot(k.x - a.x, k.y - a.y) < NEAR); if (g) g.ds.push(a.d); else groups.push({ x: a.x, y: a.y, ds: [a.d] }); });
      const taken = groups.map((g) => [g.x - 15, g.y - 15, g.x + 15, g.y + 15]);
      const free = (r) => !taken.some((t) => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]);
      const mg = {}; groups.forEach((g) => g.ds.forEach((d) => { mg[d.id] = g.ds.length > 1; }));
      const seen = new Set();
      groups.forEach((g) => {
        const key = g.ds.map((d) => d.id).join('|'); seen.add(key);
        const one = g.ds.length === 1 ? g.ds[0] : null;
        const sum = (k) => g.ds.reduce((n, d) => n + (d[k] || 0), 0);
        const due = sum('due'), inn = sum('inn'), bad = sum('bad');
        const tone = bad ? 'crit' : due ? 'good' : 'idle';
        const on = g.ds.some((d) => d.id === D.pick);
        const sub = `${due ? inn + '/' + due + ' in' : 'No one due'}${bad ? ' · ' + bad + ' no-show' : ''}`; // late isn't an alert
        let el = this.els.get(key);
        if (!el) {
          el = document.createElement('div'); el.tabIndex = 0; el.setAttribute('role', 'button');
          el.onclick = (e) => { e.stopPropagation(); el.act(); }; el.onkeydown = (e) => { if (e.key === 'Enter') el.act(); };
          this.box.appendChild(el); this.els.set(key, el);
        }
        el.className = 'lp-wrap'; el.dataset.ids = key;
        el.style.left = (g.x - 13) + 'px'; el.style.top = (g.y - 13) + 'px'; el.style.zIndex = String(on ? 40 : bad ? 30 : 10);
        el.setAttribute('aria-label', g.ds.map((d) => d.title || d.name).join(', ')); // no native tooltip: the label says it
        const html = `<div class="lp ${tone}${on ? ' on' : ''}${one ? '' : ' many'}">${one ? '' : '<span class="lp-stack"></span>'}<span class="lp-dot">${due ? inn : '–'}</span><span class="lp-lab"><b>${esc(one ? one.name : `${g.ds[0].name} + ${g.ds.length - 1} more`)}</b><small>${esc(sub)}</small></span></div>`;
        if (el.html !== html) { el.innerHTML = html; el.html = html; }
        el.act = () => {
          if (one) { D.onPick(one.id); return; }
          const b = new G.LatLngBounds(); g.ds.forEach((d) => b.extend({ lat: d.lat, lng: d.lng }));
          D.onMerged(); map.fitBounds(b, { top: 120, right: 200, bottom: 80, left: 80 });
        };
        // Label: always tried for the selected pin and for no-shows; others show theirs on hover.
        const lab = el.querySelector('.lp-lab'); lab.classList.remove('quiet');
        const w = lab.offsetWidth, h = lab.offsetHeight;
        const right = [g.x + 16, g.y - h / 2, g.x + 16 + w, g.y + h / 2], left = [g.x - 16 - w, g.y - h / 2, g.x - 16, g.y + h / 2];
        const order = one && one.left ? [['left', left], ['right', right]] : [['right', right], ['left', left]];
        const spot = (on || bad) && order.find(([, r]) => free(r));
        if (spot) { taken.push(spot[1]); if (spot[0] === 'left') el.classList.add('left'); }
        else { lab.classList.add('quiet'); if (free(left) && !free(right)) el.classList.add('left'); }
      });
      this.els.forEach((el, k) => { if (!seen.has(k)) { el.remove(); this.els.delete(k); } });
      if (D.after) D.after(mg);
    }
  };
  const l = new PinLayer(); l.mapRef = m; l.setMap(m); return l;
}

// The live map used on the Liveboard and the vendor overview: Google Maps with our own HTML pins.
// points: [{ id, name, title?, lat, lng, due, inn, bad, late, left? }]; it frames all of them on first load.
// inset: how many pixels on the right are covered by a panel; the picked pin is kept clear of them.
// focus: the store opened elsewhere (e.g. from a list); if it is hidden inside a merged pin the map zooms in to it.
// pick: the selected store (pinned label, kept in view). hover: a store hovered elsewhere (e.g. its row in a list); it is
// only highlighted, never panned to, and never rebuilds the pins.
// slot: which kept map to use (one per screen that shows a live map).
export function LiveMap({ points, pick, hover = null, onPick, height, inset = 0, focus = null, slot = 'live' }) {
  const el = useRef(null); const map = useRef(null); const gm = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | missing_key | refused | offline
  const pts = useRef([]); const merged = useRef({}); const keptRef = useRef(null); const moved = useRef(false); const fitKey = useRef('');
  const onPickRef = useRef(onPick); onPickRef.current = onPick;
  const hoverRef = useRef(hover); hoverRef.current = hover;
  // Rebuild the pins only when what they show changes, not every time the parent re-renders with a new array.
  const pkey = JSON.stringify(points);
  const lit = () => { const box = el.current; if (!box) return; box.querySelectorAll('.lp-wrap').forEach((w) => w.classList.toggle('hl', !!hoverRef.current && (w.dataset.ids || '').split('|').includes(hoverRef.current))); };
  // Frame every store: room on the right for the labels, and clear of the filter bar and count tiles
  // that sit over the map (top on wide screens, bottom on narrow ones). Never closer than street level.
  const fitAll = () => {
    const m = map.current, G = gm.current; if (!m || !G || !pts.current.length || !el.current || !el.current.clientWidth) return;
    const box = el.current.getBoundingClientRect();
    let top = 0, bottom = 0;
    el.current.parentElement.querySelectorAll('.lm-over').forEach((e) => { const r = e.getBoundingClientRect(); if (r.top + r.height / 2 < box.top + box.height / 2) top = Math.max(top, r.bottom - box.top); else bottom = Math.max(bottom, box.bottom - r.top); });
    const b = new G.LatLngBounds(); pts.current.forEach(([lat, lng]) => b.extend({ lat, lng }));
    m.fitBounds(b, { top: Math.max(50, top + 40), right: 190, bottom: Math.max(50, bottom + 30), left: 70 });
    G.event.addListenerOnce(m, 'idle', () => { if (m.getZoom() > 15) m.setZoom(15); });
    moved.current = false;
  };
  useEffect(() => {
    let alive = true; let cleanup = () => {};
    const refused = () => alive && setState('refused');
    window.addEventListener('opspro-maps-refused', refused);
    loadGoogleMaps().then((G) => {
      if (!alive || !el.current) return;
      gm.current = G;
      const { e: kept, fresh } = pooledMap('live:' + slot, el.current, G, {
        center: { lat: 25.09, lng: 55.23 }, zoom: 12,
        disableDefaultUI: true, zoomControl: true, zoomControlOptions: { position: G.ControlPosition.RIGHT_BOTTOM },
        clickableIcons: false, gestureHandling: 'cooperative', // the page scrolls; ctrl/two fingers zoom the map
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface-2') || undefined,
      });
      const m = kept.map; keptRef.current = kept;
      // A kept map remembers whether it was framed for these stores and whether the person has moved it since.
      if (!fresh) { fitKey.current = kept.st.fitKey || ''; moved.current = !!kept.st.moved; }
      map.current = m;
      // The map frames itself on first load and when the set of stores changes. Anything the
      // person does on the map (click, drag, wheel, touch, keys) hands it to them: no more automatic refits.
      const box = el.current; const mine = () => { moved.current = true; };
      const EVS = ['pointerdown', 'wheel', 'touchstart', 'keydown']; EVS.forEach((ev) => box.addEventListener(ev, mine, { passive: true, capture: true }));
      // Refit on a real size change (window resized, panel reflowed) only while the map is still untouched;
      // ignore the small jitters that layout changes cause.
      let last = [box.clientWidth, box.clientHeight];
      const ro = new ResizeObserver(() => { if (!alive) return; const now = [box.clientWidth, box.clientHeight]; if (Math.abs(now[0] - last[0]) > 40 || Math.abs(now[1] - last[1]) > 40) { last = now; if (!moved.current) fitAll(); } }); ro.observe(box);
      cleanup = () => { EVS.forEach((ev) => box.removeEventListener(ev, mine, { capture: true })); ro.disconnect(); kept.st.fitKey = fitKey.current; kept.st.moved = moved.current; parkMap(kept.div, box); };
      setState('ready');
    }).catch((e) => { if (alive) setState(e.message === 'missing_key' ? 'missing_key' : e.message === 'refused' ? 'refused' : 'offline'); });
    return () => { alive = false; window.removeEventListener('opspro-maps-refused', refused); cleanup(); map.current = null; };
  }, []);
  useEffect(() => {
    const m = map.current, G = gm.current, kept = keptRef.current; if (!m || !G || !kept || state !== 'ready') return;
    // One pin layer per kept map, for the whole session: updated in place, never torn down, so pins don't flash.
    const layer = kept.layer || (kept.layer = makePinLayer(G, m));
    layer.data = { points, pick, onPick: (id) => onPickRef.current(id), onMerged: () => { moved.current = true; }, after: (mg) => { merged.current = mg; lit(); } };
    layer.draw();
    pts.current = points.map((d) => [d.lat, d.lng]);
    // Refit only when the set of stores changes (e.g. another manager), not on every live update.
    const key = points.map((d) => d.id).join(',');
    if (key !== fitKey.current) { fitKey.current = key; fitAll(); }
  }, [pkey, pick, state]);
  // Keep the selected store in view, and out from under a side panel if one covers the map. Only on selection.
  useEffect(() => {
    const m = map.current; if (!m || state !== 'ready') return;
    const pp = pick && points.find((d) => d.id === pick);
    if (pp) {
      const bb = m.getBounds(); const w = el.current ? el.current.clientWidth : 0;
      const ne = bb && bb.getNorthEast ? bb.getNorthEast() : null, sw = bb && bb.getSouthWest ? bb.getSouthWest() : null;
      const x = ne && sw ? ((pp.lng - sw.lng()) / (ne.lng() - sw.lng())) * w : -1;
      const hidden = !bb || !bb.contains({ lat: pp.lat, lng: pp.lng }) || x > w - inset - 60;
      if (hidden) { m.panTo({ lat: pp.lat, lng: pp.lng }); if (inset && m.panBy) m.panBy(Math.round(inset / 2), 0); }
    }
  }, [pick, state, inset]);
  useEffect(lit, [hover, pkey, pick, state]);
  useEffect(() => {
    const m = map.current; if (!m || state !== 'ready' || !focus || !merged.current[focus]) return;
    const d = points.find((x) => x.id === focus); if (!d) return;
    moved.current = true; m.panTo({ lat: d.lat, lng: d.lng }); m.setZoom(Math.min(16, (m.getZoom() || 11) + 2));
  }, [focus, state]);
  const msg = { missing_key: 'Add GOOGLE_MAPS_API_KEY to .env and rebuild to see the map.', refused: "Google Maps refused the key for this page. Allow this address for the key in Google Cloud, or open the page through npm run serve.", offline: "The map couldn't load. Check the internet connection." }[state];
  return <div className="lm-leaf" ref={el} style={height ? { height } : undefined}>{msg && <div className="lm-fail small">{msg}</div>}</div>;
}

// A map snapshot of one location: a static Google map image around the store with its geofence drawn to scale and
// the store marked. Fetched only when the card comes on screen, cheap and cacheable; follows the theme. Click it
// to open Google Maps there. Until the image loads, or if it can't, the card shows a plain drawn placeholder.
const useDark = () => {
  const [d, setD] = useState(isDark);
  useEffect(() => {
    const f = () => setD(isDark()); const mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', f);
    const mo = new MutationObserver(f); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener('change', f); mo.disconnect(); };
  }, []);
  return d;
};
export function SiteMap({ lat, lng, radius, name, height = 132 }) {
  const dark = useDark();
  const src = staticMapUrl({ lat, lng, radius, w: 400, h: height, dark });
  const [state, setState] = useState('loading'); // loading | ready | failed
  useEffect(() => { setState('loading'); }, [src]);
  // Only fetch once the card is on screen or about to be (native lazy loading starts far too early).
  const box = useRef(null); const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current; if (!el || seen) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '200px 0px' });
    io.observe(el); return () => io.disconnect();
  }, [seen]);
  return (
    <a ref={box} className="sitemap" style={{ height }} href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noopener noreferrer" aria-label={`Map of ${name}, geofence ${radius} metres. Opens Google Maps.`}>
      <svg viewBox="0 0 240 132" preserveAspectRatio="xMidYMid slice" className="sitemap-ph" aria-hidden="true">
        <rect width="240" height="132" className="geo-bg" />
        <path d="M0 86 L240 62 M70 0 L92 132 M170 0 L150 132" className="geo-road" />
        <circle cx="120" cy="68" r="34" className="geo-ring" /><circle cx="120" cy="68" r="4" className="geo-pin" />
      </svg>
      {src && seen && state !== 'failed' && <img className={'sitemap-img' + (state === 'ready' ? ' ready' : '')} src={src} alt="" decoding="async" onLoad={() => setState('ready')} onError={() => setState('failed')} />}
      {state === 'ready' && <span className="sitemap-dot" aria-hidden="true" />}
    </a>
  );
}
