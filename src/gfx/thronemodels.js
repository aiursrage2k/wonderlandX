// Depth 03 — the Queen's court: armoured Knights of Hearts and the colossal
// Crimson Queen she becomes. Same conventions as models.js: { root, parts },
// models face +Z with their base at y = 0.

import * as THREE from 'three';
import { mat } from './models.js';
import { cardTexture } from './textures.js';

function mesh(g, material, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

function pivot(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// A plump heart outline, centred, pointing down, about 2 units wide.
export function heartShape(s = 1) {
  const h = new THREE.Shape();
  h.moveTo(0, -1.0 * s);
  h.bezierCurveTo(-0.35 * s, -0.62 * s, -1.05 * s, -0.25 * s, -1.0 * s, 0.28 * s);
  h.bezierCurveTo(-0.95 * s, 0.8 * s, -0.25 * s, 0.95 * s, 0, 0.5 * s);
  h.bezierCurveTo(0.25 * s, 0.95 * s, 0.95 * s, 0.8 * s, 1.0 * s, 0.28 * s);
  h.bezierCurveTo(1.05 * s, -0.25 * s, 0.35 * s, -0.62 * s, 0, -1.0 * s);
  return h;
}

let heartGeoCache = null;
function heartGeo() {
  heartGeoCache ||= new THREE.ExtrudeGeometry(heartShape(1), { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -0.09);
  return heartGeoCache;
}

const cardMats = {};
function cardFace(suit, rank) {
  const k = suit + rank;
  cardMats[k] ||= new THREE.MeshStandardMaterial({ map: cardTexture(suit, rank), roughness: 0.75, side: THREE.DoubleSide });
  return cardMats[k];
}

// ───────────────────────── Knight of Hearts ─────────────────────────
export function buildHeartKnight(rank = 'K') {
  const root = new THREE.Group();
  const body = pivot(root);
  const gold = mat('#c9a04a', { metalness: 0.9, roughness: 0.28 });
  const steel = mat('#2a2230', { metalness: 0.8, roughness: 0.35 });
  const red = mat('#8a0c18', { roughness: 0.45 });
  const glow = new THREE.MeshStandardMaterial({ color: '#ff2040', emissive: '#ff1030', emissiveIntensity: 2.2, roughness: 0.3 });
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(body, 0.26 * s, 1.35, 0);
    mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.7, 10), steel, hip, 0, -0.35, 0);
    const knee = pivot(hip, 0, -0.7, 0);
    mesh(new THREE.SphereGeometry(0.16, 10, 8), gold, knee);
    mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.62, 10), steel, knee, 0, -0.32, 0);
    mesh(new THREE.BoxGeometry(0.26, 0.14, 0.42), steel, knee, 0, -0.62, 0.07);
    legs.push({ hip, knee });
  }
  const torso = pivot(body, 0, 1.35, 0);
  // the card tabard, front and back, over a steel cuirass
  mesh(new THREE.CylinderGeometry(0.42, 0.36, 1.05, 12), steel, torso, 0, 0.55, 0);
  const tab = mesh(new THREE.PlaneGeometry(0.86, 1.25), cardFace('♥', rank), torso, 0, 0.45, 0.43);
  tab.castShadow = false;
  const tabB = mesh(new THREE.PlaneGeometry(0.86, 1.25), cardFace('♥', rank), torso, 0, 0.45, -0.43);
  tabB.rotation.y = Math.PI;
  mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20), gold, torso, 0, 1.06, 0).rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.38, 0.05, 6, 20), gold, torso, 0, 0.04, 0).rotation.x = Math.PI / 2;
  // pauldrons
  for (const s of [-1, 1]) {
    const p = mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold, torso, 0.5 * s, 1.02, 0);
    p.rotation.z = -0.4 * s;
  }
  // helm: great helm with a heart crest and a crimson plume
  const head = pivot(torso, 0, 1.2, 0);
  mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.5, 14), steel, head, 0, 0.18, 0);
  mesh(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel, head, 0, 0.43, 0);
  mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), glow, head, 0, 0.24, 0.25);
  mesh(new THREE.BoxGeometry(0.04, 0.3, 0.05), gold, head, 0, 0.16, 0.26);
  const crest = mesh(heartGeo(), glow, head, 0, 0.72, 0);
  crest.scale.setScalar(0.14);
  const plume = mesh(new THREE.ConeGeometry(0.12, 0.9, 8), red, head, 0, 0.75, -0.2);
  plume.rotation.x = -2.3;
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(torso, 0.55 * s, 0.98, 0);
    mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.6, 8), steel, sh, 0, -0.3, 0);
    const el = pivot(sh, 0, -0.6, 0);
    mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.55, 8), gold, el, 0, -0.27, 0);
    const hand = pivot(el, 0, -0.58, 0);
    mesh(new THREE.SphereGeometry(0.12, 8, 6), steel, hand);
    arms.push({ sh, el, hand });
  }
  // heart shield on the left forearm
  const shield = pivot(arms[0].el, -0.12, -0.3, 0.22);
  const sh = mesh(heartGeo(), red, shield);
  sh.scale.set(0.62, 0.62, 1.2);
  const rim = mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 28), gold, shield, 0, 0.02, 0.04);
  rim.scale.set(1, 0.95, 1);
  const boss = mesh(heartGeo(), glow, shield, 0, 0.05, 0.14);
  boss.scale.setScalar(0.2);
  shield.rotation.y = -0.2;
  // halberd in the right hand
  const halberd = pivot(arms[1].hand, 0, 0, 0);
  mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.4, 6), mat('#2a1a10', { roughness: 0.8 }), halberd, 0, 0.4, 0);
  const blade = new THREE.Shape();
  blade.moveTo(0, 0);
  blade.quadraticCurveTo(0.75, 0.15, 0.7, 0.75);
  blade.quadraticCurveTo(0.3, 0.55, 0, 0.62);
  blade.lineTo(0, 0);
  const bl = mesh(new THREE.ExtrudeGeometry(blade, { depth: 0.04, bevelEnabled: false }), gold, halberd, 0.02, 1.55, -0.02);
  bl.rotation.y = Math.PI / 2;
  mesh(new THREE.ConeGeometry(0.07, 0.5, 6), gold, halberd, 0, 2.35, 0);
  halberd.rotation.x = Math.PI / 2;
  return { root, parts: { body, torso, head, legs, arms, shield, halberd, glowMat: glow } };
}

// ───────────────────────── The Crimson Queen ─────────────────────────
// A cathedral-sized upper body rising out of a whirl of cards: claws, a card
// crown, card wings, and a crystal heart in her chest that is her weak point.
export function buildCrimsonQueen() {
  const root = new THREE.Group();
  const body = pivot(root);
  const gold = mat('#d2a64c', { metalness: 0.95, roughness: 0.25 });
  const black = mat('#140a10', { metalness: 0.5, roughness: 0.3 });
  const red = mat('#7a0a16', { roughness: 0.4, metalness: 0.2 });
  const skin = mat('#e8d4d8', { roughness: 0.45 });
  const hair = mat('#2a0c10', { roughness: 0.6 });
  const heartMat = new THREE.MeshStandardMaterial({ color: '#ff2a40', emissive: '#ff1030', emissiveIntensity: 3, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.95 });
  const veinMat = new THREE.MeshBasicMaterial({ color: '#ff2040' });
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff3040' });

  // a vortex of cards and shadow where her legs should be
  const vortex = pivot(body, 0, 0, 0);
  const skirt = mesh(new THREE.ConeGeometry(9, 16, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#2a0610', roughness: 0.5, side: THREE.DoubleSide, emissive: '#400010', emissiveIntensity: 0.6 }), vortex, 0, 8, 0);
  skirt.rotation.x = Math.PI;
  const cards = [];
  const suits = ['♥', '♥', '♠', '♦'];
  for (let i = 0; i < 36; i++) {
    const c = mesh(new THREE.PlaneGeometry(1.4, 2), cardFace(suits[i % 4], ['A', 'K', 'Q', 'J', '10', '7'][i % 6]), vortex);
    c.castShadow = false;
    cards.push({ m: c, a: (i / 36) * Math.PI * 2, r: 6 + (i % 5) * 1.6, y: 1 + (i % 9) * 1.6, s: 0.4 + (i % 3) * 0.15 });
  }

  // torso: black-and-gold armoured corset around the crystal heart
  const torso = pivot(body, 0, 15, 0);
  const prof = [[0, 0], [4.2, 0], [4.6, 1.2], [3.6, 4.5], [3.9, 7], [5.2, 9], [4.6, 10.4], [0, 10.6]].map(([r, y]) => new THREE.Vector2(r, y));
  const bodice = mesh(new THREE.LatheGeometry(prof, 20), black, torso);
  bodice.scale.z = 0.72;
  // gold filigree ribs
  for (let i = 0; i < 7; i++) {
    const rib = mesh(new THREE.TorusGeometry(3.9 + Math.sin(i * 0.5) * 0.4, 0.14, 6, 30, Math.PI * 1.1), gold, torso, 0, 1.5 + i * 1.2, 0);
    rib.rotation.x = Math.PI / 2;
    rib.rotation.z = Math.PI * 0.95;
    rib.scale.set(1, 0.72, 1);
  }
  // the heart: a glowing faceted crystal with thorny gold cage
  const heart = pivot(torso, 0, 6.2, 2.9);
  const crystal = mesh(new THREE.ExtrudeGeometry(heartShape(1.9), { depth: 1.3, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.35, bevelSegments: 1, curveSegments: 6 }).translate(0, 0, -0.65), heartMat, heart);
  crystal.castShadow = false;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const th = mesh(new THREE.ConeGeometry(0.16, 1.4, 5), gold, heart, Math.cos(a) * 2.3, Math.sin(a) * 2.1, 0.5);
    th.rotation.z = a - Math.PI / 2;
  }
  // glowing veins spreading from the heart
  for (let i = 0; i < 8; i++) {
    const v = mesh(new THREE.CylinderGeometry(0.07, 0.03, 3 + (i % 3), 4), veinMat, heart, 0, 0, -0.3);
    v.rotation.z = (i / 8) * Math.PI * 2 + 0.2;
    v.translateY(2.4 + (i % 3) * 0.5);
    v.castShadow = false;
  }
  // stiff ruff collar of cards fanning behind the neck
  const collar = pivot(torso, 0, 10.2, -0.8);
  for (let i = 0; i < 13; i++) {
    const a = -1.3 + (i / 12) * 2.6;
    const c = mesh(new THREE.PlaneGeometry(1.6, 3.2), cardFace('♥', i % 2 ? 'Q' : 'K'), collar);
    c.position.set(Math.sin(a) * 2.6, 1.3 + Math.cos(a) * 1.1, -Math.cos(a) * 0.6);
    c.rotation.set(-0.35, a * 0.8, -a * 0.9);
  }
  // card wings: two fans of towering cards behind her shoulders
  const wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(torso, 3.5 * s, 8.5, -2.4);
    for (let i = 0; i < 9; i++) {
      const c = mesh(new THREE.PlaneGeometry(2.4, 6.6), cardFace(i % 3 ? '♥' : '♦', ['A', 'K', 'Q'][i % 3]), w);
      c.geometry.translate(0, 3.3, 0);
      c.rotation.z = -s * (0.25 + i * 0.2);
      c.position.x = s * i * 0.35;
      c.position.z = -i * 0.12;
    }
    const edge = mesh(new THREE.TorusGeometry(7.5, 0.1, 4, 40, Math.PI * 0.9), veinMat, w, 0, 0, -0.5);
    edge.rotation.z = 0.15;
    edge.scale.x = s;
    wings.push(w);
  }

  // head: pale, furious, crowned
  const neck = pivot(torso, 0, 10.4, 0.2);
  mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.6, 12), skin, neck, 0, 0.6, 0);
  const head = pivot(neck, 0, 1.4, 0.3);
  const face = mesh(new THREE.SphereGeometry(1.75, 24, 18), skin, head, 0, 1.4, 0);
  face.scale.set(0.92, 1.12, 0.95);
  // a voluminous crown of dark curls
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 1.55 + (i % 3) * 0.12;
    const c = mesh(new THREE.SphereGeometry(0.75, 10, 8), hair, head, Math.sin(a) * r, 1.9 + Math.cos(a * 2) * 0.35, Math.cos(a) * r * 0.85 - 0.35);
    if (Math.cos(a) > 0.7) c.position.y += 0.9;
  }
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.22, 10, 8), eyeMat, head, 0.58 * s, 1.55, 1.5);
    eye.scale.set(1.3, 0.7, 0.6);
    eye.castShadow = false;
    const brow = mesh(new THREE.BoxGeometry(0.7, 0.12, 0.2), hair, head, 0.58 * s, 1.95, 1.52);
    brow.rotation.z = 0.35 * s;
  }
  const mouth = mesh(new THREE.SphereGeometry(0.42, 12, 8), mat('#3a0008', { roughness: 0.5 }), head, 0, 0.62, 1.4);
  mouth.scale.set(1.1, 0.5, 0.5);
  // crown: gold band, heart spires, rubies
  const crown = pivot(head, 0, 3.0, -0.1);
  mesh(new THREE.CylinderGeometry(1.5, 1.35, 0.8, 18, 1, true), gold, crown).material = mat('#d2a64c', { metalness: 0.95, roughness: 0.25, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const sp = mesh(new THREE.ConeGeometry(0.22, 1.4 + (i % 2) * 0.8, 5), gold, crown, Math.sin(a) * 1.45, 1 + (i % 2) * 0.4, Math.cos(a) * 1.45);
    const hj = mesh(heartGeo(), heartMat, crown, Math.sin(a) * 1.5, 0.15, Math.cos(a) * 1.5);
    hj.scale.setScalar(0.22);
    hj.lookAt(Math.sin(a) * 5, 0.15, Math.cos(a) * 5);
    void sp;
  }
  const bigJewel = mesh(heartGeo(), heartMat, crown, 0, 1.3, 1.45);
  bigJewel.scale.setScalar(0.45);

  // arms: long, armoured, ending in black-and-gold talons
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(torso, 4.6 * s, 9.2, 0);
    mesh(new THREE.SphereGeometry(1.6, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold, sh, 0, 0.2, 0);
    const upper = mesh(new THREE.CylinderGeometry(0.9, 0.75, 7, 10), black, sh, 0, -3.5, 0);
    void upper;
    for (let k = 0; k < 3; k++) mesh(new THREE.TorusGeometry(0.85, 0.12, 6, 16), gold, sh, 0, -1.5 - k * 2, 0).rotation.x = Math.PI / 2;
    const el = pivot(sh, 0, -7, 0);
    mesh(new THREE.SphereGeometry(0.95, 10, 8), gold, el);
    mesh(new THREE.CylinderGeometry(0.75, 0.6, 7, 10), black, el, 0, -3.5, 0);
    const cuff = mesh(new THREE.CylinderGeometry(0.95, 0.75, 1.6, 10), red, el, 0, -6.2, 0);
    void cuff;
    const hand = pivot(el, 0, -7.4, 0);
    mesh(new THREE.SphereGeometry(1.1, 12, 8), black, hand).scale.set(1.2, 0.7, 1.3);
    const claws = [];
    for (let k = 0; k < 5; k++) {
      const a = -0.9 + k * 0.45;
      const f = pivot(hand, Math.sin(a) * 1.0, -0.2, Math.cos(a) * 1.0 - 0.2);
      f.rotation.set(0.5, a * 0.8, 0);
      mesh(new THREE.CylinderGeometry(0.3, 0.24, 1.6, 6), black, f, 0, -0.8, 0);
      mesh(new THREE.TorusGeometry(0.3, 0.07, 4, 10), gold, f, 0, -0.6, 0).rotation.x = Math.PI / 2;
      const tip = pivot(f, 0, -1.6, 0);
      tip.rotation.x = 0.5;
      const talon = mesh(new THREE.ConeGeometry(0.24, 2.4, 6), black, tip, 0, -1.2, 0);
      talon.rotation.x = Math.PI;
      claws.push(tip);
    }
    // a glowing sigil she conjures in her palm
    const sig = mesh(new THREE.RingGeometry(1.4, 1.8, 32), new THREE.MeshBasicMaterial({ color: '#ff2040', transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), hand, 0, -1.2, 0);
    sig.rotation.x = Math.PI / 2;
    sig.castShadow = false;
    arms.push({ sh, el, hand, claws, sig });
  }
  return { root, parts: { body, torso, head, neck, crown, heart, heartMat, crystal, wings, arms, vortex, cards, mouth, eyeMat } };
}
