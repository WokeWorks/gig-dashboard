import { SITES, VENDORS, PROPOSALS, SHIFT_TEMPLATES, HOME_AREAS, DESIG_ACCESS, tplOf, tplLabel, endOf, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Tabs, Field, useToast, Icon, Select } from '../../ui.jsx';
import { fmtD } from '../../lib/dates.js';

const { useState } = React;

// Same flow as the current OpsPro setup: a short wizard, then an app invite. Gig workers, so no approval pipeline.
export const OB_STEPS = [['Personal details', 'Name, mobile, dates'], ['Work', 'Type, location, shift, vendor'], ['Reference photo', 'For face check at clock-in'], ['Review', 'Check, then create']];

export const OB_EMPTY = { first: '', last: '', phone: '', nat: '', start: '2026-10-08', end: '2027-04-07', reliever: false, home: 'Al Quoz', site: 's3', shift: 'f5', shiftStart: '07:00', vendor: 'v4', desig: 'Picker', photo: false };

export const INVITES = [
  { id: 'i1', name: 'Segun Bello', code: 'OP-1342', phone: '+971 55 210 4471', state: 'Not sent yet' },
  { id: 'i2', name: 'Ravi Nambiar', code: 'OP-1335', phone: '+971 52 774 9012', state: 'Active, expires in 31 h' },
  { id: 'i3', name: 'Ali Raza', code: 'OP-1328', phone: '+971 50 118 2290', state: 'Link expired' },
];

export function Onboarding() {
  const [tab, setTab] = useState('new');
  const [step, setStep] = useState(0);
  const [d, setD] = useState(OB_EMPTY);
  const [done, setDone] = useState(null);
  const [props, setProps] = useState(PROPOSALS.filter((x) => x.stage !== 'ready'));
  const toast = useToast();
  const set = (k, v) => setD({ ...d, [k]: v });
  const phoneOk = /^(\+?971|0)?5\d{8}$/.test(d.phone.replace(/\s/g, ''));
  const can = step === 0 ? d.first && d.last && phoneOk && d.start && d.end : true;
  const T = tplOf(d.shift);
  const startFrom = (p) => { const [first, ...rest] = p.name.split(' '); setD({ ...OB_EMPTY, first, last: rest.join(' '), vendor: p.vendor, site: p.site, desig: p.role, reliever: p.role === 'Reliever', fromProp: p.id }); setStep(0); setDone(null); setTab('new'); };
  const create = () => { setDone({ code: 'OP-' + (1349 + Math.floor(Math.random() * 40)), face: d.photo }); if (d.fromProp) setProps(props.filter((x) => x.id !== d.fromProp)); };
  return (
    <>
      <ScreenHeader title="Onboarding" phase={1} spec="6" />
      <Tabs tabs={[{ id: 'new', label: 'Add a worker' }, { id: 'bulk', label: 'Bulk import' }, { id: 'prop', label: `From vendors (${props.length})` }]} value={tab} onChange={setTab} />
      {tab === 'new' && !done && <div className="ob">
        <ol className="ob-steps">{OB_STEPS.map(([l, sub], i) => <li key={l} className={i === step ? 'on' : i < step ? 'done' : ''}><span className="ob-n">{i < step ? <Icon name="check" size={13} stroke={2.6} /> : i + 1}</span><div><b>{l}</b><span className="small muted">{sub}</span></div></li>)}</ol>
        <section className="card form ob-body">
          <div className="small muted">Step {step + 1} of 4</div>
          <h3 className="ob-h">{OB_STEPS[step][0]}</h3>
          {step === 0 && <div className="form-grid">
            <Field label="First name"><input id="ob-first" className="input" value={d.first} onChange={(e) => set('first', e.target.value)} /></Field>
            <Field label="Last name"><input id="ob-last" className="input" value={d.last} onChange={(e) => set('last', e.target.value)} /></Field>
            <Field label="Mobile number" hint={d.phone && !phoneOk ? 'Enter a UAE mobile, e.g. 05XXXXXXXX' : 'Used to sign in to the app'}><input id="ob-phone" className="input mono" placeholder="05X XXX XXXX" value={d.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Nationality (optional)"><Select id="ob-nat" className="input" value={d.nat} onChange={(e) => set('nat', e.target.value)}><option value="">Not set</option>{['India', 'Pakistan', 'Bangladesh', 'Nigeria', 'Philippines', 'Nepal', 'Sri Lanka', 'Other'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Start date"><input id="ob-start" type="date" className="input" value={d.start} onChange={(e) => set('start', e.target.value)} /></Field>
            <Field label="End date" hint="Contract end or last working day"><input id="ob-end" type="date" className="input" value={d.end} onChange={(e) => set('end', e.target.value)} /></Field>
          </div>}
          {step === 1 && <>
            <Field label="Type">
              <div className="ob-type">{[[false, 'Employee', 'Works fixed shifts at one location'], [true, 'Floater', 'No fixed location; covers leave and no-shows where needed']].map(([v, l, sub]) => (
                <button key={l} className={'ob-opt' + (d.reliever === v ? ' on' : '')} onClick={() => setD({ ...d, reliever: v, desig: Object.keys(DESIG_ACCESS).find((k) => DESIG_ACCESS[k] === (v ? 'Floater' : 'Employee')) })}><b>{l}</b><span className="small muted">{sub}</span></button>
              ))}</div>
            </Field>
            <div className="form-grid">
              {d.reliever ? <Field label="Home area" hint="Where they live. Used to suggest the nearest covers."><Select id="ob-home" className="input" value={d.home} onChange={(e) => set('home', e.target.value)}>{Object.keys(HOME_AREAS).map((x) => <option key={x}>{x}</option>)}</Select></Field>
              : <Field label="Location"><Select id="ob-site" className="input" value={d.site} onChange={(e) => set('site', e.target.value)}>{SITES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>}
              <Field label="Designation"><Select id="ob-desig" className="input" value={d.desig} onChange={(e) => set('desig', e.target.value)}>{Object.keys(DESIG_ACCESS).filter((k) => DESIG_ACCESS[k] === (d.reliever ? 'Floater' : 'Employee')).map((x) => <option key={x}>{x}</option>)}</Select></Field>
              {!d.reliever && <Field label="Usual shift"><Select id="ob-shift" className="input" value={d.shift} onChange={(e) => set('shift', e.target.value)}>{SHIFT_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{tplLabel(t)}</option>)}</Select></Field>}
              {!d.reliever && <Field label="Usually starts at" hint={`Ends ${endOf(d.shiftStart, T.base + (T.brk || 0)).time}`}><input id="ob-shiftst" type="time" className="input mono" value={d.shiftStart} onChange={(e) => set('shiftStart', e.target.value || d.shiftStart)} /></Field>}
              <Field label="Vendor"><Select id="ob-vendor" className="input" value={d.vendor} onChange={(e) => set('vendor', e.target.value)}>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
            </div>
          </>}
          {step === 2 && <>
            <button className={'ob-photo' + (d.photo ? ' has' : '')} onClick={() => set('photo', !d.photo)}>
              {d.photo ? <><span className="ob-face" aria-hidden="true">{(d.first[0] || '') + (d.last[0] || '')}</span><b>photo.jpg</b><span className="small muted">Tap to replace</span></> : <><Icon name="upload" size={22} /><b>Upload a clear, front-facing photo</b><span className="small muted">JPG or PNG. The face is turned into a pattern on this device; the app compares against it at every clock-in.</span></>}
            </button>
            <div className="small muted">You can skip this and add it later, but the worker cannot clock in until a photo is set.</div>
          </>}
          {step === 3 && <dl className="kv ob-review">
            <dt>Name</dt><dd>{d.first} {d.last}</dd>
            <dt>Mobile</dt><dd className="mono">{d.phone}</dd>
            <dt>Dates</dt><dd>{fmtD(d.start)} – {fmtD(d.end)}</dd>
            <dt>Designation</dt><dd>{d.desig} · {d.reliever ? 'Floater' : 'Employee'} access</dd>
            {d.reliever ? <><dt>Home area</dt><dd>{d.home}</dd><dt>Shifts</dt><dd>Each cover follows the shift being covered</dd></> : <><dt>Location</dt><dd>{siteOf(d.site).name}</dd><dt>Usual shift</dt><dd>{d.shiftStart} – {endOf(d.shiftStart, T.base + (T.brk || 0)).time} · {tplLabel(T)}</dd></>}
            <dt>Vendor</dt><dd>{vendorOf(d.vendor).name}</dd>
            <dt>Photo</dt><dd>{d.photo ? 'Added' : <span className="neg">Not added: cannot clock in yet</span>}</dd>
          </dl>}
          <div className="drawer-actions">
            {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
            <span className="grow" />
            {step < 3 ? <button className="btn" disabled={!can} onClick={() => setStep(step + 1)}>Continue</button> : <button className="btn" onClick={create}>Create worker</button>}
          </div>
        </section>
      </div>}
      {tab === 'new' && done && <section className="card ob-done">
        <span className="ob-tick"><Icon name="check" size={26} stroke={2.6} /></span>
        <h3>{d.first} {d.last} is set up</h3>
        <div className="muted">Employee ID <b className="mono">{done.code}</b> · {siteOf(d.site).name} · {vendorOf(d.vendor).name}</div>
        <div className="small">{done.face ? 'Face reference saved. They can clock in once they set a PIN.' : 'No photo yet: add one from their Workforce page before their first shift.'}</div>
        <div className="feed-actions">
          <button className="btn" onClick={() => toast('WhatsApp opened with their setup link')}>Send app link on WhatsApp</button>
          <button className="btn ghost" onClick={() => toast('Setup link copied')}>Copy link</button>
          <button className="btn ghost" onClick={() => { setD(OB_EMPTY); setStep(0); setDone(null); }}>Add another</button>
        </div>
      </section>}
      {tab === 'bulk' && <section className="card ob-bulk">
        <h3 className="ob-h">Add many workers at once</h3>
        <ol className="ob-bulk-steps small">
          <li>Download the template. One row per worker: name, mobile, start and end date, location, designation, shift, vendor.</li>
          <li>Upload it back. Every row is checked before anything is created, and you get a report of rows to fix.</li>
          <li>Photos are added afterwards from each worker's page; invites appear under App invites.</li>
        </ol>
        <div className="feed-actions"><button className="btn ghost" onClick={() => toast('Template downloaded (XLSX)')}>Download template</button><button className="btn" onClick={() => toast('Checked 24 rows · 22 ready, 2 to fix (invalid mobile, unknown location)')}>Upload file</button></div>
      </section>}
      {tab === 'prop' && <section className="card flush">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Candidate</th><th>Vendor</th><th>Preferred location</th><th></th></tr></thead>
          <tbody>{props.map((p) => <tr key={p.id}>
            <td><b>{p.name}</b><div className="small muted">{p.role}</div></td>
            <td><span className="vtag" title={vendorOf(p.vendor).name}>{vendorOf(p.vendor).code}</span> {vendorOf(p.vendor).name}</td>
            <td>{siteOf(p.site).name}</td>
            <td><div className="lv-act"><button className="btn sm ghost" onClick={() => { setProps(props.filter((x) => x.id !== p.id)); toast(`${p.vendor === 'v4' ? 'GH FZE' : vendorOf(p.vendor).name} told: not taken forward`); }}>Decline</button><button className="btn sm" onClick={() => startFrom(p)}>Onboard</button></div></td>
          </tr>)}</tbody>
        </table></div>
        <div className="pad lv-foot small muted">Vendors can suggest people from their portal. Onboard fills the form with what they sent.</div>
      </section>}
    </>
  );
}
