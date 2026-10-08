// Builds the whole prototype into one self-contained HTML file: dist/opspro-prototype.html
//   npm run build          one build
//   npm run watch          rebuild on every change in src/
// React and ReactDOM load from cdnjs at runtime; everything else (JS, CSS, Leaflet CSS, map tiles) is inlined.
import { context, build } from 'esbuild';
import fs from 'node:fs';

const OPTS = { entryPoints: ['src/main.jsx'], bundle: true, format: 'iife', write: false, minify: true, jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', loader: { '.jsx': 'jsx' }, target: 'es2020' };

// Cached OpenStreetMap tiles for Dubai (map/tiles/{z}/{x}/{y}.png) are embedded so the Liveboard map
// works offline and inside sandboxed previews. Outside that area the map falls back to the live OSM servers.
function tilesScript() {
  const dir = 'map/tiles';
  if (!fs.existsSync(dir)) return '';
  const o = {};
  for (const z of fs.readdirSync(dir)) for (const x of fs.readdirSync(`${dir}/${z}`)) for (const f of fs.readdirSync(`${dir}/${z}/${x}`)) o[`${z}/${x}/${f.replace('.png', '')}`] = fs.readFileSync(`${dir}/${z}/${x}/${f}`).toString('base64');
  return `<script>window.OSM_TILES=${JSON.stringify(o)}</script>`;
}

function write(result) {
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8') + '\n' + fs.readFileSync('src/style.css', 'utf8');
  const html = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpsPro Prototype</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap">
<style>${css}</style>
<div id="root"></div>
${tilesScript()}
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
