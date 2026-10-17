import { scopedWorkers } from '../../lib/scope.js';
import { VENDORS, METRICS, WORKER_METRICS, vendorOf, siteOf } from '../../data.js';
import { ScreenHeader, Tabs, Drawer, Note, Select } from '../../ui.jsx';

const { useState, useRef, useCallback } = React;

// Width of an element, kept up to date, so the chart is drawn at the size it is shown. A callback ref, because the
// panel holding the chart remounts whenever another metric is picked.
const useWidth = (fallback) => {
  const [w, setW] = useState(fallback); const ro = useRef(null);
  const ref = useCallback((el) => { ro.current?.disconnect(); if (!el) return; ro.current = new ResizeObserver(() => setW(Math.round(el.clientWidth) || fallback)); ro.current.observe(el); }, []);
  return [ref, w];
};

export const fmtM = (m, v) => (m.step < 1 ? (+v).toFixed(1) : Math.round(v)) + m.unit;

export const fails = (m, v, th) => (m.dir === 'higher' ? v < th : v > th);

const initials = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);

// Bins for a metric: whole steps when there are few of them, otherwise 18 even buckets.
const binning = (m, W, padX) => {
  const span = m.max - m.min, discrete = m.step >= 1 && span / m.step <= 20;
  const bins = discrete ? Math.round(span / m.step) + 1 : 18;
  return { span, discrete, bins, cw: (W - 2 * padX) / bins };
};
// How far in from each edge of the plot the slider has to sit so its handle lands under the values it sets.
export const stripInset = (m, W = 280, padX = 8) => { const b = binning(m, W, padX); return (padX + (b.discrete ? b.cw / 2 : 0)) / W; };

// One dot per worker, stacked by value; flagged dots in red, the flagged side shaded, the threshold as a line.
export function StripPlot({ m, th, values, w: W = 280, h: H = 78 }) {
  const PEOPLE = scopedWorkers();
  const padX = 8, base = H - 20;
  const { span, discrete, bins, cw } = binning(m, W, padX);
  const binOf = (v) => discrete ? Math.min(bins - 1, Math.max(0, Math.round((v - m.min) / m.step))) : Math.min(bins - 1, Math.max(0, Math.floor(((v - m.min) / span) * bins)));
  const cols = Array.from({ length: bins }, () => []);
  [...values].sort((a, b) => a[1] - b[1]).forEach(([id, v]) => cols[binOf(v)].push([id, v]));
  const maxCount = Math.max(1, ...cols.map((c) => c.length));
  let r = 3.1 * (H / 78), d = 7 * (H / 78), perRow = 1;
  for (let k = 0; k < 8; k++) {
    const maxRows = Math.max(1, Math.floor((base - 4) / d));
    perRow = Math.max(1, Math.ceil(maxCount / maxRows));
    if (perRow * d <= cw - 1) break;
    r *= 0.85; d *= 0.85;
  }
  const cx0 = (bi) => padX + cw * bi + cw / 2;
  const dotX = (bi, k) => { const n = Math.min(perRow, cols[bi].length); const col = k % perRow; return cx0(bi) + (col - (n - 1) / 2) * d; };
  const dotY = (k) => base - 2 - r - Math.floor(k / perRow) * d;
  const x = (v) => discrete ? cx0(Math.round((Math.min(m.max, Math.max(m.min, v)) - m.min) / m.step)) : padX + ((Math.min(m.max, Math.max(m.min, v)) - m.min) / span) * (W - 2 * padX);
  const tx = discrete ? x(th) + (m.dir === 'higher' ? -cw / 2 : cw / 2) : x(th);
  const fmt = (v) => fmtM(m, v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="strip" aria-label={`${m.name}: distribution of ${values.length} workers, threshold ${fmt(th)}`}>
      <rect x={m.dir === 'higher' ? padX : tx} y="2" width={Math.max(0, m.dir === 'higher' ? tx - padX : W - padX - tx)} height={base - 1} className="strip-zone" rx="6" />
      <line x1={padX} x2={W - padX} y1={base + 1} y2={base + 1} className="strip-axis" />
      {cols.map((c, bi) => c.map(([id, v], k) => {
        const w = PEOPLE.find((q) => q.id === id);
        return <circle key={id} cx={dotX(bi, k)} cy={dotY(k)} r={r} className={fails(m, v, th) ? 'strip-dot bad' : 'strip-dot'} style={{ '--k': k }}><title>{`${w.name}: ${fmt(v)}`}</title></circle>;
      }))}
      <line x1={tx} x2={tx} y1="0" y2={base + 4} className="strip-th" />
      <text x={discrete ? x(m.min) : padX} y={H - 3} textAnchor={discrete ? 'middle' : 'start'} className="strip-tick">{fmt(m.min)}</text>
      <text x={discrete ? x(m.max) : W - padX} y={H - 3} textAnchor={discrete ? 'middle' : 'end'} className="strip-tick">{fmt(m.max)}</text>
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
  const val = (w, id) => WORKER_METRICS[w.id][id];
  const vals = (id) => PEOPLE.map((w) => [w.id, val(w, id)]);
  const flaggedOn = (w) => METRICS.filter((m) => fails(m, val(w, m.id), th[m.id]));
  const flagCount = (mm) => PEOPLE.filter((w) => fails(mm, val(w, mm.id), th[mm.id])).length;
  const anyFlag = PEOPLE.filter((w) => flaggedOn(w).length > 0).length;
  const multi = PEOPLE.filter((w) => flaggedOn(w).length > 1).length;
  const m = METRICS.find((x) => x.id === sel);
  const n = flagCount(m);
  const rows = PEOPLE
    .filter((w) => showAll || fails(m, val(w, m.id), th[m.id]))
    .filter((w) => (vendor === 'all' || w.vendor === vendor) && (w.name + w.code).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (m.dir === 'higher' ? 1 : -1) * (val(a, m.id) - val(b, m.id)));
  const word = (mm) => (mm.dir === 'higher' ? 'below' : 'above');
  const pick = (id) => { setSel(id); setShowAll(false); };
  const [chartRef, cw] = useWidth(880);
  const inset = `${stripInset(m, cw) * 100}%`;

  return (
    <>
      <ScreenHeader title="Performance" phase={2} spec="8" />
      <div className="pf-top">
        <Tabs tabs={[{ id: 'th', label: 'Thresholds' }, { id: 'w', label: 'Score weights' }]} value={tab} onChange={setTab} />
        {tab === 'th' && (
          <dl className="pf-sum">
            <div><dt>Workers tracked</dt><dd><b>{PEOPLE.length}</b>Deliveroo pickers · October</dd></div>
            <div><dt><span className="sdot warn" />Flagged on any metric</dt><dd><b>{anyFlag}</b>{Math.round((anyFlag / PEOPLE.length) * 100)}% of workers</dd></div>
            <div><dt><span className="sdot crit" />Flagged on 2 or more</dt><dd><b>{multi}</b>Worth a conversation</dd></div>
          </dl>
        )}
      </div>

      {tab === 'th' && (
        <div className="pf">
          <nav className="pf-metrics" aria-label="Metrics">
            {METRICS.map((mm, i) => {
              const k = flagCount(mm);
              return (
                <button key={mm.id} className={'pf-m' + (sel === mm.id ? ' on' : '')} aria-pressed={sel === mm.id} onClick={() => pick(mm.id)} style={{ '--i': i }}>
                  <span className="pf-m-top"><b>{mm.name}</b><span className="pf-m-n">{k ? <span className="sdot crit" /> : <span className="sdot good" />}{k}</span></span>
                  <span className="pf-m-sub"><span>Flag {word(mm)} {fmtM(mm, th[mm.id])}</span><span>{k === 1 ? 'worker' : 'workers'} flagged</span></span>
                  <span className="pf-share" aria-hidden="true"><i style={{ width: `${(k / PEOPLE.length) * 100}%` }} /></span>
                </button>
              );
            })}
          </nav>

          <section className="pf-panel" key={sel} aria-label={m.name}>
            <header className="pf-head">
              <div><h2>{m.name}</h2><span>{m.desc} · {m.src}</span></div>
              <div className="pf-big"><b>{n}</b><span>{n === 1 ? 'worker' : 'workers'} {word(m)} the line</span></div>
            </header>

            <div className="pf-chart" ref={chartRef}>
              <StripPlot m={m} th={th[m.id]} values={vals(m.id)} w={cw} h={190} />
              <label className="pf-slide" style={{ '--in': inset }}>
                <input id={'th-' + m.id} type="range" className="pf-range" min={m.min} max={m.max} step={m.step} value={th[m.id]} onChange={(e) => setTh({ ...th, [m.id]: +e.target.value })} aria-label={`${m.name} threshold`} />
              </label>
              <div className="pf-legend">
                <span className="pf-line">Flag {word(m)} <b>{fmtM(m, th[m.id])}</b></span>
                <span><span className="sdot crit" />Flagged</span><span><span className="sdot good" />Over the line</span>
                <span className="pf-hint">Drag the slider to move the line</span>
              </div>
            </div>

            <div className="pf-tools">
              <h3>{showAll ? `Everyone by ${m.name.toLowerCase()}` : `${rows.length} flagged`}<span>Worst first</span></h3>
              <input id="pf-q" className="input sm" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
              <Select id="pf-v" className="input sm" value={vendor} onChange={(e) => setVendor(e.target.value)}><option value="all">All vendors</option>{VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>
              <div className="seg"><button className={!showAll ? 'on' : ''} onClick={() => setShowAll(false)}>Flagged</button><button className={showAll ? 'on' : ''} onClick={() => setShowAll(true)}>Everyone</button></div>
            </div>

            <div className="pf-list" role="table" aria-label={`Workers by ${m.name.toLowerCase()}`}>
              <div className="pf-row pf-rh" role="row"><span>Worker</span><span>{m.name}</span><span>Gap to line</span><span>Also flagged on</span></div>
              {rows.map((w, i) => {
                const v = val(w, m.id), bad = fails(m, v, th[m.id]);
                const gap = m.dir === 'higher' ? v - th[m.id] : th[m.id] - v;
                const others = flaggedOn(w).filter((x) => x.id !== m.id);
                return (
                  <button key={w.id} className="pf-row" role="row" onClick={() => setOpen(w)} style={{ '--i': Math.min(i, 12) }}>
                    <span className="pf-who"><span className={'live-face ' + (bad ? 'crit' : 'good')}>{initials(w.name)}</span><span><b>{w.name}</b><span>{vendorOf(w.vendor).code} · {siteOf(w.site).name}</span></span></span>
                    <span className="pf-v">{fmtM(m, v)}</span>
                    <span className="pf-gap"><i className={bad ? 'bad' : ''}><i style={{ width: `${Math.min(100, (Math.abs(gap) / ((m.max - m.min) / 3)) * 100)}%` }} /></i>{gap >= 0 ? '+' : '−'}{fmtM(m, Math.abs(gap))}</span>
                    <span className="pf-also">{others.length ? others.map((o) => <span key={o.id}>{o.name}</span>) : <span className="none">None</span>}</span>
                  </button>
                );
              })}
              {!rows.length && <p className="pf-empty">Nobody falls {word(m)} this line. Drag the slider to tighten it.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'w' && (
        <div className="pf-w">
          <section>
            <div className="pf-w-head"><h3>Score weights · Deliveroo pickers</h3><span><span className={'sdot ' + (total === 100 ? 'good' : 'crit')} />{total}% of 100%</span></div>
            <div className="pf-mix" aria-hidden="true">{METRICS.filter((k) => weights[k.id]).map((k) => <i key={k.id} style={{ flexGrow: weights[k.id] }} title={`${k.name} ${weights[k.id]}%`} />)}</div>
            {METRICS.map((k) => (
              <label key={k.id} className="pf-wrow">
                <span>{k.name}</span>
                <input id={'w-' + k.id} type="range" className="pf-range" min="0" max="50" value={weights[k.id]} onChange={(e) => setWeights({ ...weights, [k.id]: +e.target.value })} aria-label={k.name + ' weight'} />
                <b>{weights[k.id]}%</b>
              </label>
            ))}
            {total !== 100 && <Note>Weights must add up to 100% before saving.</Note>}
          </section>
          <section>
            <div className="pf-w-head"><h3>Vendors compared</h3><span>Only you see this</span></div>
            {VENDORS.map((v) => (
              <div key={v.id} className="pf-vrow"><span className="vtag">{v.code}</span><span>{v.name}</span><i className="vd-bar"><i style={{ width: `${v.score}%` }} /></i><b>{v.score}</b></div>
            ))}
            <Note>Excused absences, approved leave and false-alarm alerts never count against anyone.</Note>
          </section>
        </div>
      )}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.name} sub={open && `${open.code} · ${vendorOf(open.vendor).name} · ${siteOf(open.site).name}`}>
        {open && (
          <ul className="pf-dx">
            {METRICS.map((mm, i) => {
              const v = val(open, mm.id), b = fails(mm, v, th[mm.id]);
              return (
                <li key={mm.id} style={{ '--i': i }}>
                  <span><b>{mm.name}</b><span>Flag {word(mm)} {fmtM(mm, th[mm.id])}</span></span>
                  <b className="pf-dx-v">{fmtM(mm, v)}</b>
                  <span className="pf-dx-s"><span className={'sdot ' + (b ? 'crit' : 'good')} />{b ? 'Flagged' : 'OK'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Drawer>
    </>
  );
}
