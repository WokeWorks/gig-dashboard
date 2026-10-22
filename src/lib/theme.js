// Dark (the default: black canvas, teal accent) or light, saved per browser as ops.theme. It sets <html data-theme>,
// which style.css keys the light tokens off and the maps watch to swap their style.
const read = () => { try { return localStorage.getItem('ops.theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } };
export const getTheme = () => document.documentElement.getAttribute('data-theme') || read();
export const setTheme = (t) => { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('ops.theme', t); } catch {} };
export const applyTheme = () => document.documentElement.setAttribute('data-theme', read());
