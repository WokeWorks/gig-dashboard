import { VENDORS, FIN_VENDORS, RATE_CARDS, COST_BY_SITE, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Tabs, aed, Note, useToast, Drawer, Field, Select, Icon } from '../../ui.jsx';

const { useState } = React;

// Vendor costs. Period close reads as a sum: gross, minus deductions, is what we pay; then each vendor's statement and,
// beside them, what has to be fixed before the month is issued. Rate cards are grouped by vendor; cost by location is a
// ranked bar chart with the locations that cost more than usual marked.
const minus = (n) => `− ${aed(Math.abs(n))}`;
// How a vendor bills decides how a part month is prorated.
const UNITS = { 'month / head': 'Days present ÷ 26', day: 'Days worked', hour: 'Hours worked' };
const UNIT_LABEL = { 'month / head': 'Monthly, per head', day: 'Daily', hour: 'Hourly' };
const MISSING = { vendor: 'v3', role: 'Shift lead', shifts: 6 }; // the exception: Falcon Crew shift leads have no rate yet
const rateOf = (r) => (r.unit === 'hour' ? <>AED {r.rate}<small>per hour worked</small></> : <>{aed(r.rate)}<small>per {r.unit.replace(' / ', ', per ')}</small></>);

export function Finance({ go }) {
  const [tab, setTab] = useState('close');
  const toast = useToast();
  const [rates, setRates] = useState(RATE_CARDS);
  const [form, setForm] = useState(null);
  const [issued, setIssued] = useState(false);
  const rateFixed = rates.some((r) => r.vendor === MISSING.vendor && r.role === MISSING.role);
  // a new rate starts from how that vendor already bills
  const billing = (vendor) => rates.find((r) => r.vendor === vendor)?.unit || 'month / head';
  const addRate = (pre = {}) => { const vendor = pre.vendor || MISSING.vendor; setForm({ vendor, role: MISSING.role, unit: billing(vendor), rate: '', ot: '1.25×', from: '2026-09-01', ...pre }); };
  const rateErr = form && !(+form.rate > 0) ? 'Enter the rate in AED' : null;
  const saveRate = () => {
    if (rateErr) return setForm({ ...form, tried: true });
    setRates([...rates.filter((r) => !(r.vendor === form.vendor && r.role === form.role)), { vendor: form.vendor, role: form.role, rate: +form.rate, unit: form.unit, ot: form.ot, basis: UNITS[form.unit], from: form.from }]);
    toast(`Rate saved · ${vendorOf(form.vendor).name}, ${form.role.toLowerCase()}`);
    setForm(null);
  };
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const gross = FIN_VENDORS.reduce((a, v) => a + v.buy, 0);
  const pen = FIN_VENDORS.reduce((a, v) => a + v.penalty, 0);
  const net = FIN_VENDORS.reduce((a, v) => a + v.net, 0);
  const maxNet = Math.max(...FIN_VENDORS.map((v) => v.net));

  return (
    <>
      <ScreenHeader title="Vendor costs" phase={2} spec="9" />
      <Tabs tabs={[{ id: 'close', label: 'Period close' }, { id: 'rates', label: 'Rate cards' }, { id: 'sites', label: 'Cost by location' }]} value={tab} onChange={setTab} />

      {tab === 'close' && (
        <div className="vc">
          <div className="vc-main">
            <section className="vc-sum" aria-label="September 2026 totals">
              <div className="vc-net">
                <span>Net payable · September 2026, ex-VAT</span>
                <b>{aed(net)}</b>
                <span className="vc-trend">+2.1% on August</span>
              </div>
              {/* gross is the whole bar; the deductions are carved off its end, what's left is what we pay */}
              <div className="vc-bridge" aria-hidden="true">
                <i className="vc-b-net" style={{ flexGrow: net }} />
                <i className="vc-b-ded" style={{ flexGrow: -pen }} />
              </div>
              <dl className="vc-eq">
                <div><dt>Gross payable</dt><dd>{aed(gross)}</dd></div>
                <span className="vc-op" aria-hidden="true">−</span>
                <div><dt><span className="sdot crit" />No-show deductions</dt><dd>{aed(-pen)}<small>Per vendor contract</small></dd></div>
                <span className="vc-op" aria-hidden="true">=</span>
                <div><dt><span className="sdot good" />Net payable</dt><dd>{aed(net)}</dd></div>
              </dl>
            </section>

            <section className="vc-list" aria-label="Vendor statements">
              <h3 className="vc-h">Vendor statements</h3>
              <div className="vc-row vc-rh" aria-hidden="true"><span>Vendor</span><span>Basis</span><span>Gross</span><span>Deductions</span><span>Net</span><span>Status</span></div>
              {FIN_VENDORS.map((v, i) => {
                const vd = vendorOf(v.v), done = issued || i === 3;
                return (
                  <div key={v.v} className="vc-row" style={{ '--i': i }}>
                    <span className="vc-who"><span className="vtag">{vd.code}</span><span><b>{vd.name}</b><span>{v.heads} heads</span></span></span>
                    <span className="vc-basis">{v.days ? `${v.days} days` : `${v.hours.toLocaleString()} h`}<small>{v.days ? 'Days present' : 'Hours worked'}</small></span>
                    <span className="vc-n">{aed(v.buy)}</span>
                    <span className="vc-n">{v.penalty ? minus(v.penalty) : 'None'}</span>
                    <span className="vc-netc"><b>{aed(v.net)}</b><i className="vd-bar"><i style={{ width: `${(v.net / maxNet) * 100}%` }} /></i></span>
                    <span className="vc-st"><span className={'sdot ' + (done ? 'good' : 'ring')} />{done ? 'Issued' : 'Draft'}</span>
                  </div>
                );
              })}
            </section>
          </div>

          <aside className="vc-side" aria-label="Before you issue">
            <div className="vc-side-head">
              <h3>Before you issue</h3>
              <span>{rateFixed ? 'Nothing left to fix' : '1 thing to fix'}</span>
            </div>
            <ol className="vc-fix">
              <li className={rateFixed ? 'done' : ''}>
                <span className={'vc-ic ' + (rateFixed ? 'good' : 'crit')}><Icon name={rateFixed ? 'check' : 'alert'} size={18} /></span>
                <div>
                  <span className="vc-tag">{rateFixed ? 'Fixed' : 'Must fix'}</span>
                  <b>{rateFixed ? 'Shift lead rate added for Falcon Crew' : 'Missing rate'}</b>
                  <p>{rateFixed ? `${MISSING.shifts} shifts now have a price` : `${MISSING.shifts} shifts by Falcon Crew shift leads have no rate card, so they can't be priced`}</p>
                  {!rateFixed && <button className="btn sm" onClick={() => addRate()}><Icon name="plus" size={16} />Add rate</button>}
                </div>
              </li>
              <li>
                <span className="vc-ic warn"><Icon name="clock" size={18} /></span>
                <div>
                  <span className="vc-tag">Worth a look</span>
                  <b>Overtime at Carrefour Barsha Heights</b>
                  <p>Overtime is 14% of its cost, about twice the other locations</p>
                  <button className="btn sm ghost" onClick={() => setTab('sites')}>See locations</button>
                </div>
              </li>
            </ol>
            <div className="vc-issue">
              {issued
                ? <p className="vc-issued"><Icon name="check" size={18} />Statements issued. September timesheets are locked.</p>
                : <>
                  <p><Icon name="document" size={18} />Issuing statements closes the month: every worker's timesheet for the period locks.</p>
                  <button className="btn" disabled={!rateFixed} onClick={() => { setIssued(true); toast('Statements issued · September timesheets locked'); }}>Issue statements</button>
                  {!rateFixed && <span className="vc-why">Add the missing rate first</span>}
                </>}
            </div>
          </aside>
        </div>
      )}

      {tab === 'rates' && (
        <div className="vc-rates">
          <div className="vc-rates-head">
            <p>What each vendor charges for each role. Statements are priced from these rates.</p>
            <button className="btn" onClick={() => addRate({ rate: '', vendor: 'v1', role: 'Picker' })}><Icon name="plus" size={16} />Add rate</button>
          </div>
          <div className="vc-rcols">
            {VENDORS.map((v, gi) => {
              const mine = rates.filter((r) => r.vendor === v.id);
              const gap = !rateFixed && v.id === MISSING.vendor;
              return (
                <section key={v.id} className="vc-rcol" style={{ '--i': gi }}>
                  <h3><span className="vtag">{v.code}</span>{v.name}</h3>
                  <span className="vc-rbill">{UNIT_LABEL[mine[0]?.unit] || ''}</span>
                  {mine.map((r) => (
                    <div key={r.role} className="vc-rate">
                      <span className="vc-role">{r.role}</span>
                      <b>{rateOf(r)}</b>
                      <dl><div><dt>Overtime</dt><dd>{r.ot}</dd></div><div><dt>Part month</dt><dd>{r.basis}</dd></div>{r.from && <div><dt>From</dt><dd>{new Date(r.from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>}</dl>
                    </div>
                  ))}
                  {gap && (
                    <div className="vc-rate vc-gap">
                      <span className="vc-role"><span className="sdot crit" />{MISSING.role}</span>
                      <p>No rate yet. {MISSING.shifts} shifts are waiting to be priced.</p>
                      <button className="btn sm" onClick={() => addRate()}><Icon name="plus" size={16} />Add rate</button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <ul className="vc-how">
            <li><b>Three ways to bill</b><span>Each vendor charges its own way: monthly per head, daily or hourly.</span></li>
            <li><b>Overtime only when worked</b><span>Optional overtime hours (the "+1") are paid at the overtime rate only when worked.</span></li>
            <li><b>Rates are dated</b><span>A mid-month change splits the period, each part at its own rate.</span></li>
          </ul>
        </div>
      )}

      {tab === 'sites' && (() => {
        const rows = [...COST_BY_SITE].sort((a, b) => b.cost - a.cost);
        const T = rows.reduce((a, c) => ({ days: a.days + c.days, cost: a.cost + c.cost, otc: a.otc + c.cost * c.ot, cover: a.cover + c.cover }), { days: 0, cost: 0, otc: 0, cover: 0 });
        const avgDay = T.cost / T.days, max = rows[0].cost;
        const open = (site) => go('workforce', { site });
        return (
          <div className="vc-sites">
            <div className="vc-sites-head">
              <div><h3 className="vc-h">September 2026</h3><span>Vendor charges, split by where each shift was worked</span></div>
              <dl className="vc-tot">
                <div><dt>All locations</dt><dd>{aed(T.cost)}</dd></div>
                <div><dt>Days worked</dt><dd>{T.days.toLocaleString()}</dd></div>
                <div><dt>Cost per day</dt><dd>{aed(Math.round(avgDay))}</dd></div>
                <div><dt>Overtime</dt><dd>{Math.round((T.otc / T.cost) * 100)}%</dd></div>
                <div><dt>Cover days</dt><dd>{T.cover}</dd></div>
              </dl>
            </div>
            <div className="vc-srow vc-rh" aria-hidden="true"><span>Location</span><span>Cost</span><span>Cost per day</span><span>Overtime</span><span>Cover days</span></div>
            {rows.map((c, i) => {
              const pd = c.cost / c.days, hiDay = pd > avgDay * 1.05, hiOt = c.ot >= 0.1;
              return (
                <button key={c.site} className="vc-srow" style={{ '--i': i }} title={`Show who works at ${siteOf(c.site).name}`} onClick={() => open(c.site)}>
                  <span className="vc-sname"><b>{siteOf(c.site).name}</b><span>{c.days} days worked</span></span>
                  <span className="vc-sbar"><i style={{ width: `${(c.cost / max) * 100}%` }} /><b>{aed(c.cost)}</b></span>
                  <span className="vc-flag">{hiDay && <span className="sdot crit" />}{aed(Math.round(pd))}</span>
                  <span className="vc-flag">{hiOt && <span className="sdot crit" />}{Math.round(c.ot * 100)}%</span>
                  <span>{c.cover}</span>
                </button>
              );
            })}
            <p className="vc-key"><span className="sdot crit" />Cost per day 5% above average, or overtime at 10% or more. Overtime is the share of cost paid at the overtime rate. Cover days are days worked by someone covering for an absent worker.</p>
          </div>
        );
      })()}

      <Drawer open={!!form} onClose={() => setForm(null)} title="Add a rate" sub="What the vendor charges for this role. Statements from the date below use it.">
        {form && <>
          <div className="wfa-grid">
            <Field label="Vendor"><Select className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value, unit: billing(e.target.value) })}>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
            <Field label="Role"><Select className="input" value={form.role} onChange={setF('role')}><option>Picker</option><option>Shift lead</option></Select></Field>
            <Field label="Billed"><Select className="input" value={form.unit} onChange={setF('unit')}>{Object.keys(UNITS).map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</Select><span className="wfa-hint">Part months: {UNITS[form.unit].toLowerCase()}</span></Field>
            <Field label={form.unit === 'hour' ? 'Rate per hour (AED)' : form.unit === 'day' ? 'Rate per day (AED)' : 'Rate per head, monthly (AED)'}><input className={'input' + (form.tried && rateErr ? ' bad' : '')} inputMode="decimal" value={form.rate} onChange={setF('rate')} placeholder={form.unit === 'hour' ? '13' : '3,400'} autoFocus />{form.tried && rateErr && <span className="wfa-err">{rateErr}</span>}</Field>
            <Field label="Overtime"><Select className="input" value={form.ot} onChange={setF('ot')}><option>1.25×</option><option>Flat</option></Select><span className="wfa-hint">Paid only on overtime hours worked</span></Field>
            <Field label="Applies from"><input type="date" className="input" value={form.from} onChange={setF('from')} /></Field>
          </div>
          {rates.some((r) => r.vendor === form.vendor && r.role === form.role) && <Note>{vendorOf(form.vendor).name} already has a {form.role.toLowerCase()} rate. Saving replaces it from the date above.</Note>}
          <div className="drawer-actions"><button className="btn ghost" onClick={() => setForm(null)}>Cancel</button><span className="grow" /><button className="btn" onClick={saveRate}>Save rate</button></div>
        </>}
      </Drawer>
    </>
  );
}
