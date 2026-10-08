// Headless harness for Grey City Blues: node tools/noir-shot.mjs <outdir> [script.mjs]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p.endsWith('/') ? p + 'index.html' : p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(0);
const port = server.address().port;
const out = process.argv[2] || '.';
const script = process.argv[3] ? (await import(path.resolve(process.argv[3]))).default : null;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(`http://localhost:${port}/noir/index.html?debug${process.env.Q || ''}`);
await page.waitForFunction(() => window.__noir, null, { timeout: 120000 }).catch(() => errors.push('boot timeout'));
const shot = (n) => page.screenshot({ path: path.join(out, n + '.png') });
if (script) await script(page, shot);
else await shot('boot');
console.log(errors.slice(0, 40).join('\n') || 'no errors');
await browser.close();
server.close();
