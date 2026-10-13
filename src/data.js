// Mock data for the OpsPro shell. All names, vendors and figures are illustrative.

export const TENANT = { name: 'Deliveroo UAE', currency: 'AED' };
export const AREAS = ['Dubai West', 'JVC & Motor City', 'Dubailand', 'Abu Dhabi', 'Sharjah'];
// Ops managers and the locations they look after.
export const MANAGERS = [
  { id: 'm1', name: 'Omar Haddad', sites: ['s1', 's2', 's3'] },
  { id: 'm2', name: 'Sara Mathew', sites: ['s4', 's5'] },
  { id: 'm3', name: 'Vikram Rao', sites: ['s6', 's7', 's8'] },
  { id: 'm4', name: 'Khalid Mansoori', sites: ['s9', 's10', 's11'] },
];

export const SITES = [
  { id: 's1', loc: 1, short: 'MAR', area: 'Dubai West', policy: 'Dark store standard', name: 'Spinneys Marina Promenade', code: 'SPN-MPR', radius: 150, req: 26, in: 24, late: 1, noshow: 1, hours: '06:00 – 02:00', tz: 'Asia/Dubai', roles: { Picker: 22, 'Shift lead': 2 } },
  { id: 's2', loc: 2, short: 'JLT', area: 'Dubai West', policy: 'Dark store standard', name: 'Carrefour Marina Mall', code: 'CRF-MML', radius: 120, req: 22, in: 22, late: 0, noshow: 0, hours: '06:00 – 01:00', tz: 'Asia/Dubai', roles: { Picker: 19, 'Shift lead': 2 } },
  { id: 's3', loc: 3, short: 'BAR', area: 'Dubai West', policy: 'Dark store standard', name: 'Carrefour Barsha Heights', code: 'CRF-BHT', radius: 150, req: 24, in: 19, late: 3, noshow: 2, hours: '07:00 – 02:00', tz: 'Asia/Dubai', roles: { Picker: 21, 'Shift lead': 2 } },
  { id: 's4', loc: 4, short: 'BBY', area: 'JVC & Motor City', policy: 'Dark store standard', name: 'Spinneys JVC Circle Mall', code: 'SPN-JCM', radius: 100, req: 20, in: 19, late: 1, noshow: 0, hours: '06:00 – 02:00', tz: 'Asia/Dubai', roles: { Picker: 17, 'Shift lead': 2 } },
  { id: 's5', loc: 5, short: 'ALQ', area: 'JVC & Motor City', policy: 'Dark store standard', name: 'Spinneys Motor City', code: 'SPN-MTC', radius: 200, req: 18, in: 18, late: 0, noshow: 0, hours: '07:00 – 23:00', tz: 'Asia/Dubai', roles: { Picker: 16, 'Shift lead': 1 } },
  { id: 's6', loc: 6, short: 'MIR', area: 'Dubailand', policy: 'Dark store standard', name: 'Spinneys Majan', code: 'SPN-MJN', radius: 150, req: 18, in: 16, late: 1, noshow: 1, hours: '07:00 – 01:00', tz: 'Asia/Dubai', roles: { Picker: 15, 'Shift lead': 2 } },
  { id: 's7', loc: 7, short: 'JUM', area: 'Dubailand', policy: 'Dark store standard', name: 'Spinneys Town Square', code: 'SPN-TSQ', radius: 120, req: 16, in: 15, late: 1, noshow: 0, hours: '07:00 – 01:00', tz: 'Asia/Dubai', roles: { Picker: 13, 'Shift lead': 2 } },
  { id: 's8', loc: 8, short: 'DSO', area: 'Dubailand', policy: 'Dark store, late close', name: 'Spinneys Nad Al Sheba', code: 'SPN-NAS', radius: 150, req: 12, in: 12, late: 0, noshow: 0, hours: '08:00 – 00:00', tz: 'Asia/Dubai', roles: { Picker: 10, 'Shift lead': 1 } },
  { id: 's9', loc: 9, short: 'WHD', area: 'Abu Dhabi', policy: 'Dark store standard', name: 'Carrefour Al Wahda Mall', code: 'CRF-AWM', radius: 150, req: 18, in: 17, late: 1, noshow: 0, hours: '07:00 – 01:00', tz: 'Asia/Dubai', roles: { Picker: 16, 'Shift lead': 2 } },
  { id: 's10', loc: 10, short: 'KHL', area: 'Abu Dhabi', policy: 'Dark store standard', name: 'Spinneys Khalidiya', code: 'SPN-KHL', radius: 120, req: 14, in: 14, late: 0, noshow: 0, hours: '07:00 – 00:00', tz: 'Asia/Dubai', roles: { Picker: 12, 'Shift lead': 1 } },
  { id: 's11', loc: 11, short: 'SHJ', area: 'Sharjah', policy: 'Dark store standard', name: 'Carrefour City Centre Sharjah', code: 'CRF-CCS', radius: 150, req: 16, in: 15, late: 0, noshow: 1, hours: '07:00 – 01:00', tz: 'Asia/Dubai', roles: { Picker: 14, 'Shift lead': 1 } },
];

export const VENDORS = [
  { id: 'v1', name: 'Crescent Staffing', code: 'CS', heads: 40, score: 86, fill: 96, noshow: 1.8, ttf: 22, retention: 88, compliance: 97, buy: 2600, unit: 'month / head' },
  { id: 'v2', name: 'Meridian Manpower', code: 'MM', heads: 28, score: 79, fill: 91, noshow: 3.4, ttf: 31, retention: 81, compliance: 92, buy: 2450, unit: 'month / head' },
  { id: 'v3', name: 'Falcon Crew', code: 'FC', heads: 20, score: 72, fill: 84, noshow: 4.9, ttf: 46, retention: 74, compliance: 88, buy: 13, unit: 'hour' },
  { id: 'v4', name: 'GH FZE', code: 'GH', heads: 72, score: 91, fill: 100, noshow: 0.9, ttf: 12, retention: 95, compliance: 100, buy: 2900, unit: 'month / head' },
];

const NAMES = ['Arjun Nair', 'Rizwan Khan', 'Chinedu Okafor', 'Mohammed Rahman', 'Rajesh Kumar', 'Mark Dela Cruz', 'Imran Ali', 'Shafiqul Islam', 'Sanjay Menon', 'Emeka Eze', 'Bilal Ahmed', 'Jomar Reyes', 'Abdul Karim', 'Faisal Qureshi', 'Anil Varghese', 'Tunde Adeyemi', 'Nasir Hossain', 'Vinod Pillai', 'Kevin Santos', 'Tariq Mehmood', 'Suresh Babu', 'Emmanuel Okonkwo', 'Hamza Butt', 'Rohit Joshi', 'Ariel Bautista', 'Kamal Uddin', 'Usman Malik', 'Ifeanyi Nwosu', 'Pradeep Kumar', 'Rommel Garcia', 'Rafiq Miah', 'Babajide Ogunleye', 'Junaid Iqbal', 'Jinto Thomas', 'Ronaldo Mendoza', 'Sohel Ahmed', 'Waqas Anwar', 'Biju Mathew', 'Chukwuma Obi', 'Jerome Aquino', 'Ashraf Hussain', 'Noel Villanueva'];
const statuses = ['Clocked in', 'Clocked in', 'Clocked in', 'Clocked in', 'Late', 'On break', 'Off today', 'No-show', 'On leave', 'Clocked in'];
const roles = ['Picker', 'Picker', 'Picker', 'Picker', 'Picker', 'Shift lead'];
// Floaters: no fixed location, they cover shifts wherever they are needed. Distance is measured from where they live.
export const HOME_AREAS = { 'Al Nahda, Sharjah': [55.372, 25.300], 'Mussafah, Abu Dhabi': [54.505, 24.350], 'Al Quoz': [55.229, 25.139], 'Al Barsha': [55.200, 25.105], 'International City': [55.410, 25.165], 'Jumeirah Village Circle': [55.210, 25.060], 'Dubai Investments Park': [55.165, 24.985], 'Al Qusais': [55.385, 25.280] };
const FLOAT = ['Al Quoz', 'Al Barsha', 'Jumeirah Village Circle', 'Mussafah, Abu Dhabi', 'International City', 'Al Nahda, Sharjah'];

export const WORKERS = Array.from({ length: 42 }, (_, i) => {
  const v = [1, 3, 5, 7].includes(i % 9) ? VENDORS[3] : VENDORS[i % 3]; // GH FZE supplies the largest share
  const s = SITES[i % 6];
  const st = statuses[i % statuses.length];
  return {
    id: 'w' + i,
    code: 'OP-' + (1041 + i * 7),
    name: NAMES[i],
    vendor: v.id,
    site: s.id,
    role: i >= 36 ? 'Reliever' : roles[i % roles.length],
    ...(i >= 36 ? { site: 'pool', homeArea: FLOAT[i - 36] } : {}),
    status: st,
    score: [92, 88, 84, 61, 79, 95, 73, 58, 90, 82, 77, 86][i % 12],
    docs: i % 7 === 2 ? 'Visa expires in 12 days' : i % 9 === 4 ? 'Emirates ID missing' : null,
    phone: '+971 5' + (i % 6) + ' ' + String(3000000 + i * 4111).slice(0, 7),
    clientId: 'DRV-' + (88210 + i * 13),
    shift: i % 2 ? '07:00 – 19:00' : '14:00 – 02:00',
    shiftType: '11+1',
    joined: ['2025-11-03', '2026-01-15', '2026-03-02', '2026-05-20', '2026-07-08'][i % 5],
  };
});

export const vendorOf = (id) => VENDORS.find((v) => v.id === id);
// Each designation maps to an access level. Floater = no fixed location, covers shifts where needed.
export const DESIG_ACCESS = { Picker: 'Employee', Reliever: 'Floater', 'Shift lead': 'Employee', Supervisor: 'Manager', 'Senior Supervisor': 'Admin', 'Operations Manager': 'Admin' };
export const FLOAT_POOL = { id: 'pool', name: 'No fixed location', short: 'POOL', area: '' };
export const siteOf = (id) => (id === 'pool' ? FLOAT_POOL : SITES.find((s) => s.id === id));


export const ALERTS = [
  { id: 'a1', type: 'No-show', sev: 'critical', worker: 'w7', site: 's3', time: '08:02', detail: 'Rostered 07:00, no clock-in after 60 min', open: true },
  { id: 'a2', type: 'Face mismatch', sev: 'critical', worker: 'w15', site: 's1', time: '07:04', detail: 'Match score 0.41 (threshold 0.60). Liveness passed.', open: true },
  { id: 'a3', type: 'Late', sev: 'warning', worker: 'w4', site: 's3', time: '07:18', detail: 'Clocked in 18 min after start (grace 10 min)', open: true },
  { id: 'a4', type: 'Outside geofence', sev: 'warning', worker: 'w10', site: 's4', time: '06:57', detail: 'Punch 340 m from site, radius 100 m', open: true },
  { id: 'a5', type: 'Break overrun', sev: 'warning', worker: 'w2', site: 's2', time: '11:41', detail: 'Break 74 min, allowed 60 + 5 grace', open: true },
  { id: 'a6', type: 'Missing clock-out', sev: 'info', worker: 'w12', site: 's6', time: '03:10', detail: 'Auto clock-out at 12 h; flagged for review', open: true },
  { id: 'a7', type: 'Document expiry', sev: 'info', worker: 'w2', site: 's2', time: 'Today', detail: 'Visa expires 19 Oct 2026', open: true },
  { id: 'a8', type: 'No-show', sev: 'critical', worker: 'w17', site: 's6', time: '07:01', detail: 'Rostered 06:00, no clock-in after 60 min', open: false, outcome: 'Excused' },
];

export const PROPOSALS = [
  { id: 'p1', name: 'Dinesh Raj', vendor: 'v1', role: 'Picker', site: 's3', stage: 'proposed', days: 1, docs: 3, docsReq: 4, dup: false },
  { id: 'p2', name: 'Paolo Mendoza', vendor: 'v2', role: 'Picker', site: 's3', stage: 'proposed', days: 0, docs: 4, docsReq: 4, dup: false },
  { id: 'p3', name: 'Obinna Chukwu', vendor: 'v3', role: 'Reliever', site: 's3', stage: 'review', days: 2, docs: 4, docsReq: 4, dup: true },
  { id: 'p4', name: 'Shahzad Mir', vendor: 'v1', role: 'Reliever', site: 's3', stage: 'review', days: 1, docs: 4, docsReq: 4, dup: false },
  { id: 'p5', name: 'Ravi Nambiar', vendor: 'v2', role: 'Picker', site: 's3', stage: 'client', days: 3, docs: 4, docsReq: 4, clientId: '' },
  { id: 'p6', name: 'Ali Raza', vendor: 'v1', role: 'Shift lead', site: 's3', stage: 'client', days: 5, docs: 4, docsReq: 4, clientId: 'DRV-90311' },
  { id: 'p7', name: 'Segun Bello', vendor: 'v3', role: 'Picker', site: 's3', stage: 'ready', days: 0, docs: 4, docsReq: 4, clientId: 'DRV-90288' },
  { id: 'p8', name: 'Hari Krishnan', vendor: 'v2', role: 'Picker', site: 's7', stage: 'returned', days: 1, docs: 2, docsReq: 4, reason: 'Passport copy unreadable; visa page missing' },
];

export const LEAVE = [
  { id: 'l1', worker: 'w3', type: 'Annual', from: '2026-10-12', to: '2026-10-18', days: 7, status: 'Pending', note: 'Family visit', asked: 'Mon 5 Oct, 09:14' },
  { id: 'l2', worker: 'w9', type: 'Sick', from: '2026-10-07', to: '2026-10-07', days: 1, status: 'Pending', note: 'Certificate attached', attach: true, asked: 'Wed 7 Oct, 06:02' },
  { id: 'l3', worker: 'w14', type: 'Emergency', from: '2026-10-08', to: '2026-10-09', days: 2, status: 'Pending', note: 'My father was admitted to hospital in Kochi last night and I need to fly home tomorrow morning. I will share the hospital letter once I land and can come back early if he is discharged.', asked: 'Tue 6 Oct, 23:40' },
  { id: 'l4', worker: 'w20', type: 'Annual', from: '2026-10-20', to: '2026-10-20', days: 0.5, half: true, status: 'Approved', note: 'Half day, morning', asked: 'Thu 1 Oct, 14:20', by: 'Omar Haddad', at: 'Fri 2 Oct, 10:05', cleared: 1 },
  { id: 'l6', worker: 'w2', type: 'Annual', from: '2026-10-08', to: '2026-10-10', days: 3, status: 'Approved', note: 'Travel', asked: 'Sun 27 Sep, 18:31', by: 'Omar Haddad', at: 'Mon 28 Sep, 09:47', cleared: 3 },
  { id: 'l7', worker: 'w11', type: 'Annual', from: '2026-10-09', to: '2026-10-11', days: 3, status: 'Rejected', note: 'Cousin\'s wedding in Manila', asked: 'Fri 2 Oct, 20:15', by: 'Omar Haddad', at: 'Sat 3 Oct, 11:30', reason: 'Two people at this location are already off on those days. Please pick the following week.' },
  { id: 'l5', worker: 'w8', type: 'Unpaid', from: '2026-10-05', to: '2026-10-06', days: 2, status: 'Approved', note: '', asked: 'Wed 30 Sep, 12:02', by: 'Omar Haddad', at: 'Wed 30 Sep, 16:40', cleared: 2 },
];

export const DAYS = ['Mon 5', 'Tue 6', 'Wed 7', 'Thu 8', 'Fri 9', 'Sat 10', 'Sun 11'];

// A shift is just a length: base hours + optional overtime. The start time is picked on the roster, per day.
const SHIFT_TEMPLATES_RAW = [
  // Defaults from opspro-app: worked hours + a 1 h unpaid break, so 11+1 is 12 h on site (the most allowed).
  { id: 'f5', base: 11, brk: 1, used: 27 },
  { id: 'f3', base: 10, brk: 1, used: 7 },
  { id: 'f1', base: 8, brk: 1, used: 3 },
  { id: 'f7', base: 4, brk: 0, used: 8 }, // added by this client for split shifts
];

// Roster: each cell is OFF ('O'), leave ('L'), an unfilled slot ('X'), or a list of shifts.
// A shift is [shiftId, start, siteId?] — siteId only when it differs from the roster's site.
const OLD_BASE = { t1: 8, t2: 10, t3: 11, t4: 4 };
const sid = (t) => SHIFT_TEMPLATES_RAW.find((x) => x.base === OLD_BASE[t]).id;
const sh = (t, st, site) => (site ? [sid(t, st), st, site] : [sid(t, st), st]);
const A = (t, st) => [sh(t, st)];
export const ROSTER = [
  [A('t3', '07:00'), A('t3', '07:00'), A('t3', '07:00'), A('t3', '07:00'), 'O', A('t3', '07:00'), A('t3', '07:00')],
  [A('t2', '14:00'), A('t2', '14:00'), 'O', A('t2', '14:00'), A('t2', '14:00'), A('t2', '14:00'), A('t2', '14:00')],
  [A('t3', '07:00'), A('t3', '07:00'), A('t3', '07:00'), 'L', 'L', 'L', A('t3', '07:00')],
  ['O', A('t1', '07:00'), A('t1', '07:00'), A('t1', '15:00'), A('t1', '15:00'), 'O', A('t1', '07:00')],
  [[sh('t4', '07:00'), sh('t4', '18:00', 's1')], [sh('t1', '07:00'), sh('t4', '17:00')], A('t3', '07:00'), A('t3', '07:00'), 'O', [sh('t4', '07:00'), sh('t4', '18:00', 's1')], [sh('t4', '07:00', 's2'), sh('t4', '13:00')]],
  [A('t3', '07:00'), 'O', A('t3', '07:00'), A('t3', '07:00'), A('t3', '07:00'), A('t3', '07:00'), 'X'],
  [A('t2', '14:00'), A('t2', '14:00'), A('t2', '14:00'), 'O', A('t2', '14:00'), A('t2', '14:00'), A('t2', '14:00')],
  ['X', A('t3', '14:00'), A('t3', '14:00'), A('t3', '14:00'), A('t3', '14:00'), 'O', A('t3', '14:00')],
];

// The roster broken down by location: each location has its own people (home location) and their week.
// A shift at another location carries that location's id, and also shows under that location as a visiting row.
const OTHER_SITES = SITES.filter((x) => x.id !== 's3');
export const ROSTER_GROUPS = SITES.map((s) => {
  if (s.id === 's3') return { site: 's3', people: WORKERS.slice(0, 8).map((w) => w.id), cells: ROSTER };
  const oi = OTHER_SITES.indexOf(s);
  if (8 + oi * 4 + 3 >= 36) return { site: s.id, people: [], cells: [] }; // stores added later start empty
  const people = [0, 1, 2, 3].map((k) => WORKERS[8 + oi * 4 + k].id);
  const base = [['f5', '07:00'], ['f3', '14:00'], ['f5', '07:00'], ['f5', '14:00']];
  const cells = people.map((_, k) => DAYS.map((_, d) => {
    if ((d + k + oi) % 7 === 4) return 'O';
    if (k === 2 && oi % 2 === 0 && d === (oi + 5) % 7) return 'X';
    if (k === 3 && oi === 1 && d < 2) return 'L';
    return [base[k]];
  }));
  return { site: s.id, people, cells };
});

// The float pool's week: 'A' = available (not paid), 'O' = weekly off, or cover shifts.
// A cover shift is [shiftId, start, siteId, coveredWorkerId, previousCell].
const POOL = WORKERS.filter((w) => w.site === 'pool').map((w) => w.id);
const poolCells = POOL.map((_, k) => DAYS.map((_, d) => (d === (k * 2 + 6) % 7 ? 'O' : 'A')));
poolCells[0][3] = [['f5', '07:00', 's3', 'w2', 'A']]; // Waqas covers Chinedu's leave on Thu
poolCells[0][4] = [['f5', '07:00', 's3', 'w2', 'A']]; // and Fri; Sat is still uncovered
poolCells[2][1] = [['f5', '14:00', 's2', 'w15', 'A']]; // Chukwuma (another manager's pool) covered Tunde's leave on Tue
ROSTER_GROUPS.push({ site: 'pool', float: true, people: POOL, cells: poolCells });

// Keep each worker's home location in step with the roster section they sit in.
ROSTER_GROUPS.forEach((g) => !g.float && g.people.forEach((id) => { WORKERS.find((w) => w.id === id).site = g.site; }));

// Fill every store up to its required headcount (SITES[].req). The first 42 workers above carry the hand-written
// scenarios (split shifts, covers, leave, alerts); everyone added here gets an ordinary, staggered week.
// The vendor split is set so the totals come out at GH FZE 95, Crescent 52, Meridian 38, Falcon 25.
const FIRST = ['Abdul', 'Ajay', 'Akash', 'Aldrin', 'Ali', 'Amir', 'Anand', 'Arif', 'Arnel', 'Babu', 'Bashir', 'Binu', 'Charles', 'Daniel', 'Deepak', 'Dennis', 'Ebuka', 'Edwin', 'Emmanuel', 'Farhan', 'Gift', 'Gopal', 'Hamid', 'Haris', 'Ifeanyi', 'Irfan', 'Jamal', 'Jason', 'Jerome', 'John', 'Joseph', 'Kabir', 'Kelvin', 'Kiran', 'Kofi', 'Lijo', 'Mahesh', 'Manoj', 'Marlon', 'Michael', 'Mohan', 'Murali', 'Nabil', 'Naveen', 'Nelson', 'Obinna', 'Oscar', 'Prakash', 'Rafael', 'Rahul', 'Raju', 'Ramon', 'Rashid', 'Renato', 'Rohan', 'Sabir', 'Sajid', 'Samson', 'Shahid', 'Shiju', 'Sibi', 'Suresh', 'Tariq', 'Tobi', 'Umar', 'Vijay', 'Vincent', 'Wasim', 'Yasir', 'Zubair'];
const LAST = ['Ahmed', 'Ali', 'Alvarez', 'Babu', 'Bautista', 'Chowdhury', 'Cruz', 'Das', 'Dela Rosa', 'Eze', 'Fernandes', 'Garcia', 'George', 'Gurung', 'Hassan', 'Hossain', 'Iqbal', 'Jacob', 'Joseph', 'Kamau', 'Khan', 'Kumar', 'Lama', 'Mathew', 'Mendoza', 'Mensah', 'Miah', 'Nair', 'Nwosu', 'Okafor', 'Ochieng', 'Pillai', 'Rahman', 'Rai', 'Ramos', 'Reyes', 'Saleem', 'Santos', 'Shah', 'Shrestha', 'Singh', 'Thapa', 'Thomas', 'Uddin', 'Varghese', 'Villanueva', 'Yadav'];
const taken = new Set(WORKERS.map((w) => w.name));
const nameAt = (n) => { for (let k = 0; ; k++) { const nm = `${FIRST[(n * 7 + k) % FIRST.length]} ${LAST[(n * 11 + k * 3) % LAST.length]}`; if (!taken.has(nm)) { taken.add(nm); return nm; } } };
const NEED = { v4: 76, v1: 43, v2: 33, v3: 16 };
const MIX = Object.entries(NEED).flatMap(([v, n]) => Array.from({ length: n }, (_, k) => ({ v, key: (k + 0.5) / n }))).sort((a, b) => a.key - b.key || a.v.localeCompare(b.v)).map((x) => x.v);
let made = 0;
ROSTER_GROUPS.forEach((g, gi) => {
  if (g.float) return;
  const s = SITES.find((x) => x.id === g.site);
  const lead = g.people.some((id) => WORKERS.find((w) => w.id === id).role === 'Shift lead');
  while (g.people.length < s.req) {
    const n = made++; const i = 42 + n; const k = g.people.length;
    const role = (!lead && k === g.people.length && n % 9 === 0) || k % 11 === 5 ? 'Shift lead' : 'Picker';
    WORKERS.push({ id: 'w' + i, code: 'OP-' + (1041 + i * 7), name: nameAt(n), vendor: MIX[n % MIX.length], site: g.site, role, status: n % 23 === 6 ? 'Late' : n % 17 === 3 ? 'On break' : n % 47 === 20 ? 'No-show' : 'Clocked in',
      score: [92, 88, 84, 61, 79, 95, 73, 58, 90, 82, 77, 86][(n * 5) % 12], docs: n % 13 === 4 ? 'Visa expires in 20 days' : n % 17 === 9 ? 'Emirates ID missing' : null,
      phone: '+971 5' + (n % 6) + ' ' + String(3100000 + n * 3907).slice(0, 7), clientId: 'DRV-' + (89100 + n * 11), shift: k % 3 === 2 ? '14:00 – 02:00' : '07:00 – 19:00', shiftType: '11+1',
      joined: ['2025-09-14', '2025-12-01', '2026-02-09', '2026-04-27', '2026-06-15', '2026-08-03'][n % 6] });
    // A staggered week: one weekly off, mornings and evenings, the odd 10+1 shift and a little leave.
    const off = (k * 3 + gi) % 7; const start = k % 3 === 2 ? '14:00' : '07:00'; const tpl = k % 5 === 4 ? 'f3' : 'f5';
    g.people.push('w' + i);
    g.cells.push(DAYS.map((_, d) => (d === off ? 'O' : n % 29 === 7 && (d === 4 || d === 5) ? 'L' : n % 19 === 11 && d === (off + 3) % 7 ? 'X' : [[tpl, start]])));
  }
});
// Headcounts follow the people actually supplied.
VENDORS.forEach((v) => { v.heads = WORKERS.filter((w) => w.vendor === v.id).length; });

export const KPIS = [
  { id: 'k1', name: 'Attendance rate', src: 'System', weight: 30, target: '98%', dir: 'Higher' },
  { id: 'k2', name: 'Punctuality rate', src: 'System', weight: 20, target: '95%', dir: 'Higher' },
  { id: 'k3', name: 'No-shows', src: 'System', weight: 15, target: '0 / month', dir: 'Lower' },
  { id: 'k4', name: 'Orders picked per hour', src: 'Imported (picking system)', weight: 20, target: '62', dir: 'Higher' },
  { id: 'k5', name: 'Pick accuracy', src: 'Imported (picking system)', weight: 10, target: '99.5%', dir: 'Higher' },
  { id: 'k6', name: 'Supervisor rating', src: 'Supervisor app', weight: 5, target: '4 / 5', dir: 'Higher' },
];

// September, priced from the headcounts above: about 24.8 days present per head (paid as days ÷ 26 of the
// monthly rate), Falcon Crew by the hour (about 283 hours per head).
const PENALTY = { v4: -600, v1: -800, v2: -1200, v3: -1400 };
export const FIN_VENDORS = ['v4', 'v1', 'v2', 'v3'].map((id) => {
  const v = VENDORS.find((x) => x.id === id);
  if (v.unit === 'hour') { const hours = Math.round(v.heads * 283.5); const buy = hours * v.buy; return { v: id, heads: v.heads, hours, buy, penalty: PENALTY[id], net: buy + PENALTY[id] }; }
  const days = Math.round(v.heads * 24.8); const buy = Math.round((v.buy * days) / 26 / 10) * 10; return { v: id, heads: v.heads, days, buy, penalty: PENALTY[id], net: buy + PENALTY[id] };
});

export const RATE_CARDS = [
  { vendor: 'v1', role: 'Picker', rate: 2600, unit: 'month / head', ot: '1.25×', basis: 'Days present ÷ 26' },
  { vendor: 'v2', role: 'Picker', rate: 2450, unit: 'month / head', ot: 'Flat', basis: 'Days present ÷ 26' },
  { vendor: 'v3', role: 'Picker', rate: 13, unit: 'hour', ot: '1.25×', basis: 'Hours worked' },
  { vendor: 'v4', role: 'Picker', rate: 2900, unit: 'month / head', ot: '1.25×', basis: 'Days present ÷ 26' },
  { vendor: 'v1', role: 'Shift lead', rate: 3400, unit: 'month / head', ot: 'Flat', basis: 'Days present ÷ 26' },
];

export const ANNOUNCEMENTS = [
  { id: 'n1', title: 'Ramadan timings at Deliveroo sites', to: 'Deliveroo · all sites', sent: 'Mon 5 Oct', read: 118, total: 128, ack: true },
  { id: 'n2', title: 'New uniform pickup at Al Quoz office', to: 'All workers', sent: 'Thu 1 Oct', read: 141, total: 166, ack: false },
  { id: 'n3', title: 'Cold room safety reminder', to: 'Pickers · Marina Promenade, Marina Mall', sent: 'Tue 29 Sep', read: 44, total: 48, ack: true },
];
export const FORMS = [
  { id: 'f1', name: 'Site opening checklist', freq: 'Daily, before 07:00', subs: 41, sites: 6, photo: true },
  { id: 'f2', name: 'Incident report', freq: 'On demand', subs: 3, sites: 8, photo: true },
  { id: 'f3', name: 'Cold chain temperature log', freq: 'Every 4 hours', subs: 128, sites: 6, photo: false },
  { id: 'f4', name: 'Shift handover', freq: 'End of each shift', subs: 77, sites: 8, photo: false },
];

// Per-worker metric values for October (deterministic pseudo-random).
const rnd = (seed) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };
export const METRICS = [
  { id: 'att', name: 'Attendance rate', unit: '%', src: 'System', dir: 'higher', min: 80, max: 100, step: 0.5, def: 92, weight: 30, desc: 'Rostered shifts attended' },
  { id: 'punc', name: 'Punctuality', unit: '%', src: 'System', dir: 'higher', min: 70, max: 100, step: 1, def: 84, weight: 20, desc: 'Shifts started within grace' },
  { id: 'ns', name: 'No-shows', unit: '', src: 'System', dir: 'lower', min: 0, max: 5, step: 1, def: 1, weight: 15, desc: 'This month' },
  { id: 'late', name: 'Average late minutes', unit: ' min', src: 'System', dir: 'lower', min: 0, max: 30, step: 1, def: 14, weight: 0, desc: 'When late' },
  { id: 'pph', name: 'Orders picked per hour', unit: '', src: 'Imported · picking system', dir: 'higher', min: 40, max: 80, step: 1, def: 52, weight: 20, desc: 'Matched on staff ID' },
  { id: 'acc', name: 'Pick accuracy', unit: '%', src: 'Imported · picking system', dir: 'higher', min: 97, max: 100, step: 0.1, def: 98.8, weight: 10, desc: 'Orders without a picking error' },
  { id: 'rate', name: 'Supervisor rating', unit: ' / 5', src: 'Supervisor app', dir: 'higher', min: 1, max: 5, step: 0.1, def: 3.0, weight: 5, desc: 'Average of shift ratings' },
];
export const WORKER_METRICS = Object.fromEntries(WORKERS.map((w, i) => {
  const r = (k) => rnd(i * 13 + k);
  const weak = i % 6 === 3 || i % 11 === 7;
  return [w.id, {
    att: +(weak ? 84 + r(1) * 10 : 93 + r(1) * 7).toFixed(1),
    punc: Math.round(weak ? 72 + r(2) * 16 : 86 + r(2) * 14),
    ns: weak ? Math.round(1 + r(3) * 3) : (r(3) > 0.85 ? 1 : 0),
    late: Math.round(weak ? 9 + r(4) * 18 : 1 + r(4) * 10),
    pph: Math.round(48 + r(5) * 26),
    acc: +(98.4 + r(6) * 1.6).toFixed(1),
    rate: +(weak ? 2.6 + r(7) * 1.4 : 3.4 + r(7) * 1.6).toFixed(1),
  }];
}));

// September cost per location: vendor charges split by where each shift was worked.
export const COST_BY_SITE = [
  { site: 's1', days: 652, cost: 72400, ot: 0.06, cover: 9 }, { site: 's2', days: 548, cost: 60100, ot: 0.05, cover: 6 },
  { site: 's3', days: 571, cost: 69800, ot: 0.14, cover: 17 }, { site: 's4', days: 503, cost: 55300, ot: 0.06, cover: 5 },
  { site: 's5', days: 452, cost: 49200, ot: 0.05, cover: 4 }, { site: 's6', days: 447, cost: 51800, ot: 0.09, cover: 11 },
  { site: 's7', days: 402, cost: 43900, ot: 0.05, cover: 3 }, { site: 's8', days: 301, cost: 33200, ot: 0.07, cover: 2 },
  { site: 's9', days: 449, cost: 49600, ot: 0.06, cover: 4 }, { site: 's10', days: 351, cost: 38700, ot: 0.05, cover: 2 }, { site: 's11', days: 398, cost: 44100, ot: 0.08, cover: 5 },
];

// Shifts: each one is a single start time + base hours + optional overtime ("+1" = one optional overtime hour, paid at the overtime rate only if worked).
export const SHIFT_TEMPLATES = SHIFT_TEMPLATES_RAW;
export const tplOf = (id) => SHIFT_TEMPLATES.find((t) => t.id === id);
export const tplLabel = (t) => `${t.base}${t.brk ? '+' + t.brk : ''} hr`;
// Time on site: worked hours plus the unpaid break. A shift ends at start + span.
export const spanOf = (t) => t.base + (t.brk || 0);
export const MAX_ON_SITE = 12; // hours, from opspro-app
export const TRAVEL = { 's3|s1': 25, 's1|s3': 25, 's2|s3': 15, 's3|s2': 15, 's2|s1': 10, 's1|s2': 10 };
// End time is inferred from start + hours; past midnight means it ends the next day.
export const endOf = (start, hours) => {
  const [h, m] = start.split(':').map(Number);
  const mins = h * 60 + m + hours * 60;
  return { time: `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`, nextDay: mins >= 1440 };
};
