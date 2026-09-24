// The Rook Sentinel: a walking chess rook, overgrown with roses, that fires a
// heavy beam from its eye-slit. Risk-of-Rain's Stone Golem in Wonderland
// clothes: slow and tanky, it paints a tracking line on the ground, locks it a
// beat before firing, then scorches everything along it. Up close it stomps.

import * as THREE from 'three';
import { Enemy, REGISTRY, CARDS } from './enemies.js';
import { rand, lerp, TAU } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { mat } from '../gfx/models.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

function buildRook(dark) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const stone = mat(dark ? '#2e2632' : '#ddd4ce', { roughness: 0.55, metalness: 0.05 });
  const trim = mat(dark ? '#141016' : '#b8aca4', { roughness: 0.6 });
  const ivy = mat('#24402a', { roughness: 0.8 });
  const rose = new THREE.MeshStandardMaterial({ color: '#b01020', emissive: '#300004', roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#ff3040', emissive: '#ff1020', emissiveIntensity: 1.2 });
  const add = (g, m, parent, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  // stumpy legs
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.55, 0.7, 0);
    body.add(hip);
    add(new THREE.CylinderGeometry(0.34, 0.42, 0.75, 8), trim, hip, 0, -0.37, 0);
    add(new THREE.BoxGeometry(0.75, 0.25, 0.95), trim, hip, 0, -0.62, 0.1);
    legs.push(hip);
  }
  // the tower: a chess rook turned on a lathe
  const tower = new THREE.Group();
  tower.position.y = 0.6;
  body.add(tower);
  const prof = [[0.001, 0], [1.3, 0], [1.35, 0.22], [1.1, 0.42], [0.95, 0.6], [0.82, 2.2], [1.0, 2.5], [1.18, 2.66], [1.18, 3.2], [0.001, 3.2]];
  add(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 24), stone, tower);
  for (const y of [0.3, 2.62]) add(new THREE.TorusGeometry(y < 1 ? 1.25 : 1.13, 0.07, 6, 28), trim, tower, 0, y, 0).rotation.x = Math.PI / 2;
  // crenellations
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    add(new THREE.BoxGeometry(0.55, 0.5, 0.36), stone, tower, Math.sin(a) * 1.0, 3.42, Math.cos(a) * 1.0).rotation.y = a;
  }
  // the eye: a burning arrow-slit
  const eye = add(new THREE.BoxGeometry(0.85, 0.2, 0.2), eyeMat, tower, 0, 2.3, 0.88);
  eye.castShadow = false;
  // a sprite glow (a real light would recompile every shader on spawn)
  const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ff3040', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  eyeGlow.scale.set(2.2, 1.2, 1);
  eyeGlow.position.set(0, 2.3, 1.0);
  tower.add(eyeGlow);
  // ivy spiralling up, dotted with roses
  const pts = [];
  for (let k = 0; k <= 30; k++) {
    const t = k / 30;
    const a = t * TAU * 1.6 + 0.8;
    const r = t < 0.2 ? 1.25 : 0.92 + t * 0.1;
    pts.push(new THREE.Vector3(Math.sin(a) * r, 0.2 + t * 2.4, Math.cos(a) * r));
  }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.07, 5), ivy, tower);
  for (let k = 3; k < 30; k += 5) add(new THREE.IcosahedronGeometry(0.14, 0), rose, tower, pts[k].x * 1.05, pts[k].y, pts[k].z * 1.05);
  // heavy stone arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 1.25, 2.4, 0);
    tower.add(sh);
    add(new THREE.SphereGeometry(0.42, 10, 8), stone, sh);
    add(new THREE.CylinderGeometry(0.28, 0.24, 1.1, 8), stone, sh, 0, -0.65, 0);
    add(new THREE.BoxGeometry(0.62, 0.6, 0.62), trim, sh, 0, -1.35, 0);
    arms.push(sh);
  }
  return { root, parts: { body, tower, legs, arms, eye, eyeMat, eyeGlow } };
}

export class RookSentinel extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildRook(rand() < 0.4), x, z, { ...o, hp: 260, gold: 42, xp: 40 });
    this.name = 'Rook Sentinel';
    this.radius = 1.3;
    this.height = 4.2;
    this.hitR = 1.5;
    this.hitOffset = 2.4;
    this.speed = 3.0;
    this.cooldown = 2 + rand() * 2;
    this.aim = new THREE.Vector3();
    this.bloodColor = '#6a6060';
    this.lane = this.makeLane();
    this.parts.eyeGlow.material.map = game.glowTex;
  }

  // the ground warning: a long quad that follows the aim, then flares on lock
  makeLane() {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
      new THREE.MeshBasicMaterial({ color: '#ff2030', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.renderOrder = 3;
    m.visible = false;
    this.game.scene.add(m);
    return m;
  }

  eyePos(out) {
    this.parts.eye.getWorldPosition(out);
    return out;
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.distToPlayer();
    const parts = this.parts;
    this.cooldown -= dt;
    let walk = 0;
    switch (this.state) {
      case 'chase':
        if (d > 16) {
          this.steer(p.pos.x, p.pos.z, this.speed, dt);
          walk = 1;
        } else this.vel.multiplyScalar(Math.exp(-6 * dt));
        this.faceToward(p.pos.x, p.pos.z, dt, 3);
        if (this.cooldown <= 0 && p.alive) {
          this.t = 0;
          this.didHit = false;
          if (d < 4.5) {
            this.state = 'stomp';
            g.fx.ring(this.pos.x, this.pos.z, { r0: 5, r1: 5, dur: 0.85, color: '#ff3040', pulse: true, fill: true, opacity: 0.3 });
            sfx('telegraph');
          } else if (d < 42) {
            this.state = 'gaze';
            sfx('telegraph');
          }
        }
        break;
      case 'gaze': {
        // 1.3 s of tracking, then the aim freezes 0.4 s before the shot
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        const locked = this.t > 1.3;
        if (!locked) {
          this.aim.copy(p.center).addScaledVector(p.vel, 0.15);
          this.faceToward(p.pos.x, p.pos.z, dt, 5);
        }
        const k = Math.min(1, this.t / 1.3);
        parts.eyeMat.emissiveIntensity = 1.2 + k * 5 + (locked ? 3 : 0);
        parts.eyeGlow.material.opacity = k * 0.6 + (locked ? 0.4 : 0);
        this.drawLane(locked, k);
        if (this.t > 1.7 && !this.didHit) {
          this.didHit = true;
          this.fire();
        }
        if (this.t > 2.2) this.end(3.5 + rand() * 1.5);
        break;
      }
      case 'stomp':
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        if (this.t > 0.85 && !this.didHit) {
          this.didHit = true;
          g.fx.ring(this.pos.x, this.pos.z, { r0: 0.5, r1: 5.5, dur: 0.35, color: '#ffd0b0' });
          g.fx.burst(this.pos.clone().setY(this.pos.y + 0.3), 30, '#d8d0c8', { matter: true, speed: 9, g: 16, size: 0.35, life: 0.8 });
          g.camShake(0.4);
          sfx('slam');
          if (d < 5.2 && p.pos.y - g.world.height(p.pos.x, p.pos.z) < 0.8 && p.hurt(20 * this.dmgMult)) {
            tmp.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
            p.vel.addScaledVector(tmp, 12).setY(8);
          }
        }
        if (this.t > 1.5) this.end(2.5);
        break;
    }
    // waddle, and arms brace for the shot
    const ph = this.t * 5;
    const sw = walk ? 0.35 : 0;
    parts.legs[0].rotation.x = Math.sin(ph) * sw;
    parts.legs[1].rotation.x = -Math.sin(ph) * sw;
    parts.tower.rotation.z = Math.sin(ph) * 0.05 * walk;
    const brace = this.state === 'gaze' ? -1.2 : this.state === 'stomp' ? (this.t < 0.7 ? -2.6 : 0.2) : 0;
    for (const a of parts.arms) a.rotation.x = lerp(a.rotation.x, brace, 1 - Math.exp(-8 * dt));
    if (this.state !== 'gaze') {
      parts.eyeMat.emissiveIntensity = lerp(parts.eyeMat.emissiveIntensity, 1.2, 1 - Math.exp(-4 * dt));
      parts.eyeGlow.material.opacity = 0;
    }
  }

  drawLane(locked, k) {
    const g = this.game;
    const from = tmp.set(this.pos.x, 0, this.pos.z);
    const dir = tmp2.set(this.aim.x - from.x, 0, this.aim.z - from.z);
    const len = Math.min(44, dir.length() + 10);
    dir.normalize();
    const L = this.lane;
    L.visible = true;
    L.position.set(from.x + dir.x * 1.4, g.world.height(this.aim.x, this.aim.z) + 0.08, from.z + dir.z * 1.4);
    L.rotation.y = Math.atan2(dir.x, dir.z);
    L.scale.set(locked ? 1.5 : 0.35 + k * 0.5, 1, len);
    L.material.opacity = locked ? 0.55 + Math.sin(this.t * 60) * 0.2 : 0.18 + k * 0.2;
    L.material.color.set(locked ? '#ff8090' : '#ff2030');
  }

  fire() {
    const g = this.game;
    const p = g.player;
    const from = this.eyePos(new THREE.Vector3());
    const dir = this.aim.clone().sub(from).normalize();
    const to = from.clone().addScaledVector(dir, 46);
    // stop at the ground
    const hitT = g.world.raycastGround(from, dir, 46);
    if (hitT > 0) to.copy(from).addScaledVector(dir, hitT);
    g.fx.beam(from, to, { color: '#ff2a40', width: 1.4, dur: 0.35, opacity: 0.85 });
    g.fx.beam(from, to, { color: '#ffe0e0', width: 0.45, dur: 0.25, opacity: 0.95 });
    g.fx.flash(from, '#ff3040', 6, 0.25);
    g.fx.burst(to, 30, '#ff5060', { speed: 10, size: 0.4, life: 0.5 });
    g.fx.ring(to.x, to.z, { r0: 0.5, r1: 3, dur: 0.35, color: '#ff8060' });
    g.camShake(0.35);
    sfx('slam');
    this.lane.visible = false;
    // anything within 1.2 m of the beam line takes the hit
    const c = p.center;
    const seg = to.clone().sub(from);
    const u = Math.max(0, Math.min(1, c.clone().sub(from).dot(seg) / seg.lengthSq()));
    const closest = from.clone().addScaledVector(seg, u);
    if (p.alive && closest.distanceTo(c) < 1.2 && p.hurt(30 * this.dmgMult)) {
      p.vel.addScaledVector(dir.setY(0).normalize(), 10).setY(5);
    }
  }

  end(cd) {
    this.state = 'chase';
    this.t = 0;
    this.cooldown = cd;
    this.lane.visible = false;
  }

  onDeath() {
    const g = this.game;
    this.lane.visible = false;
    const c = this.hitCenter(new THREE.Vector3());
    g.fx.burst(c, 60, '#e0d8d0', { matter: true, speed: 10, g: 16, size: 0.5, life: 1.4 });
    g.fx.burst(c, 20, '#b01020', { speed: 6, size: 0.3, life: 0.8 });
    g.fx.smoke(c, '#6a6060', 8, 2);
    g.camShake(0.3);
    sfx('slam');
  }

  deathAnim(dt) {
    // topples over and crumbles
    const k = Math.min(1, this.deadT / 1.0);
    this.model.rotation.x = k * 1.4;
    this.model.position.y = this.pos.y - k * k * 1.5;
  }

  remove() {
    super.remove();
    this.game.scene.remove(this.lane);
  }
}

Object.assign(REGISTRY, { rook: RookSentinel });
Object.assign(CARDS, { rook: { cost: 30, weight: 2, min: 0.5 } });
