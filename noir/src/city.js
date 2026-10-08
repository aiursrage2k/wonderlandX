// Rain City. One fixed city (same seed every case): a 12x12 grid of blocks cut
// by 4-lane roads, with empty lots, banks, casinos on the Strip, the docks, the
// rail yards, City Hall, the Last Drop, and the Holy Glaze donut shop.
import * as THREE from 'three';
import { nmat, noirify } from './paint.js';
import { mulberry32 } from './util.js';
import { makeCar, makeCop, makeMayor } from './models.js';

export const C = { N: 16, B: 56, R: 24, P: 80, half: 652, edge: 648, span: 1400 };
export const roadC = (i) => -640 + i * C.P; // road centerline, i = 0..16
export const blockMin = (j) => -628 + j * C.P; // block j spans [min, min + 56]
export const nodeIndex = (v) => Math.max(0, Math.min(C.N, Math.round((v + 640) / C.P)));

export function districtOf(bx, bz) {
  if ((bz === 7 || bz === 8) && bx >= 5) return 'The Strip';
  if (bx >= 6 && bx <= 8 && bz <= 5) return 'Civic Center';
  if (bz >= 13 && bx <= 10) return 'The Docks';
  if (bx >= 11 && bz >= 9) return 'Rail Yards';
  if (bx >= 9 && bz <= 6) return 'Financial District';
  if (bx <= 5 && bz <= 4) return 'Old Town';
  if (bx <= 4 && bz >= 5 && bz <= 10) return 'Little Saxophone';
  return 'Southside';
}

const rect = (bx0, bz0, bx1, bz1) => ({ x0: blockMin(bx0), z0: blockMin(bz0), x1: blockMin(bx1) + 56, z1: blockMin(bz1) + 56 });
export const DISTRICTS = {
  'Old Town': rect(0, 0, 5, 4),
  'Financial District': rect(9, 0, 15, 6),
  'Civic Center': rect(6, 0, 8, 5),
  'Little Saxophone': rect(0, 5, 4, 10),
  'The Strip': rect(5, 7, 15, 8),
  'Southside': rect(5, 9, 10, 12),
  'The Docks': rect(0, 13, 10, 15),
  'Rail Yards': rect(11, 9, 15, 15),
};

const blockCenter = (bx, bz) => ({ x: blockMin(bx) + 28, z: blockMin(bz) + 28 });

// landmarks: positions filled during build
export const L = {
  office: { b: [2, 2], name: 'Malone Investigations' },
  bar: { b: [4, 4], name: 'The Last Drop' },
  park: { b: [1, 1], name: 'Mercy Park' },
  park2: { b: [3, 11], name: 'Potter\'s Field' },
  club: { b: [2, 8], name: 'The Kaleidoscope Club' },
  cityHall: { b: [7, 3], name: 'City Hall' },
  plaza: { b: [7, 4], name: 'Krane Plaza' },
  bank1: { b: [10, 2], name: 'First Grey Bank' },
  bank2: { b: [13, 3], name: 'Mercantile Trust' },
  bank3: { b: [11, 5], name: 'Union Savings & Loan' },
  bank4: { b: [15, 1], name: 'Krane Federal Reserve' },
  casino: { b: [9, 7], name: 'The Silver Dollar' },
  casino2: { b: [14, 7], name: 'Lucky Krane Casino' },
  palace: { b: [12, 8], name: 'The Prism Palace' },
  hotel: { b: [6, 8], name: 'Hotel Monaco' },
  donut: { b: [8, 10], name: 'Holy Glaze Donuts' },
  precinct: { b: [7, 10], name: '13th Precinct' },
  docks: { b: [4, 14], name: 'Pier 9' },
  rail: { b: [13, 12], name: 'Union Rail Yard' },
};
for (const k in L) Object.assign(L[k], blockCenter(...L[k].b));

// ------------------------------------------------------------ collision
export const boxes = [];
const GRID = 40, GN = Math.ceil(1440 / GRID);
const grid = Array.from({ length: GN * GN }, () => []);
const gi = (v) => Math.max(0, Math.min(GN - 1, Math.floor((v + 720) / GRID)));
export function addBox(x0, z0, x1, z1, h = 10, tag) {
  const b = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), h, tag };
  boxes.push(b);
  for (let i = gi(b.x0); i <= gi(b.x1); i++) for (let k = gi(b.z0); k <= gi(b.z1); k++) grid[i * GN + k].push(b);
  return b;
}
const seen = new Set();
function near(x0, z0, x1, z1, fn) {
  seen.clear();
  for (let i = gi(x0); i <= gi(x1); i++) for (let k = gi(z0); k <= gi(z1); k++) {
    for (const b of grid[i * GN + k]) { if (!seen.has(b)) { seen.add(b); fn(b); } }
  }
}

// Push a circle out of every box. Returns the last contact normal or null.
const _n = { x: 0, z: 0, hit: false };
export function pushOut(p, r) {
  _n.hit = false;
  near(p.x - r, p.z - r, p.x + r, p.z + r, (b) => {
    const cx = Math.max(b.x0, Math.min(p.x, b.x1));
    const cz = Math.max(b.z0, Math.min(p.z, b.z1));
    let dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return;
    if (d2 < 1e-6) {
      // centre inside the box: shove out the nearest side
      const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bb = b.z1 - p.z;
      const m = Math.min(l, rr, t, bb);
      if (m === l) { p.x = b.x0 - r; dx = -1; dz = 0; } else if (m === rr) { p.x = b.x1 + r; dx = 1; dz = 0; } else if (m === t) { p.z = b.z0 - r; dx = 0; dz = -1; } else { p.z = b.z1 + r; dx = 0; dz = 1; }
    } else {
      const d = Math.sqrt(d2);
      dx /= d; dz /= d;
      p.x = cx + dx * r; p.z = cz + dz * r;
    }
    _n.x = dx; _n.z = dz; _n.hit = true;
  });
  p.x = Math.max(-C.edge, Math.min(C.edge, p.x));
  p.z = Math.max(-C.edge, Math.min(C.edge, p.z));
  return _n.hit ? _n : null;
}

// Distance along a ray until it hits a box (slab test), or maxD.
export function rayDist(ox, oz, dx, dz, maxD) {
  let best = maxD;
  const ex = ox + dx * maxD, ez = oz + dz * maxD;
  near(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez), (b) => {
    let t0 = 0, t1 = best;
    if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) return; } else {
      let a = (b.x0 - ox) / dx, c = (b.x1 - ox) / dx;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    }
    if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) return; } else {
      let a = (b.z0 - oz) / dz, c = (b.z1 - oz) / dz;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    }
    if (t0 <= t1 && t0 < best) best = t0;
  });
  return best;
}
export const clearLine = (ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
  if (d < 0.01) return true;
  return rayDist(ax, az, dx / d, dz / d, d) >= d - 0.01;
};

// random point on a road lane, optionally inside a rect
export function roadPoint(area, rnd = Math.random) {
  for (let tries = 0; tries < 40; tries++) {
    const horiz = rnd() < 0.5;
    const i = Math.floor(rnd() * (C.N + 1));
    const along = -640 + rnd() * 1280;
    const lane = (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 7);
    const x = horiz ? along : roadC(i) + lane;
    const z = horiz ? roadC(i) + lane : along;
    if (!area || (x > area.x0 - 12 && x < area.x1 + 12 && z > area.z0 - 12 && z < area.z1 + 12)) return { x, z };
  }
  return { x: roadC(6), z: roadC(6) };
}

// ------------------------------------------------------------ geometry merge
class Merger {
  constructor() { this.p = []; this.n = []; this.u = []; this.i = []; }
  quad(a, b, c, d, n, ua, ub, uc, ud) {
    const s = this.p.length / 3;
    for (const v of [a, b, c, d]) this.p.push(v[0], v[1], v[2]);
    for (let k = 0; k < 4; k++) this.n.push(n[0], n[1], n[2]);
    this.u.push(...ua, ...ub, ...uc, ...ud);
    this.i.push(s, s + 1, s + 2, s, s + 2, s + 3);
  }
  // box with world-scaled uvs: x0..x1, y0..y1, z0..z1
  box(x0, y0, z0, x1, y1, z1, s = 8, uo = 0, vo = 0, top = true) {
    const v = (y) => y / s + vo;
    // +z face
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [x0 / s + uo, v(y0)], [x1 / s + uo, v(y0)], [x1 / s + uo, v(y1)], [x0 / s + uo, v(y1)]);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [-x1 / s + uo, v(y0)], [-x0 / s + uo, v(y0)], [-x0 / s + uo, v(y1)], [-x1 / s + uo, v(y1)]);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [-z1 / s + uo, v(y0)], [-z0 / s + uo, v(y0)], [-z0 / s + uo, v(y1)], [-z1 / s + uo, v(y1)]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [z0 / s + uo, v(y0)], [z1 / s + uo, v(y0)], [z1 / s + uo, v(y1)], [z0 / s + uo, v(y1)]);
    if (top) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0 / s, z1 / s], [x1 / s, z1 / s], [x1 / s, z0 / s], [x0 / s, z0 / s]);
  }
  flat(x0, z0, x1, z1, y, s = 8) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [x0 / s, z1 / s], [x1 / s, z1 / s], [x1 / s, z0 / s], [x0 / s, z0 / s]);
  }
  geo(g, m) {
    const ng = g.index ? g.toNonIndexed() : g.clone();
    ng.applyMatrix4(m);
    const pa = ng.attributes.position.array, na = ng.attributes.normal.array, ua = ng.attributes.uv ? ng.attributes.uv.array : null;
    const s = this.p.length / 3;
    for (let k = 0; k < pa.length; k++) { this.p.push(pa[k]); this.n.push(na[k]); }
    const cnt = pa.length / 3;
    for (let k = 0; k < cnt; k++) { this.u.push(ua ? ua[k * 2] : 0, ua ? ua[k * 2 + 1] : 0); this.i.push(s + k); }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}
const M4 = new THREE.Matrix4();
const tr = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) =>
  M4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

// ------------------------------------------------------------ textures
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function speckle(g, w, h, n, base, spread, size = 2) {
  for (let i = 0; i < n; i++) {
    const v = base + (Math.random() - 0.5) * spread;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}

// facade: 1024px = 32 world units; 8 floors x 8 bays of 4 units
function facade(style, lit) {
  const rnd = mulberry32(style === 'brick' ? 7 : style === 'concrete' ? 11 : 13);
  return canvasTex(1024, 1024, (g, w, h) => {
    if (lit) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); } else {
      g.fillStyle = style === 'brick' ? '#6a6460' : style === 'concrete' ? '#8a8a88' : '#555';
      g.fillRect(0, 0, w, h);
      speckle(g, w, h, 9000, style === 'brick' ? 100 : 135, 50, 3);
      if (style === 'brick') {
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let y = 0; y < h; y += 12) { g.fillRect(0, y, w, 2); for (let x = (y / 12) % 2 ? 0 : 14; x < w; x += 28) g.fillRect(x, y, 2, 12); }
      }
      // floor ledges
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (let y = 0; y < h; y += 128) g.fillRect(0, y + 120, w, 8);
      // rain streak stains
      for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.12})`;
        g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 40 + rnd() * 200);
      }
    }
    for (let fy = 0; fy < 8; fy++) for (let fx = 0; fx < 8; fx++) {
      const x = fx * 128 + 30, y = fy * 128 + 22, ww = 68, hh = style === 'strip' ? 92 : 80;
      const on = rnd() < (style === 'strip' ? 0.7 : 0.28);
      if (lit) {
        if (!on) continue;
        const b = 140 + rnd() * 115;
        g.fillStyle = `rgb(${b},${b * 0.95},${b * 0.85})`;
        g.fillRect(x, y, ww, hh);
        g.fillStyle = 'rgba(0,0,0,0.5)';
        if (rnd() < 0.5) for (let k = 0; k < hh; k += 7) g.fillRect(x, y + k, ww, 3); // blinds
        else if (rnd() < 0.3) g.fillRect(x + 10, y + 30, 20, 50); // a silhouette
      } else {
        g.fillStyle = '#1a1b1d'; g.fillRect(x - 5, y - 5, ww + 10, hh + 10);
        g.fillStyle = on ? '#b8b3a6' : '#24272b'; g.fillRect(x, y, ww, hh);
        g.fillStyle = '#1a1b1d'; g.fillRect(x + ww / 2 - 2, y, 4, hh); g.fillRect(x, y + hh / 2 - 2, ww, 4);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y, ww * 0.4, hh);
      }
    }
  });
}

function textTex(text, { w = 512, h = 128, font = 'bold 80px Georgia', fg = '#fff', bg = 'rgba(0,0,0,0)', border = false } = {}) {
  // squeeze long words to fit the sign instead of cropping them
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const tw = probe.measureText(text).width;
  const fit = Math.min(1, (w - 40) / tw);
  return canvasTex(w, h, (g) => {
    g.save();
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); }
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.translate(w / 2, h / 2 + 4); g.scale(fit, 1);
    g.fillText(text, 0, 0);
    g.restore();
  }, false);
}

// ------------------------------------------------------------ build
export const lamps = [];
export const vents = [];
export const cops = [];
export const copCars = [];
export const flaskSpots = [];
export const signs = [];

// Static props (wrecks, parked cruisers, the statue) are baked into one mesh
// per material so the city stays cheap to draw.
const bakers = new Map();
function bake(root) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    let v = o; let shown = true;
    while (v) { if (!v.visible) shown = false; v = v.parent; }
    if (!shown) return;
    if (!bakers.has(o.material)) bakers.set(o.material, new Merger());
    bakers.get(o.material).geo(o.geometry, o.matrixWorld);
  });
}

export function buildCity(scene) {
  const rnd = mulberry32(1947);
  const tex = {
    brick: facade('brick'), brickL: facade('brick', true),
    conc: facade('concrete'), concL: facade('concrete', true),
    strip: facade('strip'), stripL: facade('strip', true),
  };
  const roofTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#4a4a4a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 6000, 70, 50, 2); g.strokeStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h); g.lineTo(Math.random() * w, Math.random() * h); g.stroke(); } });
  // asphalt: low-contrast aggregate, tar seams, oil stains, patched squares
  const asphalt = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#303134'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { // broad tonal variation
      const r = 20 + Math.random() * 90, x = Math.random() * w, y = Math.random() * h, v = 38 + Math.random() * 22;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${v},${v},${v + 2},0.35)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    speckle(g, w, h, 60000, 52, 14, 1.5);
    for (let i = 0; i < 18; i++) { // patched squares
      const x = Math.random() * w, y = Math.random() * h, pw = 40 + Math.random() * 140, ph = 30 + Math.random() * 90;
      g.fillStyle = `rgba(20,20,22,${0.25 + Math.random() * 0.2})`; g.fillRect(x, y, pw, ph);
      g.strokeStyle = 'rgba(10,10,10,0.6)'; g.lineWidth = 2; g.strokeRect(x, y, pw, ph);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 16; i++) { // tar-sealed cracks
      g.strokeStyle = `rgba(8,8,9,${0.5 + Math.random() * 0.4})`; g.lineWidth = 2 + Math.random() * 3;
      g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (Math.random() - 0.5) * 70; y += (Math.random() - 0.5) * 70; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 26; i++) { // oil stains
      const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(5,5,6,0.6)'); gr.addColorStop(0.7, 'rgba(5,5,6,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.5 + Math.random() * 0.5), Math.random() * 3, 0, 7); g.fill();
    }
  });
  // wetness: big glossy sheets of standing water, rougher dry ridges
  const wetRough = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#5e5e5e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const r = 20 + Math.random() * 110; const x = Math.random() * w, y = Math.random() * h; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(6,6,6,0.95)'); gr.addColorStop(0.6, 'rgba(6,6,6,0.6)'); gr.addColorStop(1, 'rgba(6,6,6,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    speckle(g, w, h, 20000, 110, 40, 2);
  });
  wetRough.colorSpace = THREE.NoColorSpace;
  // sidewalk: poured slabs with seams, each slab its own shade, rain stains
  const pave = canvasTex(512, 512, (g, w, h) => {
    for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { const v = 98 + Math.random() * 22; g.fillStyle = `rgb(${v},${v},${v - 3})`; g.fillRect(x, y, 64, 64); }
    speckle(g, w, h, 16000, 110, 26, 1.5);
    g.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < w; i += 64) { g.fillRect(i, 0, 2, h); g.fillRect(0, i, w, 2); }
    for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h, r = 6 + Math.random() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  });
  const grass = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#3a3d36'; g.fillRect(0, 0, w, h); speckle(g, w, h, 12000, 60, 40, 2); });
  const dirt = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#4a4640'; g.fillRect(0, 0, w, h); speckle(g, w, h, 9000, 75, 60, 3); });

  const mats = {};
  const wall = (map, emap, ei) => {
    const m = new THREE.MeshLambertMaterial({ map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: ei });
    return noirify(m, { cut: true });
  };
  mats.brick = wall(tex.brick, tex.brickL, 0.9);
  mats.conc = wall(tex.conc, tex.concL, 0.9);
  mats.strip = wall(tex.strip, tex.stripL, 1.4);
  mats.roof = noirify(new THREE.MeshLambertMaterial({ map: roofTex }), { cut: true });
  mats.trim = nmat(0x8c8a86, { cut: true });
  mats.dark = nmat(0x3a3a3a, { cut: true });
  mats.pave = noirify(new THREE.MeshStandardMaterial({ map: pave, roughness: 0.38, metalness: 0.15, envMapIntensity: 1.3 }));
  mats.grass = noirify(new THREE.MeshLambertMaterial({ map: grass }));
  mats.dirt = noirify(new THREE.MeshLambertMaterial({ map: dirt }));
  mats.mark = nmat(0xcfcfc8, { kind: 'std', rough: 0.4 });
  mats.yellow = nmat(0xd8c060, { kind: 'std', rough: 0.4 });

  const W = { brick: new Merger(), conc: new Merger(), strip: new Merger(), roof: new Merger(), trim: new Merger(), dark: new Merger(), pave: new Merger(), grass: new Merger(), dirt: new Merger(), mark: new Merger(), yellow: new Merger() };

  // ---- ground: asphalt everywhere, raised sidewalks on blocks
  asphalt.repeat.set(1, 1);
  const roadMat = noirify(new THREE.MeshStandardMaterial({ map: asphalt, roughnessMap: wetRough, roughness: 0.32, metalness: 0.35, envMapIntensity: 1.6 }));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500, 1, 1), roadMat);
  ground.rotation.x = -Math.PI / 2;
  ground.geometry.attributes.uv.array.forEach((v, k, a) => { a[k] = v * 1500 / 48; });
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- road markings: double centre line + lane dashes on every road
  for (let i = 0; i <= C.N; i++) {
    const c = roadC(i);
    for (let j = 0; j < C.N; j++) {
      const a = blockMin(j) - 1, b = blockMin(j) + 57;
      // horizontal road at z=c, running x a..b ; vertical at x=c, running z a..b
      W.yellow.flat(a, c - 0.45, b, c - 0.2, 0.03, 4);
      W.yellow.flat(a, c + 0.2, b, c + 0.45, 0.03, 4);
      W.yellow.flat(c - 0.45, a, c - 0.2, b, 0.03, 4);
      W.yellow.flat(c + 0.2, a, c + 0.45, b, 0.03, 4);
      for (let s = a + 2; s < b - 3; s += 7) {
        for (const off of [-6, 6]) {
          W.mark.flat(s, c + off - 0.15, s + 3.5, c + off + 0.15, 0.03, 4);
          W.mark.flat(c + off - 0.15, s, c + off + 0.15, s + 3.5, 0.03, 4);
        }
      }
    }
    // crosswalks at every intersection
    for (let k = 0; k <= C.N; k++) {
      const x = roadC(i), z = roadC(k);
      for (let s = -10; s <= 10; s += 2.2) {
        W.mark.flat(x + s - 0.6, z - 15, x + s + 0.6, z - 12.6, 0.03, 4);
        W.mark.flat(x + s - 0.6, z + 12.6, x + s + 0.6, z + 15, 0.03, 4);
        W.mark.flat(x - 15, z + s - 0.6, x - 12.6, z + s + 0.6, 0.03, 4);
        W.mark.flat(x + 12.6, z + s - 0.6, x + 15, z + s + 0.6, 0.03, 4);
      }
    }
  }

  const special = {};
  for (const k in L) special[L[k].b.join(',')] = k;

  for (let bx = 0; bx < C.N; bx++) for (let bz = 0; bz < C.N; bz++) {
    const x0 = blockMin(bx), z0 = blockMin(bz), x1 = x0 + 56, z1 = z0 + 56;
    const dist = districtOf(bx, bz);
    const sp = special[`${bx},${bz}`];
    // sidewalk slab + curb
    W.pave.box(x0, 0, z0, x1, 0.3, z1, 16);
    // lamps at the four corners
    for (const [lx, lz] of [[x0 + 1.5, z0 + 1.5], [x1 - 1.5, z0 + 1.5], [x0 + 1.5, z1 - 1.5], [x1 - 1.5, z1 - 1.5]]) lamps.push({ x: lx, z: lz, h: 8, dx: lx < x0 + 28 ? -1 : 1 });
    if (sp) { buildSpecial(sp, bx, bz, x0, z0, x1, z1, W, rnd, scene, mats); continue; }
    if (rnd() < 0.08 && dist !== 'The Strip' && dist !== 'Financial District') { emptyLot(x0 + 3, z0 + 3, x1 - 3, z1 - 3, W, rnd, scene, true); continue; }
    // lots
    const nx = dist === 'The Docks' || dist === 'Rail Yards' ? 1 + Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 3);
    const nz = 1 + Math.floor(rnd() * 2);
    const ix0 = x0 + 4, iz0 = z0 + 4, iw = 48;
    for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
      const gap = rnd() < 0.5 ? 3.5 : 0.6; // alleys
      const lx0 = ix0 + (iw / nx) * a + (a ? gap / 2 : 0), lx1 = ix0 + (iw / nx) * (a + 1) - (a < nx - 1 ? gap / 2 : 0);
      const lz0 = iz0 + (iw / nz) * c + (c ? gap / 2 : 0), lz1 = iz0 + (iw / nz) * (c + 1) - (c < nz - 1 ? gap / 2 : 0);
      if (rnd() < (dist === 'Southside' ? 0.3 : dist === 'Financial District' || dist === 'The Strip' ? 0.04 : 0.17)) { emptyLot(lx0, lz0, lx1, lz1, W, rnd, scene, false); continue; }
      let h;
      if (dist === 'Financial District') h = 40 + rnd() * 70;
      else if (dist === 'Civic Center') h = 20 + rnd() * 30;
      else if (dist === 'The Docks' || dist === 'Rail Yards') h = 8 + rnd() * 8;
      else if (dist === 'The Strip') h = 22 + rnd() * 40;
      else h = 12 + rnd() * 26;
      const style = dist === 'The Strip' ? 'strip' : dist === 'Financial District' || dist === 'Civic Center' ? (rnd() < 0.7 ? 'conc' : 'brick') : rnd() < 0.7 ? 'brick' : 'conc';
      building(lx0, lz0, lx1, lz1, h, style, W, rnd);
    }
  }

  // ---- the Strip: neon signs and marquee arches along z = 0 (road 6)
  const neonWords = ['CASINO', 'LUCKY 7', 'HOTEL', 'COCKTAILS', 'GIRLS GIRLS', 'JACKPOT', 'DINE & DANCE', 'BINGO', 'GOLD RUSH', 'STARDUST', 'HIGH ROLLER', 'NITE CLUB'];
  let wi = 0;
  for (let bx = 5; bx < C.N; bx++) {
    for (const side of [-1, 1]) {
      const x = blockMin(bx) + 14 + rnd() * 28;
      const z = side * 13.5;
      const word = neonWords[wi++ % neonWords.length];
      const sgn = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), noirify(new THREE.MeshBasicMaterial({ map: textTex(word, { font: 'bold 74px Georgia', border: true }), transparent: true }), {}));
      sgn.position.set(x, 9 + rnd() * 3, z);
      scene.add(sgn);
      W.dark.box(x - 0.2, 0.3, z - 0.6, x + 0.2, sgn.position.y - 1.4, z - 0.2, 4);
      signs.push(sgn);
    }
  }
  // marquee light strings over the Strip
  const bulbGeo = new THREE.SphereGeometry(0.18, 6, 4);
  const bulbs = new THREE.InstancedMesh(bulbGeo, nmat(0xffffff, { kind: 'basic' }), 1400);
  let bi = 0;
  for (let bx = 5; bx <= C.N; bx++) {
    const x = roadC(bx);
    for (let s = -12; s <= 12 && bi < 1400; s += 1.2) { bulbs.setMatrixAt(bi++, tr(x, 7 - Math.cos((s / 12) * 1.5) * 1.5 + 1.5, s)); }
    W.dark.box(x - 0.3, 0, -13, x + 0.3, 8, -12.4, 4);
    W.dark.box(x - 0.3, 0, 12.4, x + 0.3, 8, 13, 4);
  }
  for (let x = roadC(5); x < roadC(16) && bi < 1400; x += 2.2) {
    bulbs.setMatrixAt(bi++, tr(x, 0.6, -13.2));
    bulbs.setMatrixAt(bi++, tr(x, 0.6, 13.2));
  }
  bulbs.count = bi;
  scene.add(bulbs);

  // ---- docks: water south of the city, piers and cranes
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 800), noirify(new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.08, metalness: 0.9 }), { paint: false }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -1.2, 1060);
  scene.add(water);
  W.dark.box(-660, -1.5, 652, 660, 0.2, 660, 6);
  for (let x = -620; x < 220; x += 70) {
    W.trim.box(x, -1.2, 660, x + 10, 0.4, 720, 6);
    // a crane
    W.dark.box(x + 2, 0.4, 665, x + 4, 32, 667, 6);
    W.dark.box(x + 6, 0.4, 665, x + 8, 32, 667, 6);
    W.dark.box(x - 4, 30, 664, x + 26, 32, 668, 6);
  }
  // ---- backdrop skyline outside the edges (no collision)
  for (let i = 0; i < 150; i++) {
    const side = i % 3;
    const t = -720 + rnd() * 1440;
    const w = 20 + rnd() * 30, h = 30 + rnd() * 110;
    const off = 675 + rnd() * 60;
    if (side === 0) building(t, -off - w, t + w, -off, h, 'conc', W, rnd, false);
    else if (side === 1) building(-off - w, t, -off, t + w, h, 'brick', W, rnd, false);
    else building(off, t, off + w, t + w, h, 'conc', W, rnd, false);
  }

  // ---- baked props
  for (const [mat, mg] of bakers) {
    const m = new THREE.Mesh(mg.build(), mat);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
  bakers.clear();
  // ---- finish merged meshes
  const out = {};
  for (const k in W) {
    if (!W[k].p.length) continue;
    const m = new THREE.Mesh(W[k].build(), mats[k]);
    m.receiveShadow = true;
    m.castShadow = k !== 'mark' && k !== 'yellow' && k !== 'pave' && k !== 'grass' && k !== 'dirt';
    scene.add(m);
    out[k] = m;
  }

  // ---- lamps (instanced)
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.2, 8, 6);
  const headGeo = new THREE.BoxGeometry(1.2, 0.3, 0.7);
  const poles = new THREE.InstancedMesh(poleGeo, nmat(0x2c2c2c, { kind: 'std', rough: 0.5, metal: 0.6 }), lamps.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), nmat(0x2c2c2c), lamps.length);
  const heads = new THREE.InstancedMesh(headGeo, nmat(0xffffff, { kind: 'basic', paint: false }), lamps.length);
  const streakTex = canvasTex(32, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, w, h); }, false);
  const streaks = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.2, 16), new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending }), lamps.length);
  lamps.forEach((l, i) => {
    poles.setMatrixAt(i, tr(l.x, 4, l.z));
    const hx = l.x + l.dx * 1.2;
    arms.setMatrixAt(i, tr(l.x + l.dx * 0.7, 7.9, l.z));
    heads.setMatrixAt(i, tr(hx, 7.75, l.z));
    l.hx = hx;
    const s = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    s.setPosition(hx + l.dx * 1.5, 0.05, l.z + 8.2);
    streaks.setMatrixAt(i, s);
  });
  for (const m of [poles, arms, heads, streaks]) scene.add(m);
  poles.castShadow = true;

  // ---- puddles
  const puddleMat = noirify(new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.04, metalness: 0.6, envMapIntensity: 2.2, transparent: true, opacity: 0.75 }));
  const puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20), puddleMat, 700);
  for (let i = 0; i < 700; i++) {
    const p = roadPoint(null, rnd);
    const m = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    m.scale(new THREE.Vector3(1.5 + rnd() * 4, 1 + rnd() * 2.5, 1));
    m.setPosition(p.x, 0.04, p.z);
    puddles.setMatrixAt(i, m);
  }
  puddles.receiveShadow = true;
  scene.add(puddles);

  // steam vents (manholes) along roads
  const manhole = new THREE.InstancedMesh(new THREE.CircleGeometry(0.9, 16), nmat(0x1d1d1d, { kind: 'std', rough: 0.3, metal: 0.8 }), 150);
  for (let i = 0; i < 150; i++) {
    const p = roadPoint(null, rnd);
    vents.push(p);
    const m = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    m.setPosition(p.x, 0.05, p.z);
    manhole.setMatrixAt(i, m);
  }
  scene.add(manhole);

  // pickup flask spots: alleys and lots
  for (let i = 0; i < 70; i++) flaskSpots.push(roadPoint(null, rnd));

  return { mats, out, ground };

  // ---------------------------------------------------------------- helpers
  function building(bx0, bz0, bx1, bz1, h, style, Wm, r, collide = true) {
    const uo = Math.floor(r() * 8) / 8, vo = Math.floor(r() * 8) / 8;
    Wm[style].box(bx0, 0.3, bz0, bx1, h, bz1, 32, uo, vo, false);
    Wm.roof.flat(bx0, bz0, bx1, bz1, h, 10);
    // parapet
    const p = 0.5;
    Wm.trim.box(bx0, h, bz0, bx1, h + 1.2, bz0 + p, 8);
    Wm.trim.box(bx0, h, bz1 - p, bx1, h + 1.2, bz1, 8);
    Wm.trim.box(bx0, h, bz0, bx0 + p, h + 1.2, bz1, 8);
    Wm.trim.box(bx1 - p, h, bz0, bx1, h + 1.2, bz1, 8);
    // rooftop clutter: water tower, AC units, stair hut
    const w = bx1 - bx0, d = bz1 - bz0;
    if (w > 10 && d > 10) {
      if (r() < 0.45) {
        const tx = bx0 + 3 + r() * (w - 6), tz = bz0 + 3 + r() * (d - 6);
        for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Wm.dark.box(tx + ox * 1.2 - 0.1, h, tz + oz * 1.2 - 0.1, tx + ox * 1.2 + 0.1, h + 3, tz + oz * 1.2 + 0.1, 4);
        Wm.dark.geo(new THREE.CylinderGeometry(1.8, 1.8, 3.2, 12), tr(tx, h + 4.6, tz));
        Wm.dark.geo(new THREE.ConeGeometry(2, 1.4, 12), tr(tx, h + 6.9, tz));
      }
      for (let k = 0; k < 2; k++) if (r() < 0.6) {
        const ax = bx0 + 2 + r() * (w - 6), az = bz0 + 2 + r() * (d - 6);
        Wm.trim.box(ax, h, az, ax + 2 + r() * 2, h + 1.4, az + 2, 4);
      }
      if (r() < 0.5) { const sx = bx0 + 2 + r() * (w - 8); const sz = bz0 + 2 + r() * (d - 8); Wm.brick.box(sx, h, sz, sx + 4, h + 3, sz + 4, 32, uo, vo); }
    }
    // fire escapes on the long faces facing roads (just slats)
    if (style === 'brick' && h > 14 && r() < 0.5) {
      const fx = bx0 + 2 + r() * Math.max(1, w - 8);
      for (let y = 4; y < h - 2; y += 4) Wm.dark.box(fx, y, bz1, fx + 5, y + 0.15, bz1 + 1.4, 4);
      Wm.dark.box(fx, 3, bz1 + 1.3, fx + 0.12, h - 2, bz1 + 1.42, 4);
    }
    if (collide) addBox(bx0, bz0, bx1, bz1, h, 'bldg');
  }

  function emptyLot(lx0, lz0, lx1, lz1, Wm, r, sc, wholeBlock) {
    Wm.dirt.flat(lx0, lz0, lx1, lz1, 0.32, 8);
    // chain-link fence along the edges with a gap
    const fh = 1.3;
    const fence = (ax, az, bx2, bz2) => { Wm.dark.box(Math.min(ax, bx2) - 0.05, 0.3, Math.min(az, bz2) - 0.05, Math.max(ax, bx2) + 0.05, fh, Math.max(az, bz2) + 0.05, 4); };
    fence(lx0, lz0, lx1 - 8, lz0); fence(lx0, lz1, lx1, lz1); fence(lx0, lz0, lx0, lz1); fence(lx1, lz0 + 8, lx1, lz1);
    for (let x = lx0; x <= lx1; x += 3) Wm.dark.box(x - 0.08, 0.3, lz1 - 0.08, x + 0.08, fh + 0.2, lz1 + 0.08, 4);
    // rubble, burning barrels, a billboard, a wrecked car
    const n = wholeBlock ? 10 : 4;
    for (let i = 0; i < n; i++) {
      const x = lx0 + 3 + r() * (lx1 - lx0 - 6), z = lz0 + 3 + r() * (lz1 - lz0 - 6);
      const s = 0.6 + r() * 1.6;
      Wm.trim.geo(new THREE.DodecahedronGeometry(s, 0), tr(x, 0.3 + s * 0.4, z, 1.4, 0.6, 1.1, r() * 3));
    }
    if (r() < 0.7) {
      const x = lx0 + 4 + r() * (lx1 - lx0 - 8), z = lz0 + 4 + r() * (lz1 - lz0 - 8);
      Wm.dark.geo(new THREE.CylinderGeometry(0.5, 0.5, 1.3, 10), tr(x, 0.95, z));
      vents.push({ x, z, fire: true });
      flaskSpots.push({ x: x + 1.5, z });
    }
    if (wholeBlock || r() < 0.4) {
      const x = (lx0 + lx1) / 2, z = lz0 + 4;
      Wm.dark.box(x - 4, 0.3, z - 0.2, x - 3.6, 8, z + 0.2, 4);
      Wm.dark.box(x + 3.6, 0.3, z - 0.2, x + 4, 8, z + 0.2, 4);
      const bb = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), noirify(new THREE.MeshLambertMaterial({ map: billboardTex(r) })));
      bb.position.set(x, 9, z - 0.3);
      bb.rotation.y = Math.PI;
      sc.add(bb);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), mats.dark);
      back.position.set(x, 9, z - 0.25);
      sc.add(back);
    }
    if (r() < 0.5) {
      const car = makeCar('sedan');
      const x = lx0 + 6 + r() * (lx1 - lx0 - 12), z = lz0 + 6 + r() * (lz1 - lz0 - 12);
      car.root.position.set(x, 0.1, z);
      car.root.rotation.set(0.1, r() * 6, 0.25);
      car.wheels.forEach((w, i) => { if (i % 2) w.visible = false; });
      bake(car.root);
      addBox(x - 2.3, z - 2.3, x + 2.3, z + 2.3, 2, 'wreck');
    }
  }

  function buildSpecial(kind, bx, bz, x0, z0, x1, z1, Wm, r, sc, m) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const sign = (text, x, y, z, ry, w = 14, hgt = 3, font = 'bold 70px Georgia', neon) => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), noirify(new THREE.MeshBasicMaterial({ map: textTex(text, { font, border: true, bg: 'rgba(10,10,10,0.85)', fg: neon || '#fff' }) }), { keep: neon ? 1 : 0 }));
      s.position.set(x, y, z); s.rotation.y = ry; sc.add(s); signs.push(s);
      return s;
    };
    if (kind === 'park' || kind === 'park2') {
      Wm.grass.flat(x0 + 3, z0 + 3, x1 - 3, z1 - 3, 0.33, 8);
      for (let i = 0; i < 16; i++) {
        const tx = x0 + 6 + r() * 44, tz = z0 + 6 + r() * 44;
        if (Math.hypot(tx - cx, tz - cz) < 8) continue;
        Wm.dark.geo(new THREE.CylinderGeometry(0.25, 0.45, 6, 6), tr(tx, 3.3, tz));
        for (let k = 0; k < 4; k++) Wm.dark.geo(new THREE.CylinderGeometry(0.05, 0.16, 3.5, 4), M4.compose(new THREE.Vector3(tx, 6.4, tz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, k * 1.6 + r(), 0.4)), new THREE.Vector3(1, 1, 1)));
        addBox(tx - 0.5, tz - 0.5, tx + 0.5, tz + 0.5, 6, 'tree');
      }
      Wm.trim.geo(new THREE.CylinderGeometry(5, 5.5, 1.2, 24), tr(cx, 0.9, cz));
      Wm.trim.geo(new THREE.CylinderGeometry(0.6, 0.9, 4, 10), tr(cx, 2.5, cz));
      addBox(cx - 5, cz - 5, cx + 5, cz + 5, 1.5, 'fountain');
      return;
    }
    if (kind === 'cityHall') {
      // a big marble wedding cake of a building; the Mayor's office is the dome
      Wm.pave.flat(x0, z0, x1, z1, 0.32, 8);
      Wm.conc.box(cx - 24, 0.3, z0 + 3, cx + 24, 22, cz + 8, 32, 0.5, 0.25, false);
      Wm.roof.flat(cx - 24, z0 + 3, cx + 24, cz + 8, 22, 10);
      Wm.conc.box(cx - 14, 22, z0 + 6, cx + 14, 30, cz + 2, 32, 0.5, 0.25, false);
      Wm.roof.flat(cx - 14, z0 + 6, cx + 14, cz + 2, 30, 10);
      for (let s2 = 0; s2 < 4; s2++) Wm.trim.box(cx - 24 + s2, 0.3 + s2 * 0.45, cz + 8, cx + 24 - s2, 0.75 + s2 * 0.45, z1 - s2 * 2.2, 8);
      for (let k = 0; k < 10; k++) Wm.trim.geo(new THREE.CylinderGeometry(0.9, 1.0, 18, 14), tr(cx - 20 + k * 4.45, 11, cz + 11));
      Wm.trim.box(cx - 23, 20, cz + 8, cx + 23, 22, cz + 13, 8); // entablature
      Wm.trim.geo(new THREE.CylinderGeometry(24, 24, 3, 4, 1, false, Math.PI / 4), tr(cx, 23.5, cz + 10, 1, 1, 0.12));
      Wm.trim.geo(new THREE.CylinderGeometry(10, 10, 7, 28), tr(cx, 33.5, cz - 6));
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; Wm.trim.geo(new THREE.CylinderGeometry(0.4, 0.4, 7, 8), tr(cx + Math.cos(a) * 10.4, 33.5, cz - 6 + Math.sin(a) * 10.4)); }
      Wm.trim.geo(new THREE.SphereGeometry(10, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), tr(cx, 37, cz - 6));
      Wm.dark.geo(new THREE.CylinderGeometry(0.2, 0.2, 18, 6), tr(cx, 54, cz - 6));
      addBox(cx - 24, z0 + 3, cx + 24, cz + 8, 22, 'bldg');
      sign('CITY HALL', cx, 21, cz + 13.4, 0, 22, 2.6);
      // the Mayor's banners hang down the front
      for (const bxp of [cx - 17, cx + 17]) {
        const ban = new THREE.Mesh(new THREE.PlaneGeometry(5, 14), noirify(new THREE.MeshLambertMaterial({ map: textTex('KRANE', { w: 128, h: 360, font: 'bold 34px Georgia', bg: '#d9b04a', fg: '#1a1408' }) }), { keep: 1 }));
        ban.position.set(bxp, 12, cz + 8.3); sc.add(ban);
      }
      return;
    }
    if (kind === 'plaza') {
      // Krane Plaza: fountains, banners, and a forty-foot gold statue of the Mayor waving at himself
      Wm.pave.flat(x0, z0, x1, z1, 0.33, 8);
      Wm.trim.box(cx - 6, 0.3, cz - 6, cx + 6, 4, cz + 6, 8);
      Wm.trim.box(cx - 4.5, 4, cz - 4.5, cx + 4.5, 6, cz + 4.5, 8);
      addBox(cx - 6, cz - 6, cx + 6, cz + 6, 6, 'statue');
      const statue = makeMayor(true);
      statue.root.scale.setScalar(6.5);
      statue.root.position.set(cx, 6, cz);
      bake(statue.root);
      L.plaza.statue = statue;
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), noirify(new THREE.MeshLambertMaterial({ map: textTex('HORACE KRANE · A BRIGHTER CITY', { w: 1024, h: 200, font: 'bold 64px Georgia', bg: '#2a2a2a', fg: '#d9b04a' }) }), { keep: 1 }));
      plaque.position.set(cx, 2.4, cz + 6.05); sc.add(plaque);
      for (const [fx2, fz2] of [[x0 + 10, z0 + 10], [x1 - 10, z0 + 10], [x0 + 10, z1 - 10], [x1 - 10, z1 - 10]]) {
        Wm.trim.geo(new THREE.CylinderGeometry(4, 4.4, 1.2, 20), tr(fx2, 0.9, fz2));
        Wm.trim.geo(new THREE.CylinderGeometry(0.5, 0.7, 3, 8), tr(fx2, 2.2, fz2));
        addBox(fx2 - 4, fz2 - 4, fx2 + 4, fz2 + 4, 1.5, 'fountain');
        vents.push({ x: fx2, z: fz2, fountain: true });
      }
      return;
    }
    if (kind.startsWith('bank')) {
      const h = 22 + r() * 10;
      Wm.conc.box(x0 + 6, 0.3, z0 + 6, x1 - 6, h, z1 - 10, 32, 0.25, 0.5, false);
      Wm.roof.flat(x0 + 6, z0 + 6, x1 - 6, z1 - 10, h, 10);
      for (let s = 0; s < 3; s++) Wm.trim.box(x0 + 6, 0.3 + s * 0.4, z1 - 10, x1 - 6, 0.7 + s * 0.4, z1 - 4 - s * 1.5, 8);
      for (let k = 0; k < 6; k++) Wm.trim.geo(new THREE.CylinderGeometry(0.9, 1, 12, 12), tr(x0 + 10 + k * 7.2, 6.6, z1 - 8));
      Wm.trim.box(x0 + 6, 12.6, z1 - 10, x1 - 6, 14.6, z1 - 6.5, 8);
      addBox(x0 + 6, z0 + 6, x1 - 6, z1 - 10, h, 'bldg');
      sign(L[kind].name.toUpperCase(), cx, 13.6, z1 - 6.4, 0, 22, 2, 'bold 54px Georgia');
      // a big vault-door emblem
      const v = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.4, 24), nmat(0xbbbbbb, { kind: 'std', metal: 1, rough: 0.25 }));
      v.rotation.x = Math.PI / 2; v.position.set(cx, 5, z1 - 9.8); sc.add(v);
      return;
    }
    if (kind.startsWith('casino') || kind === 'palace' || kind === 'hotel') {
      const h = kind === 'hotel' ? 70 : kind === 'casino' ? 34 : 46;
      Wm.strip.box(x0 + 5, 0.3, z0 + 5, x1 - 5, h, z1 - 5, 32, 0.5, 0, false);
      Wm.roof.flat(x0 + 5, z0 + 5, x1 - 5, z1 - 5, h, 10);
      const face = bz === 7 ? z1 : z0; // facing the Strip
      const dir = bz === 7 ? 1 : -1;
      Wm.trim.box(x0 + 3, 6, Math.min(face, face - dir * 5), x1 - 3, 7, Math.max(face, face - dir * 5), 8); // porte-cochère
      addBox(x0 + 5, z0 + 5, x1 - 5, z1 - 5, h, 'bldg');
      const neonC = kind === 'casino' ? '#ffd35a' : kind === 'casino2' ? '#8fe08a' : kind === 'palace' ? '#ff2d95' : null;
      const word = kind === 'casino2' ? 'LUCKY KRANE' : kind === 'casino' ? 'SILVER DOLLAR' : kind === 'palace' ? 'PRISM PALACE' : 'HOTEL MONACO';
      const s = sign(word, cx, h + 6, face - dir * 6, 0, 40, 8, 'bold 64px Georgia', neonC);
      Wm.dark.box(cx - 12, h, face - dir * 6 - 0.3, cx - 11, h + 3, face - dir * 6 + 0.3, 4);
      Wm.dark.box(cx + 11, h, face - dir * 6 - 0.3, cx + 12, h + 3, face - dir * 6 + 0.3, 4);
      if (kind === 'casino') {
        // a giant spinning silver dollar on the roof
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 1, 32), nmat(0xdddddd, { kind: 'std', rough: 0.15, metal: 1 }));
        coin.rotation.z = Math.PI / 2; coin.position.set(cx, h + 16, cz);
        sc.add(coin); signs.push(coin); coin.userData.spin = 0.8;
      }
      if (kind === 'palace') s.userData.prism = true;
      return;
    }
    if (kind === 'donut') {
      // Holy Glaze: low shop on the north side, parking lot packed with cruisers
      Wm.dirt.flat(x0 + 3, z0 + 3, x1 - 3, z1 - 3, 0.31, 8);
      Wm.strip.box(cx - 12, 0.3, z0 + 6, cx + 12, 7, z0 + 18, 32, 0, 0.75, false);
      Wm.roof.flat(cx - 12, z0 + 6, cx + 12, z0 + 18, 7, 10);
      Wm.trim.box(cx - 13, 6.5, z0 + 17, cx + 13, 7.3, z0 + 21, 8); // awning
      addBox(cx - 12, z0 + 6, cx + 12, z0 + 18, 7, 'bldg');
      const donut = new THREE.Mesh(new THREE.TorusGeometry(4.2, 1.8, 16, 40), nmat(0xd9a35e, { kind: 'std', rough: 0.5, keep: 1, paint: false }));
      donut.position.set(cx, 13.5, z0 + 12);
      sc.add(donut); signs.push(donut); donut.userData.spin = 0.4; donut.castShadow = true;
      const icing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 1.85, 16, 40, Math.PI), nmat(0xff6fb5, { kind: 'std', rough: 0.15, keep: 1, paint: false, emissive: 0xff3f9a, ei: 0.35 }));
      donut.add(icing);
      Wm.dark.box(cx - 0.3, 7, z0 + 11.7, cx + 0.3, 9.4, z0 + 12.3, 4);
      sign('HOLY GLAZE DONUTS', cx, 8.6, z0 + 21.2, 0, 22, 2.6, 'bold 56px Georgia', '#ff6fb5');
      sign('COPS EAT FREE', cx + 16, 3.5, z0 + 6, 0, 8, 1.6, 'bold 46px Georgia');
      // the cruisers, nose to the shop
      let n = 0;
      for (let row = 0; row < 2; row++) for (let k = 0; k < 5; k++) {
        const car = makeCar('cop');
        const x = x0 + 8 + k * 9.5, z = z0 + 30 + row * 13;
        car.root.position.set(x, 0.3, z);
        car.root.rotation.y = row ? 0 : Math.PI;
        const bar = car.lightbar;
        car.body.remove(bar);
        bake(car.root);
        bar.position.set(x, 0.3 + 1.75, z - 0.3 * (row ? 1 : -1));
        bar.rotation.y = car.root.rotation.y;
        sc.add(bar);
        copCars.push(car);
        addBox(x - 1.3, z - 2.8, x + 1.3, z + 2.8, 2, 'copcar');
        n++;
      }
      for (let k = 0; k < 6; k++) {
        const cop = makeCop();
        cop.root.position.set(cx - 14 + k * 5.5 + r(), 0.3, z0 + 23 + r() * 2);
        cop.root.rotation.y = r() * 0.8 - 0.4;
        sc.add(cop.root);
        cops.push(cop);
      }
      return;
    }
    if (kind === 'precinct') {
      building(x0 + 6, z0 + 6, x1 - 6, z1 - 14, 18, 'brick', Wm, r);
      sign('13TH PRECINCT', cx, 10, z1 - 13.8, 0, 16, 2.4);
      sign('BACK IN 5 MIN', cx, 3.4, z1 - 13.8, 0, 7, 1.4, 'bold 50px Georgia');
      return;
    }
    if (kind === 'club') {
      building(x0 + 5, z0 + 5, x1 - 5, z1 - 8, 16, 'brick', Wm, r);
      Wm.trim.box(x0 + 14, 5, z1 - 8, x1 - 14, 7.5, z1 - 3, 8);
      sign('THE KALEIDOSCOPE CLUB', cx, 6.3, z1 - 2.9, 0, 26, 2.5, 'bold 54px Georgia');
      return;
    }
    if (kind === 'bar') {
      building(x0 + 5, z0 + 5, x1 - 5, z1 - 9, 14, 'brick', Wm, r);
      sign('THE LAST DROP', cx, 6, z1 - 8.8, 0, 16, 2.6, 'bold 70px Georgia', '#4fa8ff');
      sign('COCKTAILS', cx + 13, 3.4, z1 - 8.8, 0, 6, 1.2, 'bold 50px Georgia');
      Wm.dark.box(cx - 1.5, 0.3, z1 - 9, cx + 1.5, 4, z1 - 8.7, 4); // door
      L.bar.door = { x: cx, z: z1 - 6.5 };
      return;
    }
    if (kind === 'office') {
      building(x0 + 4, z0 + 4, x1 - 4, z1 - 8, 26, 'brick', Wm, r);
      sign('MALONE INVESTIGATIONS', cx, 9, z1 - 7.8, 0, 20, 2, 'bold 50px Georgia', '#ff2a3a');
      L.office.door = { x: cx, z: z1 - 6 };
      return;
    }
    if (kind === 'docks') {
      for (let k = 0; k < 3; k++) building(x0 + 4 + k * 17, z0 + 6, x0 + 18 + k * 17, z0 + 30, 11, 'conc', Wm, r);
      for (let k = 0; k < 10; k++) {
        const x = x0 + 6 + (k % 5) * 9, z = z0 + 38 + Math.floor(k / 5) * 6;
        Wm.dark.box(x, 0.3, z, x + 7.5, 3 + (k % 3), z + 3, 4);
        addBox(x, z, x + 7.5, z + 3, 3, 'crate');
      }
      return;
    }
    if (kind === 'rail') {
      for (let k = 0; k < 4; k++) {
        const z = z0 + 8 + k * 12;
        Wm.dark.box(x0 - 24, 0.05, z - 1.2, x1 + 24, 0.25, z - 0.9, 4);
        Wm.dark.box(x0 - 24, 0.05, z + 0.9, x1 + 24, 0.25, z + 1.2, 4);
        if (k % 2 === 0) {
          for (let c = 0; c < 3; c++) {
            const x = x0 + 2 + c * 18;
            Wm.conc.box(x, 0.8, z - 1.8, x + 16, 5, z + 1.8, 32, 0, 0.9);
            addBox(x, z - 1.8, x + 16, z + 1.8, 5, 'boxcar');
          }
        }
      }
      return;
    }
  }
}

function billboardTex(r) {
  const ads = [['DRINK', 'OLD CROW'], ['SMILE!', 'YOU\'RE IN RAIN CITY'], ['VOTE', 'MAYOR KRANE'], ['SEE THE WORLD', 'IN COLOR'], ['HOLY GLAZE', 'DOZEN FOR A DIME'], ['LUCKY STRIKE', 'IT\'S TOASTED']];
  const [a, b] = ads[Math.floor(r() * ads.length)];
  return canvasTex(512, 220, (g, w, h) => {
    g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#222'; g.font = 'bold 76px Georgia'; g.textAlign = 'center'; g.fillText(a, w / 2, 90);
    g.font = 'italic 38px Georgia'; g.fillText(b, w / 2, 160);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 30 + Math.random() * 60);
  }, false);
}

// 2D render of the city for the minimap and the corkboard map
export function drawCityMap(g, w, h, opts = {}) {
  const s = w / C.span;
  const X = (x) => (x + C.span / 2) * s, Z = (z) => (z + C.span / 2) * s;
  g.fillStyle = opts.paper ? '#d9d2c3' : '#18191b';
  g.fillRect(0, 0, w, h);
  g.fillStyle = opts.paper ? '#9fb0b8' : '#0d0f12';
  g.fillRect(0, Z(C.half), w, h - Z(C.half)); // water
  for (let bx = 0; bx < C.N; bx++) for (let bz = 0; bz < C.N; bz++) {
    g.fillStyle = opts.paper ? '#bdb5a5' : '#2f3033';
    g.fillRect(X(blockMin(bx)), Z(blockMin(bz)), 56 * s, 56 * s);
  }
  g.fillStyle = opts.paper ? '#6b645a' : '#4c4d50';
  for (const b of boxes) if (b.tag === 'bldg') g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * s, (b.z1 - b.z0) * s);
  if (opts.paper) {
    g.strokeStyle = 'rgba(60,50,40,0.35)'; g.lineWidth = 1;
    for (let i = 0; i <= C.N; i++) { g.beginPath(); g.moveTo(X(roadC(i)), Z(-640)); g.lineTo(X(roadC(i)), Z(640)); g.stroke(); g.beginPath(); g.moveTo(X(-640), Z(roadC(i))); g.lineTo(X(640), Z(roadC(i))); g.stroke(); }
    g.strokeStyle = 'rgba(30,25,20,0.55)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(X(roadC(5)), Z(0)); g.lineTo(X(640), Z(0)); g.stroke();
  }
}
