// Models for the Clockworks cast. Faces +Z, feet at y=0.

import * as THREE from 'three';
import { makeCanvas, TAU } from '../engine/util.js';
import { clockFaceTexture } from './textures.js';

// Geometry cache so every spawn shares buffers.
const geoCache = new Map();
function geo(Ctor, ...args) {
  const key = Ctor.name + JSON.stringify(args);
  let g = geoCache.get(key);
  if (!g) {
    g = new Ctor(...args);
    geoCache.set(key, g);
  }
  return g;
}

let M = null;
function mats() {
  if (M) return M;
  const clock = clockFaceTexture();
  const stripe = (() => {
    const c = makeCanvas(64, 64);
    const x = c.getContext('2d');
    x.fillStyle = '#2a1620';
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#6a1a2a';
    for (let i = 0; i < 64; i += 16) x.fillRect(i, 0, 8, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
    return t;
  })();
  M = {
    coat: new THREE.MeshStandardMaterial({ color: '#6a1020', roughness: 0.65 }),
    coatDark: new THREE.MeshStandardMaterial({ color: '#2a0a12', roughness: 0.7 }),
    stripes: new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.7 }),
    skin: new THREE.MeshStandardMaterial({ color: '#d8ccc0', roughness: 0.55 }),
    hat: new THREE.MeshStandardMaterial({ color: '#1a1016', roughness: 0.45 }),
    band: new THREE.MeshStandardMaterial({ color: '#8a1020', roughness: 0.5 }),
    card: new THREE.MeshStandardMaterial({ color: '#efe4cf', roughness: 0.8, side: THREE.DoubleSide }),
    blade: new THREE.MeshStandardMaterial({ color: '#d8dce4', metalness: 1, roughness: 0.15 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c9a04a', metalness: 0.9, roughness: 0.28 }),
    copper: new THREE.MeshStandardMaterial({ color: '#b8683a', metalness: 0.85, roughness: 0.32 }),
    iron: new THREE.MeshStandardMaterial({ color: '#241c18', metalness: 0.8, roughness: 0.4 }),
    face: new THREE.MeshStandardMaterial({ map: clock, emissive: '#ffcf8a', emissiveMap: clock, emissiveIntensity: 0.35, roughness: 0.4 }),
    eye: new THREE.MeshBasicMaterial({ color: '#ff2a1a' }),
    glow: new THREE.MeshBasicMaterial({ color: '#ff7a10' }),
    teeth: new THREE.MeshStandardMaterial({ color: '#f0e8d0', roughness: 0.4 }),
    mouth: new THREE.MeshStandardMaterial({ color: '#2a0808' }),
    hair: new THREE.MeshStandardMaterial({ color: '#c0501a', roughness: 0.7 }),
    glove: new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.6 }),
    porc: new THREE.MeshPhysicalMaterial({ color: '#f2ece2', roughness: 0.25, clearcoat: 1 }),
  };
  return M;
}

function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function pivot(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function topHat(parent, s, withCard = true) {
  const m = mats();
  const hat = pivot(parent);
  add(hat, geo(THREE.CylinderGeometry, 0.42 * s, 0.42 * s, 0.04 * s, 24), m.hat);
  const crown = add(hat, geo(THREE.CylinderGeometry, 0.3 * s, 0.26 * s, 0.62 * s, 20), m.hat, 0, 0.32 * s, 0);
  crown.rotation.z = 0.08;
  add(hat, geo(THREE.CylinderGeometry, 0.268 * s, 0.265 * s, 0.1 * s, 20), m.band, 0, 0.1 * s, 0);
  if (withCard) {
    const c = add(hat, geo(THREE.PlaneGeometry, 0.16 * s, 0.22 * s), m.card, 0.16 * s, 0.26 * s, 0.22 * s);
    c.rotation.set(0, 0.5, 0.25);
  }
  return hat;
}

// Grinning pale face on a head sphere.
function hatterHead(parent, s, monocle) {
  const m = mats();
  const head = pivot(parent);
  const skull = add(head, geo(THREE.SphereGeometry, 0.2 * s, 20, 16), m.skin);
  skull.scale.set(0.9, 1.1, 0.95);
  for (const side of [-1, 1]) {
    add(head, geo(THREE.SphereGeometry, 0.045 * s, 10, 8), new THREE.MeshStandardMaterial({ color: '#140808' }), side * 0.075 * s, 0.04 * s, 0.16 * s).scale.z = 0.5;
    add(head, geo(THREE.SphereGeometry, 0.022 * s, 8, 6), side > 0 && monocle ? m.glow : m.eye, side * 0.075 * s, 0.04 * s, 0.18 * s);
  }
  if (monocle) {
    add(head, geo(THREE.TorusGeometry, 0.05 * s, 0.008 * s, 6, 18), m.brass, 0.075 * s, 0.04 * s, 0.185 * s);
  }
  // wide grin: dark mouth + rows of teeth
  const mouth = add(head, geo(THREE.BoxGeometry, 0.2 * s, 0.05 * s, 0.03 * s), m.mouth, 0, -0.08 * s, 0.17 * s);
  mouth.rotation.x = -0.2;
  for (let i = 0; i < 7; i++) add(head, geo(THREE.BoxGeometry, 0.022 * s, 0.03 * s, 0.02 * s), m.teeth, (i - 3) * 0.027 * s, -0.07 * s, 0.185 * s);
  // hair tufts
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const tuft = add(head, geo(THREE.ConeGeometry, 0.05 * s, 0.22 * s, 5), m.hair, side * (0.16 + Math.random() * 0.04) * s, (-0.02 + Math.random() * 0.1) * s, (-0.06 + Math.random() * 0.1) * s);
    tuft.rotation.z = side * (1.8 + Math.random() * 0.4);
  }
  return head;
}

// ───────────────────────── Scissor-Handed Hatter ─────────────────────────
export function buildScissorHatter() {
  const m = mats();
  const root = new THREE.Group();
  const body = pivot(root);
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = pivot(body, side * 0.12, 1.0, 0);
    add(hip, geo(THREE.CylinderGeometry, 0.06, 0.045, 0.95, 8), m.stripes, 0, -0.48, 0);
    add(hip, geo(THREE.BoxGeometry, 0.1, 0.07, 0.26), m.hat, 0, -0.97, 0.06);
    legs.push(hip);
  }
  const torso = pivot(body, 0, 1.0, 0);
  add(torso, geo(THREE.CylinderGeometry, 0.2, 0.16, 0.7, 12), m.coat, 0, 0.35, 0);
  // coat tails
  for (const side of [-1, 1]) {
    const tail = add(torso, geo(THREE.BoxGeometry, 0.14, 0.6, 0.03), m.coatDark, side * 0.08, -0.15, -0.16);
    tail.rotation.x = 0.2;
  }
  add(torso, geo(THREE.ConeGeometry, 0.1, 0.12, 4), m.band, 0, 0.66, 0.16).rotation.x = Math.PI / 2; // bow tie
  const head = hatterHead(torso, 1, false);
  head.position.y = 0.95;
  const hat = topHat(head, 1);
  hat.position.y = 0.2;
  hat.rotation.z = -0.15;
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = pivot(torso, side * 0.26, 0.62, 0);
    add(sh, geo(THREE.CylinderGeometry, 0.05, 0.04, 0.5, 8), m.coat, 0, -0.25, 0);
    const hand = pivot(sh, 0, -0.52, 0);
    // scissors: two blades on a pivot that open and close
    const blades = [];
    for (const k of [-1, 1]) {
      const bl = pivot(hand);
      const b = add(bl, geo(THREE.BoxGeometry, 0.05, 0.9, 0.012), m.blade, 0, -0.45, 0);
      const tip = add(bl, geo(THREE.ConeGeometry, 0.035, 0.18, 4), m.blade, 0, -0.97, 0);
      tip.rotation.x = Math.PI;
      add(bl, geo(THREE.TorusGeometry, 0.06, 0.015, 6, 12), m.brass, 0, 0.02, 0);
      bl.rotation.z = k * 0.12;
      blades.push(bl);
    }
    arms.push({ sh, hand, blades });
  }
  return { root, parts: { body, legs, torso, head, arms } };
}

// ───────────────────────── Pocket-Watch Spider ─────────────────────────
export function buildWatchSpider() {
  const m = mats();
  const root = new THREE.Group();
  const body = pivot(root, 0, 0.5, 0);
  const shell = add(body, geo(THREE.CylinderGeometry, 0.42, 0.42, 0.16, 24), m.brass);
  shell.rotation.x = -0.35;
  const face = add(body, geo(THREE.CircleGeometry, 0.37, 24), m.face, 0, 0.083 * Math.cos(0.35), 0.083 * Math.sin(-0.35) + 0.0);
  face.rotation.x = -Math.PI / 2 - 0.35;
  const crown = add(body, geo(THREE.CylinderGeometry, 0.05, 0.05, 0.14, 8), m.brass, 0, 0.02, 0.46);
  crown.rotation.x = Math.PI / 2;
  add(body, geo(THREE.SphereGeometry, 0.07, 10, 8), m.eye, 0, 0.12, 0.34);
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const a = (k - 1.5) * 0.45;
    const hip = pivot(body, side * 0.33, 0, Math.sin(a) * 0.32);
    hip.rotation.y = side * (Math.PI / 2) - side * a;
    const up = add(hip, geo(THREE.CylinderGeometry, 0.025, 0.02, 0.5, 5), m.brass, 0, 0.12, 0.2);
    up.rotation.x = 1.0;
    const knee = pivot(hip, 0, 0.26, 0.38);
    const low = add(knee, geo(THREE.CylinderGeometry, 0.02, 0.008, 0.62, 5), m.iron, 0, -0.3, 0.1);
    low.rotation.x = -0.3;
    legs.push({ hip, knee, side, phase: (k % 2) * Math.PI + (side > 0 ? Math.PI / 2 : 0) });
  }
  return { root, parts: { body, legs } };
}

// ───────────────────────── Walking Teapot Cannon ─────────────────────────
export function buildTeapotCannon() {
  const m = mats();
  const root = new THREE.Group();
  const body = pivot(root, 0, 1.3, 0);
  const prof = [];
  for (let k = 0; k <= 14; k++) {
    const u = k / 14;
    prof.push(new THREE.Vector2(Math.sin(u * Math.PI) * 0.75 + 0.12, u * 1.3 - 0.6));
  }
  add(body, geo(THREE.LatheGeometry, prof, 28), m.copper);
  // riveted band + clock on the flank
  const band = add(body, geo(THREE.TorusGeometry, 0.86, 0.05, 6, 32), m.brass, 0, 0.05, 0);
  band.rotation.x = Math.PI / 2;
  const clk = add(body, geo(THREE.CircleGeometry, 0.3, 24), m.face, 0.62, 0.1, 0.5);
  clk.rotation.y = 0.9;
  add(body, geo(THREE.TorusGeometry, 0.3, 0.035, 6, 20), m.brass, 0.62, 0.1, 0.5).rotation.y = 0.9;
  // cannon spout
  const spout = pivot(body, 0, 0.1, 0.7);
  const barrel = add(spout, geo(THREE.CylinderGeometry, 0.12, 0.26, 1.1, 14), m.copper, 0, 0, 0.45);
  barrel.rotation.x = Math.PI / 2 - 0.25;
  add(spout, geo(THREE.TorusGeometry, 0.13, 0.04, 6, 14), m.brass, 0, 0.13, 1.0);
  const muzzle = add(spout, geo(THREE.SphereGeometry, 0.1, 8, 6), m.glow, 0, 0.14, 1.02);
  muzzle.castShadow = false;
  // lid + steam chimney
  add(body, geo(THREE.SphereGeometry, 0.42, 16, 8, 0, TAU, 0, Math.PI / 2), m.copper, 0, 0.66, 0);
  add(body, geo(THREE.CylinderGeometry, 0.08, 0.1, 0.5, 8), m.iron, 0, 1.1, -0.15);
  // handle
  const h = add(body, geo(THREE.TorusGeometry, 0.35, 0.07, 8, 16, Math.PI * 1.2), m.copper, 0, 0.1, -0.8);
  h.rotation.y = Math.PI / 2;
  h.rotation.x = Math.PI * 0.4;
  // four piston legs
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const hip = pivot(body, Math.sin(a) * 0.6, -0.4, Math.cos(a) * 0.6);
    hip.rotation.y = a;
    const up = add(hip, geo(THREE.CylinderGeometry, 0.07, 0.07, 0.7, 8), m.iron, 0, -0.1, 0.3);
    up.rotation.x = 0.9;
    const knee = pivot(hip, 0, -0.3, 0.58);
    add(knee, geo(THREE.CylinderGeometry, 0.05, 0.05, 0.75, 8), m.brass, 0, -0.35, 0);
    add(knee, geo(THREE.SphereGeometry, 0.1, 8, 6), m.iron, 0, -0.72, 0);
    legs.push({ hip, knee });
  }
  return { root, parts: { body, spout, legs, muzzle } };
}

// ───────────────────────── The Mad Hatter ─────────────────────────
export function buildMadHatter() {
  const m = mats();
  const S = 2.8;
  const root = new THREE.Group();
  const body = pivot(root);
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = pivot(body, side * 0.13 * S, 0.95 * S, 0);
    add(hip, geo(THREE.CylinderGeometry, 0.07 * S, 0.05 * S, 0.9 * S, 10), m.stripes, 0, -0.45 * S, 0);
    add(hip, geo(THREE.BoxGeometry, 0.12 * S, 0.08 * S, 0.32 * S), m.hat, 0, -0.92 * S, 0.08 * S);
    legs.push(hip);
  }
  const torso = pivot(body, 0, 0.95 * S, 0);
  // green-black tailcoat over a mustard waistcoat
  add(torso, geo(THREE.CylinderGeometry, 0.24 * S, 0.2 * S, 0.75 * S, 16), new THREE.MeshStandardMaterial({ color: '#1e2a1c', roughness: 0.6 }), 0, 0.38 * S, 0);
  add(torso, geo(THREE.BoxGeometry, 0.22 * S, 0.5 * S, 0.05 * S), new THREE.MeshStandardMaterial({ color: '#a07820', roughness: 0.5 }), 0, 0.42 * S, 0.2 * S);
  for (const side of [-1, 1]) {
    const tail = add(torso, geo(THREE.BoxGeometry, 0.16 * S, 0.8 * S, 0.03 * S), new THREE.MeshStandardMaterial({ color: '#1e2a1c', roughness: 0.6 }), side * 0.1 * S, -0.2 * S, -0.2 * S);
    tail.rotation.x = 0.18;
  }
  // big polka bow tie
  for (const side of [-1, 1]) {
    const lobe = add(torso, geo(THREE.ConeGeometry, 0.09 * S, 0.16 * S, 4), m.band, side * 0.08 * S, 0.74 * S, 0.2 * S);
    lobe.rotation.z = side * (Math.PI / 2);
  }
  const head = hatterHead(torso, S, true);
  head.position.y = 1.02 * S;
  const hat = topHat(head, S * 1.25);
  hat.position.y = 0.2 * S;
  hat.rotation.z = -0.12;
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = pivot(torso, side * 0.3 * S, 0.66 * S, 0);
    add(sh, geo(THREE.CylinderGeometry, 0.06 * S, 0.05 * S, 0.55 * S, 10), new THREE.MeshStandardMaterial({ color: '#1e2a1c', roughness: 0.6 }), 0, -0.27 * S, 0);
    const el = pivot(sh, 0, -0.55 * S, 0);
    add(el, geo(THREE.CylinderGeometry, 0.05 * S, 0.045 * S, 0.5 * S, 10), new THREE.MeshStandardMaterial({ color: '#1e2a1c', roughness: 0.6 }), 0, -0.25 * S, 0);
    const hand = pivot(el, 0, -0.52 * S, 0);
    add(hand, geo(THREE.SphereGeometry, 0.07 * S, 10, 8), m.glove);
    arms.push({ sh, el, hand });
  }
  // a teapot in the right hand, and a pocket watch swinging from the left
  const pot = pivot(arms[1].hand, 0, -0.12 * S, 0.06 * S);
  add(pot, geo(THREE.SphereGeometry, 0.14 * S, 14, 10), m.porc).scale.y = 0.8;
  add(pot, geo(THREE.CylinderGeometry, 0.02 * S, 0.04 * S, 0.18 * S, 8), m.porc, 0.14 * S, 0.02 * S, 0).rotation.z = -1.1;
  const watch = pivot(arms[0].hand, 0, -0.05 * S, 0);
  add(watch, geo(THREE.CylinderGeometry, 0.004 * S, 0.004 * S, 0.4 * S, 4), m.brass, 0, -0.2 * S, 0);
  const w = add(watch, geo(THREE.CylinderGeometry, 0.16 * S, 0.16 * S, 0.04 * S, 28), m.brass, 0, -0.5 * S, 0);
  w.rotation.x = Math.PI / 2;
  add(watch, geo(THREE.CircleGeometry, 0.14 * S, 28), m.face, 0, -0.5 * S, 0.022 * S);
  const watchGlow = new THREE.MeshBasicMaterial({ color: '#ffcc60', transparent: true, opacity: 0 });
  const wg = add(watch, geo(THREE.CircleGeometry, 0.2 * S, 28), watchGlow, 0, -0.5 * S, 0.03 * S);
  wg.castShadow = false;
  return { root, parts: { body, legs, torso, head, hat, arms, pot, watch, watchGlow } };
}
