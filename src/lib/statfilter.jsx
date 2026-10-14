// The totals row at the top of a map's side column. Each total can also filter the list and the pins to the
// locations it counts; click it again (or "Show all") to clear. items: [{ k, n, label, tone?, desc? }]; an item
// without k (e.g. a score) is just a number.
export function StatFilters({ items, only, setOnly }) {
  const cur = items.find((x) => x.k && x.k === only);
  return <>
    <div className="lm-side-stats">
      {items.map((x) => x.k
        ? <button key={x.k} className={'lm-stat-btn' + (x.tone && x.n ? ' ' + x.tone : '') + (only === x.k ? ' on' : '')} aria-pressed={only === x.k} disabled={!x.n && only !== x.k} onClick={() => setOnly(only === x.k ? 'all' : x.k)}><b>{x.n}</b><span>{x.label}</span></button>
        : <div key={x.label} className={x.tone || ''}><b>{x.n}</b><span>{x.label}</span></div>)}
    </div>
    {cur && <div className="lm-filtered small muted">{cur.desc} <button className="linkbtn" onClick={() => setOnly('all')}>Show all</button></div>}
  </>;
}
