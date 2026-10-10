

export const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const addMin = (hhmm, m) => { const [h, mm] = hhmm.split(':').map(Number); const t = ((h * 60 + mm + m) % 1440 + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

export const toM = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

export const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export const TODAY = 2; // Wed 7 Oct

export const WEEK0 = new Date(2026, 9, 5); // Mon 5 Oct 2026

export const weekDays = (wk) => Array.from({ length: 7 }, (_, i) => { const d = new Date(WEEK0); d.setDate(d.getDate() + wk * 7 + i); return d.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ' + d.getDate(); });

export const weekLabel = (wk, short) => { const a = new Date(WEEK0); a.setDate(a.getDate() + wk * 7); const b = new Date(a); b.setDate(b.getDate() + 6); const f = (d, m) => d.getDate() + (m ? ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] : ''); return short ? `week of ${f(a, true)}` : `${f(a, a.getMonth() !== b.getMonth())} – ${f(b, true)} ${b.getFullYear()}`; };

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const fmtD = (iso) => { const d = new Date(iso + 'T00:00:00'); return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };

export const fmtRange = (a, b) => (a === b ? fmtD(a) : `${fmtD(a)} – ${fmtD(b)}`);
