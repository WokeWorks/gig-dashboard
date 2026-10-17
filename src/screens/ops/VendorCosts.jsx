import { FIN_VENDORS, RATE_CARDS, COST_BY_SITE, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Tabs, aed, Note, useToast } from '../../ui.jsx';

const { useState } = React;

// Vendor costs. Period close reads as a sum: gross, minus deductions, is what we pay; then each vendor's statement and,
// beside them, what has to be fixed before the month is issued. Rate cards are grouped by vendor; cost by location is a
// ranked bar chart with the locations that cost more than usual marked.
const minus = (n) => `− ${aed(Math.abs(n))}`;
const rateOf = (r) => (r.unit === 'hour' ? <>AED {r.rate}<small>per hour worked</small></> : <>{aed(r.rate)}<small>per {r.unit.replace(' / ', ', per ')}</small></>);

export function Finance({ go }) {
  const [tab, setTab] = useState('close');
  const toast = useToast();
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
                const vd = vendorOf(v.v), issued = i === 3;
                return (
                  <div key={v.v} className="vc-row" style={{ '--i': i }}>
                    <span className="vc-who"><span className="vtag">{vd.code}</span><span><b>{vd.name}</b><span>{v.heads} heads</span></span></span>
                    <span className="vc-basis">{v.days ? `${v.days} days` : `${v.hours.toLocaleString()} h`}<small>{v.days ? 'Days present' : 'Hours worked'}</small></span>
                    <span className="vc-n">{aed(v.buy)}</span>
                    <span className="vc-n muted">{v.penalty ? minus(v.penalty) : 'None'}</span>
                    <span className="vc-netc"><b>{aed(v.net)}</b><i className="vd-bar"><i style={{ width: `${(v.net / maxNet) * 100}%` }} /></i></span>
                    <span className="vc-st"><span className={'sdot ' + (issued ? 'good' : 'ring')} />{issued ? 'Issued' : 'Draft'}</span>
                  </div>
                );
              })}
            </section>
          </div>

          <aside className="vc-side" aria-label="Before you issue">
            <h3 className="vc-h">Before you issue<span>2 to fix</span></h3>
            <ol className="vc-fix">
              <li style={{ '--i': 0 }}>
                <span className="vc-fix-k"><span className="sdot crit" />Missing rate</span>
                <p><b>6 shifts</b> · Shift lead from Falcon Crew has no rate card</p>
                <button className="btn sm ghost" onClick={() => setTab('rates')}>Add rate</button>
              </li>
              <li style={{ '--i': 1 }}>
                <span className="vc-fix-k"><span className="sdot warn" />Overtime</span>
                <p><b>Carrefour Barsha Heights</b>: overtime is 14% of its cost, about twice the other locations</p>
                <button className="btn sm ghost" onClick={() => setTab('sites')}>See locations</button>
              </li>
            </ol>
            <div className="vc-issue">
              <p>Issuing statements closes the month: every worker's timesheet for the period locks.</p>
              <button className="btn" onClick={() => toast('Statements issued · September timesheets locked')}>Issue statements</button>
            </div>
          </aside>
        </div>
      )}

      {tab === 'rates' && (
        <div className="vc-rates">
          <div className="vc-rrow vc-rh" aria-hidden="true"><span>Role</span><span>Rate</span><span>Overtime</span><span>Proration</span></div>
          {[...new Set(RATE_CARDS.map((r) => r.vendor))].map((id, gi) => (
            <section key={id} className="vc-rg" style={{ '--i': gi }}>
              <h3 className="vc-rg-h"><span className="vtag">{vendorOf(id).code}</span>{vendorOf(id).name}</h3>
              {RATE_CARDS.filter((r) => r.vendor === id).map((r) => (
                <div key={r.role} className="vc-rrow">
                  <span>{r.role}</span><b>{rateOf(r)}</b><span>{r.ot}</span><span className="muted">{r.basis}</span>
                </div>
              ))}
            </section>
          ))}
          <Note>Each vendor charges its own way: monthly per head, daily or hourly. Optional overtime hours (the "+1") are paid at the overtime rate only when worked. Rates are dated, so a mid-month change splits the period.</Note>
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
    </>
  );
}
