// Depth 03 — The Crimson Throne. The final stage: a round throne hall of
// polished checkered marble ringed by rose hedges, candelabra, pillars and
// stained glass, open to an eclipsed moon. When the Queen's court falls the
// hall tears itself apart and the Crimson Queen rises out of the abyss.

import * as THREE from 'three';
import { makeCanvas, makeRng, TAU, clamp } from '../engine/util.js';
import { mat } from '../gfx/models.js';
import { heartShape } from '../gfx/thronemodels.js';
import { RIM } from '../gfx/rim.js';

export const ARENA_R = 46;
const LIP_R = 48.5;
const GALLERY_R = 62;
const WALL_R = 74;
const WALL_H = 42;
export const DAIS = { x: 0, z: -43 };
export const QUEEN_POS = { x: 0, z: -66 };

// ───────────────────────── textures ─────────────────────────
function tex(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function heartPath(x, cx, cy, s) {
  x.beginPath();
  x.moveTo(cx, cy + s);
  x.bezierCurveTo(cx - 0.35 * s, cy + 0.62 * s, cx - 1.05 * s, cy + 0.25 * s, cx - s, cy - 0.28 * s);
  x.bezierCurveTo(cx - 0.95 * s, cy - 0.8 * s, cx - 0.25 * s, cy - 0.95 * s, cx, cy - 0.5 * s);
  x.bezierCurveTo(cx + 0.25 * s, cy - 0.95 * s, cx + 0.95 * s, cy - 0.8 * s, cx + s, cy - 0.28 * s);
  x.bezierCurveTo(cx + 1.05 * s, cy + 0.25 * s, cx + 0.35 * s, cy + 0.62 * s, cx, cy + s);
}

// Polished checkerboard marble with gold ring inlays, hearts, and a hidden
// web of cracks (in the emissive map) that burns red once the Queen ascends.
function floorTextures() {
  const S = 2048;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const e = makeCanvas(S, S);
  const ex = e.getContext('2d');
  const rough = makeCanvas(512, 512);
  const rx = rough.getContext('2d');
  const rng = makeRng(3003);
  const C = S / 2;
  const px = (m) => (m / ARENA_R) * (S / 2); // metres → pixels
  const tile = px(3.2);
  // checker tiles, each with its own veining
  for (let i = -Math.ceil(C / tile) - 1; i <= Math.ceil(C / tile); i++) {
    for (let j = -Math.ceil(C / tile) - 1; j <= Math.ceil(C / tile); j++) {
      const X = C + i * tile - tile / 2;
      const Y = C + j * tile - tile / 2;
      const dark = (i + j) & 1;
      const v = rng() * 14;
      x.fillStyle = dark ? `rgb(${18 + v},${12 + v * 0.6},${20 + v})` : `rgb(${218 + v},${210 + v},${206 + v})`;
      x.fillRect(X, Y, tile + 1, tile + 1);
      x.strokeStyle = dark ? 'rgba(120,100,130,0.22)' : 'rgba(90,70,80,0.2)';
      x.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) {
        x.beginPath();
        let a = rng() * tile;
        let b = rng() * tile;
        x.moveTo(X + a, Y + b);
        for (let s = 0; s < 6; s++) {
          a += (rng() - 0.5) * tile * 0.5;
          b += (rng() - 0.5) * tile * 0.5;
          x.lineTo(X + clamp(a, 0, tile), Y + clamp(b, 0, tile));
        }
        x.stroke();
      }
      x.strokeStyle = 'rgba(10,6,10,0.55)';
      x.lineWidth = 2;
      x.strokeRect(X, Y, tile, tile);
    }
  }
  // gold rings
  const ring = (r, w) => {
    x.strokeStyle = '#8a6420';
    x.lineWidth = w + 4;
    x.beginPath();
    x.arc(C, C, px(r), 0, TAU);
    x.stroke();
    x.strokeStyle = '#d8b060';
    x.lineWidth = w;
    x.stroke();
  };
  // a solid marble band that carries the heart inlays
  const band = (r0, r1, col) => {
    x.fillStyle = col;
    x.beginPath();
    x.arc(C, C, px(r1), 0, TAU);
    x.arc(C, C, px(r0), 0, TAU, true);
    x.fill();
  };
  band(26, 30, '#1c1016');
  band(43.5, 46, '#2a1a20');
  band(0, 7.5, '#3a0a12');
  ring(7.5, 10);
  ring(8.3, 4);
  ring(18, 8);
  ring(26, 10);
  ring(30, 10);
  ring(43.5, 12);
  ring(45.6, 6);
  // hearts set into the dark band
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const hx = C + Math.cos(a) * px(28);
    const hy = C + Math.sin(a) * px(28);
    x.save();
    x.translate(hx, hy);
    x.rotate(a + Math.PI / 2);
    heartPath(x, 0, 0, px(1.3));
    x.fillStyle = '#9a0c1c';
    x.fill();
    x.strokeStyle = '#d8b060';
    x.lineWidth = 5;
    x.stroke();
    x.restore();
  }
  // gold filigree scrolls on the outer band
  x.strokeStyle = '#c9a04a';
  x.lineWidth = 3;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    x.beginPath();
    x.arc(C + Math.cos(a) * px(44.8), C + Math.sin(a) * px(44.8), px(0.55), a, a + Math.PI * 1.4);
    x.stroke();
  }
  // the royal medallion: a great heart in the centre
  heartPath(x, C, C, px(5.2));
  x.fillStyle = '#b01424';
  x.fill();
  x.lineWidth = 12;
  x.strokeStyle = '#d8b060';
  x.stroke();
  heartPath(x, C, C, px(3.4));
  x.lineWidth = 5;
  x.stroke();
  // polish: soft sheen blobs
  for (let i = 0; i < 60; i++) {
    x.fillStyle = `rgba(255,240,245,${rng() * 0.035})`;
    x.beginPath();
    x.arc(rng() * S, rng() * S, 30 + rng() * 120, 0, TAU);
    x.fill();
  }
  // emissive: dark, with branching cracks radiating from the north
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, S, S);
  ex.lineCap = 'round';
  const crack = (x0, y0, a, len, w, depth) => {
    let px0 = x0;
    let py0 = y0;
    ex.lineWidth = w;
    ex.strokeStyle = `rgb(255,${40 + depth * 20},${50 + depth * 10})`;
    ex.beginPath();
    ex.moveTo(px0, py0);
    const steps = 8;
    for (let s = 0; s < steps; s++) {
      a += (rng() - 0.5) * 0.7;
      px0 += Math.cos(a) * (len / steps);
      py0 += Math.sin(a) * (len / steps);
      ex.lineTo(px0, py0);
      if (depth < 3 && rng() < 0.22) crack(px0, py0, a + (rng() - 0.5) * 1.8, len * 0.5, w * 0.6, depth + 1);
    }
    ex.stroke();
  };
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (rng() - 0.5) * 2.6;
    const sx = C + Math.cos(a) * px(46);
    const sy = C + Math.sin(a) * px(46);
    crack(sx, sy, a + Math.PI + (rng() - 0.5) * 0.6, px(20 + rng() * 26), 7, 0);
  }
  for (let i = 0; i < 10; i++) crack(C, C, rng() * TAU, px(8 + rng() * 14), 5, 1);
  // roughness: polished tiles, rougher grout and gold
  rx.fillStyle = 'rgb(70,70,70)';
  rx.fillRect(0, 0, 512, 512);
  const map = tex(c);
  const emissive = tex(e);
  const r = tex(rough, { srgb: false });
  return { map, emissive, rough: r };
}

function stainedGlassTexture(seed) {
  const W = 256;
  const H = 640;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const rng = makeRng(seed);
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  // gothic lancet
  x.save();
  x.beginPath();
  x.moveTo(12, H);
  x.lineTo(12, 200);
  x.quadraticCurveTo(12, 20, W / 2, 6);
  x.quadraticCurveTo(W - 12, 20, W - 12, 200);
  x.lineTo(W - 12, H);
  x.closePath();
  x.clip();
  const cols = ['#b0102a', '#7a0820', '#d02040', '#4a1070', '#7020a0', '#d8a040', '#300850', '#e03050'];
  for (let y = 0; y < H; y += 34) {
    for (let xx = 0; xx < W; xx += 30) {
      x.fillStyle = cols[Math.floor(rng() * cols.length)];
      x.beginPath();
      x.moveTo(xx + rng() * 8, y + rng() * 8);
      x.lineTo(xx + 30 + rng() * 8, y + rng() * 8);
      x.lineTo(xx + 30 + rng() * 8, y + 34 + rng() * 8);
      x.lineTo(xx + rng() * 8, y + 34 + rng() * 8);
      x.fill();
    }
  }
  // the heart
  heartPath(x, W / 2, 300, 70);
  x.fillStyle = '#ff2040';
  x.fill();
  x.lineWidth = 8;
  x.strokeStyle = '#1a0a10';
  x.stroke();
  heartPath(x, W / 2, 300, 38);
  x.fillStyle = '#ffb0c0';
  x.fill();
  // lead came
  x.strokeStyle = '#120608';
  x.lineWidth = 4;
  for (let y = 0; y < H; y += 34) {
    x.beginPath();
    x.moveTo(0, y + rng() * 6);
    x.lineTo(W, y + rng() * 6);
    x.stroke();
  }
  for (let xx = 0; xx < W; xx += 30) {
    x.beginPath();
    x.moveTo(xx, 0);
    x.lineTo(xx + rng() * 6, H);
    x.stroke();
  }
  x.restore();
  x.lineWidth = 10;
  x.strokeStyle = '#1a0e10';
  x.beginPath();
  x.moveTo(12, H);
  x.lineTo(12, 200);
  x.quadraticCurveTo(12, 20, W / 2, 6);
  x.quadraticCurveTo(W - 12, 20, W - 12, 200);
  x.lineTo(W - 12, H);
  x.stroke();
  return tex(c);
}

function bannerTexture() {
  const W = 128;
  const H = 384;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#4a0610');
  g.addColorStop(0.5, '#9a1020');
  g.addColorStop(1, '#4a0610');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(0, 0);
  x.lineTo(W, 0);
  x.lineTo(W, H - 40);
  x.lineTo(W / 2, H);
  x.lineTo(0, H - 40);
  x.fill();
  x.strokeStyle = '#d8b060';
  x.lineWidth = 6;
  x.strokeRect(8, 8, W - 16, H - 70);
  heartPath(x, W / 2, 150, 34);
  x.fillStyle = '#d8b060';
  x.fill();
  heartPath(x, W / 2, 150, 22);
  x.fillStyle = '#b01020';
  x.fill();
  return tex(c);
}

function coronaTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const C = S / 2;
  const g = x.createRadialGradient(C, C, S * 0.18, C, C, S * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.12, 'rgba(255,220,255,1)');
  g.addColorStop(0.2, 'rgba(200,80,255,0.8)');
  g.addColorStop(0.5, 'rgba(120,20,180,0.25)');
  g.addColorStop(1, 'rgba(60,0,80,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  // crackling filaments
  x.strokeStyle = 'rgba(230,160,255,0.55)';
  x.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    let a = (i / 26) * TAU;
    let r = S * 0.2;
    x.beginPath();
    x.moveTo(C + Math.cos(a) * r, C + Math.sin(a) * r);
    for (let k = 0; k < 6; k++) {
      a += (Math.random() - 0.5) * 0.25;
      r += S * 0.03;
      x.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r);
    }
    x.stroke();
  }
  return tex(c);
}

// ───────────────────────── build ─────────────────────────
export function buildThrone(w) {
  const rng = w.rng;
  const add = (o) => {
    w.group.add(o);
    return o;
  };
  w.bound = ARENA_R - 0.6;
  w.spawn = { x: 0, z: 36 };
  w.glassPos = { x: 0, z: -24 };
  w.plazas = [
    { x: 0, z: 36, r: 9, h: 0 },
    { x: 0, z: 0, r: ARENA_R, h: 0 },
  ];
  w.castle.visible = false;
  w.cheshire.visible = false;
  w.group.children.forEach((c) => {
    if (c.geometry && c.geometry.type === 'CylinderGeometry' && c.material.map === w.assets.skyline) c.visible = false;
  });
  w.scene.fog.density = 0.0042;
  const throne = { phase: 0, crack: 0, rise: 0, falling: [], rocks: [] };
  w.throne = throne;

  // ── height: flat hall, a stepped dais under the throne, abyss beyond ──
  w.heightFn = (x, z) => {
    const r = Math.hypot(x, z);
    const dd = Math.hypot(x - DAIS.x, z - DAIS.z);
    if (dd < 12 && r < LIP_R) return dd < 5 ? 1.6 : dd < 7.3 ? 1.2 : dd < 9.6 ? 0.8 : 0.4;
    if (r < GALLERY_R) return 0;
    return -60;
  };
  w.sampleSpot = () => {
    const r = Math.sqrt(rng()) * (ARENA_R - 5);
    const a = rng() * TAU;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  };
  w.spawnOk = (x, z) => Math.hypot(x, z) < ARENA_R - 2 && Math.hypot(x - DAIS.x, z - DAIS.z) > 12 && !w.solidAt(x, 0.5, z);

  // ── the floor ──
  const ft = floorTextures();
  const floorMat = new THREE.MeshStandardMaterial({
    map: ft.map, emissiveMap: ft.emissive, emissive: new THREE.Color('#ff2030'), emissiveIntensity: 0,
    roughness: 0.38, metalness: 0.1, envMapIntensity: 0.6,
  });
  throne.floorMat = floorMat;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R, 96).rotateX(-Math.PI / 2), floorMat);
  floor.receiveShadow = true;
  add(floor);
  // marble lip around the floor edge
  const stone = mat('#cfc6c4', { roughness: 0.45 });
  const darkStone = mat('#2a1c24', { roughness: 0.6 });
  const gold = mat('#c9a04a', { metalness: 0.9, roughness: 0.28 });
  const lip = new THREE.Mesh(new THREE.RingGeometry(ARENA_R, LIP_R, 96, 1).rotateX(-Math.PI / 2), darkStone);
  lip.position.y = 0.01;
  lip.receiveShadow = true;
  add(lip);
  const curb = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R, 0.22, 6, 128), gold);
  curb.rotation.x = Math.PI / 2;
  curb.position.y = 0.08;
  add(curb);

  // ── the dais and the throne ──
  const velvet = mat('#6a0612', { roughness: 0.9 });
  const steps = [[12, 0.4], [9.6, 0.8], [7.3, 1.2], [5, 1.6]];
  for (const [r, h] of steps) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, false), stone);
    st.position.set(DAIS.x, h / 2, DAIS.z);
    st.receiveShadow = true;
    st.castShadow = true;
    add(st);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 4, 64), gold);
    trim.rotation.x = Math.PI / 2;
    trim.position.set(DAIS.x, h, DAIS.z);
    add(trim);
  }
  // red carpet running down the steps to the medallion
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4, 30), velvet);
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.03, -18);
  carpet.receiveShadow = true;
  add(carpet);
  for (const s of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 30), gold);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(s * 2.1, 0.035, -18);
    add(edge);
  }
  const thr = new THREE.Group();
  thr.position.set(DAIS.x, 1.6, DAIS.z - 1);
  add(thr);
  const box = (wd, h, d, m, x0, y0, z0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(wd, h, d), m);
    b.position.set(x0, y0, z0);
    b.castShadow = true;
    thr.add(b);
    return b;
  };
  box(3.2, 1.2, 2.6, gold, 0, 0.6, 0);
  box(2.8, 0.5, 2.3, velvet, 0, 1.45, 0.1);
  // tall pointed back
  const back = new THREE.Shape();
  back.moveTo(-1.6, 0);
  back.lineTo(-1.6, 4.2);
  back.quadraticCurveTo(-1.5, 6.4, 0, 7.6);
  back.quadraticCurveTo(1.5, 6.4, 1.6, 4.2);
  back.lineTo(1.6, 0);
  const bk = new THREE.Mesh(new THREE.ExtrudeGeometry(back, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1 }), gold);
  bk.position.set(0, 1.2, -1.3);
  bk.castShadow = true;
  thr.add(bk);
  const pad = new THREE.Mesh(new THREE.ExtrudeGeometry(back, { depth: 0.2, bevelEnabled: false }), velvet);
  pad.scale.set(0.8, 0.85, 1);
  pad.position.set(0, 1.6, -0.75);
  thr.add(pad);
  const topHeart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(0.8), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 }), new THREE.MeshStandardMaterial({ color: '#ff2040', emissive: '#ff1030', emissiveIntensity: 2 }));
  topHeart.position.set(0, 9.6, -1.1);
  thr.add(topHeart);
  for (const s of [-1, 1]) {
    box(0.5, 1.1, 2.4, gold, s * 1.55, 2.1, 0.1);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.6, 6), gold);
    fin.position.set(s * 1.7, 6.2, -1.05);
    thr.add(fin);
  }
  throne.throneGroup = thr;
  w.addCollider({ x: DAIS.x, z: DAIS.z - 1, r: 2.2, top: 12 });

  // ── gallery ring: 16 segments of floor that the ascent tears away ──
  const galleryMat = mat('#3a2a30', { roughness: 0.7 });
  const segs = 16;
  throne.segments = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * TAU;
    const a1 = ((i + 1) / segs) * TAU;
    const g = new THREE.Group();
    // an annular slab: inner edge at the lip, outer at the gallery rim
    const sh = new THREE.Shape();
    const n = 8;
    for (let k = 0; k <= n; k++) {
      const a = a0 + 0.004 + ((a1 - a0 - 0.008) * k) / n;
      if (k === 0) sh.moveTo(Math.sin(a) * LIP_R, Math.cos(a) * LIP_R);
      sh.lineTo(Math.sin(a) * GALLERY_R, Math.cos(a) * GALLERY_R);
    }
    for (let k = n; k >= 0; k--) {
      const a = a0 + 0.004 + ((a1 - a0 - 0.008) * k) / n;
      sh.lineTo(Math.sin(a) * LIP_R, Math.cos(a) * LIP_R);
    }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false });
    // shape XY → world XZ, extruded downward
    geo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(geo, galleryMat);
    ring.receiveShadow = true;
    g.add(ring);
    // jagged rock underside
    const under = new THREE.Mesh(new THREE.ConeGeometry(4.5, 8, 5), mat('#241820', { roughness: 0.9, flatShading: true }));
    const am = (a0 + a1) / 2;
    under.position.set(Math.sin(am) * (LIP_R + 7), -7, Math.cos(am) * (LIP_R + 7));
    under.rotation.x = Math.PI;
    g.add(under);
    add(g);
    throne.segments.push({ g, a: am, north: Math.cos(am) < -0.55, vy: 0, spin: (rng() - 0.5) * 0.3 });
  }
  // the hall's floor disk underside so nothing looks paper-thin from above
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(LIP_R, LIP_R * 0.6, 10, 48), mat('#1c1218', { roughness: 0.9 }));
  slab.position.y = -5.02;
  add(slab);

  // ── pillars with heart shields and banners ──
  const nP = 16;
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(1), { depth: 0.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 });
  const heartRed = new THREE.MeshStandardMaterial({ color: '#a00c1c', roughness: 0.35, metalness: 0.3, emissive: '#400008', emissiveIntensity: 0.6 });
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTexture(), side: THREE.DoubleSide, roughness: 0.85, transparent: true, alphaTest: 0.5 });
  throne.pillars = [];
  for (let i = 0; i < nP; i++) {
    const a = (i / nP) * TAU + TAU / 32;
    const r = 54;
    const px = Math.sin(a) * r;
    const pz = Math.cos(a) * r;
    const p = new THREE.Group();
    p.position.set(px, 0, pz);
    p.rotation.y = a + Math.PI;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 22, 12), stone);
    col.position.y = 11;
    col.castShadow = true;
    p.add(col);
    for (let k = 0; k < 4; k++) {
      const flute = new THREE.Mesh(new THREE.BoxGeometry(0.25, 20, 0.25), mat('#b8aeac', { roughness: 0.5 }));
      flute.position.set(Math.sin((k / 4) * TAU) * 1.35, 11, Math.cos((k / 4) * TAU) * 1.35);
      p.add(flute);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.6, 3.6), stone);
    base.position.y = 0.8;
    p.add(base);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.4, 1.6, 12), gold);
    cap.position.y = 22.6;
    p.add(cap);
    const sh = new THREE.Mesh(heartGeo, heartRed);
    sh.scale.setScalar(1.4);
    sh.position.set(0, 8, 1.55);
    p.add(sh);
    const shRim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.1, 4, 24), gold);
    shRim.position.set(0, 8.1, 1.65);
    p.add(shRim);
    // banner hangs between this pillar and the next
    const bn = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 9.6), bannerMat);
    bn.position.set(0, 16, 1.6);
    p.add(bn);
    add(p);
    throne.pillars.push(p);
  }

  // ── rose hedges and candelabra along the lip ──
  const bushGeo = new THREE.IcosahedronGeometry(1, 1);
  const leafMat = new THREE.MeshStandardMaterial({ map: w.assets.leaf, color: '#2a4a2a', roughness: 0.8 });
  const roseMat = new THREE.MeshStandardMaterial({ color: '#c0102a', roughness: 0.45, emissive: '#400006', emissiveIntensity: 0.5 });
  const nB = 110;
  const bushes = new THREE.InstancedMesh(bushGeo, leafMat, nB);
  const roses = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.28, 0), roseMat, nB * 5);
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const V = new THREE.Vector3();
  const Sc = new THREE.Vector3();
  let ri = 0;
  for (let i = 0; i < nB; i++) {
    const a = (i / nB) * TAU + rng() * 0.03;
    const r = LIP_R + 1.3 + rng() * 1.6;
    const s = 0.9 + rng() * 0.8;
    V.set(Math.sin(a) * r, s * 0.55, Math.cos(a) * r);
    Sc.set(s * 1.3, s, s * 1.3);
    M.compose(V, Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * TAU), Sc);
    bushes.setMatrixAt(i, M);
    for (let k = 0; k < 5; k++) {
      const ra = rng() * TAU;
      V.set(Math.sin(a) * r + Math.cos(ra) * s * 1.1, s * (0.5 + rng() * 0.6), Math.cos(a) * r + Math.sin(ra) * s * 1.1);
      M.compose(V, Q.identity(), Sc.set(1, 0.8, 1));
      roses.setMatrixAt(ri++, M);
    }
  }
  bushes.castShadow = true;
  add(bushes);
  add(roses);
  // candelabra: gold stands with candle flames (sprites; a few carry lights)
  const flameMat = new THREE.SpriteMaterial({ map: w.assets.glow, color: '#ffb050', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 });
  const candleMat = mat('#efe6d6', { roughness: 0.6 });
  const nC = 20;
  const flames = [];
  for (let i = 0; i < nC; i++) {
    const a = (i / nC) * TAU + TAU / 40;
    const r = ARENA_R + 1.2;
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.35, 3.2, 8), gold);
    stem.position.y = 1.6;
    g.add(stem);
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 4, 16, Math.PI), gold);
    arm.position.y = 3.1;
    arm.rotation.z = Math.PI;
    g.add(arm);
    for (const dx of [-0.7, 0, 0.7]) {
      const cdl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 6), candleMat);
      cdl.position.set(dx, dx === 0 ? 3.7 : 3.4, 0);
      g.add(cdl);
      const f = new THREE.Sprite(flameMat);
      f.scale.set(0.55, 0.75, 1);
      f.position.set(dx, (dx === 0 ? 3.7 : 3.4) + 0.5, 0);
      g.add(f);
      flames.push(f);
    }
    g.rotation.y = a;
    add(g);
    w.addCollider({ x: g.position.x, z: g.position.z, r: 0.5, top: 4 });
  }
  w.anim.push((t) => {
    for (let i = 0; i < flames.length; i++) {
      const k = 1 + Math.sin(t * 9 + i * 1.7) * 0.08 + Math.sin(t * 23 + i) * 0.05;
      flames[i].scale.set(0.55 * k, 0.75 * k, 1);
    }
  });

  // ── the outer wall with stained glass ──
  const wallMat = mat('#2a1e26', { roughness: 0.8 });
  // open to the sky behind the throne, where she rises
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(WALL_R, WALL_R, WALL_H, 64, 1, true, Math.PI + 0.5, TAU - 1.0), wallMat);
  wall.material = mat('#2a1e26', { roughness: 0.8, side: THREE.BackSide });
  wall.position.y = WALL_H / 2 - 20;
  add(wall);
  const glassMats = [0, 1, 2].map((k) => new THREE.MeshBasicMaterial({ map: stainedGlassTexture(70 + k), fog: false, toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) }));
  const nW = 18;
  for (let i = 0; i < nW; i++) {
    const a = (i / nW) * TAU;
    // skip the arch behind the throne: that is where she rises
    if (Math.cos(a) < -0.9) continue;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(8, 20), glassMats[i % 3]);
    win.position.set(Math.sin(a) * (WALL_R - 0.4), 12, Math.cos(a) * (WALL_R - 0.4));
    win.lookAt(0, 12, 0);
    add(win);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.35, 4, 24, Math.PI), gold);
    frame.position.copy(win.position).multiplyScalar(0.995);
    frame.position.y = 18;
    frame.lookAt(0, 18, 0);
    add(frame);
    // a shaft of coloured light falling across the floor from each window
    const shaft = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 34),
      new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff3050' : '#a040ff', transparent: true, opacity: 0.025, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    shaft.position.set(Math.sin(a) * (WALL_R - 14), 10, Math.cos(a) * (WALL_R - 14));
    shaft.lookAt(0, 10, 0);
    shaft.rotateX(-0.5);
    add(shaft);
  }
  // a great broken arch behind the throne, open to the eclipse
  for (const s of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.5, 60, 8), wallMat);
    tower.position.set(Math.sin(Math.PI + 0.5 * s) * WALL_R, 10, Math.cos(Math.PI + 0.5 * s) * WALL_R);
    add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(4.2, 16, 8), darkStone);
    spire.position.set(tower.position.x, 48, tower.position.z);
    add(spire);
  }

  // ── sky: an eclipse and floating ruins ──
  w.moon.material.color.set('#16060e');
  w.moon.scale.set(150, 150, 1);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: coronaTexture(), color: '#ffffff', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  corona.scale.set(300, 300, 1);
  corona.renderOrder = -7;
  add(corona);
  throne.corona = corona;
  const rockMat = new THREE.MeshStandardMaterial({ map: w.assets.rock.map, color: '#6a5060', roughness: 0.9, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = rng() * TAU;
    const r = 90 + rng() * 80;
    const s = 2 + rng() * 7;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    m.position.set(Math.sin(a) * r, 5 + rng() * 45, Math.cos(a) * r);
    m.scale.y = 0.6;
    add(m);
    throne.rocks.push({ m, y0: m.position.y, ph: rng() * TAU, sp: 0.2 + rng() * 0.4 });
  }
  // floating islands with a stair and candles, like chess pieces left adrift
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.4;
    const r = 105 + rng() * 25;
    const isl = new THREE.Group();
    isl.position.set(Math.sin(a) * r, 8 + rng() * 22, Math.cos(a) * r);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(9, 7, 2, 10), stone);
    isl.add(top);
    const under = new THREE.Mesh(new THREE.ConeGeometry(7, 16, 7), rockMat);
    under.rotation.x = Math.PI;
    under.position.y = -9;
    isl.add(under);
    for (let k = 0; k < 5; k++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 1.4), stone);
      st.position.set(0, 1.3 + k * 0.6, 6 - k * 1.4);
      isl.add(st);
    }
    const f = new THREE.Sprite(flameMat);
    f.scale.set(3, 3, 1);
    f.position.y = 3;
    isl.add(f);
    add(isl);
    throne.rocks.push({ m: isl, y0: isl.position.y, ph: rng() * TAU, sp: 0.15 });
  }
  w.anim.push((t) => {
    for (const r of throne.rocks) r.m.position.y = r.y0 + Math.sin(t * r.sp + r.ph) * 2 + throne.rise * 6;
  });

  // ── lights ──
  const hemi = new THREE.HemisphereLight('#c070c0', '#200810', 0.6);
  add(hemi);
  add(new THREE.AmbientLight('#3a1a2a', 0.3));
  const warm = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    const l = new THREE.PointLight('#ffa050', 55, 36, 1.8);
    l.position.set(Math.sin(a) * (ARENA_R - 4), 4, Math.cos(a) * (ARENA_R - 4));
    add(l);
    warm.push(l);
  }
  const thronelight = new THREE.PointLight('#ff2040', 70, 30, 1.7);
  thronelight.position.set(DAIS.x, 8, DAIS.z + 4);
  add(thronelight);
  throne.redLight = thronelight;
  const sun = new THREE.DirectionalLight('#c0a0ff', 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  w.scene.add(sun);
  w.scene.add(sun.target);
  w.sun = sun;
  RIM.rimColor.value.set('#ff6a9a').lerp(new THREE.Color('#c0a0ff'), 0.4);

  w.onUpdate = (time, dt, focus) => updateThrone(w, time, dt, focus);
}

// The hall tears itself apart: cracks burn, the north gallery breaks off and
// drifts upward, the throne topples into the abyss, the sky turns to blood.
export function ascend(w) {
  const th = w.throne;
  if (th.phase) return;
  th.phase = 1;
  th.phaseT = 0;
}

function updateThrone(w, time, dt, focus) {
  const th = w.throne;
  th.corona.position.set(focus.x + 140, 175, focus.z - 320);
  th.corona.material.rotation = time * 0.02;
  th.corona.material.opacity = 0.75 + Math.sin(time * 0.7) * 0.1 + th.crack * 0.2;
  th.redLight.intensity = (65 + Math.sin(time * 2) * 10) * (1 - th.crack * 0.7);
  if (!th.phase) return;
  th.phaseT += dt;
  th.crack = Math.min(1, th.phaseT / 3);
  th.rise = Math.min(1, th.phaseT / 8);
  th.floorMat.emissiveIntensity = th.crack * (1.4 + Math.sin(time * 3) * 0.3);
  const sk = w.skyMat.uniforms;
  sk.top.value.lerp(new THREE.Color('#1a0206'), Math.min(1, dt * 0.6));
  sk.hor.value.lerp(new THREE.Color('#a01030'), Math.min(1, dt * 0.6));
  sk.glow.value.lerp(new THREE.Color('#ff2040'), Math.min(1, dt * 0.6));
  w.scene.fog.color.lerp(new THREE.Color('#2a0610'), Math.min(1, dt * 0.6));
  // the north gallery breaks away
  for (const s of th.segments) {
    if (!s.north) {
      s.g.position.y = Math.sin(time * 0.6 + s.a * 3) * 0.3 * th.rise;
      continue;
    }
    if (th.phaseT < 0.6) {
      s.g.position.y = (Math.random() - 0.5) * 0.25;
      continue;
    }
    // tumble down into the abyss, out of her way
    s.vy = Math.min(30, s.vy + dt * 9);
    s.g.position.y -= s.vy * dt;
    s.g.rotation.y += s.spin * dt * 0.1;
    if (s.g.position.y < -120) s.g.visible = false;
  }
  // the throne topples backwards into the dark
  const tg = th.throneGroup;
  if (th.phaseT > 1 && tg.visible) {
    tg.rotation.x = Math.max(-1.4, tg.rotation.x - dt * 0.6);
    tg.position.y -= dt * Math.max(0, th.phaseT - 2) * 6;
    tg.position.z -= dt * 3;
    if (tg.position.y < -40) tg.visible = false;
  }
}
