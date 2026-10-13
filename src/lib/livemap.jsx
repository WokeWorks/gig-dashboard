import { loadGoogleMaps, MAP_STYLES } from './geo.js';

const { useState, useEffect, useRef } = React;

// The live map used on the Liveboard and the vendor overview: Google Maps with our own HTML pins.
// points: [{ id, name, title?, lat, lng, due, inn, bad, late, left? }]; it frames all of them on first load.
export function LiveMap({ points, pick, onPick, height }) {
  const el = useRef(null); const map = useRef(null); const pins = useRef([]); const gm = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | missing_key | refused | offline
  const pts = useRef([]); const moved = useRef(false); const fitKey = useRef('');
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
    // Store pins are our own HTML (count, name, status), drawn on a Google overlay so they match the rest of the dashboard.
    class Pin extends G.OverlayView {
      constructor(pos, html, cls, z, title, id) { super(); this.pos = pos; this.html = html; this.cls = cls; this.z = z; this.title = title; this.id = id; }
      onAdd() { const d = document.createElement('div'); d.className = this.cls; d.innerHTML = this.html; d.title = this.title; d.tabIndex = 0; d.setAttribute('role', 'button'); d.style.position = 'absolute'; d.style.zIndex = String(this.z); d.onclick = (e) => { e.stopPropagation(); onPickRef.current(this.id); }; d.onkeydown = (e) => { if (e.key === 'Enter') onPickRef.current(this.id); }; this.div = d; this.getPanes().overlayMouseTarget.appendChild(d); }
      draw() { const p = this.getProjection().fromLatLngToDivPixel(new G.LatLng(this.pos)); if (p && this.div) { this.div.style.left = (p.x - 13) + 'px'; this.div.style.top = (p.y - 13) + 'px'; } }
      onRemove() { if (this.div) { this.div.remove(); this.div = null; } }
    }
    const list = [];
    points.forEach((d) => {
      const lat = d.lat, lng = d.lng; list.push([lat, lng]);
      const tone = d.bad ? 'crit' : d.late ? 'warn' : d.due ? 'good' : 'idle';
      const html = `<div class="lp ${tone}${pick === d.id ? ' on' : ''}"><span class="lp-dot">${d.due ? d.inn : '–'}</span><span class="lp-lab${tone === 'good' || tone === 'idle' ? ' quiet' : ''}"><b>${d.name}</b><small>${d.due ? d.inn + '/' + d.due + ' in' : 'No one due'}${d.bad ? ' · ' + d.bad + ' no-show' : ''}${d.late ? ' · ' + d.late + ' late' : ''}</small></span></div>`;
      const p = new Pin({ lat, lng }, html, 'lp-wrap' + (d.left ? ' left' : ''), d.bad ? 30 : d.late ? 20 : 10, d.title || d.name, d.id);
      p.setMap(m); pins.current.push(p);
    });
    pts.current = list;
    // Refit only when the set of stores changes (e.g. another manager), not on every live update.
    const key = points.map((d) => d.id).join(',');
    if (key !== fitKey.current) { fitKey.current = key; fitAll(); }
    const pp = pick && points.find((d) => d.id === pick); if (pp) { const bb = m.getBounds(); if (bb && !bb.contains({ lat: pp.lat, lng: pp.lng })) m.panTo({ lat: pp.lat, lng: pp.lng }); }
  }, [points, pick, state]);
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
