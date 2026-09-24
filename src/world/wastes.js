// Set dressing for the Clockwork Wastes (depth 02, open mode): giant gears
// half-sunk in the ground, leaning clock towers that still tick, and pipes
// that vent steam. Everything stays clear of the arena and the plazas.

import * as THREE from 'three';
import { TAU } from '../engine/util.js';
import { mat } from '../gfx/models.js';

function gear(R, teeth, brass, iron) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.12, 8, 40), brass);
  rim.castShadow = true;
  g.add(rim);
  const toothGeo = new THREE.BoxGeometry(R * 0.22, R * 0.2, R * 0.2);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    const t = new THREE.Mesh(toothGeo, brass);
    t.position.set(Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12, 0);
    t.rotation.z = a;
    t.castShadow = true;
    g.add(t);
  }
  const spokeGeo = new THREE.BoxGeometry(R * 2, R * 0.1, R * 0.08);
  for (let k = 0; k < 3; k++) {
    const sp = new THREE.Mesh(spokeGeo, iron);
    sp.rotation.z = (k / 3) * Math.PI;
    g.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.2, R * 0.3, 16), brass);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

export function buildWastes(w) {
  const rng = w.rng;
  const brass = mat('#b8903e', { metalness: 0.9, roughness: 0.35 });
  const rust = mat('#6a3a1e', { metalness: 0.6, roughness: 0.7 });
  const iron = mat('#241c18', { metalness: 0.8, roughness: 0.45 });
  const stone = mat('#3a2e34', { roughness: 0.85 });
  const S = w.S;
  const avoid = () => [...w.plazas.map((p) => ({ x: p.x, z: p.z, r: p.r + 6 })), { x: w.spawn.x, z: w.spawn.z, r: 20 }];

  // giant gears, half buried and leaning, some still turning
  const turning = [];
  for (let i = 0; i < Math.round(9 * S); i++) {
    const s = w.freeSpot(9, avoid());
    const R = 3 + rng() * 5;
    const g = gear(R, 10 + Math.floor(R * 2), rng() < 0.5 ? brass : rust, iron);
    const y = w.height(s.x, s.z);
    g.position.set(s.x, y + R * (0.25 + rng() * 0.35), s.z);
    g.rotation.set((rng() - 0.5) * 0.5, rng() * TAU, (rng() - 0.5) * 0.3);
    w.add(g);
    w.colliders.push({ x: s.x, z: s.z, r: R * 0.5, top: y + R * 1.3 });
    if (rng() < 0.4) turning.push({ g, sp: (rng() - 0.5) * 0.6 });
  }
  w.anim.push((t, dt) => {
    for (const q of turning) q.g.rotateZ(q.sp * dt);
  });

  // leaning clock towers with glowing faces
  const face = new THREE.MeshStandardMaterial({ map: w.assets.clock, emissive: '#ffc070', emissiveMap: w.assets.clock, emissiveIntensity: 0.9, roughness: 0.4 });
  const hands = [];
  for (let i = 0; i < Math.round(4 * S); i++) {
    const s = w.freeSpot(8, avoid());
    const H = 9 + rng() * 8;
    const tower = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, H, 3.2), stone);
    body.position.y = H / 2;
    body.castShadow = true;
    tower.add(body);
    for (const side of [0, 1, 2, 3]) {
      const f = new THREE.Mesh(new THREE.CircleGeometry(1.25, 28), face);
      const a = (side / 4) * TAU;
      f.position.set(Math.sin(a) * 1.62, H - 1.8, Math.cos(a) * 1.62);
      f.rotation.y = a;
      tower.add(f);
      const rimRing = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.1, 6, 28), brass);
      rimRing.position.copy(f.position);
      rimRing.rotation.y = a;
      tower.add(rimRing);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.04), iron);
      hand.geometry.translate(0, 0.45, 0);
      hand.position.copy(f.position).multiplyScalar(1.02);
      hand.position.y = H - 1.8;
      hand.rotation.y = a;
      tower.add(hand);
      hands.push({ hand, sp: 0.5 + rng() * 2 });
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4, 4), iron);
    roof.position.y = H + 2;
    roof.rotation.y = Math.PI / 4;
    tower.add(roof);
    const y = w.height(s.x, s.z);
    tower.position.set(s.x, y - 0.5, s.z);
    tower.rotation.set((rng() - 0.5) * 0.25, rng() * TAU, (rng() - 0.5) * 0.25);
    w.add(tower);
    w.colliders.push({ x: s.x, z: s.z, r: 2.3, top: y + H });
  }
  w.anim.push((t, dt) => {
    for (const h of hands) h.hand.rotation.z -= h.sp * dt;
  });

  // pipes breaking out of the ground, venting steam
  const vents = [];
  for (let i = 0; i < Math.round(8 * S); i++) {
    const s = w.freeSpot(5, avoid());
    const y = w.height(s.x, s.z);
    const a = rng() * TAU;
    const L = 4 + rng() * 5;
    const pts = [
      new THREE.Vector3(s.x - Math.cos(a) * L, y - 1.5, s.z - Math.sin(a) * L),
      new THREE.Vector3(s.x - Math.cos(a) * L * 0.4, y + 1.2, s.z - Math.sin(a) * L * 0.4),
      new THREE.Vector3(s.x, y + 2.6, s.z),
      new THREE.Vector3(s.x + Math.cos(a) * 0.6, y + 3.6, s.z + Math.sin(a) * 0.6),
    ];
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.55, 10), rng() < 0.5 ? rust : brass);
    pipe.castShadow = true;
    w.add(pipe);
    for (const k of [0.35, 0.7]) {
      const p = new THREE.CatmullRomCurve3(pts).getPoint(k);
      const j = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.14, 6, 14), brass);
      j.position.copy(p);
      j.lookAt(new THREE.CatmullRomCurve3(pts).getPoint(k + 0.02));
      w.add(j);
    }
    w.colliders.push({ x: s.x, z: s.z, r: 0.9, top: y + 3.6 });
    vents.push({ at: pts[3].clone(), ph: rng() * 6 });
  }
  w.anim.push((time) => {
    const g = w.game;
    if (!g || !g.fx) return;
    for (const v of vents) {
      const k = (time + v.ph) % 5;
      if (k < 1 && Math.random() < 0.4) g.fx.smoke(v.at, '#8a8088', 1, 1.4);
    }
  });
}
