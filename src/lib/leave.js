

export const LEAVE_TYPES = [
  { id: 'lt1', name: 'Annual', paid: true, perYear: 30, carry: 10, maxReq: null, cert: null, track: true, note: 'After the first year' },
  { id: 'lt2', name: 'Sick', paid: true, perYear: null, carry: 0, maxReq: null, cert: 1, track: false, note: '' },
  { id: 'lt3', name: 'Emergency', paid: true, perYear: null, carry: 0, maxReq: 3, cert: null, track: false, note: '' },
  { id: 'lt4', name: 'Unpaid', paid: false, perYear: null, carry: 0, maxReq: null, cert: null, track: false, note: 'Not billed by the vendor' },
];

// UAE federal public holidays, 2026. Islamic holidays follow the moon and are confirmed by the government shortly before.
export const UAE_HOL = [
  { name: "New Year's Day", from: '2026-01-01' },
  { name: 'Eid Al Fitr', from: '2026-03-20', to: '2026-03-22', moon: true },
  { name: 'Arafat Day', from: '2026-05-26', moon: true },
  { name: 'Eid Al Adha', from: '2026-05-27', to: '2026-05-29', moon: true },
  { name: 'Hijri New Year', from: '2026-06-16', moon: true },
  { name: "Prophet Muhammad's Birthday", from: '2026-08-25', moon: true },
  { name: 'UAE National Day', from: '2026-12-02', to: '2026-12-03' },
];

export const ltRule = (t) => [t.carry ? `${t.carry} days carry over` : null, t.maxReq ? `Up to ${t.maxReq} days per request` : null, t.cert ? `Certificate after ${t.cert} ${t.cert === 1 ? 'day' : 'days'}` : null, t.note || null].filter(Boolean).join(' · ') || 'No limits';
