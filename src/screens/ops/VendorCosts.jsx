import { FIN_VENDORS, RATE_CARDS, COST_BY_SITE, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Stat, Pill, Tabs, aed, Note, useToast } from '../../ui.jsx';

const { useState } = React;

export function Finance({ go }) {
  const [tab, setTab] = useState('close');
  const toast = useToast();
  const gross = FIN_VENDORS.reduce((a, v) => a + v.buy, 0);
  const pen = FIN_VENDORS.reduce((a, v) => a + v.penalty, 0);
  const net = FIN_VENDORS.reduce((a, v) => a + v.net, 0);
  return (
    <>
      <ScreenHeader title="Vendor costs" phase={2} spec="9" desc="What you owe each vendor, priced from approved timesheets and each vendor's rate card." />
      <Tabs tabs={[{ id: 'close', label: 'Period close' }, { id: 'rates', label: 'Rate cards' }, { id: 'sites', label: 'Cost by location' }]} value={tab} onChange={setTab} />
      {tab === 'close' && <>
        <div className="stats">
          <Stat label="Gross payable" value={aed(gross)} sub="September 2026, ex-VAT" />
          <Stat label="No-show deductions" value={aed(pen)} sub="Per vendor contract" />
          <Stat label="Net payable" value={aed(net)} sub="+2.1% on August" tone="good" />
          <Stat label="Exceptions" value="2" sub="Fix before issuing" tone="warn" />
        </div>
        <section className="card flush">
          <div className="card-head pad"><h3>Vendor statements</h3></div>
          <div className="table-wrap"><table className="table"><thead><tr><th>Vendor</th><th className="num">Heads</th><th className="num">Basis</th><th className="num">Gross</th><th className="num">Deductions</th><th className="num">Net</th><th>Status</th></tr></thead>
            <tbody>{FIN_VENDORS.map((v, i) => <tr key={v.v}><td><span className="vtag">{vendorOf(v.v).code}</span> {vendorOf(v.v).name}</td><td className="num mono">{v.heads}</td><td className="num mono small">{v.days ? v.days + ' days' : v.hours.toLocaleString() + ' h'}</td><td className="num mono">{aed(v.buy)}</td><td className="num mono neg">{v.penalty ? aed(v.penalty) : '—'}</td><td className="num mono"><b>{aed(v.net)}</b></td><td>{i === 3 ? <Pill tone="good">Issued</Pill> : <Pill tone="info">Draft</Pill>}</td></tr>)}</tbody></table></div>
        </section>
        <section className="card">
          <div className="card-head"><h3>Exceptions</h3></div>
          <div className="row-line"><Pill tone="crit">Missing rate</Pill><span className="small">6 shifts · Shift lead from Falcon Crew has no rate card</span><button className="btn sm ghost" onClick={() => setTab('rates')}>Add rate</button></div>
          <div className="row-line"><Pill tone="warn">Overtime</Pill><span className="small">Carrefour Barsha Heights: overtime is 14% of its cost, about twice the other locations</span><button className="btn sm ghost" onClick={() => setTab('sites')}>See locations</button></div>
          <div className="small muted">Issuing statements closes the month: every worker's timesheet for the period locks.</div>
          <div className="feed-actions"><button className="btn" onClick={() => toast('Statements issued · September timesheets locked')}>Issue statements</button></div>
        </section>
      </>}
      {tab === 'rates' && <section className="card flush"><div className="table-wrap"><table className="table"><thead><tr><th>Vendor</th><th>Role</th><th className="num">Rate</th><th>Overtime</th><th>Proration</th></tr></thead>
        <tbody>{RATE_CARDS.map((r, i) => <tr key={i}><td><span className="vtag">{vendorOf(r.vendor).code}</span> {vendorOf(r.vendor).name}</td><td>{r.role}</td><td className="num mono">{r.unit === 'hour' ? `AED ${r.rate}/h` : aed(r.rate) + ' / ' + r.unit}</td><td>{r.ot}</td><td className="small">{r.basis}</td></tr>)}</tbody></table></div>
        <div className="pad"><Note>Each vendor charges its own way: monthly per head, daily or hourly. Optional overtime hours (the "+1") are paid at the overtime rate only when worked. Rates are dated, so a mid-month change splits the period.</Note></div></section>}
      {tab === 'sites' && (() => { const rows = [...COST_BY_SITE].sort((a, b) => b.cost - a.cost); const T = rows.reduce((a, c) => ({ days: a.days + c.days, cost: a.cost + c.cost, otc: a.otc + c.cost * c.ot, cover: a.cover + c.cover }), { days: 0, cost: 0, otc: 0, cover: 0 }); const avgDay = T.cost / T.days; return (
        <section className="card flush">
          <div className="card-head pad"><h3>September 2026</h3><span className="small muted">Vendor charges, split by where each shift was worked</span></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Location</th><th className="num">Days worked</th><th className="num">Cost</th><th className="num">Cost per day</th><th className="num">Overtime</th><th className="num">Cover days</th></tr></thead>
            <tbody>{rows.map((c) => { const pd = c.cost / c.days; return (
              <tr key={c.site} className="rowlink" tabIndex={0} title={`Show who works at ${siteOf(c.site).name}`} onClick={() => go('workforce', { site: c.site })} onKeyDown={(e) => e.key === 'Enter' && go('workforce', { site: c.site })}>
                <td>{siteOf(c.site).name}</td>
                <td className="num mono">{c.days}</td>
                <td className="num mono">{aed(c.cost)}</td>
                <td className={'num mono' + (pd > avgDay * 1.05 ? ' neg' : '')}>{aed(Math.round(pd))}</td>
                <td className={'num mono' + (c.ot >= 0.1 ? ' neg' : '')}>{Math.round(c.ot * 100)}%</td>
                <td className="num mono">{c.cover}</td>
              </tr>
            ); })}
              <tr className="tot"><td><b>All locations</b></td><td className="num mono"><b>{T.days.toLocaleString()}</b></td><td className="num mono"><b>{aed(T.cost)}</b></td><td className="num mono"><b>{aed(Math.round(avgDay))}</b></td><td className="num mono"><b>{Math.round((T.otc / T.cost) * 100)}%</b></td><td className="num mono"><b>{T.cover}</b></td></tr>
            </tbody>
          </table></div>
          <div className="pad small muted">Overtime is the share of cost paid at the overtime rate. Cover days are days worked by someone covering for an absent worker. Red marks cost per day 5% above average, or overtime at 10% or more.</div>
        </section>
      ); })()}
    </>
  );
}
