// Kill "juice": gibs with physics that bleed and splat where they land,
// directional blood spray, mist, and glossy ground decals.

import * as THREE from 'three';
import { rand, TAU, makeCanvas } from '../engine/util.js';

const MAX_GIBS = 140;
const MAX_SPLATS = 90;

// Several splat shapes; the streak variants get aimed along the hit direction.
function splatTextures() {
  const out = [];
  for (let v = 0; v < 6; v++) {
    const S = 256;
    const c = makeCanvas(S, S);
    const x = c.getContext('2d');
    const streak = v >= 3;
    x.fillStyle = '#fff';
    x.translate(S / 2, S / 2);
    // core pool with a ragged edge
    x.beginPath();
    const R = streak ? 34 : 48;
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * TAU;
      const r = R * (0.75 + rand() * 0.4);
      x.lineTo(Math.cos(a) * r * (streak ? 0.8 : 1), Math.sin(a) * r);
    }
    x.fill();
    // satellite drops
    for (let i = 0; i < 40; i++) {
      const a = streak ? (rand() - 0.5) * 0.7 : rand() * TAU;
      const d = R * (1 + rand() * (streak ? 2.6 : 1.4));
      const r = 1.5 + rand() * (streak ? 7 : 9) * (1 - d / (R * 3.8));
      x.beginPath();
      x.ellipse(Math.cos(a) * d, Math.sin(a) * d, Math.max(1, r * (streak ? 1.8 : 1)), Math.max(1, r), a, 0, TAU);
      x.fill();
    }
    // fingers / runs
    for (let i = 0; i < (streak ? 7 : 5); i++) {
      const a = streak ? (rand() - 0.5) * 0.5 : rand() * TAU;
      x.save();
      x.rotate(a);
      x.fillRect(R * 0.5, -2 - rand() * 3, R * (0.6 + rand() * (streak ? 2.2 : 0.8)), 4 + rand() * 5);
      x.restore();
    }
    const t = new THREE.CanvasTexture(c);
    out.push({ tex: t, streak });
  }
  return out;
}

export class Gore {
  constructor(game) {
    this.game = game;
    this.gibs = [];
    this.splats = [];
    this.variants = splatTextures();
    this.splatGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.geos = {
      flesh: new THREE.IcosahedronGeometry(0.17, 1),
      chunk: new THREE.DodecahedronGeometry(0.14, 0),
      card: new THREE.PlaneGeometry(0.22, 0.3),
      shard: new THREE.TetrahedronGeometry(0.14, 0),
      gear: new THREE.TorusGeometry(0.09, 0.03, 5, 8),
      fur: new THREE.IcosahedronGeometry(0.18, 1),
    };
    this.mats = {
      flesh: new THREE.MeshPhysicalMaterial({ color: '#6e0a14', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }),
      dark: new THREE.MeshPhysicalMaterial({ color: '#3a0408', roughness: 0.3, clearcoat: 0.8 }),
      card: new THREE.MeshStandardMaterial({ color: '#e8dccb', roughness: 0.8, side: THREE.DoubleSide }),
      cardRed: new THREE.MeshStandardMaterial({ color: '#8e1119', roughness: 0.6, side: THREE.DoubleSide }),
      porcelain: new THREE.MeshPhysicalMaterial({ color: '#f2ece2', roughness: 0.2, clearcoat: 1 }),
      gold: new THREE.MeshStandardMaterial({ color: '#c9a04a', metalness: 0.9, roughness: 0.3 }),
      fur: new THREE.MeshStandardMaterial({ color: '#d8d0c8', roughness: 1 }),
    };
    this.splatMats = new Map();
  }

  clear() {
    for (const g of this.gibs) this.game.scene.remove(g.mesh);
    for (const s of this.splats) this.game.scene.remove(s.mesh);
    this.gibs = [];
    this.splats = [];
  }

  // Glossy blood decal. dir (optional, Vector3) orients the streaky variants.
  splat(x, z, r, color = '#5a0610', dir = null) {
    const g = this.game;
    const streak = !!dir;
    const pool = this.variants.filter((v) => v.streak === streak);
    const v = pool[Math.floor(rand() * pool.length)];
    const key = color + v.tex.id;
    let m = this.splatMats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color, alphaMap: v.tex, transparent: true, roughness: 0.08, metalness: 0.15,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 - rand(), polygonOffsetUnits: -2,
      });
      this.splatMats.set(key, m);
    }
    const mesh = new THREE.Mesh(this.splatGeo, m);
    mesh.position.set(x, g.world.height(x, z) + 0.05 + rand() * 0.01, z);
    mesh.rotation.y = dir ? Math.atan2(dir.x, dir.z) - Math.PI / 2 : rand() * TAU;
    mesh.scale.set(r * 2 * (streak ? 1.8 : 1), 1, r * 2);
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    g.scene.add(mesh);
    this.splats.push({ mesh });
    if (this.splats.length > MAX_SPLATS) g.scene.remove(this.splats.shift().mesh);
  }

  // A directional spray of blood droplets; used on every hit.
  spray(pos, dir, n, color = '#9a0c18') {
    const fx = this.game.fx;
    const d = dir ? dir.clone().setY(0).normalize() : null;
    for (let i = 0; i < n; i++) {
      fx.spark(pos.x, pos.y, pos.z, i % 3 ? color : '#5a0208', {
        matter: true, speed: 6 + rand() * 6, g: 16, size: 0.12 + rand() * 0.16, life: 0.9, drag: 0.6,
        vx: d ? d.x * 7 : 0, vz: d ? d.z * 7 : 0, vy: 2,
      });
    }
  }

  // The kill: gibs, a burst, a mist cloud, and a spread of splats.
  explode(pos, dir, o = {}) {
    const g = this.game;
    const fx = g.fx;
    const scale = o.scale || 1;
    const blood = o.blood || '#8a0a16';
    const d = dir ? dir.clone().setY(0).normalize() : new THREE.Vector3();
    // burst of droplets, biased along the killing blow
    for (let i = 0; i < 60 * scale; i++) {
      fx.spark(pos.x, pos.y, pos.z, i % 4 ? blood : '#4a0206', {
        matter: true, speed: 9 + rand() * 9, g: 18, size: 0.14 + rand() * 0.22, life: 1.3, drag: 0.5,
        vx: d.x * 9, vz: d.z * 9, vy: 4,
      });
    }
    // mist
    for (let i = 0; i < 10 * scale; i++) {
      fx.spark(pos.x, pos.y, pos.z, '#7a0612', { matter: true, speed: 2.5, g: -0.4, size: 1.2 + rand(), life: 1.4, drag: 2, a: 0.35, grow: 1.6 });
    }
    fx.flash(pos, '#ff2030', 2.2 * scale, 0.12);
    // gibs
    const kinds = o.gibs || ['flesh', 'flesh', 'chunk'];
    const n = Math.round((o.count || 9) * scale);
    for (let i = 0; i < n; i++) {
      const kind = kinds[i % kinds.length];
      const matKey = kind === 'card' ? (rand() < 0.5 ? 'card' : 'cardRed') : kind === 'shard' ? 'porcelain' : kind === 'gear' ? 'gold' : kind === 'fur' ? 'fur' : rand() < 0.6 ? 'flesh' : 'dark';
      const mesh = new THREE.Mesh(this.geos[kind], this.mats[matKey]);
      mesh.castShadow = true;
      mesh.position.copy(pos);
      mesh.scale.setScalar((0.7 + rand() * 0.8) * Math.sqrt(scale));
      g.scene.add(mesh);
      const a = rand() * TAU;
      const sp = 4 + rand() * 7;
      this.gibs.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(a) * sp + d.x * 6, 5 + rand() * 8, Math.sin(a) * sp + d.z * 6),
        spin: new THREE.Vector3(rand() * 14 - 7, rand() * 14 - 7, rand() * 14 - 7),
        life: 7 + rand() * 3,
        bleeds: kind === 'flesh' || kind === 'chunk' || kind === 'fur',
        landed: false,
        flat: kind === 'card',
        blood,
      });
      if (this.gibs.length > MAX_GIBS) g.scene.remove(this.gibs.shift().mesh);
    }
    // splatter: a big pool plus streaks thrown along the blow
    this.splat(pos.x, pos.z, 1.5 * scale, '#7a0814');
    for (let i = 0; i < 4 + scale * 3; i++) {
      const dist = 0.8 + rand() * 2.8 * scale;
      const sx = pos.x + d.x * dist + (rand() - 0.5) * 1.6 * scale;
      const sz = pos.z + d.z * dist + (rand() - 0.5) * 1.6 * scale;
      this.splat(sx, sz, (0.6 + rand() * 0.8) * scale, rand() < 0.5 ? '#8a0a18' : '#5a0410', d.lengthSq() > 0 ? d : new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5));
    }
  }

  update(dt) {
    const g = this.game;
    const w = g.world;
    for (const b of this.gibs) {
      b.life -= dt;
      if (!b.landed) {
        b.vel.y -= 24 * dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        b.mesh.rotation.x += b.spin.x * dt;
        b.mesh.rotation.y += b.spin.y * dt;
        b.mesh.rotation.z += b.spin.z * dt;
        if (b.bleeds && Math.random() < 0.5) {
          const p = b.mesh.position;
          g.fx.spark(p.x, p.y, p.z, b.blood, { matter: true, speed: 0.5, g: 12, size: 0.12, life: 0.6 });
        }
        const gy = w.height(b.mesh.position.x, b.mesh.position.z);
        if (b.mesh.position.y < gy + 0.06) {
          b.mesh.position.y = gy + 0.06;
          if (b.vel.y < -4 && b.bleeds) this.splat(b.mesh.position.x, b.mesh.position.z, 0.35 + Math.random() * 0.35, '#6a0712', b.vel);
          b.vel.y *= -0.3;
          b.vel.x *= 0.5;
          b.vel.z *= 0.5;
          b.spin.multiplyScalar(0.5);
          if (Math.abs(b.vel.y) < 1.2) {
            b.landed = true;
            if (b.flat) b.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * TAU);
          }
        }
      }
      if (b.life < 1) b.mesh.scale.multiplyScalar(Math.max(0.001, 1 - dt * 3));
    }
    this.gibs = this.gibs.filter((b) => {
      if (b.life <= 0) g.scene.remove(b.mesh);
      return b.life > 0;
    });
  }
}
