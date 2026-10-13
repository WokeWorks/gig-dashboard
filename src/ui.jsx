const { useState, useEffect, createContext, useContext } = React;

export const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }) {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={setMsg}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}

export const Phase = ({ p }) => <span className={'phase p' + p} title={'Ships in phase ' + p}>P{p}</span>;
export const Spec = ({ s }) => <span className="spec" title="Section in the detailed spec">§{s}</span>;

export const Pill = ({ tone = 'muted', children }) => <span className={'pill ' + tone}>{children}</span>;

export function ScreenHeader({ title, phase, spec, desc, actions }) {
  return (
    <header className="screen-head">
      <div className="screen-head-text">
        <div className="screen-tags">
          {phase && <Phase p={phase} />}
          {spec && <Spec s={spec} />}
        </div>
        <h1>{title}</h1>
        {desc && <p className="screen-desc">{desc}</p>}
      </div>
      {actions && <div className="screen-actions">{actions}</div>}
    </header>
  );
}

export const Stat = ({ label, value, sub, tone }) => (
  <div className={'stat ' + (tone || '')}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => {
        const id = typeof t === 'string' ? t : t.id;
        const label = typeof t === 'string' ? t : t.label;
        return (
          <button key={id} role="tab" aria-selected={value === id} className={'tab' + (value === id ? ' on' : '')} onClick={() => onChange(id)}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Drawer({ open, onClose, title, children, sub }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label={title}>
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {sub && <div className="muted small">{sub}</div>}
          </div>
          <button className="btn ghost" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const Bar = ({ value, max = 100, tone = 'accent' }) => (
  <div className="bar"><span className={'bar-fill ' + tone} style={{ width: Math.min(100, (value / max) * 100) + '%' }} /></div>
);

export function Spark({ data, w = 96, h = 28 }) {
  const min = Math.min(...data), max = Math.max(...data);
  const x = (i) => (i / (data.length - 1)) * (w - 4) + 2;
  const y = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const last = data.length - 1;
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${d}L${x(last)} ${h}L${x(0)} ${h}Z`} className="spark-area" />
      <path d={d} className="spark-line" />
      <circle cx={x(last)} cy={y(data[last])} r="2.5" className="spark-dot" />
    </svg>
  );
}

export const Avatar = ({ name }) => {
  const ini = name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return <span className="avatar" aria-hidden="true">{ini}</span>;
};

export const statusTone = (s) =>
  ({ 'Clocked in': 'good', Late: 'warn', 'On break': 'info', 'Off today': 'muted', 'No-show': 'crit', 'On leave': 'info' }[s] || 'muted');

export const aed = (n) => 'AED ' + Math.round(n).toLocaleString('en-US');

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Toggle({ id, checked, onChange, label }) {
  return (
    <label className="toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-knob" /></span>
      <span>{label}</span>
    </label>
  );
}

export const Note = ({ children }) => <div className="note">{children}</div>;

// Same 24×24 stroked glyphs as the OpsPro picker app and dashboard.
const GLYPHS = {
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  chart: <><path d="M4 20h16" /><path d="M7 16v-5M12 16V6M17 16v-8" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M16 14.5h2" /></>,
  megaphone: <><path d="M4 10v4h3l7 4V6l-7 4z" /><path d="M18 9a4 4 0 0 1 0 6" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" /></>,
  building: <><rect x="5" y="3.5" width="14" height="17" rx="1.5" /><path d="M9 7.5h2M13 7.5h2M9 11.5h2M13 11.5h2M10 20.5v-4h4v4" /></>,
  userPlus: <><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20a6.5 6.5 0 0 1 13 0" /><path d="M19 8v6M16 11h6" /></>,
  umbrella: <><path d="M3 12a9 9 0 0 1 18 0z" /><path d="M12 12v6.5a2 2 0 0 1-4 0" /></>,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.2l2.8 2.8L16 9.5" /></>,
  alert: <><path d="M12 3.5L21 19.5H3z" /><path d="M12 9.5v4M12 16.8h.01" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  arrowLeft: <><path d="M20 12H5" /><path d="M11 6l-6 6 6 6" /></>,
  pin: <><path d="M12 21.5s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0c0 5.1-6.5 10.5-6.5 10.5z" /><circle cx="12" cy="10.5" r="2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></>,
  face: <><path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v2M16 20h2a2 2 0 0 0 2-2v-2" /><path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" /></>,
  tea: <><path d="M8 3a2.4 2.4 0 0 0-1 2a2.4 2.4 0 0 0 1 2M12 3a2.4 2.4 0 0 0-1 2a2.4 2.4 0 0 0 1 2" /><path d="M3 10h14v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-5z" /><path d="M16.75 16.73a3 3 0 1 0 .25-5.56" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 10.5h18" /></>,
  person: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20.5a7 7 0 0 1 14 0" /></>,
  home: <><path d="M3.5 10.8L12 3.5l8.5 7.3" /><path d="M5.5 9.6V20h13V9.6" /><path d="M9.8 20v-5.4h4.4V20" /></>,
  document: <><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" /><path d="M14 3.5v5h5" /><path d="M9 13h6M9 16.5h4" /></>,
  upload: <><path d="M4 16.5v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M12 16V3.5" /><path d="M7.5 8L12 3.5 16.5 8" /></>,
  download: <><path d="M4 16.5v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M12 3.5V16" /><path d="M7.5 11.5L12 16l4.5-4.5" /></>,
  copy: <><rect x="8" y="8" width="12.5" height="12.5" rx="2.5" /><path d="M16 8V5.5A2 2 0 0 0 14 3.5H5.5a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H8" /></>,
  signOut: <><path d="M13 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6" /><path d="M17 8.5l3.5 3.5L17 15.5" /><path d="M20 12h-9" /></>,
  swap: <><path d="M7 4.5L3.5 8 7 11.5" /><path d="M3.5 8H17" /><path d="M17 12.5l3.5 3.5-3.5 3.5" /><path d="M20.5 16H7" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><path d="M15.5 5.2a3.2 3.2 0 0 1 0 6M17 14.2a5.5 5.5 0 0 1 3.5 5.3" /></>,
  flag: <><path d="M5 21V4.5" /><path d="M5 4.5h11l-2 4 2 4H5" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  camera: <><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  pen: <><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></>,
  text: <><path d="M4 7h16M4 12h16M4 17h10" /></>,
  hash: <><path d="M5 9h14M5 15h14M10 4l-2 16M16 4l-2 16" /></>,
  toggleq: <><rect x="3" y="7" width="18" height="10" rx="5" /><circle cx="16" cy="12" r="3" /></>,
  trash: <><path d="M4 7h16M10 7V4.5h4V7M6.5 7l1 13h9l1-13" /></>,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  grip: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  finger: <><path d="M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3" /><path d="M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6" /><path d="M12 11v2a14 14 0 0 0 2.5 8" /><path d="M8 15a18 18 0 0 0 1.8 6" /><path d="M4.9 19a22 22 0 0 1-.9-7v-1a8 8 0 0 1 12-6.95" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></>,
  more: <><circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  star: <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.8l-5.1 2.6 1-5.6-4.1-4 5.7-.8z" />,
};
export function Icon({ name, size = 20, stroke = 1.9, className = '' }) {
  return (
    <svg className={'icon ' + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[name]}
    </svg>
  );
}

// Text that doesn't fit is clipped, not ellipsed. Hovering the host (see .mq-host in style.css)
// slides it left at reading speed to show the rest, then it slides back.
export function Marquee({ children, className = '' }) {
  const box = React.useRef(null), inner = React.useRef(null);
  useEffect(() => {
    const b = box.current, i = inner.current; if (!b || !i) return;
    const set = () => { const d = Math.max(0, Math.ceil(i.offsetWidth - b.clientWidth)); b.style.setProperty('--mq-x', -d + 'px'); b.style.setProperty('--mq-t', Math.max(0.4, d / 45).toFixed(2) + 's'); b.classList.toggle('mq-over', d > 0); };
    set(); const ro = new ResizeObserver(set); ro.observe(b); ro.observe(i); return () => ro.disconnect();
  }, []);
  return <span ref={box} className={'mq ' + className}><span ref={inner} className="mq-in">{children}</span></span>;
}

// A small menu of labelled actions, opened from a "more" button. items: [{ icon, label, sub, on, danger }]
export function useMenu() {
  const [m, setM] = useState(null);
  useEffect(() => {
    if (!m) return;
    const close = () => setM(null);
    const down = (e) => { if (!e.target.closest('.pop-menu')) close(); };
    const key = (e) => { if (e.key === 'Escape') { close(); m.from && m.from.focus(); } };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key); window.addEventListener('scroll', close, true); window.addEventListener('resize', close);
    requestAnimationFrame(() => { const f = document.querySelector('.pop-menu [role="menuitem"]'); f && f.focus(); });
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [m]);
  const open = (e, title, items) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect(); const W = 260;
    setM({ title, items: items.filter(Boolean), from: e.currentTarget, x: Math.max(8, Math.min(r.left, window.innerWidth - W - 8)), y: r.bottom + 4, up: r.bottom + 240 > window.innerHeight, top: r.top - 4 });
  };
  const nav = (e) => {
    const l = [...e.currentTarget.querySelectorAll('[role="menuitem"]')]; const i = l.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); l[(i + 1) % l.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); }
  };
  const el = m && (
    <div className="pop-menu" role="menu" aria-label={m.title} onKeyDown={nav} style={m.up ? { left: m.x, bottom: window.innerHeight - m.top } : { left: m.x, top: m.y }}>
      <div className="pm-title">{m.title}</div>
      {m.items.map((x, i) => (
        <button key={i} role="menuitem" className={'pm-item' + (x.danger ? ' danger' : '')} onClick={() => { setM(null); x.on(); }}>
          <Icon name={x.icon} size={16} /><span><b>{x.label}</b>{x.sub && <span className="small muted">{x.sub}</span>}</span>
        </button>
      ))}
    </div>
  );
  return { open, el, isOpen: (t) => !!m && m.title === t };
}

// The OpsPro mark: two rings side by side, the client and the vendor, overlapping where OpsPro sits.
// The faint ring is drawn first so the solid one stays crisp where they cross.
export function Logo({ size = 26 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="15.8" cy="12" r="5.9" stroke="var(--accent)" strokeWidth="2.8" fill="none" opacity=".55" />
      <circle cx="8.2" cy="12" r="5.9" stroke="var(--accent)" strokeWidth="2.8" fill="none" />
    </svg>
  );
}

// A dropdown that looks like the rest of the app (the native one doesn't), used like <select>:
// <Select value={v} onChange={(e) => set(e.target.value)}><option value="a">A</option>…</Select>
const textOf = (n) => (n == null || n === false ? '' : Array.isArray(n) ? n.map(textOf).join('') : typeof n === 'object' ? textOf(n.props && n.props.children) : String(n));
export function Select({ value: given, defaultValue, onChange, children, className = '', id, disabled, style, ...rest }) {
  const [inner, setInner] = useState(defaultValue);
  const value = given !== undefined ? given : inner;
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(0);
  const btn = React.useRef(null), list = React.useRef(null), typed = React.useRef({ s: '', t: 0 });
  const opts = React.Children.toArray(children).filter((c) => c && c.type === 'option').map((c) => ({ value: String(c.props.value ?? textOf(c.props.children)), label: textOf(c.props.children), disabled: !!c.props.disabled }));
  const cur = Math.max(0, opts.findIndex((o) => o.value === String(value)));
  const [pos, setPos] = useState(null);
  const place = () => { const r = btn.current.getBoundingClientRect(); const below = window.innerHeight - r.bottom; const up = below < 260 && r.top > below; setPos({ left: r.left, width: r.width, top: up ? undefined : r.bottom + 4, bottom: up ? window.innerHeight - r.top + 4 : undefined, maxH: Math.min(320, (up ? r.top : below) - 12) }); };
  const show = () => { if (disabled) return; place(); setAct(cur); setOpen(true); };
  const pick = (i) => { const o = opts[i]; if (!o || o.disabled) return; setOpen(false); btn.current && btn.current.focus(); if (o.value !== String(value)) { if (given === undefined) setInner(o.value); onChange && onChange({ target: { value: o.value } }); } };
  useEffect(() => {
    if (!open) return;
    const down = (e) => { if (!btn.current.contains(e.target) && !(list.current && list.current.contains(e.target))) setOpen(false); };
    const away = (e) => { if (!(list.current && list.current.contains(e.target))) setOpen(false); };
    document.addEventListener('mousedown', down); window.addEventListener('scroll', away, true); window.addEventListener('resize', away);
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('scroll', away, true); window.removeEventListener('resize', away); };
  }, [open]);
  useEffect(() => { if (open && list.current) { const el = list.current.children[act]; el && el.scrollIntoView({ block: 'nearest' }); } }, [open, act]);
  const step = (d) => { let i = act; for (let k = 0; k < opts.length; k++) { i = (i + d + opts.length) % opts.length; if (!opts[i].disabled) break; } setAct(i); };
  const key = (e) => {
    if (!open) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Home') { e.preventDefault(); setAct(0); }
    else if (e.key === 'End') { e.preventDefault(); setAct(opts.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(act); }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); }
    else if (e.key.length === 1) { const t = typed.current; const now = Date.now(); t.s = (now - t.t < 600 ? t.s : '') + e.key.toLowerCase(); t.t = now; const i = opts.findIndex((o) => o.label.toLowerCase().startsWith(t.s)); if (i >= 0) setAct(i); }
  };
  const lid = (id || 'sel') + '-list';
  return <>
    <button ref={btn} type="button" id={id} className={'select ' + className + (open ? ' open' : '')} style={style} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? lid : undefined} onClick={() => (open ? setOpen(false) : show())} onKeyDown={key} {...rest}>
      <span className="select-val">{opts[cur] ? opts[cur].label : ''}</span><Icon name="down" size={15} className="select-chev" />
    </button>
    {open && pos && ReactDOM.createPortal(
      <div ref={list} id={lid} role="listbox" className="select-list" style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.width, maxHeight: pos.maxH }} aria-activedescendant={`${lid}-${act}`}>
        {opts.map((o, i) => (
          <div key={o.value + i} id={`${lid}-${i}`} role="option" aria-selected={i === cur} aria-disabled={o.disabled || undefined} className={'select-opt' + (i === act ? ' act' : '') + (i === cur ? ' on' : '') + (o.disabled ? ' dis' : '')} onMouseEnter={() => setAct(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
            <span>{o.label}</span>{i === cur && <Icon name="check" size={14} />}
          </div>
        ))}
      </div>, document.body)}
  </>;
}
