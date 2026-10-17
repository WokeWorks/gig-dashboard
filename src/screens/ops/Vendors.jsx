import { VENDORS } from '../../data.js';
import { ScreenHeader, Drawer, aed, Icon } from '../../ui.jsx';

const { useState } = React;

// Vendors: how the deployed workforce splits across vendors, then one row per vendor where every measure is a value
// with a bar scaled against the others (a dot marks the best). A row opens that vendor's workers; Scorecard opens the drawer.
const TREND = [[80, 82, 81, 84, 85, 86], [82, 80, 81, 78, 79, 79], [78, 76, 75, 73, 74, 72], [89, 90, 90, 91, 90, 91]];
const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

function Ring({ value, size = 64, stroke = 6 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <span className="vd-ring" style={{ width: size, height: size }} role="img" aria-label={`Score ${value} of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ '--c': c }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <b>{value}</b>
    </span>
  );
}

function Trend({ data, w = 140, h = 40, labels }) {
  const lo = Math.min(...data) - 2, hi = Math.max(...data) + 2;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (w - 8) + 4, h - 4 - ((v - lo) / (hi - lo)) * (h - 8)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const up = data[data.length - 1] >= data[0];
  return (
    <span className="vd-trend">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Score ${data[0]} in ${MONTHS[0]} to ${data[data.length - 1]} in ${MONTHS[MONTHS.length - 1]}`}>
        <path d={`${line} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`} className="vd-trend-area" />
        <path d={line} className={'vd-trend-line' + (up ? '' : ' down')} />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" className={'vd-trend-dot' + (up ? '' : ' down')} />
      </svg>
      {labels && <span className="vd-trend-x">{MONTHS.map((m) => <span key={m}>{m}</span>)}</span>}
    </span>
  );
}

export function Vendors({ go }) {
  const [sel, setSel] = useState(null);
  const total = VENDORS.reduce((n, v) => n + v.heads, 0);
  const max = { ttf: Math.max(...VENDORS.map((v) => v.ttf || 0)), noshow: Math.max(...VENDORS.map((v) => v.noshow)) };
  const best = { fill: Math.max(...VENDORS.map((v) => v.fill)), noshow: Math.min(...VENDORS.map((v) => v.noshow)), ttf: Math.min(...VENDORS.filter((v) => v.ttf).map((v) => v.ttf)), score: Math.max(...VENDORS.map((v) => v.score)) };
  const rate = (v) => (v.unit.includes('hour') ? `AED ${v.buy}/h` : aed(v.buy) + '/mo');
  const metric = (val, label, pct, isBest, low) => (
    <span className={'vd-m' + (low ? ' low' : '')}>
      <span className="vd-m-v"><b>{val}</b>{isBest && <span className="vd-best" title={`Best ${label}`}><span className="sdot good" />Best</span>}</span>
      <i className="vd-bar"><i style={{ width: `${Math.max(4, pct)}%` }} /></i>
    </span>
  );

  return (
    <>
      <ScreenHeader title="Vendors" phase={1} spec="8" />

      <section className="vd-split" aria-label="Deployed workers by vendor">
        <div className="vd-split-head"><h2>{total} workers deployed</h2><span>across {VENDORS.length} vendors</span></div>
        <div className="vd-split-bar">{VENDORS.map((v, i) => <i key={v.id} className={'vd-s' + i} style={{ flexGrow: v.heads, '--i': i }} title={`${v.name}: ${v.heads}`} />)}</div>
        <ul className="vd-split-key">{VENDORS.map((v, i) => (
          <li key={v.id}><span className={'vd-key vd-s' + i} /><span className="vtag">{v.code}</span><b>{v.name}</b><span>{v.heads} · {Math.round((v.heads / total) * 100)}%</span></li>
        ))}</ul>
      </section>

      <section className="vd-list" role="table" aria-label="Vendors">
        <div className="vd-row vd-head" role="row"><span>Vendor</span><span>Score</span><span>Fill rate</span><span>No-show rate<small>Lower is better</small></span><span>Time to fill<small>Lower is better</small></span><span>Rate</span><span>Score, 6 months</span><span /></div>
        {VENDORS.map((v, i) => (
          <div key={v.id} className="vd-row" role="row" style={{ '--i': i }}>
            <button className="vd-who" onClick={() => go('workforce', { vendor: v.id })} title={`Show ${v.name}'s workers`}>
              <span className="vtag">{v.code}</span><span><b>{v.name}</b><span>{v.heads} deployed</span></span>
            </button>
            <span className="vd-score"><Ring value={v.score} />{v.score === best.score && <span className="vd-best"><span className="sdot good" />Best</span>}</span>
            {metric(`${v.fill}%`, 'fill rate', v.fill, v.fill === best.fill)}
            {metric(`${v.noshow}%`, 'no-show rate', (v.noshow / max.noshow) * 100, v.noshow === best.noshow, true)}
            {metric(v.ttf ? `${v.ttf} h` : '—', 'time to fill', v.ttf ? (v.ttf / max.ttf) * 100 : 0, v.ttf === best.ttf, true)}
            <span className="vd-rate">{rate(v)}<span>{v.unit.includes('hour') ? 'per hour worked' : 'per head, monthly'}</span></span>
            <Trend data={TREND[i]} />
            <span className="vd-act">
              <button className="btn ghost sm" onClick={() => go('workforce', { vendor: v.id })}><Icon name="users" size={15} />Workers</button>
              <button className="btn sm" onClick={() => setSel({ ...v, i })}>Scorecard</button>
            </span>
          </div>
        ))}
      </section>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name} sub="Vendor scorecard · October 2026">
        {sel && <>
          <div className="vdx-top">
            <Ring value={sel.score} size={104} stroke={9} />
            <div className="vdx-trend"><span>Score, last 6 months</span><Trend data={TREND[sel.i]} w={320} h={70} labels /></div>
          </div>
          <ul className="vdx-kpis">
            {[['Average worker score', sel.score + 2], ['Fill rate', sel.fill], ['Retention at 90 days', sel.retention], ['Document compliance', sel.compliance], ['Attendance', 100 - sel.noshow * 2]].map(([k, val], n) => (
              <li key={k} style={{ '--i': n }}><span>{k}</span><b>{Math.round(val)}%</b><i className="vd-bar"><i style={{ width: `${val}%` }} /></i></li>
            ))}
          </ul>
          <dl className="wfx-kv">
            <dt>Time to fill</dt><dd>{sel.ttf} h</dd>
            <dt>Replacement speed</dt><dd>{Math.round(sel.ttf * 0.8)} h</dd>
            <dt>Contract</dt><dd>{sel.unit}<small>{sel.unit.includes('hour') ? 'Billed on hours worked' : 'Billed on days present ÷ 26'}</small></dd>
            <dt>Portal users</dt><dd>2<small>1 admin, 1 viewer</small></dd>
          </dl>
        </>}
      </Drawer>
    </>
  );
}
