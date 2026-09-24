// Tweedledum and Tweedledee: the two minibosses that hold the Hatter's seals.
// Each waits at a tea table hidden somewhere in the Clockwork Wastes; deliver
// the Hatter's invitation to summon them. Kill both and the Looking Glass
// comes unsealed.
//   Tweedledum — a giant rattle: triple sweeping swings and belly-flops
//   Tweedledee — a great umbrella: rolling charges and umbrella storms

import * as THREE from 'three';
import { Enemy, REGISTRY } from './enemies.js';
import { buildTeaTable } from '../gfx/models.js';
import { rollItem } from './items.js';
import { rand, lerp, angleDiff, TAU } from '../engine/util.js';
import { sfx, setMusic } from '../engine/audio.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ───────────────────────── the twins' model ─────────────────────────
function buildTweedle(dum) {
  const stripe = dum ? '#c01830' : '#2050b0';
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const add = (g, m, parent, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const jersey = canvasTex(128, 128, (x) => {
    x.fillStyle = '#f2d24a';
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = stripe;
    for (let y = 0; y < 128; y += 32) x.fillRect(0, y, 128, 16);
  });
  jersey.wrapS = jersey.wrapT = THREE.RepeatWrapping;
  jersey.repeat.set(3, 3);
  const shirt = new THREE.MeshStandardMaterial({ map: jersey, roughness: 0.75 });
  const shorts = new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: '#f2d0b8', roughness: 0.55 });
  const white = new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a1014', roughness: 0.5 });
  const capMat = new THREE.MeshStandardMaterial({ color: stripe, roughness: 0.6 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d8b050', metalness: 0.8, roughness: 0.3 });
  // stubby legs in striped socks and buckled shoes
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.45, 0.85, 0);
    body.add(hip);
    add(new THREE.CylinderGeometry(0.2, 0.17, 0.75, 10), shirt, hip, 0, -0.4, 0);
    add(new THREE.SphereGeometry(0.24, 12, 8), dark, hip, 0, -0.8, 0.12).scale.set(1, 0.6, 1.5);
    add(new THREE.BoxGeometry(0.14, 0.08, 0.04), gold, hip, 0, -0.76, 0.46);
    legs.push(hip);
  }
  const torso = new THREE.Group();
  torso.position.y = 0.8;
  body.add(torso);
  // the round belly in a striped jersey, over little shorts
  add(new THREE.SphereGeometry(1.0, 28, 22), shirt, torso, 0, 1.0, 0).scale.set(1, 1.1, 0.95);
  add(new THREE.SphereGeometry(0.98, 24, 12, 0, TAU, Math.PI * 0.62, Math.PI * 0.38), shorts, torso, 0, 1.0, 0).scale.set(1.03, 1.12, 0.98);
  add(new THREE.TorusGeometry(0.93, 0.07, 6, 32), dark, torso, 0, 0.62, 0).rotation.x = Math.PI / 2;
  // the collar embroidered with their name
  const collar = add(new THREE.TorusGeometry(0.46, 0.12, 8, 24), white, torso, 0, 2.02, 0);
  collar.rotation.x = Math.PI / 2;
  const tag = canvasTex(128, 48, (x) => {
    x.fillStyle = '#f4efe4';
    x.fillRect(0, 0, 128, 48);
    x.fillStyle = '#6a0a18';
    x.font = 'bold 34px Georgia, serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(dum ? 'DUM' : 'DEE', 64, 26);
  });
  const tagMesh = add(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshStandardMaterial({ map: tag, roughness: 0.7 }), torso, 0, 1.94, 0.56);
  tagMesh.rotation.x = -0.3;
  tagMesh.castShadow = false;
  // the big round head: cheeks, grin, a propeller beanie
  const head = new THREE.Group();
  head.position.y = 2.6;
  torso.add(head);
  add(new THREE.SphereGeometry(0.62, 24, 18), skin, head);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: '#f09098', roughness: 0.6 }), head, s * 0.34, -0.08, 0.44).scale.set(1, 0.8, 0.5);
    add(new THREE.SphereGeometry(0.075, 10, 8), dark, head, s * 0.2, 0.14, 0.55);
    add(new THREE.SphereGeometry(0.025, 6, 4), white, head, s * 0.2 + 0.02, 0.17, 0.62);
    const brow = add(new THREE.BoxGeometry(0.2, 0.04, 0.04), dark, head, s * 0.2, 0.3, 0.54);
    brow.rotation.z = s * -0.25;
    add(new THREE.SphereGeometry(0.16, 10, 8), skin, head, s * 0.62, 0.0, 0).scale.set(0.5, 1, 0.8);
  }
  add(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: '#e8a890', roughness: 0.5 }), head, 0, 0.02, 0.62);
  const grin = add(new THREE.TorusGeometry(0.26, 0.05, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: '#4a0810' }), head, 0, -0.14, 0.5);
  grin.rotation.z = Math.PI;
  grin.scale.set(1.1, 0.7, 0.6);
  add(new THREE.SphereGeometry(0.63, 20, 10, 0, TAU, 0, Math.PI * 0.42), capMat, head, 0, 0.05, 0);
  add(new THREE.TorusGeometry(0.5, 0.04, 6, 24), gold, head, 0, 0.33, 0).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6), dark, head, 0, 0.72, 0);
  const prop = new THREE.Group();
  prop.position.y = 0.86;
  head.add(prop);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.55, 0.03, 0.12), dum ? gold : new THREE.MeshStandardMaterial({ color: '#40a0ff', roughness: 0.5 }), prop, s * 0.28, 0, 0);
  // short arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.95, 1.55, 0);
    torso.add(sh);
    add(new THREE.CylinderGeometry(0.17, 0.14, 0.7, 10), shirt, sh, 0, -0.35, 0);
    add(new THREE.SphereGeometry(0.17, 10, 8), white, sh, 0, -0.78, 0);
    arms.push(sh);
  }
  // their weapons: Dum's giant rattle, Dee's great umbrella
  const weapon = new THREE.Group();
  weapon.position.set(0, -0.8, 0.1);
  arms[1].add(weapon);
  let canopy = null;
  if (dum) {
    add(new THREE.CylinderGeometry(0.07, 0.09, 1.6, 8), new THREE.MeshStandardMaterial({ color: '#8a5a30', roughness: 0.6 }), weapon, 0, 0.6, 0);
    const ball = add(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshStandardMaterial({ map: jersey, roughness: 0.4 }), weapon, 0, 1.6, 0);
    ball.scale.set(1, 0.85, 1);
    add(new THREE.TorusGeometry(0.56, 0.05, 6, 24), gold, weapon, 0, 1.6, 0).rotation.x = Math.PI / 2;
  } else {
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), dark, weapon, 0, 1.0, 0);
    add(new THREE.TorusGeometry(0.16, 0.04, 6, 12, Math.PI), dark, weapon, 0.16, -0.2, 0).rotation.z = Math.PI;
    canopy = add(new THREE.ConeGeometry(1.4, 0.8, 10, 1, true), new THREE.MeshStandardMaterial({ map: jersey, roughness: 0.6, side: THREE.DoubleSide }), weapon, 0, 2.0, 0);
  }
  return { root, parts: { body, torso, head, legs, arms, prop, weapon, canopy } };
}

// ───────────────────────── Tweedle (shared brain) ─────────────────────────
class Tweedle extends Enemy {
  constructor(game, x, z, o, dum) {
    super(game, buildTweedle(dum), x, z, { ...o, hp: 1250, gold: 160, xp: 260, elite: null, boss: true });
    this.dum = dum;
    this.name = dum ? 'Tweedledum' : 'Tweedledee';
    this.subtitle = dum ? '“Contrariwise!” — and a very large rattle' : '“Nohow!” — and a very large umbrella';
    this.boss = true;
    this.radius = 1.2;
    this.height = 4.2;
    this.hitR = 1.5;
    this.hitOffset = 1.9;
    this.speed = dum ? 5.2 : 4.6;
    this.cooldown = 1.5;
    this.scale = 1.1;
    this.dashDir = new THREE.Vector3();
    this.gibKinds = ['flesh', 'chunk', 'card', 'flesh'];
    this.bloodColor = '#b01020';
  }

  get enraged() {
    return this.hp < this.maxHp * 0.5;
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.distToPlayer();
    const parts = this.parts;
    this.cooldown -= dt;
    if (this.enraged && !this.tantrum) {
      this.tantrum = true;
      g.hud.banner(`${this.name} throws a tantrum!`, 'Faster now — and angrier.', '#ff6040', dum(this) ? '🪀' : '☂️');
      sfx('boss');
    }
    let walk = 0;
    if (this.state === 'chase') {
      const want = this.dum ? 0 : 9;
      if (d > want + 2) {
        this.steer(p.pos.x, p.pos.z, this.speed * (this.enraged ? 1.25 : 1), dt);
        walk = 1;
      } else this.vel.multiplyScalar(Math.exp(-6 * dt));
      this.faceToward(p.pos.x, p.pos.z, dt, 6);
      if (this.cooldown <= 0 && p.alive) {
        this.t = 0;
        this.didHit = false;
        this.fired = 0;
        if (this.dum) this.state = d < 6.5 && rand() < 0.65 ? 'rattle' : 'flop';
        else this.state = d > 7 && rand() < 0.6 ? 'roll' : 'brolly';
        this.begin();
      }
    } else if (this.dum) this.dumAttack(dt, d);
    else this.deeAttack(dt, d);
    // animation: waddle, bounce, spin the propeller
    const ph = this.t * 8;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const sw = walk ? Math.min(1, hs / 4) * 0.6 : 0;
    parts.legs[0].rotation.x = Math.sin(ph) * sw;
    parts.legs[1].rotation.x = -Math.sin(ph) * sw;
    parts.torso.rotation.z = Math.sin(ph) * 0.08 * sw;
    parts.torso.position.y = 0.8 + Math.abs(Math.sin(ph)) * 0.1 * sw;
    parts.prop.rotation.y += dt * (6 + hs * 3 + (this.state === 'flop' || this.state === 'brolly' ? 30 : 0));
    parts.head.rotation.z = Math.sin(this.t * 1.7) * 0.06;
  }

  begin() {
    const g = this.game;
    const p = g.player;
    sfx('telegraph');
    switch (this.state) {
      case 'rattle':
        g.hud.warn('Rattle Rattle', 'three swings — step out of the cones', 1.1);
        this.swingSector();
        break;
      case 'flop':
        g.hud.warn('Belly Flop', 'move — then JUMP the shockwave', 1.2);
        break;
      case 'roll':
        g.hud.warn('Rolling Charge', 'dodge sideways', 1.0);
        this.aimRoll();
        break;
      case 'brolly':
        g.hud.warn('Umbrella Storm', 'find the gaps', 1.0);
        break;
    }
    void p;
  }

  swingSector() {
    const g = this.game;
    g.fx.sector(this.pos.x, this.pos.z, this.yaw, 2.1, 6, 0.55, { follow: this.pos, yawFn: () => this.yaw });
  }

  // Tweedledum: rattle swings and belly flops
  dumAttack(dt, d) {
    const g = this.game;
    const p = g.player;
    const parts = this.parts;
    if (this.state === 'rattle') {
      const swings = this.enraged ? 4 : 3;
      const per = this.enraged ? 0.5 : 0.62;
      const k = this.t - this.fired * per;
      this.vel.multiplyScalar(Math.exp(-6 * dt));
      if (k < per * 0.7) this.faceToward(p.pos.x, p.pos.z, dt, 4);
      parts.arms[1].rotation.x = k < per * 0.85 ? -2.6 * (k / (per * 0.85)) : 0.6;
      parts.arms[1].rotation.z = this.fired % 2 ? 0.8 : -0.8;
      if (k > per * 0.88) {
        this.fired++;
        const fwd = tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        const to = tmp2.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z);
        if (to.length() < 6.2 && fwd.dot(to.normalize()) > Math.cos(1.05)) p.hurt(18 * this.dmgMult, this);
        this.vel.addScaledVector(fwd, 7);
        const c = this.pos.clone().addScaledVector(fwd, 3);
        g.fx.burst(c.setY(c.y + 1), 20, '#ffd060', { speed: 9, size: 0.3, life: 0.35 });
        g.camShake(0.25);
        sfx('slash3');
        if (this.fired < swings) this.swingSector();
      }
      if (this.fired >= swings && k > 0.4) this.end(1.3);
      return;
    }
    if (this.state === 'flop') {
      const flops = this.enraged ? 2 : 1;
      if (!this.flight && this.fired < flops && this.t > 0.35) {
        const target = new THREE.Vector3(p.pos.x + p.vel.x * 0.5, 0, p.pos.z + p.vel.z * 0.5);
        target.y = g.world.height(target.x, target.z);
        this.flight = { from: this.pos.clone(), to: target, t: 0, dur: 1.05 };
        g.fx.ring(target.x, target.z, { r0: 4.4, r1: 4.4, dur: 1.05, color: '#ff3040', pulse: true, fill: true, opacity: 0.32 });
        sfx('dash');
      }
      if (this.flight) {
        const f = this.flight;
        f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        this.pos.x = lerp(f.from.x, f.to.x, k);
        this.pos.z = lerp(f.from.z, f.to.z, k);
        this.vel.set(0, 0, 0);
        this.airY = Math.sin(k * Math.PI) * 9;
        parts.torso.rotation.x = -k * 0.6;
        if (k >= 1) {
          this.flight = null;
          this.airY = 0;
          parts.torso.rotation.x = 0;
          this.fired++;
          this.t = 0;
          this.slam(f.to);
        }
        return;
      }
      if (this.fired >= flops && this.t > 0.9) this.end(1.6);
    }
  }

  slam(at) {
    const g = this.game;
    const p = g.player;
    const R = 4.4;
    g.fx.burst(at.clone().setY(at.y + 0.4), 40, '#d8c8a0', { matter: true, speed: 12, g: 16, size: 0.4, life: 0.8 });
    g.fx.ring(at.x, at.z, { r0: R, r1: 16, dur: 0.75, color: '#ff8060' });
    g.camShake(0.7);
    sfx('slam');
    if (p.alive && Math.hypot(p.pos.x - at.x, p.pos.z - at.z) < R && p.pos.y - g.world.height(p.pos.x, p.pos.z) < 1.2) p.hurt(26 * this.dmgMult, this);
    // the shockwave rolls outward: jump it
    let t = 0;
    let hit = false;
    g.addTicker((dt) => {
      t += dt;
      const rr = R + (16 - R) * Math.min(1, t / 0.75);
      if (!hit && p.alive) {
        const dd = Math.hypot(p.pos.x - at.x, p.pos.z - at.z);
        if (Math.abs(dd - rr) < 1.0 && p.pos.y - g.world.height(p.pos.x, p.pos.z) < 0.8) {
          hit = true;
          p.hurt(14 * this.dmgMult, this);
        }
      }
      return t < 0.75;
    });
  }

  // Tweedledee: rolling charges and umbrella storms
  aimRoll() {
    const g = this.game;
    const p = g.player;
    this.dashDir.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
    const end = this.pos.clone().addScaledVector(this.dashDir, 24);
    g.fx.beam(this.pos.clone().setY(this.pos.y + 0.3), end.setY(g.world.height(end.x, end.z) + 0.3), { color: '#ff2040', width: 2.2, dur: 0.85, opacity: 0.35 });
  }

  deeAttack(dt, d) {
    const g = this.game;
    const p = g.player;
    const parts = this.parts;
    if (this.state === 'roll') {
      const rolls = this.enraged ? 2 : 1;
      const per = 2.0;
      const k = this.t - this.fired * per;
      if (k < 0.85) {
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        parts.torso.rotation.x = lerp(parts.torso.rotation.x, 0.6, 1 - Math.exp(-6 * dt));
      } else if (k < 1.9) {
        this.vel.set(this.dashDir.x * 22, this.vel.y, this.dashDir.z * 22);
        parts.torso.rotation.x += dt * 16;
        if (!this.didHit && p.alive && this.distToPlayer() < 2.4) {
          this.didHit = true;
          if (p.hurt(22 * this.dmgMult, this)) p.vel.addScaledVector(this.dashDir, 14).setY(8);
        }
        if (Math.random() < 0.5) g.fx.burst(this.pos.clone().setY(this.pos.y + 0.2), 3, '#b8a888', { matter: true, speed: 4, g: 10, size: 0.3, life: 0.5 });
      } else {
        this.fired++;
        this.didHit = false;
        parts.torso.rotation.x = 0;
        if (this.fired < rolls) {
          this.aimRoll();
          sfx('telegraph');
        } else this.end(1.4);
      }
      return;
    }
    if (this.state === 'brolly') {
      this.vel.multiplyScalar(Math.exp(-8 * dt));
      const waves = this.enraged ? 4 : 3;
      if (parts.canopy) parts.canopy.scale.setScalar(lerp(parts.canopy.scale.x, 1.6, 1 - Math.exp(-6 * dt)));
      parts.arms[1].rotation.x = -2.8;
      parts.weapon.rotation.y += dt * 10;
      if (this.t > 0.7 + this.fired * 0.55 && this.fired < waves) {
        this.fired++;
        const from = this.pos.clone().setY(this.pos.y + 2.2);
        const n = 12;
        const off = this.fired * 0.22;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + off;
          const dir = new THREE.Vector3(Math.sin(a), -0.05, Math.cos(a)).normalize();
          g.combat.spawnEnemyShot('tea', from, dir.multiplyScalar(14), 9 * this.dmgMult, { size: 1.3, life: 2.4 });
        }
        sfx('cards');
      }
      if (this.t > 0.9 + waves * 0.55) {
        if (parts.canopy) parts.canopy.scale.setScalar(1);
        this.end(1.3);
      }
    }
  }

  integrate(dt) {
    super.integrate(dt);
    if (this.airY) {
      this.pos.y = this.game.world.height(this.pos.x, this.pos.z) + this.airY;
      this.vel.y = 0;
    }
  }

  end(cd) {
    this.state = 'chase';
    this.t = 0;
    this.didHit = false;
    this.parts.arms[1].rotation.set(0, 0, 0);
    this.parts.weapon.rotation.y = 0;
    this.cooldown = cd * (this.enraged ? 0.7 : 1);
  }

  onDeath() {
    const g = this.game;
    const c = this.hitCenter(new THREE.Vector3());
    g.gore.explode(c, this.lastHitDir, { gibs: this.gibKinds, count: 14, scale: 2 });
    g.fx.burst(c, 60, this.dum ? '#ff4050' : '#4080ff', { speed: 14, size: 0.45, life: 1 });
    g.fx.ring(this.pos.x, this.pos.z, { r0: 1, r1: 14, dur: 0.7, color: '#ffd060' });
    g.camShake(0.9);
    sfx('bell');
    const drops = [rollItem(rand, { legendary: 0.08, uncommon: 0.7 }), rollItem(rand, { legendary: 0.02, uncommon: 0.3 })];
    drops.forEach((it, i) => g.spawnPickup(it, c, new THREE.Vector3(Math.cos(i * 3) * 4, 11, Math.sin(i * 3) * 4)));
    g.twinsDown = (g.twinsDown || 0) + 1;
    const left = 2 - g.twinsDown;
    g.hud.banner(`${this.name} Is Broken`, left > 0 ? `“${this.dum ? 'Contrariwise' : 'Nohow'}…” One seal shatters. ${this.dum ? 'Tweedledee' : 'Tweedledum'} still waits at the other table.` : 'The second seal shatters. The Hatter’s Looking Glass is open.', '#ffd060', this.dum ? '🪀' : '☂️');
    if (!g.enemies.some((e) => e !== this && e.alive && e.boss)) setMusic('stage');
  }
}
const dum = (e) => e.dum;

export class Tweedledum extends Tweedle {
  constructor(game, x, z, o) {
    super(game, x, z, o, true);
  }
}
export class Tweedledee extends Tweedle {
  constructor(game, x, z, o) {
    super(game, x, z, o, false);
  }
}
Object.assign(REGISTRY, { tweedledum: Tweedledum, tweedledee: Tweedledee });

// ───────────────────────── the tea-party invitation ─────────────────────────
function invitationTexture(name) {
  return canvasTex(256, 340, (x, W, H) => {
    x.fillStyle = '#f4ead4';
    x.fillRect(0, 0, W, H);
    x.strokeStyle = '#b08a3e';
    x.lineWidth = 8;
    x.strokeRect(10, 10, W - 20, H - 20);
    x.lineWidth = 2;
    x.strokeRect(22, 22, W - 44, H - 44);
    x.fillStyle = '#4a1a10';
    x.textAlign = 'center';
    x.font = 'italic 20px Georgia, serif';
    x.fillText('The Mad Hatter', W / 2, 70);
    x.fillText('requests the pleasure', W / 2, 100);
    x.fillText('of the company of', W / 2, 126);
    x.font = 'bold 30px Georgia, serif';
    x.fillStyle = '#8a1020';
    x.fillText(name, W / 2, 180);
    x.font = 'italic 18px Georgia, serif';
    x.fillStyle = '#4a1a10';
    x.fillText('at a very merry', W / 2, 225);
    x.fillText('unbirthday tea party', W / 2, 250);
    x.font = '26px serif';
    x.fillText('🎩  ☕  🕰️', W / 2, 300);
  });
}

export class TwinTable {
  constructor(game, x, z, type) {
    this.game = game;
    this.kind = 'invite';
    this.type = type;
    this.twinName = type === 'tweedledum' ? 'Tweedledum' : 'Tweedledee';
    const y = game.world.height(x, z);
    this.pos = new THREE.Vector3(x, y, z);
    const root = new THREE.Group();
    root.position.copy(this.pos);
    // a round picnic rug in the twin's colour, a set tea table, and an easel
    const rugTex = canvasTex(256, 256, (c) => {
      c.fillStyle = type === 'tweedledum' ? '#8a1020' : '#1a3a8a';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#f2d24a';
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) c.fillRect(i * 32, j * 32, 32, 32);
    });
    const rug = new THREE.Mesh(new THREE.CircleGeometry(7, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    rug.position.y = 0.05;
    rug.receiveShadow = true;
    root.add(rug);
    const table = buildTeaTable();
    table.root.position.set(0, 0, -2.2);
    table.root.scale.setScalar(1.2);
    root.add(table.root);
    const easel = new THREE.Group();
    easel.position.set(0, 0, 2.2);
    const wood = new THREE.MeshStandardMaterial({ color: '#6a4424', roughness: 0.7 });
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 6), wood);
      leg.position.set(s * 0.5, 1.25, 0);
      leg.rotation.z = s * 0.12;
      easel.add(leg);
    }
    this.cardMat = new THREE.MeshStandardMaterial({ map: invitationTexture(this.twinName), roughness: 0.7, emissive: '#ffd890', emissiveMap: invitationTexture(this.twinName), emissiveIntensity: 0.35 });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.72), this.cardMat);
    card.position.set(0, 1.9, 0.08);
    card.rotation.x = -0.1;
    card.castShadow = true;
    easel.add(card);
    root.add(easel);
    this.easel = easel;
    // two chairs, both empty
    for (const s of [-1, 1]) {
      const chair = new THREE.Group();
      const velvet = new THREE.MeshStandardMaterial({ color: type === 'tweedledum' ? '#8a1020' : '#1a3a8a', roughness: 0.8 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), velvet);
      seat.position.y = 0.7;
      chair.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, 0.15), velvet);
      back.position.set(0, 1.4, -0.45);
      chair.add(back);
      chair.position.set(s * 2.6, 0, -2.2);
      chair.rotation.y = -s * 0.4;
      root.add(chair);
    }
    this.model = root;
    game.scene.add(root);
    game.world.addCollider({ x, z: z - 2.2, r: 1.8, top: y + 1.6 });
    this.used = false;
    this.found = false;
  }

  get interactPos() {
    return this.pos.clone().add(new THREE.Vector3(0, 1.2, 2.2));
  }

  label() {
    return `<kbd>E</kbd> Deliver the Hatter’s invitation <span style="color:#ffb040">(summons ${this.twinName})</span>`;
  }

  interact() {
    const g = this.game;
    this.used = true;
    const e = g.director.spawn(this.type, this.pos.x, this.pos.z + 7, null);
    e.cooldown = 1.8;
    g.hud.banner(this.twinName, this.type === 'tweedledum' ? '“Contrariwise, if it was so, it might be; and if it were so, it would be.”' : '“If you think we’re wax-works, you ought to pay, you know.”', this.type === 'tweedledum' ? '#ff5060' : '#60a0ff', this.type === 'tweedledum' ? '🪀' : '☂️');
    g.camShake(0.5);
    sfx('boss');
    setMusic('boss');
    // clear the crowd so the duel stays readable
    const others = g.enemies.filter((q) => q.alive && !q.boss).sort((a, b) => b.distToPlayer() - a.distToPlayer());
    for (const q of others.slice(0, Math.max(0, others.length - 3))) {
      q.alive = false;
      q.deadT = 0.6;
    }
  }

  update(dt) {
    const g = this.game;
    const t = g.time;
    this.cardMat.emissiveIntensity = this.used ? 0.1 : 0.35 + Math.sin(t * 3) * 0.2;
    if (!this.found) {
      const d = Math.hypot(g.player.pos.x - this.pos.x, g.player.pos.z - this.pos.z);
      if (d < 45) {
        this.found = true;
        g.hud.banner('A Tea Table Set for Two', `A place card reads “${this.twinName}”. Deliver the Hatter’s invitation.`, '#ffb040', '☕');
      } else if (g.stageTime > 200 && !this.beam) {
        // the Cheshire Cat points the way
        this.beam = g.fx.beam(this.pos.clone(), this.pos.clone().setY(this.pos.y + 70), { color: this.type === 'tweedledum' ? '#ff4060' : '#4080ff', width: 1.2, dur: 1e9, opacity: 0.35 });
        this.beam.hold = true;
      }
    }
    if (this.beam && (this.found || this.used)) {
      this.beam.dead = true;
      this.beam = null;
    }
  }
}
