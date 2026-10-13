// Builds the whole prototype into one self-contained HTML file: dist/opspro-prototype.html
//   npm run build          one build
//   npm run watch          rebuild on every change in src/
// React and ReactDOM load from cdnjs and the map from Google Maps at runtime; JS and CSS are inlined.
import { context, build } from 'esbuild';
import fs from 'node:fs';

// Settings that must not be committed (the repo is public) come from the environment or a local .env file:
//   GOOGLE_MAPS_API_KEY=...   Google Maps key for the Liveboard map (the same key opspro-app uses).
const env = { ...Object.fromEntries((fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split('\n').map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')])), ...process.env };
if (!env.GOOGLE_MAPS_API_KEY) console.log('note: no GOOGLE_MAPS_API_KEY in .env, so the Liveboard map will ask for one');

const OPTS = { define: { __GMAPS_KEY__: JSON.stringify(env.GOOGLE_MAPS_API_KEY || '') }, entryPoints: ['src/main.jsx'], bundle: true, format: 'iife', write: false, minify: true, jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', loader: { '.jsx': 'jsx' }, target: 'es2020' };

function write(result) {
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = fs.readFileSync('src/style.css', 'utf8');
  const html = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpsPro</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6.5' fill='%231B5746'/%3E%3Cpath d='M6 8.2h7.5M10.5 12h7.5M6 15.8h4.5' stroke='%23fff' stroke-width='2.6' stroke-linecap='round'/%3E%3Ccircle cx='16.4' cy='15.8' r='2.1' fill='%23fff'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/opspro-prototype.html', html);
  console.log(`built dist/opspro-prototype.html (${(html.length / 1e6).toFixed(1)} MB)`);
}

if (process.argv.includes('--watch')) {
  const ctx = await context({ ...OPTS, plugins: [{ name: 'out', setup(b) { b.onEnd((r) => { if (!r.errors.length) write(r); }); } }] });
  await ctx.watch();
  console.log('watching src/ …');
} else {
  write(await build(OPTS));
}
