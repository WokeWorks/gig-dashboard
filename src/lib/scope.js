import { MANAGERS, SITES, WORKERS } from '../data.js';

// Who is looking at the client dashboard. An admin sees every location and every screen; a manager sees only
// the locations assigned to them (MANAGERS[].sites), and floaters, who can cover anywhere. Set from the account
// menu (temporary, until real sign-in); screens read it on render.
export const SCOPE = { role: 'admin', mgr: 'm1' };
export const isAdmin = () => SCOPE.role === 'admin';
export const myManager = () => MANAGERS.find((m) => m.id === SCOPE.mgr);
export const mySites = () => (isAdmin() ? SITES.map((s) => s.id) : myManager().sites);
export const siteInScope = (sid) => isAdmin() || sid === 'pool' || mySites().includes(sid);
export const workerInScope = (w) => !!w && siteInScope(w.site);
export const scopedWorkers = () => WORKERS.filter(workerInScope);
// Screens only an admin uses.
export const ADMIN_ONLY = ['vendors', 'finance', 'settings'];
