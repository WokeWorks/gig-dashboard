# Working on this repo

OpsPro prototype: React 18 (UMD globals, no imports of react), esbuild, one HTML output. All data is mocked in `src/data.js`; there is no backend. See README.md for the product and layout.

## Commands

- `npm run build`: bundle to `dist/opspro-prototype.html`
- `npm run check`: build plus a headless click-through of every screen; must print "No page errors." before you commit. In the cloud container use `CHROMIUM_PATH=/opt/pw-browsers/chromium`.

## Conventions

- One file per Ops screen in `src/screens/ops/`, registered in `index.js`. Logic shared by more than one screen goes in `src/lib/`. Screens never import other screens.
- `React`, `useState`, `useEffect` and friends are globals from the UMD build. Don't `import React`.
- All UI copy is plain, sentence-case English. No uppercase labels, no jargon. Status words are short ("In", "Late", "Absent", "Leave", "Off").
- Metric tiles use `Stat` from `ui.jsx`: plain card, the number coloured by tone, sentence-case label. Status chips use `Pill`. Day outcomes in week grids use `.dchip`.
- Colours come from CSS tokens on `:root` (`--good`, `--warn`, `--crit`, `--info`, their `-soft` variants, `--line`, `--muted`). Dark mode is handled by the tokens; never hard-code colours.
- Drawers (`Drawer`) are for editing one thing; modals only for confirmations. Toasts confirm actions.
- Each screen header shows its phase (P1, P2, P3) and spec section via `ScreenHeader`.

## Domain model (the parts that bite)

- **Access levels:** Employee, Floater, Manager, Admin. Designations map to them in `DESIG_ACCESS` (Reliever → Floater). `isFloat(w)` tells floaters apart. A designation's access is locked once anyone holds it.
- **Floaters** belong to a vendor, not a manager. They sit in the pool group (`site: 'pool'`, `float: true`). Cells are `'A'` (available, unpaid) until they cover a shift.
- **Roster cells** (`ROSTER_GROUPS[].cells[row][day]`): `'O'` weekly off, `'L'` leave, `'X'` not rostered, `'A'` available (floaters), or an array of shifts `[templateId, start, siteId?, coveredWorkerId?, prevCell?]`. Days are 0 = Mon … 6 = Sun.
- **Shift templates** are lengths only: `base` hours worked + `brk` unpaid break (defaults from opspro-app: 11+1, 10+1, 8+1; `spanOf` gives time on site, at most `MAX_ON_SITE` = 12 h). The start time is set on the roster.
- **Cover engine** (`coverCands`, `COVER_RULES` in `src/lib/cover.jsx`): floaters first, then people on a day off; same vendor first, then nearest.
- **Weekly offs** (`OFF_RULES` in `src/lib/offs.js`): set once for the organisation, minimum 1. Mode `'roster'` staggers offs week by week (warning when too many are off at one location on one day); mode `'fixed'` gives everyone the same day(s), e.g. Sunday. Never set per worker. A roster that breaks the rule is rejected on upload and can't be published (`offErrors`).
- **Attendance rules** are per access level (Employee, Floater, Manager), except weekly offs and overtime, which are organisation-wide.
- **Roster in and out** (`src/lib/rosterio.js`): copying a week carries shifts and weekly offs only; covers are dropped, leave reverts to the usual shift, then approved leave for the target week is applied. Uploads accept .xlsx/.xls/.csv via SheetJS (`xlsx`); columns are matched by header name, cells accept `07:00-19:00` (time on site), `7-7`, `7am to 7pm`, `07:00 11h` (hours worked), `OFF`, `LEAVE`, `A + B`, `… @ Location`. Any error rejects the whole file and is reported by spreadsheet row and column. Workers missing from the file keep their existing week. Rosters can be planned up to `MAXWK` weeks ahead.
- **Roster actions** (carried over from opspro-app), behind a "more" menu on hover (`useMenu` in `ui.jsx`): each worker row has copy week forward (`copyWeek(..., workers)` copies just that row), clear days and save as picture (PNG via `html-to-image`); each location header has copy forward and save as picture. The day drawer edits a shift in place, finds cover for any rostered shift (`findCover(absent, site, day, shift, why)`), marks a weekly off and offers "Same as last week". Past days, and today once the worker has clocked in (`clockedIn`, from `liveOf`), open read-only: what was rostered, clocked in or missed, and a link to their timesheet.
- **Vendor portal clients** (`VCLIENTS` in `src/vendor.jsx`): a vendor supplies several clients. Deliveroo UAE uses the live prototype data; Talabat Mart and Al-Futtaim Logistics are small mock clients. The sidebar picker (`ClientPicker`, saved as `ops.vclient`) passes `client` ('all' or an id) to every vendor screen; on 'all' lists get a Client column.
- **Leave types** have days a year, pay, carry over, per-request limit and certificate rule.

## Gotchas

- The Liveboard map is Google Maps, as in opspro-app (`loadGoogleMaps` and `MAP_STYLES` in `src/lib/geo.js`; light and dark styles follow the theme). Store pins are our own HTML on a `google.maps.OverlayView`. The key comes from `GOOGLE_MAPS_API_KEY` in `.env` at build time; never commit it, the repo is public.
- The roster's sticky headers sit under drawers via `.overlay { z-index: 200 }`.
- Settings mutate shared rule objects (`OFF_RULES`, `DESIG_ACCESS`) so other screens pick them up on their next render; there is no global store.
