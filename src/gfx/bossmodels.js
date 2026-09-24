// Hero models for the two humanoid bosses: the Mad Hatter and the Queen of
// Hearts. Same rig contracts as before (the AI drives the same named parts),
// but tailored clothes, faces, fabric textures and props.

import * as THREE from 'three';
import { makeCanvas, makeRng, TAU } from '../engine/util.js';
import { clockFaceTexture } from './textures.js';
import { heartShape } from './thronemodels.js';

function add(parent, g, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
function pivot(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 8;
  return t;
}
const lathe = (pts, seg = 28, a0 = 0, al = TAU) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, a0, al);
function tube(points, r, seg = 24, rs = 6) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), seg, r, rs, false);
}

// ───────────────────────── fabric textures ─────────────────────────
let T = null;
function textures() {
  if (T) return T;
  const rng = makeRng(4242);
  // mustard plaid waistcoat
  const plaid = makeCanvas(128, 128);
  {
    const x = plaid.getContext('2d');
    x.fillStyle = '#a8801e';
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(90,40,10,0.45)';
    for (let i = 0; i < 128; i += 32) {
      x.fillRect(i, 0, 8, 128);
      x.fillRect(0, i, 128, 8);
    }
    x.fillStyle = 'rgba(140,20,30,0.6)';
    for (let i = 16; i < 128; i += 32) {
      x.fillRect(i, 0, 2, 128);
      x.fillRect(0, i, 128, 2);
    }
  }
  // bottle-green velvet with a faint paisley
  const velvet = makeCanvas(256, 256);
  {
    const x = velvet.getContext('2d');
    x.fillStyle = '#2a5a36';
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
      const px = rng() * 256;
      const py = rng() * 256;
      x.strokeStyle = 'rgba(120,160,90,0.18)';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(px, py, 10 + rng() * 6, 0, Math.PI * 1.4);
      x.stroke();
      x.fillStyle = 'rgba(200,170,80,0.18)';
      x.beginPath();
      x.arc(px, py, 3, 0, TAU);
      x.fill();
    }
  }
  // striped trousers
  const stripe = makeCanvas(64, 64);
  {
    const x = stripe.getContext('2d');
    x.fillStyle = '#2a1620';
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#7a2436';
    for (let i = 0; i < 64; i += 16) x.fillRect(i, 0, 7, 64);
    x.fillStyle = 'rgba(220,180,90,0.5)';
    for (let i = 11; i < 64; i += 16) x.fillRect(i, 0, 1, 64);
  }
  // polka dots for the bow tie
  const dots = makeCanvas(64, 64);
  {
    const x = dots.getContext('2d');
    x.fillStyle = '#b01828';
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#f4e8c8';
    for (const [a, b] of [[16, 16], [48, 48], [48, 16], [16, 48]]) {
      x.beginPath();
      x.arc(a, b, 6, 0, TAU);
      x.fill();
    }
  }
  // the famous hat tag
  const tag = makeCanvas(128, 160);
  {
    const x = tag.getContext('2d');
    x.fillStyle = '#efe4c8';
    x.fillRect(0, 0, 128, 160);
    x.strokeStyle = '#6a4a20';
    x.lineWidth = 4;
    x.strokeRect(6, 6, 116, 148);
    x.fillStyle = '#2a1a10';
    x.font = 'italic 20px Georgia, serif';
    x.textAlign = 'center';
    x.fillText('In this', 64, 52);
    x.fillText('style', 64, 76);
    x.font = 'bold 40px Georgia, serif';
    x.fillText('10/6', 64, 122);
  }
  // red damask with little hearts, and black with gold hearts
  const damask = (bg, fg, gold) => {
    const c = makeCanvas(128, 128);
    const x = c.getContext('2d');
    x.fillStyle = bg;
    x.fillRect(0, 0, 128, 128);
    const heart = (cx, cy, s) => {
      x.beginPath();
      x.moveTo(cx, cy + s);
      x.bezierCurveTo(cx - s * 1.2, cy, cx - s, cy - s, cx, cy - s * 0.35);
      x.bezierCurveTo(cx + s, cy - s, cx + s * 1.2, cy, cx, cy + s);
      x.fill();
    };
    x.fillStyle = fg;
    for (const [a, b] of [[32, 32], [96, 96], [96, 32], [32, 96]]) heart(a, b, 9);
    x.strokeStyle = gold;
    x.lineWidth = 1.5;
    for (let i = 0; i < 128; i += 64) {
      x.beginPath();
      x.moveTo(i, 64);
      x.bezierCurveTo(i + 16, 44, i + 48, 44, i + 64, 64);
      x.bezierCurveTo(i + 48, 84, i + 16, 84, i, 64);
      x.stroke();
    }
    return c;
  };
  // stiff lace for the collar (alpha-cut)
  const lace = makeCanvas(256, 256);
  {
    const x = lace.getContext('2d');
    x.clearRect(0, 0, 256, 256);
    x.fillStyle = '#f4ede0';
    x.fillRect(0, 0, 256, 256);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        x.beginPath();
        x.arc(16 + i * 32, 16 + j * 32, 9, 0, TAU);
        x.fill();
      }
    }
    x.globalCompositeOperation = 'source-over';
    x.strokeStyle = '#c9a04a';
    x.lineWidth = 3;
    for (let i = 0; i < 256; i += 32) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i, 256);
      x.stroke();
    }
  }
  // porcelain with painted roses for the teapot
  const porcelain = makeCanvas(256, 128);
  {
    const x = porcelain.getContext('2d');
    x.fillStyle = '#f4efe6';
    x.fillRect(0, 0, 256, 128);
    x.strokeStyle = '#3a5aa0';
    x.lineWidth = 3;
    x.strokeRect(0, 18, 256, 2);
    x.strokeRect(0, 108, 256, 2);
    for (let i = 0; i < 6; i++) {
      const cx = 20 + i * 44;
      x.fillStyle = '#c02a40';
      x.beginPath();
      x.arc(cx, 64, 10, 0, TAU);
      x.fill();
      x.fillStyle = '#3a7a3a';
      x.beginPath();
      x.ellipse(cx + 12, 72, 8, 3, 0.5, 0, TAU);
      x.fill();
    }
  }
  T = {
    plaid: tex(plaid, [2, 2]),
    velvet: tex(velvet, [2, 2]),
    stripe: tex(stripe, [3, 2]),
    dots: tex(dots, [2, 1]),
    tag: tex(tag),
    redDamask: tex(damask('#8a0c18', '#b01828', 'rgba(230,180,90,0.5)'), [3, 3]),
    blackDamask: tex(damask('#140a10', '#c9a04a', 'rgba(200,160,70,0.4)'), [3, 3]),
    lace: tex(lace, [2, 1]),
    porcelain: tex(porcelain),
    clock: clockFaceTexture(),
  };
  return T;
}

// ───────────────────────── The Mad Hatter ─────────────────────────
export function buildMadHatter() {
  const t = textures();
  const S = 2.8;
  const velvet = new THREE.MeshStandardMaterial({ map: t.velvet, roughness: 0.6 });
  const velvetDark = new THREE.MeshStandardMaterial({ color: '#1c3a24', roughness: 0.8, side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a04a', metalness: 0.9, roughness: 0.28 });
  const plaid = new THREE.MeshStandardMaterial({ map: t.plaid, roughness: 0.6 });
  const stripes = new THREE.MeshStandardMaterial({ map: t.stripe, roughness: 0.7 });
  const shoe = new THREE.MeshStandardMaterial({ color: '#1a0e10', roughness: 0.35, metalness: 0.2 });
  const shirt = new THREE.MeshStandardMaterial({ color: '#efe6d4', roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e6d6c8', roughness: 0.5 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#d0581c', roughness: 0.65 });
  const hatMat = new THREE.MeshStandardMaterial({ color: '#2a1a22', roughness: 0.55 });
  const band = new THREE.MeshStandardMaterial({ color: '#8a1428', roughness: 0.5 });
  const dots = new THREE.MeshStandardMaterial({ map: t.dots, roughness: 0.6 });
  const glove = new THREE.MeshStandardMaterial({ color: '#f0e8d8', roughness: 0.6 });
  const porc = new THREE.MeshStandardMaterial({ map: t.porcelain, roughness: 0.2, metalness: 0.05 });
  const root = new THREE.Group();
  const body = pivot(root);

  // legs: striped trousers over spats and curly-toed shoes
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = pivot(body, side * 0.12 * S, 0.95 * S, 0);
    add(hip, lathe([[0.001, -0.9 * S], [0.06 * S, -0.88 * S], [0.068 * S, -0.6 * S], [0.08 * S, -0.3 * S], [0.085 * S, -0.02 * S], [0.001, 0.02 * S]], 14), stripes);
    add(hip, new THREE.CylinderGeometry(0.066 * S, 0.075 * S, 0.12 * S, 12), shirt, 0, -0.86 * S, 0);
    const toe = add(hip, tube([[0, 0, -0.05 * S], [0, 0, 0.14 * S], [0, 0.03 * S, 0.24 * S], [0, 0.09 * S, 0.25 * S]], 0.045 * S, 14, 8), shoe, 0, -0.93 * S, 0);
    toe.scale.x = 1.3;
    add(hip, new THREE.SphereGeometry(0.075 * S, 12, 8), shoe, 0, -0.92 * S, 0).scale.set(1, 0.6, 1.4);
    legs.push(hip);
  }

  const torso = pivot(body, 0, 0.95 * S, 0);
  // plaid waistcoat: narrow waist, puffed chest
  add(torso, lathe([[0.001, 0], [0.19 * S, 0.02 * S], [0.16 * S, 0.22 * S], [0.2 * S, 0.5 * S], [0.23 * S, 0.66 * S], [0.12 * S, 0.8 * S], [0.001, 0.82 * S]], 24), plaid);
  // shirt front and a watch chain looping across the waistcoat
  add(torso, new THREE.PlaneGeometry(0.1 * S, 0.3 * S), shirt, 0, 0.62 * S, 0.215 * S).rotation.x = -0.15;
  add(torso, new THREE.TorusGeometry(0.1 * S, 0.006 * S, 4, 16, Math.PI), gold, 0.04 * S, 0.34 * S, 0.19 * S).rotation.z = Math.PI;
  for (let i = 0; i < 4; i++) add(torso, new THREE.SphereGeometry(0.015 * S, 6, 4), gold, 0, (0.2 + i * 0.11) * S, 0.2 * S);
  // the tailcoat: open at the front, broad in the shoulder, with long split tails
  add(torso, lathe([[0.2 * S, 0.1 * S], [0.19 * S, 0.3 * S], [0.23 * S, 0.55 * S], [0.28 * S, 0.72 * S], [0.14 * S, 0.84 * S]], 24, 0.55, TAU - 1.1), velvet).rotation.y = Math.PI / 2 - 0.0;
  for (const side of [-1, 1]) {
    const tail = add(torso, lathe([[0.2 * S, -0.62 * S], [0.19 * S, -0.2 * S], [0.2 * S, 0.12 * S]], 12, Math.PI + (side > 0 ? 0.05 : -0.95), 0.9), velvetDark);
    tail.rotation.x = 0.12;
    // lapels in gold-edged green
    const lap = new THREE.Shape();
    lap.moveTo(0, 0);
    lap.lineTo(0.07 * S, 0.3 * S);
    lap.lineTo(0.02 * S, 0.34 * S);
    lap.lineTo(-0.01 * S, 0.05 * S);
    const l = add(torso, new THREE.ExtrudeGeometry(lap, { depth: 0.01 * S, bevelEnabled: false }), velvet, side * 0.07 * S, 0.44 * S, 0.2 * S);
    l.scale.x = -side;
    l.rotation.y = side * 0.35;
    // a pocket bristling with cards and a spoon
    if (side < 0) {
      for (let i = 0; i < 3; i++) {
        const c = add(torso, new THREE.PlaneGeometry(0.06 * S, 0.09 * S), shirt, -0.16 * S + i * 0.02 * S, 0.3 * S, 0.19 * S);
        c.rotation.set(-0.3, -0.5, 0.2 - i * 0.2);
      }
    }
  }
  // a huge polka-dot bow tie
  for (const side of [-1, 1]) {
    const lobe = add(torso, new THREE.SphereGeometry(0.1 * S, 12, 8), dots, side * 0.1 * S, 0.76 * S, 0.19 * S);
    lobe.scale.set(1.2, 0.7, 0.4);
  }
  add(torso, new THREE.SphereGeometry(0.04 * S, 8, 6), dots, 0, 0.76 * S, 0.21 * S);

  // head: long, gaunt, with wild hair and huge eyes
  const head = pivot(torso, 0, 1.02 * S, 0);
  add(head, new THREE.CylinderGeometry(0.055 * S, 0.065 * S, 0.14 * S, 10), skin, 0, -0.16 * S, 0);
  const skull = add(head, new THREE.SphereGeometry(0.19 * S, 24, 20), skin);
  skull.scale.set(0.9, 1.18, 0.95);
  const chin = add(head, new THREE.SphereGeometry(0.09 * S, 14, 10), skin, 0, -0.16 * S, 0.06 * S);
  chin.scale.set(1.2, 0.8, 1);
  const nose = add(head, new THREE.ConeGeometry(0.03 * S, 0.14 * S, 8), skin, 0, 0.0, 0.2 * S);
  nose.rotation.x = Math.PI / 2 + 0.25;
  const white = new THREE.MeshStandardMaterial({ color: '#f8f4ee', roughness: 0.2 });
  const pupil = new THREE.MeshBasicMaterial({ color: '#1a0a10' });
  const irisL = new THREE.MeshBasicMaterial({ color: '#40c060' });
  for (const side of [-1, 1]) {
    const eye = add(head, new THREE.SphereGeometry(0.058 * S, 14, 10), white, side * 0.075 * S, 0.06 * S, 0.14 * S);
    eye.scale.set(1, side > 0 ? 1.25 : 0.95, 0.8);
    add(head, new THREE.SphereGeometry(0.022 * S, 10, 8), side > 0 ? irisL : pupil, side * 0.075 * S, 0.06 * S, 0.188 * S);
    const brow = add(head, new THREE.BoxGeometry(0.1 * S, 0.018 * S, 0.02 * S), hairMat, side * 0.08 * S, (side > 0 ? 0.15 : 0.12) * S, 0.17 * S);
    brow.rotation.z = side * (side > 0 ? -0.35 : 0.25);
  }
  // green monocle over the right eye
  add(head, new THREE.TorusGeometry(0.064 * S, 0.008 * S, 6, 20), gold, 0.075 * S, 0.06 * S, 0.2 * S);
  add(head, new THREE.CircleGeometry(0.06 * S, 20), new THREE.MeshBasicMaterial({ color: '#80ff90', transparent: true, opacity: 0.25 }), 0.075 * S, 0.06 * S, 0.205 * S);
  // the manic grin: a wide arc of teeth
  const grin = add(head, new THREE.TorusGeometry(0.1 * S, 0.028 * S, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: '#2a0808' }), 0, -0.02 * S, 0.14 * S);
  grin.rotation.z = Math.PI;
  grin.scale.set(1.1, 0.7, 0.6);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + 0.25 + (i / 8) * (Math.PI - 0.5);
    add(head, new THREE.BoxGeometry(0.022 * S, 0.026 * S, 0.02 * S), white, Math.cos(a) * 0.11 * S, -0.02 * S + Math.sin(a) * 0.075 * S, 0.19 * S - Math.abs(Math.cos(a)) * 0.04 * S);
  }
  // a shock of orange hair spilling out under the hat
  const hrng = makeRng(99);
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * 0.95 + (i / 25) * Math.PI * 1.9 + Math.PI / 2;
    const r = 0.17 * S;
    const clump = add(head, new THREE.ConeGeometry(0.05 * S, (0.2 + hrng() * 0.14) * S, 6), hairMat, Math.sin(a) * r, (0.02 + hrng() * 0.12) * S, Math.cos(a) * r - 0.03 * S);
    clump.lookAt(head.position.clone().add(new THREE.Vector3(Math.sin(a) * 3, -1 + hrng(), Math.cos(a) * 3 - 0.5)));
    clump.rotateX(Math.PI / 2);
    if (Math.cos(a) > 0.55) clump.visible = false;
  }

  // the hat: tall, flared, crooked, with the 10/6 tag and a peacock feather
  const hat = pivot(head, 0, 0.19 * S, -0.02 * S);
  hat.rotation.z = -0.14;
  hat.rotation.x = -0.08;
  const hs = S * 0.95;
  add(hat, lathe([[0.001, 0], [0.3 * hs, -0.005 * hs], [0.37 * hs, 0.0], [0.41 * hs, 0.05 * hs], [0.4 * hs, 0.08 * hs], [0.36 * hs, 0.03 * hs], [0.29 * hs, 0.03 * hs], [0.001, 0.03 * hs]], 32), hatMat);
  add(hat, lathe([[0.26 * hs, 0.02 * hs], [0.25 * hs, 0.2 * hs], [0.28 * hs, 0.5 * hs], [0.33 * hs, 0.72 * hs], [0.001, 0.73 * hs]], 28), hatMat);
  add(hat, new THREE.CylinderGeometry(0.262 * hs, 0.258 * hs, 0.11 * hs, 28, 1, true), band, 0, 0.1 * hs, 0);
  const tg = add(hat, new THREE.PlaneGeometry(0.14 * hs, 0.18 * hs), new THREE.MeshStandardMaterial({ map: t.tag, roughness: 0.8, side: THREE.DoubleSide }), 0.12 * hs, 0.22 * hs, 0.24 * hs);
  tg.rotation.set(0, 0.45, 0.2);
  const feather = add(hat, tube([[-0.22 * hs, 0.12 * hs, -0.05 * hs], [-0.3 * hs, 0.4 * hs, -0.12 * hs], [-0.26 * hs, 0.7 * hs, -0.22 * hs], [-0.16 * hs, 0.9 * hs, -0.3 * hs]], 0.012 * hs, 16, 5), new THREE.MeshStandardMaterial({ color: '#2a8a6a', roughness: 0.5 }));
  void feather;
  add(hat, new THREE.SphereGeometry(0.04 * hs, 10, 8), new THREE.MeshStandardMaterial({ color: '#2060c0', emissive: '#1030a0', emissiveIntensity: 0.6 }), -0.17 * hs, 0.9 * hs, -0.3 * hs);
  // a patch and a pin of needles
  add(hat, new THREE.PlaneGeometry(0.1 * hs, 0.08 * hs), new THREE.MeshStandardMaterial({ color: '#5a3a2a', roughness: 0.9, side: THREE.DoubleSide }), -0.1 * hs, 0.5 * hs, 0.29 * hs).rotation.set(-0.1, -0.35, 0.2);

  // arms: coat sleeves, lace cuffs, white gloves
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = pivot(torso, side * 0.27 * S, 0.68 * S, 0);
    add(sh, new THREE.SphereGeometry(0.09 * S, 12, 8), velvet);
    add(sh, new THREE.CylinderGeometry(0.075 * S, 0.06 * S, 0.55 * S, 12), velvet, 0, -0.27 * S, 0);
    const el = pivot(sh, 0, -0.55 * S, 0);
    add(el, new THREE.CylinderGeometry(0.062 * S, 0.075 * S, 0.46 * S, 12), velvet, 0, -0.23 * S, 0);
    add(el, new THREE.CylinderGeometry(0.1 * S, 0.075 * S, 0.1 * S, 12, 1, true), shirt, 0, -0.46 * S, 0);
    const hand = pivot(el, 0, -0.53 * S, 0);
    add(hand, new THREE.SphereGeometry(0.065 * S, 12, 8), glove).scale.set(1, 1.2, 0.8);
    for (let k = 0; k < 4; k++) add(hand, new THREE.CylinderGeometry(0.012 * S, 0.01 * S, 0.08 * S, 5), glove, (k - 1.5) * 0.025 * S, -0.07 * S, 0.02 * S);
    arms.push({ sh, el, hand });
  }
  // a painted teapot in the right hand
  const pot = pivot(arms[1].hand, 0, -0.14 * S, 0.06 * S);
  add(pot, new THREE.SphereGeometry(0.14 * S, 18, 14), porc).scale.y = 0.82;
  const spout = add(pot, tube([[0.1 * S, -0.02 * S, 0], [0.18 * S, 0.02 * S, 0], [0.24 * S, 0.1 * S, 0]], 0.022 * S, 10, 6), porc);
  void spout;
  add(pot, new THREE.TorusGeometry(0.07 * S, 0.014 * S, 6, 14, Math.PI * 1.2), porc, -0.14 * S, 0.02 * S, 0).rotation.z = Math.PI * 0.4;
  add(pot, new THREE.CylinderGeometry(0.07 * S, 0.09 * S, 0.04 * S, 16), porc, 0, 0.12 * S, 0);
  add(pot, new THREE.SphereGeometry(0.022 * S, 8, 6), gold, 0, 0.155 * S, 0);
  // a pocket watch swinging from the left
  const watch = pivot(arms[0].hand, 0, -0.05 * S, 0);
  add(watch, new THREE.CylinderGeometry(0.004 * S, 0.004 * S, 0.4 * S, 4), gold, 0, -0.2 * S, 0);
  const w = add(watch, new THREE.CylinderGeometry(0.16 * S, 0.16 * S, 0.04 * S, 28), gold, 0, -0.5 * S, 0);
  w.rotation.x = Math.PI / 2;
  add(watch, new THREE.CircleGeometry(0.14 * S, 28), new THREE.MeshStandardMaterial({ map: t.clock, emissive: '#ffcf8a', emissiveMap: t.clock, emissiveIntensity: 0.4, roughness: 0.4 }), 0, -0.5 * S, 0.022 * S);
  const watchGlow = new THREE.MeshBasicMaterial({ color: '#ffcc60', transparent: true, opacity: 0 });
  add(watch, new THREE.CircleGeometry(0.2 * S, 28), watchGlow, 0, -0.5 * S, 0.03 * S).castShadow = false;
  return { root, parts: { body, legs, torso, head, hat, arms, pot, watch, watchGlow } };
}

// ───────────────────────── The Queen of Hearts ─────────────────────────
export function buildQueen() {
  const t = textures();
  const S = 2.4;
  const root = new THREE.Group();
  const body = pivot(root);
  const redD = new THREE.MeshStandardMaterial({ map: t.redDamask, roughness: 0.45, metalness: 0.1 });
  const blackD = new THREE.MeshStandardMaterial({ map: t.blackDamask, roughness: 0.4, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d2a64c', metalness: 0.95, roughness: 0.25 });
  const skin = new THREE.MeshStandardMaterial({ color: '#f4e4e4', roughness: 0.45 });
  const hair = new THREE.MeshStandardMaterial({ color: '#1a0a10', roughness: 0.55 });
  const lace = new THREE.MeshStandardMaterial({ map: t.lace, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 });
  const heartMat = new THREE.MeshStandardMaterial({ color: '#ff2a40', emissive: '#ff1030', emissiveIntensity: 1.5, roughness: 0.2 });
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(1), { depth: 0.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -0.12);

  // the gown: a bell of alternating red and black damask panels with gold seams
  const gown = pivot(body);
  const prof = [[0.02, 0], [0.98, 0.02], [0.97, 0.08], [0.88, 0.3], [0.7, 0.62], [0.5, 0.92], [0.34, 1.12], [0.27, 1.25], [0, 1.26]].map(([r, y]) => [r * S, y * S]);
  const panels = 10;
  for (let i = 0; i < panels; i++) {
    add(gown, lathe(prof, 6, (i / panels) * TAU, TAU / panels), i % 2 ? redD : blackD);
    const a = (i / panels) * TAU;
    const seam = add(gown, tube(prof.slice(1, 7).map(([r, y]) => [Math.sin(a) * (r + 0.01), y, Math.cos(a) * (r + 0.01)]), 0.018 * S, 12, 4), gold);
    void seam;
  }
  // gold hem band, scalloped ruffle, and a heart apron at the front
  add(gown, new THREE.TorusGeometry(0.975 * S, 0.04 * S, 6, 64), gold, 0, 0.06 * S, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    const r = add(gown, new THREE.SphereGeometry(0.075 * S, 8, 6), i % 2 ? redD : blackD, Math.sin(a) * 0.99 * S, 0.02 * S, Math.cos(a) * 0.99 * S);
    r.scale.set(1, 0.5, 1);
  }
  add(gown, new THREE.TorusGeometry(0.3 * S, 0.03 * S, 6, 32), gold, 0, 1.18 * S, 0).rotation.x = Math.PI / 2;
  const apron = add(gown, heartGeo, heartMat, 0, 0.5 * S, 0.83 * S);
  apron.scale.set(0.2 * S, 0.2 * S, 0.1 * S);
  apron.rotation.x = -0.5;

  const torso = pivot(body, 0, 1.2 * S, 0);
  // corseted bodice with a gold stomacher
  add(torso, lathe([[0.001, 0], [0.24 * S, 0.02 * S], [0.2 * S, 0.2 * S], [0.25 * S, 0.4 * S], [0.22 * S, 0.5 * S], [0.1 * S, 0.56 * S], [0.001, 0.57 * S]], 24), redD);
  const stom = new THREE.Shape();
  stom.moveTo(-0.1 * S, 0.45 * S);
  stom.lineTo(0.1 * S, 0.45 * S);
  stom.lineTo(0, -0.02 * S);
  add(torso, new THREE.ExtrudeGeometry(stom, { depth: 0.01 * S, bevelEnabled: false }), gold, 0, 0, 0.215 * S).rotation.x = -0.08;
  // puffed shoulders
  for (const side of [-1, 1]) {
    const puff = add(torso, new THREE.SphereGeometry(0.095 * S, 14, 10), side > 0 ? redD : blackD, side * 0.27 * S, 0.44 * S, 0);
    puff.scale.set(1, 0.9, 1);
  }
  // towering lace collar fanning behind her head
  const collar = pivot(torso, 0, 0.52 * S, -0.08 * S);
  for (let i = 0; i < 11; i++) {
    const a = -1.35 + (i / 10) * 2.7;
    const p = add(collar, new THREE.PlaneGeometry(0.2 * S, 0.62 * S), lace, Math.sin(a) * 0.26 * S, 0.26 * S + Math.cos(a) * 0.05 * S, -Math.cos(a) * 0.06 * S);
    p.geometry.translate(0, 0, 0);
    p.rotation.set(-0.4, a * 0.5, -a * 0.85);
    p.castShadow = false;
  }
  add(collar, new THREE.TorusGeometry(0.34 * S, 0.012 * S, 4, 32, Math.PI * 0.95), gold, 0, 0.3 * S, -0.05 * S).rotation.z = Math.PI * 0.025;

  // the head: pale, rouged, furious — and an enormous black beehive
  const head = pivot(torso, 0, 0.62 * S, 0.02 * S);
  add(head, new THREE.CylinderGeometry(0.06 * S, 0.075 * S, 0.12 * S, 10), skin, 0, -0.04 * S, 0);
  const face = add(head, new THREE.SphereGeometry(0.19 * S, 22, 18), skin, 0, 0.12 * S, 0);
  face.scale.set(1.05, 1.08, 1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff2030' });
  const rouge = new THREE.MeshStandardMaterial({ color: '#e06070', roughness: 0.6, transparent: true, opacity: 0.55 });
  const lips = new THREE.MeshStandardMaterial({ color: '#b00818', roughness: 0.3 });
  for (const side of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.035 * S, 10, 8), new THREE.MeshStandardMaterial({ color: '#1a0810' }), side * 0.07 * S, 0.15 * S, 0.16 * S).scale.set(1.3, 0.8, 0.5);
    add(head, new THREE.SphereGeometry(0.016 * S, 8, 6), eyeMat, side * 0.07 * S, 0.15 * S, 0.18 * S);
    const brow = add(head, new THREE.BoxGeometry(0.09 * S, 0.016 * S, 0.02 * S), hair, side * 0.075 * S, 0.21 * S, 0.165 * S);
    brow.rotation.z = side * 0.4;
    add(head, new THREE.CircleGeometry(0.04 * S, 14), rouge, side * 0.11 * S, 0.07 * S, 0.165 * S).rotation.y = side * 0.5;
  }
  // heart-shaped lips, pursed in a snarl
  const mouth = add(head, heartGeo, lips, 0, 0.03 * S, 0.18 * S);
  mouth.scale.set(0.045 * S, 0.03 * S, 0.05 * S);
  mouth.rotation.z = Math.PI;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const c = add(head, new THREE.SphereGeometry(0.1 * S, 10, 8), hair, Math.sin(a) * 0.14 * S, 0.3 * S + Math.cos(a * 2) * 0.03 * S, Math.cos(a) * 0.12 * S - 0.04 * S);
    c.scale.set(1, 1.1, 1);
  }
  add(head, new THREE.SphereGeometry(0.17 * S, 14, 12), hair, 0, 0.44 * S, -0.04 * S).scale.set(1, 1.3, 1);
  // crown of heart points, with rubies
  const crown = pivot(head, 0, 0.5 * S, 0.02 * S);
  add(crown, new THREE.CylinderGeometry(0.12 * S, 0.11 * S, 0.06 * S, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#d2a64c', metalness: 0.95, roughness: 0.25, side: THREE.DoubleSide }));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const pt = add(crown, heartGeo, gold, Math.sin(a) * 0.12 * S, 0.07 * S, Math.cos(a) * 0.12 * S);
    pt.scale.setScalar(0.04 * S);
    pt.rotation.set(0, a, Math.PI);
    add(crown, new THREE.SphereGeometry(0.014 * S, 6, 4), heartMat, Math.sin(a) * 0.121 * S, 0.0, Math.cos(a) * 0.121 * S);
  }

  // arms: puffed sleeves, gloves; the right holds the heart scepter
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = pivot(torso, side * 0.3 * S, 0.44 * S, 0);
    add(sh, new THREE.CylinderGeometry(0.055 * S, 0.05 * S, 0.34 * S, 12), side > 0 ? blackD : redD, 0, -0.18 * S, 0);
    const el = pivot(sh, 0, -0.36 * S, 0);
    add(el, new THREE.CylinderGeometry(0.048 * S, 0.042 * S, 0.3 * S, 12), new THREE.MeshStandardMaterial({ color: '#1a0a10', roughness: 0.4 }), 0, -0.15 * S, 0);
    add(el, new THREE.CylinderGeometry(0.08 * S, 0.05 * S, 0.06 * S, 12, 1, true), lace, 0, -0.02 * S, 0);
    const hand = pivot(el, 0, -0.33 * S, 0);
    add(hand, new THREE.SphereGeometry(0.045 * S, 10, 8), new THREE.MeshStandardMaterial({ color: '#1a0a10', roughness: 0.4 })).scale.set(1, 1.2, 0.8);
    arms.push({ sh, el, hand });
  }
  const scepter = pivot(arms[1].hand, 0, 0, 0.02 * S);
  add(scepter, new THREE.CylinderGeometry(0.018 * S, 0.018 * S, 0.9 * S, 8), gold, 0, 0.2 * S, 0);
  for (let k = 0; k < 3; k++) add(scepter, new THREE.TorusGeometry(0.03 * S, 0.008 * S, 4, 12), gold, 0, (0.05 + k * 0.25) * S, 0).rotation.x = Math.PI / 2;
  const top = add(scepter, heartGeo, heartMat, 0, 0.74 * S, 0);
  top.scale.setScalar(0.1 * S);
  add(scepter, new THREE.TorusGeometry(0.12 * S, 0.01 * S, 4, 24), gold, 0, 0.74 * S, 0);
  return { root, parts: { body, gown, torso, head, arms, scepter, heartMat } };
}
