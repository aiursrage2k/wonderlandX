// The White Rabbit, rebuilt: a gaunt, hunched herald in a tattered tailcoat,
// with a clock grafted into his ribcage. Faces +Z, feet at y=0, ~6.3 tall.
// Exposes: body, legs, torso, head, ears, arms[{sh, el, hand}], watch,
// clockHands, eyeMat.

import * as THREE from 'three';
import { makeCanvas, makeRng, TAU } from '../engine/util.js';
import { clockFaceTexture } from './textures.js';

let M = null;

function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Dirty white fur: thousands of short directional strokes, blood at the hem.
function furTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const rng = makeRng(23);
  x.fillStyle = '#d9d2cb';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 16000; i++) {
    const px = rng() * S;
    const py = rng() * S;
    const len = 4 + rng() * 9;
    const a = Math.PI / 2 + (rng() - 0.5) * 0.7;
    const t = rng();
    x.strokeStyle = t < 0.45 ? `rgba(255,252,246,${0.25 + rng() * 0.4})` : t < 0.85 ? `rgba(150,138,130,${0.2 + rng() * 0.35})` : `rgba(90,78,74,${0.2 + rng() * 0.3})`;
    x.lineWidth = 0.6 + rng() * 1.1;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    x.stroke();
  }
  // matted grime + dried blood toward the bottom of the texture
  for (let i = 0; i < 70; i++) {
    const py = S * (0.55 + rng() * 0.45);
    x.fillStyle = rng() < 0.6 ? `rgba(110,15,20,${0.15 + rng() * 0.3})` : `rgba(60,45,40,${0.15 + rng() * 0.2})`;
    x.beginPath();
    x.ellipse(rng() * S, py, 6 + rng() * 22, 4 + rng() * 14, 0, 0, TAU);
    x.fill();
  }
  return tex(c, true);
}

// Alpha speckle for the fuzzy shell layer.
function furShellAlpha() {
  const S = 256;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const rng = makeRng(71);
  x.fillStyle = '#000';
  x.fillRect(0, 0, S, S);
  x.fillStyle = '#fff';
  for (let i = 0; i < 5000; i++) {
    x.fillRect(rng() * S, rng() * S, 1 + rng() * 1.5, 2 + rng() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function coatTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const rng = makeRng(88);
  x.fillStyle = '#5c0a14';
  x.fillRect(0, 0, S, S);
  // velvet nap
  for (let i = 0; i < 6000; i++) {
    x.fillStyle = rng() < 0.5 ? `rgba(20,0,4,${rng() * 0.2})` : `rgba(170,40,50,${rng() * 0.12})`;
    x.fillRect(rng() * S, rng() * S, 2, 2 + rng() * 5);
  }
  // gold piping stripes
  x.fillStyle = 'rgba(200,160,80,0.5)';
  x.fillRect(0, 12, S, 5);
  // wear, tears, stains
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(15,0,3,${0.2 + rng() * 0.4})`;
    x.beginPath();
    x.ellipse(rng() * S, rng() * S, 4 + rng() * 20, 3 + rng() * 10, rng() * 3, 0, TAU);
    x.fill();
  }
  return tex(c, true);
}

function assets() {
  if (M) return M;
  const fur = furTexture();
  const clock = clockFaceTexture();
  M = {
    fur: new THREE.MeshStandardMaterial({ map: fur, roughness: 0.95, color: '#f0ebe6' }),
    furShell: new THREE.MeshStandardMaterial({ map: fur, alphaMap: furShellAlpha(), alphaTest: 0.5, roughness: 1, color: '#ffffff', side: THREE.DoubleSide }),
    furDark: new THREE.MeshStandardMaterial({ map: fur, roughness: 0.95, color: '#9b918a' }),
    skinPink: new THREE.MeshStandardMaterial({ color: '#c98e98', roughness: 0.6 }),
    coat: new THREE.MeshStandardMaterial({ map: coatTexture(), roughness: 0.75, side: THREE.DoubleSide }),
    vest: new THREE.MeshStandardMaterial({ color: '#2a1216', roughness: 0.55, side: THREE.DoubleSide }),
    gold: new THREE.MeshStandardMaterial({ color: '#d0a852', metalness: 0.9, roughness: 0.28 }),
    bone: new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.45 }),
    claw: new THREE.MeshStandardMaterial({ color: '#1a1212', roughness: 0.3, metalness: 0.2 }),
    socket: new THREE.MeshStandardMaterial({ color: '#180a0e', roughness: 0.9 }),
    nose: new THREE.MeshPhysicalMaterial({ color: '#7a2a3a', roughness: 0.3, clearcoat: 1 }),
    gums: new THREE.MeshStandardMaterial({ color: '#4a0e18', roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.25 }),
    face: new THREE.MeshStandardMaterial({ map: clock, emissive: '#ffcf8a', emissiveMap: clock, emissiveIntensity: 0.45, roughness: 0.4 }),
    whisker: new THREE.MeshBasicMaterial({ color: '#e8e0d8' }),
    dark: new THREE.MeshStandardMaterial({ color: '#120808' }),
  };
  return M;
}

function add(parent, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
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

const V2 = (r, y) => new THREE.Vector2(r, y);

// Furry part = base mesh + a slightly inflated alpha-tested shell.
function furry(parent, geometry, x = 0, y = 0, z = 0, dark = false) {
  const m = add(parent, geometry, dark ? M.furDark : M.fur, x, y, z);
  const sh = new THREE.Mesh(geometry, M.furShell);
  sh.scale.setScalar(1.022);
  sh.castShadow = false;
  m.add(sh);
  return m;
}

let G = null;
function geometry() {
  if (G) return G;
  G = {};
  // pear-shaped torso, hunched and narrow at the shoulders
  const t = new THREE.LatheGeometry([V2(0.01, 0), V2(0.3, 0.05), V2(0.42, 0.25), V2(0.46, 0.46), V2(0.43, 0.68), V2(0.36, 0.86), V2(0.26, 0.98), V2(0.14, 1.06), V2(0.01, 1.08)], 40);
  t.scale(1, 1, 0.82);
  G.torso = t;
  // tailcoat: open front, flared hem
  G.coat = new THREE.LatheGeometry([V2(0.5, 0.12), V2(0.48, 0.3), V2(0.485, 0.5), V2(0.45, 0.7), V2(0.38, 0.88), V2(0.28, 1.0), V2(0.17, 1.08)], 40, 0.62, TAU - 1.24);
  G.coat.scale(1, 1, 0.86);
  G.vest = new THREE.LatheGeometry([V2(0.475, 0.2), V2(0.49, 0.45), V2(0.455, 0.68), V2(0.4, 0.84)], 24, -0.95, 0.62);
  G.vest.scale(1, 1, 0.86);
  G.vest2 = new THREE.LatheGeometry([V2(0.475, 0.2), V2(0.49, 0.45), V2(0.455, 0.68), V2(0.4, 0.84)], 24, 0.33, 0.62);
  G.vest2.scale(1, 1, 0.86);
  // long skull, sloping into a snout
  const sk = new THREE.SphereGeometry(0.3, 40, 30);
  const p = sk.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const f = Math.max(0, z / 0.3);
    y -= f * f * 0.06; // snout droops
    z *= 1.25 + f * 0.25;
    x *= 0.88 - f * 0.22;
    if (y < 0) x *= 1 + (-y / 0.3) * 0.15; // cheeks
    p.setXYZ(i, x, y, z);
  }
  sk.computeVertexNormals();
  G.skull = sk;
  // ear: a flattened, tapered leaf; two halves so one can bend
  const ear = new THREE.LatheGeometry([V2(0.01, 0), V2(0.1, 0.06), V2(0.13, 0.25), V2(0.125, 0.45), V2(0.118, 0.62)], 18);
  ear.scale(1, 1, 0.32);
  G.ear = ear;
  const tip = new THREE.LatheGeometry([V2(0.118, -0.04), V2(0.122, 0.1), V2(0.1, 0.3), V2(0.06, 0.45), V2(0.01, 0.5)], 18);
  tip.scale(1, 1, 0.32);
  G.earTip = tip;
  const inner = new THREE.LatheGeometry([V2(0.01, 0.03), V2(0.07, 0.08), V2(0.09, 0.25), V2(0.08, 0.45), V2(0.04, 0.56), V2(0.01, 0.59)], 14, -0.9, 1.8);
  inner.scale(1, 1, 0.3);
  G.earInner = inner;
  G.thigh = new THREE.SphereGeometry(0.25, 24, 18);
  G.limb = (r0, r1, h) => new THREE.CylinderGeometry(r0, r1, h, 14);
  return G;
}

export function buildWhiteRabbit() {
  assets();
  const Gm = geometry();
  const S = 2.6;
  const root = new THREE.Group();
  const body = pivot(root);

  // ── digitigrade legs ──
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(body, s * 0.26 * S, 0.66 * S, -0.04 * S);
    const th = furry(hip, Gm.thigh, 0, -0.08 * S, 0.06 * S);
    th.scale.set(0.85 * S, 1.15 * S, 1.2 * S);
    const shin = pivot(hip, 0, -0.3 * S, 0.12 * S);
    const sh = furry(shin, Gm.limb(0.08 * S, 0.055 * S, 0.34 * S), 0, -0.13 * S, -0.08 * S);
    sh.rotation.x = -0.55;
    const foot = pivot(shin, 0, -0.3 * S, -0.16 * S);
    const f = furry(foot, new THREE.CapsuleGeometry(0.075 * S, 0.34 * S, 6, 12), 0, 0.04 * S, 0.14 * S, true);
    f.rotation.x = Math.PI / 2;
    for (let c = 0; c < 3; c++) {
      const cl = add(foot, new THREE.ConeGeometry(0.018 * S, 0.1 * S, 6), M.claw, (c - 1) * 0.045 * S, 0.02 * S, 0.37 * S);
      cl.rotation.x = Math.PI / 2 + 0.3;
    }
    legs.push(hip);
  }

  // ── torso, hunched forward ──
  const torso = pivot(body, 0, 0.58 * S, 0);
  torso.rotation.x = 0.22;
  furry(torso, Gm.torso).scale.setScalar(S);
  add(torso, Gm.coat, M.coat).scale.setScalar(S);
  add(torso, Gm.vest, M.vest).scale.setScalar(S);
  add(torso, Gm.vest2, M.vest).scale.setScalar(S);
  // coat tails, split and tattered
  for (const s of [-1, 1]) {
    const tail = new THREE.Shape();
    tail.moveTo(0, 0);
    tail.lineTo(0.24, 0);
    tail.lineTo(0.2, -0.55);
    tail.lineTo(0.14, -0.48);
    tail.lineTo(0.1, -0.62);
    tail.lineTo(0.04, -0.5);
    tail.lineTo(0, -0.58);
    const tm = add(torso, new THREE.ShapeGeometry(tail), M.coat, s * (s > 0 ? 0.02 : 0.26) * S, 0.2 * S, -0.4 * S);
    tm.scale.setScalar(S);
    tm.rotation.x = 0.25;
  }
  // gold buttons down the waistcoat
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) add(torso, new THREE.SphereGeometry(0.022 * S, 10, 8), M.gold, s * 0.2 * S, (0.3 + i * 0.12) * S, 0.37 * S);
  }
  // the clock, set into bone ribs
  const clock = pivot(torso, 0, 0.55 * S, 0.33 * S);
  const rim = add(clock, new THREE.CylinderGeometry(0.2 * S, 0.2 * S, 0.07 * S, 40), M.gold);
  rim.rotation.x = Math.PI / 2;
  add(clock, new THREE.CircleGeometry(0.18 * S, 40), M.face, 0, 0, 0.036 * S);
  const bezel = add(clock, new THREE.TorusGeometry(0.2 * S, 0.018 * S, 8, 40), M.gold, 0, 0, 0.035 * S);
  bezel.castShadow = false;
  add(clock, new THREE.CircleGeometry(0.18 * S, 40), M.glass, 0, 0, 0.045 * S);
  const clockHands = [];
  for (const [len, w] of [[0.1, 0.016], [0.15, 0.009]]) {
    const h = pivot(clock, 0, 0, 0.04 * S);
    add(h, new THREE.BoxGeometry(w * S, len * S, 0.006 * S), M.dark, 0, (len * S) / 2, 0);
    clockHands.push(h);
  }
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const rib = add(torso, new THREE.TorusGeometry(0.1 * S, 0.012 * S, 6, 12, Math.PI * 0.6), M.bone, s * 0.14 * S, (0.4 + i * 0.09) * S, 0.34 * S);
      rib.rotation.set(0, s > 0 ? 0 : Math.PI, 0.2);
    }
  }
  // cravat
  const crav = add(torso, new THREE.ConeGeometry(0.1 * S, 0.22 * S, 12), M.coat, 0, 0.9 * S, 0.24 * S);
  crav.rotation.x = Math.PI + 0.3;

  // ── head ──
  const head = pivot(torso, 0, 1.08 * S, 0.12 * S);
  furry(head, Gm.skull, 0, 0.12 * S, 0).scale.setScalar(S);
  const cheek = furry(head, new THREE.SphereGeometry(0.16, 24, 16), 0, 0.03 * S, 0.27 * S);
  cheek.scale.set(1.2 * S, 0.8 * S, 1.0 * S);
  add(head, new THREE.SphereGeometry(0.038 * S, 12, 10), M.nose, 0, 0.1 * S, 0.43 * S).scale.set(1.3, 0.8, 1);
  // snarl: gums, buck teeth, fangs
  add(head, new THREE.BoxGeometry(0.16 * S, 0.035 * S, 0.06 * S), M.gums, 0, -0.035 * S, 0.37 * S);
  for (const s of [-1, 1]) {
    add(head, new THREE.BoxGeometry(0.045 * S, 0.09 * S, 0.02 * S), M.bone, s * 0.024 * S, -0.08 * S, 0.395 * S);
    const fang = add(head, new THREE.ConeGeometry(0.018 * S, 0.1 * S, 6), M.bone, s * 0.075 * S, -0.08 * S, 0.35 * S);
    fang.rotation.x = Math.PI;
  }
  // whiskers
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = add(head, new THREE.CylinderGeometry(0.003 * S, 0.001 * S, 0.45 * S, 3), M.whisker, s * 0.24 * S, (0.05 - i * 0.03) * S, 0.33 * S);
      w.rotation.set(0, 0, s * (Math.PI / 2 + 0.15 - i * 0.15));
      w.castShadow = false;
    }
  }
  // sunken sockets + burning eyes + a heavy brow
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff1a1a' });
  for (const s of [-1, 1]) {
    const sock = add(head, new THREE.SphereGeometry(0.07 * S, 16, 12), M.socket, s * 0.13 * S, 0.2 * S, 0.24 * S);
    sock.scale.set(1, 0.75, 0.6);
    const e = add(head, new THREE.SphereGeometry(0.036 * S, 14, 10), eyeMat, s * 0.13 * S, 0.2 * S, 0.27 * S);
    e.castShadow = false;
    const brow = furry(head, new THREE.CapsuleGeometry(0.03 * S, 0.12 * S, 4, 8), s * 0.12 * S, 0.27 * S, 0.26 * S);
    brow.rotation.z = Math.PI / 2 + s * 0.35;
    // round spectacles
    const lens = add(head, new THREE.TorusGeometry(0.07 * S, 0.008 * S, 6, 24), M.gold, s * 0.13 * S, 0.19 * S, 0.33 * S);
    lens.rotation.y = s * 0.3;
  }
  add(head, new THREE.CylinderGeometry(0.005 * S, 0.005 * S, 0.07 * S, 4), M.gold, 0, 0.19 * S, 0.37 * S).rotation.z = Math.PI / 2;

  // ears: long, the left one torn and bent
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = pivot(head, s * 0.14 * S, 0.36 * S, -0.02 * S);
    ear.rotation.z = s * -0.18;
    const lower = furry(ear, Gm.ear, 0, 0, 0);
    lower.scale.set(S, S * 0.62, S);
    add(ear, Gm.earInner, M.skinPink, 0, 0, 0.012 * S).scale.set(S, S * 0.62, S);
    const tip = pivot(ear, 0, 0.385 * S, 0);
    tip.rotation.x = s < 0 ? 1.0 : 0.12; // the droop
    furry(tip, Gm.earTip, 0, 0, 0).scale.set(S, S * 0.75, S);
    add(tip, Gm.earInner, M.skinPink, 0, -0.03 * S, 0.012 * S).scale.set(S * 0.85, S * 0.45, S);
    ears.push(ear);
  }

  // ── arms: long, thin, clawed ──
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.47 * S, 0.9 * S, 0.02 * S);
    add(sh, new THREE.SphereGeometry(0.13 * S, 16, 12), M.coat).scale.set(1.1, 1, 1);
    add(sh, Gm.limb(0.1 * S, 0.075 * S, 0.5 * S), M.coat, 0, -0.26 * S, 0);
    const el = pivot(sh, 0, -0.52 * S, 0);
    const cuff = add(el, new THREE.CylinderGeometry(0.09 * S, 0.1 * S, 0.1 * S, 14), M.bone, 0, -0.02 * S, 0);
    cuff.castShadow = false;
    furry(el, Gm.limb(0.065 * S, 0.05 * S, 0.46 * S), 0, -0.25 * S, 0);
    const hand = pivot(el, 0, -0.5 * S, 0);
    furry(hand, new THREE.SphereGeometry(0.08 * S, 14, 10), 0, 0, 0).scale.set(1, 0.8, 1.1);
    for (let f = 0; f < 4; f++) {
      const fin = pivot(hand, (f - 1.5) * 0.04 * S, -0.04 * S, 0.04 * S);
      fin.rotation.x = 0.4;
      add(fin, Gm.limb(0.016 * S, 0.012 * S, 0.14 * S), M.furDark, 0, -0.07 * S, 0);
      const c = add(fin, new THREE.ConeGeometry(0.014 * S, 0.1 * S, 6), M.claw, 0, -0.18 * S, 0.01 * S);
      c.rotation.x = Math.PI - 0.3;
    }
    arms.push({ sh, el, hand });
  }
  // pocket watch dangling from the left hand
  const watch = pivot(arms[0].hand, 0, -0.1 * S, 0.05 * S);
  for (let i = 0; i < 8; i++) add(watch, new THREE.TorusGeometry(0.012 * S, 0.004 * S, 4, 8), M.gold, 0, -i * 0.035 * S, 0).rotation.y = (i % 2) * (Math.PI / 2);
  const w = add(watch, new THREE.CylinderGeometry(0.11 * S, 0.11 * S, 0.035 * S, 28), M.gold, 0, -0.38 * S, 0);
  w.rotation.x = Math.PI / 2;
  add(watch, new THREE.CircleGeometry(0.095 * S, 28), M.face, 0, -0.38 * S, 0.019 * S);

  return { root, parts: { body, legs, torso, head, ears, arms, watch, clockHands, eyeMat } };
}
