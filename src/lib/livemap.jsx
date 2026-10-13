import { loadGoogleMaps, MAP_STYLES } from './geo.js';

const { useState, useEffect, useRef } = React;

// The live map used on the Liveboard and the vendor overview: Google Maps with our own HTML pins.
// points: [{ id, name, title?, lat, lng, due, inn, bad, late, left? }]; it frames all of them on first load.
// inset: how many pixels on the right are covered by a panel; the picked pin is kept clear of them.
// focus: the store opened elsewhere (e.g. from a list); if it is hidden inside a merged pin the map zooms in to it.
export function LiveMap({ points, pick, onPick, height, inset = 0, focus = null }) {
  const el = useRef(null); const map = useRef(null); const pins = useRef([]); const gm = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | missing_key | refused | offline
  const pts = useRef([]); const merged = useRef({}); const moved = useRef(false); const fitKey = useRef('');
  const onPickRef = useRef(onPick); onPickRef.current = onPick;
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
      const dark = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; };
      const m = new G.Map(el.current, {
        center: { lat: 25.09, lng: 55.23 }, zoom: 12, styles: dark() ? MAP_STYLES.dark : MAP_STYLES.light,
        disableDefaultUI: true, zoomControl: true, zoomControlOptions: { position: G.ControlPosition.RIGHT_BOTTOM },
        clickableIcons: false, gestureHandling: 'cooperative', // the page scrolls; ctrl/two fingers zoom the map
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface-2') || undefined,
      });
      map.current = m;
      // The map frames itself on first load and when the set of stores changes. Anything the
      // person does on the map (click, drag, wheel, touch, keys) hands it to them: no more automatic refits.
      const box = el.current; const mine = () => { moved.current = true; };
      const EVS = ['pointerdown', 'wheel', 'touchstart', 'keydown']; EVS.forEach((ev) => box.addEventListener(ev, mine, { passive: true, capture: true }));
      const retheme = () => m.setOptions({ styles: dark() ? MAP_STYLES.dark : MAP_STYLES.light });
      const mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', retheme);
      const mo = new MutationObserver(retheme); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      // Refit on a real size change (window resized, panel reflowed) only while the map is still untouched;
      // ignore the small jitters that layout changes cause.
      let last = [box.clientWidth, box.clientHeight];
      const ro = new ResizeObserver(() => { if (!alive) return; const now = [box.clientWidth, box.clientHeight]; if (Math.abs(now[0] - last[0]) > 40 || Math.abs(now[1] - last[1]) > 40) { last = now; if (!moved.current) fitAll(); } }); ro.observe(box);
      cleanup = () => { EVS.forEach((ev) => box.removeEventListener(ev, mine, { capture: true })); mq.removeEventListener('change', retheme); mo.disconnect(); ro.disconnect(); pins.current.forEach((p) => p.setMap(null)); pins.current = []; G.event.clearInstanceListeners(m); };
      setState('ready');
    }).catch((e) => { if (alive) setState(e.message === 'missing_key' ? 'missing_key' : e.message === 'refused' ? 'refused' : 'offline'); });
    return () => { alive = false; window.removeEventListener('opspro-maps-refused', refused); cleanup(); map.current = null; };
  }, []);
  useEffect(() => {
    const m = map.current, G = gm.current; if (!m || !G || state !== 'ready') return;
    pins.current.forEach((p) => p.setMap(null)); pins.current = [];
    // Store pins are our own HTML (count, name, status), drawn together on one Google overlay so they can be laid out
    // as a set on every zoom: pins that would sit on top of each other merge into one (click it to zoom in), and labels
    // are placed in order of importance (selected, then no-shows), right or left of their pin, and left off when there
    // is no room for them (they still show on hover).
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const rank = (d) => (pick === d.id ? 1e6 : 0) + (d.bad ? 1e3 : 0) + (d.due || 0);
    const NEAR = 30; // px: closer than this and two pins merge
    class Layer extends G.OverlayView {
      onAdd() { this.box = document.createElement('div'); this.box.className = 'lp-layer'; this.getPanes().overlayMouseTarget.appendChild(this.box); }
      onRemove() { if (this.box) { this.box.remove(); this.box = null; } }
      draw() {
        const pr = this.getProjection(); if (!pr || !this.box) return;
        const at = points.map((d) => { const q = pr.fromLatLngToDivPixel(new G.LatLng(d.lat, d.lng)); return { d, x: q.x, y: q.y }; }).sort((x, y) => rank(y.d) - rank(x.d));
        const groups = [];
        at.forEach((a) => { const g = groups.find((k) => Math.hypot(k.x - a.x, k.y - a.y) < NEAR); if (g) g.ds.push(a.d); else groups.push({ x: a.x, y: a.y, ds: [a.d] }); });
        this.box.innerHTML = '';
        const taken = groups.map((g) => [g.x - 15, g.y - 15, g.x + 15, g.y + 15]);
        const free = (r) => !taken.some((t) => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]);
        merged.current = {}; groups.forEach((g) => g.ds.forEach((d) => { merged.current[d.id] = g.ds.length > 1; }));
        groups.forEach((g) => {
          const one = g.ds.length === 1 ? g.ds[0] : null;
          const sum = (k) => g.ds.reduce((n, d) => n + (d[k] || 0), 0);
          const due = sum('due'), inn = sum('inn'), bad = sum('bad');
          const tone = bad ? 'crit' : due ? 'good' : 'idle';
          const on = g.ds.some((d) => d.id === pick);
          const sub = `${due ? inn + '/' + due + ' in' : 'No one due'}${bad ? ' · ' + bad + ' no-show' : ''}`; // late isn't an alert: it stays in the list and drawer
          const el = document.createElement('div');
          el.className = 'lp-wrap'; el.style.left = (g.x - 13) + 'px'; el.style.top = (g.y - 13) + 'px'; el.style.zIndex = String(on ? 40 : bad ? 30 : 10);
          el.setAttribute('aria-label', g.ds.map((d) => d.title || d.name).join(', ')); // no native tooltip: the label says it el.tabIndex = 0; el.setAttribute('role', 'button');
          el.innerHTML = `<div class="lp ${tone}${on ? ' on' : ''}${one ? '' : ' many'}">${one ? '' : '<span class="lp-stack"></span>'}<span class="lp-dot">${due ? inn : '–'}</span><span class="lp-lab"><b>${esc(one ? one.name : `${g.ds[0].name} + ${g.ds.length - 1} more`)}</b><small>${esc(sub)}</small></span></div>`;
          const act = () => {
            if (one) { onPickRef.current(one.id); return; }
            const b = new G.LatLngBounds(); g.ds.forEach((d) => b.extend({ lat: d.lat, lng: d.lng }));
            moved.current = true; m.fitBounds(b, { top: 120, right: 200, bottom: 80, left: 80 });
          };
          el.onclick = (e) => { e.stopPropagation(); act(); }; el.onkeydown = (e) => { if (e.key === 'Enter') act(); };
          this.box.appendChild(el);
          // Label: always tried for the selected pin and for no-shows; others show theirs on hover.
          const lab = el.querySelector('.lp-lab'); const w = lab.offsetWidth, h = lab.offsetHeight;
          const right = [g.x + 16, g.y - h / 2, g.x + 16 + w, g.y + h / 2], left = [g.x - 16 - w, g.y - h / 2, g.x - 16, g.y + h / 2];
          const order = one && one.left ? [['left', left], ['right', right]] : [['right', right], ['left', left]];
          const spot = (on || bad) && order.find(([, r]) => free(r));
          if (spot) { taken.push(spot[1]); if (spot[0] === 'left') el.classList.add('left'); }
          else { lab.classList.add('quiet'); if (free(left) && !free(right)) el.classList.add('left'); }
        });
      }
    }
    const list = points.map((d) => [d.lat, d.lng]);
    const layer = new Layer(); layer.setMap(m); pins.current.push(layer);
    pts.current = list;
    // Refit only when the set of stores changes (e.g. another manager), not on every live update.
    const key = points.map((d) => d.id).join(',');
    if (key !== fitKey.current) { fitKey.current = key; fitAll(); }
    // Keep the picked store in view, and out from under the side panel when one is open.
    const pp = pick && points.find((d) => d.id === pick);
    if (pp) {
      const bb = m.getBounds(); const w = el.current ? el.current.clientWidth : 0;
      const ne = bb && bb.getNorthEast ? bb.getNorthEast() : null, sw = bb && bb.getSouthWest ? bb.getSouthWest() : null;
      const x = ne && sw ? ((pp.lng - sw.lng()) / (ne.lng() - sw.lng())) * w : -1;
      const hidden = !bb || !bb.contains({ lat: pp.lat, lng: pp.lng }) || x > w - inset - 60;
      if (hidden) { m.panTo({ lat: pp.lat, lng: pp.lng }); if (inset && m.panBy) m.panBy(Math.round(inset / 2), 0); }
    }
  }, [points, pick, state, inset]);
  useEffect(() => {
    const m = map.current; if (!m || state !== 'ready' || !focus || !merged.current[focus]) return;
    const d = points.find((x) => x.id === focus); if (!d) return;
    moved.current = true; m.panTo({ lat: d.lat, lng: d.lng }); m.setZoom(Math.min(16, (m.getZoom() || 11) + 2));
  }, [focus, state]);
  const msg = { missing_key: 'Add GOOGLE_MAPS_API_KEY to .env and rebuild to see the map.', refused: "Google Maps refused the key for this page. Allow this address for the key in Google Cloud, or open the page through npm run serve.", offline: "The map couldn't load. Check the internet connection." }[state];
  return <div className="lm-leaf" ref={el} style={height ? { height } : undefined}>{msg && <div className="lm-fail small">{msg}</div>}</div>;
}

// A real map snapshot of one location: Google Maps around the store with its geofence drawn to scale.
// Still (no pan, zoom or controls) so it reads as a picture on a card; click it to open Google Maps there.
// Until the map loads, or if it can't, the card shows a plain drawn placeholder instead.
export function SiteMap({ lat, lng, radius, name, height = 132 }) {
  const el = useRef(null); const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true; let cleanup = () => {};
    loadGoogleMaps().then((G) => {
      if (!alive || !el.current) return;
      const css = getComputedStyle(document.documentElement); const tok = (n) => css.getPropertyValue(n).trim();
      const dark = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; };
      const center = { lat, lng };
      const m = new G.Map(el.current, {
        center, zoom: 16, styles: dark() ? MAP_STYLES.dark : MAP_STYLES.light,
        disableDefaultUI: true, gestureHandling: 'none', keyboardShortcuts: false, clickableIcons: false,
        backgroundColor: tok('--surface-2') || undefined,
      });
      const ring = new G.Circle({ map: m, center, radius, strokeColor: tok('--accent'), strokeOpacity: 0.9, strokeWeight: 1.5, fillColor: tok('--accent'), fillOpacity: 0.12, clickable: false });
      const dot = new G.Circle({ map: m, center, radius: Math.max(6, radius / 14), strokeColor: tok('--surface') || '#fff', strokeWeight: 2, fillColor: tok('--accent'), fillOpacity: 1, clickable: false });
      // Frame the geofence with some street around it.
      const fit = () => { const b = ring.getBounds(); if (b && el.current && el.current.clientWidth) m.fitBounds(b, 28); };
      G.event.addListenerOnce(m, 'idle', () => { fit(); if (alive) setReady(true); });
      const retheme = () => { const c = getComputedStyle(document.documentElement); m.setOptions({ styles: dark() ? MAP_STYLES.dark : MAP_STYLES.light }); ring.setOptions({ strokeColor: c.getPropertyValue('--accent').trim(), fillColor: c.getPropertyValue('--accent').trim() }); dot.setOptions({ fillColor: c.getPropertyValue('--accent').trim(), strokeColor: c.getPropertyValue('--surface').trim() }); };
      const mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', retheme);
      const mo = new MutationObserver(retheme); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      const ro = new ResizeObserver(fit); ro.observe(el.current);
      cleanup = () => { mq.removeEventListener('change', retheme); mo.disconnect(); ro.disconnect(); ring.setMap(null); dot.setMap(null); G.event.clearInstanceListeners(m); };
    }).catch(() => {});
    return () => { alive = false; cleanup(); };
  }, [lat, lng, radius]);
  return (
    <a className={'sitemap' + (ready ? ' ready' : '')} style={{ height }} href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noopener noreferrer" title={`Open ${name} in Google Maps`} aria-label={`Map of ${name}, geofence ${radius} metres. Opens Google Maps.`}>
      <svg viewBox="0 0 240 132" preserveAspectRatio="xMidYMid slice" className="sitemap-ph" aria-hidden="true">
        <rect width="240" height="132" className="geo-bg" />
        <path d="M0 86 L240 62 M70 0 L92 132 M170 0 L150 132" className="geo-road" />
        <circle cx="120" cy="68" r="34" className="geo-ring" /><circle cx="120" cy="68" r="4" className="geo-pin" />
      </svg>
      <div ref={el} className="sitemap-map" />
    </a>
  );
}
