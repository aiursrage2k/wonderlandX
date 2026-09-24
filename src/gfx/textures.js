// Procedural canvas textures. Everything visual in the game is generated here
// or from primitives — there are no image assets.

import * as THREE from 'three';
import { makeCanvas, makeRng, TAU } from '../engine/util.js';

function tex(canvas, repeat = false, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function marbleTile(x, rng, ox, oy, size, dark) {
  const base = dark
    ? [24 + rng() * 10, 19 + rng() * 8, 30 + rng() * 10]
    : [214 + rng() * 20, 204 + rng() * 18, 196 + rng() * 16];
  x.save();
  x.beginPath();
  x.rect(ox, oy, size, size);
  x.clip();
  x.fillStyle = `rgb(${base.map((v) => v | 0).join(',')})`;
  x.fillRect(ox, oy, size, size);
  for (let i = 0; i < 40; i++) {
    const r = rng() * size * 0.3 + 3;
    const cx = ox + rng() * size;
    const cy = oy + rng() * size;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const tone = dark ? (rng() < 0.5 ? '90,70,130' : '0,0,0') : rng() < 0.6 ? '120,100,95' : '255,250,240';
    g.addColorStop(0, `rgba(${tone},${rng() * 0.09})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const veins = 2 + Math.floor(rng() * 4);
  x.lineCap = 'round';
  for (let v = 0; v < veins; v++) {
    let px = ox + rng() * size;
    let py = oy + rng() * size;
    let ang = rng() * TAU;
    const w = 0.5 + rng() * 1.8;
    x.strokeStyle = dark
      ? `rgba(${150 + rng() * 60},${110 + rng() * 40},${180 + rng() * 60},${0.18 + rng() * 0.25})`
      : `rgba(${70 + rng() * 40},${50 + rng() * 30},${55 + rng() * 30},${0.15 + rng() * 0.3})`;
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(px, py);
    const n = 20 + rng() * 40;
    for (let i = 0; i < n; i++) {
      ang += (rng() - 0.5) * 0.9;
      px += Math.cos(ang) * size * 0.04;
      py += Math.sin(ang) * size * 0.04;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  // bevel + grout
  x.lineWidth = 3;
  x.strokeStyle = dark ? 'rgba(170,150,210,0.10)' : 'rgba(255,255,255,0.4)';
  x.beginPath();
  x.moveTo(ox + 1, oy + size - 1);
  x.lineTo(ox + 1, oy + 1);
  x.lineTo(ox + size - 1, oy + 1);
  x.stroke();
  x.strokeStyle = 'rgba(0,0,0,0.5)';
  x.beginPath();
  x.moveTo(ox + size - 1, oy + 1);
  x.lineTo(ox + size - 1, oy + size - 1);
  x.lineTo(ox + 1, oy + size - 1);
  x.stroke();
  x.restore();
  x.strokeStyle = 'rgba(8,4,8,0.95)';
  x.lineWidth = 2;
  x.strokeRect(ox, oy, size, size);
}

function crackPath(rng, px, py, len, S) {
  const pts = [[px, py]];
  let a = rng() * TAU;
  for (let i = 0; i < len; i++) {
    a += (rng() - 0.5) * 1.2;
    px += Math.cos(a) * S * 0.012;
    py += Math.sin(a) * S * 0.012;
    pts.push([px, py]);
  }
  return pts;
}

function strokePath(x, pts, style, w) {
  x.strokeStyle = style;
  x.lineWidth = w;
  x.lineCap = x.lineJoin = 'round';
  x.beginPath();
  x.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) x.lineTo(p[0], p[1]);
  x.stroke();
}

// 8x8 checker marble, tileable. Emissive map carries the red crack glow.
export function marbleChecker(seed = 7) {
  const S = 2048;
  const k = S / 1024;
  const n = 8;
  const size = S / n;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const rng = makeRng(seed);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) marbleTile(x, rng, i * size, j * size, size, (i + j) % 2 === 1);

  // bump (white = high): recessed grout, cracks and chips
  const hb = makeCanvas(S, S);
  const hx = hb.getContext('2d');
  hx.fillStyle = '#fff';
  hx.fillRect(0, 0, S, S);
  hx.strokeStyle = '#000';
  hx.lineWidth = 5 * k;
  for (let i = 0; i <= n; i++) {
    hx.beginPath();
    hx.moveTo(i * size, 0);
    hx.lineTo(i * size, S);
    hx.moveTo(0, i * size);
    hx.lineTo(S, i * size);
    hx.stroke();
  }
  // soft bevel toward each tile's edge
  hx.globalAlpha = 0.25;
  hx.lineWidth = 14 * k;
  for (let i = 0; i <= n; i++) {
    hx.beginPath();
    hx.moveTo(i * size, 0);
    hx.lineTo(i * size, S);
    hx.moveTo(0, i * size);
    hx.lineTo(S, i * size);
    hx.stroke();
  }
  hx.globalAlpha = 1;

  // roughness (white = rough): polished stone with wet, glossy pools
  const rb = makeCanvas(S, S);
  const rx = rb.getContext('2d');
  rx.fillStyle = 'rgb(95,95,95)';
  rx.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    const cx = rng() * S;
    const cy = rng() * S;
    const r = (30 + rng() * 110) * k;
    const g = rx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(42,42,42,1)');
    g.addColorStop(0.7, 'rgba(42,42,42,0.8)');
    g.addColorStop(1, 'rgba(42,42,42,0)');
    rx.fillStyle = g;
    rx.beginPath();
    rx.ellipse(cx, cy, r, r * (0.5 + rng() * 0.5), rng() * 3, 0, TAU);
    rx.fill();
  }
  rx.strokeStyle = 'rgb(200,200,200)';
  rx.lineWidth = 5 * k;
  for (let i = 0; i <= n; i++) {
    rx.beginPath();
    rx.moveTo(i * size, 0);
    rx.lineTo(i * size, S);
    rx.moveTo(0, i * size);
    rx.lineTo(S, i * size);
    rx.stroke();
  }

  // cracks: dark in colour, recessed in bump, glowing in emissive
  const e = makeCanvas(S, S);
  const ex = e.getContext('2d');
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, S, S);
  for (let i = 0; i < 9; i++) {
    const pts = crackPath(rng, rng() * S, rng() * S, 20 + rng() * 60, S);
    strokePath(x, pts, 'rgba(140,10,20,0.35)', 8 * k);
    strokePath(x, pts, 'rgba(5,0,3,0.95)', 3 * k);
    strokePath(x, pts, 'rgba(240,50,60,0.85)', 1 * k);
    strokePath(ex, pts, 'rgb(255,40,50)', 2 * k);
    strokePath(hx, pts, 'rgba(0,0,0,0.9)', 4 * k);
    strokePath(rx, pts, 'rgb(220,220,220)', 4 * k);
  }
  // chipped corners
  for (let i = 0; i < 30; i++) {
    const cx = Math.round(rng() * n) * size + (rng() - 0.5) * 20 * k;
    const cy = Math.round(rng() * n) * size + (rng() - 0.5) * 20 * k;
    const r = (6 + rng() * 16) * k;
    for (const ctx of [hx, x]) {
      ctx.fillStyle = ctx === hx ? 'rgba(0,0,0,0.8)' : 'rgba(20,12,18,0.85)';
      ctx.beginPath();
      for (let q = 0; q < 7; q++) {
        const a = (q / 7) * TAU;
        const rr = r * (0.5 + rng() * 0.6);
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.fill();
    }
  }
  // blood: dark in colour, glossy in roughness
  for (let i = 0; i < 22; i++) {
    const cx = rng() * S;
    const cy = rng() * S;
    const r = (6 + rng() * 26) * k;
    x.fillStyle = `rgba(${90 + rng() * 50},5,12,${0.5 + rng() * 0.35})`;
    rx.fillStyle = 'rgb(48,48,48)';
    for (const ctx of [x, rx]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.7, rng() * 3, 0, TAU);
      ctx.fill();
    }
    for (let q = 0; q < 8; q++) {
      const a = rng() * TAU;
      const d = r * (1 + rng());
      x.beginPath();
      x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, (1 + rng() * 3) * k, 0, TAU);
      x.fill();
    }
  }
  for (let i = 0; i < 70; i++) {
    x.fillStyle = `rgba(${130 + rng() * 80},8,20,0.9)`;
    x.beginPath();
    x.ellipse(rng() * S, rng() * S, 5 * k, 3 * k, rng() * 3, 0, TAU);
    x.fill();
  }
  // Blur the height + roughness maps: hard-edged bumps catch lights as
  // pinpoint glints that crawl across the floor as the camera moves.
  const soften = (src, px) => {
    const out = makeCanvas(S, S);
    const o = out.getContext('2d');
    o.filter = `blur(${px}px)`;
    o.drawImage(src, 0, 0);
    return out;
  };
  return { map: tex(c, true), emissive: tex(e, true), bump: tex(soften(hb, 3 * k), true, false), rough: tex(soften(rb, 6 * k), true, false) };
}

export function groundTexture(seed = 3) {
  const S = 1024;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const rng = makeRng(seed);
  x.fillStyle = '#1b1320';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 3000; i++) {
    const px = rng() * S;
    const py = rng() * S;
    const r = 1 + rng() * 7;
    const t = rng();
    x.fillStyle = t < 0.4 ? `rgba(45,28,52,${rng() * 0.6})` : t < 0.8 ? `rgba(10,6,12,${rng() * 0.6})` : `rgba(30,45,38,${rng() * 0.4})`;
    for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      x.beginPath();
      x.ellipse(px + dx, py + dy, r, r * 0.7, rng() * 3, 0, TAU);
      x.fill();
    }
  }
  for (let i = 0; i < 90; i++) {
    x.fillStyle = `rgba(${110 + rng() * 80},6,18,${0.5 + rng() * 0.4})`;
    x.beginPath();
    x.ellipse(rng() * S, rng() * S, 3, 2, rng() * 3, 0, TAU);
    x.fill();
  }
  return tex(c, true);
}

export function cardTexture(suit = '♥', rank = '7') {
  const W = 256;
  const H = 360;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const red = suit === '♥' || suit === '♦';
  x.fillStyle = '#e9dfcc';
  x.fillRect(0, 0, W, H);
  // aged edges
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(90,50,30,0.55)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = red ? '#8e1119' : '#1b1420';
  x.lineWidth = 6;
  x.strokeRect(14, 14, W - 28, H - 28);
  x.fillStyle = red ? '#a8141f' : '#181018';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 44px Georgia, serif';
  x.fillText(rank, 38, 44);
  x.font = '36px serif';
  x.fillText(suit, 38, 86);
  x.save();
  x.translate(W - 38, H - 44);
  x.rotate(Math.PI);
  x.font = 'bold 44px Georgia, serif';
  x.fillText(rank, 0, 0);
  x.font = '36px serif';
  x.fillText(suit, 0, -42);
  x.restore();
  x.font = '150px serif';
  x.fillText(suit, W / 2, H / 2 + 8);
  // grime + blood
  const rng = makeRng(suit.charCodeAt(0) * 31 + rank.charCodeAt(0));
  for (let i = 0; i < 10; i++) {
    x.fillStyle = `rgba(100,10,10,${rng() * 0.5})`;
    x.beginPath();
    x.arc(rng() * W, rng() * H, 2 + rng() * 12, 0, TAU);
    x.fill();
  }
  return tex(c);
}

export function cardBackTexture() {
  const W = 256;
  const H = 360;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  x.fillStyle = '#5e0b14';
  x.fillRect(0, 0, W, H);
  x.strokeStyle = '#d8b56a';
  x.lineWidth = 5;
  x.strokeRect(12, 12, W - 24, H - 24);
  x.lineWidth = 1.5;
  for (let i = -H; i < W + H; i += 16) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + H, H);
    x.moveTo(i + H, 0);
    x.lineTo(i, H);
    x.stroke();
  }
  x.fillStyle = '#d8b56a';
  x.font = '110px serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('♥', W / 2, H / 2);
  return tex(c);
}

export function porcelainTexture(seed = 11) {
  const W = 512;
  const H = 256;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const rng = makeRng(seed);
  x.fillStyle = '#efe8dc';
  x.fillRect(0, 0, W, H);
  // gold rim + band
  x.fillStyle = '#c9a24a';
  x.fillRect(0, 0, W, 10);
  x.fillStyle = '#8f1f2c';
  x.fillRect(0, 16, W, 5);
  // florals
  for (let i = 0; i < 26; i++) {
    const cx = rng() * W;
    const cy = 40 + rng() * (H - 70);
    const r = 8 + rng() * 14;
    const col = rng() < 0.5 ? '#b3212f' : rng() < 0.5 ? '#3f5aa8' : '#d0703a';
    x.strokeStyle = '#4c6b3a';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(cx, cy);
    x.quadraticCurveTo(cx + 20, cy + 10, cx + 30 * (rng() - 0.5), cy + 30);
    x.stroke();
    x.fillStyle = '#5d7d45';
    x.beginPath();
    x.ellipse(cx + 12, cy + 14, 8, 3, 0.6, 0, TAU);
    x.fill();
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * TAU;
      x.fillStyle = col;
      x.beginPath();
      x.ellipse(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.45, r * 0.28, a, 0, TAU);
      x.fill();
    }
    x.fillStyle = '#e8c35a';
    x.beginPath();
    x.arc(cx, cy, r * 0.22, 0, TAU);
    x.fill();
  }
  // crackle glaze + stains
  x.strokeStyle = 'rgba(80,60,40,0.25)';
  x.lineWidth = 0.8;
  for (let i = 0; i < 40; i++) {
    let px = rng() * W;
    let py = rng() * H;
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < 5; k++) {
      px += (rng() - 0.5) * 30;
      py += (rng() - 0.5) * 30;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  x.fillStyle = '#c9a24a';
  x.fillRect(0, H - 8, W, 8);
  return tex(c, true);
}

export function clockFaceTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  x.fillStyle = '#e6dcc3';
  x.fillRect(0, 0, S, S);
  const g = x.createRadialGradient(S / 2, S / 2, 50, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(90,60,20,0.6)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  x.strokeStyle = '#2a1a10';
  x.lineWidth = 10;
  x.beginPath();
  x.arc(S / 2, S / 2, S / 2 - 14, 0, TAU);
  x.stroke();
  const rn = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  x.fillStyle = '#20140c';
  x.font = 'bold 44px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU - Math.PI / 2;
    x.save();
    x.translate(S / 2 + Math.cos(a) * 190, S / 2 + Math.sin(a) * 190);
    x.rotate(a + Math.PI / 2);
    x.fillText(rn[i], 0, 0);
    x.restore();
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    x.lineWidth = i % 5 ? 2 : 5;
    x.beginPath();
    x.moveTo(S / 2 + Math.cos(a) * 225, S / 2 + Math.sin(a) * 225);
    x.lineTo(S / 2 + Math.cos(a) * 238, S / 2 + Math.sin(a) * 238);
    x.stroke();
  }
  return tex(c);
}

// Soft round sprite used by particles, glows, and lamp halos.
export function glowTexture() {
  const S = 128;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return tex(c, false, false);
}

export function moonTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const rng = makeRng(99);
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(230,210,255,0.5)');
  g.addColorStop(1, 'rgba(160,120,220,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  x.fillStyle = '#e9e0f5';
  x.beginPath();
  x.arc(S / 2, S / 2, S * 0.3, 0, TAU);
  x.fill();
  for (let i = 0; i < 26; i++) {
    const a = rng() * TAU;
    const d = rng() * S * 0.26;
    x.fillStyle = `rgba(150,130,180,${0.15 + rng() * 0.25})`;
    x.beginPath();
    x.arc(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 4 + rng() * 26, 0, TAU);
    x.fill();
  }
  return tex(c);
}

// The Cheshire cat's face looming in the sky: glowing eyes and a wide grin.
export function cheshireTexture() {
  const W = 1024;
  const H = 512;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  // faint head silhouette with stripes
  const hg = x.createRadialGradient(W / 2, H * 0.55, 40, W / 2, H * 0.55, W * 0.45);
  hg.addColorStop(0, 'rgba(70,40,110,0.55)');
  hg.addColorStop(0.7, 'rgba(50,25,80,0.3)');
  hg.addColorStop(1, 'rgba(40,20,60,0)');
  x.fillStyle = hg;
  x.beginPath();
  x.ellipse(W / 2, H * 0.55, W * 0.45, H * 0.45, 0, 0, TAU);
  x.fill();
  // ears
  x.fillStyle = 'rgba(60,35,95,0.4)';
  for (const s of [-1, 1]) {
    x.beginPath();
    x.moveTo(W / 2 + s * 330, H * 0.3);
    x.lineTo(W / 2 + s * 400, 0);
    x.lineTo(W / 2 + s * 200, H * 0.18);
    x.fill();
  }
  x.strokeStyle = 'rgba(110,70,160,0.25)';
  x.lineWidth = 16;
  for (let i = 0; i < 7; i++) {
    x.beginPath();
    x.arc(W / 2, H * 1.2, 250 + i * 40, Math.PI * 1.25, Math.PI * 1.75);
    x.stroke();
  }
  // eyes
  for (const s of [-1, 1]) {
    const ex = W / 2 + s * 170;
    const ey = H * 0.42;
    const g = x.createRadialGradient(ex, ey, 0, ex, ey, 90);
    g.addColorStop(0, 'rgba(200,220,255,1)');
    g.addColorStop(0.35, 'rgba(90,120,255,0.95)');
    g.addColorStop(0.7, 'rgba(90,60,255,0.35)');
    g.addColorStop(1, 'rgba(60,40,200,0)');
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(ex, ey, 95, 70, s * -0.15, 0, TAU);
    x.fill();
    x.fillStyle = '#0a0612';
    x.beginPath();
    x.ellipse(ex, ey, 10, 48, 0, 0, TAU);
    x.fill();
  }
  // grin
  x.save();
  x.beginPath();
  x.moveTo(W / 2 - 330, H * 0.6);
  x.quadraticCurveTo(W / 2, H * 0.98, W / 2 + 330, H * 0.6);
  x.quadraticCurveTo(W / 2, H * 0.78, W / 2 - 330, H * 0.6);
  x.closePath();
  x.fillStyle = 'rgba(20,5,25,0.85)';
  x.fill();
  x.clip();
  x.fillStyle = 'rgba(240,230,255,0.95)';
  for (let i = 0; i < 22; i++) {
    const tx = W / 2 - 320 + i * 30;
    x.beginPath();
    x.moveTo(tx, H * 0.6);
    x.lineTo(tx + 15, H * 0.74 + Math.sin((i / 21) * Math.PI) * 30);
    x.lineTo(tx + 30, H * 0.6);
    x.fill();
    x.beginPath();
    x.moveTo(tx, H * 1);
    x.lineTo(tx + 15, H * 0.8 + Math.sin((i / 21) * Math.PI) * 40);
    x.lineTo(tx + 30, H * 1);
    x.fill();
  }
  x.restore();
  return tex(c);
}

// Distant gothic skyline silhouette for the horizon ring.
export function skylineTexture(seed = 5) {
  const W = 2048;
  const H = 512;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const rng = makeRng(seed);
  x.fillStyle = 'rgba(0,0,0,0)';
  x.fillRect(0, 0, W, H);
  const layer = (col, base, hmax, spikes) => {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, H);
    let px = 0;
    while (px < W) {
      const w = 20 + rng() * 80;
      const h = base + rng() * hmax;
      x.lineTo(px, H - h);
      if (spikes && rng() < 0.3) {
        // spire
        x.lineTo(px + w * 0.5, H - h - 60 - rng() * 120);
      }
      x.lineTo(px + w, H - h);
      px += w;
    }
    x.lineTo(W, H);
    x.fill();
  };
  layer('rgba(30,18,45,1)', 40, 120, true);
  layer('rgba(18,10,28,1)', 10, 60, false);
  // lit windows
  for (let i = 0; i < 60; i++) {
    x.fillStyle = `rgba(255,${160 + rng() * 60},90,${0.4 + rng() * 0.5})`;
    x.fillRect(rng() * W, H - 30 - rng() * 120, 3, 5);
  }
  return tex(c, true);
}

export function barkTexture(seed = 17) {
  const W = 256;
  const H = 512;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const rng = makeRng(seed);
  x.fillStyle = '#1c1318';
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) {
    x.strokeStyle = `rgba(${rng() < 0.5 ? '60,40,50' : '5,2,5'},${0.3 + rng() * 0.5})`;
    x.lineWidth = 1 + rng() * 4;
    let px = rng() * W;
    let py = 0;
    x.beginPath();
    x.moveTo(px, py);
    while (py < H) {
      px += (rng() - 0.5) * 8;
      py += 10 + rng() * 20;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  return tex(c, true);
}

export function gillsTexture(r, g, b) {
  const S = 256;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * TAU;
    x.strokeStyle = `rgba(${r},${g},${b},${0.4 + Math.random() * 0.6})`;
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(S / 2 + Math.cos(a) * 20, S / 2 + Math.sin(a) * 20);
    x.lineTo(S / 2 + Math.cos(a) * 126, S / 2 + Math.sin(a) * 126);
    x.stroke();
  }
  return tex(c);
}

export function capTexture(base, spot) {
  const S = 512;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, S, S);
  const rng = makeRng(base.length * 13);
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = `rgba(0,0,0,${rng() * 0.15})`;
    x.fillRect(rng() * S, rng() * S, 2 + rng() * 6, 2 + rng() * 6);
  }
  for (let i = 0; i < 14; i++) {
    x.fillStyle = spot;
    x.beginPath();
    x.ellipse(rng() * S, rng() * S * 0.8, 10 + rng() * 22, 8 + rng() * 16, 0, 0, TAU);
    x.fill();
  }
  return tex(c, true);
}

// Weathered stone: mottled grey-violet, strata, hairline cracks, lichen.
// Returns colour + bump (greyscale) maps.
export function rockTexture(seed = 61) {
  const S = 1024;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const h = makeCanvas(S, S);
  const hx = h.getContext('2d');
  const rng = makeRng(seed);
  x.fillStyle = '#5a5260';
  x.fillRect(0, 0, S, S);
  hx.fillStyle = '#808080';
  hx.fillRect(0, 0, S, S);
  const wrapDraw = (ctx, fn) => {
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      ctx.save();
      ctx.translate(dx, dy);
      fn(ctx);
      ctx.restore();
    }
  };
  // mottling at several scales
  for (const [n, rMin, rMax, a] of [[60, 60, 180, 0.18], [400, 10, 50, 0.16], [3000, 1, 6, 0.25]]) {
    for (let i = 0; i < n; i++) {
      const px = rng() * S;
      const py = rng() * S;
      const r = rMin + rng() * (rMax - rMin);
      const t = rng();
      const col = t < 0.4 ? '30,26,36' : t < 0.75 ? '120,112,128' : '84,70,78';
      const ha = t < 0.4 ? '0,0,0' : '255,255,255';
      const alpha = rng() * a;
      wrapDraw(x, (ctx) => {
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(${col},${alpha})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      });
      wrapDraw(hx, (ctx) => {
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(${ha},${alpha * 1.5})`);
        g.addColorStop(1, `rgba(${ha},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      });
    }
  }
  // sedimentary strata
  for (let i = 0; i < 26; i++) {
    const y0 = rng() * S;
    const amp = 6 + rng() * 20;
    const f = 1 + Math.floor(rng() * 3);
    const w = 1 + rng() * 4;
    for (const [ctx, col] of [[x, `rgba(35,30,40,${0.2 + rng() * 0.3})`], [hx, 'rgba(0,0,0,0.5)']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let px = 0; px <= S; px += 8) ctx.lineTo(px, y0 + Math.sin((px / S) * TAU * f + i) * amp);
      ctx.stroke();
    }
  }
  // cracks
  for (let i = 0; i < 30; i++) {
    const pts = crackPath(rng, rng() * S, rng() * S, 8 + rng() * 30, S * 0.8);
    strokePath(x, pts, 'rgba(15,10,18,0.8)', 1.5 + rng() * 2);
    strokePath(hx, pts, 'rgba(0,0,0,0.9)', 3);
  }
  // lichen: teal-grey and ochre crusts
  for (let i = 0; i < 90; i++) {
    const px = rng() * S;
    const py = rng() * S;
    const col = rng() < 0.6 ? `rgba(${90 + rng() * 40},${130 + rng() * 40},${110 + rng() * 30},` : `rgba(${160 + rng() * 40},${120 + rng() * 30},${50},`;
    for (let k = 0; k < 30; k++) {
      x.fillStyle = col + `${0.2 + rng() * 0.4})`;
      x.beginPath();
      x.arc(px + (rng() - 0.5) * 40, py + (rng() - 0.5) * 40, 1 + rng() * 4, 0, TAU);
      x.fill();
    }
  }
  return { map: tex(c, true), bump: tex(h, true, false) };
}

// Clustered leaves for hedges: dark glossy greens with lighter veins.
export function leafTexture(seed = 13) {
  const S = 512;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const rng = makeRng(seed);
  x.fillStyle = '#0c1a12';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const px = rng() * S;
    const py = rng() * S;
    const a = rng() * TAU;
    const l = 8 + rng() * 14;
    const g = 40 + rng() * 60;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      x.save();
      x.translate(px + dx, py + dy);
      x.rotate(a);
      x.fillStyle = `rgb(${g * 0.35},${g},${g * 0.55})`;
      x.beginPath();
      x.ellipse(0, 0, l, l * 0.42, 0, 0, TAU);
      x.fill();
      x.strokeStyle = `rgba(160,220,170,${0.15 + rng() * 0.2})`;
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(-l, 0);
      x.lineTo(l, 0);
      x.stroke();
      x.restore();
    }
  }
  return tex(c, true);
}
