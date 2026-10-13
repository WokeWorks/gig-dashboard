// Smoke test: opens the built prototype in headless Chromium, visits every screen of every persona,
// and fails if any page error is thrown. Run with `npm run check` (builds first).
// React is swapped to the local node_modules copy so the test runs without network access.
// Set CHROMIUM_PATH to use a specific browser binary (for example /opt/pw-browsers/chromium).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(root, 'dist/opspro-prototype.html'), 'utf8')
  .replace('https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js', '../node_modules/react/umd/react.production.min.js')
  .replace('https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js', '../node_modules/react-dom/umd/react-dom.production.min.js');
const testFile = path.join(root, 'dist/test.html');
fs.writeFileSync(testFile, html);

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`${current}: ${e.message}`));
let current = 'load';

await page.goto('file://' + testFile);
await page.waitForTimeout(500);
for (const persona of ['Client', 'Vendor', 'Phone']) {
  current = persona;
  await page.click(`.persona-sw button:has-text("${persona}")`);
  await page.waitForTimeout(200);
  let n = 0;
  if (persona === 'Phone') {
    // The phone has two apps (picker, supervisor); open each, then every screen in its list.
    for (const app of ['Picker app', 'Supervisor app']) {
      await page.click(`.op-apphead:has-text("${app}")`);
      await page.waitForTimeout(150);
      const screens = await page.$$eval('.op-navitem', (els) => els.map((e) => e.innerText.trim()));
      for (let i = 0; i < screens.length; i++) {
        current = `${persona} › ${app} › ${screens[i]}`;
        await page.click(`.op-navitem >> nth=${i}`);
        await page.waitForTimeout(120);
        n++;
      }
    }
  } else {
    const items = await page.$$eval('.side-item', (els) => els.map((e) => e.innerText.split('\n')[0].trim()));
    for (let i = 0; i < items.length; i++) {
      current = `${persona} › ${items[i]}`;
      await page.click(`.side-item >> nth=${i}`);
      await page.waitForTimeout(150);
      n++;
    }
  }
  console.log(`${persona}: ${n} screens`);
}
await browser.close();

if (errors.length) { console.error('Page errors:\n' + errors.join('\n')); process.exit(1); }
console.log('No page errors.');
