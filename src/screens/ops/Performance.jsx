import { scopedWorkers } from '../../lib/scope.js';
import { VENDORS, WORKERS, METRICS, WORKER_METRICS, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Stat, Pill, Tabs, Drawer, Bar, Avatar, Note, Select } from '../../ui.jsx';

const { useState } = React;

export const fmtM = (m, v) => (m.step < 1 ? (+v).toFixed(m.step < 0.5 ? 1 : 1) : Math.round(v)) + m.unit;

export const fails = (m, v, th) => (m.dir === 'higher' ? v < th : v > th);

export function StripPlot({ m, th, values }) {
  const PEOPLE = scopedWorkers();
  const W = 280, H = 78, padX = 8, base = 58;
  const span = m.max - m.min;
  const discrete = m.step >= 1 && span / m.step <= 20;
  const bins = discrete ? Math.round(span / m.step) + 1 : 18;
  const binOf = (v) => discrete ? Math.min(bins - 1, Math.max(0, Math.round((v - m.min) / m.step))) : Math.min(bins - 1, Math.max(0, Math.floor(((v - m.min) / span) * bins)));
  const cols = Array.from({ length: bins }, () => []);
  [...values].sort((a, b) => a[1] - b[1]).forEach(([id, v]) => cols[binOf(v)].push([id, v]));
  const cw = (W - 2 * padX) / bins;
  const maxCount = Math.max(1, ...cols.map((c) => c.length));
  let r = 3.1, d = 7, perRow = 1;
  for (let k = 0; k < 8; k++) {
    const maxRows = Math.max(1, Math.floor((base - 4) / d));
    perRow = Math.max(1, Math.ceil(maxCount / maxRows));
    if (perRow * d <= cw - 1) break;
    r *= 0.85; d *= 0.85;
  }
  const cx0 = (bi) => padX + cw * bi + cw / 2;
  const dotX = (bi, k) => { const n = Math.min(perRow, cols[bi].length); const col = k % perRow; return cx0(bi) + (col - (n - 1) / 2) * d; };
  const dotY = (k) => base - 3 - Math.floor(k / perRow) * d;
  const x = (v) => discrete ? cx0(Math.round((Math.min(m.max, Math.max(m.min, v)) - m.min) / m.step)) : padX + ((Math.min(m.max, Math.max(m.min, v)) - m.min) / span) * (W - 2 * padX);
  const tx = discrete ? x(th) + (m.dir === 'higher' ? -cw / 2 : cw / 2) : x(th);
  const fmt = (v) => fmtM(m, v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="strip" aria-label={`${m.name}: distribution of ${values.length} workers, threshold ${fmt(th)}`}>
      <rect x={m.dir === 'higher' ? padX : tx} y="2" width={Math.max(0, m.dir === 'higher' ? tx - padX : W - padX - tx)} height={base - 1} className="strip-zone" rx="4" />
      <line x1={padX} x2={W - padX} y1={base + 1} y2={base + 1} className="strip-axis" />
      {cols.map((c, bi) => c.map(([id, v], k) => {
        const w = PEOPLE.find((q) => q.id === id);
        return <circle key={id} cx={dotX(bi, k)} cy={dotY(k)} r={r} className={fails(m, v, th) ? 'strip-dot bad' : 'strip-dot'}><title>{`${w.name}: ${fmt(v)}`}</title></circle>;
      }))}
      <line x1={tx} x2={tx} y1="0" y2={base + 4} className="strip-th" />
      <text x={discrete ? x(m.min) : padX} y={H - 4} textAnchor={discrete ? "middle" : "start"} className="strip-tick">{fmt(m.min)}</text>
      <text x={discrete ? x(m.max) : W - padX} y={H - 4} textAnchor={discrete ? "middle" : "end"} className="strip-tick">{fmt(m.max)}</text>
      <text x={Math.min(W - 30, Math.max(30, discrete ? x(th) : tx))} y={H - 4} textAnchor="middle" className="strip-thlabel">{fmt(th)}</text>
    </svg>
  );
}

export function Performance() {
  const PEOPLE = scopedWorkers();
  const [tab, setTab] = useState('th');
  const [th, setTh] = useState(Object.fromEntries(METRICS.map((m) => [m.id, m.def])));
  const [sel, setSel] = useState('att');
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState('all');
  const [open, setOpen] = useState(null);
  const [weights, setWeights] = useState(Object.fromEntries(METRICS.map((m) => [m.id, m.weight])));
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const vals = (id) => PEOPLE.map((w) => [w.id, WORKER_METRICS[w.id][id]]);
  const flaggedOn = (w) => METRICS.filter((m) => fails(m, WORKER_METRICS[w.id][m.id], th[m.id]));
  const anyFlag = PEOPLE.filter((w) => flaggedOn(w).length > 0).length;
  const multi = PEOPLE.filter((w) => flaggedOn(w).length > 1).length;
  const m = METRICS.find((x) => x.id === sel);
  const rows = PEOPLE
    .filter((w) => showAll || fails(m, WORKER_METRICS[w.id][m.id], th[m.id]))
    .filter((w) => (vendor === 'all' || w.vendor === vendor) && (w.name + w.code).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (m.dir === 'higher' ? 1 : -1) * (WORKER_METRICS[a.id][m.id] - WORKER_METRICS[b.id][m.id]));
  const word = (mm) => (mm.dir === 'higher' ? 'below' : 'above');
  return (
    <>
      <ScreenHeader title="Performance" phase={2} spec="8" />
      <Tabs tabs={[{ id: 'th', label: 'Thresholds' }, { id: 'w', label: 'Score weights' }]} value={tab} onChange={setTab} />
      {tab === 'th' && <>
        <div className="stats">
          <Stat label="Workers tracked" value={PEOPLE.length} sub="Deliveroo pickers · October" />
          <Stat label="Flagged on any metric" value={anyFlag} sub={`${Math.round((anyFlag / PEOPLE.length) * 100)}% of workers`} tone="warn" />
          <Stat label="Flagged on 2 or more" value={multi} sub="Worth a conversation" tone="crit" />
        </div>
        <div className="metric-grid">
          {METRICS.map((mm) => {
            const n = PEOPLE.filter((w) => fails(mm, WORKER_METRICS[w.id][mm.id], th[mm.id])).length;
            return (
              <section key={mm.id} className={'card metric' + (sel === mm.id ? ' on' : '')} onClick={() => { setSel(mm.id); setShowAll(false); }}>
                <div className="metric-top">
                  <div><b>{mm.name}</b><div className="small muted">{mm.src}</div></div>
                  <div className={'metric-count' + (n ? ' bad' : '')}><span className="mono">{n}</span><small>{n === 1 ? 'worker' : 'workers'}</small></div>
                </div>
                <StripPlot m={mm} th={th[mm.id]} values={vals(mm.id)} />
                <label className="metric-slider" onClick={(e) => e.stopPropagation()}>
                  <span className="small">Flag {word(mm)} <b className="mono">{fmtM(mm, th[mm.id])}</b></span>
                  <input id={'th-' + mm.id} type="range" min={mm.min} max={mm.max} step={mm.step} value={th[mm.id]} onChange={(e) => { setTh({ ...th, [mm.id]: +e.target.value }); setSel(mm.id); }} aria-label={`${mm.name} threshold`} />
                </label>
              </section>
            );
          })}
        </div>
        <section className="card flush">
          <div className="list-head">
            <div><h3>{showAll ? `All workers by ${m.name.toLowerCase()}` : `${rows.length} ${rows.length === 1 ? 'worker' : 'workers'} ${word(m)} ${fmtM(m, th[m.id])} on ${m.name.toLowerCase()}`}</h3><div className="small muted">Worst first · {m.desc}</div></div>
            <div className="toolbar">
              <input id="pf-q" className="input sm" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
              <Select id="pf-v" className="input sm" value={vendor} onChange={(e) => setVendor(e.target.value)}><option value="all">All vendors</option>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>
              <div className="seg"><button className={!showAll ? 'on' : ''} onClick={() => setShowAll(false)}>Flagged</button><button className={showAll ? 'on' : ''} onClick={() => setShowAll(true)}>Everyone</button></div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table hover">
              <thead><tr><th>Worker</th><th>Vendor</th><th>Location</th><th className="num">{m.name}</th><th>Gap to line</th><th>Also flagged on</th></tr></thead>
              <tbody>
                {rows.map((w) => {
                  const v = WORKER_METRICS[w.id][m.id];
                  const bad = fails(m, v, th[m.id]);
                  const gap = m.dir === 'higher' ? v - th[m.id] : th[m.id] - v;
                  const others = flaggedOn(w).filter((x) => x.id !== m.id);
                  return (
                    <tr key={w.id} onClick={() => setOpen(w)} tabIndex={0}>
                      <td><div className="who"><Avatar name={w.name} /><div><b>{w.name}</b><div className="small muted mono">{w.code}</div></div></div></td>
                      <td><span className="vtag">{vendorOf(w.vendor).code}</span></td>
                      <td>{siteOf(w.site).name}</td>
                      <td className={'num mono ' + (bad ? 'neg' : '')}><b>{fmtM(m, v)}</b></td>
                      <td style={{ minWidth: 120 }}><div className={'gap ' + (bad ? 'bad' : 'ok')}><span style={{ width: Math.min(100, (Math.abs(gap) / ((m.max - m.min) / 3)) * 100) + '%' }} /></div><span className="small muted mono">{gap >= 0 ? '+' : '−'}{fmtM(m, Math.abs(gap))}</span></td>
                      <td>{others.length ? <div className="chips">{others.map((o) => <span key={o.id} className="chip warnchip">{o.name}</span>)}</div> : <span className="muted">—</span>}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan="6" className="muted" style={{ textAlign: 'center', padding: 24 }}>Nobody falls {word(m)} this line. Move the slider to tighten it.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>}
      {tab === 'w' && <div className="grid-2">
        <section className="card">
          <div className="card-head"><h3>Score weights · Deliveroo pickers</h3><span className={'mono small ' + (total === 100 ? 'ok' : 'bad')}>{total}%</span></div>
          {METRICS.map((k) => (
            <div key={k.id} className="weight">
              <div className="feed-top"><span>{k.name}</span><span className="mono small">{weights[k.id]}%</span></div>
              <input id={'w-' + k.id} type="range" min="0" max="50" value={weights[k.id]} onChange={(e) => setWeights({ ...weights, [k.id]: +e.target.value })} aria-label={k.name + ' weight'} />
            </div>
          ))}
          {total !== 100 && <Note>Weights must add up to 100% before saving.</Note>}
        </section>
        <section className="card"><div className="card-head"><h3>Vendors compared</h3><span className="small muted">Only you see this</span></div>
          {VENDORS.map((v) => <div key={v.id} className="kpi-row"><span><span className="vtag">{v.code}</span> {v.name}</span><span className="mono small">{v.score}</span><Bar value={v.score} /></div>)}
          <Note>Excused absences, approved leave and false-alarm alerts never count against anyone.</Note>
        </section>
      </div>}
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.name} sub={open && `${open.code} · ${vendorOf(open.vendor).name} · ${siteOf(open.site).name}`}>
        {open && <table className="table"><thead><tr><th>Metric</th><th className="num">Value</th><th className="num">Line</th><th></th></tr></thead><tbody>
          {METRICS.map((mm) => { const v = WORKER_METRICS[open.id][mm.id]; const b = fails(mm, v, th[mm.id]); return <tr key={mm.id}><td>{mm.name}</td><td className={'num mono ' + (b ? 'neg' : '')}>{fmtM(mm, v)}</td><td className="num mono muted">{word(mm)} {fmtM(mm, th[mm.id])}</td><td>{b ? <Pill tone="crit">Flagged</Pill> : <Pill tone="good">OK</Pill>}</td></tr>; })}
        </tbody></table>}
      </Drawer>
    </>
  );
}
