

export const kmBetween = (a, b) => { if (!a || !b) return null; const R = 6371, rad = Math.PI / 180; const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.3 * 10) / 10; }; // ×1.3 for roads

// Store coordinates (lng, lat) and a simple projection onto the 1000×640 map.
export const GEO = { s1: [55.1385, 25.0745], s2: [55.1440, 25.0790], s3: [55.1745, 25.0975], s4: [55.2190, 25.0573], s5: [55.2390, 25.0450], s6: [55.3015, 25.0920], s7: [55.2900, 25.0080], s8: [55.3120, 25.1640] , s9: [54.3735, 24.4697], s10: [54.3540, 24.4718], s11: [55.4310, 25.3115] };

export const LEFT = { s1: true, s10: true };

// Driving time between two locations, in minutes: the table in data.js where we have it, otherwise from distance
// (about 1.1 min a km plus 10 to park and walk in). Dubai to Abu Dhabi comes out around 2 hours.
export const travelMins = (a, b, table = {}) => (a === b ? 0 : table[a + '|' + b] ?? (GEO[a] && GEO[b] ? Math.round(10 + kmBetween(GEO[a], GEO[b]) * 1.1) : 30));

export const MX = (lng) => ((lng - 55.09) / (55.37 - 55.09)) * 1000;

export const MY = (lat) => ((25.20 - lat) / (25.20 - 24.98)) * 640;

// Google Maps for the Liveboard, the same provider opspro-app uses. The key is GOOGLE_MAPS_API_KEY in .env,
// put in at build time (the repo is public, so it is never committed). Only the core map library loads:
// no Places, Geocoding or Directions, which are billed separately.
const GMAPS_KEY = __GMAPS_KEY__;
let gmLoad = null;
export function loadGoogleMaps() {
  if (window.google && window.google.maps && window.google.maps.Map) return Promise.resolve(window.google.maps);
  if (gmLoad) return gmLoad;
  if (!GMAPS_KEY) return Promise.reject(new Error('missing_key'));
  gmLoad = new Promise((resolve, reject) => {
    window.__opsproMapsReady = () => resolve(window.google.maps);
    // Google calls this when the key is refused (wrong key, or this address isn't allowed for it).
    window.gm_authFailure = () => { window.dispatchEvent(new Event('opspro-maps-refused')); reject(new Error('refused')); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GMAPS_KEY)}&v=weekly&loading=async&callback=__opsproMapsReady`;
    s.async = true;
    s.onerror = () => { gmLoad = null; reject(new Error('offline')); };
    document.head.appendChild(s);
  });
  return gmLoad;
}

// Map styles built from the OpsPro palette (style.css tokens), so the map reads as part of the app:
// warm neutral land like --bg, roads like --surface with --line edges, water and parks in tints of the
// brand green. Business and transit pins are off so the store pins carry the colour.
// Google needs literal hex values here; keep them in step with the tokens if the palette changes.
const QUIET = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  // Fewer of the map's own names, so the store pins and labels carry the eye; neighbourhoods stay (faint) for bearings.
  { featureType: 'administrative.land_parcel', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];
const style = (c) => [
  ...QUIET,
  { elementType: 'geometry', stylers: [{ color: c.land }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: c.built }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: c.park }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: c.water }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: c.waterText }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: c.road }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: c.roadEdge }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: c.highway }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: c.highwayEdge }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: c.text }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: c.halo }, { weight: 3 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: c.text }] },
  { featureType: 'administrative.sublocality', elementType: 'labels.text.fill', stylers: [{ color: c.faint }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: c.faint }] },
];
export const MAP_STYLES = {
  // --bg #F5F2F2, --surface-2 #EEE9E9, --line #E4DEDD, --line-strong #D3CBCA, --muted #756C6A, --faint #9A908E, --accent-soft #ECF9F5
  light: style({ land: '#F5F2F2', built: '#EEE9E9', park: '#E2EFE8', water: '#CFE6DD', waterText: '#4F7D6E', road: '#FFFFFF', roadEdge: '#E4DEDD', highway: '#FFFFFF', highwayEdge: '#D3CBCA', text: '#756C6A', faint: '#9A908E', halo: '#F5F2F2' }),
  // Dusk rather than night: a step lighter than the dark UI (--surface-2 #2A2524 land, --line #3A3331 blocks) so the map
  // reads as a surface, with roads picked out in --line-strong and soft teal water from the dark --accent.
  dark: style({ land: '#2A2524', built: '#312B2A', park: '#2C3A33', water: '#29453D', waterText: '#8CC7B4', road: '#3E3735', roadEdge: '#2A2524', highway: '#4F4644', highwayEdge: '#3A3331', text: '#CFC6C3', faint: '#A89F9C', halo: '#2A2524' }),
};

// Static map images for the location cards. A static image costs far less than a live map, is only fetched when
// the card comes on screen, and the browser can keep it, so a return visit is often free.
// Same palette as the live maps; the geofence is drawn to scale as a polygon. Needs the Static Maps API enabled
// for the key; if it isn't, the image fails and the card keeps its drawn placeholder.
const hex = (c) => c.replace('#', '');
const ACCENT = { light: '1B5746', dark: '5CC2A2' }; // --accent in each theme
const staticStyle = (rules) => rules.map((r) => 'style=' + encodeURIComponent([r.featureType && 'feature:' + r.featureType, r.elementType && 'element:' + r.elementType, ...r.stylers.flatMap((x) => Object.entries(x).map(([k, v]) => `${k}:${k === 'color' ? '0x' + hex(v) : v}`))].filter(Boolean).join('|'))).join('&');
export function staticMapUrl({ lat, lng, radius, w, h, dark }) {
  if (!GMAPS_KEY) return null;
  // Zoom so the geofence takes about 60% of the image height, with street around it.
  const mpp = (2 * radius) / (h * 0.6);
  const zoom = Math.max(12, Math.min(18, Math.floor(Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / mpp))));
  const dLat = radius / 111320, dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: 33 }, (_, i) => { const t = (i / 32) * 2 * Math.PI; return `${(lat + dLat * Math.sin(t)).toFixed(6)},${(lng + dLng * Math.cos(t)).toFixed(6)}`; }).join('|');
  const a = ACCENT[dark ? 'dark' : 'light'];
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${w}x${h}&scale=2`
    + `&path=${encodeURIComponent(`fillcolor:0x${a}26|color:0x${a}E6|weight:2|${ring}`)}`
    + `&${staticStyle(dark ? MAP_STYLES.dark : MAP_STYLES.light)}&key=${encodeURIComponent(GMAPS_KEY)}`;
}
