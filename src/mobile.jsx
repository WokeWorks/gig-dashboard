import { clockInForm, formByKey, FormBody } from './forms.jsx';
import { WORKERS, vendorOf } from './data.js';
import { Phase, Spec, Icon, useToast } from './ui.jsx';

const { useState, useEffect } = React;

/* ---------- shared phone chrome (picker-app design) ---------- */
function Phone({ children, nav, title }) {
  return (
    <div className="phone pk" aria-label={title}>
      <div className="pk-status"><span>9:41</span><span className="pk-notch" /><span>5G</span></div>
      <div className="pk-screen">{children}</div>
      {nav}
    </div>
  );
}

function BottomNav({ tabs, active, onChange }) {
  const i = Math.max(0, tabs.findIndex((t) => t.id === active));
  const onTab = tabs.some((t) => t.id === active);
  if (!onTab) return null;
  return (
    <nav className="pk-nav" style={{ '--n': tabs.length, '--i': i }}>
      <span className="pk-bubble" aria-hidden="true" />
      {tabs.map((t) => (
        <button key={t.id} className={active === t.id ? 'on' : ''} onClick={() => onChange(t.id)} aria-label={t.label} aria-selected={active === t.id} role="tab">
          <span className="pk-navicon"><Icon name={t.icon} size={22} stroke={active === t.id ? 2.3 : 2} />{t.badge > 0 && <span className="pk-badge">{t.badge}</span>}</span>
        </button>
      ))}
    </nav>
  );
}

const Brand = ({ product }) => <div className="pk-brand"><b>OpsPro</b><span>{product}</span></div>;
const RoundBtn = ({ icon, label, onClick }) => <button className="pk-round" onClick={onClick} aria-label={label}><Icon name={icon} size={20} /></button>;
const Title = ({ children, onBack }) => <div className="pk-titlerow">{onBack && <RoundBtn icon="arrowLeft" label="Back" onClick={onBack} />}<h2 className="pk-title">{children}</h2></div>;

function StoreCard({ label, chain, area, start, end, extra, maps = true }) {
  const toast = useToast();
  return (
    <div className="pk-card">
      <div className="pk-store">
        <div className="pk-store-copy">{label && <span className="pk-label">{label}</span>}<b className="pk-chain">{chain}</b><span className="pk-area">{area}</span></div>
        <div className="pk-times"><b>{start}</b><span>to</span><b>{end}</b></div>
      </div>
      {extra && <div className="pk-extra"><Icon name="clock" size={15} /> {extra}</div>}
      {maps && <button className="pk-mapcta" onClick={() => toast('Opens directions in Google Maps or Apple Maps')}><Icon name="pin" size={18} /> Open in Maps</button>}
    </div>
  );
}

function Annot({ items, children }) {
  return (
    <aside className="annot">
      {children}
      {items.map(([title, p, s, text]) => (
        <div key={title} className="annot-item">
          <div className="screen-tags"><Phase p={p} /><Spec s={s} /></div>
          <b>{title}</b>
          <p className="small">{text}</p>
        </div>
      ))}
    </aside>
  );
}

/* ---------- worker: home ---------- */
export function CameraSheet({ out, onDone, onCancel }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= 3) return;
    const t = setTimeout(() => setStep(step + 1), step === 1 ? 1700 : 1100);
    return () => clearTimeout(t);
  }, [step]);
  useEffect(() => { if (step === 3) { const t = setTimeout(onDone, 700); return () => clearTimeout(t); } }, [step]);
  const msg = ['Checking you are at the location', 'Blink to show it\'s really you', 'Saving', out ? 'Clocked out' : 'Clocked in'][step];
  return (
    <div className="pk-camera">
      <div className="pk-cam-top"><button className="pk-cam-x" onClick={onCancel}>Cancel</button></div>
      <div className={'pk-oval' + (step === 3 ? ' ok' : '')}>{step === 3 && <Icon name="check" size={56} stroke={2.6} />}</div>
      <div className="pk-cam-msg">{msg}</div>
      <div className="pk-cam-steps">
        <span className={step > 0 ? 'done' : 'now'}><Icon name="pin" size={15} /> 42 m from site, inside 120 m</span>
        <span className={step > 1 ? 'done' : step === 1 ? 'now' : ''}><Icon name="face" size={15} /> Live face, match 0.91</span>
      </div>
    </div>
  );
}

function ShiftPanel({ brk, used }) {
  if (brk) return (
    <div className="pk-panel brk">
      <div className="pk-panel-label"><span className="pk-live" /> On break</div>
      <div className="pk-big">{60 - used - 6}m <small>break time left</small></div>
      <div className="pk-meta">This break 6 min · {used ? `${used} min used earlier` : 'first break today'}</div>
      <div className="pk-track"><span style={{ width: ((used + 6) / 60) * 100 + '%' }} /></div>
    </div>
  );
  return (
    <div className="pk-panel">
      <div className="pk-panel-label"><span className="pk-live" /> On shift</div>
      <div className="pk-big">5h 12m</div>
      <div className="pk-meta">Clocked in 6:58 AM · Ends 6 PM · +1 h optional</div>
      <div className="pk-track"><span style={{ width: '44%' }} /></div>
      <div className="pk-meta brkleft">Break time left today: {60 - used} min</div>
    </div>
  );
}

function WorkerHome({ state, setState, openMe }) {
  const [cam, setCam] = useState(null);
  const [used, setUsed] = useState(0);
  const [form, setForm] = useState(null); // { f, then }
  const [ans, setAns] = useState({});
  const toast = useToast();
  const startIn = () => { const f = clockInForm('Pickers'); if (f) { setAns({}); setForm({ f, then: 'in' }); } else setCam('in'); };
  if (form) return (
    <div className="pk-page fp-sheet">
      <div className="pk-header"><button className="pk-cam-x dark" onClick={() => setForm(null)}><Icon name="arrowLeft" size={18} /> Back</button></div>
      <FormBody form={form.f} answers={ans} setAnswers={setAns} ctx="Carrefour Barsha Heights · Today · 07:00 shift" submitLabel={form.then === 'in' ? 'Submit and clock in' : 'Send report'} onSubmit={() => { const then = form.then; setForm(null); if (then === 'in') setCam('in'); else toast('Report sent · your manager has it'); }} />
    </div>
  );
  if (cam) return <CameraSheet out={cam === 'out'} onCancel={() => setCam(null)} onDone={() => { setState(cam === 'out' ? 'done' : 'on'); setCam(null); }} />;
  return (
    <div className="pk-page">
      <div className="pk-header"><Brand product="Worker" /><RoundBtn icon="person" label="Your details" onClick={openMe} /></div>
      <h1 className="pk-hello">Hi Arjun!</h1>
      {state === 'before' && <StoreCard label="Today's location" chain="Carrefour" area="Barsha Heights" start="7 AM" end="6 PM" extra="+1 h optional overtime" />}
      {(state === 'on' || state === 'break') && <ShiftPanel brk={state === 'break'} used={used} />}
      {state === 'done' && <>
        <div className="pk-done"><span className="pk-done-badge"><Icon name="check" size={30} stroke={2.6} /></span><div><span className="pk-done-label">Shift done</span><div className="pk-big ink">12h 2m</div><div className="pk-meta ink">6:58 AM – 7:00 PM · includes 1h overtime</div></div></div>
        <StoreCard label="Next shift · Thursday" chain="Carrefour" area="Barsha Heights" start="7 AM" end="6 PM" extra="+1 h optional overtime" />
      </>}
      {state !== 'done' && <div className="pk-action">
        {state === 'before' && <><button className="pk-punch" onClick={startIn}><Icon name="face" size={40} stroke={2} /><span>Clock in</span></button><p className="pk-hint">{clockInForm('Pickers') ? `A quick ${clockInForm('Pickers').name.toLowerCase()} first, then a photo of your face` : 'Tap, then take a photo of your face'}</p></>}
        {state === 'on' && <>
          <button className="pk-punch out" onClick={() => setCam('out')}><Icon name="face" size={40} stroke={2} /><span>Clock out</span></button>
          <button className="pk-breakbtn" onClick={() => { setState('break'); toast('Break started'); }}><Icon name="tea" size={18} /> {used ? 'Take another break' : 'Start break'}</button>
          {formByKey('Incident report') && <button className="pk-breakbtn ghost" onClick={() => { setAns({}); setForm({ f: formByKey('Incident report'), then: 'report' }); }}><Icon name="flag" size={18} /> Report an incident</button>}
        </>}
        {state === 'break' && <button className="pk-punch brk" onClick={() => { const nu = Math.min(54, used + 6); setUsed(nu); setState('on'); toast(`Break ended · ${60 - nu} min of break time left`); }}><Icon name="tea" size={40} stroke={2} /><span>End break</span></button>}
      </div>}
    </div>
  );
}

/* ---------- worker: schedule ---------- */
function WorkerSchedule() {
  const [wk, setWk] = useState('this');
  const [acked, setAcked] = useState(false);
  const toast = useToast();
  const days = wk === 'this' ? [
    { d: 'Mon', n: 5, t: '7 AM – 6 PM', s: 'Barsha Heights · 11+1 hr', st: 'done', note: 'Worked 11h 58m · 1h overtime', past: true },
    { d: 'Tue', n: 6, t: '7 AM – 6 PM', s: 'Barsha Heights · 11+1 hr', st: 'missed', note: 'No clock-in recorded', past: true },
    { d: 'Wed', n: 7, t: '7 AM – 6 PM', s: 'Barsha Heights · 11+1 hr', today: true, st: 'live', note: 'On shift now' },
    { d: 'Thu', n: 8, t: '7 AM – 3 PM', s: 'Barsha Heights · 8 h', map: true },
    { d: 'Fri', n: 9, quiet: 'Day off' },
    { d: 'Sat', n: 10, t: '2 PM – 12 AM', s: 'Marina Mall · 10+1 hr', map: true, isNew: !acked },
    { d: 'Sun', n: 11, multi: [['7 AM – 11 AM', 'Barsha Heights · 4 h'], ['6 PM – 10 PM', 'Marina Mall · 4 h']], map: true },
  ] : [
    { d: 'Mon', n: 12, t: '7 AM – 6 PM', s: 'Barsha Heights · 11+1 hr', map: true },
    { d: 'Tue', n: 13, quiet: 'Annual leave' },
    { d: 'Wed', n: 14, quiet: 'Annual leave' },
    { d: 'Thu', n: 15, t: '7 AM – 6 PM', s: 'Barsha Heights · 11+1 hr', map: true },
    { d: 'Fri', n: 16, quiet: 'Covered by another worker' },
    { d: 'Sat', n: 17, t: '7 AM – 6 PM', s: 'Barsha Heights · 11+1 hr', map: true },
    { d: 'Sun', n: 18, quiet: 'Day off' },
  ];
  return (
    <div className="pk-page">
      <Title>Schedule</Title>
      <div className="pk-seg"><button className={wk === 'this' ? 'on' : ''} onClick={() => setWk('this')}>This week</button><button className={wk === 'next' ? 'on' : ''} onClick={() => setWk('next')}>Next week</button></div>
      <div className="pk-range">{wk === 'this' ? '5 October – 11 October' : '12 October – 18 October'}</div>
      <div className="pk-summary">
        <div><b>{wk === 'this' ? 6 : 3}</b><span>shifts</span></div>
        <div><b>{wk === 'this' ? '61h' : '33h'}</b><span>rostered</span></div>
        <div><b className="brand">{wk === 'this' ? '17h 10m' : '0h'}</b><span>worked so far</span></div>
      </div>
      <div className="pk-days">
        {days.map((x) => (
          <div key={x.n} className={'pk-day' + (x.today ? ' today' : '') + (x.quiet ? ' quiet' : '') + (x.isNew ? ' new' : '')}>
            <div className="pk-date">{x.today ? <span className="pk-todaypill">Today</span> : <span className="pk-wd">{x.d}</span>}<b className={x.past ? 'past' : ''}>{x.n}</b></div>
            <div className="pk-daybody">
              {x.quiet ? <span className="pk-quiet">{x.quiet}</span> : x.multi ? <>{x.multi.map(([t, st]) => <div key={t} className="pk-multi"><b className="pk-time">{t}</b><span className="pk-daystore">{st}</span></div>)}<span className="pk-status ok">2 shifts · clock in and out for each</span></> : <>
                <b className={'pk-time' + (x.past ? ' past' : '')}>{x.t}</b>
                <span className="pk-daystore">{x.s}</span>
                {x.st === 'done' && <span className="pk-status ok"><Icon name="checkCircle" size={16} /> {x.note}</span>}
                {x.st === 'missed' && <span className="pk-status warn"><Icon name="alert" size={16} /> {x.note}</span>}
                {x.st === 'live' && <span className="pk-status ok"><span className="pk-livedot" /> {x.note}</span>}
                {x.isNew && <button className="pk-ack" onClick={() => { setAcked(true); toast('Shift acknowledged'); }}>New shift · Tap to acknowledge</button>}
              </>}
            </div>
            {x.map && <button className="pk-mapbtn" aria-label="Open in Maps" onClick={() => toast('Opens directions')}><Icon name="pin" size={20} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- worker: requests ---------- */
function WorkerRequests() {
  const [tab, setTab] = useState('leave');
  const [sheet, setSheet] = useState(false);
  const toast = useToast();
  return (
    <div className="pk-page">
      <Title>Requests</Title>
      <div className="pk-pills">
        {[['leave', 'Leave'], ['open', 'Open shifts', 2], ['swap', 'Swaps']].map(([id, l, c]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{l}{c && <span className="pk-count">{c}</span>}</button>)}
      </div>
      {tab === 'leave' && <>
        <button className="pk-bigaction warn" onClick={() => toast('Sick leave sent. Your Wednesday shift is released for cover.')}><Icon name="alert" size={22} /><div><b>I'm sick today</b><span>Tells your supervisor before your shift starts</span></div></button>
        <button className="pk-bigaction" onClick={() => setSheet(true)}><Icon name="calendar" size={22} /><div><b>Request leave</b><span>Annual, emergency or unpaid</span></div></button>
        <div className="pk-section">Your requests</div>
        <div className="pk-reqrow"><div><b>Annual leave</b><span>Tue 13 – Wed 14 Oct</span></div><span className="pk-tag ok">Approved</span></div>
        <div className="pk-reqrow"><div><b>Unpaid leave</b><span>Mon 28 Sep</span></div><span className="pk-tag ok">Approved</span></div>
      </>}
      {tab === 'open' && <>
        <p className="pk-note">Shifts you can pick up. Your supervisor approves each claim.</p>
        {[['Friday 9', '7 AM', '6 PM', 'Barsha Heights'], ['Sunday 11', '2 PM', '12 AM', 'Majan']].map(([d, s, e, a]) => (
          <div key={d} className="pk-card"><div className="pk-store"><div className="pk-store-copy"><span className="pk-label">{d}</span><b className="pk-chain">{a === 'Majan' ? 'Spinneys' : 'Carrefour'}</b><span className="pk-area">{a}</span></div><div className="pk-times"><b>{s}</b><span>to</span><b>{e}</b></div></div>
            <button className="pk-mapcta" onClick={() => toast('Claim sent for approval')}><Icon name="plus" size={18} /> Claim this shift</button></div>
        ))}
      </>}
      {tab === 'swap' && <>
        <p className="pk-note">Offer one of your shifts to a colleague with the same role. The swap needs supervisor approval.</p>
        <div className="pk-card"><div className="pk-store"><div className="pk-store-copy"><span className="pk-label">Saturday 10</span><b className="pk-chain">Carrefour</b><span className="pk-area">Marina Mall</span></div><div className="pk-times"><b>2 PM</b><span>to</span><b>12 AM</b></div></div>
          <button className="pk-mapcta" onClick={() => toast('Offered to 6 colleagues who can work it')}><Icon name="swap" size={18} /> Offer this shift</button></div>
      </>}
      {sheet && <div className="pk-sheetwrap" onClick={() => setSheet(false)}><form className="pk-sheet" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); setSheet(false); toast('Leave request sent'); }}>
        <span className="pk-grab" />
        <h3>Request leave</h3>
        <div className="pk-pills small">{['Annual', 'Emergency', 'Unpaid'].map((t, i) => <button type="button" key={t} className={i === 0 ? 'on' : ''}>{t}</button>)}</div>
        <label className="pk-field"><span>From</span><input id="pk-from" type="date" defaultValue="2026-10-20" /></label>
        <label className="pk-field"><span>To</span><input id="pk-to" type="date" defaultValue="2026-10-22" /></label>
        <label className="pk-check"><input id="pk-half" type="checkbox" /> Half day</label>
        <button className="pk-primary" type="submit">Send request</button>
      </form></div>}
    </div>
  );
}

/* ---------- worker: notifications ---------- */
function WorkerNotifs({ unread, setUnread }) {
  const toast = useToast();
  const [acked, setAcked] = useState(false);
  const rows = [
    { id: 1, icon: 'bell', t: 'Ramadan timings at Deliveroo locations', x: 'Shifts start one hour later from Sunday. Please read and confirm.', w: '2 h ago', unread: unread > 0, ack: true },
    { id: 2, icon: 'calendar', t: 'New shift on Saturday', x: '2 PM – 12 AM at Carrefour Marina Mall, 10+1 hr', w: 'Yesterday', unread: unread > 1 },
    { id: 3, icon: 'document', t: 'Your visa expires on 19 October', x: 'Upload the new one from Your details.', w: 'Mon', unread: false },
    { id: 4, icon: 'checkCircle', t: 'Leave approved', x: 'Annual leave, Tue 13 – Wed 14 Oct', w: 'Sun', unread: false },
  ];
  return (
    <div className="pk-page">
      <Title>Notifications</Title>
      <div className="pk-pills"><button className="on">All</button><button>Unread{unread > 0 && <span className="pk-count">{unread}</span>}</button></div>
      <div className="pk-list">
        {rows.map((r) => (
          <div key={r.id} className={'pk-notif' + (r.unread ? ' unread' : '')} onClick={() => r.unread && setUnread(Math.max(0, unread - 1))}>
            <span className="pk-nicon"><Icon name={r.icon} size={18} /></span>
            <div className="pk-nbody"><b>{r.t}</b><span>{r.x}</span><small>{r.w}</small>
              {r.ack && !acked && <button className="pk-ackbtn" onClick={(e) => { e.stopPropagation(); setAcked(true); toast('Confirmed'); }}>I've read this</button>}
              {r.ack && acked && <span className="pk-status ok"><Icon name="checkCircle" size={15} /> Confirmed</span>}
            </div>
            {r.unread && <span className="pk-dot" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- worker: your details ---------- */
function WorkerMe({ back }) {
  const toast = useToast();
  return (
    <div className="pk-page">
      <div className="pk-centerhead"><RoundBtn icon="arrowLeft" label="Back" onClick={back} /><b>Your details</b><span /></div>
      <div className="pk-photo"><span className="pk-avatar">AN</span><button className="pk-link" onClick={() => toast('Takes a new photo; your supervisor approves it first')}>Update photo</button></div>
      <div className="pk-card pk-rows">
        {[['Name', 'Arjun Nair'], ['Mobile', '+971 50 300 0000'], ['Employee code', 'OP-1041'], ['Employed by', 'Crescent Staffing'], ['Works at', 'Carrefour Barsha Heights']].map(([k, v]) => <div key={k} className="pk-kv"><span>{k}</span><b>{v}</b></div>)}
      </div>
      <div className="pk-section">Documents</div>
      <div className="pk-card pk-rows">
        <div className="pk-kv"><span><Icon name="document" size={16} /> Visa</span><span className="pk-tag warn">Expires 19 Oct</span></div>
        <div className="pk-kv"><span><Icon name="document" size={16} /> Emirates ID</span><span className="pk-tag ok">Valid</span></div>
        <div className="pk-kv"><span><Icon name="document" size={16} /> Passport</span><span className="pk-tag ok">Valid</span></div>
      </div>
      <button className="pk-secondary" onClick={() => toast('Upload: take a photo or pick a file')}><Icon name="upload" size={18} /> Upload a document</button>
      <button className="pk-signout" onClick={() => toast('Signed out of this phone')}><Icon name="signOut" size={18} /> Sign out</button>
    </div>
  );
}

export function WorkerApp() {
  const [tab, setTab] = useState('home');
  const [state, setState] = useState('before');
  const [unread, setUnread] = useState(2);
  const screens = {
    home: <WorkerHome state={state} setState={setState} openMe={() => setTab('me')} />,
    week: <WorkerSchedule />, req: <WorkerRequests />, notif: <WorkerNotifs unread={unread} setUnread={setUnread} />, me: <WorkerMe back={() => setTab('home')} />,
  };
  const tabs = [{ id: 'home', icon: 'home', label: 'Home' }, { id: 'week', icon: 'calendar', label: 'Schedule' }, { id: 'req', icon: 'swap', label: 'Requests' }, { id: 'notif', icon: 'bell', label: 'Notifications', badge: unread }];
  return (
    <div className="mobile-stage">
      <Phone title="Worker app" nav={<BottomNav tabs={tabs} active={tab} onChange={setTab} />}>{screens[tab]}</Phone>
      <Annot items={[
        ['Clock in', 1, '7', 'Location checked on the server, on-device face match with a blink check. Works offline and syncs later.'],
        ['Breaks', 1, '5.5', 'A daily break allowance, taken in as many breaks as needed: prayer, food, a smoke. The app shows what is left; overruns are flagged.'],
        ['Schedule', 1, '5.4', 'This week and next. New shifts need a tap to acknowledge. Days with two shifts, even at different sites, show each one.'],
        ['Requests', 1, '5.8', 'Sick today, leave, open shifts to claim and swaps. Approved by the ops team.'],
        ['Optional overtime', 1, '5.5', 'An 11+1 shift ends after 11 hours; the worker may stay one more hour, paid as overtime.'],
        ['QR poster at the location', 2, '7', 'For locations with weak GPS: scan a printed code at the location, then the face check.'],
      ]}>
        <div className="annot-item"><b>Preview a state</b><div className="seg">{[['before', 'Before shift'], ['on', 'On shift'], ['break', 'On break'], ['done', 'Shift done']].map(([id, l]) => <button key={id} className={state === id ? 'on' : ''} onClick={() => { setState(id); setTab('home'); }}>{l}</button>)}</div></div>
      </Annot>
    </div>
  );
}

/* ---------- supervisor app ---------- */
export function SupervisorApp() {
  const [tab, setTab] = useState('site');
  const [cover, setCover] = useState(null);
  const [off, setOff] = useState({});
  const toast = useToast();
  const people = WORKERS.filter((w) => w.site === 's3').slice(0, 7);
  const tone = { 'Clocked in': 'ok', Late: 'warn', 'No-show': 'bad', 'On break': 'brk', 'Off today': '', 'On leave': '' };
  const site = (
    <div className="pk-page">
      <div className="pk-header"><Brand product="Supervisor" /><RoundBtn icon="person" label="Your details" onClick={() => toast('Supervisor details')} /></div>
      <h1 className="pk-hello sm">Carrefour Barsha Heights</h1>
      <div className="pk-range">Deliveroo · Wed 7 Oct</div>
      <div className="pk-summary"><div><b className="brand">19</b><span>in of 24</span></div><div><b className="warn">3</b><span>late</span></div><div><b className="bad">2</b><span>missing</span></div></div>
      <div className="pk-days">
        {people.map((w) => (
          <div key={w.id} className="pk-person">
            <div className="pk-person-top"><span className="pk-avatar sm">{w.name.split(' ').map((p) => p[0]).join('')}</span><div className="pk-daybody"><b>{w.name}</b><span className="pk-daystore">{vendorOf(w.vendor).code} · {w.role}</span></div><span className={'pk-tag ' + (off[w.id] ? '' : tone[w.status])}>{off[w.id] ? 'Marked off' : w.status}</span></div>
            {(w.status === 'No-show' || w.status === 'Late') && !off[w.id] && <div className="pk-person-actions">
              <button onClick={() => setCover(w)}>Find cover</button>
              <button onClick={() => { setOff({ ...off, [w.id]: true }); toast(`${w.name} marked off`); }}>Mark off</button>
            </div>}
          </div>
        ))}
      </div>
      <button className="pk-secondary" onClick={() => toast("Assisted clock-in: the worker's face plus your PIN, flagged as assisted")}><Icon name="face" size={18} /> Clock someone in</button>
      {cover && <div className="pk-sheetwrap" onClick={() => setCover(null)}><div className="pk-sheet" onClick={(e) => e.stopPropagation()}>
        <span className="pk-grab" /><h3>Cover for {cover.name.split(' ')[0]}</h3><p className="pk-note">7 AM – 6 PM, 11+1 hr · Picker · ranked by distance and hours</p>
        {[['Kevin Santos', '1.2 km · 36 h this week · reliever'], ['Tariq Mehmood', '2.8 km · 44 h · off today'], ['Suresh Babu', '3.1 km · 30 h · prefers mornings']].map(([n, d], i) => <div key={n} className="pk-reqrow"><div><b>{n}</b><span>{d}</span></div><button className={i ? 'pk-ghostbtn' : 'pk-smallbtn'} onClick={() => { setCover(null); toast(`${n} assigned · notified`); }}>Assign</button></div>)}
      </div></div>}
    </div>
  );
  const incident = (
    <form className="pk-page" onSubmit={(e) => { e.preventDefault(); toast('Sent to ops with the photo'); }}>
      <Title>Report</Title>
      <div className="pk-pills">{['Conduct', 'Safety', 'Uniform', 'Praise'].map((t, i) => <button type="button" key={t} className={i === 0 ? 'on' : ''}>{t}</button>)}</div>
      <label className="pk-field"><span>Worker</span><select id="sv-w">{people.map((w) => <option key={w.id}>{w.name}</option>)}</select></label>
      <label className="pk-field"><span>What happened</span><textarea id="sv-n" rows="4" defaultValue="Left the cold room door open twice during the morning rush." /></label>
      <button type="button" className="pk-secondary" onClick={() => toast('Camera opens')}><Icon name="upload" size={18} /> Add a photo</button>
      <button className="pk-primary" type="submit">Send report</button>
    </form>
  );
  const rate = (
    <div className="pk-page"><Title>Rate today</Title><p className="pk-note">Optional. Feeds the supervisor rating metric.</p>
      {people.slice(0, 5).map((w) => <div key={w.id} className="pk-reqrow"><div><b>{w.name}</b><span>{w.shift}</span></div><span className="pk-stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => toast(`${w.name.split(' ')[0]}: ${n} of 5`)} aria-label={`${n} of 5`}><Icon name="star" size={20} /></button>)}</span></div>)}
    </div>
  );
  const tabs = [{ id: 'site', icon: 'users', label: 'Location' }, { id: 'inc', icon: 'flag', label: 'Report' }, { id: 'rate', icon: 'star', label: 'Ratings' }];
  return (
    <div className="mobile-stage">
      <Phone title="Supervisor app" nav={<BottomNav tabs={tabs} active={tab} onChange={setTab} />}>{{ site, inc: incident, rate }[tab]}</Phone>
      <Annot items={[
        ['Location live view', 1, '7', "Who is in, late or missing at the supervisor's own locations."],
        ['Find cover, mark off', 1, '5.4', 'Same ranked suggestions as the ops dashboard roster.'],
        ['Clock someone in', 1, '7', "For a worker whose phone isn't working: their face plus the supervisor's PIN, flagged as assisted."],
        ['Reports and ratings', 1, '7', 'Incidents feed warnings; ratings feed the supervisor-rating metric.'],
      ]} />
    </div>
  );
}
