import { VENDORS } from '../../data.js';
import { ScreenHeader, Drawer, Bar, Spark, aed } from '../../ui.jsx';

const { useState } = React;

export function Vendors({ go }) {
  const [sel, setSel] = useState(null);
  return (
    <>
      <ScreenHeader title="Vendors" phase={1} spec="8" />
      <section className="card flush">
        <div className="table-wrap">
          <table className="table hover">
            <thead><tr><th>Vendor</th><th className="num">Deployed</th><th className="num">Score</th><th className="num">Fill rate</th><th className="num">No-show rate</th><th className="num">Time to fill</th><th>Rate</th><th>Trend</th><th></th></tr></thead>
            <tbody>
              {VENDORS.map((v, i) => (
                <tr key={v.id} onClick={() => go('workforce', { vendor: v.id })} tabIndex={0} title={`Show ${v.name}'s workers`}>
                  <td><span className="vtag">{v.code}</span> <b>{v.name}</b></td>
                  <td className="num mono">{v.heads}</td>
                  <td className="num mono"><b>{v.score}</b></td>
                  <td className="num mono">{v.fill}%</td>
                  <td className="num mono">{v.noshow}%</td>
                  <td className="num mono">{v.ttf ? v.ttf + ' h' : '—'}</td>
                  <td className="mono small">{v.unit.includes('hour') ? `AED ${v.buy}/h` : aed(v.buy) + '/mo'}</td>
                  <td><Spark data={[[80, 82, 81, 84, 85, 86], [82, 80, 81, 78, 79, 79], [78, 76, 75, 73, 74, 72], [89, 90, 90, 91, 90, 91]][i]} /></td>
                  <td><button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); setSel(v); }}>Scorecard</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name} sub="Vendor scorecard · October 2026">
        {sel && <>
          <div className="bigscore"><span className="mono">{sel.score}</span><span className="muted">vendor score</span></div>
          {[['Average worker score', sel.score + 2], ['Fill rate', sel.fill], ['Retention at 90 days', sel.retention], ['Document compliance', sel.compliance], ['Attendance', 100 - sel.noshow * 2]].map(([k, v]) => <div key={k} className="kpi-row"><span>{k}</span><span className="mono small">{Math.round(v)}%</span><Bar value={v} /></div>)}
          <dl className="kv"><dt>Time to fill</dt><dd className="mono">{sel.ttf} h</dd><dt>Replacement speed</dt><dd className="mono">{Math.round(sel.ttf * 0.8)} h</dd><dt>Contract</dt><dd>{sel.unit}, {sel.unit.includes('hour') ? 'hours worked' : 'days present ÷ 26'}</dd><dt>Portal users</dt><dd>2 (1 admin, 1 viewer)</dd></dl>
        </>}
      </Drawer>
    </>
  );
}
