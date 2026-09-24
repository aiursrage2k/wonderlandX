import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, src, x, y, w, h, out] = process.argv;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w * 2, height: +h * 2 } });
const data = fs.readFileSync(src).toString('base64');
await p.setContent(`<body style="margin:0;overflow:hidden"><div style="width:${w*2}px;height:${h*2}px;background:url(data:image/png;base64,${data}) -${x*2}px -${y*2}px / ${1280*2}px ${720*2}px;image-rendering:pixelated"></div>`);
await p.screenshot({ path: out }); await b.close();
