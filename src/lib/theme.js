// Light, dark or follow the system. Saved per browser; the CSS tokens switch on <html data-theme>, and with no
// attribute they follow prefers-color-scheme. Maps listen for the attribute and restyle themselves.
const KEY = 'ops.theme';
export const getTheme = () => { try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; } };
export const applyTheme = (t) => { const h = document.documentElement; if (t === 'light' || t === 'dark') h.setAttribute('data-theme', t); else h.removeAttribute('data-theme'); };
export const setTheme = (t) => { try { localStorage.setItem(KEY, t); } catch {} applyTheme(t); };
