// Primitive-built models. Each builder returns { root, parts } where parts are
// the pivot groups the animation code drives. Models face +Z; feet at y=0.

import * as THREE from 'three';
import { cardTexture, cardBackTexture, porcelainTexture, clockFaceTexture } from './textures.js';

const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
    matCache.set(key, m);
  }
  return m;
}

// Geometry cache: every spawn of a model shares its geometry buffers.
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

function mesh(g, material, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const SKIN = () => mat('#f2d3c2', { roughness: 0.6 });
const GOLD = () => mat('#c9a04a', { metalness: 0.85, roughness: 0.3 });

// ───────────────────────────────── Alice ─────────────────────────────────
export function buildAlice() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const blue = mat('#2e4fa8', { roughness: 0.55 });
  const white = mat('#eeeae4', { roughness: 0.8 });
  const black = mat('#141018', { roughness: 0.4 });
  const hair = mat('#e8c46a', { roughness: 0.45, metalness: 0.1 });

  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(body, s * 0.09, 0.86, 0);
    mesh(geo(THREE.CylinderGeometry, 0.05, 0.042, 0.62, 8), white, hip, 0, -0.31, 0);
    const boot = mesh(geo(THREE.CapsuleGeometry, 0.058, 0.14, 4, 8), black, hip, 0, -0.74, 0.04);
    boot.rotation.x = Math.PI / 2;
    mesh(geo(THREE.CylinderGeometry, 0.06, 0.058, 0.18, 8), black, hip, 0, -0.6, 0);
    legs.push(hip);
  }

  // dress (lathe bell) + petticoat + apron
  const prof = [
    [0.02, 0.58], [0.44, 0.58], [0.45, 0.62], [0.4, 0.72], [0.3, 0.9], [0.2, 1.04], [0.15, 1.12], [0.0, 1.12],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const skirt = pivot(body, 0, 0, 0);
  mesh(geo(THREE.LatheGeometry, prof, 24), blue, skirt);
  const petti = prof.map((v) => new THREE.Vector2(v.x * 0.95, v.y - 0.05)).slice(0, 4);
  mesh(geo(THREE.LatheGeometry, petti, 24), white, skirt);
  const apronProf = prof.slice(1, 7).map((v) => new THREE.Vector2(v.x * 1.03 + 0.005, v.y + 0.02));
  const apron = mesh(geo(THREE.LatheGeometry, apronProf, 12, -0.9, 1.8), white, skirt);
  apron.material = mat('#f3efe9', { roughness: 0.85, side: THREE.DoubleSide });

  // torso
  const torso = pivot(body, 0, 1.1, 0);
  mesh(geo(THREE.CylinderGeometry, 0.13, 0.15, 0.34, 12), blue, torso, 0, 0.17, 0);
  const bib = mesh(geo(THREE.PlaneGeometry, 0.17, 0.26), mat('#f3efe9', { side: THREE.DoubleSide }), torso, 0, 0.14, 0.142);
  bib.rotation.x = -0.08;
  mesh(geo(THREE.TorusGeometry, 0.1, 0.03, 6, 14), white, torso, 0, 0.35, 0).rotation.x = Math.PI / 2;
  // back bow of the apron
  for (const s of [-1, 1]) {
    const b = mesh(geo(THREE.SphereGeometry, 0.07, 8, 6), white, torso, s * 0.07, 0.02, -0.16);
    b.scale.set(1.3, 0.8, 0.5);
  }

  // head
  const head = pivot(torso, 0, 0.42, 0);
  mesh(geo(THREE.CylinderGeometry, 0.045, 0.05, 0.1, 8), SKIN(), head, 0, 0, 0);
  const skull = pivot(head, 0, 0.14, 0);
  const face = mesh(geo(THREE.SphereGeometry, 0.135, 20, 16), SKIN(), skull);
  face.scale.set(1, 1.08, 1);
  for (const s of [-1, 1]) {
    mesh(geo(THREE.SphereGeometry, 0.024, 8, 6), mat('#2a4d9a', { roughness: 0.2 }), skull, s * 0.05, 0.01, 0.118);
    mesh(geo(THREE.SphereGeometry, 0.011, 6, 4), mat('#050308'), skull, s * 0.05, 0.01, 0.138);
  }
  mesh(geo(THREE.SphereGeometry, 0.012, 6, 4), mat('#b85a5a'), skull, 0, -0.07, 0.125);
  const cap = mesh(geo(THREE.SphereGeometry, 0.152, 20, 12, 0, Math.PI * 2, 0, 1.45), hair, skull, 0, 0.01, -0.012);
  cap.rotation.x = -0.25;
  // long flowing back hair: chain of segments so it can sway
  const hairChain = [];
  let parent = pivot(skull, 0, 0.0, -0.06);
  for (let i = 0; i < 4; i++) {
    const seg = pivot(parent, 0, i === 0 ? 0 : -0.14, 0);
    const lock = mesh(geo(THREE.SphereGeometry, 0.16 - i * 0.012, 12, 8), hair, seg, 0, -0.07, -0.02);
    lock.scale.set(1.15 + i * 0.1, 0.8, 0.45);
    hairChain.push(seg);
    parent = seg;
  }
  for (const s of [-1, 1]) {
    const side = mesh(geo(THREE.CapsuleGeometry, 0.045, 0.22, 4, 8), hair, skull, s * 0.13, -0.1, 0.02);
    side.rotation.z = s * 0.12;
  }
  // black bow
  const bow = pivot(skull, 0, 0.14, -0.02);
  for (const s of [-1, 1]) {
    const lobe = mesh(geo(THREE.ConeGeometry, 0.06, 0.13, 4), black, bow, s * 0.07, 0, 0);
    lobe.rotation.z = s * (Math.PI / 2);
  }
  mesh(geo(THREE.SphereGeometry, 0.03, 6, 6), black, bow);
  mesh(geo(THREE.TorusGeometry, 0.145, 0.012, 4, 20, Math.PI), black, skull, 0, 0.02, 0).rotation.y = Math.PI / 2;

  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.17, 0.3, 0);
    mesh(geo(THREE.SphereGeometry, 0.075, 10, 8), blue, sh).scale.set(1, 0.9, 1);
    mesh(geo(THREE.CylinderGeometry, 0.035, 0.03, 0.26, 8), SKIN(), sh, 0, -0.17, 0);
    const elbow = pivot(sh, 0, -0.3, 0);
    mesh(geo(THREE.CylinderGeometry, 0.03, 0.025, 0.24, 8), SKIN(), elbow, 0, -0.12, 0);
    const hand = pivot(elbow, 0, -0.26, 0);
    mesh(geo(THREE.SphereGeometry, 0.035, 8, 6), SKIN(), hand);
    arms.push({ sh, elbow, hand });
  }
  // A fan of razor cards in the right hand; glows while firing
  const fan = pivot(arms[1].hand, 0, -0.04, 0.03);
  const fanMat = new THREE.MeshStandardMaterial({ color: '#ffe9c0', emissive: '#ffb060', emissiveIntensity: 0.4, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const c = mesh(geo(THREE.PlaneGeometry, 0.07, 0.1), fanMat, fan, 0, 0, 0);
    c.rotation.set(0.3, 0, -0.5 + i * 0.3);
    c.position.set(-0.02 + i * 0.012, -0.03, 0);
  }

  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { root, parts: { body, legs, skirt, torso, head, skull, arms, hairChain, fan, fanMat } };
}

// ────────────────────────────── Card Guard ──────────────────────────────
const cardFaces = {};
function cardMat(suit, rank) {
  const k = suit + rank;
  if (!cardFaces[k]) cardFaces[k] = new THREE.MeshStandardMaterial({ map: cardTexture(suit, rank), roughness: 0.8 });
  return cardFaces[k];
}
let cardBackMat;

export function buildCardGuard(suit = '♥', rank = '7', tint = '#5c0d14') {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const armor = mat(tint, { metalness: 0.75, roughness: 0.35 });
  const darkArmor = mat('#1a0a0e', { metalness: 0.6, roughness: 0.4 });
  cardBackMat ||= new THREE.MeshStandardMaterial({ map: cardBackTexture(), roughness: 0.8 });

  const legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(body, s * 0.18, 0.85, 0);
    mesh(geo(THREE.CylinderGeometry, 0.07, 0.05, 0.85, 8), armor, hip, 0, -0.42, 0);
    mesh(geo(THREE.BoxGeometry, 0.13, 0.08, 0.26), darkArmor, hip, 0, -0.84, 0.05);
    const knee = mesh(geo(THREE.SphereGeometry, 0.08, 8, 6), darkArmor, hip, 0, -0.4, 0.02);
    knee.scale.z = 0.8;
    legs.push(hip);
  }
  const torso = pivot(body, 0, 0.85, 0);
  // the card itself — face on the front, ornate back behind
  const cw = 0.95;
  const ch = 1.35;
  const front = mesh(geo(THREE.PlaneGeometry, cw, ch), cardMat(suit, rank), torso, 0, 0.62, 0.035);
  const back = mesh(geo(THREE.PlaneGeometry, cw, ch), cardBackMat, torso, 0, 0.62, -0.035);
  back.rotation.y = Math.PI;
  mesh(geo(THREE.BoxGeometry, cw, ch, 0.06), mat('#d9ccb4', { roughness: 0.9 }), torso, 0, 0.62, 0).scale.set(1.001, 1.001, 1);
  front.renderOrder = 1;
  // helmet
  const head = pivot(torso, 0, 1.36, 0);
  mesh(geo(THREE.CylinderGeometry, 0.16, 0.19, 0.3, 10), armor, head, 0, 0.15, 0);
  const spike = mesh(geo(THREE.ConeGeometry, 0.06, 0.3, 6), armor, head, 0, 0.45, 0);
  spike.castShadow = true;
  const visor = mesh(geo(THREE.BoxGeometry, 0.26, 0.05, 0.05), mat('#ff3b3b', { emissive: '#ff1a1a', emissiveIntensity: 2.5 }), head, 0, 0.16, 0.17);
  visor.castShadow = false;
  // heart crest
  mesh(geo(THREE.SphereGeometry, 0.06, 8, 6), mat('#a3121e', { metalness: 0.5, roughness: 0.3 }), head, 0, 0.3, 0.14);

  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.53, 1.12, 0);
    mesh(geo(THREE.SphereGeometry, 0.1, 8, 6), armor, sh);
    mesh(geo(THREE.CylinderGeometry, 0.055, 0.045, 0.55, 8), armor, sh, 0, -0.28, 0);
    const hand = pivot(sh, 0, -0.58, 0);
    mesh(geo(THREE.SphereGeometry, 0.07, 8, 6), darkArmor, hand);
    arms.push({ sh, hand });
  }
  // spear
  const spear = pivot(arms[1].hand, 0, 0, 0);
  mesh(geo(THREE.CylinderGeometry, 0.025, 0.025, 2.4, 6), mat('#2a1810', { roughness: 0.6 }), spear, 0, 0, 0.3).rotation.x = Math.PI / 2;
  const tipMat = mat('#d24848', { metalness: 0.9, roughness: 0.2, emissive: '#3a0000' });
  const tip = mesh(geo(THREE.ConeGeometry, 0.09, 0.4, 4), tipMat, spear, 0, 0, 1.65);
  tip.rotation.x = Math.PI / 2;
  mesh(geo(THREE.ConeGeometry, 0.06, 0.18, 4), tipMat, spear, 0, 0.1, 1.45).rotation.x = Math.PI / 2 + 0.6;
  spear.rotation.x = -0.1;

  return { root, parts: { body, legs, torso, head, arms, spear } };
}

// ───────────────────────────── Teacup Mimic ─────────────────────────────
let porcelainMat;
export function buildTeacup(scale = 1) {
  porcelainMat ||= new THREE.MeshPhysicalMaterial({ map: porcelainTexture(), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
  const root = new THREE.Group();
  const body = pivot(root, 0, 0.35 * scale, 0);
  const cup = pivot(body, 0, 0, 0);
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    prof.push(new THREE.Vector2(0.28 + Math.sin(t * Math.PI * 0.5) * 0.34 + t * t * 0.05, t * 0.62));
  }
  const inner = prof.slice().reverse().map((v) => new THREE.Vector2(v.x - 0.035, Math.max(0.06, v.y - 0.01)));
  const lathe = geo(THREE.LatheGeometry, [new THREE.Vector2(0, 0), ...prof, ...inner, new THREE.Vector2(0, 0.06)], 28);
  mesh(lathe, porcelainMat, cup).scale.setScalar(scale);
  // tea surface — boiling, faintly glowing
  const teaMat = new THREE.MeshStandardMaterial({ color: '#3a1206', emissive: '#6b1a05', emissiveIntensity: 0.6, roughness: 0.1 });
  const tea = mesh(geo(THREE.CircleGeometry, 0.55 * scale, 20), teaMat, cup, 0, 0.45 * scale, 0);
  tea.rotation.x = -Math.PI / 2;
  // teeth around the rim, pointing inward
  const toothMat = mat('#f4efe2', { roughness: 0.3 });
  const teeth = pivot(cup, 0, 0.6 * scale, 0);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const t = mesh(geo(THREE.ConeGeometry, 0.045 * scale, 0.2 * scale, 4), toothMat, teeth, Math.sin(a) * 0.62 * scale, -0.02, Math.cos(a) * 0.62 * scale);
    t.lookAt(0, -0.1 * scale, 0);
    t.rotateX(Math.PI / 2);
  }
  // handle
  const handle = mesh(geo(THREE.TorusGeometry, 0.17 * scale, 0.04 * scale, 8, 16, Math.PI * 1.3), porcelainMat, cup, -0.66 * scale, 0.32 * scale, 0);
  handle.rotation.z = Math.PI * 0.35;
  // gold claw legs
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const hip = pivot(body, Math.sin(a) * 0.25 * scale, 0.02, Math.cos(a) * 0.25 * scale);
    hip.rotation.y = a;
    const leg = mesh(geo(THREE.CylinderGeometry, 0.03 * scale, 0.02 * scale, 0.42 * scale, 6), GOLD(), hip, 0, -0.14 * scale, 0.12 * scale);
    leg.rotation.x = 0.7;
    mesh(geo(THREE.SphereGeometry, 0.05 * scale, 6, 6), GOLD(), hip, 0, -0.33 * scale, 0.26 * scale);
    legs.push(hip);
  }
  // eyes glinting from the tea
  const eyeMat = mat('#ffcf4a', { emissive: '#ffae00', emissiveIntensity: 3 });
  for (const s of [-1, 1]) {
    const e = mesh(geo(THREE.SphereGeometry, 0.05 * scale, 8, 6), eyeMat, cup, s * 0.16 * scale, 0.47 * scale, 0.2 * scale);
    e.scale.y = 0.5;
  }
  cup.rotation.x = 0.55; // tilt the maw toward whatever it is facing
  return { root, parts: { body, cup, legs, teeth, teaMat } };
}

// ───────────────────────────── Clockwork Wisp ─────────────────────────────
let faceMat;
export function buildClockWisp(tint = '#9a6bff') {
  faceMat ||= new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.5, emissive: '#553388', emissiveIntensity: 0.25, emissiveMap: null });
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const casing = mesh(geo(THREE.CylinderGeometry, 0.5, 0.5, 0.16, 28), GOLD(), body);
  casing.rotation.x = Math.PI / 2;
  const face = mesh(geo(THREE.CircleGeometry, 0.44, 28), faceMat, body, 0, 0, 0.085);
  face.castShadow = false;
  const back = mesh(geo(THREE.CircleGeometry, 0.44, 28), faceMat, body, 0, 0, -0.085);
  back.rotation.y = Math.PI;
  mesh(geo(THREE.TorusGeometry, 0.5, 0.04, 8, 28), GOLD(), body, 0, 0, 0.08);
  mesh(geo(THREE.CylinderGeometry, 0.06, 0.06, 0.14, 8), GOLD(), body, 0, 0.56, 0);
  mesh(geo(THREE.TorusGeometry, 0.08, 0.02, 6, 12), GOLD(), body, 0, 0.66, 0);
  // hands
  const handMat = mat('#150a18');
  const hands = [];
  for (const [len, w] of [[0.3, 0.035], [0.4, 0.02]]) {
    const h = pivot(body, 0, 0, 0.1);
    mesh(geo(THREE.BoxGeometry, w, len, 0.01), handMat, h, 0, len / 2, 0);
    hands.push(h);
  }
  // glowing core + eye
  const coreMat = new THREE.MeshBasicMaterial({ color: tint });
  mesh(geo(THREE.SphereGeometry, 0.07, 10, 8), coreMat, body, 0, 0, 0.12).castShadow = false;
  // chain tail
  const chain = [];
  let p = body;
  for (let i = 0; i < 6; i++) {
    const link = pivot(p, 0, i === 0 ? -0.52 : -0.1, 0);
    mesh(geo(THREE.TorusGeometry, 0.035, 0.012, 4, 8), GOLD(), link).rotation.y = i % 2 ? Math.PI / 2 : 0;
    chain.push(link);
    p = link;
  }
  // tattered moth wings
  const wingMat = new THREE.MeshStandardMaterial({ color: '#2a1838', emissive: tint, emissiveIntensity: 0.25, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, s * 0.45, 0.1, -0.05);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(s * 0.5, 0.6, s * 0.95, 0.35);
    shape.lineTo(s * 0.75, 0.1);
    shape.lineTo(s * 0.9, -0.15);
    shape.lineTo(s * 0.55, -0.1);
    shape.quadraticCurveTo(s * 0.3, -0.4, 0, -0.1);
    mesh(geo(THREE.ShapeGeometry, shape), wingMat, w);
    wings.push(w);
  }
  return { root, parts: { body, hands, chain, wings, coreMat } };
}

// ───────────────────────────── The White Rabbit ─────────────────────────────
export function buildWhiteRabbit() {
  const root = new THREE.Group();
  const S = 2.6;
  const body = pivot(root, 0, 0, 0);
  const fur = mat('#e8e2dc', { roughness: 1 });
  const furDark = mat('#9d9189', { roughness: 1 });
  const vest = mat('#7a0f18', { roughness: 0.6 });
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(body, s * 0.28 * S, 0.62 * S, -0.05 * S);
    const thigh = mesh(geo(THREE.SphereGeometry, 0.22 * S, 12, 10), fur, hip, 0, -0.1 * S, 0.05 * S);
    thigh.scale.set(0.9, 1.2, 1.2);
    const shin = pivot(hip, 0, -0.3 * S, 0.08 * S);
    mesh(geo(THREE.CylinderGeometry, 0.08 * S, 0.06 * S, 0.34 * S, 8), fur, shin, 0, -0.14 * S, -0.05 * S).rotation.x = -0.4;
    const foot = mesh(geo(THREE.CapsuleGeometry, 0.07 * S, 0.3 * S, 4, 8), furDark, shin, 0, -0.3 * S, 0.08 * S);
    foot.rotation.x = Math.PI / 2;
    legs.push(hip);
  }
  const torso = pivot(body, 0, 0.62 * S, 0);
  const belly = mesh(geo(THREE.SphereGeometry, 0.42 * S, 20, 16), fur, torso, 0, 0.42 * S, 0);
  belly.scale.set(1, 1.25, 0.85);
  // tattered red waistcoat
  const vestGeo = geo(THREE.SphereGeometry, 0.44 * S, 20, 12, Math.PI * 0.6, Math.PI * 1.8, 0.35, 1.5);
  const v = mesh(vestGeo, vest, torso, 0, 0.45 * S, 0);
  v.scale.set(1, 1.2, 0.88);
  v.material = mat('#7a0f18', { roughness: 0.6, side: THREE.DoubleSide });
  // clock embedded in the chest
  const clock = pivot(torso, 0, 0.42 * S, 0.34 * S);
  faceMat ||= new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.5 });
  const cf = mesh(geo(THREE.CylinderGeometry, 0.27 * S, 0.27 * S, 0.08 * S, 32), GOLD(), clock);
  cf.rotation.x = Math.PI / 2;
  const clockFace = new THREE.MeshStandardMaterial({ map: faceMat.map, emissive: '#ffcf8a', emissiveMap: faceMat.map, emissiveIntensity: 0.35 });
  mesh(geo(THREE.CircleGeometry, 0.24 * S, 32), clockFace, clock, 0, 0, 0.042 * S);
  mesh(geo(THREE.TorusGeometry, 0.27 * S, 0.025 * S, 8, 32), GOLD(), clock, 0, 0, 0.04 * S);
  const clockHands = [];
  for (const [len, w] of [[0.15, 0.02], [0.21, 0.012]]) {
    const h = pivot(clock, 0, 0, 0.05 * S);
    mesh(geo(THREE.BoxGeometry, w * S, len * S, 0.01 * S), mat('#120808'), h, 0, (len * S) / 2, 0);
    clockHands.push(h);
  }
  // exposed gears
  for (let i = 0; i < 3; i++) {
    const gear = mesh(geo(THREE.TorusGeometry, 0.07 * S, 0.02 * S, 4, 10), GOLD(), torso, (i - 1) * 0.2 * S, 0.12 * S, 0.33 * S);
    gear.rotation.x = 0.3;
  }
  // head
  const head = pivot(torso, 0, 0.95 * S, 0.05 * S);
  const skull = mesh(geo(THREE.SphereGeometry, 0.3 * S, 20, 16), fur, head, 0, 0.12 * S, 0);
  skull.scale.set(1, 0.95, 1.05);
  const snout = mesh(geo(THREE.SphereGeometry, 0.16 * S, 12, 10), fur, head, 0, 0.04 * S, 0.22 * S);
  snout.scale.set(1.1, 0.8, 0.9);
  mesh(geo(THREE.SphereGeometry, 0.04 * S, 8, 6), mat('#6b2b3a'), head, 0, 0.1 * S, 0.36 * S);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff1a1a' });
  for (const s of [-1, 1]) {
    mesh(geo(THREE.SphereGeometry, 0.055 * S, 10, 8), eyeMat, head, s * 0.14 * S, 0.2 * S, 0.24 * S).castShadow = false;
  }
  // fangs
  for (const s of [-1, 1]) {
    const f = mesh(geo(THREE.ConeGeometry, 0.03 * S, 0.14 * S, 4), mat('#fffbe8'), head, s * 0.06 * S, -0.1 * S, 0.3 * S);
    f.rotation.x = Math.PI;
  }
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = pivot(head, s * 0.14 * S, 0.36 * S, -0.02 * S);
    const e = mesh(geo(THREE.CapsuleGeometry, 0.075 * S, 0.55 * S, 4, 10), fur, ear, 0, 0.35 * S, 0);
    e.scale.z = 0.45;
    const inner = mesh(geo(THREE.CapsuleGeometry, 0.045 * S, 0.45 * S, 4, 8), mat('#c98b95', { roughness: 1 }), ear, 0, 0.35 * S, 0.02 * S);
    inner.scale.z = 0.3;
    ear.rotation.z = s * -0.25;
    ears.push(ear);
  }
  // arms with claws; left hand dangles a pocket watch
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.45 * S, 0.75 * S, 0);
    mesh(geo(THREE.SphereGeometry, 0.14 * S, 10, 8), vest, sh);
    mesh(geo(THREE.CylinderGeometry, 0.09 * S, 0.07 * S, 0.5 * S, 8), fur, sh, 0, -0.28 * S, 0);
    const el = pivot(sh, 0, -0.52 * S, 0);
    mesh(geo(THREE.CylinderGeometry, 0.07 * S, 0.06 * S, 0.45 * S, 8), fur, el, 0, -0.22 * S, 0);
    const hand = pivot(el, 0, -0.48 * S, 0);
    mesh(geo(THREE.SphereGeometry, 0.09 * S, 10, 8), fur, hand);
    for (let c = 0; c < 3; c++) {
      const claw = mesh(geo(THREE.ConeGeometry, 0.025 * S, 0.16 * S, 4), mat('#1a1010', { metalness: 0.5 }), hand, (c - 1) * 0.05 * S, -0.1 * S, 0.06 * S);
      claw.rotation.x = Math.PI - 0.5;
    }
    arms.push({ sh, el, hand });
  }
  const watch = pivot(arms[0].hand, 0, -0.1 * S, 0);
  mesh(geo(THREE.CylinderGeometry, 0.004 * S, 0.004 * S, 0.3 * S, 4), GOLD(), watch, 0, -0.15 * S, 0);
  const w = mesh(geo(THREE.CylinderGeometry, 0.1 * S, 0.1 * S, 0.03 * S, 20), GOLD(), watch, 0, -0.38 * S, 0);
  w.rotation.x = Math.PI / 2;
  mesh(geo(THREE.CircleGeometry, 0.085 * S, 20), clockFace, watch, 0, -0.38 * S, 0.017 * S);

  return { root, parts: { body, legs, torso, head, ears, arms, watch, clockHands, eyeMat } };
}

// ───────────────────────────── Interactables ─────────────────────────────
export function buildChest(big = false) {
  const root = new THREE.Group();
  const s = big ? 1.5 : 1;
  const wood = mat(big ? '#5a0f18' : '#3b2418', { roughness: 0.6 });
  const trim = GOLD();
  mesh(geo(THREE.BoxGeometry, 1.1 * s, 0.6 * s, 0.75 * s), wood, root, 0, 0.3 * s, 0);
  const lid = pivot(root, 0, 0.6 * s, -0.375 * s);
  const top = mesh(geo(THREE.CylinderGeometry, 0.375 * s, 0.375 * s, 1.1 * s, 12, 1, false, 0, Math.PI), wood, lid, 0, 0, 0.375 * s);
  top.rotation.z = Math.PI / 2;
  top.rotation.y = Math.PI / 2;
  for (const x of [-0.45, 0, 0.45]) {
    mesh(geo(THREE.BoxGeometry, 0.07 * s, 0.62 * s, 0.77 * s), trim, root, x * s, 0.3 * s, 0);
  }
  mesh(geo(THREE.BoxGeometry, 0.16 * s, 0.2 * s, 0.05 * s), trim, root, 0, 0.5 * s, 0.39 * s);
  const glow = new THREE.MeshBasicMaterial({ color: big ? '#ff4060' : '#ffd070', transparent: true, opacity: 0 });
  const g = mesh(geo(THREE.BoxGeometry, 1.0 * s, 0.05 * s, 0.65 * s), glow, root, 0, 0.61 * s, 0);
  g.castShadow = false;
  // teacup-and-heart emblem
  mesh(geo(THREE.SphereGeometry, 0.07 * s, 8, 6), mat('#b3162a', { emissive: '#600', metalness: 0.4 }), root, 0, 0.35 * s, 0.39 * s);
  return { root, parts: { lid, glow } };
}

// The Looking Glass — this world's teleporter.
export function buildLookingGlass() {
  const root = new THREE.Group();
  const stone = mat('#3c3444', { roughness: 0.85 });
  const trim = GOLD();
  // stepped dais
  for (let i = 0; i < 4; i++) {
    const r = 5.2 - i * 0.9;
    mesh(geo(THREE.CylinderGeometry, r, r + 0.1, 0.35, 32), stone, root, 0, 0.175 + i * 0.35, 0);
  }
  const top = 1.4;
  const frame = pivot(root, 0, top, 0);
  // ornate arch frame
  const shape = new THREE.Shape();
  shape.moveTo(-1.6, 0);
  shape.lineTo(-1.6, 3.2);
  shape.absarc(0, 3.2, 1.6, Math.PI, 0, true);
  shape.lineTo(1.6, 0);
  shape.lineTo(1.3, 0);
  shape.lineTo(1.3, 3.2);
  shape.absarc(0, 3.2, 1.3, 0, Math.PI, false);
  shape.lineTo(-1.3, 0);
  const fg = geo(THREE.ExtrudeGeometry, shape, { depth: 0.35, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
  mesh(fg, mat('#161018', { metalness: 0.8, roughness: 0.35 }), frame, 0, 0, -0.17);
  // gold filigree ring + heart finial
  mesh(geo(THREE.TorusGeometry, 1.45, 0.05, 6, 40, Math.PI), trim, frame, 0, 3.2, 0.22);
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.35);
  heart.bezierCurveTo(-0.6, 0.05, -0.35, 0.45, 0, 0.2);
  heart.bezierCurveTo(0.35, 0.45, 0.6, 0.05, 0, -0.35);
  const heartMat = mat('#b3122a', { emissive: '#ff1030', emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.3 });
  mesh(geo(THREE.ExtrudeGeometry, heart, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }), heartMat, frame, 0, 5.2, -0.06);
  // spires
  for (const s of [-1, 1]) {
    mesh(geo(THREE.CylinderGeometry, 0.12, 0.16, 4.2, 8), mat('#161018', { metalness: 0.8, roughness: 0.35 }), frame, s * 1.95, 2.1, 0);
    mesh(geo(THREE.ConeGeometry, 0.2, 0.8, 8), trim, frame, s * 1.95, 4.6, 0);
    const lamp = mesh(geo(THREE.SphereGeometry, 0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffb35a' }), frame, s * 1.95, 3.9, 0.2);
    lamp.castShadow = false;
  }
  // the glass: swirling shader
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, charge: { value: 0 }, uActive: { value: 0 } },
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float t; uniform float charge; uniform float uActive;
      void main(){
        vec2 p = vUv*2.0-1.0; p.y *= 1.6;
        float r = length(p); float a = atan(p.y,p.x);
        float sw = sin(a*5.0 + r*9.0 - t*(1.5+uActive*4.0)) * 0.5 + 0.5;
        vec3 base = mix(vec3(0.10,0.06,0.20), vec3(0.45,0.2,0.9), sw*0.6);
        base = mix(base, vec3(1.0,0.25,0.45), charge*sw*0.7);
        base += vec3(0.8,0.6,1.0) * pow(1.0-r*0.6, 6.0) * (0.3+uActive);
        float sheen = smoothstep(0.02,0.0,abs(vUv.x - vUv.y*0.4 - fract(t*0.1)*1.6+0.3))*0.4;
        gl_FragColor = vec4(base + sheen, 0.92);
      }`,
  });
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-1.3, 0);
  glassShape.lineTo(-1.3, 3.2);
  glassShape.absarc(0, 3.2, 1.3, Math.PI, 0, true);
  glassShape.lineTo(1.3, 0);
  const gg = geo(THREE.ShapeGeometry, glassShape, 24);
  // normalise UVs to 0..1
  const uv = gg.attributes.uv;
  const pos = gg.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 1.3) / 2.6, pos.getY(i) / 4.5);
  const glass = mesh(gg, glassMat, frame, 0, 0, 0);
  glass.castShadow = false;
  return { root, parts: { frame, glassMat, heartMat } };
}
