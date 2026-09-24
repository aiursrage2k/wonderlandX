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

export { buildWhiteRabbit } from './rabbit.js';

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

// ───────────────────────────── The Queen of Hearts ─────────────────────────────
export function buildQueen() {
  const root = new THREE.Group();
  const S = 2.4;
  const body = pivot(root, 0, 0, 0);
  const red = mat('#8a0c18', { roughness: 0.45 });
  const black = mat('#130810', { roughness: 0.5 });
  const gold = GOLD();
  const skin = mat('#f0e2e6', { roughness: 0.5 });
  // towering gown in red and black panels
  const prof = [[0.05, 0], [0.95, 0], [0.9, 0.12], [0.72, 0.5], [0.5, 0.9], [0.32, 1.15], [0.26, 1.25], [0, 1.25]].map(([r, y]) => new THREE.Vector2(r * S, y * S));
  const gown = pivot(body, 0, 0, 0);
  for (let i = 0; i < 8; i++) {
    const m = mesh(geo(THREE.LatheGeometry, prof, 6, (i / 8) * Math.PI * 2, Math.PI / 4), i % 2 ? red : black, gown);
    m.material = i % 2 ? red : black;
  }
  // heart hem trim
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    mesh(geo(THREE.SphereGeometry, 0.09 * S, 8, 6), gold, gown, Math.sin(a) * 0.93 * S, 0.06 * S, Math.cos(a) * 0.93 * S);
  }
  const torso = pivot(body, 0, 1.2 * S, 0);
  mesh(geo(THREE.CylinderGeometry, 0.22 * S, 0.27 * S, 0.45 * S, 12), red, torso, 0, 0.2 * S, 0);
  // enormous ruffled collar
  const collar = mesh(geo(THREE.ConeGeometry, 0.62 * S, 0.5 * S, 18, 1, true), mat('#f2ece0', { side: THREE.DoubleSide, roughness: 0.8 }), torso, 0, 0.55 * S, -0.08 * S);
  collar.rotation.x = Math.PI + 0.35;
  const head = pivot(torso, 0, 0.62 * S, 0.02 * S);
  const face = mesh(geo(THREE.SphereGeometry, 0.2 * S, 18, 14), skin, head, 0, 0.12 * S, 0);
  face.scale.set(1.05, 1.1, 1);
  mesh(geo(THREE.SphereGeometry, 0.215 * S, 16, 10, 0, Math.PI * 2, 0, 1.6), black, head, 0, 0.14 * S, -0.03 * S);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff2030' });
  for (const s of [-1, 1]) {
    mesh(geo(THREE.SphereGeometry, 0.03 * S, 8, 6), eyeMat, head, s * 0.07 * S, 0.15 * S, 0.18 * S).castShadow = false;
    mesh(geo(THREE.SphereGeometry, 0.045 * S, 8, 6), mat('#c0306a', { roughness: 0.6 }), head, s * 0.11 * S, 0.06 * S, 0.15 * S).scale.z = 0.4;
  }
  mesh(geo(THREE.BoxGeometry, 0.08 * S, 0.025 * S, 0.02 * S), mat('#5a0010'), head, 0, 0.0, 0.19 * S);
  // crown
  const crown = pivot(head, 0, 0.3 * S, 0);
  mesh(geo(THREE.CylinderGeometry, 0.15 * S, 0.13 * S, 0.1 * S, 16, 1, true), gold, crown);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mesh(geo(THREE.ConeGeometry, 0.035 * S, 0.14 * S, 4), gold, crown, Math.sin(a) * 0.14 * S, 0.1 * S, Math.cos(a) * 0.14 * S);
  }
  mesh(geo(THREE.SphereGeometry, 0.035 * S, 8, 6), mat('#ff2040', { emissive: '#ff0020', emissiveIntensity: 2 }), crown, 0, 0.03 * S, 0.15 * S);
  // arms; right one wields a heart-topped scepter
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.3 * S, 0.36 * S, 0);
    mesh(geo(THREE.SphereGeometry, 0.12 * S, 10, 8), red, sh).scale.set(1, 1.2, 1);
    mesh(geo(THREE.CylinderGeometry, 0.05 * S, 0.04 * S, 0.5 * S, 8), skin, sh, 0, -0.28 * S, 0);
    const hand = pivot(sh, 0, -0.55 * S, 0);
    mesh(geo(THREE.SphereGeometry, 0.05 * S, 8, 6), skin, hand);
    arms.push({ sh, hand });
  }
  const scepter = pivot(arms[1].hand, 0, 0, 0);
  mesh(geo(THREE.CylinderGeometry, 0.025 * S, 0.025 * S, 1.3 * S, 8), gold, scepter, 0, 0.35 * S, 0);
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.35);
  heart.bezierCurveTo(-0.6, 0.05, -0.35, 0.45, 0, 0.2);
  heart.bezierCurveTo(0.35, 0.45, 0.6, 0.05, 0, -0.35);
  const heartMat = mat('#d0102a', { emissive: '#ff1030', emissiveIntensity: 1.5, metalness: 0.3, roughness: 0.3 });
  const h = mesh(geo(THREE.ExtrudeGeometry, heart, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }), heartMat, scepter, 0, 1.1 * S, 0);
  h.scale.setScalar(S * 0.6);
  return { root, parts: { body, gown, torso, head, arms, scepter, eyeMat, heartMat } };
}

// The Mad Hatter's tea table — a chance shrine.
export function buildTeaTable() {
  const root = new THREE.Group();
  const wood = mat('#2a1612', { roughness: 0.7 });
  const cloth = mat('#e8e0d4', { roughness: 0.9 });
  mesh(geo(THREE.BoxGeometry, 3.2, 0.12, 1.4), cloth, root, 0, 1.0, 0);
  for (const x of [-1.4, 1.4]) for (const z of [-0.55, 0.55]) mesh(geo(THREE.CylinderGeometry, 0.06, 0.05, 1, 6), wood, root, x, 0.5, z);
  const porc = mat('#f2ece2', { roughness: 0.3 });
  for (let i = 0; i < 6; i++) {
    const c = mesh(geo(THREE.CylinderGeometry, 0.12, 0.08, 0.16, 12), porc, root, -1.2 + i * 0.45, 1.14, (i % 2 ? 0.3 : -0.3));
    c.rotation.z = i === 3 ? 1.4 : 0;
  }
  mesh(geo(THREE.SphereGeometry, 0.25, 12, 10), porc, root, 0.2, 1.3, 0).scale.set(1, 0.8, 1);
  // the hat, 10/6 tag and all
  const hat = pivot(root, -0.9, 1.06, 0.1);
  mesh(geo(THREE.CylinderGeometry, 0.42, 0.42, 0.04, 20), mat('#3a2a4a'), hat, 0, 0, 0);
  mesh(geo(THREE.CylinderGeometry, 0.3, 0.26, 0.6, 20), mat('#3a2a4a'), hat, 0, 0.32, 0);
  mesh(geo(THREE.CylinderGeometry, 0.305, 0.285, 0.1, 20), mat('#b01830'), hat, 0, 0.1, 0);
  const tag = mesh(geo(THREE.PlaneGeometry, 0.16, 0.1), mat('#f0e6c8', { side: THREE.DoubleSide }), hat, 0.2, 0.2, 0.2);
  tag.rotation.y = 0.7;
  const glow = new THREE.MeshBasicMaterial({ color: '#ffd070', transparent: true, opacity: 0.4 });
  const g = mesh(geo(THREE.TorusGeometry, 0.5, 0.03, 6, 24), glow, hat, 0, 0.7, 0);
  g.rotation.x = Math.PI / 2;
  g.castShadow = false;
  return { root, parts: { hat, glow } };
}
