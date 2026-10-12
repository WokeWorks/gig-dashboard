// Serves the built prototype at http://localhost:5173 so a Google Maps key restricted to certain
// websites can allow it (a page opened from disk has no address to allow). Run `npm run build` first.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'dist');
const port = Number(process.env.PORT) || 5173;
http.createServer((req, res) => {
  const file = path.join(root, 'opspro-prototype.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('Run npm run build first.'); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`OpsPro prototype at http://localhost:${port}`));
