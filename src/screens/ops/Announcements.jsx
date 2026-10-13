import { ANNOUNCEMENTS } from '../../data.js';
import { ScreenHeader, Bar, useToast } from '../../ui.jsx';

const { useState } = React;

export function Communication() {
  const [tab, setTab] = useState('ann');
  const toast = useToast();
  return (
    <>
      <ScreenHeader title="Announcements" phase={2} spec="5.11" actions={<button className="btn" onClick={() => toast('New announcement draft')}>New announcement</button>} />
      {tab === 'ann' && <section className="card">{ANNOUNCEMENTS.map((a) => (
        <div key={a.id} className="ann">
          <div><b>{a.title}</b><div className="small muted">{a.to} · sent {a.sent} {a.ack && '· acknowledgement required'}</div></div>
          <div className="ann-read"><span className="mono small">{a.read}/{a.total} read</span><Bar value={a.read} max={a.total} /></div>
        </div>
      ))}</section>}

    </>
  );
}
