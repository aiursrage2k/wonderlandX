// Depth 02 — The Mad Hatter's Clockworks.
// A giant clock face split into twelve hour-platforms the Hatter can raise
// and sink, ringed by a boiling-tea channel. Two enormous clock hands sweep
// the floor and shove anyone in their path toward the tea.

import * as THREE from 'three';
import { makeCanvas, makeRng, TAU, rand } from '../engine/util.js';
import { mat } from '../gfx/models.js';
import { RIM } from '../gfx/rim.js';
import { sfx } from '../engine/audio.js';

export const HUB = 12;
export const CLOCK_R = 52;
export const CH_OUT = 58;
const WALK_OUT = 94;
const MOAT_OUT = 100;
export const WALL_R = 103;
const WALL_H = 46;
const U = CLOCK_R / 34; // clock-face layout was drawn for a 34 m face
export const TEA_Y = -1.3;
const BRIDGES = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
const SECTOR = TAU / 12;

const angOf = (x, z) => (Math.atan2(z, x) + TAU) % TAU;
const angDist = (a, b) => {
  const d = Math.abs(a - b) % TAU;
  return d > Math.PI ? TAU - d : d;
};

// ───────────────────────── textures ─────────────────────────
// Riveted brass deck plates, for the plazas out in the wastes.
export function brassPlazaMaterial() {
  const t = plateTexture();
  t.repeat.set(1, 1);
  return new THREE.MeshStandardMaterial({
    map: t, bumpMap: t, bumpScale: 2, roughness: 0.5, metalness: 0.6, color: '#e0c8a8',
    emissive: '#3a1a06', emissiveIntensity: 0.4,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
}

function tex(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function clockFloorTextures() {
  const S = 2048;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const e = makeCanvas(S, S);
  const ex = e.getContext('2d');
  const rng = makeRng(1212);
  const C = S / 2;
  const R = S / 2; // texture edge == CLOCK_R
  const px = (r) => ((r * U) / CLOCK_R) * R; // r in 34-unit face coordinates
  // aged bronze-marble ground
  const g = x.createRadialGradient(C, C, 0, C, C, R);
  g.addColorStop(0, '#6a5438');
  g.addColorStop(0.6, '#4a3824');
  g.addColorStop(1, '#2a1e14');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) {
    x.fillStyle = rng() < 0.5 ? `rgba(20,12,6,${rng() * 0.18})` : `rgba(200,160,100,${rng() * 0.08})`;
    x.beginPath();
    x.arc(rng() * S, rng() * S, 3 + rng() * 40, 0, TAU);
    x.fill();
  }
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, S, S);
  // concentric brass rings
  const ring = (r, w, col, glow) => {
    x.strokeStyle = col;
    x.lineWidth = w;
    x.beginPath();
    x.arc(C, C, px(r), 0, TAU);
    x.stroke();
    if (glow) {
      ex.strokeStyle = glow;
      ex.lineWidth = w * 0.5;
      ex.beginPath();
      ex.arc(C, C, px(r), 0, TAU);
      ex.stroke();
    }
  };
  ring(33.4, 26, '#c9a04a');
  ring(32.6, 6, '#3a2410');
  ring(26, 10, '#b08840');
  ring(20.5, 4, '#8a6a30');
  ring(HUB / U + 0.3, 14, '#c9a04a', 'rgba(255,150,40,0.6)');
  ring(12, 3, '#8a6a30');
  // sector engravings (the seams where platforms split)
  x.strokeStyle = 'rgba(20,10,4,0.9)';
  x.lineWidth = 5;
  for (let i = 0; i < 12; i++) {
    const a = i * SECTOR;
    x.beginPath();
    x.moveTo(C + Math.cos(a) * px(HUB / U), C + Math.sin(a) * px(HUB / U));
    x.lineTo(C + Math.cos(a) * px(34), C + Math.sin(a) * px(34));
    x.stroke();
  }
  // minute ticks
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    const r0 = i % 5 ? 30.6 : 29.2;
    x.strokeStyle = '#1a0e06';
    x.lineWidth = i % 5 ? 6 : 14;
    x.beginPath();
    x.moveTo(C + Math.cos(a) * px(r0), C + Math.sin(a) * px(r0));
    x.lineTo(C + Math.cos(a) * px(32), C + Math.sin(a) * px(32));
    x.stroke();
  }
  // Roman numerals, XII at the top of the texture (= north in the world)
  const rn = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  x.textAlign = ex.textAlign = 'center';
  x.textBaseline = ex.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU - Math.PI / 2;
    const r = px(23.2);
    for (const [ctx, fill] of [[x, '#e8c878'], [ex, 'rgba(255,170,60,0.55)']]) {
      ctx.save();
      ctx.translate(C + Math.cos(a) * r, C + Math.sin(a) * r);
      ctx.rotate(a + Math.PI / 2);
      ctx.font = `bold ${px(4.4)}px Georgia, serif`;
      ctx.fillStyle = fill;
      if (ctx === x) {
        ctx.strokeStyle = '#1a0e06';
        ctx.lineWidth = 10;
        ctx.strokeText(rn[i], 0, 0);
      }
      ctx.fillText(rn[i], 0, 0);
      ctx.restore();
    }
  }
  // filigree swirls between the rings
  x.strokeStyle = 'rgba(200,160,80,0.35)';
  x.lineWidth = 4;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    x.beginPath();
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      const r = px(13 + t * 7);
      const aa = a + Math.sin(t * Math.PI * 2) * 0.12 + t * 0.2;
      x.lineTo(C + Math.cos(aa) * r, C + Math.sin(aa) * r);
    }
    x.stroke();
  }
  // centre rosette
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    x.fillStyle = k % 2 ? '#8a6a30' : '#c9a04a';
    x.beginPath();
    x.moveTo(C, C);
    x.arc(C, C, px(7.2), a, a + TAU / 16);
    x.fill();
  }
  // tea stains, scorches, cracks
  for (let i = 0; i < 40; i++) {
    const a = rng() * TAU;
    const r = px(9 + rng() * 23);
    x.fillStyle = rng() < 0.5 ? `rgba(60,20,6,${0.2 + rng() * 0.3})` : `rgba(10,5,3,${0.2 + rng() * 0.3})`;
    x.beginPath();
    x.ellipse(C + Math.cos(a) * r, C + Math.sin(a) * r, 20 + rng() * 70, 14 + rng() * 40, rng() * 3, 0, TAU);
    x.fill();
  }
  for (let i = 0; i < 26; i++) {
    let cx = C + (rng() - 0.5) * S * 0.9;
    let cy = C + (rng() - 0.5) * S * 0.9;
    let a = rng() * TAU;
    x.strokeStyle = 'rgba(10,5,2,0.8)';
    x.lineWidth = 2 + rng() * 2;
    ex.strokeStyle = 'rgba(255,110,20,0.7)';
    ex.lineWidth = 2;
    x.beginPath();
    ex.beginPath();
    x.moveTo(cx, cy);
    ex.moveTo(cx, cy);
    for (let k = 0; k < 16; k++) {
      a += (rng() - 0.5) * 1.1;
      cx += Math.cos(a) * 14;
      cy += Math.sin(a) * 14;
      x.lineTo(cx, cy);
      ex.lineTo(cx, cy);
    }
    x.stroke();
    if (i % 3 === 0) ex.stroke();
  }
  // roughness: polished brass rings are glossier
  const rgh = makeCanvas(512, 512);
  const rx = rgh.getContext('2d');
  rx.fillStyle = 'rgb(130,130,130)';
  rx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {
    rx.fillStyle = `rgba(20,20,20,${0.3 + rng() * 0.5})`;
    rx.beginPath();
    rx.arc(rng() * 512, rng() * 512, 6 + rng() * 30, 0, TAU);
    rx.fill();
  }
  return { map: tex(c), emissive: tex(e), rough: tex(rgh, { srgb: false }) };
}

function plateTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const rng = makeRng(77);
  x.fillStyle = '#2a2420';
  x.fillRect(0, 0, S, S);
  const n = 4;
  const s = S / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const v = 36 + rng() * 22;
      x.fillStyle = `rgb(${v + 10},${v},${v - 6})`;
      x.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      // rust + oil
      for (let k = 0; k < 16; k++) {
        x.fillStyle = rng() < 0.5 ? `rgba(120,60,20,${rng() * 0.25})` : `rgba(0,0,0,${rng() * 0.25})`;
        x.beginPath();
        x.arc(i * s + rng() * s, j * s + rng() * s, 4 + rng() * 20, 0, TAU);
        x.fill();
      }
      // rivets
      x.fillStyle = '#b09060';
      for (const [dx, dy] of [[10, 10], [s - 10, 10], [10, s - 10], [s - 10, s - 10]]) {
        x.beginPath();
        x.arc(i * s + dx, j * s + dy, 4, 0, TAU);
        x.fill();
      }
      // tread pattern
      x.strokeStyle = 'rgba(0,0,0,0.35)';
      x.lineWidth = 3;
      for (let k = 1; k < 6; k++) {
        x.beginPath();
        x.moveTo(i * s + 20, j * s + (k * s) / 6);
        x.lineTo(i * s + s - 20, j * s + (k * s) / 6 + ((k % 2) * 2 - 1) * 8);
        x.stroke();
      }
    }
  }
  x.strokeStyle = '#8a6a30';
  x.lineWidth = 4;
  for (let i = 0; i <= n; i++) {
    x.beginPath();
    x.moveTo(i * s, 0);
    x.lineTo(i * s, S);
    x.moveTo(0, i * s);
    x.lineTo(S, i * s);
    x.stroke();
  }
  return tex(c, { repeat: true });
}

function wallTexture() {
  const W = 1024;
  const H = 512;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const e = makeCanvas(W, H);
  const ex = e.getContext('2d');
  const rng = makeRng(5);
  x.fillStyle = '#2a1812';
  x.fillRect(0, 0, W, H);
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, W, H);
  // bricks
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 24; col++) {
      const bx = col * 44 + (row % 2) * 22;
      const v = 50 + rng() * 40;
      x.fillStyle = `rgb(${v + 20},${v * 0.55},${v * 0.4})`;
      x.fillRect(bx + 1, row * 16 + 1, 42, 14);
    }
  }
  // iron pilasters + tall arched windows glowing amber
  for (let i = 0; i < 4; i++) {
    const cx = i * 256 + 128;
    x.fillStyle = '#16100c';
    x.fillRect(i * 256, 0, 22, H);
    const w = 90;
    const top = 120;
    for (const [ctx, col] of [[x, '#ffb050'], [ex, '#ff9a30']]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, H - 70);
      ctx.lineTo(cx - w / 2, top + w / 2);
      ctx.arc(cx, top + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(cx + w / 2, H - 70);
      ctx.fill();
    }
    // mullions
    x.fillStyle = '#16100c';
    x.fillRect(cx - 3, top, 6, H - 70 - top);
    for (let k = 0; k < 5; k++) x.fillRect(cx - w / 2, top + 60 + k * 55, w, 5);
    ex.fillStyle = '#000';
    ex.fillRect(cx - 3, top, 6, H - 70 - top);
    for (let k = 0; k < 5; k++) ex.fillRect(cx - w / 2, top + 60 + k * 55, w, 5);
  }
  return { map: tex(c, { repeat: true }), emissive: tex(e, { repeat: true }) };
}

// The Hatter's face looming over the north wall.
function hatterFaceTexture() {
  const W = 1024;
  const H = 1024;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  // hat
  x.fillStyle = '#1a0e12';
  x.fillRect(W * 0.26, H * 0.02, W * 0.48, H * 0.36);
  x.beginPath();
  x.ellipse(W / 2, H * 0.38, W * 0.4, H * 0.05, 0, 0, TAU);
  x.fill();
  x.fillStyle = '#7a1020';
  x.fillRect(W * 0.26, H * 0.27, W * 0.48, H * 0.06);
  // the 10/6 card
  x.save();
  x.translate(W * 0.64, H * 0.2);
  x.rotate(0.25);
  x.fillStyle = '#efe4cf';
  x.fillRect(-45, -60, 90, 120);
  x.fillStyle = '#a01020';
  x.font = 'bold 44px Georgia, serif';
  x.textAlign = 'center';
  x.fillText('10/6', 0, 15);
  x.restore();
  // wild orange hair
  x.fillStyle = '#c0501a';
  for (let i = 0; i < 40; i++) {
    const s = i % 2 ? 1 : -1;
    x.beginPath();
    const bx = W / 2 + s * (W * 0.22 + Math.random() * 60);
    const by = H * 0.4 + Math.random() * 160;
    x.moveTo(bx, by);
    x.quadraticCurveTo(bx + s * 90, by + 40, bx + s * (60 + Math.random() * 90), by + 90 + Math.random() * 60);
    x.lineTo(bx + s * 10, by + 30);
    x.fill();
  }
  // gaunt pale face
  const fg = x.createRadialGradient(W / 2, H * 0.58, 30, W / 2, H * 0.6, W * 0.3);
  fg.addColorStop(0, '#e8dcd0');
  fg.addColorStop(0.7, '#b8a898');
  fg.addColorStop(1, '#6a5a50');
  x.fillStyle = fg;
  x.beginPath();
  x.ellipse(W / 2, H * 0.6, W * 0.22, H * 0.24, 0, 0, TAU);
  x.fill();
  // sunken eyes: left dark, right behind a glowing monocle
  x.fillStyle = '#1a0a0a';
  x.beginPath();
  x.ellipse(W * 0.42, H * 0.53, 56, 34, -0.2, 0, TAU);
  x.fill();
  x.fillStyle = '#ffcc80';
  x.beginPath();
  x.arc(W * 0.42, H * 0.53, 12, 0, TAU);
  x.fill();
  x.strokeStyle = '#c9a04a';
  x.lineWidth = 12;
  x.beginPath();
  x.arc(W * 0.59, H * 0.52, 62, 0, TAU);
  x.stroke();
  const mg = x.createRadialGradient(W * 0.59, H * 0.52, 0, W * 0.59, H * 0.52, 58);
  mg.addColorStop(0, '#fff0a0');
  mg.addColorStop(0.35, '#ff7a10');
  mg.addColorStop(1, '#6a1000');
  x.fillStyle = mg;
  x.beginPath();
  x.arc(W * 0.59, H * 0.52, 56, 0, TAU);
  x.fill();
  // brows
  x.strokeStyle = '#6a2a10';
  x.lineWidth = 16;
  x.beginPath();
  x.moveTo(W * 0.34, H * 0.45);
  x.lineTo(W * 0.47, H * 0.48);
  x.moveTo(W * 0.53, H * 0.44);
  x.lineTo(W * 0.68, H * 0.41);
  x.stroke();
  // the grin
  x.save();
  x.beginPath();
  x.moveTo(W * 0.33, H * 0.66);
  x.quadraticCurveTo(W / 2, H * 0.86, W * 0.67, H * 0.64);
  x.quadraticCurveTo(W / 2, H * 0.72, W * 0.33, H * 0.66);
  x.closePath();
  x.fillStyle = '#2a0808';
  x.fill();
  x.clip();
  x.fillStyle = '#f0e8d0';
  for (let i = 0; i < 16; i++) {
    const tx = W * 0.33 + i * 22;
    x.fillRect(tx + 2, H * 0.64, 18, H * 0.05 + Math.sin((i / 15) * Math.PI) * 30);
    x.fillRect(tx + 2, H * 0.78 - Math.sin((i / 15) * Math.PI) * 20, 18, 60);
  }
  x.restore();
  // bow tie
  x.fillStyle = '#7a1020';
  x.beginPath();
  x.moveTo(W / 2, H * 0.88);
  x.lineTo(W * 0.38, H * 0.82);
  x.lineTo(W * 0.38, H * 0.95);
  x.closePath();
  x.moveTo(W / 2, H * 0.88);
  x.lineTo(W * 0.62, H * 0.82);
  x.lineTo(W * 0.62, H * 0.95);
  x.closePath();
  x.fill();
  return tex(c);
}

// Glowing, churning boiling tea.
function teaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      varying vec3 vW; uniform float t;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 p = vW.xz * 0.35;
        float a = n(p + vec2(t*0.3, t*0.2)) * 0.6 + n(p*2.3 - vec2(t*0.5, 0.0)) * 0.4;
        float b = n(p*5.0 + vec2(0.0, t*0.8));
        vec3 dark = vec3(0.22, 0.05, 0.01);
        vec3 hot = vec3(0.95, 0.38, 0.07);
        vec3 c = mix(dark, hot, smoothstep(0.35, 0.8, a));
        c += vec3(1.3, 0.7, 0.25) * smoothstep(0.84, 0.96, b) * 0.45; // bubbles
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// ───────────────────────── geometry helpers ─────────────────────────
// Annular sector extruded downward; top face UV maps the whole clock.
function wedge(r0, r1, a0, a1, depth, uvR) {
  const shape = new THREE.Shape();
  const steps = 16;
  // shape coords: (x, -z) so that after rotateX(-90°) world z = -shapeY
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const p = [Math.cos(a) * r1, -Math.sin(a) * r1];
    if (i === 0) shape.moveTo(p[0], p[1]);
    else shape.lineTo(p[0], p[1]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / steps;
    shape.lineTo(Math.cos(a) * r0, -Math.sin(a) * r0);
  }
  const uv = {
    generateTopUV(geo, v, a, b, c) {
      return [a, b, c].map((i) => new THREE.Vector2(v[i * 3] / (2 * uvR) + 0.5, v[i * 3 + 1] / (2 * uvR) + 0.5));
    },
    generateSideWallUV(geo, v, a, b, c, d) {
      return [a, b, c, d].map((i, k) => new THREE.Vector2(k < 2 ? 0 : 1, (v[i * 3 + 2] / depth) * 0.2));
    },
  };
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, UVGenerator: uv, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -depth, 0);
  return g;
}

function disc(r0, r1, depth, uvScale) {
  return wedge(r0, r1, 0, TAU - 1e-4, depth, uvScale);
}

// ───────────────────────── the builder ─────────────────────────
export function buildClockworks(w) {
  const rng = w.rng;
  const group = w.group;
  const add = (o) => {
    group.add(o);
    return o;
  };
  const t = w.theme;
  // open mode: no hall around the arena — it sits in the middle of a wide
  // wasteland (built by the garden generator) and has to be found
  const open = !!w.arena;
  const midWalk = (CH_OUT + WALK_OUT) / 2;
  w.glassPos = { x: 0, z: -midWalk };
  if (!open) {
    w.bound = MOAT_OUT - 1.5;
    w.spawn = { x: 0, z: midWalk };
    w.plazas = [
      { x: 0, z: midWalk, r: 10, h: 0 },
      { x: 0, z: 0, r: CLOCK_R, h: 0 },
      { x: 0, z: -midWalk, r: 10, h: 0 },
    ];
    w.castle.visible = false;
    w.cheshire.visible = false;
    w.group.children.forEach((c) => {
      if (c.geometry && c.geometry.type === 'CylinderGeometry' && c.material.map === w.assets.skyline) c.visible = false;
    });
    w.scene.fog.density = 0.0075;
  }

  const clock = { sectors: [], hands: [], hurtT: 0, teaT: 0, strikes: 0 };
  w.clock = clock;

  // ── height, spawning and hazards ──
  const onBridge = (x, z) => {
    const a = angOf(x, z);
    const r = Math.hypot(x, z);
    return BRIDGES.some((b) => angDist(a, b) * r < 2.3);
  };
  w.heightFn = (x, z) => {
    const r = Math.hypot(x, z);
    if (r < HUB) return 0;
    if (r < CLOCK_R) return clock.sectors[Math.floor(angOf(x, z) / SECTOR) % 12].y;
    if (r < CH_OUT) return onBridge(x, z) ? 0.25 : TEA_Y;
    if (r < WALK_OUT) return 0;
    if (r < MOAT_OUT) return open && onBridge(x, z) ? 0.25 : TEA_Y;
    if (!open) return 14;
    if (r < w.arena.r) return 0;
    return w.gardenHeight(x, z);
  };
  w.isTea = (x, z, y) => {
    const h = w.heightFn(x, z);
    return h <= TEA_Y + 0.05 && y < TEA_Y + 0.6;
  };
  w.sampleSpot = () => {
    if (open && rng() < 0.75) {
      // out in the wastes
      for (let k = 0; k < 20; k++) {
        const x = rng.range(-88, 88) * w.S;
        const z = rng.range(-88, 88) * w.S;
        const d = Math.hypot(x, z);
        if (d > w.arena.r + 4 && d < 90 * w.S) return { x, z };
      }
    }
    const onFace = rng() < 0.35;
    const r = onFace ? rng.range(HUB + 2, CLOCK_R - 3) : rng.range(CH_OUT + 2.5, WALK_OUT - 3);
    const a = rng() * TAU;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  };
  w.spawnOk = (x, z) => {
    const r = Math.hypot(x, z);
    if (open && r >= WALK_OUT - 2) return r > w.arena.r + 2 && r < 95 * w.S && !w.solidAt(x, w.height(x, z) + 0.5, z);
    return r < WALK_OUT - 2 && w.heightFn(x, z) > -0.5 && !w.solidAt(x, 0.5, z);
  };

  // ── the clock face: hub + twelve movable hour sectors ──
  const floorTex = clockFloorTextures();
  const faceMat = () => new THREE.MeshStandardMaterial({
    map: floorTex.map, emissiveMap: floorTex.emissive, emissive: new THREE.Color('#ff8a30'), emissiveIntensity: 0.9,
    roughnessMap: floorTex.rough, roughness: 0.9, metalness: 0.45,
  });
  const hub = new THREE.Mesh(disc(0.01, HUB, 4, CLOCK_R), faceMat());
  hub.receiveShadow = true;
  add(hub);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(wedge(HUB + 0.04, CLOCK_R, i * SECTOR + 0.004, (i + 1) * SECTOR - 0.004, 5, CLOCK_R), faceMat());
    m.receiveShadow = true;
    m.castShadow = true;
    add(m);
    // flat glowing overlay used to telegraph this hour sinking or rising
    const flat = new THREE.Shape();
    const a0 = i * SECTOR;
    const a1 = (i + 1) * SECTOR;
    for (let k = 0; k <= 12; k++) {
      const a = a0 + ((a1 - a0) * k) / 12;
      if (k === 0) flat.moveTo(Math.cos(a) * CLOCK_R, -Math.sin(a) * CLOCK_R);
      else flat.lineTo(Math.cos(a) * CLOCK_R, -Math.sin(a) * CLOCK_R);
    }
    for (let k = 12; k >= 0; k--) {
      const a = a0 + ((a1 - a0) * k) / 12;
      flat.lineTo(Math.cos(a) * (HUB + 0.3), -Math.sin(a) * (HUB + 0.3));
    }
    const og = new THREE.ShapeGeometry(flat);
    og.rotateX(-Math.PI / 2);
    const overlay = new THREE.Mesh(og, new THREE.MeshBasicMaterial({ color: '#ff1020', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    overlay.position.y = 0.06;
    overlay.renderOrder = 3;
    m.add(overlay);
    clock.sectors.push({ i, y: 0, target: 0, mesh: m, overlay, warn: null, warnT: 0, holdT: 0 });
  }

  // ── boiling tea: one big surface under everything ──
  const teaMat = teaMaterial();
  clock.teaMat = teaMat;
  const tea = new THREE.Mesh(new THREE.CircleGeometry(MOAT_OUT + 1, 96).rotateX(-Math.PI / 2), teaMat);
  tea.position.y = TEA_Y;
  add(tea);

  // ── walkway ring + outer lip ──
  const plate = plateTexture();
  plate.repeat.set(1 / 6, 1 / 6);
  const plateMat = new THREE.MeshStandardMaterial({ map: plate, bumpMap: plate, bumpScale: 2, roughness: 0.55, metalness: 0.55, color: '#d8c8b8' });
  const walk = new THREE.Mesh(disc(CH_OUT, WALK_OUT, 5, 0.5), plateMat);
  // planar UVs for the plates
  const wuv = walk.geometry.attributes.uv;
  const wpos = walk.geometry.attributes.position;
  for (let i = 0; i < wuv.count; i++) wuv.setXY(i, wpos.getX(i), wpos.getZ(i));
  walk.receiveShadow = true;
  add(walk);
  const lip = new THREE.Mesh(disc(MOAT_OUT, (open ? w.arena.r : WALL_R) + 0.5, 3, 1), mat('#3a2a20', { roughness: 0.8 }));
  lip.position.y = open ? 0.02 : 0.4;
  add(lip);

  // bridges over the channel
  const grate = mat('#4a3a2a', { metalness: 0.7, roughness: 0.4 });
  const brass = mat('#c9a04a', { metalness: 0.9, roughness: 0.28 });
  const spans = [[CLOCK_R, CH_OUT]];
  if (open) spans.push([WALK_OUT, MOAT_OUT]);
  for (const b of BRIDGES) for (const [r0, r1] of spans) {
    const g = new THREE.Group();
    const bl = r1 - r0 + 3;
    const bc = (r1 + r0) / 2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(bl, 0.5, 4.4), grate);
    deck.position.set(bc, 0.0, 0);
    deck.receiveShadow = deck.castShadow = true;
    g.add(deck);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(bl, 0.1, 0.1), brass);
      rail.position.set(bc, 1.1, s * 2.1);
      g.add(rail);
      for (let k = 0; k < 4; k++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), brass);
        post.position.set(bc - bl / 2 + 0.5 + (k * (bl - 1)) / 3, 0.55, s * 2.1);
        g.add(post);
      }
    }
    g.rotation.y = -b;
    add(g);
  }

  // ── the clock hands ──
  const handShape = (L, W) => {
    const s = new THREE.Shape();
    s.moveTo(-2, -W * 0.3);
    s.lineTo(L * 0.7, -W * 0.5);
    s.lineTo(L * 0.72, -W * 1.3); // spade flare
    s.quadraticCurveTo(L * 0.9, -W * 0.9, L, 0);
    s.quadraticCurveTo(L * 0.9, W * 0.9, L * 0.72, W * 1.3);
    s.lineTo(L * 0.7, W * 0.5);
    s.lineTo(-2, W * 0.3);
    s.lineTo(-2, -W * 0.3);
    return s;
  };
  const handMat = new THREE.MeshStandardMaterial({ color: '#1a1410', metalness: 0.85, roughness: 0.35, emissive: '#ff5010', emissiveIntensity: 0.0 });
  const edgeMat = brass;
  for (const [L, W, speed, y] of [[CLOCK_R * 0.7, 1.8, 0.07, 0.55], [CLOCK_R * 0.96, 1.2, 0.16, 0.9]]) {
    const pivot = new THREE.Group();
    pivot.position.y = 0;
    const geo = new THREE.ExtrudeGeometry(handShape(L, W), { depth: 0.55, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, handMat);
    m.position.y = y - 0.55;
    m.castShadow = true;
    pivot.add(m);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(L * 0.66, 0.12, 0.18), edgeMat);
    trim.position.set(L * 0.33, y + 0.05, 0);
    pivot.add(trim);
    add(pivot);
    clock.hands.push({ pivot, L, W: W * 1.3, speed, angle: rng() * TAU, top: y + 0.25, mesh: m });
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 1.8, 40), brass);
  cap.position.y = 0.8;
  cap.castShadow = true;
  add(cap);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 12, 0, TAU, 0, Math.PI / 2), mat('#ff7a20', { emissive: '#ff5000', emissiveIntensity: 1.2 }));
  capTop.position.y = 1.8;
  add(capTop);
  w.colliders.push({ x: 0, z: 0, r: 4.1, top: 1.8 });

  const iron = mat('#1c1612', { metalness: 0.8, roughness: 0.45 });
  if (!open) {
  // ── walls, windows, dome girders ──
  const wallT = wallTexture();
  wallT.map.repeat.set(15, 1);
  wallT.emissive.repeat.set(15, 1);
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(WALL_R, WALL_R, WALL_H, 120, 1, true),
    new THREE.MeshStandardMaterial({ map: wallT.map, emissiveMap: wallT.emissive, emissive: '#ff9a40', emissiveIntensity: 1.3, roughness: 0.9, side: THREE.BackSide }),
  );
  wall.position.y = WALL_H / 2;
  add(wall);
  for (let k = 0; k < 8; k++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(WALL_R, 0.9, 6, 64, Math.PI), iron);
    arc.rotation.y = (k / 8) * Math.PI;
    arc.scale.y = 0.55;
    arc.position.y = WALL_H - 1;
    add(arc);
  }
  for (const [r, y] of [[WALL_R, WALL_H - 1], [WALL_R * 0.72, WALL_H - 1 + WALL_R * 0.55 * 0.69], [WALL_R * 0.4, WALL_H - 1 + WALL_R * 0.55 * 0.92]]) {
    const ringG = new THREE.Mesh(new THREE.TorusGeometry(r, 0.8, 6, 96), iron);
    ringG.rotation.x = Math.PI / 2;
    ringG.position.y = y;
    add(ringG);
  }
  // wall pipes
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU + 0.07;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, WALL_H, 10), mat('#6a4a2a', { metalness: 0.8, roughness: 0.35 }));
    pipe.position.set(Math.cos(a) * (WALL_R - 0.9), WALL_H / 2, Math.sin(a) * (WALL_R - 0.9));
    add(pipe);
    for (const y of [4, 12, 20, 28, 36]) {
      const j = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.14, 6, 14), brass);
      j.rotation.x = Math.PI / 2;
      j.position.set(pipe.position.x, y, pipe.position.z);
      add(j);
    }
  }

  // ── giant gears on the walls ──
  const gearGeo = (R) => {
    const g = new THREE.Group();
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.12, 8, 40), brass);
    g.add(ringM);
    const teeth = Math.round(R * 5);
    for (let k = 0; k < teeth; k++) {
      const a = (k / teeth) * TAU;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(R * 0.2, R * 0.22, R * 0.2), brass);
      tooth.position.set(Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12, 0);
      tooth.rotation.z = a;
      g.add(tooth);
    }
    for (let k = 0; k < 5; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(R * 2, R * 0.12, R * 0.12), brass);
      spoke.rotation.z = (k / 5) * Math.PI;
      g.add(spoke);
    }
    return g;
  };
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU + 0.3;
    const R = rng.range(4, 9);
    const g = gearGeo(R);
    g.position.set(Math.cos(a) * (WALL_R - 1.6), rng.range(12, 34), Math.sin(a) * (WALL_R - 1.6));
    g.lookAt(0, g.position.y, 0);
    const sp = rng.range(0.1, 0.4) * (i % 2 ? 1 : -1);
    w.anim.push((time) => {
      g.rotation.z = time * sp;
    });
    add(g);
  }

  // ── giant teapots pouring into the moat ──
  const copper = new THREE.MeshStandardMaterial({ color: '#b8683a', metalness: 0.85, roughness: 0.35 });
  const potProf = [];
  for (let k = 0; k <= 14; k++) {
    const u = k / 14;
    potProf.push(new THREE.Vector2(Math.sin(u * Math.PI) * 1.2 + 0.25, u * 2));
  }
  const potGeo = new THREE.LatheGeometry(potProf, 28);
  const streamMat = teaMat;
  const potAngles = [0.25, 1.1, 2.0, 3.55, 4.4, 5.3].map((a) => a + Math.PI / 2 + 0.3);
  for (const a of potAngles) {
    const gx = Math.cos(a);
    const gz = Math.sin(a);
    const pot = new THREE.Group();
    const body = new THREE.Mesh(potGeo, copper);
    body.castShadow = true;
    pot.add(body);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 2.4, 10), copper);
    spout.position.set(0, 0.9, 1.6);
    spout.rotation.x = 1.0;
    pot.add(spout);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8, 0, TAU, 0, Math.PI / 2), copper);
    lid.position.y = 2;
    pot.add(lid);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), brass);
    knob.position.y = 2.6;
    pot.add(knob);
    pot.scale.setScalar(4);
    const r = WALL_R + 2.2; // set into the wall so the spout overhangs the moat
    pot.position.set(gx * r, 18, gz * r);
    pot.lookAt(0, 18, 0);
    pot.rotateX(0.55);
    add(pot);
    // hanging chains
    for (const s of [-1, 1]) {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 18, 4), iron);
      ch.position.set(gx * r + -gz * s * 2, 30, gz * r + gx * s * 2);
      add(ch);
    }
    // the pouring stream
    pot.updateMatrix();
    const tip = new THREE.Vector3(0, 1.5, 2.6).applyMatrix4(pot.matrix);
    const h = tip.y - TEA_Y;
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, h, 10, 1, true), streamMat);
    stream.position.set(tip.x, TEA_Y + h / 2, tip.z);
    add(stream);
    const splashAt = new THREE.Vector3(tip.x, TEA_Y + 0.2, tip.z);
    w.anim.push(() => {
      if (w.game && Math.random() < 0.25) w.game.fx.smoke(splashAt, '#5a3a30', 1, 1.4);
      if (w.game && Math.random() < 0.35) w.game.fx.spark(splashAt.x, splashAt.y, splashAt.z, '#ff9030', { speed: 5, g: 12, size: 0.22, life: 0.5, a: 0.7 });
    });
  }

  }

  // ── teacup & top-hat conveyor along the west wall ──
  {
    const a0 = Math.PI * 0.85;
    const a1 = Math.PI * 1.25;
    const r = WALK_OUT - 2;
    const belt = new THREE.Group();
    const segs = 14;
    for (let k = 0; k < segs; k++) {
      const a = a0 + ((a1 - a0) * (k + 0.5)) / segs;
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, ((a1 - a0) * r) / segs + 0.05), mat('#2a2018', { metalness: 0.6, roughness: 0.5 }));
      block.position.set(Math.cos(a) * r, 0.55, Math.sin(a) * r);
      block.rotation.y = -a;
      block.castShadow = block.receiveShadow = true;
      belt.add(block);
      w.colliders.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: 1.3, top: 1.1 });
    }
    add(belt);
    const porc = mat('#f2ece2', { roughness: 0.3 });
    const hatM = mat('#1a0e16', { roughness: 0.6 });
    const band = mat('#8a1020', { roughness: 0.5 });
    const items = [];
    for (let k = 0; k < 18; k++) {
      const g = new THREE.Group();
      if (k % 3 === 0) {
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.7, 14), hatM);
        crown.position.y = 0.45;
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 16), hatM);
        brim.position.y = 0.1;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.32, 0.12, 14), band);
        b.position.y = 0.2;
        g.add(crown, brim, b);
      } else {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.38, 14, 1, true), porc);
        cup.position.y = 0.19;
        const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.05, 16), porc);
        g.add(cup, saucer);
      }
      g.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
      add(g);
      items.push({ g, u: k / 18 });
    }
    w.anim.push((time, dt) => {
      for (const it of items) {
        it.u = (it.u + dt * 0.02) % 1;
        const a = a0 + (a1 - a0) * it.u;
        it.g.position.set(Math.cos(a) * r, 1.12, Math.sin(a) * r);
      }
    });
  }

  // ── lamp pillars and steam vents on the walkway ──
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffb257' });
  const haloMat = new THREE.SpriteMaterial({ map: w.assets.glow, color: '#ff9a40', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + SECTOR / 4;
    const r = WALK_OUT - 3.5;
    if (Math.abs(Math.sin(a)) > 0.93) continue; // keep spawn + glass approaches open
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 5, 8), iron);
    post.position.set(x, 2.5, z);
    post.castShadow = true;
    add(post);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 24), brass);
    face.position.set(x, 5.3, z);
    face.rotation.x = Math.PI / 2;
    face.lookAt(0, 5.3, 0);
    face.rotateX(Math.PI / 2);
    add(face);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), bulbMat);
    bulb.position.set(x, 6.1, z);
    add(bulb);
    const h = new THREE.Sprite(haloMat);
    h.scale.set(3.5, 3.5, 1);
    h.position.copy(bulb.position);
    add(h);
    w.colliders.push({ x, z, r: 0.6, top: 6 });
  }
  for (let i = 0; i < 18; i++) {
    const a = rng() * TAU;
    const r = rng.range(CH_OUT + 3, WALK_OUT - 5);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 16), grate);
    vent.position.set(x, 0.06, z);
    add(vent);
    const phase = rng() * 6;
    const at = new THREE.Vector3(x, 0.3, z);
    w.anim.push((time) => {
      const k = (time + phase) % 6;
      if (w.game && k < 1.2 && Math.random() < 0.6) w.game.fx.smoke(at, '#d8d0d8', 1, 1.2);
    });
  }

  if (!open) {
  // ── the Hatter, looming over the north wall ──
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.MeshBasicMaterial({ map: hatterFaceTexture(), transparent: true, fog: false, depthWrite: false, color: '#b8a8a0' }),
  );
  face.position.set(0, 78, -WALL_R - 50);
  face.renderOrder = -7;
  add(face);
  const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: w.assets.glow, color: '#ff7a10', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  eye.scale.set(36, 36, 1);
  eye.position.set(150 * 0.09, 78 + 150 * -0.02, -WALL_R - 49);
  add(eye);
  w.anim.push((time) => {
    eye.material.opacity = 0.6 + Math.sin(time * 2.3) * 0.3;
    face.position.y = 78 + Math.sin(time * 0.3) * 2;
  });
  clock.face = face;

  }

  dressClockworks(w, add, brass, iron, grate);

  // ── lights ──
  const hemi = new THREE.HemisphereLight('#ffb880', '#1a0c08', 0.55);
  add(hemi);
  add(new THREE.AmbientLight('#4a3020', 0.25));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.26;
    const l = new THREE.PointLight('#ff8a30', 110, 42, 1.7);
    l.position.set(Math.cos(a) * (CLOCK_R + CH_OUT) / 2, 1.8, Math.sin(a) * (CLOCK_R + CH_OUT) / 2);
    add(l);
    const ph = rng() * 10;
    w.anim.push((time) => {
      l.intensity = 100 + Math.sin(time * 3 + ph) * 12;
    });
  }
  const sun = new THREE.DirectionalLight('#a8b0ff', 1.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  w.scene.add(sun);
  w.scene.add(sun.target);
  w.sun = sun;
  RIM.rimColor.value.set('#ffb070');

  // ── per-frame: hands, sectors, tea ──
  w.onUpdate = (time, dt) => updateClockworks(w, time, dt);
}

// Set dressing: light shafts, balcony, machinery, floor gears, chandeliers.
function dressClockworks(w, add, brass, iron, grate) {
  const rng = w.rng;
  const open = !!w.arena;

  if (!open) {
  // ── light shafts slanting in through the windows ──
  const shaftTex = (() => {
    const c = makeCanvas(64, 256);
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,190,110,0.9)');
    g.addColorStop(0.5, 'rgba(255,150,70,0.35)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 256);
    // soften the sides
    const s2 = x.createLinearGradient(0, 0, 64, 0);
    s2.addColorStop(0, 'rgba(0,0,0,1)');
    s2.addColorStop(0.3, 'rgba(0,0,0,0)');
    s2.addColorStop(0.7, 'rgba(0,0,0,0)');
    s2.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = s2;
    x.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.22, fog: false });
  const shaftGeo = new THREE.PlaneGeometry(6, 40);
  shaftGeo.translate(0, -20, 0);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + 0.12;
    const m = new THREE.Mesh(shaftGeo, shaftMat);
    m.position.set(Math.cos(a) * (WALL_R - 1), WALL_H * 0.62, Math.sin(a) * (WALL_R - 1));
    m.lookAt(0, m.position.y, 0);
    m.rotateX(-0.75); // lean the shaft down toward the floor
    m.renderOrder = 5;
    add(m);
  }

  // ── mezzanine balcony around the hall ──
  const balY = 16;
  const deck = new THREE.Mesh(new THREE.RingGeometry(WALL_R - 6, WALL_R - 0.5, 120, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2018', metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }));
  deck.position.y = balY;
  add(deck);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(WALL_R - 6, WALL_R - 6, 0.8, 120, 1, true), brass);
  lip.position.y = balY - 0.4;
  add(lip);
  for (const y of [balY + 1.2, balY + 0.6]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(WALL_R - 6, 0.07, 4, 160), brass);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = y;
    add(rail);
  }
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5);
  const posts = new THREE.InstancedMesh(postGeo, brass, 160);
  const bracketGeo = new THREE.BoxGeometry(0.4, 4, 0.4);
  const brackets = new THREE.InstancedMesh(bracketGeo, iron, 40);
  const d = new THREE.Object3D();
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * TAU;
    d.position.set(Math.cos(a) * (WALL_R - 6), balY + 0.6, Math.sin(a) * (WALL_R - 6));
    d.rotation.set(0, 0, 0);
    d.updateMatrix();
    posts.setMatrixAt(i, d.matrix);
  }
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    d.position.set(Math.cos(a) * (WALL_R - 3), balY - 2.2, Math.sin(a) * (WALL_R - 3));
    d.lookAt(0, d.position.y, 0);
    d.rotateX(0.6);
    d.updateMatrix();
    brackets.setMatrixAt(i, d.matrix);
  }
  add(posts);
  add(brackets);

  }

  // ── flywheels with pumping pistons on the walkway ──
  const wheelGeo = new THREE.TorusGeometry(3.4, 0.45, 8, 36);
  const spokeGeo = new THREE.BoxGeometry(6.8, 0.3, 0.3);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4 + 0.35;
    const r = WALK_OUT - 9;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 2.2), iron);
    base.position.set(x, 1.1, z);
    base.castShadow = true;
    add(base);
    const wheel = new THREE.Group();
    wheel.position.set(x, 5.4, z);
    wheel.lookAt(0, 5.4, 0);
    wheel.rotateY(Math.PI / 2);
    const rim = new THREE.Mesh(wheelGeo, brass);
    rim.castShadow = true;
    wheel.add(rim);
    for (let k = 0; k < 4; k++) {
      const sp = new THREE.Mesh(spokeGeo, iron);
      sp.rotation.z = (k / 4) * Math.PI;
      wheel.add(sp);
    }
    add(wheel);
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 12), mat('#9a9aa8', { metalness: 1, roughness: 0.2 }));
    piston.position.set(x, 3, z);
    add(piston);
    const sp = rng.range(0.8, 1.4) * (i % 2 ? 1 : -1);
    w.anim.push((time) => {
      rim.parent.rotation.z = time * sp;
      piston.position.y = 3 + Math.sin(time * sp * 2) * 0.8;
      if (w.game && Math.random() < 0.04) w.game.fx.smoke(new THREE.Vector3(x, 2.4, z), '#b8b0b8', 2, 0.8);
    });
    w.colliders.push({ x, z, r: 2.4, top: 9 });
  }

  // ── brass gears inlaid in the walkway, slowly turning ──
  const inlay = new THREE.MeshStandardMaterial({ color: '#d0a050', metalness: 0.6, roughness: 0.45, emissive: '#3a2008', emissiveIntensity: 0.6 });
  for (let i = 0; i < 10; i++) {
    const a = rng() * TAU;
    const r = rng.range(CH_OUT + 5, WALK_OUT - 8);
    const R = rng.range(1.6, 3.2);
    const g = new THREE.Group();
    const ringM = new THREE.Mesh(new THREE.RingGeometry(R * 0.55, R, 32).rotateX(-Math.PI / 2), inlay);
    g.add(ringM);
    const teeth = Math.round(R * 6);
    for (let k = 0; k < teeth; k++) {
      const ta = (k / teeth) * TAU;
      const t = new THREE.Mesh(new THREE.BoxGeometry(R * 0.2, 0.05, R * 0.22), inlay);
      t.position.set(Math.cos(ta) * R * 1.05, 0, Math.sin(ta) * R * 1.05);
      t.rotation.y = -ta;
      g.add(t);
    }
    g.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r);
    add(g);
    const sp = rng.range(0.2, 0.5) * (i % 2 ? 1 : -1);
    w.anim.push((time) => {
      g.rotation.y = time * sp;
    });
  }

  if (!open) {
  // ── candle-ring chandeliers hanging from the dome ──
  const flame = new THREE.MeshBasicMaterial({ color: '#ffc070' });
  const halo = new THREE.SpriteMaterial({ map: w.assets.glow, color: '#ff9a40', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.6;
    const r = i === 0 ? 0 : CLOCK_R * 0.8;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = i === 0 ? 30 : 24;
    const ch = new THREE.Group();
    ch.position.set(x, y, z);
    const ringR = i === 0 ? 5 : 3;
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.15, 6, 32), brass);
    ringM.rotation.x = Math.PI / 2;
    ch.add(ringM);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 60, 4), iron);
    chain.position.y = 30;
    ch.add(chain);
    for (let k = 0; k < (i === 0 ? 16 : 10); k++) {
      const ca = (k / (i === 0 ? 16 : 10)) * TAU;
      const cand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), mat('#efe6d0'));
      cand.position.set(Math.cos(ca) * ringR, 0.3, Math.sin(ca) * ringR);
      ch.add(cand);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), flame);
      f.position.set(Math.cos(ca) * ringR, 0.62, Math.sin(ca) * ringR);
      ch.add(f);
      if (k % 2 === 0) {
        const h = new THREE.Sprite(halo);
        h.scale.set(1.8, 1.8, 1);
        h.position.copy(f.position);
        ch.add(h);
      }
    }
    add(ch);
    const ph = rng() * 10;
    w.anim.push((time) => {
      ch.rotation.y = Math.sin(time * 0.2 + ph) * 0.15;
    });
  }

  }

  // ── embers rising off the boiling tea ──
  w.anim.push(() => {
    const g = w.game;
    if (!g) return;
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * TAU;
      const inRing = Math.random() < 0.6;
      const r = inRing ? CLOCK_R + Math.random() * (CH_OUT - CLOCK_R) : WALK_OUT + Math.random() * (MOAT_OUT - WALK_OUT);
      g.fx.spark(Math.cos(a) * r, TEA_Y + 0.2, Math.sin(a) * r, Math.random() < 0.7 ? '#ff8a30' : '#ffd070', { speed: 0.6, g: -2.5, size: 0.18, life: 2.2, drag: 0.3 });
    }
  });
}

// The Hatter calls this: sink some hours into tea, raise others.
export function rearrange(w, sinkN, raiseN, warn = 2.6, hold = 9) {
  const clock = w.clock;
  const idx = [...Array(12).keys()].sort(() => rand() - 0.5);
  const sink = idx.slice(0, sinkN);
  const raise = idx.slice(sinkN, sinkN + raiseN);
  for (const s of clock.sectors) {
    s.warn = sink.includes(s.i) ? 'sink' : raise.includes(s.i) ? 'raise' : null;
    s.warnT = s.warn ? warn : 0;
    s.holdT = hold;
  }
  return { sink, raise };
}

function updateClockworks(w, time, dt) {
  const g = w.game;
  const clock = w.clock;
  clock.teaMat.uniforms.t.value = time;

  // sectors: telegraph, then move, then settle back
  for (const s of clock.sectors) {
    const ov = s.overlay.material;
    if (s.warnT > 0) {
      s.warnT -= dt;
      const pulse = 0.5 + 0.5 * Math.sin(time * 16);
      ov.color.set(s.warn === 'sink' ? '#ff1020' : '#ffc030');
      ov.opacity = 0.14 + pulse * 0.3;
      if (s.warnT <= 0) {
        s.target = s.warn === 'sink' ? TEA_Y - 0.2 : 1.8;
        ov.opacity = 0;
      }
    } else if (s.target !== 0) {
      s.holdT -= dt;
      if (s.holdT <= 0) {
        s.target = 0;
        s.warn = null;
      }
    }
    const dy = s.target - s.y;
    if (Math.abs(dy) > 0.001) {
      s.y += Math.sign(dy) * Math.min(Math.abs(dy), dt * 2.2);
      s.mesh.position.y = s.y;
    }
  }

  // clock hands: rotate and shove
  if (!g) return;
  const p = g.player;
  clock.hurtT -= dt;
  clock.teaT -= dt;
  const entities = [p, ...g.enemies.filter((e) => e.alive && !e.flying && !e.boss)];
  for (const h of clock.hands) {
    h.angle = (h.angle + h.speed * dt) % TAU;
    h.pivot.rotation.y = -h.angle;
    const c = Math.cos(h.angle);
    const sn = Math.sin(h.angle);
    for (const ent of entities) {
      if (ent === p && !p.alive) continue;
      const rad = ent === p ? 0.4 : ent.radius;
      const along = ent.pos.x * c + ent.pos.z * sn;
      if (along < 3.8 || along > h.L) continue;
      if (ent.pos.y > h.top) continue; // jumped over, or standing on a raised hour
      const perp = -ent.pos.x * sn + ent.pos.z * c;
      const reach = h.W + rad;
      if (Math.abs(perp) > reach) continue;
      // push to the leading side and fling outward toward the tea
      const side = perp >= -0.2 ? 1 : -1;
      const np = side * (reach + 0.05);
      ent.pos.x = along * c - np * sn;
      ent.pos.z = along * sn + np * c;
      const tang = h.speed * along;
      const vx = -sn * side * (tang + 3) + c * 4.5;
      const vz = c * side * (tang + 3) + sn * 4.5;
      if (ent === p) {
        p.vel.x = vx * 1.6;
        p.vel.z = vz * 1.6;
        if (clock.hurtT <= 0) {
          clock.hurtT = 0.6;
          p.hurt(6);
          g.camShake(0.25);
          sfx('hit');
        }
      } else {
        ent.vel.x = vx;
        ent.vel.z = vz;
      }
      g.fx.spark(ent.pos.x, ent.pos.y + 0.5, ent.pos.z, '#ffc060', { speed: 5, g: 10, size: 0.2, life: 0.3 });
    }
  }

  // boiling tea: scalds and slows
  if (p.alive && w.isTea(p.pos.x, p.pos.z, p.pos.y)) {
    p.envSlow = 0.5;
    if (clock.teaT <= 0) {
      clock.teaT = 0.45;
      p.hurt(7);
      sfx('boil');
    }
    if (Math.random() < 0.5) g.fx.smoke(p.pos.clone().setY(TEA_Y + 0.3), '#e0d0d0', 1, 0.8);
    if (Math.random() < 0.7) g.fx.spark(p.pos.x, TEA_Y + 0.2, p.pos.z, '#ffb040', { speed: 3, g: 6, size: 0.25, life: 0.4 });
  }
  clock.enemyTeaT = (clock.enemyTeaT || 0) - dt;
  if (clock.enemyTeaT <= 0) {
    clock.enemyTeaT = 0.5;
    for (const e of g.enemies) {
      if (!e.alive || e.flying || e.boss || !w.isTea(e.pos.x, e.pos.z, e.pos.y)) continue;
      e.hurt(e.maxHp * 0.12 + 4, false, null);
      if (!e.alive) g.combat.onKill(e);
    }
  }
}
