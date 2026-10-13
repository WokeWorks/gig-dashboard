// One clock for the whole app. A single timer fires on each minute boundary (not every second), every component that
// shows the time subscribes to it, and it stops while the tab is hidden and catches up when the tab comes back.
const subs = new Set();
let now = Date.now();
let timer = null;
const schedule = () => { clearTimeout(timer); timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 20); };
function tick() { now = Date.now(); subs.forEach((f) => f()); schedule(); }
const onVisible = () => { if (document.hidden) clearTimeout(timer); else tick(); };
const subscribe = (f) => {
  subs.add(f);
  if (subs.size === 1) { now = Date.now(); schedule(); document.addEventListener('visibilitychange', onVisible); }
  return () => { subs.delete(f); if (!subs.size) { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); } };
};
export const useNow = () => React.useSyncExternalStore(subscribe, () => now);

// UAE time, 12-hour, lower-case am/pm: "10:24 pm".
const FMT = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' });
export const clockTime = (t) => FMT.format(t).replace(/\s+/g, ' ').toLowerCase();

// The prototype's data is set on Wednesday 7 October, so the day stays put; the time is live.
export function LiveClock() {
  const t = useNow();
  return <>Wednesday, 7 October · {clockTime(t)}</>;
}
