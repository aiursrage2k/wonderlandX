// Every model is built from primitives. World materials are rendered grey by
// the noir patch; only Sally's red and the Syndicate's colors survive (keep).
import * as THREE from 'three';
import { nmat, noirify, NU } from './paint.js';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cone: new THREE.CylinderGeometry(0.25, 0.5, 1, 16),
  sph: new THREE.SphereGeometry(0.5, 16, 12),
  wheel: new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16),
};

export function part(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

const SKIN = 0xc9beb2;

// ---------------------------------------------------------------- flask
export function makeFlask(scale = 1) {
  const g = new THREE.Group();
  const steel = nmat(0xd8d8d8, { kind: 'std', rough: 0.22, metal: 0.95 });
  const body = part(G.cyl, steel, 0, 0.32, 0, 0.42, 0.62, 0.16, g);
  body.rotation.y = 0;
  part(G.cyl, steel, 0, 0.7, 0, 0.12, 0.12, 0.1, g);
  part(G.cyl, nmat(0x555555, { kind: 'std', rough: 0.4, metal: 0.8 }), 0, 0.79, 0, 0.14, 0.08, 0.14, g);
  part(G.box, nmat(0x3a3029), 0, 0.33, 0.085, 0.3, 0.3, 0.01, g); // leather wrap
  g.scale.setScalar(scale);
  return g;
}

// ---------------------------------------------------------------- detective
export function makeDetective() {
  const root = new THREE.Group();
  const coat = nmat(0x7a7064);
  const coatDark = nmat(0x5b5349);
  const hat = nmat(0x2b2926);
  const shoe = nmat(0x161616, { kind: 'std', rough: 0.35 });
  const skin = nmat(SKIN);
  const metal = nmat(0x2a2a2a, { kind: 'std', rough: 0.4, metal: 0.8 });
  const legL = pivot(root, -0.17, 1.0, 0), legR = pivot(root, 0.17, 1.0, 0);
  for (const l of [legL, legR]) {
    part(G.cyl, nmat(0x3b3a38), 0, -0.48, 0, 0.2, 0.95, 0.2, l);
    part(G.box, shoe, 0, -0.95, 0.07, 0.2, 0.12, 0.34, l);
  }
  // long trench coat, open skirt + torso
  part(G.cone, coat, 0, 1.15, 0, 1.15, 0.8, 0.95, root);
  part(G.cyl, coat, 0, 1.62, 0, 0.78, 0.62, 0.62, root);
  part(G.box, coatDark, 0, 1.38, 0, 0.82, 0.08, 0.66, root); // belt
  part(G.box, coatDark, 0, 1.86, 0.18, 0.5, 0.18, 0.2, root); // lapels / collar up
  part(G.box, coatDark, 0, 1.95, -0.05, 0.62, 0.25, 0.42, root);
  const head = pivot(root, 0, 2.12, 0);
  part(G.sph, skin, 0, 0, 0, 0.36, 0.42, 0.38, head);
  part(G.box, nmat(0x8f857a), 0, -0.08, 0.17, 0.2, 0.1, 0.05, head); // stubble jaw
  part(G.cyl, hat, 0, 0.14, 0, 0.78, 0.04, 0.78, head);
  part(G.cyl, hat, 0, 0.27, 0, 0.44, 0.24, 0.44, head);
  part(G.cyl, nmat(0x111111), 0, 0.19, 0, 0.45, 0.06, 0.45, head);
  part(G.box, nmat(0xffffff, { kind: 'basic' }), 0.05, -0.1, 0.2, 0.12, 0.012, 0.012, head); // cigarette
  const armL = pivot(root, -0.42, 1.85, 0), armR = pivot(root, 0.42, 1.85, 0);
  for (const a of [armL, armR]) {
    part(G.cyl, coat, 0, -0.32, 0, 0.18, 0.66, 0.18, a);
    part(G.sph, skin, 0, -0.68, 0, 0.14, 0.14, 0.14, a);
  }
  armR.rotation.x = -1.45; armL.rotation.x = -0.25; armL.rotation.z = -0.15;
  // the big red revolver: the only red thing Mack owns
  const red = nmat(0xc8102e, { kind: 'std', rough: 0.25, metal: 0.55, keep: 1, paint: false, emissive: 0x4a0006, ei: 1 });
  const redDark = nmat(0x7a0814, { kind: 'std', rough: 0.35, metal: 0.5, keep: 1, paint: false });
  const gun = pivot(root, 0.42, 1.78, 0.68);
  part(G.cyl, red, 0, 0.05, 0.42, 0.13, 0.85, 0.13, gun).rotation.x = Math.PI / 2; // long barrel
  part(G.box, red, 0, -0.04, 0.38, 0.09, 0.08, 0.7, gun); // under-lug
  part(G.box, red, 0, 0.13, 0.42, 0.03, 0.05, 0.75, gun); // rib
  part(G.cyl, redDark, 0, 0.0, -0.02, 0.32, 0.26, 0.32, gun).rotation.x = Math.PI / 2; // cylinder
  part(G.box, red, 0, 0.02, -0.12, 0.14, 0.26, 0.4, gun); // frame
  part(G.box, redDark, 0, 0.14, -0.3, 0.05, 0.1, 0.1, gun).rotation.x = -0.6; // hammer
  const grip = part(G.box, nmat(0x151010, { kind: 'std', rough: 0.5 }), 0, -0.22, -0.3, 0.12, 0.42, 0.16, gun);
  grip.rotation.x = 0.35;
  part(G.box, red, 0, 0.17, 0.82, 0.03, 0.05, 0.04, gun); // front sight
  gun.scale.setScalar(1.35);
  const muzzle = pivot(gun, 0, 0.05, 0.9);
  // the flask on his hip, always
  const flask = makeFlask(0.42);
  flask.position.set(0.42, 1.2, 0.05);
  flask.rotation.y = Math.PI / 2;
  root.add(flask);
  return { root, legL, legR, armL, armR, head, gun, muzzle, flask, walk: 0 };
}

// ---------------------------------------------------------------- Sally
export function makeSally() {
  const root = new THREE.Group();
  const red = nmat(0xd0102a, { kind: 'std', rough: 0.45, keep: 1, paint: false });
  const redDark = nmat(0x8a0a1c, { keep: 1, paint: false });
  const skin = nmat(0xd8cfc6);
  const hair = nmat(0x0c0c0c, { kind: 'std', rough: 0.3 });
  const glove = nmat(0x101010);
  const legL = pivot(root, -0.12, 0.85, 0), legR = pivot(root, 0.12, 0.85, 0);
  for (const l of [legL, legR]) {
    part(G.cyl, skin, 0, -0.42, 0, 0.13, 0.84, 0.13, l);
    part(G.box, redDark, 0, -0.84, 0.05, 0.12, 0.12, 0.26, l); // red heels
  }
  // the red dress: flared skirt, fitted bodice
  part(G.cone, red, 0, 1.0, 0, 1.05, 0.75, 0.9, root);
  part(G.cyl, red, 0, 1.5, 0, 0.56, 0.58, 0.44, root);
  part(G.sph, red, 0, 1.75, 0.02, 0.6, 0.28, 0.46, root);
  const head = pivot(root, 0, 2.02, 0);
  part(G.cyl, skin, 0, -0.14, 0, 0.12, 0.16, 0.12, head);
  part(G.sph, skin, 0, 0.04, 0, 0.32, 0.38, 0.33, head);
  part(G.sph, hair, 0, 0.1, -0.04, 0.4, 0.38, 0.4, head); // bob
  part(G.box, hair, 0, -0.04, -0.06, 0.42, 0.22, 0.32, head);
  part(G.box, red, 0, -0.06, 0.165, 0.08, 0.03, 0.02, head); // lips
  part(G.sph, red, 0.16, 0.2, 0.05, 0.12, 0.08, 0.12, head); // flower in hair
  const armL = pivot(root, -0.32, 1.72, 0), armR = pivot(root, 0.32, 1.72, 0);
  for (const a of [armL, armR]) {
    part(G.cyl, skin, 0, -0.2, 0, 0.12, 0.4, 0.12, a);
    part(G.cyl, glove, 0, -0.52, 0, 0.12, 0.34, 0.12, a); // opera gloves
  }
  armR.rotation.x = -0.9; armL.rotation.x = -1.4; armL.rotation.z = 0.3;
  // rocket launcher on her shoulder
  const launcher = pivot(root, 0.3, 1.95, 0.1);
  const tube = nmat(0x3c3f3a, { kind: 'std', rough: 0.5, metal: 0.4 });
  part(G.cyl, tube, 0, 0, 0, 0.26, 1.5, 0.26, launcher).rotation.x = Math.PI / 2;
  part(G.cyl, nmat(0x222222), 0, 0, 0.75, 0.32, 0.1, 0.32, launcher).rotation.x = Math.PI / 2;
  part(G.box, tube, 0, -0.18, 0.1, 0.08, 0.25, 0.1, launcher);
  part(G.sph, red, 0, 0, 0.8, 0.18, 0.18, 0.1, launcher); // a red rocket peeking out
  const muzzle = pivot(launcher, 0, 0, 0.85);
  return { root, legL, legR, armL, armR, head, launcher, muzzle, walk: 0 };
}

// ---------------------------------------------------------------- Syndicate
export const GANG_COLORS = ['#ff2d95', '#18e0ff', '#ffe11a', '#62ff2e', '#ff7a12', '#a64bff'];
const greyCache = new Map();
export function gangMat(color) {
  return nmat(color, { kind: 'std', rough: 0.5, keep: 1, paint: false, emissive: color, ei: 0.18 });
}
export function drainedMat(src) {
  // the same material, color washed out of it
  const key = src.uuid;
  if (!greyCache.has(key)) {
    const c = src.customProgramCacheKey && src.customProgramCacheKey() === 'rainbowcoat' ? new THREE.Color(0x6a6a6a) : src.color.clone();
    const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    greyCache.set(key, nmat(new THREE.Color(l, l, l).getHex(), {}));
  }
  return greyCache.get(key);
}

export function makeGangster(color, kind = 'hood', scale = 1) {
  const root = new THREE.Group();
  const suit = gangMat(color);
  const accent = gangMat(GANG_COLORS[(GANG_COLORS.indexOf(color) + 2) % GANG_COLORS.length] || '#ffffff');
  const dark = nmat(0x141414);
  const skin = nmat(0xb9aea2);
  const legL = pivot(root, -0.2, 1.0, 0), legR = pivot(root, 0.2, 1.0, 0);
  for (const l of [legL, legR]) {
    part(G.cone, suit, 0, -0.47, 0, 0.36, 0.95, 0.36, l).rotation.x = Math.PI; // zoot pegs
    part(G.box, dark, 0, -0.95, 0.06, 0.2, 0.12, 0.34, l);
  }
  part(G.cyl, suit, 0, 1.45, 0, 0.86, 1.05, 0.62, root); // long zoot jacket
  part(G.box, accent, 0, 1.62, 0.3, 0.16, 0.6, 0.04, root); // loud tie
  const head = pivot(root, 0, 2.18, 0);
  part(G.sph, skin, 0, 0, 0, 0.36, 0.42, 0.38, head);
  part(G.box, accent, 0, 0.04, 0.17, 0.36, 0.1, 0.05, head); // painted mask stripe
  part(G.cyl, suit, 0, 0.15, 0, 0.92, 0.04, 0.92, head);
  part(G.cyl, suit, 0, 0.3, 0, 0.46, 0.28, 0.46, head);
  part(G.box, accent, 0.18, 0.4, -0.05, 0.04, 0.4, 0.12, head).rotation.z = -0.5; // feather
  const armL = pivot(root, -0.48, 1.88, 0), armR = pivot(root, 0.48, 1.88, 0);
  for (const a of [armL, armR]) {
    part(G.cyl, suit, 0, -0.34, 0, 0.22, 0.7, 0.22, a);
    part(G.sph, skin, 0, -0.72, 0, 0.14, 0.14, 0.14, a);
  }
  armR.rotation.x = -1.2;
  const tool = pivot(armR, 0, -0.75, 0.1);
  if (kind === 'dauber') {
    part(G.cyl, gangMat(color), 0, 0, 0.12, 0.16, 0.42, 0.16, tool).rotation.x = Math.PI / 2;
    part(G.cyl, dark, 0, 0, 0.36, 0.06, 0.08, 0.06, tool).rotation.x = Math.PI / 2;
    const bucket = part(G.cyl, accent, 0, -0.18, 0, 0.36, 0.36, 0.36);
    armL.add(bucket); bucket.position.set(0, -0.86, 0);
  } else if (kind === 'roller') {
    part(G.cyl, dark, 0, -0.1, 0.8, 0.08, 1.6, 0.08, tool).rotation.x = Math.PI / 2.4;
    const r = part(G.cyl, accent, 0, -0.75, 1.5, 0.5, 2.0, 0.5, tool);
    r.rotation.z = Math.PI / 2;
    armL.rotation.x = -1.2;
  } else {
    part(G.box, dark, 0, 0, 0.25, 0.1, 0.16, 0.5, tool); // pistol
  }
  const muzzle = pivot(tool, 0, 0, 0.55);
  root.scale.setScalar(scale);
  return { root, legL, legR, armL, armR, head, tool, muzzle, walk: 0, color };
}

export function drainModel(model) {
  model.root.traverse((o) => {
    if (o.isMesh && o.material.color) o.material = drainedMat(o.material);
  });
}

// The Prism King: a tall figure whose head is a spinning prism.
export function makePrismKing() {
  const m = makeGangster('#ffffff', 'hood', 2.6);
  const head = m.head;
  head.clear();
  const prismMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.6, flatShading: true });
  noirify(prismMat, { keep: 1, paint: false });
  prismMat.onBeforeCompile = ((orig) => (sh) => {
    orig(sh);
    sh.fragmentShader = sh.fragmentShader.replace('outgoingLight = ncol;', `ncol = mix(ncol, 0.6 + 0.6 * cos(6.2831 * (vNW.y * 0.35 + vNW.x * 0.1 + vec3(0.0, 0.33, 0.67))), 0.75); outgoingLight = ncol;`);
  })(prismMat.onBeforeCompile);
  prismMat.customProgramCacheKey = () => 'prismking';
  const prism = part(new THREE.OctahedronGeometry(0.55, 0), prismMat, 0, 0.15, 0, 1, 1.4, 1, head);
  const cape = part(G.cone, gangMat('#a64bff'), 0, 1.2, -0.25, 1.4, 1.6, 0.6, m.root);
  cape.rotation.x = 0.1;
  m.prism = prism;
  m.root.traverse((o) => { if (o.isMesh && o !== prism && o.material.color && o.material.color.getHex() === 0xffffff) o.material = gangMat('#ff2d95'); });
  return m;
}

// ---------------------------------------------------------------- cars
// Mack's ride: a black '41 Packard. Long hood, swooping pontoon fenders,
// running boards, whitewalls and a big chrome grille.
export function makePackard() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const lights = [];
  const black = nmat(0x0d0d0f, { kind: 'std', rough: 0.12, metal: 0.7 });
  const chrome = nmat(0xf0f0f0, { kind: 'std', rough: 0.06, metal: 1 });
  const glass = nmat(0x0a0c10, { kind: 'std', rough: 0.03, metal: 0.95 });
  const tire = nmat(0x0c0c0c, { rough: 0.9 });
  const white = nmat(0xf4f2ec, { kind: 'std', rough: 0.4 });
  const sph = G.sph, box = G.box, cyl = G.cyl;
  // main tub and the long, narrow hood
  part(box, black, 0, 0.82, -0.9, 1.9, 0.62, 3.6, body);
  const hood = part(cyl, black, 0, 1.0, 1.55, 1.3, 2.3, 0.62, body); hood.rotation.x = Math.PI / 2; hood.scale.set(1.3, 2.3, 0.62);
  part(box, black, 0, 0.82, 1.55, 1.3, 0.5, 2.3, body);
  part(box, chrome, 0, 1.32, 1.55, 0.05, 0.03, 2.3, body); // hood centre strip
  // cabin with a rounded roof and split windscreen
  part(box, black, 0, 1.45, -0.95, 1.78, 0.62, 2.3, body);
  const roof = part(cyl, black, 0, 1.78, -0.95, 1.78, 2.3, 0.5, body); roof.rotation.x = Math.PI / 2; roof.scale.set(1.78, 2.3, 0.45);
  const ws = (x) => { const w = part(box, glass, x, 1.55, 0.22, 0.8, 0.46, 0.04, body); w.rotation.x = -0.45; w.rotation.y = x > 0 ? -0.12 : 0.12; };
  ws(0.42); ws(-0.42);
  part(box, chrome, 0, 1.55, 0.24, 0.05, 0.5, 0.06, body).rotation.x = -0.45;
  for (const sx of [1, -1]) {
    part(box, glass, sx * 0.9, 1.5, -0.55, 0.04, 0.4, 0.95, body);
    part(box, glass, sx * 0.9, 1.5, -1.6, 0.04, 0.38, 0.85, body);
    part(box, chrome, sx * 0.91, 1.26, -0.95, 0.03, 0.03, 2.3, body);
  }
  // fastback trunk sweeping down
  const trunk = part(box, black, 0, 1.15, -2.65, 1.75, 0.55, 1.3, body); trunk.rotation.x = 0.42;
  part(box, glass, 0, 1.62, -2.05, 1.2, 0.3, 0.04, body).rotation.x = 0.9;
  // swooping pontoon fenders
  for (const sx of [1, -1]) {
    const ff = part(sph, black, sx * 0.98, 0.78, 1.75, 0.7, 0.85, 2.7, body); ff.rotation.x = 0.12;
    const rf = part(sph, black, sx * 0.98, 0.78, -2.0, 0.68, 0.85, 2.3, body); rf.rotation.x = -0.1;
    part(box, black, sx * 0.97, 0.45, -1.98, 0.42, 0.5, 1.1, body); // rear skirt
    // running board between the fenders
    part(box, nmat(0x1a1a1a, { rough: 0.8 }), sx * 1.12, 0.42, -0.15, 0.36, 0.06, 2.4, body);
    part(box, chrome, sx * 1.29, 0.42, -0.15, 0.03, 0.05, 2.4, body);
    // headlight pods on the fenders
    part(sph, chrome, sx * 0.98, 1.05, 2.9, 0.42, 0.42, 0.32, body);
    lights.push(part(sph, nmat(0xffffff, { kind: 'basic', paint: false }), sx * 0.98, 1.05, 3.02, 0.34, 0.34, 0.16, body));
    // tail light
    part(box, nmat(0xff1a1a, { kind: 'basic', keep: 1, paint: false }), sx * 0.98, 0.95, -3.14, 0.18, 0.12, 0.05, body);
  }
  // the big chrome grille: tall, narrow, ribbed
  part(box, chrome, 0, 0.98, 2.72, 0.78, 0.9, 0.12, body);
  for (let i = -3; i <= 3; i++) part(box, nmat(0x111111), i * 0.095, 0.98, 2.79, 0.035, 0.8, 0.02, body);
  for (const sx of [1, -1]) {
    part(box, chrome, sx * 0.62, 0.68, 2.62, 0.38, 0.3, 0.1, body); // catwalk grilles
    for (let k = 0; k < 4; k++) part(box, nmat(0x111111), sx * 0.62, 0.58 + k * 0.07, 2.68, 0.34, 0.02, 0.02, body);
  }
  const orn = [part(box, chrome, 0, 1.45, 2.66, 0.06, 0.14, 0.18, body), part(sph, chrome, 0, 1.56, 2.66, 0.1, 0.12, 0.28, body)]; // hood ornament
  // bumpers with guards
  const bumperF = part(box, chrome, 0, 0.45, 3.2, 2.35, 0.2, 0.16, body);
  const bumperR = part(box, chrome, 0, 0.45, -3.3, 2.3, 0.2, 0.16, body);
  for (const sx of [0.45, -0.45]) { part(box, chrome, sx, 0.58, 3.24, 0.1, 0.42, 0.12, body); part(box, chrome, sx, 0.58, -3.34, 0.1, 0.42, 0.12, body); }
  part(box, chrome, 0, 0.8, -3.1, 0.3, 0.14, 0.04, body); // plate frame
  part(box, white, 0, 0.8, -3.11, 0.26, 0.1, 0.03, body);
  // whitewall wheels
  const wheels = [];
  for (const [x, z] of [[1.0, 1.75], [-1.0, 1.75], [1.0, -1.98], [-1.0, -1.98]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.46, z);
    const t = part(G.wheel, tire, 0, 0, 0, 0.92, 0.8, 0.92, w); t.rotation.z = Math.PI / 2;
    const ww = part(G.wheel, white, 0, 0, 0, 0.66, 0.84, 0.66, w); ww.rotation.z = Math.PI / 2;
    const hub = part(G.wheel, chrome, 0, 0, 0, 0.42, 0.88, 0.42, w); hub.rotation.z = Math.PI / 2;
    const cap = part(sph, chrome, Math.sign(x) * 0.18, 0, 0, 0.12, 0.22, 0.22, w);
    root.add(w);
    wheels.push(w);
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // breakable bits for the smash: bumpers, guards, ornament, headlights
  const guards = body.children.filter((m) => m.geometry === box && m.material === chrome && Math.abs(m.scale.x - 0.1) < 0.01);
  return { root, body, wheels, lightbar: null, length: 6.4, breakable: { bumperF, bumperR, orn, lights, guards }, hood };
}

export function makeCar(kind = 'sedan', color = '#222222') {
  if (kind === 'sedan') return makePackard();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  let paint;
  if (kind === 'lowrider') paint = nmat(color, { kind: 'std', rough: 0.15, metal: 0.6, keep: 1, paint: false, emissive: color, ei: 0.12 });
  else if (kind === 'cop') paint = nmat(0x1a1a1a, { kind: 'std', rough: 0.2, metal: 0.5 });
  else paint = nmat(0x1c1c1e, { kind: 'std', rough: 0.18, metal: 0.65 });
  const white = nmat(0xe8e8e8, { kind: 'std', rough: 0.25, metal: 0.3 });
  const chrome = nmat(0xdddddd, { kind: 'std', rough: 0.1, metal: 1 });
  const glass = nmat(0x0d0f12, { kind: 'std', rough: 0.05, metal: 0.9 });
  const tire = nmat(0x0e0e0e);
  const L = kind === 'lowrider' ? 5.8 : 5.2;
  part(G.box, paint, 0, 0.75, 0, 2.2, 0.7, L, body);
  part(G.box, kind === 'cop' ? white : paint, 0, 1.38, -0.3, 1.9, 0.62, 2.4, body); // cabin
  part(G.box, glass, 0, 1.4, 0.92, 1.8, 0.5, 0.05, body).rotation.x = -0.35;
  part(G.box, glass, 0, 1.4, -1.52, 1.8, 0.45, 0.05, body).rotation.x = 0.35;
  part(G.box, glass, 1.0, 1.4, -0.3, 0.05, 0.42, 2.1, body);
  part(G.box, glass, -1.0, 1.4, -0.3, 0.05, 0.42, 2.1, body);
  if (kind === 'cop') {
    part(G.box, white, 1.11, 0.78, 0.2, 0.02, 0.5, 2.0, body);
    part(G.box, white, -1.11, 0.78, 0.2, 0.02, 0.5, 2.0, body);
  }
  // round fenders
  for (const [x, z] of [[1.0, 1.6], [-1.0, 1.6], [1.0, -1.6], [-1.0, -1.6]]) {
    const f = part(G.cyl, paint, x, 0.75, z, 0.5, 1.5, 0.5, body);
    f.rotation.x = Math.PI / 2;
    f.scale.set(1.15, 1.6, 1.1);
  }
  part(G.box, chrome, 0, 0.7, L / 2 + 0.05, 1.6, 0.42, 0.12, body); // grille
  part(G.box, chrome, 0, 0.45, L / 2 + 0.15, 2.3, 0.14, 0.14, body); // bumper
  part(G.box, chrome, 0, 0.45, -L / 2 - 0.15, 2.3, 0.14, 0.14, body);
  const hl = nmat(0xffffff, { kind: 'basic', paint: false });
  part(G.sph, hl, 0.78, 0.95, L / 2 - 0.05, 0.36, 0.36, 0.2, body);
  part(G.sph, hl, -0.78, 0.95, L / 2 - 0.05, 0.36, 0.36, 0.2, body);
  const tail = nmat(0xff1a1a, { kind: 'basic', keep: 1, paint: false });
  part(G.box, tail, 0.8, 0.85, -L / 2 - 0.02, 0.3, 0.15, 0.05, body);
  part(G.box, tail, -0.8, 0.85, -L / 2 - 0.02, 0.3, 0.15, 0.05, body);
  const wheels = [];
  for (const [x, z] of [[1.05, 1.6], [-1.05, 1.6], [1.05, -1.6], [-1.05, -1.6]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.42, z);
    const t = part(G.wheel, tire, 0, 0, 0, 0.84, 1, 0.84, w);
    t.rotation.z = Math.PI / 2;
    const hub = part(G.wheel, kind === 'lowrider' ? chrome : white, 0, 0, 0, 0.45, 1.05, 0.45, w);
    hub.rotation.z = Math.PI / 2;
    root.add(w);
    wheels.push(w);
  }
  let lightbar = null;
  if (kind === 'cop') {
    lightbar = new THREE.Group();
    lightbar.position.set(0, 1.75, -0.3);
    body.add(lightbar);
    part(G.box, chrome, 0, 0, 0, 1.3, 0.12, 0.3, lightbar);
    // red/blue lights: kept in color, like Sally's dress
    lightbar.userData.a = part(G.box, new THREE.MeshBasicMaterial({ color: 0xff1020 }), -0.38, 0.12, 0, 0.45, 0.18, 0.26, lightbar);
    lightbar.userData.b = part(G.box, new THREE.MeshBasicMaterial({ color: 0x1040ff }), 0.38, 0.12, 0, 0.45, 0.18, 0.26, lightbar);
  }
  if (kind === 'lowrider') {
    part(G.box, gangMat(GANG_COLORS[(GANG_COLORS.indexOf(color) + 3) % 6]), 0, 1.11, 0, 2.21, 0.08, L * 0.9, body); // flame stripe
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, wheels, lightbar, length: L };
}

// A cop from the Holy Glaze: round, hatted, donut in hand.
export function makeCop() {
  const root = new THREE.Group();
  const blue = nmat(0x2a2f38);
  const skin = nmat(0xcbbfb2);
  for (const x of [-0.25, 0.25]) part(G.cyl, blue, x, 0.45, 0, 0.3, 0.9, 0.3, root);
  part(G.sph, blue, 0, 1.4, 0, 1.4, 1.35, 1.2, root); // the gut
  part(G.box, nmat(0xdddddd, { kind: 'std', metal: 1, rough: 0.2 }), 0.3, 1.75, 0.5, 0.15, 0.15, 0.05, root); // badge
  part(G.sph, skin, 0, 2.3, 0, 0.5, 0.5, 0.5, root);
  part(G.cyl, blue, 0, 2.6, 0, 0.55, 0.18, 0.55, root);
  part(G.box, nmat(0x111111), 0, 2.55, 0.25, 0.5, 0.05, 0.2, root);
  const arm = pivot(root, 0.65, 1.8, 0.1);
  part(G.cyl, blue, 0, -0.3, 0, 0.22, 0.6, 0.22, arm);
  const donut = part(new THREE.TorusGeometry(0.16, 0.08, 8, 14), nmat(0xe8d9c4), 0, -0.68, 0.1, 1, 1, 1, arm);
  donut.rotation.x = Math.PI / 2;
  arm.rotation.x = -1.6;
  return { root, arm };
}

// ---------------------------------------------------------------- portal
export function makePortal(radius = 4) {
  const g = new THREE.Group();
  const uni = { t: { value: 0 }, open: { value: 0 } };
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, side: THREE.DoubleSide, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float t, open; varying vec2 vUv;
        void main(){
          vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
          float sw = a + 6.0 / (r + 0.25) - t * 2.5;
          vec3 c = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + sw * 0.16 + r));
          float bands = 0.6 + 0.4 * sin(sw * 5.0);
          float core = smoothstep(0.35, 0.0, r);
          float a2 = smoothstep(1.0, 0.85, r) * open;
          gl_FragColor = vec4(mix(c * bands * 1.6, vec3(1.0), core), a2);
        }`,
    }),
  );
  g.add(disc);
  const ringMat = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float t; varying vec3 vP;
      void main(){ float a = atan(vP.y, vP.x); gl_FragColor = vec4(0.6 + 0.5 * cos(6.2831 * (vec3(0.0,0.33,0.67) + a * 0.32 + t * 0.6)), 1.0); }`,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.08, 10, 64), ringMat);
  g.add(ring);
  g.userData.uni = uni;
  return g;
}

// ---------------------------------------------------------------- Dottie
// DOTTIE-9, the receptionist. Tin can on a wheel, two lamp eyes, a martini.
export function makeRobot() {
  const root = new THREE.Group();
  const tin = nmat(0x9a9c9e, { kind: 'std', rough: 0.3, metal: 0.85, paint: false });
  const dark = nmat(0x2a2a2a, { kind: 'std', rough: 0.5, paint: false });
  const glow = nmat(0xffffff, { kind: 'basic', paint: false });
  const body = pivot(root, 0, 0, 0);
  part(G.sph, dark, 0, 0.3, 0, 0.6, 0.6, 0.6, body); // the wheel
  part(G.cyl, tin, 0, 0.75, 0, 0.5, 0.5, 0.5, body);
  part(G.box, tin, 0, 1.35, 0, 0.95, 0.8, 0.7, body);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) part(G.cyl, nmat(0xe0e0e0, { paint: false }), -0.3 + c * 0.2, 1.2 + r * 0.17, 0.36, 0.1, 0.03, 0.1, body).rotation.x = Math.PI / 2;
  const head = pivot(body, 0, 1.95, 0);
  part(G.sph, tin, 0, 0, 0, 0.75, 0.62, 0.68, head);
  part(G.cyl, dark, 0.17, 0.05, 0.3, 0.2, 0.06, 0.2, head).rotation.x = Math.PI / 2;
  part(G.cyl, dark, -0.17, 0.05, 0.3, 0.2, 0.06, 0.2, head).rotation.x = Math.PI / 2;
  const eyeL = part(G.sph, glow, 0.17, 0.05, 0.33, 0.14, 0.14, 0.05, head);
  const eyeR = part(G.sph, glow, -0.17, 0.05, 0.33, 0.14, 0.14, 0.05, head);
  part(G.box, dark, 0, -0.16, 0.32, 0.3, 0.04, 0.02, head); // mouth grille
  part(G.cyl, dark, 0, 0.42, 0, 0.03, 0.3, 0.03, head);
  part(G.sph, nmat(0xd0102a, { kind: 'basic', keep: 1, paint: false }), 0, 0.6, 0, 0.1, 0.1, 0.1, head); // antenna bulb
  part(G.box, nmat(0x222222, { paint: false }), 0, 0.25, 0.2, 0.5, 0.06, 0.25, head).rotation.x = -0.4; // a little secretary visor
  const armL = pivot(body, -0.55, 1.6, 0), armR = pivot(body, 0.55, 1.6, 0);
  for (const a of [armL, armR]) {
    part(G.cyl, tin, 0, -0.3, 0, 0.1, 0.6, 0.1, a);
    part(G.sph, dark, 0, -0.62, 0, 0.16, 0.16, 0.16, a);
  }
  // martini in her right claw
  const glass = nmat(0xdddddd, { kind: 'std', rough: 0.05, transparent: true, opacity: 0.6, paint: false });
  const martini = pivot(armR, 0, -0.7, 0.1);
  part(new THREE.ConeGeometry(0.16, 0.18, 12, 1, true), glass, 0, 0.12, 0, 1, 1, 1, martini).rotation.x = Math.PI;
  part(G.cyl, glass, 0, -0.02, 0, 0.02, 0.18, 0.02, martini);
  part(G.sph, nmat(0x777777, { paint: false }), 0.04, 0.17, 0, 0.05, 0.05, 0.05, martini);
  armR.rotation.x = -1.2; armL.rotation.z = 0.4;
  return { root, body, head, armL, armR, eyeL, eyeR };
}

// ---------------------------------------------------------------- dames
export function makeDame(d) {
  const root = new THREE.Group();
  const opts = d.gang ? { kind: 'std', rough: 0.4, keep: 1, paint: false, emissive: d.gang, ei: 0.2 } : d.ghost ? { kind: 'std', rough: 0.2, transparent: true, opacity: 0.65, paint: false, emissive: 0xffffff, ei: 0.25 } : { kind: 'std', rough: 0.45, paint: false };
  const gown = nmat(d.gang || d.shade, opts);
  const skin = nmat(d.ghost ? 0xe8e8e8 : 0xd4cabf, d.ghost ? { transparent: true, opacity: 0.7, paint: false } : { paint: false });
  const black = nmat(0x0e0e0e, { paint: false });
  part(G.cone, gown, 0, 0.72, 0, 1.1, 1.45, 0.95, root); // floor-length gown
  part(G.cyl, gown, 0, 1.6, 0, 0.5, 0.55, 0.4, root);
  part(G.sph, gown, 0, 1.85, 0, 0.56, 0.28, 0.42, root);
  if (d.fur) part(new THREE.TorusGeometry(0.33, 0.13, 8, 16), nmat(0xdedad4, { paint: false }), 0, 1.95, 0, 1, 1, 0.8, root).rotation.x = Math.PI / 2;
  const head = pivot(root, 0, 2.15, 0);
  part(G.cyl, skin, 0, -0.14, 0, 0.11, 0.16, 0.11, head);
  part(G.sph, skin, 0, 0.05, 0, 0.3, 0.37, 0.32, head);
  part(G.sph, black, 0, 0.12, -0.05, 0.37, 0.32, 0.36, head); // hair
  part(G.box, d.gang ? gown : black, 0, -0.05, 0.16, 0.08, 0.03, 0.02, head); // lips
  const hatM = d.gang ? gown : black;
  if (d.hat === 'wide') { part(G.cyl, hatM, 0, 0.24, 0, 1.0, 0.03, 1.0, head); part(G.cyl, hatM, 0, 0.32, 0, 0.36, 0.14, 0.36, head); }
  else if (d.hat === 'cloche') part(G.sph, hatM, 0, 0.17, 0, 0.42, 0.3, 0.42, head);
  else if (d.hat === 'beret') { part(G.cyl, hatM, 0.05, 0.25, 0, 0.42, 0.08, 0.42, head).rotation.z = 0.25; }
  else {
    part(G.cyl, hatM, 0, 0.26, 0, 0.36, 0.1, 0.36, head);
    const veil = part(G.sph, nmat(0x111111, { transparent: true, opacity: 0.45, paint: false }), 0, 0.12, 0.08, 0.38, 0.28, 0.32, head);
    veil.castShadow = false;
  }
  const armL = pivot(root, -0.3, 1.8, 0), armR = pivot(root, 0.3, 1.8, 0);
  for (const a of [armL, armR]) { part(G.cyl, skin, 0, -0.22, 0, 0.1, 0.44, 0.1, a); part(G.cyl, black, 0, -0.55, 0, 0.11, 0.3, 0.11, a); }
  // cigarette holder
  part(G.box, black, 0, -0.75, 0.25, 0.02, 0.02, 0.5, armR);
  part(G.box, nmat(0xffffff, { kind: 'basic', paint: false }), 0, -0.75, 0.52, 0.025, 0.025, 0.06, armR);
  armR.rotation.x = -1.3; armR.rotation.z = -0.3;
  return { root, head, armL, armR };
}

// ---------------------------------------------------------------- Mayor Krane
// Portly, top-hatted, sash and gold chain. Also cast in gold as his own statue.
export function makeMayor(statue = false) {
  const gold = nmat(0xd9b04a, { kind: 'std', rough: 0.25, metal: 1, keep: 1, paint: false, emissive: 0x3a2a00, ei: 1 });
  const suit = statue ? gold : gangMat('#ffd35a');
  const white = statue ? gold : nmat(0xf2efe8, { keep: 1, paint: false });
  const black = statue ? gold : nmat(0x111111, { kind: 'std', rough: 0.3 });
  const skin = statue ? gold : nmat(0xd8b8a8, { keep: 0.6, paint: false });
  const root = new THREE.Group();
  const legL = pivot(root, -0.25, 1.0, 0), legR = pivot(root, 0.25, 1.0, 0);
  for (const l of [legL, legR]) { part(G.cyl, suit, 0, -0.48, 0, 0.32, 0.95, 0.32, l); part(G.box, black, 0, -0.95, 0.06, 0.24, 0.12, 0.38, l); }
  part(G.sph, suit, 0, 1.55, 0, 1.25, 1.35, 1.1, root); // the belly of the city
  part(G.box, gangMat('#ff2d95'), 0, 1.6, 0, 1.28, 0.18, 0.2, root).rotation.z = 0.7; // sash
  part(G.cyl, gold, 0.2, 1.45, 0.55, 0.4, 0.04, 0.4, root).rotation.x = Math.PI / 2; // pocket watch
  part(G.box, gold, 0.1, 1.55, 0.54, 0.4, 0.03, 0.03, root).rotation.z = -0.4; // chain
  const head = pivot(root, 0, 2.35, 0);
  part(G.sph, skin, 0, 0, 0, 0.48, 0.5, 0.48, head);
  part(G.box, black, 0, -0.08, 0.22, 0.3, 0.06, 0.05, head); // mustache
  part(G.cyl, nmat(0x5a4030, { paint: false }), 0.12, -0.15, 0.32, 0.05, 0.3, 0.05, head).rotation.x = Math.PI / 2; // cigar
  part(G.cyl, black, 0, 0.26, 0, 0.75, 0.04, 0.75, head);
  part(G.cyl, black, 0, 0.55, 0, 0.42, 0.55, 0.42, head); // stovepipe
  part(G.cyl, white, 0, 0.32, 0, 0.43, 0.08, 0.43, head);
  const armL = pivot(root, -0.62, 2.0, 0), armR = pivot(root, 0.62, 2.0, 0);
  for (const a of [armL, armR]) { part(G.cyl, suit, 0, -0.35, 0, 0.26, 0.72, 0.26, a); part(G.sph, white, 0, -0.75, 0, 0.17, 0.17, 0.17, a); }
  armR.rotation.x = -1.1; armL.rotation.z = statue ? -2.5 : 0; // the statue waves
  const tool = pivot(armR, 0, -0.8, 0.1);
  part(G.box, gangMat('#62ff2e'), 0, 0, 0.1, 0.4, 0.3, 0.25, tool); // a bag of painted money
  const muzzle = pivot(tool, 0, 0, 0.4);
  return { root, legL, legR, armL, armR, head, tool, muzzle, walk: 0 };
}

// A trenchcoat in every color at once, cycling. For the Rainbow Goon.
let rainbowMat = null;
export function rainbowCoat() {
  if (rainbowMat) return rainbowMat;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, emissive: 0xffffff, emissiveIntensity: 0.12 });
  noirify(m, { keep: 1, paint: false });
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => {
    base(sh);
    sh.uniforms.ntime = NU.ntime;
    sh.fragmentShader = 'uniform float ntime;\n' + sh.fragmentShader.replace('outgoingLight = ncol;',
      'vec3 rb = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + vNW.y * 0.45 + vNW.x * 0.05 + ntime * 0.35));\n  rb = pow(rb, vec3(1.6));\n  ncol = rb * (0.3 + min(nl, 1.2) * 0.85);\n  outgoingLight = ncol;');
  };
  m.customProgramCacheKey = () => 'rainbowcoat';
  rainbowMat = m;
  return m;
}

export function makeRainbowGoon() {
  const m = makeDetective(); // same cut of coat as Mack, the cheap knock-off
  const coat = rainbowCoat();
  m.root.traverse((o) => {
    if (!o.isMesh || !o.material.color) return;
    const hex = o.material.color.getHex();
    if (hex === 0x7a7064 || hex === 0x5b5349) o.material = coat;
    if (hex === 0x2b2926) o.material = gangMat('#a64bff');
  });
  m.gun.traverse((o) => { if (o.isMesh) o.material = gangMat('#62ff2e'); });
  m.flask.visible = false;
  m.color = '#ff2d95';
  return m;
}

// Paintbot: a giant robot vacuum that paints instead of cleans.
export function makeRoomba(color) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const shell = nmat(0x1c1c1e, { kind: 'std', rough: 0.15, metal: 0.6 });
  const top = gangMat(color);
  const chrome = nmat(0xdddddd, { kind: 'std', rough: 0.1, metal: 1 });
  part(new THREE.CylinderGeometry(3.4, 3.5, 1.1, 40), shell, 0, 0.75, 0, 1, 1, 1, body);
  part(new THREE.CylinderGeometry(3.1, 3.3, 0.25, 40), top, 0, 1.38, 0, 1, 1, 1, body);
  part(new THREE.TorusGeometry(3.45, 0.18, 8, 40), chrome, 0, 0.55, 0, 1, 1, 1, body).rotation.x = Math.PI / 2; // bumper
  part(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 24), shell, 0, 1.55, 0.6, 1, 1, 1, body);
  const eye = part(new THREE.TorusGeometry(0.75, 0.12, 8, 30), rainbowCoat(), 0, 1.7, 0.6, 1, 1, 1, body); eye.rotation.x = Math.PI / 2;
  part(G.box, gangMat('#ffffff'), 0, 1.53, 2.4, 2.2, 0.06, 0.4, body); // "PRISM-O-MATIC" badge strip
  // spinning side brush that flings paint
  const brush = new THREE.Group(); brush.position.set(2.5, 0.25, 2.2); body.add(brush);
  for (let i = 0; i < 4; i++) { const b = part(G.box, top, 0, 0, 0.7, 0.12, 0.05, 1.4, brush); b.rotation.y = 0; const p2 = new THREE.Group(); p2.rotation.y = i * Math.PI / 2; p2.add(b); brush.add(p2); }
  // paint tanks on the back
  for (const x of [-1.2, 1.2]) part(G.cyl, gangMat(GANG_COLORS[(GANG_COLORS.indexOf(color) + 2) % 6]), x, 2.0, -1.6, 0.9, 1.4, 0.9, body);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, brush, eye };
}

// Goon Truck: a stake-bed hauler with Syndicate goons in the back, rocket tubes up.
export function makeTruck(color) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const paint = nmat(color, { kind: 'std', rough: 0.3, metal: 0.4, keep: 1, paint: false, emissive: color, ei: 0.1 });
  const dark = nmat(0x161616, { kind: 'std', rough: 0.5 });
  const chrome = nmat(0xdddddd, { kind: 'std', rough: 0.1, metal: 1 });
  const glass = nmat(0x0c0e12, { kind: 'std', rough: 0.05, metal: 0.9 });
  part(G.box, dark, 0, 0.8, 0, 2.5, 0.4, 8.4, body); // frame
  part(G.box, paint, 0, 1.75, 2.9, 2.5, 1.7, 2.4, body); // cab
  part(G.box, paint, 0, 1.2, 4.6, 2.2, 1.0, 1.4, body); // hood
  part(G.box, chrome, 0, 1.2, 5.32, 1.6, 0.9, 0.08, body); // grille
  part(G.box, glass, 0, 2.15, 4.1, 2.2, 0.7, 0.05, body);
  part(G.box, glass, 1.26, 2.15, 2.9, 0.05, 0.6, 1.6, body);
  part(G.box, glass, -1.26, 2.15, 2.9, 0.05, 0.6, 1.6, body);
  part(G.box, nmat(0x3a2e24, { rough: 0.8 }), 0, 1.1, -1.5, 2.6, 0.2, 5.2, body); // bed
  for (const x of [-1.25, 1.25]) for (let z = -3.8; z <= 0.8; z += 0.9) part(G.box, nmat(0x4a3a2c), x, 1.75, z, 0.1, 1.1, 0.12, body); // stakes
  part(G.box, gangMat(GANG_COLORS[(GANG_COLORS.indexOf(color) + 3) % 6]), 1.32, 1.75, -1.5, 0.04, 0.5, 5.0, body); // painted slat
  const hl = nmat(0xffffff, { kind: 'basic', paint: false });
  for (const x of [-0.85, 0.85]) part(G.sph, hl, x, 1.35, 5.3, 0.36, 0.36, 0.15, body);
  const wheels = [];
  for (const [x, z] of [[1.3, 3.6], [-1.3, 3.6], [1.3, -2.6], [-1.3, -2.6], [1.3, -0.9], [-1.3, -0.9]]) {
    const w = new THREE.Group(); w.position.set(x, 0.55, z);
    const t = part(G.wheel, nmat(0x0c0c0c), 0, 0, 0, 1.1, 0.9, 1.1, w); t.rotation.z = Math.PI / 2;
    const h = part(G.wheel, chrome, 0, 0, 0, 0.5, 0.95, 0.5, w); h.rotation.z = Math.PI / 2;
    root.add(w); wheels.push(w);
  }
  // goons riding in the back, one with a rocket tube
  const goons = [];
  for (const [x, z, launcher] of [[-0.6, -0.4, true], [0.6, -2.0, true], [-0.5, -3.3, false]]) {
    const g = makeGangster(GANG_COLORS[Math.floor(Math.random() * 6)], 'hood', 0.85);
    g.root.position.set(x, 1.2, z);
    if (launcher) {
      const tube = part(G.cyl, nmat(0x2a2a2a, { kind: 'std', metal: 0.5 }), 0.4, 2.0, 0.2, 0.28, 1.5, 0.28, g.root);
      tube.rotation.x = Math.PI / 2;
    }
    body.add(g.root); goons.push(g);
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, wheels, goons, length: 10.8 };
}

// Paint copter: a Syndicate whirlybird with a bucket of color slung underneath.
export function makeCopter(color) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const paint = gangMat(color);
  const dark = nmat(0x181818, { kind: 'std', rough: 0.4, metal: 0.5 });
  const glass = nmat(0x10141a, { kind: 'std', rough: 0.05, metal: 0.9, transparent: true, opacity: 0.8 });
  part(G.sph, paint, 0, 0, 0, 2.6, 2.4, 4.2, body); // fuselage
  part(G.sph, glass, 0, 0.3, 1.5, 2.2, 1.8, 2.0, body); // bubble canopy
  const boom = part(G.cyl, paint, 0, 0.4, -4.2, 0.5, 4.6, 0.5, body); boom.rotation.x = Math.PI / 2;
  part(G.box, paint, 0, 1.1, -6.3, 0.15, 1.6, 1.0, body); // fin
  const tail = new THREE.Group(); tail.position.set(0.35, 1.0, -6.3); body.add(tail);
  part(G.box, dark, 0, 0, 0, 0.06, 1.6, 0.2, tail);
  for (const x of [-0.9, 0.9]) { part(G.box, dark, x, -1.5, 0, 0.12, 0.12, 3.6, body); part(G.box, dark, x, -1.1, 0.8, 0.08, 0.8, 0.08, body); part(G.box, dark, x, -1.1, -0.8, 0.08, 0.8, 0.08, body); }
  part(G.cyl, dark, 0, 1.4, 0, 0.25, 0.6, 0.25, body);
  const rotor = new THREE.Group(); rotor.position.set(0, 1.75, 0); body.add(rotor);
  for (const r of [0, Math.PI / 2]) { const b = part(G.box, dark, 0, 0, 0, 0.35, 0.05, 11, rotor); b.rotation.y = r; }
  // the paint bucket on a cable
  part(G.cyl, dark, 0, -2.6, 0, 0.04, 1.8, 0.04, body);
  part(G.cyl, gangMat(GANG_COLORS[(GANG_COLORS.indexOf(color) + 3) % 6]), 0, -3.8, 0, 1.6, 1.2, 1.6, body);
  // searchlight cone sweeping the street
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 20, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.position.set(0, -10, 2); body.add(beam);
  root.traverse((o) => { if (o.isMesh && o !== beam) o.castShadow = true; });
  return { root, body, rotor, tail, beam };
}

// The Re-Election Machine: Mayor Krane's walking paint mech, Krane under glass on top.
export function makeMech() {
  const root = new THREE.Group();
  const gold = gangMat('#ffd35a');
  const steel = nmat(0x3a3c40, { kind: 'std', rough: 0.35, metal: 0.8 });
  const dark = nmat(0x151515, { kind: 'std', rough: 0.5, metal: 0.6 });
  const legL = pivot(root, -0.55, 1.15, 0), legR = pivot(root, 0.55, 1.15, 0);
  for (const l of [legL, legR]) {
    part(G.box, steel, 0, -0.3, 0, 0.42, 0.65, 0.42, l);
    part(G.box, gold, 0, -0.75, 0.1, 0.36, 0.5, 0.36, l);
    part(G.box, dark, 0, -1.08, 0.18, 0.6, 0.14, 0.8, l); // foot
  }
  part(G.box, steel, 0, 1.25, 0, 1.6, 0.35, 0.9, root); // hips
  part(G.box, gold, 0, 1.85, 0, 1.9, 0.95, 1.2, root); // hull
  part(G.box, dark, 0, 1.85, 0.62, 1.2, 0.5, 0.04, root);
  part(G.box, gangMat('#ff2d95'), 0, 1.9, 0.63, 1.8, 0.16, 0.02, root).rotation.z = 0.35; // the sash, of course
  // glass dome with the Mayor inside
  const head = pivot(root, 0, 2.45, 0);
  part(G.sph, nmat(0xcfe0ff, { kind: 'std', rough: 0.05, metal: 0.2, transparent: true, opacity: 0.35, paint: false }), 0, 0.15, 0, 1.1, 0.9, 1.1, head);
  const mayor = makeMayor();
  mayor.root.scale.setScalar(0.3); mayor.root.position.set(0, -0.25, 0);
  head.add(mayor.root);
  const armL = pivot(root, -1.15, 2.1, 0), armR = pivot(root, 1.15, 2.1, 0);
  for (const a of [armL, armR]) {
    part(G.box, steel, 0, -0.25, 0, 0.35, 0.6, 0.35, a);
    const cannon = part(G.cyl, gold, 0, -0.6, 0.35, 0.34, 0.9, 0.34, a); cannon.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) part(G.cyl, gangMat(GANG_COLORS[i * 2 + (a === armR ? 1 : 0)]), (i - 1) * 0.1, -0.6, 0.85, 0.08, 0.12, 0.08, a).rotation.x = Math.PI / 2; // nozzles
  }
  armL.rotation.x = armR.rotation.x = -1.3;
  part(G.cyl, steel, 0.5, 2.6, -0.4, 0.08, 1.4, 0.08, root); // antenna with a little flag
  part(G.box, gold, 0.75, 3.15, -0.4, 0.5, 0.3, 0.02, root);
  const tool = pivot(armR, 0, -0.6, 0.9);
  const muzzle = pivot(tool, 0, 0, 0.2);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, legL, legR, armL, armR, head, tool, muzzle, walk: 0, mayor };
}

// The Church of the Holy Spectrum: robed cultists with a painted eye on the chest.
export function makeCultist(color, scale = 1) {
  const root = new THREE.Group();
  const robe = nmat(0xe8e4dc, { kind: 'std', rough: 0.7, keep: 0.4, paint: false });
  const trim = gangMat(color);
  const legL = pivot(root, -0.15, 0.9, 0), legR = pivot(root, 0.15, 0.9, 0);
  for (const l of [legL, legR]) part(G.box, nmat(0x111111), 0, -0.85, 0.05, 0.18, 0.1, 0.3, l);
  part(G.cone, robe, 0, 1.1, 0, 1.2, 2.1, 1.1, root); // long robe
  part(G.cyl, trim, 0, 0.12, 0, 1.18, 0.16, 1.08, root); // hem stripe
  const eye = part(G.sph, rainbowCoat(), 0, 1.7, 0.42, 0.34, 0.2, 0.06, root); // the painted eye
  part(G.sph, nmat(0x050505, { paint: false }), 0, 1.7, 0.45, 0.12, 0.12, 0.04, root);
  const head = pivot(root, 0, 2.25, 0);
  part(G.cone, robe, 0, 0.15, -0.05, 0.62, 0.9, 0.62, head).rotation.x = 0; // pointed hood
  part(G.sph, nmat(0x050505, { paint: false }), 0, -0.02, 0.12, 0.34, 0.4, 0.3, head); // shadowed face
  part(G.sph, nmat(0xffffff, { kind: 'basic', paint: false }), 0.08, 0.02, 0.26, 0.05, 0.03, 0.02, head);
  part(G.sph, nmat(0xffffff, { kind: 'basic', paint: false }), -0.08, 0.02, 0.26, 0.05, 0.03, 0.02, head);
  const armL = pivot(root, -0.42, 1.95, 0), armR = pivot(root, 0.42, 1.95, 0);
  for (const a of [armL, armR]) part(G.cone, robe, 0, -0.35, 0, 0.3, 0.75, 0.3, a);
  armR.rotation.x = -1.2;
  const tool = pivot(armR, 0, -0.75, 0.1);
  part(G.cyl, nmat(0x777777, { kind: 'std', metal: 1, rough: 0.3 }), 0, -0.25, 0, 0.02, 0.5, 0.02, tool);
  part(G.sph, trim, 0, -0.55, 0, 0.22, 0.26, 0.22, tool); // censer of paint fumes
  const muzzle = pivot(tool, 0, -0.55, 0.2);
  root.scale.setScalar(scale);
  return { root, legL, legR, armL, armR, head, tool, muzzle, eye, walk: 0, color };
}

// Chromadaemon: a hunched imp out of the Technicolor Hell.
export function makeImp(color, scale = 1) {
  const root = new THREE.Group();
  const skin = rainbowCoat();
  const dark = nmat(0x0a0a0a, { paint: false });
  const legL = pivot(root, -0.25, 0.7, 0), legR = pivot(root, 0.25, 0.7, 0);
  for (const l of [legL, legR]) { part(G.cone, skin, 0, -0.35, 0, 0.26, 0.7, 0.26, l).rotation.x = Math.PI; part(G.cone, dark, 0, -0.72, 0.15, 0.1, 0.3, 0.1, l).rotation.x = Math.PI / 2; }
  part(G.sph, skin, 0, 1.1, 0, 1.0, 0.9, 1.1, root);
  const head = pivot(root, 0, 1.65, 0.3);
  part(G.sph, skin, 0, 0, 0, 0.6, 0.55, 0.6, head);
  for (const x of [-0.18, 0.18]) {
    part(G.cone, dark, x, 0.4, -0.05, 0.12, 0.5, 0.12, head).rotation.z = -x * 2;
    part(G.sph, nmat(0xffffff, { kind: 'basic', paint: false }), x * 0.8, 0.05, 0.27, 0.1, 0.07, 0.04, head);
  }
  part(G.box, dark, 0, -0.14, 0.28, 0.3, 0.05, 0.04, head); // grin
  const armL = pivot(root, -0.5, 1.3, 0.1), armR = pivot(root, 0.5, 1.3, 0.1);
  for (const a of [armL, armR]) { part(G.cyl, skin, 0, -0.3, 0, 0.14, 0.6, 0.14, a); part(G.cone, dark, 0, -0.65, 0.05, 0.08, 0.2, 0.08, a); }
  // rainbow bat wings on pivots so they can flap
  const wings = [];
  for (const s of [-1, 1]) {
    const wp = pivot(root, s * 0.35, 1.5, -0.4);
    const wshape = new THREE.Shape();
    wshape.moveTo(0, 0); wshape.lineTo(1.6, 0.6); wshape.lineTo(1.4, -0.1); wshape.lineTo(1.1, -0.5); wshape.lineTo(0.7, -0.2); wshape.lineTo(0.4, -0.6); wshape.closePath();
    const wm = new THREE.Mesh(new THREE.ShapeGeometry(wshape), rainbowWing());
    wm.scale.set(s, 1, 1); wm.rotation.x = -0.3;
    wp.add(wm); wings.push(wp);
  }
  const tail = part(G.cyl, skin, 0, 0.8, -0.7, 0.06, 1.0, 0.06, root); tail.rotation.x = 1.0;
  const tool = pivot(armR, 0, -0.6, 0.1);
  const muzzle = pivot(tool, 0, 0, 0.2);
  root.scale.setScalar(scale);
  return { root, legL, legR, armL, armR, head, tool, muzzle, walk: 0, color, wings };
}

let wingMat = null;
function rainbowWing() {
  if (wingMat) return wingMat;
  const base = rainbowCoat();
  wingMat = base.clone();
  wingMat.side = THREE.DoubleSide;
  wingMat.onBeforeCompile = base.onBeforeCompile;
  wingMat.customProgramCacheKey = () => 'rainbowwing';
  return wingMat;
}

// A giant Technicolor beast: horns, rainbow hide, the size of a tenement.
export function makeBeast(color) {
  const m = makeImp(color, 3.4);
  const dark = nmat(0x0a0a0a, { paint: false });
  for (const x of [-0.35, 0.35]) { const h = part(G.cone, dark, x, 0.55, 0, 0.18, 0.9, 0.18, m.head); h.rotation.z = -x * 1.6; }
  part(G.sph, rainbowCoat(), 0, 1.6, -0.3, 1.2, 0.5, 1.0, m.root); // hump
  return m;
}

// Rain City civilians: coats, hats, umbrellas. Grey as the weather.
const CIV_COATS = [0x4a4844, 0x5e5a54, 0x3a3a3c, 0x6a6560, 0x2c2c2e];
export function makeCivilian(seed = Math.random()) {
  const root = new THREE.Group();
  const coat = nmat(CIV_COATS[Math.floor(seed * CIV_COATS.length)]);
  const dark = nmat(0x1a1a1a);
  const skin = nmat(0xbfb4a8);
  const legL = pivot(root, -0.14, 0.9, 0), legR = pivot(root, 0.14, 0.9, 0);
  for (const l of [legL, legR]) { part(G.cyl, dark, 0, -0.45, 0, 0.16, 0.9, 0.16, l); part(G.box, dark, 0, -0.88, 0.05, 0.16, 0.1, 0.28, l); }
  part(G.cone, coat, 0, 1.25, 0, 0.95, 1.1, 0.8, root);
  part(G.cyl, coat, 0, 1.7, 0, 0.62, 0.4, 0.5, root);
  const head = pivot(root, 0, 2.05, 0);
  part(G.sph, skin, 0, 0, 0, 0.32, 0.38, 0.34, head);
  const armL = pivot(root, -0.36, 1.82, 0), armR = pivot(root, 0.36, 1.82, 0);
  for (const a of [armL, armR]) part(G.cyl, coat, 0, -0.3, 0, 0.15, 0.6, 0.15, a);
  let umbrella = null;
  if (seed < 0.55) {
    // black umbrella held over the head
    umbrella = pivot(root, 0.15, 2.6, 0.1);
    part(new THREE.SphereGeometry(0.95, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), nmat(0x111111, { kind: 'std', rough: 0.25 }), 0, 0, 0, 1, 0.55, 1, umbrella);
    part(G.cyl, dark, 0, -0.4, 0, 0.03, 0.9, 0.03, umbrella);
    armR.rotation.x = -0.6; armR.rotation.z = 0.3;
  } else {
    part(G.cyl, dark, 0, 0.16, 0, 0.62, 0.04, 0.62, head);
    part(G.cyl, dark, 0, 0.28, 0, 0.34, 0.22, 0.34, head);
    if (seed > 0.8) { const bc = part(G.box, nmat(0x2a2018), 0, -0.68, 0.05, 0.45, 0.32, 0.12); armL.add(bc); }
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.civMat = o.material; } });
  return { root, legL, legR, armL, armR, head, umbrella, walk: Math.random() * 6 };
}
export function setInfected(m, on) {
  m.root.traverse((o) => { if (o.isMesh) o.material = on ? rainbowCoat() : o.userData.civMat; });
}
