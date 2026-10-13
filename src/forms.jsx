import { SITES, WORKERS, MANAGERS, siteOf, vendorOf } from './data.js';
import { ScreenHeader, Pill, Tabs, Drawer, Modal, Field, Toggle, Note, useToast, Icon, Select } from './ui.jsx';

const { useState, useMemo } = React;

/* ---------------- Forms ----------------
   A form is a list of questions plus when it comes up (clock-in, clock-out, on a schedule, or whenever needed),
   who fills it, where, and whether it has to be done before clocking in. Answers can flag the manager.
   Every submission is stamped with the worker, their shift and location automatically. */

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

/* ---------- the worker's view, used live in the builder ---------- */
function PhoneForm(props) {
  return (
    <div className="phone fp-phone">
      <div className="phone-status"><span>09:41</span><span>●●● 5G</span></div>
      <div className="phone-screen fp-screen"><FormBody {...props} /></div>
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
  return (
    <div className="fb">
      <div className="fb-bar">
        <button className="btn ghost sm" onClick={onBack}><Icon name="arrowLeft" size={15} /> Forms</button>
        <input className="fb-name" value={f.name} placeholder="Untitled form" onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Form name" />
        <Pill tone={f.status === 'live' ? 'good' : 'warn'}>{f.status === 'live' ? 'Live' : 'Draft'}</Pill>
        <span className="grow" />
        <button className="btn ghost sm" onClick={() => { onSave({ ...f }); toast('Saved'); }}>Save draft</button>
        <button className="btn sm" disabled={!f.name || !f.fields.length} onClick={() => { onSave({ ...f, status: 'live' }); toast(f.status === 'live' ? 'Changes published · the app updates on next open' : 'Published · workers see it ' + whenText(f).toLowerCase()); onBack(); }}>{f.status === 'live' ? 'Publish changes' : 'Publish'}</button>
      </div>
      <div className="fb-grid">
        <div className="fb-left">
          <section className="card fb-when">
            <div className="card-head"><h3>When and who</h3></div>
            <div className="form-grid">
              <Field label="Comes up"><Select className="input" value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value })}>{Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              {f.trigger === 'schedule' ? <Field label="Every"><div className="unit-in"><input className="input" type="number" min="1" max="12" value={f.every || 4} onChange={(e) => setF({ ...f, every: +e.target.value })} /><span>hours on shift</span></div></Field> : null}
              <Field label="Filled in by"><Select className="input" value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })}>{WHO.map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="At"><Select className="input" value={f.sites === 'all' ? 'all' : 'some'} onChange={(e) => setF({ ...f, sites: e.target.value === 'all' ? 'all' : ['s3'] })}><option value="all">All locations</option><option value="some">Chosen locations</option></Select></Field>
            </div>
            {f.trigger === 'clockin' && <Toggle id="fb-block" checked={!!f.block} onChange={(v) => setF({ ...f, block: v })} label="Must be done before they can clock in" />}
            <div className="small muted">Every answer is stamped with who sent it, their shift, location and the time.</div>
          </section>
          <div className="fb-qhead"><h3>Questions <span className="muted">({f.fields.length})</span></h3>{flags > 0 && <span className="small muted"><Icon name="flag" size={12} /> {flags} can flag the manager</span>}</div>
          {f.fields.map((q, i) => { const T = typeOf(q.type); const on = sel === q.id; return (
            <section key={q.id} className={'card fb-q' + (on ? ' on' : '')} onClick={() => setSel(q.id)}>
              <div className="fb-qrow">
                <span className="fb-n">{i + 1}</span>
                <span className="fb-ico"><Icon name={T[2]} size={15} /></span>
                {on ? <input className="input fb-qlabel" autoFocus={!q.label} value={q.label} placeholder="Type the question" onChange={(e) => setQ(q.id, { label: e.target.value })} />
                  : <span className="fb-qtext">{q.label || <span className="muted">Untitled question</span>}<span className="small muted"> · {T[1]}{q.req ? '' : ' · optional'}</span>{q.flag && <span className="fb-flagtag"><Icon name="flag" size={11} /></span>}</span>}
                <span className="fb-qact">
                  <button className="btn ghost sm icon" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(i, -1); }} aria-label="Move up"><Icon name="up" size={14} /></button>
                  <button className="btn ghost sm icon" disabled={i === f.fields.length - 1} onClick={(e) => { e.stopPropagation(); move(i, 1); }} aria-label="Move down"><Icon name="down" size={14} /></button>
                  <button className="btn ghost sm icon" onClick={(e) => { e.stopPropagation(); setF({ ...f, fields: f.fields.filter((x) => x.id !== q.id) }); }} aria-label="Remove question"><Icon name="trash" size={14} /></button>
                </span>
              </div>
              {on && <div className="fb-qedit">
                <div className="form-grid">
                  <Field label="Type"><Select className="input" value={q.type} onChange={(e) => setQ(q.id, { type: e.target.value, flag: undefined, ...(['check', 'choice'].includes(e.target.value) && !q.opts ? { opts: ['Option 1', 'Option 2'] } : {}) })}>{FIELD_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
                  <Field label="Answer"><Select className="input" value={q.req ? 'req' : 'opt'} onChange={(e) => setQ(q.id, { req: e.target.value === 'req' })}><option value="req">Required</option><option value="opt">Optional</option></Select></Field>
                </div>
                {(q.type === 'check' || q.type === 'choice') && <Field label={q.type === 'check' ? 'Items to tick' : 'Options'}>
                  <div className="fb-opts">{(q.opts || []).map((o, k) => (
                    <div key={k} className="fb-opt"><input className="input sm" value={o} onChange={(e) => setQ(q.id, { opts: q.opts.map((x, j) => (j === k ? e.target.value : x)) })} /><button className="btn ghost sm icon" onClick={() => setQ(q.id, { opts: q.opts.filter((_, j) => j !== k) })} aria-label="Remove option"><Icon name="trash" size={13} /></button></div>
                  ))}<button className="linkbtn small" onClick={() => setQ(q.id, { opts: [...(q.opts || []), `Option ${(q.opts || []).length + 1}`] })}>+ Add {q.type === 'check' ? 'item' : 'option'}</button></div>
                </Field>}
                {q.type === 'number' && <div className="form-grid three">
                  <Field label="Unit"><input className="input" value={q.unit || ''} placeholder="°C, km…" onChange={(e) => setQ(q.id, { unit: e.target.value })} /></Field>
                  <Field label="Expected from"><input className="input" type="number" value={q.min ?? ''} onChange={(e) => setQ(q.id, { min: e.target.value === '' ? '' : +e.target.value })} /></Field>
                  <Field label="to"><input className="input" type="number" value={q.max ?? ''} onChange={(e) => setQ(q.id, { max: e.target.value === '' ? '' : +e.target.value })} /></Field>
                </div>}
                {['yesno', 'check', 'number', 'choice'].includes(q.type) && (() => {
                  const opts = q.type === 'yesno' ? [['no', 'the answer is No'], ['yes', 'the answer is Yes']] : q.type === 'check' ? [['unticked', 'anything is left unticked']] : q.type === 'number' ? [['out', 'it is outside the expected range']] : (q.opts || []).map((o) => ['opt:' + o, `they pick "${o}"`]);
                  const cur = !q.flag ? '' : q.flag.when === 'opt' ? 'opt:' + q.flag.value : q.flag.when;
                  return <Field label="Tell the manager when"><Select className="input" value={cur} onChange={(e) => { const v = e.target.value; setQ(q.id, { flag: !v ? undefined : v.startsWith('opt:') ? { when: 'opt', value: v.slice(4) } : { when: v } }); }}><option value="">Never</option>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>;
                })()}
                {q.flag && <div className="small muted fb-flagnote"><Icon name="flag" size={12} /> Raises a notification for the location's manager, with the photo and answers attached.</div>}
              </div>}
            </section>
          ); })}
          {adding ? <section className="card fb-add">
            <div className="small muted">Add a question</div>
            <div className="fb-types">{FIELD_TYPES.map(([k, l, ic]) => <button key={k} className="fb-type" onClick={() => add(k)}><Icon name={ic} size={16} />{l}</button>)}</div>
            <button className="btn ghost sm" onClick={() => setAdding(false)}>Cancel</button>
          </section> : <button className="btn ghost fb-addbtn" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> Add question</button>}
        </div>
        <div className="fb-right">
          <div className="fb-prevhead small"><b>What workers see</b><span className="muted"> · try it, nothing is sent</span>{Object.keys(answers).length > 0 && <button className="linkbtn small" onClick={() => setAnswers({})}>Clear</button>}</div>
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
  const industries = [...new Set(TEMPLATES.map((t) => t.industry))];
  return (
    <>
      <ScreenHeader title="Forms" phase={2} spec="5.11" actions={<button className="btn" onClick={() => setPicking(true)}><Icon name="plus" size={15} /> New form</button>} />
      <Tabs tabs={[{ id: 'forms', label: 'Forms' }, { id: 'subs', label: `Submissions` }]} value={tab} onChange={setTab} />
      {tab === 'forms' && <section className="card flush">
        <div className="table-wrap"><table className="table hover fm-table">
          <thead><tr><th>Form</th><th>Comes up</th><th>Filled in by</th><th className="num">This week</th><th className="num">Flagged</th><th>Status</th></tr></thead>
          <tbody>{forms.map((f) => (
            <tr key={f.id} className="rowlink" tabIndex={0} onClick={() => setEditing(f)} onKeyDown={(e) => e.key === 'Enter' && setEditing(f)}>
              <td><b>{f.name}</b><div className="small muted">{f.fields.length} questions · edited {f.updated}</div></td>
              <td>{whenText(f)}{f.block && f.trigger === 'clockin' && <div className="small fm-block">Required to clock in</div>}</td>
              <td>{f.who}<div className="small muted">{f.sites === 'all' ? 'All locations' : `${f.sites.length} location`}</div></td>
              <td className="num mono">{f.subs}</td>
              <td className="num">{f.flagged ? <button className="linkbtn neg mono" onClick={(e) => { e.stopPropagation(); setOnlyFlag(true); setTab('subs'); }}>{f.flagged}</button> : <span className="muted mono">0</span>}</td>
              <td><Pill tone={f.status === 'live' ? 'good' : 'warn'}>{f.status === 'live' ? 'Live' : 'Draft'}</Pill></td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>}
      {tab === 'subs' && <>
        <div className="toolbar"><label className="wk-rot small"><input type="checkbox" checked={onlyFlag} onChange={(e) => setOnlyFlag(e.target.checked)} /> Only flagged</label></div>
        <section className="card flush"><div className="table-wrap"><table className="table hover">
          <thead><tr><th>Form</th><th>Sent by</th><th>Location</th><th>When</th><th>Result</th></tr></thead>
          <tbody>{subs.map((s) => { const fm = formOf(s.form); const fl = subFlags(s); return (
            <tr key={s.id} className="rowlink" tabIndex={0} onClick={() => setSub(s)} onKeyDown={(e) => e.key === 'Enter' && setSub(s)}>
              <td><b>{fm.name}</b></td>
              <td>{W(s.w).name}<div className="small muted"><span className="vtag">{vendorOf(W(s.w).vendor).code}</span> {s.shift}</div></td>
              <td>{siteOf(s.site).name}</td>
              <td className="small nowrap">{s.at}</td>
              <td>{fl.length ? <Pill tone="crit">{fl.length} flagged</Pill> : <Pill tone="good">All fine</Pill>}</td>
            </tr>
          ); })}{subs.length === 0 && <tr><td colSpan={5} className="small muted">Nothing flagged.</td></tr>}</tbody>
        </table></div></section>
      </>}
      <Modal open={picking} onClose={() => setPicking(false)} title="New form">
        <button className="fm-tpl blank" onClick={() => { setPicking(false); setEditing({ id: 'fm' + Date.now(), name: '', desc: '', trigger: 'demand', who: 'Everyone', sites: 'all', status: 'draft', subs: 0, flagged: 0, fields: [] }); }}><Icon name="plus" size={18} /><div><b>Start from scratch</b><span className="small muted">An empty form</span></div></button>
        {industries.map((ind) => (
          <div key={ind} className="fm-ind">
            <div className="fm-indh small">{ind}</div>
            {TEMPLATES.filter((t) => t.industry === ind).map((t) => (
              <button key={t.key} className="fm-tpl" onClick={() => { setPicking(false); setEditing(clone(t, { id: 'fm' + Date.now(), status: 'draft', sites: 'all', subs: 0, flagged: 0 })); }}>
                <Icon name="document" size={18} /><div><b>{t.name}</b><span className="small muted">{t.desc} · {t.fields.length} questions · {whenText(t).toLowerCase()}</span></div>
              </button>
            ))}
          </div>
        ))}
      </Modal>
      <Drawer open={!!sub} onClose={() => setSub(null)} title={sub && formOf(sub.form).name} sub={sub && `${W(sub.w).name} · ${siteOf(sub.site).name} · ${sub.at}`}>
        {sub && (() => { const fm = formOf(sub.form); const fl = subFlags(sub); return <>
          <dl className="kv">
            <dt>Sent by</dt><dd>{W(sub.w).name} <span className="small muted">· {vendorOf(W(sub.w).vendor).name} · {W(sub.w).role}</span></dd>
            <dt>Shift</dt><dd>{sub.shift} at {siteOf(sub.site).name}</dd>
            <dt>Where</dt><dd>Inside the location's geofence <span className="small muted">· 24 m from the pin</span></dd>
            {fl.length > 0 && <><dt>Manager</dt><dd>{MANAGERS.find((m) => m.sites.includes(sub.site)).name} was notified</dd></>}
          </dl>
          <div className="sb-answers">{fm.fields.map((q, i) => { const v = sub.ans[i]; const bad = flagged(q, v); return (
            <div key={q.id} className={'sb-a' + (bad ? ' flag' : '')}>
              <div className="small muted">{q.label}</div>
              <div className="sb-v">
                {q.type === 'yesno' && (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '—')}
                {q.type === 'check' && <ul className="sb-checks">{(q.opts || []).map((o) => <li key={o} className={(v || []).includes(o) ? 'ok' : 'miss'}>{(v || []).includes(o) ? <Icon name="check" size={13} stroke={2.6} /> : <Icon name="alert" size={13} />} {o}</li>)}</ul>}
                {q.type === 'number' && (v !== undefined ? <span className="mono">{v} {q.unit}</span> : '—')}
                {(q.type === 'choice' || q.type === 'text') && (v || <span className="muted">No answer</span>)}
                {q.type === 'photo' && (v ? <span className="sb-photo"><Icon name="camera" size={18} /></span> : <span className="muted">No photo</span>)}
                {q.type === 'signature' && (v ? <svg className="sb-sig" viewBox="0 0 160 40" aria-label="Signature"><path d="M6 30c10-18 18-22 22-12s-4 16 4 8 12-20 18-8 6 14 14 2 10-14 16-4 8 10 18 0 14-6 22 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> : '—')}
              </div>
              {bad && <div className="small neg"><Icon name="flag" size={12} /> Flagged: {flagText(q)}</div>}
            </div>
          ); })}</div>
          <div className="feed-actions"><button className="btn ghost" onClick={() => go('workforce', { worker: sub.w })}>Open {W(sub.w).name.split(' ')[0]}'s page</button>{fl.length > 0 && <button className="btn" onClick={() => { toast('Marked as handled'); setSub(null); }}>Mark handled</button>}</div>
        </>; })()}
      </Drawer>
    </>
  );
}
