# OpsPro: gig workforce dashboard

A workforce platform for contracted gig and blue-collar labour supplied by several manpower vendors to one client. Ops builds the weekly roster, workers clock in on their phones, vendors see their own people, and everyone is scored on attendance.

This repo is the **clickable prototype**: React, all data mocked in the browser, built into one self-contained HTML file. The first client is GH FZE, supplying pickers to Deliveroo UAE grocery locations in Dubai.

**Live prototype:** https://claude.ai/artifact/QG5E8AoyoiGVX4V1mYhXqk

## Three surfaces

Switch between them with the tabs at the top of the prototype.

- **Ops dashboard:** for the client's operations team. Liveboard with a map, notifications, the roster, leave, workforce, onboarding, vendors, locations, performance, vendor costs, forms (phase 2), announcements and settings.
- **Vendor portal:** for each manpower vendor. Its own workers, their attendance and scorecard, proposals for new hires, requests and statements. A vendor never sees other vendors or what they charge.
- **Phone app:** one app for everyone. A picker clocks in and out (face, location, any required form), sees their schedule and asks for leave. A supervisor sees who is in at their locations, finds cover and handles approvals.

## How it differs from shift marketplaces

Instawork, Shiftsmart and Indeed Flex are marketplaces: the platform employs the worker and the client posts open shifts. OpsPro assumes the opposite. Workers are employed by vendors, work a recurring roster, and the client manages several vendors in one place. That is why the vendor portal, vendor scores, floaters and enforced weekly offs exist.

## Run it

```bash
npm install
npm run build        # writes dist/opspro-prototype.html; open it in a browser
npm run watch        # rebuilds on every change to src/*.jsx (restart for style.css changes)
npm run check        # build, then click through every screen headless and fail on any page error
```

`npm run check` uses Playwright's Chromium. If Playwright can't find a browser, either run `npx playwright install chromium` or point it at one: `CHROMIUM_PATH=/path/to/chromium npm run check`.

React loads from cdnjs and the Liveboard map loads live basemap tiles from CARTO, so both need an internet connection. Everything else is inlined into the HTML. CARTO needs a key: get one free at [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/), copy `.env.example` to `.env` and set `MAP_KEY`, then rebuild. Without it the map shows an "API key required" watermark. The free tier covers 1M tile requests a month for commercial use; the tile URLs live in `MAP_TILES` in `src/lib/geo.js`.

## Layout

```
src/
  main.jsx         app shell: top bar, persona tabs, side navigation, routing
  data.js          all mock data: workers, sites, vendors, roster, shift templates, alerts, leave
  ui.jsx           shared components: Stat, Pill, Tabs, Drawer, Modal, Field, Toggle, Icon, toasts
  style.css        all styles, light and dark
  screens/ops/     one file per Ops dashboard screen (index.js lists them in nav order)
  vendor.jsx       Vendor portal screens
  phone.jsx        Phone app (picker and supervisor flows) with its screen list
  camera.jsx       clock-in camera check used by the phone app
  forms.jsx        Forms builder, phone preview, submissions (phase 2)
  lib/
    roster.js      roster helpers: next week, usual shift, hours, timesheets, missed clock-ins
    offs.js        weekly off rules and the checks run on upload and publish
    rosterio.js    copying weeks, the Excel/CSV template, and reading uploaded rosters
    cover.jsx      cover rules, candidate ranking and the Find cover drawer
    live.js        today's live status per location and per worker
    leave.js       leave types and UAE public holidays
    geo.js         site coordinates and distances
    dates.js       day names, week labels, time maths
scripts/smoke.mjs  headless click-through test
build.mjs          esbuild bundle into one HTML file
```

## Map data

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, basemap © [CARTO](https://carto.com/attributions). Attribution is shown on the map.
