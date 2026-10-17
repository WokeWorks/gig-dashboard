import { WORKERS, SITES, MANAGERS, ALERTS as OPS_ALERTS, LEAVE, ROSTER_GROUPS, DAYS, tplOf, tplLabel, endOf, vendorOf, siteOf } from './data.js';
import { Icon, useToast, Logo, IPhone } from './ui.jsx';
import { clockInForm, formByKey, FormBody } from './forms.jsx';
import { CameraSheet } from './camera.jsx';
import { offDaysOf } from './lib/roster.js';
const offThisWeek = (id) => { const ds = offDaysOf(id); return ds === 'rot' || !ds.length ? 'None this week' : ds.map((k) => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][k]).join(', '); };

const { useState, useEffect, useRef } = React;

/* ================================================================
   The phone app. One app on the store: who signs in decides what it
   becomes. A picker is handed a setup code; a supervisor gets one by
   email. Ported from the phone-apps prototype, wired to the same data
   as the dashboard.

   Layout: the list of screens on the left (jump to any of them), the
   phone in the middle drawn as an iPhone at its real size (393 x 852)
   and scaled as a whole to fit the window, and what you are looking at
   on the right. Inside the phone every screen follows iOS spacing: a
   20px gutter, a back link over a large title, sections 32px apart,
   rows of at least 56px separated by lines (no cards), controls at
   least 44px, body text 16-17px. Status is a dot and a word. Lists
   (people, alerts, notifications) are filterable and scroll inside the
   phone, so they cope with more data. CSS: .ph-* in style.css.
   ================================================================ */

const SUP = MANAGERS[0]; // Omar Haddad: Marina Promenade, Marina Mall, Barsha Heights
const SUP_SITES = SUP.sites;
const ME = WORKERS[0]; // the picker signed in on this phone
const MY_SITE = siteOf(ME.site);
const short = (n) => n.replace(/^(Spinneys|Carrefour) /, '');
const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const ST = { 'Clocked in': 'in', 'On break': 'in', Late: 'late', 'No-show': 'missing', 'On leave': 'leave', 'Off today': 'off' };
const PILL = { in: 'Clocked in', late: 'Late', missing: 'No-show', leave: 'On leave', off: 'Day off' };
const todayShift = (w) => { const g = ROSTER_GROUPS.find((x) => x.people.includes(w.id)); const c = g && g.cells[g.people.indexOf(w.id)][2]; if (!Array.isArray(c)) return null; const [t, st] = c[0]; return `${st} – ${endOf(st, tplOf(t).base + (tplOf(t).brk || 0)).time}`; };
const addMin = (hhmm, m) => { const [h, mm] = hhmm.split(':').map(Number); const t = ((h * 60 + mm + m) % 1440 + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const PEOPLE = WORKERS.filter((w) => SUP_SITES.includes(w.site)).map((w, i) => {
  const s0 = ST[w.status] || 'in'; const sh = todayShift(w);
  const s = sh ? s0 : s0 === 'leave' ? 'leave' : 'off';
  return { w, s, shift: sh || '—', inAt: s === 'in' && sh ? addMin(sh.slice(0, 5), -((i % 7) + 2)) : null };
});
const LOCS = SUP_SITES.map((id) => { const s = siteOf(id); const ps = PEOPLE.filter((p) => p.w.site === id); return { s, req: ps.filter((p) => p.s !== 'off' && p.s !== 'leave').length, in: ps.filter((p) => p.s === 'in').length, late: ps.filter((p) => p.s === 'late').length, missing: ps.filter((p) => p.s === 'missing').length, leave: ps.filter((p) => p.s === 'leave').length }; });
const totals = () => LOCS.reduce((a, l) => ({ in: a.in + l.in, req: a.req + l.req, late: a.late + l.late, missing: a.missing + l.missing, leave: a.leave + l.leave }), { in: 0, req: 0, late: 0, missing: 0, leave: 0 });

const W_ = (id) => WORKERS.find((w) => w.id === id);
const TONE = { 'No-show': 'crit', 'Face mismatch': 'warn', Late: 'warn', 'Missing clock-out': 'warn', 'Document expiry': 'warn', 'Outside geofence': 'warn' };
const ALERTS = [
  ...OPS_ALERTS.filter((a) => a.open).map((a) => ({ id: a.id, t: a.type === 'Face mismatch' ? 'Face did not match' : a.type, who: W_(a.worker).name, loc: siteOf(a.site).name, when: /^\d/.test(a.time) ? `${a.time} today` : a.time, go: ['Face mismatch', 'Document expiry'].includes(a.type) ? (a.type === 'Face mismatch' ? 'face' : 'docs') : 'people', tone: TONE[a.type] || 'warn' })),
  ...LEAVE.filter((l) => l.status === 'Pending').slice(0, 1).map((l) => ({ id: 'lv' + l.id, t: 'Leave request waiting', who: W_(l.worker).name, loc: siteOf(W_(l.worker).site).name, when: l.asked, go: 'leave', tone: 'ring' })),
];

const fmtDay = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const APPR = {
  leave: { label: 'Leave applications', icon: 'calendar', items: LEAVE.filter((l) => l.status === 'Pending').map((l) => { const w = W_(l.worker); return {
    who: w.name, sub: `${l.type} · ${fmtDay(l.from)}${l.to !== l.from ? ' – ' + fmtDay(l.to) : ''}`,
    rows: [['Type', l.type], ['Dates', `${fmtDay(l.from)}${l.to !== l.from ? ' – ' + fmtDay(l.to) : ''}`], ['Days', String(l.days)], ['Reason', l.note || '—']],
    warn: `Rostered at ${siteOf(w.site).name} on those days. Approving takes those shifts off and asks you to find cover.`, note: l.attach ? 'Certificate attached' : null }; }) },
  docs: { label: 'Document updates', icon: 'document', items: WORKERS.filter((w) => w.docs).slice(0, 2).map((w) => ({
    who: w.name, sub: w.docs.includes('Visa') ? 'UAE visa · replacement' : 'Emirates ID · new',
    rows: w.docs.includes('Visa') ? [['Document', 'UAE visa'], ['Expires', '14 Nov 2028'], ['Sent', 'Yesterday'], ['Currently on file', 'Expires 19 Oct 2026']] : [['Document', 'Emirates ID'], ['Expires', '2 Jan 2029'], ['Sent', '2 days ago'], ['Currently on file', 'Nothing']],
    doc: true, warn: w.docs.includes('Visa') ? 'The visa on file expires soon. This replaces it.' : 'They cannot clock in until an Emirates ID is on file.' })) },
  face: { label: 'Face flagged', icon: 'face', items: OPS_ALERTS.filter((a) => a.type === 'Face mismatch').map((a) => ({
    who: W_(a.worker).name, sub: `Clock-in · ${a.time} today`,
    rows: [['When', `${a.time} today`], ['Where', siteOf(a.site).name], ['Inside geofence', 'Yes'], ['Match score', '0.41, under the 0.60 limit']],
    face: true, warn: 'The punch was recorded. A flag never blocks someone clocking in; it asks you to look.' })) },
};
const APPR_ORDER = ['leave', 'docs', 'face'];
const apprCount = () => APPR_ORDER.reduce((a, k) => a + APPR[k].items.length, 0);

// The picker's week, straight from the roster.
const myRow = (() => { const g = ROSTER_GROUPS.find((x) => x.people.includes(ME.id)); return g.cells[g.people.indexOf(ME.id)]; })();
const MY_WEEK = DAYS.map((d, i) => { const c = myRow[i]; if (!Array.isArray(c)) return [d, c === 'L' ? 'Leave' : 'Day off', '']; return [d, c.map(([t, st]) => `${st} – ${endOf(st, tplOf(t).base + (tplOf(t).brk || 0)).time}`).join(', '), c.map((x) => short(siteOf(x[2] || ME.site).name)).join(', ')]; });
const myShift = Array.isArray(myRow[2]) ? myRow[2][0] : ['f5', '07:00'];
const MY_TODAY = `${myShift[1]} – ${endOf(myShift[1], tplOf(myShift[0]).base + (tplOf(myShift[0]).brk || 0)).time}`;
const MYLEAVE = [
  { t: 'Annual leave', d: 'Mon 20 – Wed 22 Oct', st: 'waiting', meta: 'Sent yesterday. Your supervisor has not decided yet.' },
  { t: 'Sick', d: 'Thu 25 Sep', st: 'approved', meta: `Approved by ${SUP.name}` },
  { t: 'Annual leave', d: 'Fri 12 – Sat 13 Sep', st: 'rejected', meta: `${SUP.name} said: two others already off those days` },
];
const NOTES = [
  { t: `Your shift starts at ${myShift[1]}`, b: `${MY_SITE.name}. Clock in when you arrive.`, when: '6:30 AM', unread: true },
  { t: 'New shift added', b: 'Saturday 10 Oct, 07:00 – 18:00.', when: 'Yesterday', unread: true },
  { t: 'Your new passport was approved', b: 'Your supervisor has accepted it.', when: '3 Oct', unread: false },
  { t: 'Your shift changed', b: 'Thursday now starts at 09:00.', when: '1 Oct', unread: false },
];
const ACTIVITY = [
  { w: 'This week', rows: [['Mon 5 Oct', '07:00 – 18:00', '06:54 – 18:06', '11.2 h'], ['Tue 6 Oct', '07:00 – 18:00', '06:58 – 18:01', '11.0 h'], ['Wed 7 Oct', '07:00 – 18:00', '06:54 – …', 'In now']] },
  { w: 'Week of 28 Sep', rows: [['Mon 28 Sep', '07:00 – 18:00', '06:51 – 18:04', '11.2 h'], ['Tue 29 Sep', 'Day off', '—', '—'], ['Wed 30 Sep', '14:00 – 01:00', '13:58 – 01:11', '11.2 h'], ['Thu 1 Oct', '14:00 – 01:00', '14:14 – 01:02', '10.8 h']] },
];

const FLOWS = {
  picker: [['Setting up the phone', [['code', 'Enter the setup code'], ['biometric', 'Face ID / fingerprint']]],
    ['Using the app', [['home', 'Home: clock in and out'], ['schedule', 'Schedule'], ['notifications', 'Notifications'], ['profile', 'Profile'], ['leave', 'Leave'], ['leaveform', 'Requesting leave'], ['documents', 'Documents'], ['docview', 'Viewing a document']]]],
  sup: [['Signing in', [['email', 'Enter work email'], ['code', 'Code from email + mobile'], ['biometric', 'Face ID / fingerprint']]],
    ['Using the app', [['today', 'Today: metrics and alerts'], ['alerts', 'All alerts'], ['locations', 'Locations'], ['people', 'People, filtered'], ['person', 'One person'], ['activity', 'Their activity'], ['approvals', 'Approvals: what kind'], ['apprlist', 'Who is waiting'], ['appritem', 'Deciding one'], ['profile', 'Profile and devices']]]],
};
const STAGE = {
  chooser: ['The phone app', 'One app on the store. Who signs in decides what it becomes; there is no second app to build, publish or keep updated.'],
  picker: ['Signed in as a picker', 'One person, their own shifts. The phone itself becomes the credential at setup, so no password is ever typed on it.'],
  sup: ['Signed in as a supervisor', 'The same app, a different login. A supervisor sees their own locations and can act on the people in them.'],
};

const P0 = { step: 'code', screen: 'home', code: '', phone: '', clockedIn: false, onBreak: false, leaveType: 'annual', week: 'this', nf: 'unread' };
const S0 = { step: 'email', screen: 'today', email: '', code: '', phone: '', filter: 'all', loc: 'all', person: null, from: null, cat: 'leave', item: 0, decision: null, af: 'all' };

/* ---------------- building blocks ---------------- */
const DOT = { in: 'good', late: 'warn', missing: 'crit', leave: 'ring', off: 'idle' };
// The top of a screen: a back link in teal naming where it goes, then a large title and a line under it.
function Top({ title, sub, back, backLabel = 'Back', right }) {
  return (
    <header className="ph-top">
      {back && <div className="ph-navbar"><button className="ph-back" onClick={back}><Icon name="chevronLeft" size={24} stroke={2.2} />{backLabel}</button></div>}
      {title && <div className="ph-titlerow"><h1 className="ph-title">{title}</h1>{right}</div>}
      {sub && <p className="ph-sub">{sub}</p>}
    </header>
  );
}
const Sec = ({ title, action, children }) => <section className="ph-sec">{(title || action) && <div className="ph-sech"><h2>{title}</h2>{action}</div>}{children}</section>;
function Row({ lead, title, sub, meta, trail, onClick, chev, i = 0 }) {
  const T = onClick ? 'button' : 'div';
  return (
    <T className={'ph-row' + (onClick ? ' tap' : '')} onClick={onClick} style={{ '--i': i }}>
      {lead}
      <span className="ph-rmain"><b>{title}</b>{sub && <span>{sub}</span>}{meta && <small>{meta}</small>}</span>
      {trail}{chev && <Icon name="chevronRight" size={20} className="ph-chev" />}
    </T>
  );
}
const KV = ({ rows }) => <dl className="ph-kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
const Hint = ({ children, center }) => <p className={'ph-hint' + (center ? ' c' : '')}>{children}</p>;
const Warn = ({ children }) => <p className="ph-warn"><span className="sdot warn" />{children}</p>;
const Btn = ({ kind = '', ...p }) => <button className={'ph-btn ' + kind} {...p} />;
const Small = ({ kind = '', ...p }) => <button className={'ph-sbtn ' + kind} {...p} />;
const Seg = ({ value, set, opts }) => <div className="ph-seg" role="group">{opts.map(([id, l]) => <button key={id} className={value === id ? 'on' : ''} aria-pressed={value === id} onClick={() => set(id)}>{l}</button>)}</div>;
const Chips = ({ value, set, opts }) => <div className="ph-chips">{opts.map(([id, l, n]) => <button key={id} className={value === id ? 'on' : ''} aria-pressed={value === id} onClick={() => set(id)}>{l}{n !== undefined && <span>{n}</span>}</button>)}</div>;
const Field = ({ label, ...p }) => <label className="ph-field"><span>{label}</span><input {...p} /></label>;
const Face = ({ name, s, big }) => <span className={'live-face ph-face ' + (s ? DOT[s] : 'none') + (big ? ' big' : '')}>{initials(name)}</span>;
const Status = ({ s, label }) => <span className="ph-status"><span className={'sdot ' + (DOT[s] || s)} />{label || PILL[s]}</span>;
const Ic = ({ name }) => <span className="ph-ic"><Icon name={name} size={20} /></span>;
const Hero = ({ name, sub, s, face }) => <div className="ph-hero">{face ? <span className="ph-face big none live-face"><Icon name="face" size={28} /></span> : <Face name={name} big />}<div><b>{name}</b><span>{sub}</span>{s && <Status s={s} />}</div></div>;
const Empty = ({ title, sub }) => <div className="ph-empty"><span className="lv-none-ic"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span><b>{title}</b><span>{sub}</span></div>;
// Signing in: what to do at the top, the fields, and the button pinned to the bottom of the screen.
const Auth = ({ icon, title, sub, children, cta, hint }) => <div className="ph-auth"><div className="ph-auth-top">{icon}<h1>{title}</h1>{sub && <p>{sub}</p>}{children}</div><div className="ph-auth-foot">{cta}{hint && <Hint center>{hint}</Hint>}</div></div>;
const Mark = () => <span className="ph-mark"><Logo size={34} color="var(--accent)" tight /></span>;
const Bio = () => <span className="ph-bio"><Icon name="finger" size={44} stroke={1.6} /></span>;

// Today's store, as in the picker app (opspro-picker-app StoreCard): chain over area on the left,
// start and end stacked big on the right, "Open in Maps" along the bottom.
const fmt12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${h % 12 === 0 ? 12 : h % 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; };
function StoreCard({ label, site, start, end, onMaps }) {
  const m = site.name.match(/^(Carrefour|Spinneys)\s+(.*)$/); const chain = m ? m[1] : site.name; const area = m ? m[2] : null;
  return (
    <section className="ph-store">
      <div className="ph-store-top">
        <div className="ph-store-where">{label && <span className="ph-lab">{label}</span>}<b>{chain}</b>{area && <span>{area}</span>}</div>
        <div className="ph-store-times" aria-label={`${fmt12(start)} to ${fmt12(end)}`}><b>{fmt12(start)}</b><span>to</span><b>{fmt12(end)}</b></div>
      </div>
      <button className="ph-store-map" onClick={onMaps}><Icon name="pin" size={18} /> Open in Maps</button>
    </section>
  );
}

const FIT_W = 415, FIT_H = 874; // the frame: a 393 x 852 screen plus an 11px bezel
export function PhoneApp() {
  // The phone is drawn at a real phone's size and scaled down as a whole to fit the window,
  // so it keeps a phone's proportions instead of getting squat on short screens.
  const frame = useRef(null);
  useEffect(() => {
    const fit = () => { const el = frame.current; if (!el) return; const narrow = window.innerWidth <= 860; el.style.zoom = Math.min(1, narrow ? 1 : (window.innerHeight - 48) / FIT_H, (window.innerWidth - (narrow ? 32 : 640)) / FIT_W).toFixed(3); };
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, []);
  const [view, setView] = useState('chooser'); // chooser | picker | sup
  const [pk, setPk] = useState(P0);
  const [sv, setSv] = useState(S0);
  const [cam, setCam] = useState(null);
  const [form, setForm] = useState(null);
  const [ans, setAns] = useState({});
  const toast = useToast();
  const P = (patch) => setPk((x) => ({ ...x, ...patch }));
  const V = (patch) => setSv((x) => ({ ...x, ...patch }));
  const reset = () => { setView('chooser'); setPk(P0); setSv(S0); setCam(null); setForm(null); };
  const jump = (k, j) => {
    setView(k); setCam(null); setForm(null);
    if (k === 'picker') P(['code', 'biometric'].includes(j) ? { step: j } : { step: 'done', screen: j });
    else V(['email', 'code', 'biometric'].includes(j) ? { step: j } : { step: 'done', screen: j, person: sv.person || (PEOPLE.find((p) => p.s === 'late') || PEOPLE[0]).w.id });
  };
  const first = (n) => n.split(' ')[0];

  /* ---------------- picker ---------------- */
  const startIn = () => { const f = clockInForm('Pickers'); if (f) { setAns({}); setForm({ f, then: 'in' }); } else setCam('in'); };
  const picker = () => {
    if (form) return <div className="ph-form"><Top back={() => setForm(null)} backLabel="Home" /><FormBody form={form.f} answers={ans} setAnswers={setAns} ctx={`${MY_SITE.name} · Today · ${myShift[1]} shift`} submitLabel={form.then === 'in' ? 'Submit and clock in' : 'Send report'} onSubmit={() => { const t = form.then; setForm(null); if (t === 'in') setCam('in'); else toast('Report sent · your supervisor has it'); }} /></div>;
    if (cam) return <CameraSheet out={cam === 'out'} onCancel={() => setCam(null)} onDone={() => { P({ clockedIn: cam === 'in', onBreak: false }); setCam(null); }} />;
    if (pk.step === 'code') { const ok = pk.code.length >= 4 && pk.phone.length >= 4; return (
      <Auth icon={<Mark />} title="Set up this phone" sub="Your supervisor gives you a setup code. It works once, on one phone."
        cta={<Btn disabled={!ok} onClick={() => P({ step: 'biometric' })}>Set up</Btn>}
        hint="The code and the number must both match. A wrong one gives the same answer as a wrong code, so neither can be guessed on its own.">
        <div className="ph-fields"><Field label="Setup code" id="pcode" placeholder="8 characters" autoComplete="one-time-code" value={pk.code} onChange={(e) => P({ code: e.target.value })} />
          <Field label="Your mobile number" id="pphone" type="tel" inputMode="tel" placeholder="05X XXX XXXX" value={pk.phone} onChange={(e) => P({ phone: e.target.value })} /></div>
      </Auth>); }
    if (pk.step === 'biometric') return (
      <Auth icon={<Bio />} title="Confirm it's you" sub="OpsPro uses Face ID so nobody else can clock in as you."
        cta={<Btn onClick={() => P({ step: 'done', screen: 'home' })}>Use Face ID</Btn>}
        hint="The phone itself is now the credential. Apple or Google vouches for the app on every punch, and the code you used is spent." />);
    const sc = pk.screen;
    if (sc === 'home') { const f = clockInForm('Pickers'); const end = endOf(myShift[1], tplOf(myShift[0]).base + (tplOf(myShift[0]).brk || 0)).time; return <>
      <Top title={`Hi ${first(ME.name)}`} sub="Wednesday 7 October" right={<button className="ph-me" onClick={() => P({ screen: 'profile' })} aria-label="Profile">{initials(ME.name)}</button>} />
      <StoreCard label="Today" site={MY_SITE} start={myShift[1]} end={end} onMaps={() => toast(`Opening ${MY_SITE.name} in Maps`)} />
      <div className="ph-clock">
        {pk.clockedIn && <div className="ph-nums"><div><b>06:54</b><span>Clocked in at</span></div><div><b>1h 00m</b><span>{pk.onBreak ? 'On break' : 'Break left'}</span></div></div>}
        <button className={'ph-clockbtn' + (pk.clockedIn ? ' out' : '')} onClick={() => (pk.clockedIn ? setCam('out') : startIn())}><Icon name="face" size={44} stroke={1.7} /><span>{pk.clockedIn ? 'Clock out' : 'Clock in'}</span></button>
        <Hint center>{!pk.clockedIn && f ? `A quick ${f.name.toLowerCase()} first, then a photo of your face` : 'Tap, then take a photo of your face'}</Hint>
      </div>
      {pk.clockedIn && <div className="ph-stack">
        <Btn kind="ghost" onClick={() => { P({ onBreak: !pk.onBreak }); toast(pk.onBreak ? 'Break ended' : 'Break started'); }}>{pk.onBreak ? 'End break' : 'Start break'}</Btn>
        {formByKey('Incident report') && <Btn kind="ghost" onClick={() => { setAns({}); setForm({ f: formByKey('Incident report'), then: 'report' }); }}>Report an incident</Btn>}
      </div>}
      {!pk.clockedIn && <Sec title="Before you can clock in">
        {[['You are at the location', 'Yes'], ['Shift window open', 'Yes'], ['Documents valid', ME.docs ? 'Check' : 'Yes']].map(([k, v], i) => <Row key={k} i={i} lead={<span className={'sdot ' + (v === 'Yes' ? 'good' : 'warn')} />} title={k} trail={<span className="ph-val">{v}</span>} />)}
      </Sec>}
    </>; }
    if (sc === 'schedule') return <>
      <Top title="Schedule" sub={`${MY_SITE.name} · ${tplLabel(tplOf(myShift[0]))}`} />
      <Seg value={pk.week} set={(w) => P({ week: w })} opts={[['this', 'This week'], ['next', 'Next week']]} />
      {pk.week === 'next' ? <Empty title="Next week is still a draft" sub="It shows here once your supervisor publishes it." /> : <>
        <div className="ph-list ph-week">{MY_WEEK.map(([d, t, at], i) => { const off = t === 'Day off' || t === 'Leave'; return <Row key={d} i={i} lead={<span className={'ph-day' + (i === 2 ? ' now' : '')}>{d}</span>} title={<span className={off ? 'ph-off' : ''}>{t}</span>} sub={at || null} trail={i === 2 ? <Status s="good" label="Today" /> : null} />; })}</div>
        <Sec title="Open shifts you can claim">
          <Row title="Fri 9 Oct · 14:00 – 01:00" sub={`${siteOf('s2').name} · your day off, paid as rest-day work`} trail={<Small onClick={() => toast('Claim sent · your supervisor approves it')}>Claim</Small>} />
          <Hint>Your supervisor approves each claim.</Hint>
        </Sec>
        <div className="ph-stack"><Btn kind="ghost" onClick={() => P({ screen: 'leaveform' })}>Request leave</Btn></div>
      </>}
    </>;
    if (sc === 'notifications') { const list = NOTES.filter((n) => n.unread === (pk.nf === 'unread')); return <>
      <Top title="Notifications" />
      <Seg value={pk.nf} set={(v) => P({ nf: v })} opts={[['unread', `Unread · ${NOTES.filter((n) => n.unread).length}`], ['read', 'Read']]} />
      {list.length ? <div className="ph-list">{list.map((n, i) => <Row key={n.t} i={i} lead={<span className={'sdot ' + (n.unread ? 'good' : 'idle')} />} title={n.t} sub={n.b} meta={n.when} />)}</div> : <Empty title="All caught up" sub="Nothing new since you last looked." />}
      <Hint center>Kept for 90 days, then removed.</Hint>
    </>; }
    if (sc === 'profile') return <>
      <Top back={() => P({ screen: 'home' })} backLabel="Home" title="Profile" />
      <Hero name={ME.name} sub={`${ME.code} · ${vendorOf(ME.vendor).name}`} />
      <KV rows={[['Mobile', '05X XXX ' + ME.phone.slice(-4)], ['Usual shift', tplLabel(tplOf(myShift[0]))], ['Off this week', offThisWeek(ME.id)]]} />
      <Sec title="Reference photo"><Row lead={<Ic name="face" />} title="In use" sub="Every clock-in is checked against this." trail={<Small kind="ghost" onClick={() => toast('Takes a new photo; your supervisor approves it first')}>Replace</Small>} /></Sec>
      <Sec title="More">
        <Row i={0} lead={<Ic name="document" />} title="Documents" sub="Passport, visa, Emirates ID" chev onClick={() => P({ screen: 'documents' })} />
        <Row i={1} lead={<Ic name="calendar" />} title="Leave" sub="Request it, and see what you have asked for" chev onClick={() => P({ screen: 'leave' })} />
      </Sec>
      <div className="ph-stack"><Btn kind="ghost danger" onClick={() => toast('Signed out of this phone')}>Sign out of this phone</Btn></div>
    </>;
    if (sc === 'leave') { const tone = { waiting: ['warn', 'Waiting'], approved: ['good', 'Approved'], rejected: ['crit', 'Rejected'] }; return <>
      <Top back={() => P({ screen: 'profile' })} backLabel="Profile" title="Leave" />
      <div className="ph-stack"><Btn onClick={() => P({ screen: 'leaveform' })}>Request leave</Btn></div>
      <Sec title="Your requests">{MYLEAVE.map((l, i) => <Row key={l.d} i={i} title={l.t} sub={l.d} meta={l.meta} trail={<Status s={tone[l.st][0]} label={tone[l.st][1]} />} />)}</Sec>
      <Hint>A request you have sent can be withdrawn until it is decided. After that it has to go back through the office, because the roster has already changed.</Hint>
    </>; }
    if (sc === 'leaveform') { const k = pk.leaveType; const sick = k === 'sick' || k === 'emergency'; return <>
      <Top back={() => P({ screen: 'leave' })} backLabel="Leave" title="Request leave" />
      <Sec title="Type">
        <Chips value={k} set={(id) => P({ leaveType: id })} opts={[['annual', 'Annual'], ['sick', 'Sick'], ['emergency', 'Emergency'], ['unpaid', 'Unpaid']]} />
        <Hint>{sick ? 'Sick and emergency cover today and yesterday. You are telling your supervisor, not asking in advance.' : 'Annual leave is from tomorrow onwards, so the roster can be planned around it.'}</Hint>
      </Sec>
      <div className="ph-fields">
        <Field label="From" defaultValue={sick ? 'Wed 7 Oct (today)' : 'Mon 20 Oct'} key={'f' + sick} />
        <Field label="To" defaultValue={sick ? 'Wed 7 Oct (today)' : 'Wed 22 Oct'} key={'t' + sick} />
        <Field label={'Reason' + (sick ? '' : ' (optional)')} placeholder={sick ? 'What happened' : 'Anything your supervisor should know'} />
      </div>
      <Sec title="What this affects">
        <Warn>You are rostered on {sick ? '1 shift today' : 'all 3 of those days'}. If this is approved {sick ? 'that shift' : 'those shifts'} comes off your roster and your supervisor is asked to find cover.</Warn>
        {sick && <Row lead={<Ic name="document" />} title="Add a sick note" sub="Photo or file, optional" trail={<Small kind="ghost" onClick={() => toast('Camera opens')}>Add</Small>} />}
      </Sec>
      <div className="ph-stack"><Btn onClick={() => { P({ screen: 'leave' }); toast('Leave request sent'); }}>Send request</Btn>
        <Hint>No days-remaining figure is shown here, because no yearly allowance is set for you. When one is, it appears above.</Hint></div>
    </>; }
    if (sc === 'documents') { const docs = [['Passport', 'Valid until 14 Mar 2029', 'good'], ['UAE visa', 'Expires 19 Oct 2026', 'warn'], ['Emirates ID', 'Valid until 2 Jan 2028', 'good'], ['Food handling certificate', 'Not uploaded', 'crit']]; return <>
      <Top back={() => P({ screen: 'profile' })} backLabel="Profile" title="Your documents" />
      <div className="ph-list">{docs.map(([n, d, t], i) => <Row key={n} i={i} lead={<Ic name="document" />} title={n} sub={<Status s={t} label={d} />} trail={t === 'crit' ? <Small onClick={() => toast('Take a photo or pick a file')}>Upload</Small> : <Small kind="ghost" onClick={() => P({ screen: 'docview' })}>View</Small>} />)}</div>
      <Hint>Anything you send is checked by your supervisor before it replaces what is on file.</Hint>
    </>; }
    if (sc === 'docview') return <>
      <Top back={() => P({ screen: 'documents' })} backLabel="Documents" title="UAE visa" sub="Expires 19 Oct 2026" />
      <div className="ph-doc tall"><Icon name="document" size={32} stroke={1.5} />Document shown here</div>
      <Hint center>Opens inside the app. Nothing is saved to your phone.</Hint>
    </>;
    return null;
  };

  /* ---------------- supervisor ---------------- */
  const sup = () => {
    if (sv.step === 'email') { const ok = sv.email.indexOf('@') > 0; return (
      <Auth icon={<Mark />} title="Set up this phone" sub="Enter your work email. We send a code to the address on your account."
        cta={<Btn disabled={!ok} onClick={() => V({ step: 'code' })}>Send me a code</Btn>}
        hint="The answer is the same whether or not the account exists, so this cannot be used to find out who works here.">
        <div className="ph-fields"><Field label="Work email" id="semail" type="email" inputMode="email" autoComplete="email" placeholder="you@company.com" value={sv.email} onChange={(e) => V({ email: e.target.value })} /></div>
      </Auth>); }
    if (sv.step === 'code') { const ok = sv.code.length >= 4 && sv.phone.length >= 4; return (
      <Auth icon={<span className="ph-bio"><Icon name="document" size={36} stroke={1.6} /></span>} title="Check your email" sub={<>A code is on its way to <b>{sv.email || 'your email'}</b>. It lasts 10 minutes and works once.</>}
        cta={<Btn disabled={!ok} onClick={() => V({ step: 'biometric' })}>Continue</Btn>}
        hint="Two things, not one. A code sitting in someone else's mailbox is not enough on its own.">
        <div className="ph-fields"><Field label="Code from the email" id="scode" inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits" value={sv.code} onChange={(e) => V({ code: e.target.value })} />
          <Field label="Your mobile number" id="sphone" type="tel" inputMode="tel" placeholder="05X XXX XXXX" value={sv.phone} onChange={(e) => V({ phone: e.target.value })} /></div>
      </Auth>); }
    if (sv.step === 'biometric') return (
      <Auth icon={<Bio />} title="Confirm it's you" sub="And again each time you act on someone else: clocking them in, approving leave."
        cta={<Btn onClick={() => V({ step: 'done', screen: 'today' })}>Use Face ID</Btn>}
        hint="You can have this on two phones. Adding one emails you straight away, so a device you did not add is obvious." />);
    const sc = sv.screen; const t = totals();
    const alertRow = (a, i) => <Row key={a.id} i={i} lead={<span className={'sdot ' + a.tone} />} title={a.t} sub={`${a.who} · ${a.loc}`} meta={a.when} chev onClick={() => (a.go === 'people' ? V({ filter: 'missing', loc: 'all', from: null, screen: 'people' }) : V({ cat: a.go, screen: 'apprlist' }))} />;
    if (sc === 'today') return <>
      <Top title="Today" sub={`Wednesday 7 October · your ${SUP_SITES.length} locations`} right={<button className="ph-me" onClick={() => V({ screen: 'profile' })} aria-label="Profile">{initials(SUP.name)}</button>} />
      <div className="ph-metrics">
        {[['in', <>{t.in}<small>/{t.req}</small></>, 'Clocked in', 'good'], ['late', t.late, 'Late', 'warn'], ['missing', t.missing, 'Missing', 'crit'], ['leave', t.leave, 'On leave', 'ring']].map(([f, v, l, d], i) => (
          <button key={f} style={{ '--i': i }} onClick={() => V({ filter: f, loc: 'all', screen: 'people', from: null })}><b>{v}</b><span><span className={'sdot ' + d} />{l}</span></button>))}
      </div>
      <Hint>Late is past the start time plus grace. Missing is past 60 minutes, the same line the roster calls a no-show. Leave is approved leave only; a weekly off is not counted.</Hint>
      <Sec title="Needs you" action={<button className="ph-link" onClick={() => V({ screen: 'alerts' })}>See all {ALERTS.length}</button>}>
        {ALERTS.slice(0, 5).map(alertRow)}
        <Hint>Oldest still unresolved first, not newest. A face flag nobody has looked at for two days matters more than a late clock-in that has already sorted itself out.</Hint>
      </Sec>
    </>;
    if (sc === 'alerts') { const AF = { all: () => true, noshow: (a) => a.t === 'No-show', face: (a) => a.go === 'face', docs: (a) => a.go === 'docs', leave: (a) => a.go === 'leave' }; const list = ALERTS.filter(AF[sv.af]); return <>
      <Top back={() => V({ screen: 'today' })} backLabel="Today" title="Alerts" sub={`${ALERTS.length} not yet resolved`} />
      <Chips value={sv.af} set={(f) => V({ af: f })} opts={[['all', 'All', ALERTS.length], ['noshow', 'No-show', ALERTS.filter(AF.noshow).length], ['face', 'Face', ALERTS.filter(AF.face).length], ['docs', 'Documents', ALERTS.filter(AF.docs).length], ['leave', 'Leave', ALERTS.filter(AF.leave).length]]} />
      {list.length ? <div className="ph-list">{list.map(alertRow)}</div> : <Empty title="Nothing here" sub="No open alerts of this kind." />}
    </>; }
    if (sc === 'locations') return <>
      <Top title="Locations" sub={`The ${LOCS.length} you look after`} />
      <div className="ph-list">{LOCS.map((l, i) => { const shortBy = l.req - l.in; const extra = [l.late && `${l.late} late`, l.missing && `${l.missing} missing`, l.leave && `${l.leave} on leave`].filter(Boolean).join(' · '); return (
        <button key={l.s.id} className="ph-row tap ph-loc" style={{ '--i': i }} onClick={() => V({ loc: l.s.id, filter: 'all', screen: 'people', from: 'locations' })}>
          <span className="ph-rmain">
            <span className="ph-loc-top"><b>{l.s.name}</b>{shortBy > 0 ? <Status s={l.missing ? 'crit' : 'warn'} label={`${shortBy} short`} /> : <Status s="good" label="Full" />}</span>
            <span>{l.s.hours}</span>
            <span className="ph-meter" aria-hidden="true">{Array.from({ length: Math.max(l.req, 1) }, (_, k) => <i key={k} className={k < l.in ? 'f' : ''} />)}</span>
            <small>{l.in} of {l.req} clocked in{extra && ` · ${extra}`}</small>
          </span>
          <Icon name="chevronRight" size={20} className="ph-chev" />
        </button>); })}</div>
    </>;
    if (sc === 'people') { const list = PEOPLE.filter((p) => (sv.filter === 'all' || p.s === sv.filter) && (sv.loc === 'all' || p.w.site === sv.loc)); const inLoc = PEOPLE.filter((p) => sv.loc === 'all' || p.w.site === sv.loc); const n = (f) => inLoc.filter((p) => f === 'all' || p.s === f).length; return <>
      <Top back={sv.from === 'locations' ? () => V({ screen: 'locations' }) : null} backLabel="Locations" title="People" sub={`${list.length} ${list.length === 1 ? 'person' : 'people'}${sv.loc === 'all' ? ' across your locations' : ' at ' + siteOf(sv.loc).name}`} />
      <div className="ph-filters">
        <Chips value={sv.filter} set={(f) => V({ filter: f })} opts={[['all', 'Everyone', n('all')], ['in', 'Clocked in', n('in')], ['late', 'Late', n('late')], ['missing', 'Missing', n('missing')], ['leave', 'On leave', n('leave')]]} />
        <Chips value={sv.loc} set={(l) => V({ loc: l })} opts={[['all', 'All locations'], ...SUP_SITES.map((id) => [id, short(siteOf(id).name)])]} />
      </div>
      {list.length === 0 ? <Empty title="Nobody matches" sub="Try another status or location." /> :
        <div className="ph-list">{list.map((p, i) => <Row key={p.w.id} i={i} lead={<Face name={p.w.name} />} title={p.w.name} sub={short(siteOf(p.w.site).name)} meta={p.shift === '—' ? null : p.shift} trail={<Status s={p.s} />} onClick={() => V({ person: p.w.id, screen: 'person' })} />)}</div>}
    </>; }
    if (sc === 'person') { const p = PEOPLE.find((x) => x.w.id === sv.person) || PEOPLE[0]; return <>
      <Top back={() => V({ screen: 'people' })} backLabel="People" />
      <Hero name={p.w.name} sub={`${p.w.code} · ${vendorOf(p.w.vendor).name}`} s={p.s} />
      <Sec title="Today"><KV rows={[['Location', siteOf(p.w.site).name], ['Rostered', p.shift], ['Clocked in', p.inAt || '—'], ['Clocked out', '—'], ['Designation', p.w.role]]} /></Sec>
      {(p.s === 'missing' || p.s === 'late') && <Warn>{p.s === 'missing' ? 'Past 60 minutes with no clock-in. This already counts as a no-show.' : 'Past their start time and not in yet.'}</Warn>}
      <Sec title="Do something">
        <div className="ph-stack flush">
          {p.s !== 'in' ? <Btn onClick={() => toast(`Fingerprint confirmed · ${first(p.w.name)} marked in, recorded as done by you`)}>Clock them in now</Btn> : <Btn kind="ghost" onClick={() => toast('Fingerprint confirmed · clocked out')}>Clock them out</Btn>}
          <Btn kind="ghost" onClick={() => toast(`${first(p.w.name)} marked absent`)}>Mark absent</Btn>
          <Btn kind="ghost" onClick={() => V({ screen: 'activity' })}>View activity</Btn>
        </div>
        <Hint>Anything here asks for your fingerprint first, and records that you did it: not just your account, but which of your phones.</Hint>
      </Sec>
    </>; }
    if (sc === 'activity') { const p = PEOPLE.find((x) => x.w.id === sv.person) || PEOPLE[0]; return <>
      <Top back={() => V({ screen: 'person' })} backLabel={first(p.w.name)} title="Activity" sub={`${p.w.name} · ${p.w.code}`} />
      {ACTIVITY.map((wk) => <Sec key={wk.w} title={wk.w}>{wk.rows.map((r, i) => <Row key={r[0]} i={i} title={r[0]} sub={`Rostered ${r[1]}`} meta={`Actual ${r[2]}`} trail={<span className="ph-val">{r[3]}</span>} />)}</Sec>)}
      <Hint center>Every week they have worked, newest first.</Hint>
    </>; }
    if (sc === 'approvals') return <>
      <Top title="Approvals" sub={`${apprCount()} waiting on you`} />
      <div className="ph-list">{APPR_ORDER.map((k, i) => <Row key={k} i={i} lead={<Ic name={APPR[k].icon} />} title={APPR[k].label} sub={`${APPR[k].items.length} waiting`} chev onClick={() => V({ cat: k, screen: 'apprlist' })} />)}</div>
      <Hint>Grouped by what you are deciding, because the three need different things from you. Leave needs the roster. A document needs reading. A face flag needs two photos side by side.</Hint>
    </>;
    if (sc === 'apprlist') { const g = APPR[sv.cat]; return <>
      <Top back={() => V({ screen: 'approvals' })} backLabel="Approvals" title={g.label} sub={`${g.items.length} waiting`} />
      {g.items.length ? <div className="ph-list">{g.items.map((it, i) => <Row key={it.who + i} i={i} lead={<Face name={it.who} />} title={it.who} sub={it.sub} chev onClick={() => V({ item: i, decision: null, screen: 'appritem' })} />)}</div> : <Empty title="Nothing waiting" sub="You are up to date." />}
    </>; }
    if (sc === 'appritem') { const g = APPR[sv.cat]; const it = g.items[sv.item] || g.items[0]; if (!it) return null; return <>
      <Top back={() => V({ screen: 'apprlist', decision: null })} backLabel={g.label} />
      <Hero name={it.who} sub={it.sub} />
      <Sec title="What you are approving">
        {it.face && <div className="ph-photos">{[['Punch selfie', 'Taken at the punch'], ['Reference photo', 'On file since 12 Aug']].map(([a, b]) => <figure key={a}><div className="ph-doc"><Icon name="face" size={30} stroke={1.5} />{a}</div><figcaption>{b}</figcaption></figure>)}</div>}
        {it.doc && <div className="ph-doc"><Icon name="document" size={30} stroke={1.5} />Document shown here</div>}
        <KV rows={it.rows} />
        {it.note && <Row lead={<Ic name="document" />} title={it.note} trail={<Small kind="ghost" onClick={() => toast('Opens the certificate')}>Open</Small>} />}
        <Warn>{it.warn}</Warn>
      </Sec>
      <Sec title="Your decision">
        <Seg value={sv.decision} set={(d) => V({ decision: d })} opts={[['approve', 'Approve'], ['reject', 'Reject']]} />
        <div className="ph-fields"><Field label={'Reason' + (sv.decision === 'reject' ? '' : ' (optional)')} placeholder={sv.decision === 'reject' ? 'They are told exactly this, so say what to do next' : 'Anything worth recording'} /></div>
        <div className="ph-stack flush"><Btn disabled={!sv.decision} onClick={() => { toast(`Fingerprint confirmed · ${sv.decision === 'approve' ? 'approved' : 'rejected'}, ${first(it.who)} is told`); V({ screen: 'apprlist', decision: null }); }}>{sv.decision === 'reject' ? 'Reject' : sv.decision === 'approve' ? 'Approve' : 'Choose approve or reject'}</Btn></div>
        <Hint>A rejection has to say why: the words go straight to them, and "not approved" with no reason just means they send the same thing again. Your fingerprint is asked for before this is saved.</Hint>
      </Sec>
    </>; }
    if (sc === 'profile') return <>
      <Top back={() => V({ screen: 'today' })} backLabel="Today" title="Profile" />
      <Hero name={SUP.name} sub="Supervisor · Manager access" />
      <KV rows={[['Email', 'omar@company.com'], ['Locations', String(SUP_SITES.length)]]} />
      <Sec title="Your phones">
        <Row i={0} lead={<Ic name="phone" />} title="iPhone 15 · this phone" sub={`Added 3 Oct · in use now · last at ${short(siteOf('s3').name)}`} />
        <Row i={1} lead={<Ic name="monitor" />} title="Galaxy Tab" sub={`Added 28 Sep · 2 days ago · last at ${short(siteOf('s1').name)}`} trail={<Small kind="ghost danger" onClick={() => toast('Removed · that tablet is signed out')}>Remove</Small>} />
        <Hint>Two phones at most. Where each one last acted comes from the GPS on a real punch, not an IP address, which on mobile data points at the carrier rather than at you.</Hint>
      </Sec>
      <div className="ph-stack"><Btn kind="ghost danger" onClick={() => toast('Signed out of this phone')}>Sign out of this phone</Btn></div>
    </>;
    return null;
  };

  const chooser = () => (
    <div className="ph-auth ph-choose">
      <div className="ph-lockup"><Logo size={72} color="var(--accent)" tight /><b>OpsPro</b></div>
      <div className="ph-auth-foot">
        <Btn className="ph-btn ph-who" onClick={() => { setView('picker'); P({ step: 'code' }); }}><Icon name="person" size={22} />Employee login</Btn>
        <Btn kind="ghost" className="ph-btn ghost ph-who" onClick={() => { setView('sup'); V({ step: 'email' }); }}><Icon name="users" size={22} />Manager login</Btn>
        <Hint center>Asked once, at setup. Employees are handed a sign-in code and managers get theirs by email, so the app asks which first.</Hint>
      </div>
    </div>
  );

  const isP = view === 'picker';
  const inApp = (isP && pk.step === 'done' && !cam && !form) || (view === 'sup' && sv.step === 'done');
  const tabs = isP ? [['home', 'home', 'Home'], ['schedule', 'calendar', 'Schedule'], ['notifications', 'bell', 'Notifications']] : [['today', 'grid', 'Today'], ['locations', 'pin', 'Locations'], ['people', 'users', 'People'], ['approvals', 'check', 'Approvals']];
  const cur = isP ? pk.screen : sv.screen;
  const parent = { docview: 'home', documents: 'home', profile: 'home', leave: 'home', leaveform: 'home', person: 'people', activity: 'people', alerts: 'today', apprlist: 'approvals', appritem: 'approvals' }[cur] || cur;
  const ti = Math.max(0, tabs.findIndex((t) => t[0] === parent));
  const st = STAGE[view];
  const curStep = (k) => (view !== k ? '' : k === 'picker' ? (pk.step !== 'done' ? pk.step : pk.screen) : (sv.step !== 'done' ? sv.step : sv.screen));
  const stepId = view === 'chooser' ? 'chooser' : curStep(view);
  const stepLabel = view === 'chooser' ? 'Employee or manager login' : (FLOWS[view].flatMap(([, xs]) => xs).find(([id]) => id === stepId) || [, ''])[1];
  // A new screen starts at the top, as it would on a phone.
  useEffect(() => { const b = frame.current && frame.current.querySelector('.ip-body'); if (b) b.scrollTop = 0; }, [view, stepId, !!cam, !!form]);

  const tabbar = inApp && (
    <nav className="ph-tabs" aria-label="App">
      {tabs.map(([id, ic, label], n) => <button key={id} className={n === ti ? 'on' : ''} aria-current={n === ti ? 'page' : undefined} onClick={() => (isP ? P({ screen: id }) : V({ screen: id, ...(id === 'people' ? { from: null, loc: 'all' } : {}) }))}>
        <span className="ph-tabic"><Icon name={ic} size={24} stroke={n === ti ? 2.1 : 1.8} />{id === 'notifications' && <span className="ph-badge">{NOTES.filter((x) => x.unread).length}</span>}{id === 'approvals' && <span className="ph-badge">{apprCount()}</span>}</span>{label}</button>)}
    </nav>
  );

  return (
    <>
      <aside className="side op-flows ph-flows" aria-label="Screens">
        <div className="ph-flows-label">Screens</div>
        <button className={'op-start' + (view === 'chooser' ? ' on' : '')} onClick={() => setView('chooser')}><Icon name="phone" size={19} />Start: employee or manager login</button>
        {[['picker', 'Picker app', 'person'], ['sup', 'Supervisor app', 'users']].map(([k, label, ic]) => (
          <div key={k} className={'op-flow ' + k + (view === k ? ' open' : '')}>
            <button className={'op-apphead' + (view === k ? ' on' : '')} onClick={() => jump(k, k === 'picker' ? (pk.step === 'done' ? pk.screen : pk.step) : (sv.step === 'done' ? sv.screen : sv.step))}><Icon name={ic} size={19} />{label}<Icon name="chevronRight" size={16} className="ph-flows-chev" /></button>
            {view === k && FLOWS[k].map(([g, items]) => <div key={g} className="ph-flows-group"><div className="op-navhead">{g}</div>{items.map(([id, l], i) => <button key={id} style={{ '--i': i }} className={'op-navitem' + (curStep(k) === id ? ' on' : '')} onClick={() => jump(k, id)}>{l}</button>)}</div>)}
          </div>
        ))}
      </aside>
      <main className="main ph-main">
        <div className="ph-stage">
          <IPhone className="ph-device" frameRef={frame} bodyClass={'ph-body' + (cam ? ' flush' : '') + (form ? ' fp-screen' : '') + (inApp ? ' tabbed' : '')} foot={tabbar}>
            <div className="ph-screen" key={view + stepId + (cam || '') + (form ? 'f' : '')}>{view === 'chooser' ? chooser() : isP ? picker() : sup()}</div>
          </IPhone>
          <aside className="ph-info" key={view}>
            <span className="ph-info-lab">{view === 'chooser' ? 'Before signing in' : view === 'picker' ? 'Picker app' : 'Supervisor app'}</span>
            <h2>{st[0]}</h2>
            <p>{st[1]}</p>
            <div className="ph-info-now"><span>On screen</span><b>{stepLabel}</b></div>
            <button className="btn ghost" onClick={reset}>Start again from the beginning</button>
          </aside>
        </div>
      </main>
    </>
  );
}
