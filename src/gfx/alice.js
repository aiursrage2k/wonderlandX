// Adult Alice: smooth, higher-detail model with procedural fabric, hair and
// stocking textures. Faces +Z, feet at y=0, ~1.78 units tall.
// Exposes the pivots player.js animates: body, legs (hips), knees, skirt,
// torso, head, skull, arms[{sh, elbow, hand}], hairChain, fan, fanMat.

import * as THREE from 'three';
import { makeCanvas, makeRng, TAU } from '../engine/util.js';

let T = null; // shared textures + materials

function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function dressTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const rng = makeRng(41);
  x.fillStyle = '#2a4aa6';
  x.fillRect(0, 0, S, S);
  // fine twill weave
  for (let i = -S; i < S * 2; i += 3) {
    x.strokeStyle = `rgba(${rng() < 0.5 ? '10,20,60' : '120,150,230'},0.09)`;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + S * 0.4, S);
    x.stroke();
  }
  // tone-on-tone damask
  x.fillStyle = 'rgba(20,34,110,0.35)';
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      const cx = i * 128 + (j % 2) * 64 + 32;
      const cy = j * 128 + 64;
      x.save();
      x.translate(cx, cy);
      for (let k = 0; k < 4; k++) {
        x.rotate(Math.PI / 2);
        x.beginPath();
        x.ellipse(0, -18, 7, 18, 0, 0, TAU);
        x.fill();
      }
      x.beginPath();
      x.arc(0, 0, 6, 0, TAU);
      x.fill();
      x.restore();
    }
  }
  // wear and grime
  for (let i = 0; i < 300; i++) {
    x.fillStyle = `rgba(0,0,20,${rng() * 0.08})`;
    x.beginPath();
    x.arc(rng() * S, rng() * S, 2 + rng() * 14, 0, TAU);
    x.fill();
  }
  return canvasTex(c, true);
}

function apronTexture() {
  const W = 512;
  const H = 512;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const rng = makeRng(77);
  x.fillStyle = '#efe9df';
  x.fillRect(0, 0, W, H);
  // linen weave
  for (let i = 0; i < W; i += 2) {
    x.fillStyle = `rgba(120,110,90,${rng() * 0.05})`;
    x.fillRect(i, 0, 1, H);
    x.fillRect(0, i, W, 1);
  }
  // lace hem at the bottom (v=0 is the hem on the lathe)
  const hemY = H - 46;
  x.fillStyle = '#f7f3ec';
  x.fillRect(0, hemY, W, 46);
  x.fillStyle = 'rgba(80,60,50,0.55)';
  for (let i = 0; i < W; i += 16) {
    x.beginPath();
    x.arc(i + 8, hemY + 18, 5, 0, TAU);
    x.fill();
    x.beginPath();
    x.arc(i + 8, H - 6, 8, Math.PI, 0);
    x.fill();
  }
  x.fillStyle = '#efe9df';
  for (let i = 0; i < W; i += 16) {
    x.beginPath();
    x.arc(i + 8, hemY + 18, 2.5, 0, TAU);
    x.fill();
  }
  // bloodstains, spatter and a tea ring
  const stain = (cx, cy, r, a) => {
    x.fillStyle = `rgba(${110 + rng() * 40},8,18,${a})`;
    x.beginPath();
    for (let k = 0; k <= 16; k++) {
      const ang = (k / 16) * TAU;
      const rr = r * (0.7 + rng() * 0.5);
      x.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
    }
    x.fill();
    for (let k = 0; k < 14; k++) {
      const ang = rng() * TAU;
      const d = r * (1.1 + rng() * 1.6);
      x.beginPath();
      x.arc(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, 1 + rng() * 4, 0, TAU);
      x.fill();
    }
    // drips
    for (let k = 0; k < 3; k++) {
      const dx = cx + (rng() - 0.5) * r;
      x.fillRect(dx, cy, 3, r * (1 + rng() * 2));
    }
  };
  stain(160, 330, 34, 0.75);
  stain(360, 250, 20, 0.6);
  stain(300, 420, 16, 0.7);
  stain(90, 150, 12, 0.5);
  x.strokeStyle = 'rgba(110,70,30,0.35)';
  x.lineWidth = 4;
  x.beginPath();
  x.arc(400, 120, 26, 0, TAU);
  x.stroke();
  return canvasTex(c);
}

function stockingTexture() {
  const c = makeCanvas(64, 64);
  const x = c.getContext('2d');
  x.fillStyle = '#f2eee8';
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#151018';
  x.fillRect(0, 0, 64, 32);
  const t = canvasTex(c, true);
  t.repeat.set(1, 7);
  return t;
}

function hairTexture() {
  const W = 256;
  const H = 512;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const rng = makeRng(9);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#a87c34');
  g.addColorStop(0.3, '#e2bc6a');
  g.addColorStop(1, '#f2d890');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const px = rng() * W;
    x.strokeStyle = rng() < 0.5 ? `rgba(140,95,30,${0.06 + rng() * 0.14})` : `rgba(255,244,210,${0.06 + rng() * 0.16})`;
    x.lineWidth = 0.6 + rng() * 1.4;
    x.beginPath();
    x.moveTo(px, 0);
    x.bezierCurveTo(px + (rng() - 0.5) * 20, H * 0.3, px + (rng() - 0.5) * 30, H * 0.7, px + (rng() - 0.5) * 20, H);
    x.stroke();
  }
  return canvasTex(c, true);
}

// Alpha for the hair tips: ragged strand ends along the bottom edge.
function hairAlpha() {
  const W = 256;
  const H = 256;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, W, H);
  const rng = makeRng(5);
  x.fillStyle = '#000';
  for (let i = 0; i < W; i += 3) {
    const len = 20 + rng() * 90;
    x.fillRect(i, H - len, 1 + rng() * 2, len);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function assets() {
  if (T) return T;
  const hair = hairTexture();
  T = {
    dress: new THREE.MeshStandardMaterial({ map: dressTexture(), roughness: 0.62, side: THREE.DoubleSide }),
    apron: new THREE.MeshStandardMaterial({ map: apronTexture(), roughness: 0.85, side: THREE.DoubleSide }),
    lace: new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.9, side: THREE.DoubleSide }),
    stocking: new THREE.MeshStandardMaterial({ map: stockingTexture(), roughness: 0.55 }),
    leather: new THREE.MeshPhysicalMaterial({ color: '#0e0a10', roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.25 }),
    skin: new THREE.MeshPhysicalMaterial({ color: '#f5cbb4', roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color('#ffb0a0') }),
    hair: new THREE.MeshStandardMaterial({ map: hair, roughness: 0.38, metalness: 0.05, side: THREE.DoubleSide }),
    hairTips: new THREE.MeshStandardMaterial({ map: hair, alphaMap: hairAlpha(), alphaTest: 0.5, roughness: 0.38, side: THREE.DoubleSide }),
    black: new THREE.MeshStandardMaterial({ color: '#121016', roughness: 0.45 }),
    ribbon: new THREE.MeshPhysicalMaterial({ color: '#0c0a10', roughness: 0.3, sheen: 1, sheenColor: new THREE.Color('#5a4a7a'), side: THREE.DoubleSide }),
    sclera: new THREE.MeshStandardMaterial({ color: '#f6f2ee', roughness: 0.2 }),
    iris: new THREE.MeshStandardMaterial({ color: '#2e6ad0', roughness: 0.15, emissive: '#10306a', emissiveIntensity: 0.6 }),
    pupil: new THREE.MeshBasicMaterial({ color: '#050308' }),
    glint: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    lips: new THREE.MeshPhysicalMaterial({ color: '#a8404e', roughness: 0.35, clearcoat: 0.5 }),
    brow: new THREE.MeshStandardMaterial({ color: '#8a6428', roughness: 0.8 }),
  };
  return T;
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

// A tube strand of hair along a list of points, tapering to a tip.
function strand(parent, pts, r0, mat, axis = 'x') {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, 16, r0, 6, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / 7) / 16;
    const c = curve.getPoint(ring);
    v.fromBufferAttribute(pos, i).sub(c).multiplyScalar(1 - ring * 0.8);
    if (axis === 'x') { v.x *= 1.7; v.z *= 0.6; } else { v.z *= 2.2; v.x *= 0.45; } // ribbon-like lock
    v.add(c);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return add(parent, geo, mat);
}

// Cached geometry that doesn't vary between Alices (there is only ever one,
// but rebuilding on restart shouldn't churn the GPU).
let G = null;
function geometry() {
  if (G) return G;
  G = {};
  // head: a sphere pulled into a jaw and chin
  const head = new THREE.SphereGeometry(0.1, 48, 36);
  const p = head.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    if (y < 0) {
      const k = -y / 0.1;
      x *= 1 - k * 0.32;
      z *= 1 - k * 0.12;
      z += k * 0.01;
    }
    if (z > 0 && y > -0.02 && y < 0.03) z -= 0.004 * (1 - Math.abs(x) / 0.1); // soft eye sockets
    p.setXYZ(i, x * 0.9, y * 1.15, z);
  }
  head.computeVertexNormals();
  G.head = head;

  // torso: hourglass lathe, flattened front-to-back
  const torso = new THREE.LatheGeometry(
    [V2(0.118, -0.02), V2(0.104, 0.07), V2(0.112, 0.15), V2(0.132, 0.22), V2(0.136, 0.27), V2(0.126, 0.33), V2(0.14, 0.38), V2(0.1, 0.42), V2(0.05, 0.445)],
    40,
  );
  torso.scale(1, 1, 0.74);
  G.torso = torso;

  // skirt: bell with gentle folds that deepen toward the hem (hem first → v=0)
  const skirtPts = [V2(0.35, 0.52), V2(0.34, 0.57), V2(0.31, 0.65), V2(0.26, 0.76), V2(0.2, 0.86), V2(0.15, 0.93), V2(0.122, 0.99)];
  const fold = (geo, amp, k) => {
    const q = geo.attributes.position;
    for (let i = 0; i < q.count; i++) {
      const x = q.getX(i);
      const y = q.getY(i);
      const z = q.getZ(i);
      const phi = Math.atan2(x, z);
      const t = Math.max(0, (0.99 - y) / 0.47);
      const f = 1 + amp * t * t * Math.sin(phi * k);
      q.setXYZ(i, x * f, y, z * f);
    }
    geo.computeVertexNormals();
    return geo;
  };
  G.skirt = fold(new THREE.LatheGeometry(skirtPts, 72), 0.07, 11);
  G.petticoat = fold(new THREE.LatheGeometry([V2(0.365, 0.49), V2(0.35, 0.54), V2(0.31, 0.62)], 72), 0.08, 22);
  G.apronSkirt = fold(new THREE.LatheGeometry(skirtPts.slice(0, 6).map((v) => V2(v.x * 1.025 + 0.004, v.y + 0.035)), 36, -0.95, 1.9), 0.07, 11);
  G.apronBib = new THREE.LatheGeometry([V2(0.121, 0.0), V2(0.128, 0.08), V2(0.142, 0.2), V2(0.144, 0.27)], 16, -0.62, 1.24);
  G.apronBib.scale(1.03, 1, 0.78);

  // boots: knee-high shaft + foot
  G.bootShaft = new THREE.LatheGeometry([V2(0.047, -0.44), V2(0.05, -0.36), V2(0.058, -0.2), V2(0.064, -0.13), V2(0.068, -0.1)], 20);
  const foot = new THREE.SphereGeometry(0.05, 20, 14);
  foot.scale(0.95, 0.75, 2.3);
  G.foot = foot;
  return G;
}

export function buildAlice() {
  const M = assets();
  const Gm = geometry();
  const root = new THREE.Group();
  const body = pivot(root);

  // ── legs: hip → knee pivots ──
  const legs = [];
  const knees = [];
  for (const s of [-1, 1]) {
    const hip = pivot(body, s * 0.082, 0.9, 0);
    add(hip, new THREE.CylinderGeometry(0.074, 0.056, 0.44, 20), M.stocking, 0, -0.22, 0);
    const knee = pivot(hip, 0, -0.44, 0);
    add(knee, new THREE.SphereGeometry(0.056, 16, 12), M.stocking);
    add(knee, new THREE.CylinderGeometry(0.054, 0.04, 0.4, 20), M.stocking, 0, -0.2, 0);
    add(knee, Gm.bootShaft, M.leather);
    add(knee, Gm.foot, M.leather, 0, -0.43, 0.05);
    add(knee, new THREE.BoxGeometry(0.05, 0.05, 0.05), M.leather, 0, -0.445, -0.05); // heel
    for (let i = 0; i < 4; i++) add(knee, new THREE.BoxGeometry(0.07, 0.008, 0.01), M.lace, 0, -0.34 + i * 0.05, 0.057); // laces
    legs.push(hip);
    knees.push(knee);
  }

  // ── skirt ──
  const skirt = pivot(body);
  add(skirt, Gm.skirt, M.dress);
  add(skirt, Gm.petticoat, M.lace);
  add(skirt, Gm.apronSkirt, M.apron);

  // ── torso ──
  const torso = pivot(body, 0, 0.98, 0);
  add(torso, Gm.torso, M.dress);
  for (const s of [-1, 1]) {
    const b = add(torso, new THREE.SphereGeometry(0.062, 20, 16), M.dress, s * 0.052, 0.235, 0.052);
    b.scale.set(1, 0.92, 0.78);
  }
  const bib = add(torso, Gm.apronBib, M.apron, 0, 0, 0);
  bib.position.z = 0.004;
  for (const s of [-1, 1]) {
    const strap = add(torso, new THREE.BoxGeometry(0.03, 0.2, 0.012), M.apron, s * 0.075, 0.33, 0.07);
    strap.rotation.x = -0.35;
    const back = add(torso, new THREE.BoxGeometry(0.03, 0.34, 0.012), M.apron, s * 0.07, 0.24, -0.1);
    back.rotation.z = s * 0.12;
  }
  // waist sash + bow at the back
  const sash = add(torso, new THREE.TorusGeometry(0.113, 0.016, 8, 40), M.apron, 0, 0.02, 0);
  sash.rotation.x = Math.PI / 2;
  sash.scale.set(1, 0.76, 1);
  const bow = pivot(torso, 0, 0.03, -0.1);
  for (const s of [-1, 1]) {
    const lobe = add(bow, new THREE.SphereGeometry(0.06, 16, 10), M.apron, s * 0.06, 0.01, -0.01);
    lobe.scale.set(1.3, 0.75, 0.35);
    const tail = add(bow, new THREE.BoxGeometry(0.045, 0.28, 0.008), M.apron, s * 0.03, -0.15, -0.02);
    tail.rotation.z = s * 0.2;
  }
  // collar + choker
  for (const s of [-1, 1]) {
    const col = add(torso, new THREE.CircleGeometry(0.05, 16, 0, Math.PI), M.lace, s * 0.035, 0.41, 0.06);
    col.rotation.set(-1.1, 0, s * 0.5 + Math.PI);
  }
  add(torso, new THREE.CylinderGeometry(0.036, 0.04, 0.1, 16), M.skin, 0, 0.47, 0.005);

  // ── head ──
  const head = pivot(torso, 0, 0.455, 0.005);
  const choker = add(head, new THREE.TorusGeometry(0.038, 0.006, 6, 24), M.ribbon, 0, 0.0, 0);
  choker.rotation.x = Math.PI / 2;
  add(head, new THREE.OctahedronGeometry(0.008), new THREE.MeshStandardMaterial({ color: '#b01830', metalness: 0.6, roughness: 0.2 }), 0, -0.012, 0.04);
  const skull = pivot(head, 0, 0.12, 0.004);
  add(skull, Gm.head, M.skin);
  // eyes
  for (const s of [-1, 1]) {
    const eye = pivot(skull, s * 0.034, 0.014, 0.0905);
    eye.rotation.y = s * 0.12;
    const scl = add(eye, new THREE.SphereGeometry(0.0165, 16, 12), M.sclera);
    scl.scale.set(1.2, 0.52, 0.5);
    add(eye, new THREE.CircleGeometry(0.0074, 20), M.iris, 0, -0.0008, 0.0085);
    add(eye, new THREE.CircleGeometry(0.0034, 16), M.pupil, 0, -0.0008, 0.0088);
    add(eye, new THREE.CircleGeometry(0.0017, 8), M.glint, s * 0.002, 0.0026, 0.0091);
    const lid = add(eye, new THREE.TorusGeometry(0.018, 0.0024, 4, 16, Math.PI), M.black, 0, 0.001, 0.004);
    lid.scale.set(1.15, 0.55, 1);
    lid.rotation.z = s * -0.08;
    const lash = add(eye, new THREE.BoxGeometry(0.009, 0.0026, 0.002), M.black, s * 0.02, 0.006, 0.005);
    lash.rotation.z = s * 0.5;
    const brow = add(skull, new THREE.BoxGeometry(0.03, 0.0045, 0.006), M.brow, s * 0.035, 0.043, 0.096);
    brow.rotation.z = s * -0.12;
  }
  const nose = add(skull, new THREE.SphereGeometry(0.0095, 12, 10), M.skin, 0, -0.01, 0.094);
  nose.scale.set(0.75, 1.9, 0.9);
  nose.rotation.x = -0.35;
  const upper = add(skull, new THREE.SphereGeometry(0.012, 12, 8), M.lips, 0, -0.049, 0.089);
  upper.scale.set(1.5, 0.42, 0.6);
  const lower = add(skull, new THREE.SphereGeometry(0.012, 12, 8), M.lips, 0, -0.056, 0.087);
  lower.scale.set(1.25, 0.5, 0.6);
  for (const s of [-1, 1]) {
    const ear = add(skull, new THREE.SphereGeometry(0.014, 10, 8), M.skin, s * 0.088, 0, 0.0);
    ear.scale.set(0.45, 1.3, 0.9);
  }

  // hair: scalp cap, bangs, face-framing locks, and a swaying back curtain
  const cap = add(skull, new THREE.SphereGeometry(0.104, 40, 24, 0, TAU, 0, 1.75), M.hair, 0, 0.02, -0.01);
  cap.rotation.x = -0.35;
  cap.scale.set(0.95, 1.08, 1.05);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const u = side * (0.25 + i * 0.25);
      strand(skull, [
        [side * 0.006, 0.118, 0.01],
        [u * 0.045, 0.108, 0.07],
        [u * 0.075 + side * 0.012, 0.078, 0.094],
        [u * 0.085 + side * 0.03, 0.045, 0.086],
      ], 0.013, M.hair);
    }
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      strand(skull, [
        [s * 0.075, 0.075, 0.05 - i * 0.02],
        [s * (0.1 + i * 0.008), -0.02, 0.05 - i * 0.02],
        [s * (0.1 + i * 0.01), -0.14, 0.05 - i * 0.02],
        [s * (0.095 + i * 0.012), -0.26, 0.04 + Math.sin(i) * 0.02],
        [s * (0.105 + i * 0.01), -0.34, 0.02],
      ], 0.024, M.hair, 'z');
    }
  }
  const hairChain = [];
  let parent = pivot(skull, 0, 0.02, -0.03);
  const bands = 4;
  for (let i = 0; i < bands; i++) {
    const seg = pivot(parent, 0, i === 0 ? 0 : -0.13, i === 0 ? 0 : -0.006);
    const r0 = 0.112 + i * 0.012;
    const r1 = 0.118 + (i + 1) * 0.012;
    const band = new THREE.LatheGeometry([V2(r1, -0.135), V2((r0 + r1) / 2 + 0.006, -0.065), V2(r0, 0.004)], 28, Math.PI * 0.42, Math.PI * 1.16);
    band.scale(1.05, 1, 0.62 + i * 0.04);
    add(seg, band, i === bands - 1 ? M.hairTips : M.hair, 0, 0, -0.01);
    hairChain.push(seg);
    parent = seg;
  }
  // black ribbon headband with a bow
  const band = add(skull, new THREE.TorusGeometry(0.106, 0.008, 6, 40, Math.PI * 1.05), M.ribbon, 0, 0.03, 0.0);
  band.rotation.set(-0.35, 0, -0.025 * Math.PI);
  const hbow = pivot(skull, 0.05, 0.12, 0.0);
  hbow.rotation.z = -0.35;
  for (const s of [-1, 1]) {
    const lobe = add(hbow, new THREE.ConeGeometry(0.035, 0.07, 12, 1, true), M.ribbon, s * 0.036, 0, 0);
    lobe.rotation.z = s * (Math.PI / 2);
    lobe.scale.set(1, 1, 0.45);
  }
  add(hbow, new THREE.SphereGeometry(0.014, 10, 8), M.ribbon);

  // ── arms ──
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.158, 0.37, 0);
    const puff = add(sh, new THREE.SphereGeometry(0.058, 20, 14), M.dress, s * 0.008, -0.02, 0);
    puff.scale.set(1, 0.95, 0.95);
    const cuff = add(sh, new THREE.TorusGeometry(0.036, 0.007, 6, 18), M.lace, 0, -0.07, 0);
    cuff.rotation.x = Math.PI / 2;
    add(sh, new THREE.CylinderGeometry(0.033, 0.028, 0.27, 16), M.skin, 0, -0.15, 0);
    const elbow = pivot(sh, 0, -0.28, 0);
    add(elbow, new THREE.SphereGeometry(0.028, 12, 10), M.leather);
    add(elbow, new THREE.CylinderGeometry(0.029, 0.022, 0.24, 16), M.leather, 0, -0.12, 0);
    const hand = pivot(elbow, 0, -0.255, 0);
    const palm = add(hand, new THREE.BoxGeometry(0.042, 0.06, 0.022), M.leather, 0, -0.02, 0);
    palm.geometry.translate(0, 0, 0);
    for (let f = 0; f < 4; f++) {
      const fin = add(hand, new THREE.CapsuleGeometry(0.0065, 0.032, 3, 6), M.skin, -0.014 + f * 0.0095, -0.065, 0.003);
      fin.rotation.x = 0.3;
    }
    const th = add(hand, new THREE.CapsuleGeometry(0.007, 0.022, 3, 6), M.skin, s * -0.024, -0.03, 0.012);
    th.rotation.z = s * 0.6;
    arms.push({ sh, elbow, hand });
  }

  // fan of razor cards in the right hand; glows while throwing
  const fan = pivot(arms[1].hand, 0, -0.06, 0.02);
  const fanMat = new THREE.MeshStandardMaterial({ color: '#fff0d4', emissive: '#ffb060', emissiveIntensity: 0.4, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const c = add(fan, new THREE.PlaneGeometry(0.06, 0.088), fanMat);
    c.rotation.set(0.3, 0, -0.55 + i * 0.27);
    c.position.set(-0.02 + i * 0.01, -0.03, 0.004 * i);
  }

  return { root, parts: { body, legs, knees, skirt, torso, head, skull, arms, hairChain, fan, fanMat } };
}
