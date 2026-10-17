import { SITES, WORKERS, MANAGERS, siteOf, vendorOf } from './data.js';
import { ScreenHeader, Tabs, Drawer, Field, Toggle, useToast, Icon, Select } from './ui.jsx';

const { useState } = React;

/* ---------------- Forms ----------------
   A form is a list of questions plus when it comes up (clock-in, clock-out, on a schedule, or whenever needed),
   who fills it, where, and whether it has to be done before clocking in. Answers can flag the manager.
   Every submission is stamped with the worker, their shift and location automatically.

   Layout: the list and the submissions are rows on the page (status as dots, no table, no cards); New form opens a
   drawer of templates. The builder is a split pane fixed to the window (.main:has(> .fb2)): the questions scroll on the
   left with roomy, readable fields; on the right an iPhone frame (.ip) runs the real FormBody, sized to the window
   height so it always fits. FormBody is shared with the phone app, so builder-only styling is scoped to .ip.
   CSS: the "Forms" section at the end of style.css. */

export const FIELD_TYPES = [
  ['yesno', 'Yes / No', 'toggleq'],
  ['check', 'Checklist', 'checkCircle'],
  ['number', 'Number', 'hash'],
  ['choice', 'Multiple choice', 'list'],
  ['text', 'Text', 'text'],
  ['photo', 'Photo', 'camera'],
  ['signature', 'Signature', 'pen'],
];
const typeOf = (t) => FIELD_TYPES.find((x) => x[0] === t);
const TRIGGERS = { clockin: 'At clock-in', clockout: 'At clock-out', schedule: 'On a schedule', demand: 'Whenever needed' };
const WHO = ['Everyone', 'Pickers', 'Shift leads', 'Floaters', 'Supervisors'];
let uid = 100;
const nid = () => 'q' + uid++;

const F = (type, label, extra = {}) => ({ id: nid(), type, label, req: true, ...extra });

export const TEMPLATES = [
  { key: 'open', industry: 'Dark stores & retail', name: 'Store opening checklist', desc: 'Is the store ready before the first shift starts', trigger: 'clockin', block: true, who: 'Shift leads', fields: [
    F('check', 'Before opening', { opts: ['Lights and AC on', 'Handheld scanners charged', 'Picking trolleys in place', 'Walkways clear'], flag: { when: 'unticked' } }),
    F('yesno', 'Cold rooms at the right temperature?', { flag: { when: 'no' } }),
    F('photo', 'Photo of the picking floor'),
    F('text', 'Anything the supervisor should know?', { req: false }),
  ] },
  { key: 'temp', industry: 'Dark stores & retail', name: 'Cold chain temperature log', desc: 'Fridge and freezer readings for food safety', trigger: 'schedule', every: 4, who: 'Shift leads', fields: [
    F('number', 'Chiller temperature', { unit: '°C', min: 0, max: 5, flag: { when: 'out' } }),
    F('number', 'Freezer temperature', { unit: '°C', min: -25, max: -18, flag: { when: 'out' } }),
    F('photo', 'Photo of the display'),
  ] },
  { key: 'vehicle', industry: 'Logistics & drivers', name: 'Pre-trip vehicle check', desc: 'Drivers check the van before the first drop', trigger: 'clockin', block: true, who: 'Everyone', fields: [
    F('number', 'Odometer reading', { unit: 'km' }),
    F('check', 'Vehicle check', { opts: ['Tyres look fine', 'Lights and indicators work', 'Brakes feel normal', 'No warning lights on the dashboard'], flag: { when: 'unticked' } }),
    F('choice', 'Fuel level', { opts: ['Full', 'Three quarters', 'Half', 'Quarter or less'], flag: { when: 'opt', value: 'Quarter or less' } }),
    F('photo', 'Photo of any damage', { req: false }),
    F('signature', 'Driver signature'),
  ] },
  { key: 'patrol', industry: 'Security & facilities', name: 'Patrol log', desc: 'Each round of the site, with anything found', trigger: 'schedule', every: 2, who: 'Everyone', fields: [
    F('yesno', 'All doors and gates secure?', { flag: { when: 'no' } }),
    F('yesno', 'Anything suspicious?', { flag: { when: 'yes' } }),
    F('text', 'Details', { req: false }),
    F('photo', 'Photo', { req: false }),
  ] },
  { key: 'incident', industry: 'Every industry', name: 'Incident report', desc: 'An injury, damage or near miss, reported on the spot', trigger: 'demand', who: 'Everyone', fields: [
    F('choice', 'What happened?', { opts: ['Injury', 'Damage to stock or equipment', 'Near miss', 'Customer complaint', 'Other'], flag: { when: 'opt', value: 'Injury' } }),
    F('text', 'Describe what happened'),
    F('yesno', 'Was anyone hurt?', { flag: { when: 'yes' } }),
    F('photo', 'Photos', { req: false }),
    F('signature', 'Your signature'),
  ] },
  { key: 'fit', industry: 'Every industry', name: 'Start-of-shift check', desc: 'Fit to work and wearing the right kit', trigger: 'clockin', block: true, who: 'Pickers', fields: [
    F('yesno', 'Are you feeling fit to work today?', { flag: { when: 'no' } }),
    F('check', 'Your kit', { opts: ['Uniform on', 'Safety shoes on', 'Phone charged'], flag: { when: 'unticked' } }),
  ] },
  { key: 'handover', industry: 'Every industry', name: 'Shift handover', desc: 'Notes for whoever takes over', trigger: 'clockout', who: 'Shift leads', fields: [
    F('number', 'Orders still open', { unit: 'orders' }),
    F('yesno', 'Any equipment faulty?', { flag: { when: 'yes' } }),
    F('text', 'Notes for the next shift', { req: false }),
  ] },
];

const clone = (t, extra) => ({ ...JSON.parse(JSON.stringify(t)), fields: t.fields.map((f) => ({ ...f, id: nid() })), ...extra });
const T = (k) => TEMPLATES.find((t) => t.key === k);
const INITIAL = [
  clone(T('fit'), { id: 'fm5', status: 'live', sites: 'all', subs: 212, flagged: 4, updated: 'Sun 4 Oct' }),
  clone(T('open'), { id: 'fm1', status: 'live', sites: 'all', subs: 41, flagged: 3, updated: 'Mon 5 Oct' }),
  clone(T('temp'), { id: 'fm2', status: 'live', sites: 'all', subs: 128, flagged: 2, updated: 'Thu 1 Oct' }),
  clone(T('incident'), { id: 'fm3', status: 'live', sites: 'all', subs: 3, flagged: 1, updated: 'Mon 28 Sep' }),
  clone(T('handover'), { id: 'fm4', status: 'draft', sites: 'all', subs: 0, flagged: 0, updated: 'Today' }),
];

// Published forms, shared with the worker app.
export const FORMS_STORE = { list: INITIAL };
// The form a worker must finish before clocking in, if any.
// Forms are a later release: until they're switched on, the phone app never asks for one
// (no checklist before clock-in, no incident report button). The Forms screen still works.
export const FORMS_ON = { phone: false };
export const clockInForm = (who = 'Pickers') => FORMS_ON.phone && FORMS_STORE.list.find((f) => f.status === 'live' && f.trigger === 'clockin' && f.block && (f.who === 'Everyone' || f.who === who));
export const formByKey = (name) => FORMS_ON.phone && FORMS_STORE.list.find((f) => f.status === 'live' && f.name === name);
const whenText = (f) => (f.trigger === 'schedule' ? `Every ${f.every || 4} hours on shift` : TRIGGERS[f.trigger]);
// Is this answer one the manager should hear about?
const flagged = (q, v) => {
  if (!q.flag || v === undefined || v === '' || v === null) return false;
  if (q.flag.when === 'no') return v === 'no';
  if (q.flag.when === 'yes') return v === 'yes';
  if (q.flag.when === 'out') return v !== '' && (Number(v) < q.min || Number(v) > q.max);
  if (q.flag.when === 'opt') return v === q.flag.value;
  if (q.flag.when === 'unticked') return Array.isArray(v) && v.length < (q.opts || []).length;
  return false;
};
const flagText = (q) => ({ no: 'the answer is No', yes: 'the answer is Yes', out: `it's outside ${q.min} to ${q.max}${q.unit ? ' ' + q.unit : ''}`, opt: `they pick "${q.flag?.value}"`, unticked: 'anything is left unticked' })[q.flag?.when];

// Submissions: who filled what, where, and which answers were flagged.
const SUBS = [
  { id: 'sb1', form: 'fm1', w: 'w5', site: 's3', at: 'Wed 7 Oct, 06:52', shift: '07:00 shift', ans: { 0: ['Lights and AC on', 'Handheld scanners charged', 'Walkways clear'], 1: 'no', 2: 'photo', 3: 'Chiller 2 reading 9°C, maintenance called' } },
  { id: 'sb2', form: 'fm2', w: 'w11', site: 's1', at: 'Wed 7 Oct, 10:01', shift: '07:00 shift', ans: { 0: '3', 1: '-21', 2: 'photo' } },
  { id: 'sb3', form: 'fm3', w: 'w22', site: 's6', at: 'Tue 6 Oct, 16:40', shift: '14:00 shift', ans: { 0: 'Damage to stock or equipment', 1: 'Pallet jack dropped a crate of milk in aisle 4. Cleaned and logged.', 2: 'no', 3: 'photo', 4: 'sig' } },
  { id: 'sb4', form: 'fm1', w: 'w17', site: 's6', at: 'Wed 7 Oct, 06:48', shift: '07:00 shift', ans: { 0: ['Lights and AC on', 'Handheld scanners charged', 'Picking trolleys in place', 'Walkways clear'], 1: 'yes', 2: 'photo' } },
  { id: 'sb5', form: 'fm2', w: 'w5', site: 's3', at: 'Wed 7 Oct, 10:58', shift: '07:00 shift', ans: { 0: '7', 1: '-19', 2: 'photo' } },
  { id: 'sb7', form: 'fm5', w: 'w4', site: 's3', at: 'Wed 7 Oct, 06:56', shift: '07:00 shift', ans: { 0: 'yes', 1: ['Uniform on', 'Phone charged'] } },
  { id: 'sb6', form: 'fm1', w: 'w23', site: 's4', at: 'Wed 7 Oct, 06:55', shift: '07:00 shift', ans: { 0: ['Lights and AC on', 'Handheld scanners charged', 'Picking trolleys in place', 'Walkways clear'], 1: 'yes', 2: 'photo', 3: '' } },
];

/* ---------- the worker's view ---------- */
const TRIGGER_ICON = { clockin: 'clock', clockout: 'logout', schedule: 'calendar', demand: 'document' };
const initials = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);

// An iPhone frame around the live form: side buttons, dynamic island, status bar, home indicator.
function PhoneForm(props) {
  return (
    <div className="ip">
      <span className="ip-btn ip-act" /><span className="ip-btn ip-vup" /><span className="ip-btn ip-vdn" /><span className="ip-btn ip-pwr" />
      <div className="ip-screen">
        <div className="ip-status" aria-hidden="true">
          <span className="ip-time">9:41</span>
          <span className="ip-island" />
          <span className="ip-sys">
            <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
            <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0L8 11.5Z" /><path d="M3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0L3.4 6.8Z" /><path d="M1.1 4.5a9.8 9.8 0 0 1 13.8 0l-1.4 1.4a7.8 7.8 0 0 0-11 0L1.1 4.5Z" /></svg>
            <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="18" height="9" rx="2" /><path d="M25 4.5v4a2 2 0 0 0 0-4Z" opacity=".45" /></svg>
          </span>
        </div>
        <div className="ip-body fp-screen"><FormBody {...props} /></div>
        <span className="ip-home" aria-hidden="true" />
      </div>
    </div>
  );
}
export function FormBody({ form, answers, setAnswers, onSubmit, ctx = 'Carrefour Barsha Heights · Wed 7 Oct · 07:00 shift', submitLabel = 'Submit' }) {
  const set = (id, v) => setAnswers({ ...answers, [id]: v });
  const missing = form.fields.filter((q) => q.req && (answers[q.id] === undefined || answers[q.id] === '' || (Array.isArray(answers[q.id]) && q.type !== 'check' && !answers[q.id].length))).length;
  return (
      <>
        <div className="fp-top">
          <div className="fp-ctx small">{ctx}</div>
          <h3 className="fp-title">{form.name || 'Untitled form'}</h3>
          {form.desc && <div className="small muted">{form.desc}</div>}
          {form.block && form.trigger === 'clockin' && <div className="fp-block small"><Icon name="clock" size={14} /> Finish this to clock in</div>}
        </div>
        {form.fields.length === 0 && <div className="fp-empty small muted">Add a question and it shows up here.</div>}
        {form.fields.map((q, i) => { const v = answers[q.id]; const fl = flagged(q, v); return (
          <div key={q.id} className={'fp-q' + (fl ? ' flagged' : '')}>
            <div className="fp-label">{q.label || `Question ${i + 1}`}{q.req && <span className="fp-req">*</span>}</div>
            {q.type === 'yesno' && <div className="fp-yn">{['yes', 'no'].map((o) => <button key={o} className={v === o ? 'on' : ''} onClick={() => set(q.id, o)}>{o === 'yes' ? 'Yes' : 'No'}</button>)}</div>}
            {q.type === 'check' && <div className="fp-checks">{(q.opts || []).map((o) => { const on = (v || []).includes(o); return <button key={o} className={'fp-check' + (on ? ' on' : '')} onClick={() => set(q.id, on ? (v || []).filter((x) => x !== o) : [...(v || []), o])}><span className="fp-box">{on && <Icon name="check" size={12} stroke={2.8} />}</span>{o}</button>; })}</div>}
            {q.type === 'number' && <div className="fp-num"><input type="number" inputMode="decimal" value={v ?? ''} placeholder={q.min !== undefined && q.min !== '' ? `${q.min} to ${q.max}` : ''} onChange={(e) => set(q.id, e.target.value)} />{q.unit && <span>{q.unit}</span>}</div>}
            {q.type === 'choice' && <div className="fp-opts">{(q.opts || []).map((o) => <button key={o} className={v === o ? 'on' : ''} onClick={() => set(q.id, o)}>{o}</button>)}</div>}
            {q.type === 'text' && <textarea rows={2} value={v || ''} onChange={(e) => set(q.id, e.target.value)} placeholder="Type here" />}
            {q.type === 'photo' && <button className={'fp-photo' + (v ? ' has' : '')} onClick={() => set(q.id, v ? '' : 'photo')}><Icon name="camera" size={20} />{v ? 'Photo added · tap to retake' : 'Take a photo'}</button>}
            {q.type === 'signature' && <button className={'fp-sig' + (v ? ' has' : '')} onClick={() => set(q.id, v ? '' : 'sig')}>{v ? <svg viewBox="0 0 160 40" aria-hidden="true"><path d="M6 30c10-18 18-22 22-12s-4 16 4 8 12-20 18-8 6 14 14 2 10-14 16-4 8 10 18 0 14-6 22 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> : 'Sign here'}</button>}
            {fl && <div className="fp-flag small"><Icon name="flag" size={12} /> Your manager will be told</div>}
          </div>
        ); })}
        {form.fields.length > 0 && <div className="fp-foot"><button className="fp-submit" disabled={missing > 0} onClick={onSubmit}>{missing ? `${missing} required left` : submitLabel}</button></div>}
      </>
  );
}

/* ---------- builder ---------- */
function Builder({ form, onBack, onSave }) {
  const [f, setF] = useState(form);
  const [sel, setSel] = useState(form.fields[0]?.id || null);
  const [answers, setAnswers] = useState({});
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const setQ = (id, patch) => setF({ ...f, fields: f.fields.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  const move = (i, d) => { const a = [...f.fields]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); setF({ ...f, fields: a }); };
  const add = (type) => { const q = { id: nid(), type, label: '', req: true, ...(type === 'check' || type === 'choice' ? { opts: ['Option 1', 'Option 2'] } : {}), ...(type === 'number' ? { unit: '', min: '', max: '' } : {}) }; setF({ ...f, fields: [...f.fields, q] }); setSel(q.id); setAdding(false); };
  const flags = f.fields.filter((q) => q.flag).length;
  const live = f.status === 'live';
  return (
    <div className="fb2">
      <div className="fb2-bar">
        <button className="btn ghost fb2-back" onClick={onBack}><Icon name="arrowLeft" size={16} />Forms</button>
        <input className="fb2-name" value={f.name} placeholder="Untitled form" onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Form name" />
        <span className="fb2-st"><span className={'sdot ' + (live ? 'good' : 'ring')} />{live ? 'Live' : 'Draft'}</span>
        <span className="grow" />
        <button className="btn ghost" onClick={() => { onSave({ ...f }); toast('Saved'); }}>Save draft</button>
        <button className="btn" disabled={!f.name || !f.fields.length} onClick={() => { onSave({ ...f, status: 'live' }); toast(live ? 'Changes published · the app updates on next open' : 'Published · workers see it ' + whenText(f).toLowerCase()); onBack(); }}>{live ? 'Publish changes' : 'Publish'}</button>
      </div>

      <div className="fb2-grid">
        <div className="fb2-left">
          <section className="fb2-sec">
            <header className="fb2-h"><h3>When and who</h3><span>When the form comes up, and who fills it in</span></header>
            <div className="fb2-set">
              <div className="fb2-srow"><div><b>Comes up</b><span>When it appears on their phone</span></div><Select className="input" value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value })}>{Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
              {f.trigger === 'schedule' && <div className="fb2-srow"><div><b>Every</b><span>Hours between each one, while on shift</span></div><div className="unit-in"><input className="input" type="number" min="1" max="12" value={f.every || 4} onChange={(e) => setF({ ...f, every: +e.target.value })} aria-label="Hours between" /><span>hours on shift</span></div></div>}
              <div className="fb2-srow"><div><b>Filled in by</b><span>Who has to fill it in</span></div><Select className="input" value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })}>{WHO.map((x) => <option key={x}>{x}</option>)}</Select></div>
              <div className="fb2-srow"><div><b>At</b><span>Which locations use it</span></div><Select className="input" value={f.sites === 'all' ? 'all' : 'some'} onChange={(e) => setF({ ...f, sites: e.target.value === 'all' ? 'all' : ['s3'] })}><option value="all">All locations</option><option value="some">Chosen locations</option></Select></div>
              {f.trigger === 'clockin' && <div className="fb2-srow"><div><b>Required to clock in</b><span>They can't clock in until it's done</span></div><Toggle id="fb-block" checked={!!f.block} onChange={(v) => setF({ ...f, block: v })} label={f.block ? 'On' : 'Off'} /></div>}
            </div>
            <p className="fb2-note"><Icon name="document" size={16} />Every answer is stamped with who sent it, their shift, location and the time.</p>
          </section>

          <section className="fb2-sec">
            <header className="fb2-h"><h3>Questions<span className="fb2-count">{f.fields.length}</span></h3>{flags > 0 && <span><Icon name="flag" size={14} />{flags} can flag the manager</span>}</header>
            <ol className="fb2-qs">
              {f.fields.map((q, i) => { const T = typeOf(q.type); const on = sel === q.id; return (
                <li key={q.id} className={'fb2-q' + (on ? ' on' : '')} style={{ '--i': i }}>
                  <div className="fb2-qrow" onClick={() => setSel(on ? null : q.id)}>
                    <span className="fb2-n">{i + 1}</span>
                    <span className="fb2-ico"><Icon name={T[2]} size={18} /></span>
                    <span className="fb2-qtext"><b>{q.label || 'Untitled question'}</b><span>{T[1]}{q.req ? '' : ' · optional'}{q.flag ? ` · tells the manager when ${flagText(q)}` : ''}</span></span>
                    <span className="fb2-qact" onClick={(e) => e.stopPropagation()}>
                      <button className="btn ghost icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="up" size={16} /></button>
                      <button className="btn ghost icon" disabled={i === f.fields.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="down" size={16} /></button>
                      <button className="btn ghost icon" onClick={() => setF({ ...f, fields: f.fields.filter((x) => x.id !== q.id) })} aria-label="Remove question"><Icon name="trash" size={16} /></button>
                    </span>
                  </div>
                  {on && <div className="fb2-edit">
                    <Field label="Question"><input className="input fb2-qlabel" autoFocus={!q.label} value={q.label} placeholder="Type the question" onChange={(e) => setQ(q.id, { label: e.target.value })} /></Field>
                    <div className="fb2-group">
                      <h5>Answer</h5>
                      <div className="fb2-ans">
                        <Select className="input" value={q.type} onChange={(e) => setQ(q.id, { type: e.target.value, flag: undefined, ...(['check', 'choice'].includes(e.target.value) && !q.opts ? { opts: ['Option 1', 'Option 2'] } : {}) })}>{FIELD_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
                        <div className="seg fb2-seg" role="group" aria-label="Required or optional"><button className={q.req ? 'on' : ''} onClick={() => setQ(q.id, { req: true })}>Required</button><button className={!q.req ? 'on' : ''} onClick={() => setQ(q.id, { req: false })}>Optional</button></div>
                      </div>
                    </div>
                    {(q.type === 'check' || q.type === 'choice') && <div className="fb2-group">
                      <h5>{q.type === 'check' ? 'Items to tick' : 'Options'}<span>{(q.opts || []).length}</span></h5>
                      <div className="fb2-opts">{(q.opts || []).map((o, k) => (
                        <div key={k} className="fb2-opt"><span className={q.type === 'check' ? 'fb2-box' : 'fb2-radio'} aria-hidden="true" /><input className="input" value={o} onChange={(e) => setQ(q.id, { opts: q.opts.map((x, j) => (j === k ? e.target.value : x)) })} aria-label={`${q.type === 'check' ? 'Item' : 'Option'} ${k + 1}`} /><button className="btn ghost icon" onClick={() => setQ(q.id, { opts: q.opts.filter((_, j) => j !== k) })} aria-label="Remove option"><Icon name="x" size={16} /></button></div>
                      ))}<button className="btn ghost fb2-addopt" onClick={() => setQ(q.id, { opts: [...(q.opts || []), `Option ${(q.opts || []).length + 1}`] })}><Icon name="plus" size={15} />Add {q.type === 'check' ? 'item' : 'option'}</button></div>
                    </div>}
                    {q.type === 'number' && <div className="fb2-group">
                      <h5>Expected reading</h5>
                      <div className="fb2-fields three">
                        <Field label="Unit"><input className="input" value={q.unit || ''} placeholder="°C, km…" onChange={(e) => setQ(q.id, { unit: e.target.value })} /></Field>
                        <Field label="From"><input className="input" type="number" value={q.min ?? ''} onChange={(e) => setQ(q.id, { min: e.target.value === '' ? '' : +e.target.value })} /></Field>
                        <Field label="To"><input className="input" type="number" value={q.max ?? ''} onChange={(e) => setQ(q.id, { max: e.target.value === '' ? '' : +e.target.value })} /></Field>
                      </div>
                    </div>}
                    {['yesno', 'check', 'number', 'choice'].includes(q.type) && (() => {
                      const opts = q.type === 'yesno' ? [['no', 'the answer is No'], ['yes', 'the answer is Yes']] : q.type === 'check' ? [['unticked', 'anything is left unticked']] : q.type === 'number' ? [['out', 'it is outside the expected range']] : (q.opts || []).map((o) => ['opt:' + o, `they pick "${o}"`]);
                      const cur = !q.flag ? '' : q.flag.when === 'opt' ? 'opt:' + q.flag.value : q.flag.when;
                      return <div className={'fb2-group fb2-flagbox' + (q.flag ? ' on' : '')}>
                        <h5><Icon name="flag" size={15} />Tell the manager</h5>
                        <Select className="input" value={cur} onChange={(e) => { const v = e.target.value; setQ(q.id, { flag: !v ? undefined : v.startsWith('opt:') ? { when: 'opt', value: v.slice(4) } : { when: v } }); }} aria-label="Tell the manager when">{[['', 'Never'], ...opts.map(([k, l]) => [k, 'When ' + l])].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
                        {q.flag && <p className="fb2-note">Raises a notification for the location's manager, with the photo and answers attached.</p>}
                      </div>;
                    })()}
                  </div>}
                </li>
              ); })}
            </ol>
            {adding
              ? <div className="fb2-add">
                  <div className="fb2-add-h"><b>What kind of question?</b><button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button></div>
                  <div className="fb2-types">{FIELD_TYPES.map(([k, l, ic], n) => <button key={k} className="fb2-type" style={{ '--i': n }} onClick={() => add(k)}><span className="fb2-ico"><Icon name={ic} size={18} /></span>{l}</button>)}</div>
                </div>
              : <button className="fb2-addbtn" onClick={() => setAdding(true)}><Icon name="plus" size={18} />Add question</button>}
          </section>
        </div>

        <div className="fb2-right">
          <div className="fb2-prev"><b>What workers see</b><span>Try it, nothing is sent</span>{Object.keys(answers).length > 0 && <button className="linkbtn" onClick={() => setAnswers({})}>Clear</button>}</div>
          <PhoneForm form={f} answers={answers} setAnswers={setAnswers} onSubmit={() => { const n = f.fields.filter((q) => flagged(q, answers[q.id])).length; toast(n ? `Test submitted · ${n} ${n === 1 ? 'answer' : 'answers'} would flag the manager` : 'Test submitted · nothing flagged'); setAnswers({}); }} />
        </div>
      </div>
    </div>
  );
}

/* ---------- forms page ---------- */
export function Forms({ go }) {
  const [forms, setFormsRaw] = useState(FORMS_STORE.list);
  const setForms = (fn) => setFormsRaw((xs) => { const n = typeof fn === 'function' ? fn(xs) : fn; FORMS_STORE.list = n; return n; });
  const [tab, setTab] = useState('forms');
  const [editing, setEditing] = useState(null);
  const [picking, setPicking] = useState(false);
  const [sub, setSub] = useState(null);
  const [onlyFlag, setOnlyFlag] = useState(false);
  const toast = useToast();
  const W = (id) => WORKERS.find((w) => w.id === id);
  const formOf = (id) => forms.find((x) => x.id === id);
  const subFlags = (s) => { const fm = formOf(s.form); return fm ? fm.fields.filter((q, i) => flagged(q, s.ans[i])) : []; };
  if (editing) return <Builder form={editing} onBack={() => setEditing(null)} onSave={(nf) => setForms((xs) => (xs.some((x) => x.id === nf.id) ? xs.map((x) => (x.id === nf.id ? { ...nf, updated: 'Just now' } : x)) : [{ ...nf, updated: 'Just now' }, ...xs]))} />;
  const subs = SUBS.filter((s) => !onlyFlag || subFlags(s).length);
  const nFlag = SUBS.filter((s) => subFlags(s).length).length;
  const industries = [...new Set(TEMPLATES.map((t) => t.industry))];
  const start = (form) => { setPicking(false); setEditing(form); };
  return (
    <>
      <ScreenHeader title="Forms" phase={2} spec="5.11" actions={<button className="btn" onClick={() => setPicking(true)}><Icon name="plus" size={15} /> New form</button>} />
      <Tabs tabs={[{ id: 'forms', label: 'Forms' }, { id: 'subs', label: 'Submissions' }]} value={tab} onChange={setTab} />

      {tab === 'forms' && (
        <div className="fm2" role="table" aria-label="Forms">
          <div className="fm2-row fm2-rh" role="row"><span>Form</span><span>Comes up</span><span>Filled in by</span><span>This week</span><span>Flagged</span><span>Status</span></div>
          {forms.map((f, i) => (
            <button key={f.id} className="fm2-row" role="row" style={{ '--i': i }} onClick={() => setEditing(f)}>
              <span className="fm2-name"><span className="fm2-ico"><Icon name={TRIGGER_ICON[f.trigger]} size={18} /></span><span><b>{f.name}</b><span>{f.fields.length} questions · edited {f.updated}</span></span></span>
              <span className="fm2-cell"><b>{whenText(f)}</b>{f.block && f.trigger === 'clockin' && <span><span className="sdot warn" />Required to clock in</span>}</span>
              <span className="fm2-cell"><b>{f.who}</b><span>{f.sites === 'all' ? 'All locations' : `${f.sites.length} location`}</span></span>
              <span className="fm2-n">{f.subs}</span>
              <span className="fm2-n">{f.flagged ? <span className="fm2-flag" role="link" tabIndex={0} onClick={(e) => { e.stopPropagation(); setOnlyFlag(true); setTab('subs'); }}><span className="sdot crit" />{f.flagged}</span> : <span className="fm2-zero">0</span>}</span>
              <span className="fm2-st"><span className={'sdot ' + (f.status === 'live' ? 'good' : 'ring')} />{f.status === 'live' ? 'Live' : 'Draft'}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'subs' && (
        <div className="fm2">
          <div className="ma-chips fm2-chips">
            <button className={'ma-chip' + (!onlyFlag ? ' on' : '')} onClick={() => setOnlyFlag(false)}>All · {SUBS.length}</button>
            <button className={'ma-chip' + (onlyFlag ? ' on' : '')} onClick={() => setOnlyFlag(true)}>Flagged · {nFlag}</button>
          </div>
          <div className="sb2-row fm2-rh" role="row"><span>Form</span><span>Sent by</span><span>Location</span><span>When</span><span>Result</span></div>
          {subs.map((s, i) => { const fm = formOf(s.form); const fl = subFlags(s); const w = W(s.w); return (
            <button key={s.id} className="sb2-row" style={{ '--i': i }} onClick={() => setSub(s)}>
              <b className="sb2-form">{fm.name}</b>
              <span className="sb2-who"><span className={'live-face ' + (fl.length ? 'crit' : 'good')}>{initials(w.name)}</span><span><b>{w.name}</b><span>{vendorOf(w.vendor).code} · {s.shift}</span></span></span>
              <span>{siteOf(s.site).name}</span>
              <span className="sb2-when">{s.at}</span>
              <span className="fm2-st"><span className={'sdot ' + (fl.length ? 'crit' : 'good')} />{fl.length ? `${fl.length} flagged` : 'All fine'}</span>
            </button>
          ); })}
          {subs.length === 0 && <p className="fm2-empty">Nothing flagged.</p>}
        </div>
      )}

      <Drawer open={picking} onClose={() => setPicking(false)} title="New form" sub="Start from a template and change anything, or start empty.">
        <div className="tp2">
          <button className="tp2-item blank" onClick={() => start({ id: 'fm' + Date.now(), name: '', desc: '', trigger: 'demand', who: 'Everyone', sites: 'all', status: 'draft', subs: 0, flagged: 0, fields: [] })}>
            <span className="fm2-ico"><Icon name="plus" size={18} /></span><span><b>Start from scratch</b><span>An empty form</span></span>
          </button>
          {industries.map((ind) => (
            <section key={ind} className="tp2-group">
              <h4>{ind}</h4>
              {TEMPLATES.filter((t) => t.industry === ind).map((t) => (
                <button key={t.key} className="tp2-item" onClick={() => start(clone(t, { id: 'fm' + Date.now(), status: 'draft', sites: 'all', subs: 0, flagged: 0 }))}>
                  <span className="fm2-ico"><Icon name={TRIGGER_ICON[t.trigger]} size={18} /></span>
                  <span><b>{t.name}</b><span>{t.desc}</span><small>{t.fields.length} questions · {whenText(t).toLowerCase()}</small></span>
                </button>
              ))}
            </section>
          ))}
        </div>
      </Drawer>

      <Drawer open={!!sub} onClose={() => setSub(null)} title={sub && formOf(sub.form).name} sub={sub && `${W(sub.w).name} · ${siteOf(sub.site).name} · ${sub.at}`}>
        {sub && (() => { const fm = formOf(sub.form); const fl = subFlags(sub); return <>
          <dl className="wfx-kv">
            <dt>Sent by</dt><dd>{W(sub.w).name}<small>{vendorOf(W(sub.w).vendor).name} · {W(sub.w).role}</small></dd>
            <dt>Shift</dt><dd>{sub.shift} at {siteOf(sub.site).name}</dd>
            <dt>Where</dt><dd>Inside the location's geofence<small>24 m from the pin</small></dd>
            {fl.length > 0 && <><dt>Manager</dt><dd><span className="sdot crit" />{MANAGERS.find((m) => m.sites.includes(sub.site)).name} was notified</dd></>}
          </dl>
          <ol className="sb2-answers">{fm.fields.map((q, i) => { const v = sub.ans[i]; const bad = flagged(q, v); return (
            <li key={q.id} className={bad ? 'flag' : ''} style={{ '--i': i }}>
              <span className="sb2-q">{q.label}</span>
              <div className="sb2-v">
                {q.type === 'yesno' && (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '—')}
                {q.type === 'check' && <ul className="sb-checks">{(q.opts || []).map((o) => <li key={o} className={(v || []).includes(o) ? 'is-ok' : 'is-miss'}>{(v || []).includes(o) ? <Icon name="check" size={14} stroke={2.6} /> : <Icon name="x" size={14} stroke={2.4} />} {o}</li>)}</ul>}
                {q.type === 'number' && (v !== undefined ? `${v} ${q.unit || ''}` : '—')}
                {(q.type === 'choice' || q.type === 'text') && (v || <span className="sb2-none">No answer</span>)}
                {q.type === 'photo' && (v ? <span className="sb-photo"><Icon name="camera" size={18} /></span> : <span className="sb2-none">No photo</span>)}
                {q.type === 'signature' && (v ? <svg className="sb-sig" viewBox="0 0 160 40" aria-label="Signature"><path d="M6 30c10-18 18-22 22-12s-4 16 4 8 12-20 18-8 6 14 14 2 10-14 16-4 8 10 18 0 14-6 22 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> : '—')}
              </div>
              {bad && <span className="sb2-flag"><span className="sdot crit" />Flagged: {flagText(q)}</span>}
            </li>
          ); })}</ol>
          <div className="drawer-actions"><button className="btn ghost" onClick={() => go('workforce', { worker: sub.w })}>Open {W(sub.w).name.split(' ')[0]}'s page</button><span className="grow" />{fl.length > 0 && <button className="btn" onClick={() => { toast('Marked as handled'); setSub(null); }}>Mark handled</button>}</div>
        </>; })()}
      </Drawer>
    </>
  );
}
