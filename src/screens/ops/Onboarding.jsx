import { SITES, VENDORS, PROPOSALS, SHIFT_TEMPLATES, HOME_AREAS, DESIG_ACCESS, tplOf, tplLabel, endOf, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Field, useToast, Icon, Select, Drawer } from '../../ui.jsx';
import { fmtD } from '../../lib/dates.js';

const { useState } = React;

// Same flow as the current OpsPro setup: a short wizard, then an app invite. Gig workers, so no approval pipeline.
// The page leads with the people vendors have suggested; the wizard and bulk import open from the header.
// Layout: suggestions as rows (Decline animates the row out); everything with steps lives in a 600px drawer.
// CSS: .ob2-* in style.css.
export const OB_STEPS = [['Personal details', 'Name, mobile, dates'], ['Work', 'Type, location, shift, vendor'], ['Reference photo', 'For face check at clock-in'], ['Review', 'Check, then create']];

export const OB_EMPTY = { first: '', last: '', phone: '', nat: '', start: '2026-10-08', end: '2027-04-07', reliever: false, home: 'Al Quoz', site: 's3', shift: 'f5', shiftStart: '07:00', vendor: 'v4', desig: 'Picker', photo: false };

export const INVITES = [
  { id: 'i1', name: 'Segun Bello', code: 'OP-1342', phone: '+971 55 210 4471', state: 'Not sent yet' },
  { id: 'i2', name: 'Ravi Nambiar', code: 'OP-1335', phone: '+971 52 774 9012', state: 'Active, expires in 31 h' },
  { id: 'i3', name: 'Ali Raza', code: 'OP-1328', phone: '+971 50 118 2290', state: 'Link expired' },
];

const initials = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);

export function Onboarding() {
  const [wiz, setWiz] = useState(false); // the add-a-worker wizard is open
  const [bulk, setBulk] = useState(false);
  const [step, setStep] = useState(0);
  const [d, setD] = useState(OB_EMPTY);
  const [done, setDone] = useState(null);
  const [props, setProps] = useState(PROPOSALS.filter((x) => x.stage !== 'ready'));
  const [leaving, setLeaving] = useState({});
  const toast = useToast();
  const set = (k, v) => setD({ ...d, [k]: v });
  const phoneOk = /^(\+?971|0)?5\d{8}$/.test(d.phone.replace(/\s/g, ''));
  const can = step === 0 ? d.first && d.last && phoneOk && d.start && d.end : true;
  const T = tplOf(d.shift);
  const fresh = (prefill = {}) => { setD({ ...OB_EMPTY, ...prefill }); setStep(0); setDone(null); setWiz(true); };
  const startFrom = (p) => { const [first, ...rest] = p.name.split(' '); fresh({ first, last: rest.join(' '), vendor: p.vendor, site: p.site, desig: p.role, reliever: p.role === 'Reliever', fromProp: p.id }); };
  const create = () => { setDone({ code: 'OP-' + (1349 + Math.floor(Math.random() * 40)), face: d.photo }); if (d.fromProp) setProps(props.filter((x) => x.id !== d.fromProp)); };
  const decline = (p) => {
    setLeaving((x) => ({ ...x, [p.id]: true }));
    setTimeout(() => { setProps((xs) => xs.filter((x) => x.id !== p.id)); toast(`${p.vendor === 'v4' ? 'GH FZE' : vendorOf(p.vendor).name} told: not taken forward`); }, 280);
  };

  return (
    <>
      <ScreenHeader title="Onboarding" phase={1} spec="6" actions={<>
        <button className="btn ghost" onClick={() => setBulk(true)}>Bulk import</button>
        <button className="btn" onClick={() => fresh()}><Icon name="plus" size={16} />Add a worker</button>
      </>} />

      <section className="ob2">
        <div className="ob2-head"><h2>Suggested by vendors<span className="live-count">{props.length}</span></h2><p>Vendors suggest people from their portal. Onboard fills the form with what they sent.</p></div>
        {props.length === 0 ? (
          <div className="lv-none">
            <span className="lv-none-ic"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
            <b>No suggestions waiting</b>
            <span>When a vendor suggests someone, they show up here.</span>
            <button className="btn ghost" onClick={() => fresh()}>Add a worker yourself</button>
          </div>
        ) : (
          <ul className="ob2-list">
            {props.map((p, i) => (
              <li key={p.id} className={'ob2-row' + (leaving[p.id] ? ' leaving' : '')} style={{ '--i': i }}>
                <span className="wf-who"><span className="live-face ring">{initials(p.name)}</span><span><b>{p.name}</b><span>{p.role}</span></span></span>
                <span className="ob2-cell"><span className="vtag">{vendorOf(p.vendor).code}</span>{vendorOf(p.vendor).name}</span>
                <span className="ob2-cell"><Icon name="pin" size={15} />{siteOf(p.site).name}</span>
                <span className="lvr-act"><button className="btn ghost" onClick={() => decline(p)}>Decline</button><button className="btn" onClick={() => startFrom(p)}>Onboard</button></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Drawer open={wiz} onClose={() => setWiz(false)} title={done ? 'Worker added' : d.fromProp ? `Onboard ${d.first} ${d.last}` : 'Add a worker'} sub={done ? null : 'A short setup, then an app invite'}>
        {wiz && !done && <>
          <ol className="up-steps2" aria-label="Steps">{OB_STEPS.map(([l], i) => <li key={l} className={i < step ? 'done' : i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined}><span>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>{l}</li>)}</ol>
          <div className="ob2-step" key={step}>
            <p className="ob2-lede">{OB_STEPS[step][1]}</p>
            {step === 0 && <div className="wfa-grid">
              <Field label="First name"><input id="ob-first" className="input" value={d.first} onChange={(e) => set('first', e.target.value)} autoFocus /></Field>
              <Field label="Last name"><input id="ob-last" className="input" value={d.last} onChange={(e) => set('last', e.target.value)} /></Field>
              <Field label="Mobile number"><input id="ob-phone" className={'input' + (d.phone && !phoneOk ? ' bad' : '')} placeholder="05X XXX XXXX" value={d.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" /><span className={d.phone && !phoneOk ? 'wfa-err' : 'wfa-hint'}>{d.phone && !phoneOk ? 'Enter a UAE mobile, e.g. 05XXXXXXXX' : 'Used to sign in to the app'}</span></Field>
              <Field label="Nationality (optional)"><Select id="ob-nat" className="input" value={d.nat} onChange={(e) => set('nat', e.target.value)}><option value="">Not set</option>{['India', 'Pakistan', 'Bangladesh', 'Nigeria', 'Philippines', 'Nepal', 'Sri Lanka', 'Other'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="Start date"><input id="ob-start" type="date" className="input" value={d.start} onChange={(e) => set('start', e.target.value)} /></Field>
              <Field label="End date"><input id="ob-end" type="date" className="input" value={d.end} onChange={(e) => set('end', e.target.value)} /><span className="wfa-hint">Contract end or last working day</span></Field>
            </div>}
            {step === 1 && <>
              <div className="ma-opts" role="radiogroup" aria-label="Type">{[[false, 'Employee', 'Works fixed shifts at one location', 'person'], [true, 'Floater', 'No fixed location; covers leave and no-shows where needed', 'users']].map(([v, l, sub, ic]) => (
                <button key={l} role="radio" aria-checked={d.reliever === v} className={'ob-opt ma-opt' + (d.reliever === v ? ' on' : '')} onClick={() => setD({ ...d, reliever: v, desig: Object.keys(DESIG_ACCESS).find((k) => DESIG_ACCESS[k] === (v ? 'Floater' : 'Employee')) })}>
                  <span className="ma-ic"><Icon name={ic} size={20} /></span><span className="ma-txt"><b>{l}</b><small>{sub}</small></span><span className="ma-radio" />
                </button>
              ))}</div>
              <div className="wfa-grid">
                {d.reliever ? <Field label="Home area"><Select id="ob-home" className="input" value={d.home} onChange={(e) => set('home', e.target.value)}>{Object.keys(HOME_AREAS).map((x) => <option key={x}>{x}</option>)}</Select><span className="wfa-hint">Where they live. Used to suggest the nearest covers.</span></Field>
                : <Field label="Location"><Select id="ob-site" className="input" value={d.site} onChange={(e) => set('site', e.target.value)}>{SITES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>}
                <Field label="Designation"><Select id="ob-desig" className="input" value={d.desig} onChange={(e) => set('desig', e.target.value)}>{Object.keys(DESIG_ACCESS).filter((k) => DESIG_ACCESS[k] === (d.reliever ? 'Floater' : 'Employee')).map((x) => <option key={x}>{x}</option>)}</Select></Field>
                {!d.reliever && <Field label="Usual shift"><Select id="ob-shift" className="input" value={d.shift} onChange={(e) => set('shift', e.target.value)}>{SHIFT_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{tplLabel(t)}</option>)}</Select></Field>}
                {!d.reliever && <Field label="Usually starts at"><input id="ob-shiftst" type="time" className="input" value={d.shiftStart} onChange={(e) => set('shiftStart', e.target.value || d.shiftStart)} /><span className="wfa-hint">Ends {endOf(d.shiftStart, T.base + (T.brk || 0)).time}</span></Field>}
                <Field label="Vendor"><Select id="ob-vendor" className="input" value={d.vendor} onChange={(e) => set('vendor', e.target.value)}>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
              </div>
            </>}
            {step === 2 && <>
              <label className={'up-drop ob2-photo' + (d.photo ? ' has' : '')} onClick={(e) => { e.preventDefault(); set('photo', !d.photo); }}>
                {d.photo ? <><span className="ob2-face">{(d.first[0] || '') + (d.last[0] || '')}</span><b>photo.jpg</b><span>Tap to replace</span></>
                  : <><span className="up-drop-ic"><Icon name="camera" size={22} /></span><b>Upload a clear, front-facing photo</b><span>JPG or PNG. The face is turned into a pattern on this device; the app compares against it at every clock-in.</span></>}
              </label>
              <p className="up-note"><Icon name="alert" size={15} />You can skip this and add it later, but the worker cannot clock in until a photo is set.</p>
            </>}
            {step === 3 && <dl className="wfx-kv">
              <dt>Name</dt><dd>{d.first} {d.last}</dd>
              <dt>Mobile</dt><dd>{d.phone}</dd>
              <dt>Dates</dt><dd>{fmtD(d.start)} – {fmtD(d.end)}</dd>
              <dt>Designation</dt><dd>{d.desig}<small>{d.reliever ? 'Floater' : 'Employee'} access</small></dd>
              {d.reliever ? <><dt>Home area</dt><dd>{d.home}</dd><dt>Shifts</dt><dd>Each cover follows the shift being covered</dd></> : <><dt>Location</dt><dd>{siteOf(d.site).name}</dd><dt>Usual shift</dt><dd>{d.shiftStart} – {endOf(d.shiftStart, T.base + (T.brk || 0)).time}<small>{tplLabel(T)}</small></dd></>}
              <dt>Vendor</dt><dd>{vendorOf(d.vendor).name}</dd>
              <dt>Photo</dt><dd>{d.photo ? <><span className="sdot good" />Added</> : <><span className="sdot crit" />Not added: cannot clock in yet</>}</dd>
            </dl>}
          </div>
          <div className="drawer-actions">
            {step > 0 ? <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button> : <button className="btn ghost" onClick={() => setWiz(false)}>Cancel</button>}
            <span className="grow" />
            {step < 3 ? <button className="btn" disabled={!can} onClick={() => setStep(step + 1)}>Continue</button> : <button className="btn" onClick={create}>Create worker</button>}
          </div>
        </>}
        {wiz && done && <div className="ob2-done">
          <span className="lv-none-ic"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
          <h3>{d.first} {d.last} is set up</h3>
          <dl className="wfx-kv">
            <dt>Employee ID</dt><dd>{done.code}</dd>
            <dt>{d.reliever ? 'Home area' : 'Location'}</dt><dd>{d.reliever ? d.home : siteOf(d.site).name}</dd>
            <dt>Vendor</dt><dd>{vendorOf(d.vendor).name}</dd>
            <dt>Face check</dt><dd><span className={'sdot ' + (done.face ? 'good' : 'warn')} />{done.face ? 'Face reference saved. They can clock in once they set a PIN.' : 'No photo yet: add one from their Workforce page before their first shift.'}</dd>
          </dl>
          <div className="ob2-done-act">
            <button className="btn" onClick={() => toast('WhatsApp opened with their setup link')}>Send app link on WhatsApp</button>
            <button className="btn ghost" onClick={() => toast('Setup link copied')}>Copy link</button>
            <button className="btn ghost" onClick={() => fresh()}>Add another</button>
          </div>
        </div>}
      </Drawer>

      <Drawer open={bulk} onClose={() => setBulk(false)} title="Add many workers at once" sub="One file, checked row by row before anything is created">
        {bulk && <>
          <ol className="ob2-howto">
            <li><span>1</span><div><b>Download the template</b><p>One row per worker: name, mobile, start and end date, location, designation, shift, vendor.</p></div></li>
            <li><span>2</span><div><b>Upload it back</b><p>Every row is checked before anything is created, and you get a report of rows to fix.</p></div></li>
            <li><span>3</span><div><b>Add photos afterwards</b><p>From each worker's page; invites appear under App invites.</p></div></li>
          </ol>
          <div className="drawer-actions"><button className="btn ghost" onClick={() => toast('Template downloaded (XLSX)')}><Icon name="download" size={15} />Download template</button><span className="grow" /><button className="btn" onClick={() => toast('Checked 24 rows · 22 ready, 2 to fix (invalid mobile, unknown location)')}><Icon name="upload" size={15} />Upload file</button></div>
        </>}
      </Drawer>
    </>
  );
}
