# OpsPro build list

What has to be built in the real product (`opspro-app` dashboard and `opspro-picker-app`) to match this prototype. Compiled 12 Oct 2026 by reading both codebases and comparing them screen by screen with the prototype.

How to read the columns:

- **Today in opspro-app**: *None* means nothing exists yet. *Partial* means some of it is there and it needs extending or redoing. *Exists* means it's built, and the row covers only the changes.
- **Phase**: P1 is needed for the Deliveroo pilot, P2 comes next, P3 is later. These match the badges in the prototype.
- **Size**: a rough guess at the work. S is a day or two, M is about a week, L is two weeks or more. It covers the dashboard, the API and the migration together.

Everything that touches the database starts with a migration, per the opspro-app rules.

**Defaults come from opspro-app.** Wherever something becomes a setting, today's opspro-app value is its default, so nothing changes for GH until someone edits it:

| Setting | Default (from opspro-app) |
|---|---|
| Late after | 10 min (`attendance_thresholds.late_after_minutes`) |
| No-show after | 60 min (`noshow_after_minutes`), now configurable per access level |
| Shifts | 11+1, 10+1, 8+1: hours worked + 1 h unpaid break (`SHIFT_TYPES`, `UNPAID_BREAK_HOURS`) |
| Most time on site | 12 h (`MAX_SHIFT_HOURS`) |
| Break | 1 h, unpaid (`BREAK_DURATION_MS`) |
| Auto clock-out | rostered start + hours worked + 1 h break + 30 min (migration 0036) |
| Cover clock-in window | opens 90 min before the start, clock-out until 4 h after the end |
| Cover from someone already working that day | not allowed (`SAME_DAY_COVER_EXCLUSION`) |
| Geofence | 200 m, allowed 50 to 1,000 m (`LOCATION_DEFAULTS`) |
| Store hours | Mon to Sun, 08:00 to 23:59 |
| Document expiry warning | 60 days before (`doc-expiry.ts`) |
| Face match | pass 0.5, block 0.6; the kiosk refuses after 3 bad matches, the phone flags instead |
| Overtime | never pre-approved; checked on the overtime screen |

---

## 1. Platform

| # | Feature | What it means | Today in opspro-app | Phase | Size |
|---|---|---|---|---|---|
| 1.1 | **Multitenancy** | Each client company is a tenant with its own data. Every table is limited by tenant at the database level, and every API route gets the tenant from the signed-in user, never from a parameter. | **Partial.** A `tenants` table exists and ops users carry a `tenant_id`. But all 12 row-level policies are `USING (true)`, and `/api/employees/lookup` falls back to a hard-coded `PILOT_TENANT_ID`. So one tenant can read another's data. | P1 | L |
| 1.2 | Setting up a new tenant | Create a client company: name, country (sets holidays and labour rules), timezone, first admin, logo. Done from a small internal admin screen, not SQL. | None | P1 | M |
| 1.3 | Access levels | Four levels: Employee, Floater, Manager, Admin. Plus a Vendor login. Each designation (Picker, Reliever, Shift lead…) maps to one level, and that mapping locks once anyone holds the designation. Every API route checks the level. | **Partial.** `ops_users.role` is admin, ops or supervisor; `employees.role` is picker or supervisor. There's no designation-to-access mapping and no vendor login. | P1 | M |
| 1.4 | Managers own locations | Each manager is assigned locations, and the dashboard, roster and alerts are filtered to them by default. | **Partial.** A `supervisors` table and a supervisor filter exist. | P1 | S |
| 1.5 | Security items from the mobile handoff | `GET /api/employees` returns `pin_hash` and `face_descriptor`. `/api/clock-in/break` has no auth. Setup codes are unsalted SHA-256 and copied into `audit_logs`. | Open (listed in `MOBILE-HANDOFF.md`) | P1 | S |
| 1.6 | Design system | One set of colour tokens with dark mode, the `Stat` / `Pill` / day-chip components, plain sentence-case copy and the same metric tiles everywhere, as in the prototype. | **Partial.** The "T theme" is in use. The old restyle worktree is obsolete and was deleted (12 Oct); apply the prototype's design system directly. | P1 | M |

## 2. Settings (new page)

The real app has no settings screen. Today the rules are hard-coded or live in the database: thresholds sit in `attendance_thresholds`, which was found empty in production (migration 0047), and the shift types are fixed in `shift-types.ts`.

| # | Feature | What it means | Today | Phase | Size |
|---|---|---|---|---|---|
| 2.1 | Shift lengths | A shift is hours worked plus an unpaid break (defaults 11+1, 10+1, 8+1; at most 12 h on site). The start time is set on the roster. Add, edit or retire a length, and see how many shifts each one is used on. | Fixed in code (`SHIFT_TYPES`: 11h, 10h, 8h) | P1 | S |
| 2.2 | Attendance rules per access level | Grace before late, the no-show line, early clock-in limit, breaks, auto clock-out, rounding. Set separately for Employee, Floater and Manager. Floaters get a "covering a shift" variant. | Database table, no screen. No-show becomes a setting, default 60 min (decided 12 Oct); update the "60 minutes, everywhere" line in opspro-app's CLAUDE.md. | P1 | M |
| 2.3 | Weekly offs | Set once for the organisation, minimum 1. Either staggered on the roster, with a "most people off at one location on the same day" warning, or the same day(s) for everyone (e.g. Sunday). Also: most working days in a row, and what happens when someone works their off day. A roster that breaks the rule can't be uploaded or published. | None | P1 | M |
| 2.4 | Leave types and public holidays | Per type: days a year, paid or unpaid, carry over, most days per request, certificate after N days. UAE holiday calendar, with moon-sighting dates confirmed when announced. | None | P1 | S |
| 2.5 | Roles and access | The four access cards, the designation-to-access table, and locking after first use (see 1.3). | None | P1 | S |
| 2.6 | Cover rules | Where cover can come from, floaters first, same vendor first, nearest first, whether people on a weekly off can be asked, and how covers are billed. | Hard-coded in the cover code | P1 | S |

## 3. Ops dashboard

| # | Feature | What it means | Today | Phase | Size |
|---|---|---|---|---|---|
| 3.1 | **Map on the Home / Liveboard** | A map of every store with its live state (all in, late, no-show), opening framed on all stores, filters, count tiles over the map, and a store list underneath with each person's timeline. | **Partial.** The live dashboard has KPI tiles and a store list but no map. Use Google Maps, already loaded for Locations through `src/lib/google-maps.ts` (decided 12 Oct). | P1 | M |
| 3.2 | Mark attendance from the Liveboard | For a no-show: "They're here" (time and reason) or "They're not coming" (absent, excused or not), plus Find cover right there. | None | P1 | S |
| 3.3 | Phone punches on the live board and hours screens | Show punches from the phone app, and let ops cancel a suspicious one. | Only the activity drawer labels them (handoff open item) | P1 | S |
| 3.4 | Notifications redesign | Filter tiles that double as counts. Review outcomes (false alarm, excused, confirmed) feed the worker's score. | **Partial.** Alerts list with review outcomes exists. | P1 | S |
| 3.5 | **Roster redesign** | Week grid by location with a floaters band. More than one shift a day, at different locations, each a length plus a start time. A day drawer with a timeline and overlap and travel-time checks. A daily off count per location. Unacknowledged markers. A phone-width day view. | **Partial.** A roster with slots, copy forward, copy days, import, cover, relievers and locking exists (2,860 lines). Needs reworking around the new model. | P1 | L |
| 3.6 | Drafts and publish | Weeks up to 4 ahead stay drafts until published. Publish shows counts and checks; weekly-off breaks block it. Choose whether to notify everyone or only those whose shifts changed, and ask workers to acknowledge. | None (there is a lock, but no draft or publish) | P1 | M |
| 3.7 | Copy weeks | An empty week offers Copy, Upload or Start blank. Copy any week into 1–4 weeks for chosen locations: covers dropped, leave turned back into the usual shift, approved leave filled in. "Same shifts on other days" in the day drawer. | **Partial.** Copy forward and copy days exist. | P1 | M |
| 3.8 | Roster upload | Download an Excel template already filled with the week. Upload .xlsx, .xls or .csv. Columns are matched by name, and many time formats are accepted. Any error rejects the whole file, reported by row and column, with a downloadable error report. A partial file only changes the workers it lists. | **Partial.** A schedule import screen exists (papaparse + exceljs). Port `src/lib/rosterio.js` from the prototype. | P1 | M |
| 3.9 | **Floaters** (relievers made general) | Floater is an access level, not a special case. Floaters belong to a vendor, have a home area, and are "available" until they cover. Cover suggestions go floaters first, then people on a day off, same vendor first, then nearest. A cover shows at the covered location. | **Partial.** Relievers with a base area and cover candidates exist (migrations 0031, 0032). Relievers *are* floaters (decided 12 Oct): rename and extend, no second model. | P1 | M |
| 3.10 | **Leave** (new) | Requests from the phone. Approve or reject, seeing who's already off, with cover suggestions for each day. Balances where the type tracks them. Approved leave drops into the roster. | None | P1 | L |
| 3.11 | Workforce redesign | List columns: today, month so far, score, documents. Filters for floaters and location. Drawer tabs: overview (access, this week's off set on the roster), timesheet, documents, score, devices. | **Partial.** Employees list, activity, documents and expiry exist. | P1 | M |
| 3.12 | Onboarding redesign | Employee or Floater, designations filtered by access, usual shift (length plus start), face photo, review. Bulk import kept. App invites removed. | **Partial.** Onboarding wizard and bulk import exist. | P1 | S |
| 3.13 | Vendors | Vendor list with score, fill rate, no-shows and head count. Proposal pipeline from candidate to the client's staff ID. | **Partial.** A `vendors` table exists; no screen. | P1 | M |
| 3.14 | Locations | Opening hours by weekday, manager, geofence on a map. Add a cost-by-location link into Workforce. | **Exists** | P1 | S |
| 3.15 | Timesheets / overtime check | Keep the existing screens; add phone punches (3.3). | **Exists** (overtime check, payroll lock, report, projected days, invoices) | P1 | S |
| 3.16 | Performance | Per-metric thresholds with strip plots, score weights, list of who's flagged. | None | P2 | M |
| 3.17 | Vendor costs | Rate cards by vendor; cost by location (days, cost, cost per day, overtime share, cover days) linking to Workforce; statements. | **Partial.** Invoices and payroll exist; no rate cards. | P2 | M |
| 3.18 | Forms | Builder with a live phone preview, templates (temperature log, vehicle check, patrol, incident, fit for work, handover), required-before-clock-in forms, submissions. | None | P2 | L |
| 3.19 | Announcements | Post to locations or groups, with read receipts. | None | P2 | M |

## 4. Vendor portal (new, separate login)

| # | Feature | What it means | Today | Phase | Size |
|---|---|---|---|---|---|
| 4.1 | Vendor login and scoping | Vendor users see only their own workers. Nothing about other vendors or what they charge. | None | P1 | M |
| 4.2 | Overview | Clocked in now, late, no-shows, vendor score; today by location; proposals; score trend. | None | P1 | S |
| 4.3 | My workers | Same columns as Workforce, read-only. Document expiry is the vendor's to fix. | None | P1 | S |
| 4.4 | Attendance | Week grid (In, Late, Absent, Leave, Off, Standby, rostered start for future days) with today highlighted. | None | P1 | S |
| 4.5 | Proposals | Propose candidates and track them through to the client's staff ID. | None | P1 | M |
| 4.6 | Scorecard, requests, statements | Score breakdown; headcount requests from the client; monthly statements. | None | P2 | M |

## 5. Phone app

| # | Feature | What it means | Today in opspro-picker-app | Phase | Size |
|---|---|---|---|---|---|
| 5.1 | Picker clock in and out | Face, location and device checks; offline punches queued. | **Exists** (Android; Play Integrity, device enrolment, server-side face check) | P1 | — |
| 5.2 | Required form before clock-in | Show the location's required form (e.g. temperature log) at clock-in. | None (depends on 3.18) | P2 | S |
| 5.3 | Leave requests | Ask for leave, see status and balance. | None (depends on 3.10) | P1 | S |
| 5.4 | Roster acknowledgement | Confirm the published week; "off this week" read from the roster. | **Partial.** A week screen exists. | P1 | S |
| 5.5 | **Supervisor app** | Same app, different sign-in. Today at my locations, alerts, people, mark attendance, find cover, approve leave. | None (picker only) | P1 | L |
| 5.6 | One app, sign-in decides the role | A first screen choosing "I work shifts" or "I run locations"; picker by setup code, supervisor by email. | None | P1 | S |
| 5.7 | iPhone | App Attest in place of Play Integrity. | Later (iOS build work merged; attest not built) | P2 | M |
| 5.8 | Phone-only pickers in no-show detection | Include pickers with an active phone but no face photo. | Founder decision pending (handoff) | P1 | S |

## 6. Decisions made (12 Oct)

1. **Map:** Google Maps for the Home map, as on Locations. The prototype now uses it too.
2. **No-show:** a setting per access level, default 60 minutes.
3. **Relievers are floaters:** one model, not two.
4. **Restyle:** the restyle worktree is gone; the prototype's design system is the target.
5. **Defaults:** every new setting starts at today's opspro-app value (table at the top).
6. **Ramadan:** nothing to build. Supervisors load shorter shifts themselves.

## Suggested order

1. Platform first: multitenancy (1.1), access levels (1.3), security items (1.5). Everything else builds on these.
2. Settings (2.x), so rules stop living in code.
3. Roster: redesign, drafts and publish, copy, upload, floaters, weekly offs (3.5–3.9, 2.3).
4. Home map and Liveboard actions (3.1–3.3).
5. Leave, end to end: settings, dashboard, phone (2.4, 3.10, 5.3).
6. Vendor portal (4.x) and vendors (3.13).
7. Supervisor app (5.5, 5.6).
8. P2: performance, vendor costs, forms, announcements, iPhone.
