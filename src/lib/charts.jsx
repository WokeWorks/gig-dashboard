// Small charts shared by the client Vendors screen and the vendor portal: a score ring and a score trend.
// CSS: .vd-ring and .vd-trend in style.css.

export function Ring({ value, size = 64, stroke = 6 }) {
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

// A line of scores, teal when it ends better than it started, grey when worse. better='down' for measures where lower
// is better (no-shows, time to fill). months labels the x axis if given.
export function Trend({ data, w = 140, h = 40, months, labels, better = 'up' }) {
  const lo = Math.min(...data) - 2, hi = Math.max(...data) + 2;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (w - 8) + 4, h - 4 - ((v - lo) / (hi - lo)) * (h - 8)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const up = better === 'down' ? data[data.length - 1] <= data[0] : data[data.length - 1] >= data[0];
  const name = (i) => (months ? months[i] : i === 0 ? 'first month' : 'last month');
  return (
    <span className="vd-trend">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Score ${data[0]} in ${name(0)} to ${data[data.length - 1]} in ${name(data.length - 1)}`}>
        <path d={`${line} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`} className="vd-trend-area" />
        <path d={line} className={'vd-trend-line' + (up ? '' : ' down')} />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" className={'vd-trend-dot' + (up ? '' : ' down')} />
      </svg>
      {labels && months && <span className="vd-trend-x">{months.map((m) => <span key={m}>{m}</span>)}</span>}
    </span>
  );
}
