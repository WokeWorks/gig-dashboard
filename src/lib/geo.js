

export const kmBetween = (a, b) => { if (!a || !b) return null; const R = 6371, rad = Math.PI / 180; const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.3 * 10) / 10; }; // ×1.3 for roads

// Store coordinates (lng, lat) and a simple projection onto the 1000×640 map.
export const GEO = { s1: [55.1385, 25.0745], s2: [55.1440, 25.0790], s3: [55.1745, 25.0975], s4: [55.2190, 25.0573], s5: [55.2390, 25.0450], s6: [55.3015, 25.0920], s7: [55.2900, 25.0080], s8: [55.3120, 25.1640] };

export const LEFT = { s1: true };

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

// Quiet map styles so the store pins carry the colour: no business or transit pins, muted roads.
const QUIET = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];
export const MAP_STYLES = {
  light: [
    ...QUIET,
    { elementType: 'geometry', stylers: [{ color: '#f2f1ee' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e6e2da' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfe1ea' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#ebe9e4' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6f6a64' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f7f6f3' }] },
  ],
  dark: [
    ...QUIET,
    { elementType: 'geometry', stylers: [{ color: '#1f2321' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c312e' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a403c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#142228' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#242926' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#9aa29d' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1f2321' }] },
  ],
};
