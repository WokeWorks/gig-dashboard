import { WORKERS, SITES, MANAGERS, ALERTS as OPS_ALERTS, LEAVE, ROSTER_GROUPS, DAYS, tplOf, tplLabel, endOf, vendorOf, siteOf } from './data.js';
import { Icon, useToast } from './ui.jsx';
import { clockInForm, formByKey, FormBody } from './forms.jsx';
import { CameraSheet } from './camera.jsx';
import { offDaysOf } from './lib/roster.js';
const offThisWeek = (id) => { const ds = offDaysOf(id); return ds === 'rot' || !ds.length ? 'None this week' : ds.map((k) => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][k]).join(', '); };

const { useState } = React;

/* ================================================================
   The phone app. One app on the store: who signs in decides what it
   becomes. A picker is handed a setup code; a supervisor gets one by
   email. Ported from the phone-apps prototype, wired to the same data
   as the dashboard.
   ================================================================ */

const SUP = MANAGERS[0]; // Omar Haddad: Marina Promenade, Marina Mall, Barsha Heights
const SUP_SITES = SUP.sites;
const ME = WORKERS[0]; // the picker signed in on this phone
const MY_SITE = siteOf(ME.site);
const short = (n) => n.replace(/^(Spinneys|Carrefour) /, '');
const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const ST = { 'Clocked in': 'in', 'On break': 'in', Late: 'late', 'No-show': 'missing', 'On leave': 'leave', 'Off today': 'off' };
const PILL = { in: 'Clocked in', late: 'Late', missing: 'No-show', leave: 'On leave', off: 'Day off' };
const todayShift = (w) => { const g = ROSTER_GROUPS.find((x) => x.people.includes(w.id)); const c = g && g.cells[g.people.indexOf(w.id)][2]; if (!Array.isArray(c)) return null; const [t, st] = c[0]; return `${st} – ${endOf(st, tplOf(t).base).time}`; };
const addMin = (hhmm, m) => { const [h, mm] = hhmm.split(':').map(Number); const t = ((h * 60 + mm + m) % 1440 + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const PEOPLE = WORKERS.filter((w) => SUP_SITES.includes(w.site)).map((w, i) => {
  const s0 = ST[w.status] || 'in'; const sh = todayShift(w);
  const s = sh ? s0 : s0 === 'leave' ? 'leave' : 'off';
  return { w, s, shift: sh || '—', inAt: s === 'in' && sh ? addMin(sh.slice(0, 5), -((i % 7) + 2)) : null };
});
const LOCS = SUP_SITES.map((id) => { const s = siteOf(id); const ps = PEOPLE.filter((p) => p.w.site === id); return { s, req: ps.filter((p) => p.s !== 'off' && p.s !== 'leave').length, in: ps.filter((p) => p.s === 'in').length, late: ps.filter((p) => p.s === 'late').length, missing: ps.filter((p) => p.s === 'missing').length, leave: ps.filter((p) => p.s === 'leave').length }; });
const totals = () => LOCS.reduce((a, l) => ({ in: a.in + l.in, req: a.req + l.req, late: a.late + l.late, missing: a.missing + l.missing, leave: a.leave + l.leave }), { in: 0, req: 0, late: 0, missing: 0, leave: 0 });

const W_ = (id) => WORKERS.find((w) => w.id === id);
const TONE = { 'No-show': 'red', 'Face mismatch': 'amber', Late: 'amber', 'Missing clock-out': 'amber', 'Document expiry': 'amber', 'Break overrun': 'amber', 'Outside geofence': 'amber' };
const ALERTS = [
  ...OPS_ALERTS.filter((a) => a.open).map((a) => ({ id: a.id, t: a.type === 'Face mismatch' ? 'Face did not match' : a.type, who: W_(a.worker).name, loc: siteOf(a.site).name, when: /^\d/.test(a.time) ? `${a.time} today` : a.time, go: ['Face mismatch', 'Document expiry'].includes(a.type) ? (a.type === 'Face mismatch' ? 'face' : 'docs') : 'people', tone: TONE[a.type] || 'amber' })),
  ...LEAVE.filter((l) => l.status === 'Pending').slice(0, 1).map((l) => ({ id: 'lv' + l.id, t: 'Leave request waiting', who: W_(l.worker).name, loc: siteOf(W_(l.worker).site).name, when: l.asked, go: 'leave', tone: 'teal' })),
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
const MY_WEEK = DAYS.map((d, i) => { const c = myRow[i]; if (!Array.isArray(c)) return [d, c === 'L' ? 'Leave' : 'Day off', '']; return [d, c.map(([t, st]) => `${st} – ${endOf(st, tplOf(t).base).time}`).join(', '), c.map((x) => short(siteOf(x[2] || ME.site).name)).join(', ')]; });
const myShift = Array.isArray(myRow[2]) ? myRow[2][0] : ['f5', '07:00'];
const MY_TODAY = `${myShift[1]} – ${endOf(myShift[1], tplOf(myShift[0]).base).time}`;
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

const P0 = { step: 'code', screen: 'home', code: '', phone: '', clockedIn: false, onBreak: false, leaveType: 'annual' };
const S0 = { step: 'email', screen: 'today', email: '', code: '', phone: '', filter: 'all', loc: 'all', person: null, from: null, cat: 'leave', item: 0, decision: null };

function Appbar({ title, back, right }) {
  return <div className="appbar">{back && <button className="iconBtn" onClick={back} aria-label="Back"><Icon name="arrowLeft" size={18} /></button>}<div className="t">{title}</div>{right}</div>;
}
const Pill = ({ s }) => <span className={'pill ' + s}>{PILL[s]}</span>;
const Meter = ({ a, b }) => <div className="meter">{Array.from({ length: Math.max(b, 1) }, (_, i) => <div key={i} className={'pip' + (i < a ? ' f' : '')} />)}</div>;
const dot = (tone) => (tone === 'red' ? 'var(--danger)' : tone === 'amber' ? 'var(--amber)' : 'var(--brand)');

export function PhoneApp() {
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

  /* ---------------- picker ---------------- */
  const startIn = () => { const f = clockInForm('Pickers'); if (f) { setAns({}); setForm({ f, then: 'in' }); } else setCam('in'); };
  const picker = () => {
    if (form) return <div className="fp-sheet op-form"><Appbar title="" back={() => setForm(null)} /><FormBody form={form.f} answers={ans} setAnswers={setAns} ctx={`${MY_SITE.name} · Today · ${myShift[1]} shift`} submitLabel={form.then === 'in' ? 'Submit and clock in' : 'Send report'} onSubmit={() => { const t = form.then; setForm(null); if (t === 'in') setCam('in'); else toast('Report sent · your supervisor has it'); }} /></div>;
    if (cam) return <CameraSheet out={cam === 'out'} onCancel={() => setCam(null)} onDone={() => { P({ clockedIn: cam === 'in', onBreak: false }); setCam(null); }} />;
    if (pk.step === 'code') { const ok = pk.code.length >= 4 && pk.phone.length >= 4; return (
      <div className="center">
        <div className="avatar xl">OP</div>
        <div><div className="big" style={{ fontSize: 22 }}>Set up this phone</div><div className="sub" style={{ marginTop: 8, maxWidth: 270 }}>Your supervisor gives you a setup code. It works once, on one phone.</div></div>
        <div className="op-fields"><div className="label">Setup code</div><input className="input" id="pcode" placeholder="8 characters" value={pk.code} onChange={(e) => P({ code: e.target.value })} />
          <div className="label" style={{ marginTop: 12 }}>Your mobile number</div><input className="input" id="pphone" placeholder="05X XXX XXXX" value={pk.phone} onChange={(e) => P({ phone: e.target.value })} /></div>
        <button className="btn" disabled={!ok} onClick={() => P({ step: 'biometric' })}>Set up</button>
        <div className="tiny lh">The code and the number must both match. A wrong one gives the same answer as a wrong code, so neither can be guessed on its own.</div>
      </div>); }
    if (pk.step === 'biometric') return (
      <div className="center">
        <div className="bio"><Icon name="finger" size={46} /></div>
        <div><div className="big" style={{ fontSize: 20 }}>Confirm it's you</div><div className="sub" style={{ marginTop: 8, maxWidth: 260 }}>OpsPro uses Face ID so nobody else can clock in as you.</div></div>
        <button className="btn" onClick={() => P({ step: 'done', screen: 'home' })}>Use Face ID</button>
        <div className="note">The phone itself is now the credential. Apple or Google vouches for the app on every punch, and the code you used is spent.</div>
      </div>);
    const sc = pk.screen;
    if (sc === 'home') { const f = clockInForm('Pickers'); return <>
      <Appbar title={`Hi ${ME.name.split(' ')[0]}`} right={<button className="iconBtn" onClick={() => P({ screen: 'profile' })} aria-label="Profile"><Icon name="person" size={18} /></button>} />
      <div className="card"><div className="row"><span className="ic"><Icon name="pin" size={18} /></span><div className="grow"><div className="name">{MY_SITE.name}</div><div className="sub">Today {MY_TODAY} · {tplLabel(tplOf(myShift[0]))}</div></div></div></div>
      {pk.clockedIn && <div className="card"><div className="row"><div className="grow"><div className="sub">Clocked in at</div><div className="big" style={{ fontSize: 24 }}>06:54</div></div><div style={{ textAlign: 'right' }}><div className="sub">{pk.onBreak ? 'On break' : 'Break left'}</div><div className="name">1h 00m</div></div></div></div>}
      <div className="op-clock">
        <button className={'clockBtn' + (pk.clockedIn ? ' out' : '')} onClick={() => (pk.clockedIn ? setCam('out') : startIn())}><Icon name="face" size={40} /><span>{pk.clockedIn ? 'Clock out' : 'Clock in'}</span></button>
        <div className="tiny" style={{ marginTop: 12 }}>{!pk.clockedIn && f ? `A quick ${f.name.toLowerCase()} first, then a photo of your face` : 'Tap, then take a photo of your face'}</div>
      </div>
      {pk.clockedIn && <div className="stack">
        <button className="btn ghost" onClick={() => { P({ onBreak: !pk.onBreak }); toast(pk.onBreak ? 'Break ended' : 'Break started'); }}>{pk.onBreak ? 'End break' : 'Start break'}</button>
        {formByKey('Incident report') && <button className="btn ghost" onClick={() => { setAns({}); setForm({ f: formByKey('Incident report'), then: 'report' }); }}>Report an incident</button>}
      </div>}
      {!pk.clockedIn && <><div className="h">Before you can clock in</div>
      <div className="card">{[['You are at the location', 'Yes'], ['Shift window open', 'Yes'], ['Documents valid', ME.docs ? 'Check' : 'Yes']].map(([k, v]) => <div key={k} className="kv"><span className="k">{k}</span><span className="v" style={{ color: v === 'Yes' ? 'var(--green)' : 'var(--amber)' }}>{v}</span></div>)}</div></>}
    </>; }
    if (sc === 'schedule') return <>
      <Appbar title="Schedule" />
      <div className="filters"><button className="fchip on">This week</button><button className="fchip" onClick={() => toast('Next week is still a draft')}>Next week</button></div>
      <div className="card">{MY_WEEK.map(([d, t, at]) => <div key={d} className="weekRow"><div><div className="name sm">{d}</div>{at && <div className="tiny">{at}</div>}</div><div className={t === 'Day off' || t === 'Leave' ? 'sub' : 'name sm'}>{t}</div></div>)}</div>
      <div className="h">Open shifts you can claim</div>
      <div className="card"><div className="row"><div className="grow"><div className="name">Fri 9 Oct · 14:00 – 01:00</div><div className="sub">{siteOf('s2').name} · your day off, paid as rest-day work</div></div><button className="btn sm" onClick={() => toast('Claim sent · your supervisor approves it')}>Claim</button></div><div className="tiny" style={{ marginTop: 9 }}>Your supervisor approves each claim.</div></div>
      <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => P({ screen: 'leaveform' })}>Request leave</button>
    </>;
    if (sc === 'notifications') return <>
      <Appbar title="Notifications" />
      <div className="filters"><button className="fchip on">Unread</button><button className="fchip">Read</button></div>
      <div className="card">{NOTES.map((n) => <div key={n.t} className="flag"><div className="flagDot" style={{ background: n.unread ? 'var(--brand)' : 'var(--line)' }} /><div className="grow"><div className="name sm">{n.t}</div><div className="sub">{n.b}</div><div className="tiny" style={{ marginTop: 3 }}>{n.when}</div></div></div>)}</div>
      <div className="tiny" style={{ marginTop: 12, textAlign: 'center' }}>Kept for 90 days, then removed.</div>
    </>;
    if (sc === 'profile') return <>
      <Appbar title="Profile" back={() => P({ screen: 'home' })} />
      <div className="card"><div className="row"><div className="avatar lg">{initials(ME.name)}</div><div className="grow"><div className="name" style={{ fontSize: 16 }}>{ME.name}</div><div className="sub">{ME.code} · {vendorOf(ME.vendor).name}</div></div></div>
        <div className="sep" />
        {[['Mobile', '05X XXX ' + ME.phone.slice(-4)], ['Usual shift', tplLabel(tplOf(myShift[0]))], ['Off this week', offThisWeek(ME.id)]].map(([k, v]) => <div key={k} className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>)}</div>
      <div className="h">Reference photo</div>
      <div className="card"><div className="row"><div className="avatar lg"><Icon name="face" size={24} /></div><div className="grow"><div className="name sm">In use</div><div className="sub">Every clock-in is checked against this.</div></div><button className="btn sm ghost" onClick={() => toast('Takes a new photo; your supervisor approves it first')}>Replace</button></div></div>
      <div className="h">More</div>
      <div className="card list">
        <button className="lrow" onClick={() => P({ screen: 'documents' })}><span className="ic"><Icon name="document" size={19} /></span><span className="grow"><span className="name sm">Documents</span><br /><span className="tiny">Passport, visa, Emirates ID</span></span><span className="chev">›</span></button>
        <button className="lrow" onClick={() => P({ screen: 'leave' })}><span className="ic"><Icon name="calendar" size={19} /></span><span className="grow"><span className="name sm">Leave</span><br /><span className="tiny">Request it, and see what you have asked for</span></span><span className="chev">›</span></button>
      </div>
      <button className="btn ghost danger" style={{ marginTop: 12 }} onClick={() => toast('Signed out of this phone')}>Sign out of this phone</button>
    </>;
    if (sc === 'leave') { const tone = { waiting: ['leave', 'Waiting'], approved: ['in', 'Approved'], rejected: ['missing', 'Rejected'] }; return <>
      <Appbar title="Leave" back={() => P({ screen: 'profile' })} />
      <button className="btn" onClick={() => P({ screen: 'leaveform' })}>Request leave</button>
      <div className="h">Your requests</div>
      <div className="card list">{MYLEAVE.map((l) => <div key={l.d} className="lrow static"><span className="grow"><span className="name sm">{l.t}</span><br /><span className="sub">{l.d}</span><br /><span className="tiny lh">{l.meta}</span></span><span className={'pill ' + tone[l.st][0]}>{tone[l.st][1]}</span></div>)}</div>
      <div className="tiny lh" style={{ marginTop: 12 }}>A request you have sent can be withdrawn until it is decided. After that it has to go back through the office, because the roster has already changed.</div>
    </>; }
    if (sc === 'leaveform') { const k = pk.leaveType; const sick = k === 'sick' || k === 'emergency'; return <>
      <Appbar title="Request leave" back={() => P({ screen: 'leave' })} />
      <div className="label">Type</div>
      <div className="filters" style={{ paddingTop: 7 }}>{[['annual', 'Annual'], ['sick', 'Sick'], ['emergency', 'Emergency'], ['unpaid', 'Unpaid']].map(([id, l]) => <button key={id} className={'fchip' + (k === id ? ' on' : '')} onClick={() => P({ leaveType: id })}>{l}</button>)}</div>
      <div className="note" style={{ marginBottom: 12 }}>{sick ? 'Sick and emergency cover today and yesterday. You are telling your supervisor, not asking in advance.' : 'Annual leave is from tomorrow onwards, so the roster can be planned around it.'}</div>
      <div className="label">From</div><input className="input" defaultValue={sick ? 'Wed 7 Oct (today)' : 'Mon 20 Oct'} key={'f' + sick} />
      <div className="label" style={{ marginTop: 12 }}>To</div><input className="input" defaultValue={sick ? 'Wed 7 Oct (today)' : 'Wed 22 Oct'} key={'t' + sick} />
      <div className="label" style={{ marginTop: 12 }}>Reason{sick ? '' : ' (optional)'}</div><input className="input" placeholder={sick ? 'What happened' : 'Anything your supervisor should know'} />
      <div className="h">What this affects</div>
      <div className="warnNote">You are rostered on {sick ? '1 shift today' : 'all 3 of those days'}. If this is approved {sick ? 'that shift' : 'those shifts'} comes off your roster and your supervisor is asked to find cover.</div>
      {sick && <div className="card" style={{ marginTop: 10 }}><div className="row"><span className="ic"><Icon name="document" size={19} /></span><div className="grow"><div className="name sm">Add a sick note</div><div className="tiny">Photo or file, optional</div></div><button className="btn sm ghost" onClick={() => toast('Camera opens')}>Add</button></div></div>}
      <button className="btn" style={{ marginTop: 14 }} onClick={() => { P({ screen: 'leave' }); toast('Leave request sent'); }}>Send request</button>
      <div className="tiny lh" style={{ marginTop: 10 }}>No days-remaining figure is shown here, because no yearly allowance is set for you. When one is, it appears above.</div>
    </>; }
    if (sc === 'documents') { const docs = [['Passport', 'Valid until 14 Mar 2029', 'ok'], ['UAE visa', 'Expires 19 Oct 2026', 'soon'], ['Emirates ID', 'Valid until 2 Jan 2028', 'ok'], ['Food handling certificate', 'Not uploaded', 'none']]; return <>
      <Appbar title="Your documents" back={() => P({ screen: 'profile' })} />
      <div className="card list">{docs.map(([n, d, t]) => <div key={n} className="lrow static"><span className="ic"><Icon name="document" size={19} /></span><span className="grow"><span className="name sm">{n}</span><br /><span className="tiny" style={{ color: t === 'soon' ? 'var(--amber)' : t === 'none' ? 'var(--danger)' : 'var(--muted)' }}>{d}</span></span>{t === 'none' ? <button className="btn sm" onClick={() => toast('Take a photo or pick a file')}>Upload</button> : <button className="btn sm ghost" onClick={() => P({ screen: 'docview' })}>View</button>}</div>)}</div>
      <div className="note" style={{ marginTop: 14 }}>Anything you send is checked by your supervisor before it replaces what is on file.</div>
    </>; }
    if (sc === 'docview') return <>
      <Appbar title="UAE visa" back={() => P({ screen: 'documents' })} />
      <div className="op-docview">Document shown here</div>
      <div className="tiny" style={{ marginTop: 12, textAlign: 'center' }}>Opens inside the app. Nothing is saved to your phone.</div>
    </>;
    return null;
  };

  /* ---------------- supervisor ---------------- */
  const sup = () => {
    if (sv.step === 'email') { const ok = sv.email.indexOf('@') > 0; return (
      <div className="center">
        <div className="avatar xl">OP</div>
        <div><div className="big" style={{ fontSize: 22 }}>Set up this phone</div><div className="sub" style={{ marginTop: 8, maxWidth: 270 }}>Enter your work email. We send a code to the address on your account.</div></div>
        <div className="op-fields"><div className="label">Work email</div><input className="input" id="semail" placeholder="you@company.com" value={sv.email} onChange={(e) => V({ email: e.target.value })} /></div>
        <button className="btn" disabled={!ok} onClick={() => V({ step: 'code' })}>Send me a code</button>
        <div className="tiny lh">The answer is the same whether or not the account exists, so this cannot be used to find out who works here.</div>
      </div>); }
    if (sv.step === 'code') { const ok = sv.code.length >= 4 && sv.phone.length >= 4; return (
      <div className="center">
        <div className="note" style={{ width: '100%' }}>A code is on its way to <b>{sv.email || 'your email'}</b>. It lasts 10 minutes and works once.</div>
        <div className="op-fields"><div className="label">Code from the email</div><input className="input" id="scode" placeholder="6 digits" value={sv.code} onChange={(e) => V({ code: e.target.value })} />
          <div className="label" style={{ marginTop: 12 }}>Your mobile number</div><input className="input" id="sphone" placeholder="05X XXX XXXX" value={sv.phone} onChange={(e) => V({ phone: e.target.value })} /></div>
        <button className="btn" disabled={!ok} onClick={() => V({ step: 'biometric' })}>Continue</button>
        <div className="tiny lh">Two things, not one. A code sitting in someone else's mailbox is not enough on its own.</div>
      </div>); }
    if (sv.step === 'biometric') return (
      <div className="center">
        <div className="bio"><Icon name="finger" size={46} /></div>
        <div><div className="big" style={{ fontSize: 20 }}>Confirm it's you</div><div className="sub" style={{ marginTop: 8, maxWidth: 260 }}>And again each time you act on someone else: clocking them in, approving leave.</div></div>
        <button className="btn" onClick={() => V({ step: 'done', screen: 'today' })}>Use Face ID</button>
        <div className="note">You can have this on two phones. Adding one emails you straight away, so a device you did not add is obvious.</div>
      </div>);
    const sc = sv.screen; const t = totals();
    const alertRow = (a) => <button key={a.id} className="flag" onClick={() => (a.go === 'people' ? V({ filter: 'missing', loc: 'all', from: null, screen: 'people' }) : V({ cat: a.go, screen: 'apprlist' }))}><div className="flagDot" style={{ background: dot(a.tone) }} /><div className="grow"><div className="name sm">{a.t}</div><div className="sub">{a.who} · {a.loc}</div><div className="tiny" style={{ marginTop: 3 }}>{a.when}</div></div><span className="chev">›</span></button>;
    if (sc === 'today') return <>
      <Appbar title="Today" right={<button className="iconBtn" onClick={() => V({ screen: 'profile' })} aria-label="Profile"><Icon name="person" size={18} /></button>} />
      <div className="sub" style={{ margin: '-8px 0 14px' }}>Wednesday 7 October · your {SUP_SITES.length} locations</div>
      <div className="metrics">
        <button className="metric" onClick={() => V({ filter: 'in', screen: 'people', from: null })}><div className="v">{t.in}/{t.req}</div><div className="k">Clocked in</div></button>
        <button className="metric warn" onClick={() => V({ filter: 'late', screen: 'people', from: null })}><div className="v">{t.late}</div><div className="k">Late</div></button>
        <button className="metric bad" onClick={() => V({ filter: 'missing', screen: 'people', from: null })}><div className="v">{t.missing}</div><div className="k">Missing</div></button>
        <button className="metric" onClick={() => V({ filter: 'leave', screen: 'people', from: null })}><div className="v">{t.leave}</div><div className="k">On leave</div></button>
      </div>
      <div className="tiny lh" style={{ marginTop: 9 }}>Late is past the start time plus grace. Missing is past 60 minutes, the same line the roster calls a no-show. Leave is approved leave only; a weekly off is not counted.</div>
      <div className="h hrow">Needs you<button className="btn sm ghost" onClick={() => V({ screen: 'alerts' })}>See all {ALERTS.length}</button></div>
      <div className="card list">{ALERTS.slice(0, 5).map(alertRow)}</div>
      <div className="tiny lh" style={{ marginTop: 10 }}>Oldest still unresolved first, not newest. A face flag nobody has looked at for two days matters more than a late clock-in that has already sorted itself out.</div>
    </>;
    if (sc === 'alerts') return <>
      <Appbar title="Alerts" back={() => V({ screen: 'today' })} />
      <div className="filters">{['All', 'No-show', 'Face', 'Documents', 'Leave'].map((f, i) => <button key={f} className={'fchip' + (i ? '' : ' on')}>{f}</button>)}</div>
      <div className="card list">{ALERTS.map(alertRow)}</div>
    </>;
    if (sc === 'locations') return <>
      <Appbar title="Locations" />
      <div className="sub" style={{ margin: '-8px 0 14px' }}>The {LOCS.length} you look after</div>
      {LOCS.map((l) => { const shortBy = l.req - l.in; return (
        <button key={l.s.id} className="card tap" onClick={() => V({ loc: l.s.id, filter: 'all', screen: 'people', from: 'locations' })}>
          <div className="row"><div className="grow"><div className="name">{l.s.name}</div><div className="sub">{l.s.hours}</div></div>{shortBy > 0 ? <span className={'pill ' + (l.missing ? 'missing' : 'late')}>{shortBy} short</span> : <span className="pill in">Full</span>}</div>
          <div className="row" style={{ marginTop: 12 }}><Meter a={l.in} b={l.req} /><span className="sub" style={{ fontWeight: 600 }}>{l.in}/{l.req} clocked in</span></div>
          <div className="row" style={{ marginTop: 9, gap: 6 }}>{l.late > 0 && <span className="pill late">{l.late} late</span>}{l.missing > 0 && <span className="pill missing">{l.missing} missing</span>}{l.leave > 0 && <span className="pill leave">{l.leave} on leave</span>}</div>
        </button>); })}
    </>;
    if (sc === 'people') { const list = PEOPLE.filter((p) => (sv.filter === 'all' || p.s === sv.filter) && (sv.loc === 'all' || p.w.site === sv.loc)); return <>
      <Appbar title="People" back={sv.from === 'locations' ? () => V({ screen: 'locations' }) : null} />
      <div className="filters">{[['all', 'Everyone'], ['in', 'Clocked in'], ['late', 'Late'], ['missing', 'Missing'], ['leave', 'On leave']].map(([id, l]) => <button key={id} className={'fchip' + (sv.filter === id ? ' on' : '')} onClick={() => V({ filter: id })}>{l}</button>)}</div>
      <div className="filters" style={{ paddingTop: 0 }}>{[['all', 'All locations'], ...SUP_SITES.map((id) => [id, short(siteOf(id).name)])].map(([id, l]) => <button key={id} className={'fchip' + (sv.loc === id ? ' on' : '')} onClick={() => V({ loc: id })}>{l}</button>)}</div>
      <div className="sub" style={{ marginBottom: 8 }}>{list.length} {list.length === 1 ? 'person' : 'people'}</div>
      {list.length === 0 ? <div className="card empty">Nobody matches these filters.</div> :
        <div className="card list">{list.map((p) => <button key={p.w.id} className="lrow" onClick={() => V({ person: p.w.id, screen: 'person' })}><span className="avatar">{initials(p.w.name)}</span><span className="grow"><span className="name sm">{p.w.name}</span><br /><span className="tiny">{short(siteOf(p.w.site).name)} · {p.shift}</span></span><Pill s={p.s} /></button>)}</div>}
    </>; }
    if (sc === 'person') { const p = PEOPLE.find((x) => x.w.id === sv.person) || PEOPLE[0]; return <>
      <Appbar title="" back={() => V({ screen: 'people' })} />
      <div className="card"><div className="row"><div className="avatar lg">{initials(p.w.name)}</div><div className="grow"><div className="name" style={{ fontSize: 16 }}>{p.w.name}</div><div className="sub">{p.w.code} · {vendorOf(p.w.vendor).name}</div></div><Pill s={p.s} /></div></div>
      <div className="h">Today</div>
      <div className="card">{[['Location', siteOf(p.w.site).name], ['Rostered', p.shift], ['Clocked in', p.inAt || '—'], ['Clocked out', '—'], ['Designation', p.w.role]].map(([k, v]) => <div key={k} className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>)}</div>
      {(p.s === 'missing' || p.s === 'late') && <div className="warnNote" style={{ marginTop: 12 }}>{p.s === 'missing' ? 'Past 60 minutes with no clock-in. This already counts as a no-show.' : 'Past their start time and not in yet.'}</div>}
      <div className="h">Do something</div>
      <div className="stack">
        {p.s !== 'in' ? <button className="btn" onClick={() => toast(`Fingerprint confirmed · ${p.w.name.split(' ')[0]} marked in, recorded as done by you`)}>Clock them in now</button> : <button className="btn ghost" onClick={() => toast('Fingerprint confirmed · clocked out')}>Clock them out</button>}
        <button className="btn ghost" onClick={() => toast(`${p.w.name.split(' ')[0]} marked absent`)}>Mark absent</button>
        <button className="btn ghost" onClick={() => V({ screen: 'activity' })}>View activity</button>
      </div>
      <div className="tiny lh" style={{ marginTop: 10 }}>Anything here asks for your fingerprint first, and records that you did it: not just your account, but which of your phones.</div>
    </>; }
    if (sc === 'activity') { const p = PEOPLE.find((x) => x.w.id === sv.person) || PEOPLE[0]; return <>
      <Appbar title="Activity" back={() => V({ screen: 'person' })} />
      <div className="sub" style={{ margin: '-8px 0 14px' }}>{p.w.name} · {p.w.code}</div>
      {ACTIVITY.map((wk) => <React.Fragment key={wk.w}><div className="h">{wk.w}</div><div className="card">{wk.rows.map((r) => <div key={r[0]} className="actrow"><div className="row"><span className="grow name sm">{r[0]}</span><span className="name sm">{r[3]}</span></div><div className="tiny" style={{ marginTop: 3 }}>Rostered {r[1]} · actual {r[2]}</div></div>)}</div></React.Fragment>)}
      <div className="tiny" style={{ marginTop: 12, textAlign: 'center' }}>Every week they have worked, newest first.</div>
    </>; }
    if (sc === 'approvals') return <>
      <Appbar title="Approvals" />
      <div className="sub" style={{ margin: '-8px 0 14px' }}>{apprCount()} waiting on you</div>
      {APPR_ORDER.map((k) => <button key={k} className="card tap" onClick={() => V({ cat: k, screen: 'apprlist' })}><div className="row"><span className="avatar"><Icon name={APPR[k].icon} size={19} /></span><span className="grow"><span className="name">{APPR[k].label}</span><br /><span className="sub">{APPR[k].items.length} waiting</span></span><span className="chev">›</span></div></button>)}
      <div className="tiny lh" style={{ marginTop: 14 }}>Grouped by what you are deciding, because the three need different things from you. Leave needs the roster. A document needs reading. A face flag needs two photos side by side.</div>
    </>;
    if (sc === 'apprlist') { const g = APPR[sv.cat]; return <>
      <Appbar title={g.label} back={() => V({ screen: 'approvals' })} />
      <div className="sub" style={{ margin: '-8px 0 14px' }}>{g.items.length} waiting</div>
      <div className="card list">{g.items.map((it, i) => <button key={it.who + i} className="lrow" onClick={() => V({ item: i, decision: null, screen: 'appritem' })}><span className="avatar">{initials(it.who)}</span><span className="grow"><span className="name sm">{it.who}</span><br /><span className="tiny">{it.sub}</span></span><span className="chev">›</span></button>)}</div>
    </>; }
    if (sc === 'appritem') { const g = APPR[sv.cat]; const it = g.items[sv.item] || g.items[0]; if (!it) return null; return <>
      <Appbar title="" back={() => V({ screen: 'apprlist', decision: null })} />
      <div className="card"><div className="row"><div className="avatar lg">{initials(it.who)}</div><div className="grow"><div className="name" style={{ fontSize: 16 }}>{it.who}</div><div className="sub">{it.sub}</div></div></div></div>
      <div className="h">What you are approving</div>
      {it.face && <div className="row" style={{ gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>{[['Punch selfie', 'Taken at the punch'], ['Reference photo', 'On file since 12 Aug']].map(([a, b]) => <div key={a} style={{ flex: 1, textAlign: 'center' }}><div className="op-ph">{a}</div><div className="tiny" style={{ marginTop: 6 }}>{b}</div></div>)}</div>}
      {it.doc && <div className="op-ph doc">Document shown here</div>}
      <div className="card">{it.rows.map(([k, v]) => <div key={k} className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>)}
        {it.note && <><div className="sep" /><div className="row"><span className="ic"><Icon name="document" size={18} /></span><span className="grow name sm">{it.note}</span><button className="btn sm ghost">Open</button></div></>}</div>
      <div className="warnNote" style={{ marginTop: 11 }}>{it.warn}</div>
      <div className="h">Your decision</div>
      <div className="filters" style={{ paddingTop: 0 }}>{[['approve', 'Approve'], ['reject', 'Reject']].map(([d, l]) => <button key={d} className={'fchip' + (sv.decision === d ? ' on' : '')} onClick={() => V({ decision: d })}>{l}</button>)}</div>
      <div className="label">Reason{sv.decision === 'reject' ? '' : ' (optional)'}</div>
      <input className="input" placeholder={sv.decision === 'reject' ? 'They are told exactly this, so say what to do next' : 'Anything worth recording'} />
      <button className="btn" style={{ marginTop: 14 }} disabled={!sv.decision} onClick={() => { toast(`Fingerprint confirmed · ${sv.decision === 'approve' ? 'approved' : 'rejected'}, ${it.who.split(' ')[0]} is told`); V({ screen: 'apprlist', decision: null }); }}>{sv.decision === 'reject' ? 'Reject' : sv.decision === 'approve' ? 'Approve' : 'Choose approve or reject'}</button>
      <div className="tiny lh" style={{ marginTop: 10 }}>A rejection has to say why: the words go straight to them, and "not approved" with no reason just means they send the same thing again. Your fingerprint is asked for before this is saved.</div>
    </>; }
    if (sc === 'profile') return <>
      <Appbar title="Profile" back={() => V({ screen: 'today' })} />
      <div className="card"><div className="row"><div className="avatar lg">{initials(SUP.name)}</div><div className="grow"><div className="name" style={{ fontSize: 16 }}>{SUP.name}</div><div className="sub">Supervisor · Manager access</div></div></div>
        <div className="sep" />{[['Email', 'omar@company.com'], ['Locations', String(SUP_SITES.length)]].map(([k, v]) => <div key={k} className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>)}</div>
      <div className="h">Your phones</div>
      <div className="card list">
        <div className="lrow static"><span className="grow"><span className="name sm">iPhone 15 · this phone</span><br /><span className="tiny">Added 3 Oct · in use now · last at {short(siteOf('s3').name)}</span></span></div>
        <div className="lrow static"><span className="grow"><span className="name sm">Galaxy Tab</span><br /><span className="tiny">Added 28 Sep · 2 days ago · last at {short(siteOf('s1').name)}</span></span><button className="btn sm ghost danger" onClick={() => toast('Removed · that tablet is signed out')}>Remove</button></div>
      </div>
      <div className="tiny lh" style={{ marginTop: 10 }}>Two phones at most. Where each one last acted comes from the GPS on a real punch, not an IP address, which on mobile data points at the carrier rather than at you.</div>
      <button className="btn ghost danger" style={{ marginTop: 14 }} onClick={() => toast('Signed out of this phone')}>Sign out of this phone</button>
    </>;
    return null;
  };

  const chooser = () => (
    <div className="center">
      <div className="logo xl">OP</div>
      <div><div className="big" style={{ fontSize: 23 }}>OpsPro</div><div className="sub" style={{ marginTop: 8, maxWidth: 265 }}>One app. Who signs in decides what it becomes.</div></div>
      <div className="stack" style={{ width: '100%', marginTop: 4 }}>
        <button className="btn choose" onClick={() => { setView('picker'); P({ step: 'code' }); }}><Icon name="person" size={22} /><span><b>I work shifts</b><small>Clock in and out, my schedule</small></span></button>
        <button className="btn ghost choose" onClick={() => { setView('sup'); V({ step: 'email' }); }}><Icon name="users" size={22} /><span><b>I run locations</b><small>Who is in, cover, approvals</small></span></button>
      </div>
      <div className="tiny lh" style={{ maxWidth: 272 }}>Asked once, at setup only. The two sign in differently (a picker is handed a code, a supervisor gets one by email), so the app has to know which before it can ask for anything.</div>
    </div>
  );

  const isP = view === 'picker';
  const inApp = (isP && pk.step === 'done' && !cam && !form) || (view === 'sup' && sv.step === 'done');
  const tabs = isP ? [['home', 'home'], ['schedule', 'calendar'], ['notifications', 'bell']] : [['today', 'grid'], ['locations', 'pin'], ['people', 'users'], ['approvals', 'check']];
  const cur = isP ? pk.screen : sv.screen;
  const parent = { docview: 'home', documents: 'home', profile: 'home', leave: 'home', leaveform: 'home', person: 'people', activity: 'people', alerts: 'today', apprlist: 'approvals', appritem: 'approvals' }[cur] || cur;
  const ti = Math.max(0, tabs.findIndex((t) => t[0] === parent));
  const st = STAGE[view];
  const curStep = (k) => (view !== k ? '' : k === 'picker' ? (pk.step !== 'done' ? pk.step : pk.screen) : (sv.step !== 'done' ? sv.step : sv.screen));

  return (
    <>
      <aside className="side op-flows" aria-label="Screens">
        <div className="side-label">Phone app</div>
        <button className={'op-start' + (view === 'chooser' ? ' on' : '')} onClick={() => setView('chooser')}>Start: picker or supervisor</button>
        {[['picker', 'Picker app'], ['sup', 'Supervisor app']].map(([k, label]) => (
          <div key={k} className={'op-flow ' + k}>
            <button className={'op-apphead' + (view === k ? ' on' : '')} onClick={() => jump(k, k === 'picker' ? (pk.step === 'done' ? pk.screen : pk.step) : (sv.step === 'done' ? sv.screen : sv.step))}><span className="dot" />{label}</button>
            {view === k && FLOWS[k].map(([g, items]) => <div key={g}><div className="op-navhead">{g}</div>{items.map(([id, l]) => <button key={id} className={'op-navitem' + (curStep(k) === id ? ' on' : '')} onClick={() => jump(k, id)}>{l}</button>)}</div>)}
          </div>
        ))}
      </aside>
      <main className="main">
      <div className="op-stage">
      <div className="op">
        <div className="op-phone">
          <div className="op-screen">
            <div className="op-notch" />
            <div className="op-status"><span>9:41</span><span>●●●● ▯</span></div>
            <div className={'op-body' + (cam ? ' flush' : '')}>{view === 'chooser' ? chooser() : isP ? picker() : sup()}</div>
            {inApp && <div className="bnav" style={{ '--n': tabs.length }}>
              <div className="bubble" style={{ width: `calc(${100 / tabs.length}% - 26px)`, left: `calc(${ti * (100 / tabs.length)}% + 13px)` }} />
              {tabs.map(([id, ic], n) => <button key={id} className={'tab' + (n === ti ? ' on' : '')} onClick={() => (isP ? P({ screen: id }) : V({ screen: id, ...(id === 'people' ? { from: null } : {}) }))} aria-label={id}><Icon name={ic} size={22} />{id === 'notifications' && <span className="badge">2</span>}{id === 'approvals' && <span className="badge">{apprCount()}</span>}</button>)}
            </div>}
          </div>
        </div>
      </div>
      <aside className="op-info">
        <div className="op-title">{st[0]}</div>
        <div className="op-sub">{st[1]}</div>
        <button className="op-reset" onClick={reset}>Start again from the beginning</button>
      </aside>
      </div>
      </main>
    </>
  );
}
