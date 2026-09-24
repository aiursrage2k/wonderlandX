// Depth 03 — the Queen's court: armoured Knights of Hearts and the colossal
// Crimson Queen she becomes. Same conventions as models.js: { root, parts },
// models face +Z with their base at y = 0.

import * as THREE from 'three';
import { mat } from './models.js';
import { cardTexture } from './textures.js';

const TAU = Math.PI * 2;

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
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A painted face wrapped on a sphere: front of the sphere is u = 0.25.
function queenFaceTextures() {
  const W = 1024;
  const H = 512;
  const cx = W * 0.25;
  const paint = (x, glow) => {
    x.fillStyle = glow ? '#000' : '#ecdadc';
    x.fillRect(0, 0, W, H);
    if (!glow) {
      // hollow cheeks and a sharp jaw
      const g = x.createRadialGradient(cx, H * 0.62, 10, cx, H * 0.62, 150);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(120,60,90,0.25)');
      x.fillStyle = g;
      x.fillRect(cx - 200, H * 0.3, 400, 260);
    }
    for (const s of [-1, 1]) {
      const ex = cx + s * 62;
      const ey = H * 0.44;
      // smoky, winged eye make-up
      if (!glow) {
        x.fillStyle = 'rgba(30,0,20,0.85)';
        x.beginPath();
        x.moveTo(ex - s * 44, ey + 4);
        x.quadraticCurveTo(ex, ey - 34, ex + s * 58, ey - 22);
        x.quadraticCurveTo(ex + s * 20, ey + 22, ex - s * 44, ey + 4);
        x.fill();
        // furious brows
        x.strokeStyle = '#1a0610';
        x.lineWidth = 9;
        x.beginPath();
        x.moveTo(ex - s * 40, ey - 44);
        x.lineTo(ex + s * 44, ey - 26);
        x.stroke();
      }
      // the eyes: burning red slits
      x.fillStyle = glow ? '#ff3040' : '#ff2a3a';
      x.beginPath();
      x.ellipse(ex, ey - 4, 26, 9, s * 0.25, 0, TAU);
      x.fill();
      x.fillStyle = glow ? '#ffe0a0' : '#ffd080';
      x.beginPath();
      x.ellipse(ex, ey - 4, 5, 8, 0, 0, TAU);
      x.fill();
      // glowing cracks running down from the eyes
      x.strokeStyle = glow ? '#ff2040' : '#6a0818';
      x.lineWidth = glow ? 3 : 4;
      x.beginPath();
      let px = ex;
      let py = ey + 8;
      x.moveTo(px, py);
      for (let k = 0; k < 6; k++) {
        px += (Math.sin(k * 3.1 + s) * 12);
        py += 18;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    // a nose, a snarling dark mouth
    if (!glow) {
      x.strokeStyle = 'rgba(120,70,80,0.6)';
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(cx - 8, H * 0.5);
      x.quadraticCurveTo(cx - 14, H * 0.58, cx, H * 0.6);
      x.stroke();
    }
    x.fillStyle = glow ? '#300008' : '#5a0010';
    x.beginPath();
    x.moveTo(cx - 52, H * 0.69);
    x.quadraticCurveTo(cx, H * 0.64, cx + 52, H * 0.69);
    x.quadraticCurveTo(cx, H * 0.8, cx - 52, H * 0.69);
    x.fill();
    if (!glow) {
      x.fillStyle = '#f4ecdc';
      for (let k = -3; k <= 3; k++) x.fillRect(cx + k * 12 - 4, H * 0.68, 8, 9);
    }
    // a heart on the brow
    x.fillStyle = glow ? '#ff2040' : '#c01030';
    x.beginPath();
    const hy = H * 0.3;
    x.moveTo(cx, hy + 14);
    x.bezierCurveTo(cx - 18, hy, cx - 14, hy - 12, cx, hy - 4);
    x.bezierCurveTo(cx + 14, hy - 12, cx + 18, hy, cx, hy + 14);
    x.fill();
  };
  return { map: canvasTex(W, H, (x) => paint(x, false)), emissive: canvasTex(W, H, (x) => paint(x, true)) };
}

// Black lacquer with gold filigree and red veins that glow.
let bodiceCache = null;
function bodiceTextures() {
  if (bodiceCache) return bodiceCache;
  const W = 512;
  const H = 512;
  const draw = (x, glow) => {
    x.fillStyle = glow ? '#000' : '#16080e';
    x.fillRect(0, 0, W, H);
    x.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const cx = (i % 4) * 128 + 64;
      const cy = Math.floor(i / 4) * 170 + 80;
      x.strokeStyle = glow ? 'rgba(0,0,0,0)' : '#c9a04a';
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(cx, cy + 50);
      x.bezierCurveTo(cx - 60, cy + 10, cx - 30, cy - 50, cx, cy - 10);
      x.bezierCurveTo(cx + 30, cy - 50, cx + 60, cy + 10, cx, cy + 50);
      x.stroke();
      x.beginPath();
      x.arc(cx - 34, cy - 40, 14, 0, Math.PI * 1.5);
      x.arc(cx + 34, cy - 40, 14, Math.PI * 1.5, Math.PI * 3);
      x.stroke();
    }
    x.strokeStyle = glow ? '#ff1830' : '#5a0616';
    x.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      let px = (i * 97) % W;
      let py = (i * 57) % H;
      x.beginPath();
      x.moveTo(px, py);
      for (let k = 0; k < 7; k++) {
        px += Math.sin(i * 1.7 + k) * 26;
        py += 22;
        x.lineTo(px, py);
      }
      x.stroke();
    }
  };
  const map = canvasTex(W, H, (x) => draw(x, false));
  const emissive = canvasTex(W, H, (x) => draw(x, true));
  for (const t of [map, emissive]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
  }
  bodiceCache = { map, emissive };
  return bodiceCache;
}

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
  const skirt = mesh(new THREE.ConeGeometry(9, 16, 32, 1, true), new THREE.MeshStandardMaterial({ map: bodiceTextures().map, emissiveMap: bodiceTextures().emissive, color: '#8a2030', roughness: 0.4, side: THREE.DoubleSide, emissive: '#ff2040', emissiveIntensity: 1.0 }), vortex, 0, 8, 0);
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
  const bt = bodiceTextures();
  const lacquer = new THREE.MeshStandardMaterial({ map: bt.map, emissiveMap: bt.emissive, emissive: '#ff2040', emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.3 });
  const bodice = mesh(new THREE.LatheGeometry(prof, 32), lacquer, torso);
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
      const edge = mesh(new THREE.PlaneGeometry(2.6, 6.8).translate(0, 3.3, -0.02), veinMat, c);
      edge.castShadow = false;
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
  const ft = queenFaceTextures();
  const faceMat = new THREE.MeshStandardMaterial({ map: ft.map, emissiveMap: ft.emissive, emissive: '#ffffff', emissiveIntensity: 1.4, roughness: 0.45 });
  const face = mesh(new THREE.SphereGeometry(1.75, 40, 28), faceMat, head, 0, 1.4, 0);
  face.scale.set(0.92, 1.12, 0.95);
  // a voluminous crown of dark curls
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 1.55 + (i % 3) * 0.12;
    const c = mesh(new THREE.SphereGeometry(0.75, 10, 8), hair, head, Math.sin(a) * r, 1.9 + Math.cos(a * 2) * 0.35, Math.cos(a) * r * 0.85 - 0.35);
    if (Math.cos(a) > 0.7) c.position.y += 0.9;
  }
  // a small invisible handle so the AI can still work the jaw
  const mouth = new THREE.Group();
  mouth.position.set(0, 0.62, 1.4);
  head.add(mouth);
  // cheekbones and a nose give the painted face some shape
  for (const sd of [-1, 1]) mesh(new THREE.SphereGeometry(0.45, 12, 8), faceMat, head, 0.85 * sd, 1.05, 1.1).scale.set(1, 0.6, 0.6);
  const nose = mesh(new THREE.ConeGeometry(0.2, 0.6, 8), skin, head, 0, 1.25, 1.62);
  nose.rotation.x = Math.PI / 2 + 0.3;
  // long hair tendrils flowing back from the head, tipped in fire
  const tipMat = new THREE.MeshStandardMaterial({ color: '#2a0810', emissive: '#ff2040', emissiveIntensity: 0.8, roughness: 0.5 });
  for (let i = 0; i < 12; i++) {
    const a = Math.PI + (i / 11 - 0.5) * 2.4;
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const r = 1.6 + k * 0.7;
      pts.push(new THREE.Vector3(Math.sin(a) * r * 0.9, 2.2 - k * 1.4 + Math.sin(k + i) * 0.4, Math.cos(a) * r * 0.7 - 0.6));
    }
    const strand = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.32 - (i % 3) * 0.05, 6), i % 4 === 0 ? tipMat : hair, head);
    strand.castShadow = false;
  }
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
    for (let k = 0; k < 4; k++) {
      const spike = mesh(new THREE.ConeGeometry(0.28, 2.2 - k * 0.3, 6), gold, sh, s * (0.3 + k * 0.35), 1.4 - k * 0.2, -0.3 + k * 0.2);
      spike.rotation.z = -s * (0.35 + k * 0.25);
    }
    mesh(new THREE.SphereGeometry(0.45, 12, 8), heartMat, sh, s * 0.2, 0.9, 1.1);
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
