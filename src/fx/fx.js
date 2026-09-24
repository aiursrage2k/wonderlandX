// GPU particle pools (additive glow + alpha "matter"), ground rings, beams.

import * as THREE from 'three';
import { rand, TAU } from '../engine/util.js';

const VERT = `
  attribute float size; attribute vec4 pcolor;
  varying vec4 vColor; uniform float scale;
  void main(){
    vColor = pcolor;
    vec4 mv = modelViewMatrix * vec4(position,1.0);
    gl_PointSize = size * scale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = `
  uniform sampler2D map; varying vec4 vColor;
  void main(){
    vec4 t = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
    if (gl_FragColor.a < 0.004) discard;
  }`;

class Pool {
  constructor(scene, tex, cap, additive) {
    this.cap = cap;
    this.n = 0;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    this.p = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 600 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
  }

  add(o) {
    if (this.p.length >= this.cap) this.p.shift();
    this.p.push(o);
  }

  update(dt, groundFn) {
    const arr = this.p;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const q = arr[i];
      q.life -= dt;
      if (q.life <= 0) continue;
      q.vy -= q.g * dt;
      const drag = Math.exp(-q.drag * dt);
      q.vx *= drag;
      q.vy *= drag;
      q.vz *= drag;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.g > 0 && groundFn) {
        const gy = groundFn(q.x, q.z);
        if (q.y < gy + 0.05) {
          q.y = gy + 0.05;
          q.vy *= -0.3;
          q.vx *= 0.6;
          q.vz *= 0.6;
        }
      }
      arr[w++] = q;
    }
    arr.length = w;
    for (let i = 0; i < w; i++) {
      const q = arr[i];
      const k = q.life / q.max;
      this.pos[i * 3] = q.x;
      this.pos[i * 3 + 1] = q.y;
      this.pos[i * 3 + 2] = q.z;
      this.col[i * 4] = q.r;
      this.col[i * 4 + 1] = q.gc;
      this.col[i * 4 + 2] = q.b;
      this.col[i * 4 + 3] = q.a * Math.min(1, k * 2.5);
      this.size[i] = q.s0 * (q.grow ? 1 + (1 - k) * q.grow : k * 0.7 + 0.3);
    }
    this.geo.setDrawRange(0, w);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.pcolor.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}

const tmpC = new THREE.Color();

export class FX {
  constructor(scene, glowTex, world) {
    this.scene = scene;
    this.world = world;
    this.glow = new Pool(scene, glowTex, 5000, true);
    this.matter = new Pool(scene, glowTex, 4500, false);
    this.rings = [];
    this.beams = [];
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 64);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1, 48);
    this.discGeo.rotateX(-Math.PI / 2);
    this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    this.beamGeo.rotateX(Math.PI / 2);
    this.beamGeo.translate(0, 0, 0.5);
  }

  setScale(h) {
    this.glow.mat.uniforms.scale.value = h * 0.9;
    this.matter.mat.uniforms.scale.value = h * 0.9;
  }

  spark(x, y, z, color, o = {}) {
    tmpC.set(color);
    const sp = o.speed ?? 6;
    const a = rand() * TAU;
    const e = (rand() - 0.3) * Math.PI * 0.8;
    const pool = o.matter ? this.matter : this.glow;
    const life = (o.life ?? 0.5) * (0.6 + rand() * 0.8);
    pool.add({
      x, y, z,
      vx: Math.cos(a) * Math.cos(e) * sp * (0.3 + rand()) + (o.vx || 0),
      vy: Math.sin(e) * sp * (0.3 + rand()) + (o.vy || 0),
      vz: Math.sin(a) * Math.cos(e) * sp * (0.3 + rand()) + (o.vz || 0),
      g: o.g ?? 9,
      drag: o.drag ?? 1.5,
      life, max: life,
      r: tmpC.r, gc: tmpC.g, b: tmpC.b, a: o.a ?? 1,
      s0: (o.size ?? 0.25) * (0.6 + rand() * 0.8),
      grow: o.grow,
    });
  }

  burst(pos, n, color, o = {}) {
    for (let i = 0; i < n; i++) this.spark(pos.x, pos.y, pos.z, color, o);
  }

  // A soft glow that just sits and fades (muzzle flash, impact bloom).
  flash(pos, color, size = 2, life = 0.15) {
    tmpC.set(color);
    this.glow.add({ x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, life, max: life, r: tmpC.r, gc: tmpC.g, b: tmpC.b, a: 1, s0: size, grow: 0.5 });
  }

  trail(pos, color, size = 0.2, life = 0.25, a = 0.8) {
    tmpC.set(color);
    this.glow.add({ x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0.2, vz: 0, g: 0, drag: 0, life, max: life, r: tmpC.r, gc: tmpC.g, b: tmpC.b, a, s0: size });
  }

  smoke(pos, color = '#1a1020', n = 6, size = 1.2) {
    for (let i = 0; i < n; i++) {
      tmpC.set(color);
      const life = 0.8 + rand() * 0.8;
      this.matter.add({
        x: pos.x + (rand() - 0.5), y: pos.y + rand() * 0.5, z: pos.z + (rand() - 0.5),
        vx: (rand() - 0.5) * 2, vy: 1 + rand() * 1.5, vz: (rand() - 0.5) * 2, g: 0, drag: 1.2,
        life, max: life, r: tmpC.r, gc: tmpC.g, b: tmpC.b, a: 0.55, s0: size * (0.6 + rand() * 0.6), grow: 1.5,
      });
    }
  }

  // Expanding / static ground ring. Returns a handle that can be killed.
  ring(x, z, o = {}) {
    const m = new THREE.Mesh(
      o.fill ? this.discGeo : this.ringGeo,
      new THREE.MeshBasicMaterial({ color: o.color || '#ff3040', transparent: true, opacity: o.opacity ?? 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    const y = (o.y ?? this.world.height(x, z)) + 0.12;
    m.position.set(x, y, z);
    m.renderOrder = 3;
    this.scene.add(m);
    const r = { mesh: m, t: 0, dur: o.dur ?? 0.5, r0: o.r0 ?? 0.2, r1: o.r1 ?? 4, fade: o.fade ?? true, pulse: o.pulse, follow: o.follow, dead: false };
    m.scale.setScalar(r.r0);
    this.rings.push(r);
    return r;
  }

  // Telegraph: a flat cone/sector on the ground that fills from the centre
  // over `dur`, then flashes. yaw = facing (0 = +Z), arc in radians.
  sector(x, z, yaw, arc, radius, dur, o = {}) {
    const color = o.color || '#ff2030';
    const geo = new THREE.CircleGeometry(1, 40, -arc / 2, arc);
    geo.rotateX(-Math.PI / 2);
    const mk = (opacity) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const outline = mk(0.18);
    const fill = mk(0.45);
    const y = (o.y ?? this.world.height(x, z)) + 0.14;
    for (const m of [outline, fill]) {
      m.position.set(x, y, z);
      // CircleGeometry's 0 angle is +X; rotate so the cone faces `yaw`
      m.rotation.y = yaw - Math.PI / 2;
      m.renderOrder = 3;
      this.scene.add(m);
    }
    outline.scale.setScalar(radius);
    fill.scale.setScalar(0.01);
    const h = { outline, fill, t: 0, dur, radius, dead: false, follow: o.follow, yawFn: o.yawFn };
    (this.sectors ||= []).push(h);
    return h;
  }

  beam(from, to, o = {}) {
    const m = new THREE.Mesh(
      this.beamGeo,
      new THREE.MeshBasicMaterial({ color: o.color || '#b080ff', transparent: true, opacity: o.opacity ?? 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.renderOrder = 6;
    this.scene.add(m);
    const b = { mesh: m, from: from.clone(), to: to.clone(), t: 0, dur: o.dur ?? 0.15, w: o.width ?? 0.08, dead: false };
    this.placeBeam(b);
    this.beams.push(b);
    return b;
  }

  placeBeam(b) {
    const d = b.to.clone().sub(b.from);
    const len = d.length();
    b.mesh.position.copy(b.from);
    b.mesh.lookAt(b.to);
    b.mesh.scale.set(b.w, b.w, len);
  }

  update(dt) {
    const gfn = (x, z) => this.world.height(x, z);
    this.glow.update(dt, gfn);
    this.matter.update(dt, gfn);
    for (const r of this.rings) {
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const s = r.r0 + (r.r1 - r.r0) * (r.pulse ? 1 : 1 - (1 - k) ** 2);
      r.mesh.scale.setScalar(s);
      if (r.follow) {
        r.mesh.position.x = r.follow.x;
        r.mesh.position.z = r.follow.z;
        r.mesh.position.y = this.world.height(r.follow.x, r.follow.z) + 0.12;
      }
      if (r.pulse) r.mesh.material.opacity = 0.35 + 0.35 * Math.sin(r.t * 14) * (0.4 + k);
      else if (r.fade) r.mesh.material.opacity = (1 - k) * 0.9;
      if (k >= 1 && !r.hold) r.dead = true;
    }
    this.rings = this.rings.filter((r) => {
      if (r.dead) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
      }
      return !r.dead;
    });
    for (const h of this.sectors || []) {
      h.t += dt;
      const k = Math.min(1, h.t / h.dur);
      if (h.follow) {
        for (const m of [h.outline, h.fill]) {
          m.position.x = h.follow.x;
          m.position.z = h.follow.z;
        }
      }
      if (h.yawFn) {
        const y = h.yawFn() - Math.PI / 2;
        h.outline.rotation.y = h.fill.rotation.y = y;
      }
      h.fill.scale.setScalar(Math.max(0.01, h.radius * k));
      h.outline.material.opacity = 0.14 + 0.12 * Math.sin(h.t * 20);
      if (k >= 1) {
        h.fill.material.opacity = Math.max(0, 0.9 - (h.t - h.dur) * 6);
        if (h.t > h.dur + 0.15) h.dead = true;
      }
    }
    if (this.sectors) {
      this.sectors = this.sectors.filter((h) => {
        if (h.dead) {
          for (const m of [h.outline, h.fill]) {
            this.scene.remove(m);
            m.material.dispose();
          }
          h.outline.geometry.dispose();
        }
        return !h.dead;
      });
    }
    for (const b of this.beams) {
      b.t += dt;
      const k = b.t / b.dur;
      b.mesh.material.opacity = Math.max(0, 1 - k);
      if (b.update) b.update(b);
      this.placeBeam(b);
      if (k >= 1 && !b.hold) b.dead = true;
    }
    this.beams = this.beams.filter((b) => {
      if (b.dead) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
      }
      return !b.dead;
    });
  }

  clear() {
    for (const h of this.sectors || []) h.dead = true;
    for (const r of this.rings) r.dead = true;
    for (const b of this.beams) b.dead = true;
    this.glow.p.length = 0;
    this.matter.p.length = 0;
    this.update(0);
  }
}
