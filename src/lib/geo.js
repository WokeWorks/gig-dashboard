

export const kmBetween = (a, b) => { if (!a || !b) return null; const R = 6371, rad = Math.PI / 180; const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.3 * 10) / 10; }; // ×1.3 for roads

// Store coordinates (lng, lat) and a simple projection onto the 1000×640 map.
export const GEO = { s1: [55.1385, 25.0745], s2: [55.1440, 25.0790], s3: [55.1745, 25.0975], s4: [55.2190, 25.0573], s5: [55.2390, 25.0450], s6: [55.3015, 25.0920], s7: [55.2900, 25.0080], s8: [55.3120, 25.1640] };

export const LEFT = { s1: true };

export const MX = (lng) => ((lng - 55.09) / (55.37 - 55.09)) * 1000;

export const MY = (lat) => ((25.20 - lat) / (25.20 - 24.98)) * 640;

// Basemap for the Liveboard. CARTO's free basemaps (built on OpenStreetMap) suit a dashboard: quiet colours,
// a matching dark style, and no API key. Their free tier is for low traffic; for production, point these
// URLs at a paid provider (CARTO, MapTiler, Mapbox) and keep the attribution.
export const MAP_TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  subdomains: 'abcd',
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
};
