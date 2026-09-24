// Enemies, their AI, and the credit-based spawn Director.

import * as THREE from 'three';
import { buildCardGuard, buildTeacup, buildClockWisp, buildWhiteRabbit } from '../gfx/models.js';
import { rand, clamp, lerp, angleDiff, TAU } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { rollItem } from './items.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export const ELITES = [
  { id: 'crimson', name: 'Crimson', color: '#ff2a3a' },
  { id: 'gilded', name: 'Gilded', color: '#ffcf40' },
  { id: 'void', name: 'Voidborne', color: '#9a50ff' },
];

class Enemy {
  constructor(game, built, x, z, o) {
    this.game = game;
    this.model = built.root;
    this.parts = built.parts;
    game.scene.add(this.model);
    this.pos = new THREE.Vector3(x, game.world.height(x, z), z);
    this.vel = new THREE.Vector3();
    this.yaw = rand() * TAU;
    this.level = o.level;
    const hpMult = (1 + 0.3 * (o.level - 1)) * (o.elite ? 3.5 : 1);
    this.maxHp = this.hp = o.hp * hpMult;
    this.dmgMult = (1 + 0.2 * (o.level - 1)) * (o.elite ? 1.8 : 1);
    this.goldValue = o.gold * (1 + 0.25 * (o.level - 1)) * (o.elite ? 3 : 1);
    this.elite = o.elite || null;
    this.alive = true;
    this.state = 'spawn';
    this.t = 0;
    this.spawnT = 0.9;
    this.pop = 0;
    this.bleeds = [];
    this.bleedTick = 0;
    this.deadT = 0;
    this.scale = o.elite ? 1.2 : 1;
    this.phase = rand() * 10;
    this.cooldown = 1 + rand() * 2;
    if (this.elite) this.addEliteAura();
  }

  addEliteAura() {
    const g = this.game;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: g.glowTex, color: this.elite.color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
    sp.scale.set(this.height * 1.6, this.height * 1.6, 1);
    sp.position.y = this.height * 0.5;
    this.model.add(sp);
    this.aura = sp;
    // ground ring instead of a real light (adding lights recompiles every shader)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(this.radius * 1.4, this.radius * 1.9, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: this.elite.color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.position.y = 0.08;
    this.model.add(ring);
  }

  hitCenter(out) {
    return out.set(this.pos.x, this.pos.y + this.hitOffset * this.scale, this.pos.z);
  }

  hurt(dmg, crit, dir) {
    if (!this.alive) return 0;
    this.hp -= dmg;
    this.pop = 1;
    if (dir && !this.boss) {
      tmp.copy(dir).setY(0).normalize();
      this.vel.addScaledVector(tmp, (crit ? 2.5 : 1.2) / this.scale);
    }
    const c = this.hitCenter(tmp2);
    this.game.fx.burst(c, crit ? 10 : 5, this.bloodColor || '#b01020', { matter: true, speed: 5, size: 0.18, life: 0.6, g: 14 });
    if (this.state === 'spawn') this.state = 'chase';
    if (this.hp <= 0) this.die();
    return dmg;
  }

  addBleed(total) {
    this.bleeds.push({ dps: total / 3, t: 3 });
  }

  die() {
    this.alive = false;
    this.hp = 0;
    this.deadT = 0;
    this.onDeath();
  }

  onDeath() {}

  faceToward(x, z, dt, rate = 8) {
    const want = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.yaw += angleDiff(this.yaw, want) * (1 - Math.exp(-rate * dt));
  }

  steer(tx, tz, speed, dt) {
    const g = this.game;
    tmp.set(tx - this.pos.x, 0, tz - this.pos.z);
    const d = tmp.length();
    if (d > 0.01) tmp.multiplyScalar(1 / d);
    // separation
    for (const o of g.enemies) {
      if (o === this || !o.alive || o.flying !== this.flying) continue;
      const dx = this.pos.x - o.pos.x;
      const dz = this.pos.z - o.pos.z;
      const rr = (this.radius + o.radius) * 1.3;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-4) {
        const k = (rr - Math.sqrt(d2)) / rr;
        tmp.x += (dx / Math.sqrt(d2)) * k * 1.5;
        tmp.z += (dz / Math.sqrt(d2)) * k * 1.5;
      }
    }
    const k = 1 - Math.exp(-6 * dt);
    this.vel.x = lerp(this.vel.x, tmp.x * speed, k);
    this.vel.z = lerp(this.vel.z, tmp.z * speed, k);
  }

  integrate(dt) {
    const w = this.game.world;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    w.collide(this.pos, this.radius, this.pos.y);
    if (this.flying) return;
    const gy = w.height(this.pos.x, this.pos.z);
    this.vel.y -= 28 * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= gy) {
      this.pos.y = gy;
      this.vel.y = 0;
      this.grounded = true;
    } else this.grounded = this.pos.y - gy < 0.05;
  }

  baseUpdate(dt) {
    this.t += dt;
    this.pop = Math.max(0, this.pop - dt * 6);
    if (this.bleeds.length) {
      this.bleedTick -= dt;
      if (this.bleedTick <= 0) {
        this.bleedTick = 0.33;
        let dmg = 0;
        for (const b of this.bleeds) {
          dmg += b.dps * 0.33;
          b.t -= 0.33;
        }
        this.bleeds = this.bleeds.filter((b) => b.t > 0);
        if (dmg > 0 && this.alive) {
          this.hp -= dmg;
          this.game.hud.number(this.hitCenter(tmp2).clone().setY(this.pos.y + this.height), Math.round(dmg), 'bleed');
          this.game.fx.burst(this.hitCenter(tmp2), 3, '#900010', { matter: true, speed: 2, size: 0.15, life: 0.5 });
          if (this.hp <= 0) {
            this.die();
            this.game.combat.onKill(this);
          }
        }
      }
    }
  }

  update(dt) {
    this.baseUpdate(dt);
    if (!this.alive) {
      this.deadT += dt;
      this.deathAnim(dt);
      return this.deadT < 1.2;
    }
    if (this.state === 'spawn') {
      this.spawnT -= dt;
      const k = 1 - Math.max(0, this.spawnT) / 0.9;
      this.model.scale.setScalar(this.scale * (0.2 + 0.8 * k));
      if (this.spawnT <= 0) this.state = 'chase';
      this.model.position.copy(this.pos);
      this.model.rotation.y = this.yaw;
      if (!this.flying) this.integrate(dt);
      return true;
    }
    this.think(dt);
    this.integrate(dt);
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;
    const s = this.scale * (1 + this.pop * 0.12);
    this.model.scale.set(s, this.scale * (1 - this.pop * 0.08), s);
    if (this.aura) this.aura.material.opacity = 0.4 + Math.sin(this.t * 6) * 0.15;
    return true;
  }

  deathAnim(dt) {
    const k = Math.min(1, this.deadT / 1.0);
    this.model.scale.setScalar(this.scale * Math.max(0.01, 1 - k * k));
    this.model.rotation.x = k * 1.2;
  }

  remove() {
    this.game.scene.remove(this.model);
  }

  distToPlayer() {
    const p = this.game.player.pos;
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
  }
}

// ───────────────────────── Card Guard ─────────────────────────
const SUITS = ['♥', '♥', '♦', '♠', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J'];
export class CardGuard extends Enemy {
  constructor(game, x, z, o) {
    const suit = SUITS[Math.floor(rand() * SUITS.length)];
    const red = suit === '♥' || suit === '♦';
    super(game, buildCardGuard(suit, RANKS[Math.floor(rand() * RANKS.length)], red ? '#5c0d14' : '#1c1a26'), x, z, { ...o, hp: 110, gold: 9 });
    this.name = 'Card Guard';
    this.radius = 0.55;
    this.height = 2.5;
    this.hitR = 0.85;
    this.hitOffset = 1.35;
    this.speed = 5.6 + rand() * 0.8;
    this.lunge = new THREE.Vector3();
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.distToPlayer();
    const parts = this.parts;
    this.cooldown -= dt;
    switch (this.state) {
      case 'chase': {
        this.steer(p.pos.x, p.pos.z, this.speed, dt);
        this.faceToward(p.pos.x, p.pos.z, dt);
        if (d < 3.6 && this.cooldown <= 0 && p.alive) {
          this.state = 'windup';
          this.t = 0;
          sfx('telegraph');
        }
        break;
      }
      case 'windup': {
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        this.faceToward(p.pos.x, p.pos.z, dt, 12);
        if (this.t > 0.55) {
          this.state = 'lunge';
          this.t = 0;
          this.lunge.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          this.didHit = false;
        }
        break;
      }
      case 'lunge': {
        this.vel.x = this.lunge.x * 15;
        this.vel.z = this.lunge.z * 15;
        const tip = tmp.copy(this.pos).addScaledVector(this.lunge, 1.8);
        tip.y += 1.1;
        if (!this.didHit && tip.distanceTo(p.center) < 1.3) {
          this.didHit = true;
          p.hurt(12 * this.dmgMult);
        }
        if (this.t > 0.22) {
          this.state = 'recover';
          this.t = 0;
        }
        break;
      }
      case 'recover':
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (this.t > 0.6) {
          this.state = 'chase';
          this.cooldown = 1 + rand();
        }
        break;
    }
    // animation
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const ph = this.t * 9 + this.phase;
    const k = clamp(hs / 5, 0, 1.2);
    parts.legs[0].rotation.x = Math.sin(ph) * 0.7 * k;
    parts.legs[1].rotation.x = -Math.sin(ph) * 0.7 * k;
    parts.torso.rotation.z = Math.sin(ph) * 0.06 * k;
    parts.arms[0].sh.rotation.x = -Math.sin(ph) * 0.5 * k;
    let spear = -0.4;
    let armX = -0.8;
    if (this.state === 'windup') {
      armX = -0.4 + Math.min(1, this.t / 0.5) * 0.6;
      spear = -0.1;
      parts.torso.rotation.x = -0.15;
    } else if (this.state === 'lunge') {
      armX = -1.6;
      spear = 0.1;
      parts.torso.rotation.x = 0.25;
    } else parts.torso.rotation.x = k * 0.1;
    parts.arms[1].sh.rotation.x = lerp(parts.arms[1].sh.rotation.x, armX, 1 - Math.exp(-20 * dt));
    parts.spear.rotation.x = spear;
    if (this.state === 'windup' && Math.random() < 0.5) {
      const tipW = parts.spear.localToWorld(tmp2.set(0, 0, 1.7));
      this.game.fx.spark(tipW.x, tipW.y, tipW.z, '#ff3030', { speed: 1, g: 0, size: 0.35, life: 0.2 });
    }
  }

  onDeath() {
    const g = this.game;
    const c = this.hitCenter(new THREE.Vector3());
    g.fx.burst(c, 24, '#efe4d0', { matter: true, speed: 9, size: 0.3, life: 1.4, g: 10 });
    g.fx.burst(c, 16, '#c01020', { matter: true, speed: 7, size: 0.25, life: 1, g: 14 });
    g.fx.burst(c, 12, '#ffb070', { speed: 6, size: 0.3, life: 0.4 });
    g.splat(this.pos.x, this.pos.z, 1.4);
    sfx('cards');
  }
}

// ───────────────────────── Teacup Mimic ─────────────────────────
export class Teacup extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildTeacup(1.1), x, z, { ...o, hp: 85, gold: 11 });
    this.name = 'Teacup Mimic';
    this.radius = 0.7;
    this.height = 1.3;
    this.hitR = 0.85;
    this.hitOffset = 0.75;
    this.speed = 4.6;
    this.hopT = rand();
    this.strafe = rand() < 0.5 ? 1 : -1;
    this.bloodColor = '#6a2008';
    this.cooldown = 1.5 + rand() * 2;
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.distToPlayer();
    this.cooldown -= dt;
    this.faceToward(p.pos.x, p.pos.z, dt, 6);
    if (this.state === 'aim') {
      this.vel.x *= Math.exp(-8 * dt);
      this.vel.z *= Math.exp(-8 * dt);
      this.parts.cup.rotation.z = Math.sin(this.t * 60) * 0.08;
      this.parts.teaMat.emissiveIntensity = 0.6 + this.t * 5;
      if (this.t > 0.55) {
        this.spit();
        this.state = 'chase';
        this.cooldown = 2.6 + rand() * 1.4;
        this.parts.teaMat.emissiveIntensity = 0.6;
      }
    } else {
      // keep a middle distance, circling
      const want = d > 16 ? 1 : d < 8 ? -1 : 0;
      tmp2.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
      const tx = this.pos.x + tmp2.x * want * 4 + -tmp2.z * this.strafe * 3;
      const tz = this.pos.z + tmp2.z * want * 4 + tmp2.x * this.strafe * 3;
      this.hopT -= dt;
      if (this.grounded) {
        this.vel.x *= Math.exp(-6 * dt);
        this.vel.z *= Math.exp(-6 * dt);
        if (this.hopT <= 0) {
          this.hopT = 0.55 + rand() * 0.3;
          this.vel.y = 6;
          tmp.set(tx - this.pos.x, 0, tz - this.pos.z).normalize().multiplyScalar(this.speed * 1.4);
          this.vel.x = tmp.x;
          this.vel.z = tmp.z;
          if (rand() < 0.2) this.strafe *= -1;
        }
      }
      if (d < 2.2 && this.cooldown < 1.5 && p.alive && !this.bit) {
        this.bit = true;
        p.hurt(8 * this.dmgMult);
        this.cooldown = 1.5;
      }
      if (this.cooldown <= 0.8) this.bit = false;
      if (this.cooldown <= 0 && d < 34 && p.alive && this.grounded) {
        this.state = 'aim';
        this.t = 0;
      }
    }
    // squash + tilt
    const air = !this.grounded;
    this.parts.body.scale.y = air ? 1.12 : 1 - Math.max(0, 0.15 - this.hopT * 0.3);
    for (let i = 0; i < 4; i++) this.parts.legs[i].rotation.x = air ? -0.6 : Math.sin(this.t * 12 + i) * 0.1;
    this.parts.teeth.rotation.y += dt * (this.state === 'aim' ? 4 : 0.5);
    if (Math.random() < 0.08) {
      const c = this.hitCenter(tmp2);
      g.fx.smoke(tmp.set(c.x, c.y + 0.6, c.z), '#b8a8b8', 1, 0.35);
    }
  }

  spit() {
    const g = this.game;
    const p = g.player;
    const from = this.hitCenter(new THREE.Vector3());
    from.y += 0.7;
    const d = this.distToPlayer();
    const T = clamp(d / 17, 0.6, 1.5);
    const target = p.pos.clone().addScaledVector(p.vel, T * 0.55);
    target.y = g.world.height(target.x, target.z);
    const v = new THREE.Vector3((target.x - from.x) / T, 0, (target.z - from.z) / T);
    v.y = (target.y - from.y + 0.5 * 20 * T * T) / T;
    g.combat.spawnEnemyShot('tea', from, v, 13 * this.dmgMult, { gravity: 20, splash: 2.4, size: 1.3 });
    g.fx.ring(target.x, target.z, { r0: 2.4, r1: 2.4, dur: T, color: '#ff2020', pulse: true });
    g.fx.burst(from, 8, '#ff8030', { speed: 4, size: 0.3, life: 0.4 });
    sfx('boil');
  }

  onDeath() {
    const g = this.game;
    const c = this.hitCenter(new THREE.Vector3());
    g.fx.burst(c, 30, '#f2ece0', { matter: true, speed: 10, size: 0.22, life: 1.4, g: 16 });
    g.fx.burst(c, 14, '#c9a04a', { speed: 8, size: 0.2, life: 0.6 });
    g.fx.burst(c, 20, '#5a1a06', { matter: true, speed: 6, size: 0.3, life: 1, g: 14 });
    g.splat(this.pos.x, this.pos.z, 1.6, '#3a1004');
    sfx('shatter');
  }
}

// ───────────────────────── Clockwork Wisp ─────────────────────────
export class ClockWisp extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildClockWisp(), x, z, { ...o, hp: 60, gold: 8 });
    this.name = 'Clockwork Wisp';
    this.flying = true;
    this.radius = 0.6;
    this.height = 1;
    this.hitR = 0.75;
    this.hitOffset = 0;
    this.hover = 4 + rand() * 4;
    this.pos.y += this.hover;
    this.orbit = rand() * TAU;
    this.orbitDir = rand() < 0.5 ? 1 : -1;
    this.bloodColor = '#c9a04a';
    this.volley = 0;
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    this.cooldown -= dt;
    this.orbit += dt * 0.35 * this.orbitDir;
    const R = 13 + Math.sin(this.t * 0.4 + this.phase) * 3;
    const tx = p.pos.x + Math.cos(this.orbit) * R;
    const tz = p.pos.z + Math.sin(this.orbit) * R;
    const charging = this.state === 'charge';
    this.steer(tx, tz, charging ? 1 : 6, dt);
    const gy = g.world.height(this.pos.x, this.pos.z) + this.hover + Math.sin(this.t * 1.7 + this.phase) * 0.6;
    this.pos.y = lerp(this.pos.y, Math.max(gy, p.pos.y + 3), 1 - Math.exp(-2 * dt));
    this.faceToward(p.pos.x, p.pos.z, dt, 5);
    if (this.state === 'chase' && this.cooldown <= 0 && p.alive) {
      this.state = 'charge';
      this.t = 0;
      this.teleBeam = g.fx.beam(this.pos, p.center, { color: '#a060ff', width: 0.025, dur: 0.9, opacity: 0.6 });
      this.teleBeam.update = (b) => {
        b.from.copy(this.pos);
        b.to.copy(p.center);
      };
      sfx('tick');
    }
    if (charging) {
      this.parts.coreMat.color.setHSL(0.75, 1, 0.5 + this.t * 0.4);
      if (this.t > 0.9) {
        this.state = 'volley';
        this.t = 0;
        this.volley = 3;
      }
    }
    if (this.state === 'volley') {
      if (this.t > 0.12 && this.volley > 0) {
        this.t = 0;
        this.volley--;
        const from = this.pos.clone();
        const dir = p.center.clone().addScaledVector(p.vel, 0.2).sub(from).normalize();
        g.combat.spawnEnemyShot('bolt', from, dir.multiplyScalar(34), 9 * this.dmgMult, { size: 0.9 });
        g.fx.flash(from, '#b070ff', 1.5, 0.1);
      }
      if (this.volley <= 0) {
        this.state = 'chase';
        this.cooldown = 3 + rand() * 1.5;
        this.parts.coreMat.color.set('#9a6bff');
      }
    }
    // tick-tock
    this.parts.hands[0].rotation.z = -this.t * 0.5;
    this.parts.hands[1].rotation.z = -Math.floor(this.t * 6) * 0.3;
    for (const [i, w] of this.parts.wings.entries()) w.rotation.y = Math.sin(this.t * 14 + this.phase) * 0.6 * (i ? -1 : 1);
    this.parts.chain.forEach((l, i) => (l.rotation.z = Math.sin(this.t * 2 + i * 0.6) * 0.25));
    this.parts.body.rotation.z = Math.sin(this.t * 1.3) * 0.15;
    if (Math.random() < 0.3) g.fx.spark(this.pos.x, this.pos.y - 0.3, this.pos.z, '#9a6bff', { speed: 0.5, g: 1, size: 0.3, life: 0.6 });
  }

  deathAnim(dt) {
    this.pos.y -= dt * 6;
    this.model.position.copy(this.pos);
    super.deathAnim(dt);
  }

  onDeath() {
    const g = this.game;
    g.fx.burst(this.pos, 26, '#c9a04a', { matter: true, speed: 9, size: 0.18, life: 1.2, g: 14 });
    g.fx.burst(this.pos, 20, '#a070ff', { speed: 8, size: 0.35, life: 0.5 });
    g.fx.flash(this.pos, '#a070ff', 3, 0.2);
    sfx('shatter');
  }
}

// ───────────────────────── The White Rabbit ─────────────────────────
export class WhiteRabbit extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildWhiteRabbit(), x, z, { ...o, hp: 2600, gold: 140, elite: null });
    this.name = 'The White Rabbit';
    this.subtitle = 'Herald of the Hour';
    this.boss = true;
    this.radius = 1.6;
    this.height = 6.5;
    this.hitR = 2.3;
    this.hitOffset = 3.3;
    this.speed = 6.4;
    this.cooldown = 2;
    this.summonT = 14;
    this.dashDir = new THREE.Vector3();
    this.bloodColor = '#b01020';
    this.model.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.distToPlayer();
    const parts = this.parts;
    this.cooldown -= dt;
    this.summonT -= dt;
    const enraged = this.hp < this.maxHp * 0.5;
    switch (this.state) {
      case 'chase': {
        this.steer(p.pos.x, p.pos.z, this.speed * (enraged ? 1.25 : 1), dt);
        this.faceToward(p.pos.x, p.pos.z, dt, 4);
        if (this.cooldown <= 0 && p.alive) {
          this.t = 0;
          if (d < 6.5) this.state = 'claw';
          else if (this.summonT <= 0) this.state = 'summon';
          else {
            const r = rand();
            this.state = r < 0.35 ? 'slam' : r < 0.7 ? 'barrage' : 'charge';
          }
          if (this.state === 'charge') {
            this.dashDir.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
            const end = this.pos.clone().addScaledVector(this.dashDir, 24);
            end.y = g.world.height(end.x, end.z) + 0.3;
            const b = g.fx.beam(this.pos.clone().setY(this.pos.y + 0.3), end, { color: '#ff2020', width: 1.2, dur: 0.9, opacity: 0.35 });
            b.hold = false;
          }
          sfx('telegraph');
        }
        break;
      }
      case 'claw': {
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (this.t < 0.6) this.faceToward(p.pos.x, p.pos.z, dt, 6);
        if (this.t > 0.6 && !this.didHit) {
          this.didHit = true;
          const fwd = tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          const to = tmp2.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z);
          const dist = to.length();
          if (dist < 7 && fwd.dot(to.normalize()) > 0.3) p.hurt(24 * this.dmgMult);
          const c = this.pos.clone().addScaledVector(fwd, 3);
          c.y += 1.5;
          g.fx.burst(c, 30, '#ffffff', { speed: 12, size: 0.3, life: 0.3 });
          g.fx.ring(c.x, c.z, { r0: 0.5, r1: 5, dur: 0.3, color: '#ff4050' });
          g.camShake(0.3);
          sfx('slash3');
        }
        if (this.t > 1.1) this.endAttack(1.2);
        break;
      }
      case 'slam': {
        this.vel.multiplyScalar(Math.exp(-5 * dt));
        if (this.t < 0.1) {
          this.vel.y = 16;
          sfx('dash');
        }
        if (this.t > 0.3 && this.grounded && !this.didHit) {
          this.didHit = true;
          g.camShake(0.9);
          sfx('bell');
          g.fx.burst(this.pos.clone().setY(this.pos.y + 0.3), 60, '#bdb0c8', { matter: true, speed: 14, size: 0.5, life: 1, g: 12 });
          for (let i = 0; i < (enraged ? 2 : 1); i++) this.shockwave(i * 0.45);
        }
        if (this.t > 1.8) this.endAttack(1.4);
        break;
      }
      case 'barrage': {
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        this.faceToward(p.pos.x, p.pos.z, dt, 6);
        const waves = enraged ? 3 : 2;
        const w = Math.floor((this.t - 0.5) / 0.45);
        if (this.t > 0.5 && w < waves && w >= (this.wavesFired || 0)) {
          this.wavesFired = w + 1;
          const from = this.hitCenter(new THREE.Vector3());
          from.y += 0.5;
          const base = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
          const n = 13;
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.12 + (w % 2 ? 0.06 : 0);
            const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
            dir.y = (p.center.y - from.y) / Math.max(4, this.distToPlayer());
            dir.normalize();
            g.combat.spawnEnemyShot('clock', from, dir.multiplyScalar(24), 11 * this.dmgMult, { size: 1.2, life: 3 });
          }
          sfx('tick');
          g.fx.flash(from, '#ffd060', 5, 0.2);
        }
        if (this.t > 0.5 + waves * 0.45 + 0.4) {
          this.wavesFired = 0;
          this.endAttack(1.2);
        }
        break;
      }
      case 'charge': {
        if (this.t < 0.9) {
          this.vel.multiplyScalar(Math.exp(-10 * dt));
          this.yaw += angleDiff(this.yaw, Math.atan2(this.dashDir.x, this.dashDir.z)) * 0.3;
        } else if (this.t < 2.0) {
          this.vel.x = this.dashDir.x * 24;
          this.vel.z = this.dashDir.z * 24;
          if (!this.didHit && this.pos.distanceTo(p.pos) < 2.6) {
            this.didHit = true;
            p.hurt(28 * this.dmgMult);
            p.vel.addScaledVector(this.dashDir, 14);
            p.vel.y = 8;
          }
          if (Math.random() < 0.8) g.fx.smoke(this.pos, '#3a2a40', 1, 1);
        } else this.endAttack(1.0);
        break;
      }
      case 'summon': {
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (this.t > 0.8 && !this.didHit) {
          this.didHit = true;
          sfx('bell');
          for (let i = 0; i < 3; i++) {
            const a = rand() * TAU;
            g.director.spawn('guard', this.pos.x + Math.cos(a) * 5, this.pos.z + Math.sin(a) * 5, false);
          }
          this.summonT = 22;
        }
        if (this.t > 1.4) this.endAttack(0.8);
        break;
      }
    }

    // animation
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const ph = this.t * 6 + this.phase;
    const k = clamp(hs / 6, 0, 1.3);
    parts.legs[0].rotation.x = Math.sin(ph) * 0.6 * k;
    parts.legs[1].rotation.x = -Math.sin(ph) * 0.6 * k;
    parts.torso.rotation.x = this.state === 'charge' && this.t > 0.9 ? 0.5 : k * 0.1;
    const clawUp = this.state === 'claw' ? (this.t < 0.6 ? -2.6 * (this.t / 0.6) : -2.6 + (this.t - 0.6) * 8) : null;
    parts.arms[1].sh.rotation.x = clawUp !== null ? Math.min(0.6, clawUp) : Math.sin(ph) * 0.4 * k;
    parts.arms[0].sh.rotation.x = this.state === 'barrage' ? -1.4 : -Math.sin(ph) * 0.4 * k;
    parts.arms[1].sh.rotation.z = -0.25;
    parts.arms[0].sh.rotation.z = 0.25;
    parts.ears[0].rotation.x = Math.sin(this.t * 3) * 0.12 - 0.1;
    parts.ears[1].rotation.x = Math.sin(this.t * 3 + 1) * 0.12 - 0.1;
    parts.watch.rotation.x = Math.sin(this.t * 3) * 0.5;
    parts.clockHands[0].rotation.z = -this.t * 0.4;
    parts.clockHands[1].rotation.z = -this.t * (enraged ? 12 : 3);
    parts.head.rotation.z = Math.sin(this.t * 1.1) * 0.08;
    parts.eyeMat.color.setRGB(1, enraged ? 0.3 + 0.3 * Math.sin(this.t * 20) : 0.1, 0.1);
  }

  shockwave(delay) {
    const g = this.game;
    const x = this.pos.x;
    const z = this.pos.z;
    const wave = { r: 0, t: -delay, hit: false };
    const ring = g.fx.ring(x, z, { r0: 0.1, r1: 28, dur: 28 / 15 + delay, color: '#ff4a6a' });
    ring.mesh.visible = delay === 0;
    g.addTicker((dt) => {
      wave.t += dt;
      if (wave.t < 0) return true;
      ring.mesh.visible = true;
      wave.r = wave.t * 15;
      ring.mesh.scale.setScalar(Math.max(0.1, wave.r));
      const p = g.player;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (!wave.hit && p.onGround && Math.abs(d - wave.r) < 1.1) {
        wave.hit = true;
        p.hurt(20 * this.dmgMult);
      }
      if (Math.random() < 0.9) {
        const a = rand() * TAU;
        g.fx.spark(x + Math.cos(a) * wave.r, g.world.height(x + Math.cos(a) * wave.r, z + Math.sin(a) * wave.r) + 0.2, z + Math.sin(a) * wave.r, '#ff5070', { speed: 2, g: 4, size: 0.4, life: 0.4 });
      }
      return wave.r < 28;
    });
  }

  endAttack(cd) {
    this.state = 'chase';
    this.didHit = false;
    this.cooldown = cd * (this.hp < this.maxHp * 0.5 ? 0.7 : 1);
  }

  onDeath() {
    const g = this.game;
    const c = this.hitCenter(new THREE.Vector3());
    g.fx.burst(c, 120, '#ffffff', { speed: 18, size: 0.5, life: 1.2 });
    g.fx.burst(c, 80, '#c9a04a', { matter: true, speed: 14, size: 0.3, life: 2, g: 12 });
    g.fx.burst(c, 60, '#b01020', { matter: true, speed: 10, size: 0.35, life: 1.5, g: 14 });
    g.fx.ring(this.pos.x, this.pos.z, { r0: 1, r1: 18, dur: 0.8, color: '#ffffff' });
    g.splat(this.pos.x, this.pos.z, 4);
    g.camShake(1.2);
    // the Rabbit's pockets: one guaranteed uncommon (or better) plus a common per depth
    const drops = [rollItem(rand, { legendary: 0.12, uncommon: 0.88 })];
    for (let i = 0; i < Math.min(3, g.depth); i++) drops.push(rollItem(rand, { legendary: 0.02, uncommon: 0.25 }));
    drops.forEach((it, i) => {
      const a = (i / drops.length) * TAU;
      g.spawnPickup(it, c, new THREE.Vector3(Math.cos(a) * 4, 12, Math.sin(a) * 4));
    });
    sfx('bell');
    sfx('boss');
  }
}

// ───────────────────────── Director ─────────────────────────
const CARDS = [
  { type: 'guard', cost: 12, weight: 5, min: 0 },
  { type: 'teacup', cost: 15, weight: 3, min: 0 },
  { type: 'wisp', cost: 11, weight: 3, min: 0.6 },
];

export class Director {
  constructor(game) {
    this.game = game;
    this.credits = 45;
    this.timer = 2;
  }

  reset() {
    this.credits = 45;
    this.timer = 2;
  }

  spawn(type, x, z, elite) {
    const g = this.game;
    const level = g.enemyLevel();
    const o = { level, elite };
    let e;
    if (type === 'guard') e = new CardGuard(g, x, z, o);
    else if (type === 'teacup') e = new Teacup(g, x, z, o);
    else if (type === 'wisp') e = new ClockWisp(g, x, z, o);
    else if (type === 'rabbit') e = new WhiteRabbit(g, x, z, o);
    g.enemies.push(e);
    g.fx.ring(x, z, { r0: 0.2, r1: e.boss ? 6 : 2, dur: 0.8, color: e.elite ? e.elite.color : '#a040ff' });
    g.fx.burst(new THREE.Vector3(x, g.world.height(x, z) + 0.3, z), e.boss ? 60 : 14, '#8040ff', { speed: 4, g: -4, size: 0.4, life: 0.9 });
    return e;
  }

  update(dt) {
    const g = this.game;
    const coeff = g.difficulty();
    const event = g.teleporter && g.teleporter.state === 'charging';
    this.credits += dt * (0.85 + 0.45 * coeff) * (event ? 2.2 : 1);
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 2.5 + rand() * 3.5;
    const alive = g.enemies.filter((e) => e.alive && !e.boss).length;
    if (alive >= 22 + Math.floor(coeff * 2)) return;
    const opts = CARDS.filter((c) => (g.runTime / 60) >= c.min);
    let tot = opts.reduce((s, c) => s + c.weight, 0);
    let r = rand() * tot;
    let card = opts[0];
    for (const c of opts) {
      r -= c.weight;
      if (r <= 0) {
        card = c;
        break;
      }
    }
    const eliteChance = clamp((coeff - 1.3) * 0.18, 0, 0.45);
    const elite = rand() < eliteChance;
    const cost = card.cost * (elite ? 4 : 1);
    if (this.credits < cost) return;
    const n = clamp(Math.floor(this.credits / cost), 1, elite ? 2 : 5);
    this.credits -= n * cost;
    // spawn cluster somewhere around the player, not on top of them
    const p = g.player.pos;
    const eliteType = elite ? ELITES[Math.floor(rand() * ELITES.length)] : null;
    for (let tries = 0; tries < 12; tries++) {
      const a = rand() * TAU;
      const R = 22 + rand() * 18;
      const cx = p.x + Math.cos(a) * R;
      const cz = p.z + Math.sin(a) * R;
      if (Math.hypot(cx, cz) > 95 || g.world.solidAt(cx, g.world.height(cx, cz) + 0.5, cz)) continue;
      for (let i = 0; i < n; i++) {
        const x = cx + (rand() - 0.5) * 5;
        const z = cz + (rand() - 0.5) * 5;
        this.spawn(card.type, x, z, eliteType);
      }
      break;
    }
  }
}
