// Enemies, their AI, and the credit-based spawn Director.

import * as THREE from 'three';
import { buildCardGuard, buildTeacup, buildClockWisp, buildWhiteRabbit, buildQueen } from '../gfx/models.js';
import { rand, clamp, lerp, angleDiff, TAU } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { rollItem } from './items.js';
import { rimModel } from '../gfx/rim.js';

const tmp = new THREE.Vector3();
const FLASH_MAT = new THREE.MeshBasicMaterial({ color: '#fff4f0' });
const tmp2 = new THREE.Vector3();

// Evolution: as enemy level climbs they grow, glow, and learn new tricks.
export const TIERS = [
  { name: '', color: null },
  { name: 'Veteran', color: '#ffb040', min: 3 },
  { name: 'Nightmare', color: '#b040ff', min: 6 },
];
export const tierFor = (level) => (level >= TIERS[2].min ? 2 : level >= TIERS[1].min ? 1 : 0);

export const ELITES = [
  { id: 'crimson', name: 'Crimson', color: '#ff2a3a' },
  { id: 'gilded', name: 'Gilded', color: '#ffcf40' },
  { id: 'void', name: 'Voidborne', color: '#9a50ff' },
];

export class Enemy {
  constructor(game, built, x, z, o) {
    this.game = game;
    this.model = built.root;
    this.parts = built.parts;
    rimModel(this.model);
    game.scene.add(this.model);
    this.pos = new THREE.Vector3(x, game.world.height(x, z), z);
    this.vel = new THREE.Vector3();
    this.yaw = rand() * TAU;
    this.level = o.level;
    this.tier = o.boss ? 0 : tierFor(o.level);
    // bosses scale health more gently so late fights don't drag
    const perLevel = o.boss ? 0.1 : 0.18;
    const hpMult = (1 + perLevel * (o.level - 1)) * (o.elite ? 3 : 1) * (1 + 0.2 * this.tier);
    this.maxHp = this.hp = o.hp * hpMult;
    this.dmgMult = (1 + 0.14 * (o.level - 1)) * (o.elite ? 1.8 : 1);
    this.goldValue = o.gold * (1 + 0.25 * (o.level - 1)) * (o.elite ? 3 : 1);
    this.elite = o.elite || null;
    this.xpValue = o.xp || 10;
    this.alive = true;
    this.state = 'spawn';
    this.t = 0;
    this.spawnT = 0.9;
    this.pop = 0;
    this.bleeds = [];
    this.bleedTick = 0;
    this.deadT = 0;
    this.scale = (o.elite ? 1.2 : 1) * (1 + 0.1 * this.tier);
    this.phase = rand() * 10;
    this.cooldown = 1 + rand() * 2;
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

  addTierMark() {
    const col = TIERS[this.tier].color;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(this.radius * 1.1, this.radius * 1.35, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.position.y = 0.07;
    this.model.add(ring);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.game.glowTex, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.35 }));
    sp.scale.set(this.height * 1.1, this.height * 1.1, 1);
    sp.position.y = this.height * 0.55;
    this.model.add(sp);
    this.tierMark = ring;
  }

  hitCenter(out) {
    return out.set(this.pos.x, this.pos.y + this.hitOffset * this.scale, this.pos.z);
  }

  hurt(dmg, crit, dir) {
    if (!this.alive) return 0;
    this.hp -= dmg;
    this.pop = 1;
    this.flash(crit ? 0.09 : 0.06);
    if (dir && !this.boss) {
      tmp.copy(dir).setY(0).normalize();
      this.vel.addScaledVector(tmp, (crit ? 2.5 : 1.2) / this.scale);
    }
    const c = this.hitCenter(tmp2);
    if (dir) (this.lastHitDir ||= new THREE.Vector3()).copy(dir);
    this.game.gore.spray(c, dir, crit ? 14 : 7, this.bloodColor || '#9a0c18');
    if (this.state === 'spawn') this.state = 'chase';
    if (this.hp <= 0) this.die();
    return dmg;
  }

  // Briefly swap every mesh to flat white — the classic hit flash.
  flash(t) {
    if (!this.meshes) {
      this.meshes = [];
      this.model.traverse((o) => {
        if (o.isMesh && o.material !== FLASH_MAT && !o.material.transparent) this.meshes.push([o, o.material]);
      });
    }
    if (this.flashT <= 0 || this.flashT === undefined) for (const [m] of this.meshes) m.material = FLASH_MAT;
    this.flashT = t;
  }

  unflash() {
    for (const [m, orig] of this.meshes) m.material = orig;
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
    // don't stand inside Alice
    const p = this.game.player;
    if (p.alive && !this.flying) {
      const dx = this.pos.x - p.pos.x;
      const dz = this.pos.z - p.pos.z;
      const rr = this.radius + 0.45;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        this.pos.x = p.pos.x + (dx / d) * rr;
        this.pos.z = p.pos.z + (dz / d) * rr;
      }
    }
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
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.unflash();
    }
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
    // time-slowed by the Broken Pocket Watch
    if (this.slowT > 0) {
      this.slowT -= dt;
      dt *= 0.35;
      if (Math.random() < 0.15) {
        const c = this.hitCenter(tmp2);
        this.game.fx.spark(c.x, c.y + 0.5, c.z, '#b080ff', { speed: 1, g: -1, size: 0.3, life: 0.5 });
      }
    }
    // subclasses set radius/height after super(), so dress elites lazily
    if (this.elite && !this.aura) this.addEliteAura();
    if (this.tier && !this.tierMark) this.addTierMark();
    if (this.tier === 2 && Math.random() < 0.15) {
      const c = this.hitCenter(tmp2);
      this.game.fx.spark(c.x + (rand() - 0.5), c.y + rand(), c.z + (rand() - 0.5), '#2a0840', { matter: true, speed: 0.6, g: -1.5, size: 0.7, life: 1, a: 0.5, grow: 1 });
    }
    this.baseUpdate(dt);
    if (!this.alive) {
      this.deadT += dt;
      this.deathAnim(dt);
      return this.deadT < 1.2;
    }
    if (this.state === 'spawn') {
      this.spawnT -= dt;
      const k = 1 - Math.max(0, this.spawnT) / 0.9;
      const e = 1 - (1 - k) ** 3;
      this.model.scale.setScalar(this.scale * (0.5 + 0.5 * e));
      if (this.spawnT <= 0) this.state = 'chase';
      this.model.position.copy(this.pos);
      // climb up out of the rabbit hole
      if (!this.flying) this.model.position.y -= (1 - e) * this.height * this.scale * 1.1;
      if (Math.random() < 0.6) {
        const a = Math.random() * TAU;
        this.game.fx.spark(this.pos.x + Math.cos(a) * 0.8, this.pos.y + 0.1, this.pos.z + Math.sin(a) * 0.8, Math.random() < 0.5 ? '#b060ff' : '#ff60c0', { speed: 1.2, g: -9, size: 0.3, life: 0.6, drag: 0.5 });
      }
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
    super(game, buildCardGuard(suit, RANKS[Math.floor(rand() * RANKS.length)], red ? '#5c0d14' : '#1c1a26'), x, z, { ...o, hp: 48, gold: 15, xp: 11 });
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
        if (this.t > (this.tier === 2 ? 0.42 : 0.55)) {
          this.state = 'lunge';
          this.lungesLeft = this.lungesLeft ?? this.tier;
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
          if (this.lungesLeft > 0) {
            // evolved guards chain a second strike
            this.lungesLeft--;
            this.state = 'windup';
            this.t = 0.3;
            sfx('telegraph');
          } else {
            this.lungesLeft = undefined;
            this.state = 'recover';
            this.t = 0;
          }
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
    g.gore.explode(c, this.lastHitDir, { gibs: ['flesh', 'card', 'card', 'chunk'], count: 10, scale: this.scale });
    g.fx.burst(c, 16, '#efe4d0', { matter: true, speed: 9, size: 0.3, life: 1.4, g: 10 });
    sfx('cards');
  }
}


// ───────────────────────── Diamond Guard (ranged) ─────────────────────────
export class DiamondGuard extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildCardGuard('♦', RANKS[Math.floor(rand() * RANKS.length)], '#6a0c30'), x, z, { ...o, hp: 42, gold: 16, xp: 12 });
    this.name = 'Diamond Guard';
    this.radius = 0.55;
    this.height = 2.5;
    this.hitR = 0.85;
    this.hitOffset = 1.35;
    this.speed = 4.4;
    this.strafe = rand() < 0.5 ? 1 : -1;
    this.cooldown = 1.2 + rand() * 1.5;
    // a floating crystal over the spear hand: the "gun"
    this.crystalMat = new THREE.MeshStandardMaterial({ color: '#ff4a8a', emissive: '#ff1a60', emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.15 });
    DiamondGuard.geo ||= new THREE.OctahedronGeometry(0.2, 0);
    const cry = new THREE.Mesh(DiamondGuard.geo, this.crystalMat);
    cry.scale.set(0.8, 1.4, 0.8);
    cry.position.set(0, 0.25, 0.25);
    this.parts.arms[1].hand.add(cry);
    this.crystal = cry;
    this.parts.spear.visible = false;
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.distToPlayer();
    const parts = this.parts;
    this.cooldown -= dt;
    this.faceToward(p.pos.x, p.pos.z, dt, 8);
    this.crystal.rotation.y += dt * 3;
    if (this.state === 'aim') {
      this.vel.multiplyScalar(Math.exp(-10 * dt));
      this.crystalMat.emissiveIntensity = 1.2 + this.t * 5;
      parts.arms[1].sh.rotation.x = lerp(parts.arms[1].sh.rotation.x, -1.5, 1 - Math.exp(-12 * dt));
      const shots = 3 + 2 * this.tier;
      if (this.t > 0.7 && this.fired < shots && this.t > 0.7 + this.fired * 0.14) {
        this.fired++;
        const from = new THREE.Vector3();
        this.crystal.getWorldPosition(from);
        const lead = p.center.clone().addScaledVector(p.vel, 0.25);
        const dir = lead.sub(from).normalize();
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 0.08);
        g.combat.spawnEnemyShot('diamond', from, dir.multiplyScalar(30), 8 * this.dmgMult, { size: 1.3, life: 2.5 });
        g.fx.flash(from, '#ff4a8a', 1.2, 0.08);
        sfx('tick');
      }
      if (this.t > 0.7 + shots * 0.14 + 0.3) {
        this.state = 'chase';
        this.cooldown = 2.2 + rand() * 1.2;
        this.crystalMat.emissiveIntensity = 1.2;
      }
    } else {
      const want = d > 18 ? 1 : d < 9 ? -1 : 0;
      tmp2.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
      this.steer(this.pos.x + tmp2.x * want * 4 - tmp2.z * this.strafe * 3, this.pos.z + tmp2.z * want * 4 + tmp2.x * this.strafe * 3, this.speed, dt);
      if (rand() < 0.006) this.strafe *= -1;
      parts.arms[1].sh.rotation.x = lerp(parts.arms[1].sh.rotation.x, -0.6, 1 - Math.exp(-8 * dt));
      if (this.cooldown <= 0 && d < 30 && p.alive) {
        this.state = 'aim';
        this.t = 0;
        this.fired = 0;
        const from = new THREE.Vector3();
        this.crystal.getWorldPosition(from);
        const tb = g.fx.beam(from, p.center.clone(), { color: '#ff4a8a', width: 0.03, dur: 0.7, opacity: 0.6 });
        tb.update = (b) => {
          this.crystal.getWorldPosition(b.from);
          b.to.copy(p.center);
        };
        sfx('telegraph');
      }
    }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const ph = this.t * 9 + this.phase;
    const k = clamp(hs / 5, 0, 1.2);
    parts.legs[0].rotation.x = Math.sin(ph) * 0.7 * k;
    parts.legs[1].rotation.x = -Math.sin(ph) * 0.7 * k;
    parts.arms[0].sh.rotation.x = -Math.sin(ph) * 0.5 * k;
  }

  onDeath() {
    const g = this.game;
    const c = this.hitCenter(new THREE.Vector3());
    g.gore.explode(c, this.lastHitDir, { gibs: ['flesh', 'card', 'card', 'shard'], count: 10, scale: this.scale });
    g.fx.burst(c, 20, '#ff4a8a', { speed: 9, size: 0.3, life: 0.5 });
    sfx('shatter');
  }
}

// ───────────────────────── Teacup Mimic ─────────────────────────
export class Teacup extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildTeacup(1.1), x, z, { ...o, hp: 40, gold: 17, xp: 13 });
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
    for (let i = 0; i <= this.tier; i++) this.spitOne(i === 0 ? 0 : (i % 2 ? 1 : -1) * 3);
  }

  spitOne(offset) {
    const g = this.game;
    const p = g.player;
    const from = this.hitCenter(new THREE.Vector3());
    from.y += 0.7;
    const d = this.distToPlayer();
    const T = clamp(d / 17, 0.6, 1.5);
    const target = p.pos.clone().addScaledVector(p.vel, T * 0.55);
    if (offset) {
      target.x += Math.cos(this.yaw) * offset;
      target.z -= Math.sin(this.yaw) * offset;
    }
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
    g.gore.explode(c, this.lastHitDir, { gibs: ['shard', 'shard', 'flesh', 'shard', 'chunk'], count: 11, blood: '#7a1208', scale: this.scale });
    g.fx.burst(c, 14, '#c9a04a', { speed: 8, size: 0.2, life: 0.6 });
    g.gore.splat(this.pos.x, this.pos.z, 1.3, '#3a1004');
    sfx('shatter');
  }
}

// ───────────────────────── Clockwork Wisp ─────────────────────────
export class ClockWisp extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildClockWisp(), x, z, { ...o, hp: 30, gold: 13, xp: 9 });
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
        this.volley = 3 + 2 * this.tier;
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
    g.gore.explode(this.pos, this.lastHitDir, { gibs: ['gear', 'gear', 'flesh'], count: 8, scale: 0.7 * this.scale, blood: '#6a0a30' });
    g.fx.burst(this.pos, 20, '#a070ff', { speed: 8, size: 0.35, life: 0.5 });
    g.fx.flash(this.pos, '#a070ff', 3, 0.2);
    sfx('shatter');
  }
}

// ───────────────────────── The White Rabbit ─────────────────────────
export class WhiteRabbit extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildWhiteRabbit(), x, z, { ...o, hp: 2700, gold: 140, xp: 220, elite: null, boss: true });
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
          this.telegraph();
          sfx('telegraph');
        }
        break;
      }
      case 'claw': {
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (this.t < 0.5) this.faceToward(p.pos.x, p.pos.z, dt, 5);
        if (this.t > 0.85 && !this.didHit) {
          this.didHit = true;
          const fwd = tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          const to = tmp2.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z);
          const dist = to.length();
          if (dist < 7.2 && fwd.dot(to.normalize()) > Math.cos(0.96)) p.hurt(24 * this.dmgMult);
          const c = this.pos.clone().addScaledVector(fwd, 3);
          c.y += 1.5;
          g.fx.burst(c, 30, '#ffffff', { speed: 12, size: 0.3, life: 0.3 });
          g.fx.ring(c.x, c.z, { r0: 0.5, r1: 5, dur: 0.3, color: '#ff4050' });
          g.camShake(0.3);
          sfx('slash3');
        }
        if (this.t > 1.35) this.endAttack(1.2);
        break;
      }
      case 'slam': {
        this.vel.multiplyScalar(Math.exp(-5 * dt));
        parts.body.position.y = this.t < 0.9 ? -Math.min(1, this.t / 0.9) * 0.6 : 0; // crouch
        if (this.t >= 0.9 && !this.leapt) {
          this.leapt = true;
          this.vel.y = 16;
          sfx('dash');
        }
        if (this.leapt && this.t > 1.2 && this.grounded && !this.didHit) {
          this.didHit = true;
          g.camShake(0.9);
          sfx('bell');
          g.fx.burst(this.pos.clone().setY(this.pos.y + 0.3), 60, '#bdb0c8', { matter: true, speed: 14, size: 0.5, life: 1, g: 12 });
          for (let i = 0; i < (enraged ? 2 : 1); i++) this.shockwave(i * 0.45);
        }
        if (this.t > 2.7) this.endAttack(1.4);
        break;
      }
      case 'barrage': {
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (this.t > 0.85) this.faceToward(p.pos.x, p.pos.z, dt, 6);
        const waves = enraged ? 3 : 2;
        const w = Math.floor((this.t - 0.85) / 0.45);
        if (this.t > 0.85 && w < waves && w >= (this.wavesFired || 0)) {
          this.wavesFired = w + 1;
          const from = this.hitCenter(new THREE.Vector3());
          from.y += 0.5;
          const base = w === 0 ? this.fanBase : Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
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
        if (this.t > 0.85 + waves * 0.45 + 0.4) {
          this.wavesFired = 0;
          this.endAttack(1.2);
        }
        break;
      }
      case 'charge': {
        if (this.t < 1.0) {
          this.vel.multiplyScalar(Math.exp(-10 * dt));
          this.yaw += angleDiff(this.yaw, Math.atan2(this.dashDir.x, this.dashDir.z)) * 0.3;
          parts.body.position.y = -Math.min(1, this.t) * 0.3;
        } else if (this.t < 2.1) {
          parts.body.position.y = 0;
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
        if (this.t > 1.0 && !this.didHit) {
          this.didHit = true;
          sfx('bell');
          for (const sp of this.summonSpots.slice(0, g.director.addRoom())) g.director.spawn(g.world.theme.summon || 'guard', sp.x, sp.z, null);
          this.summonT = 22;
        }
        if (this.t > 1.6) this.endAttack(0.8);
        break;
      }
    }

    // animation
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const ph = this.t * 6 + this.phase;
    const k = clamp(hs / 6, 0, 1.3);
    parts.legs[0].rotation.x = Math.sin(ph) * 0.6 * k;
    parts.legs[1].rotation.x = -Math.sin(ph) * 0.6 * k;
    parts.torso.rotation.x = 0.22 + (this.state === 'charge' && this.t > 0.9 ? 0.4 : k * 0.1);
    const clawUp = this.state === 'claw' ? (this.t < 0.6 ? -2.6 * (this.t / 0.6) : -2.6 + (this.t - 0.6) * 8) : null;
    parts.arms[1].sh.rotation.x = clawUp !== null ? Math.min(0.6, clawUp) : Math.sin(ph) * 0.4 * k;
    parts.arms[0].sh.rotation.x = this.state === 'barrage' ? -1.4 : -Math.sin(ph) * 0.4 * k;
    parts.arms[1].sh.rotation.z = -0.42;
    parts.arms[0].sh.rotation.z = 0.42;
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

  // Every attack announces itself: a ground indicator plus a named callout.
  telegraph() {
    const g = this.game;
    const p = g.player;
    const enraged = this.hp < this.maxHp * 0.5;
    this.leapt = false;
    switch (this.state) {
      case 'claw':
        g.fx.sector(this.pos.x, this.pos.z, this.yaw, 1.92, 7.2, 0.85, { follow: this.pos, yawFn: () => this.yaw });
        g.hud.warn('Claw Swipe', 'step out of the cone', 0.85);
        break;
      case 'slam':
        g.fx.ring(this.pos.x, this.pos.z, { r0: 6, r1: 6, dur: 1.3, color: '#ff3050', pulse: true, fill: true, opacity: 0.35 });
        g.hud.warn('Shockwave', enraged ? 'JUMP — twice!' : 'JUMP over the ring', 1.6);
        break;
      case 'barrage': {
        this.fanBase = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
        const y = this.pos.y + 0.25;
        for (let i = 0; i < 13; i++) {
          const a = this.fanBase + (i - 6) * 0.12;
          const end = new THREE.Vector3(this.pos.x + Math.sin(a) * 26, y, this.pos.z + Math.cos(a) * 26);
          g.fx.beam(new THREE.Vector3(this.pos.x, y, this.pos.z), end, { color: '#ffb020', width: 0.07, dur: 0.85, opacity: 0.5 });
        }
        g.hud.warn('Clock Barrage', 'find a gap between the lanes', 0.85);
        break;
      }
      case 'charge': {
        this.dashDir.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
        const end = this.pos.clone().addScaledVector(this.dashDir, 26);
        end.y = g.world.height(end.x, end.z) + 0.3;
        g.fx.beam(this.pos.clone().setY(this.pos.y + 0.3), end, { color: '#ff2020', width: 1.3, dur: 1.0, opacity: 0.4 });
        g.hud.warn('Charge', 'dodge sideways', 1.0);
        break;
      }
      case 'summon':
        this.summonSpots = [0, 1, 2].map(() => {
          const a = rand() * TAU;
          return { x: this.pos.x + Math.cos(a) * 5, z: this.pos.z + Math.sin(a) * 5 };
        });
        for (const sp of this.summonSpots) g.fx.ring(sp.x, sp.z, { r0: 1.5, r1: 1.5, dur: 1.0, color: '#a040ff', pulse: true, fill: true, opacity: 0.4 });
        g.hud.warn('Summoning', 'reinforcements incoming', 1.0);
        break;
    }
  }

  endAttack(cd) {
    this.state = 'chase';
    this.didHit = false;
    this.parts.body.position.y = 0;
    this.cooldown = cd * (this.hp < this.maxHp * 0.5 ? 0.7 : 1);
  }

  onDeath() {
    const g = this.game;
    const c = this.hitCenter(new THREE.Vector3());
    g.fx.burst(c, 80, '#ffffff', { speed: 18, size: 0.5, life: 1.2 });
    g.gore.explode(c, this.lastHitDir, { gibs: this.gibKinds || ['fur', 'flesh', 'chunk', 'gear', 'flesh'], count: 16, scale: 2.6 });
    g.fx.ring(this.pos.x, this.pos.z, { r0: 1, r1: 18, dur: 0.8, color: '#ff3040' });
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


// ───────────────────────── The Queen of Hearts ─────────────────────────
export class QueenOfHearts extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildQueen(), x, z, { ...o, hp: 2900, gold: 160, xp: 260, elite: null, boss: true });
    this.name = 'The Queen of Hearts';
    this.gibKinds = ['flesh', 'card', 'chunk', 'flesh', 'card'];
    this.subtitle = 'Sovereign of Severance';
    this.boss = true;
    this.radius = 1.9;
    this.height = 6.2;
    this.hitR = 2.1;
    this.hitOffset = 3.0;
    this.speed = 4.2;
    this.cooldown = 2;
    this.summonT = 10;
    this.bloodColor = '#b01020';
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
      case 'chase':
        this.steer(p.pos.x, p.pos.z, this.speed * (enraged ? 1.3 : 1), dt);
        this.faceToward(p.pos.x, p.pos.z, dt, 3);
        if (this.cooldown <= 0 && p.alive) {
          this.t = 0;
          this.didHit = false;
          this.fired = 0;
          if (d < 7) this.state = 'sweep';
          else if (this.summonT <= 0) this.state = 'summon';
          else {
            const r = rand();
            this.state = r < 0.38 ? 'decree' : r < 0.7 ? 'hearts' : 'cards';
          }
          if (this.state === 'decree') {
            g.hud.warn('“Off with her head!”', 'thorn lines race toward you', 1.4);
            sfx('boss');
          } else sfx('telegraph');
          if (this.state === 'sweep') {
            g.fx.sector(this.pos.x, this.pos.z, this.yaw, 2.4, 8, 0.9, { follow: this.pos, yawFn: () => this.yaw });
            g.hud.warn('Scepter Sweep', 'get behind her', 0.9);
          } else if (this.state === 'hearts') g.hud.warn('Rain of Hearts', 'leave the circles', 1.2);
          else if (this.state === 'cards') {
            this.fanBase = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
            for (let i = -3; i <= 3; i++) {
              const a = this.fanBase + i * 0.16;
              const y = this.pos.y + 0.25;
              g.fx.beam(new THREE.Vector3(this.pos.x, y, this.pos.z), new THREE.Vector3(this.pos.x + Math.sin(a) * 24, y, this.pos.z + Math.cos(a) * 24), { color: '#ff3050', width: 0.07, dur: 0.8, opacity: 0.5 });
            }
            g.hud.warn('Card Volley', 'slip between the lanes', 0.8);
          } else if (this.state === 'summon') g.hud.warn('Guards!', 'reinforcements incoming', 1.0);
        }
        break;
      case 'sweep': {
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (this.t < 0.5) this.faceToward(p.pos.x, p.pos.z, dt, 4);
        if (this.t > 0.9 && !this.didHit) {
          this.didHit = true;
          const fwd = tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          const to = tmp2.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z);
          if (to.length() < 8 && fwd.dot(to.normalize()) > Math.cos(1.2)) p.hurt(26 * this.dmgMult);
          const c = this.pos.clone().addScaledVector(fwd, 3.5);
          g.fx.ring(c.x, c.z, { r0: 1, r1: 6, dur: 0.35, color: '#ff2040' });
          g.fx.burst(c.setY(c.y + 2), 30, '#ff4060', { speed: 12, size: 0.35, life: 0.35 });
          g.camShake(0.35);
          sfx('slash3');
        }
        if (this.t > 1.5) this.endAttack(1.1);
        break;
      }
      case 'decree': {
        // lines of rose thorns race toward Alice, re-aiming each wave
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        this.faceToward(p.pos.x, p.pos.z, dt, 4);
        const waves = enraged ? 4 : 3;
        if (this.t > 0.6 + this.fired * 0.9 && this.fired < waves) {
          this.fired++;
          const base = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
          const spread = enraged ? [-0.35, 0, 0.35] : [-0.22, 0.22];
          for (const off of this.fired % 2 ? spread : [0]) this.thornLine(base + off);
        }
        if (this.t > 0.6 + waves * 0.9 + 0.8) this.endAttack(1.3);
        break;
      }
      case 'hearts': {
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        parts.scepter.rotation.x = -1.2;
        if (this.t > 0.4 && !this.didHit) {
          this.didHit = true;
          const n = enraged ? 10 : 7;
          for (let i = 0; i < n; i++) {
            const a = rand() * TAU;
            const r = i === 0 ? 0 : 2 + rand() * 7;
            const x = p.pos.x + p.vel.x * 0.6 + Math.cos(a) * r;
            const z = p.pos.z + p.vel.z * 0.6 + Math.sin(a) * r;
            this.heartDrop(x, z, 1.0 + i * 0.12);
          }
        }
        if (this.t > 2.6) this.endAttack(1.2);
        break;
      }
      case 'cards': {
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        this.faceToward(p.pos.x, p.pos.z, dt, 5);
        if (this.t > 0.8 && this.fired < (enraged ? 5 : 3) && this.t > 0.8 + this.fired * 0.28) {
          this.fired++;
          const from = this.hitCenter(new THREE.Vector3());
          from.y += 1;
          const base = this.fired === 1 ? this.fanBase : Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + (this.fired % 2 ? 0.08 : -0.08);
          for (let i = -3; i <= 3; i++) {
            const a = base + i * 0.16;
            const dir = new THREE.Vector3(Math.sin(a), (p.center.y - from.y) / Math.max(5, d), Math.cos(a)).normalize();
            g.combat.spawnEnemyShot('heart', from, dir.multiplyScalar(26), 10 * this.dmgMult, { size: 1.3, life: 3 });
          }
          sfx('cards');
        }
        if (this.t > 2.5) this.endAttack(1.0);
        break;
      }
      case 'summon':
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (this.t > 0.8 && !this.didHit) {
          this.didHit = true;
          sfx('bell');
          g.hud.banner('“Guards! Seize her!”', '', '#ff3048', '♠');
          for (let i = 0; i < Math.min(4, g.director.addRoom()); i++) {
            const a = (i / 4) * TAU;
            g.director.spawn('guard', this.pos.x + Math.cos(a) * 5, this.pos.z + Math.sin(a) * 5, i === 0 && g.depth > 2 ? ELITES[0] : null);
          }
          this.summonT = 20;
        }
        if (this.t > 1.4) this.endAttack(0.8);
        break;
    }
    // animation: the gown glides, scepter follows the attack
    const hs = Math.hypot(this.vel.x, this.vel.z);
    parts.gown.rotation.y = Math.sin(this.t * 2) * 0.05;
    parts.body.position.y = Math.sin(this.t * 2.2) * 0.05 + Math.min(1, hs / 4) * 0.05;
    const sweep = this.state === 'sweep' ? (this.t < 0.7 ? -2.4 * (this.t / 0.7) : -2.4 + (this.t - 0.7) * 9) : null;
    parts.arms[1].sh.rotation.x = sweep !== null ? Math.min(0.8, sweep) : this.state === 'hearts' ? -2.6 : -0.4;
    parts.arms[0].sh.rotation.x = this.state === 'decree' ? -2.2 : -0.2;
    parts.arms[0].sh.rotation.z = this.state === 'decree' ? 0.5 : 0.15;
    parts.head.rotation.z = Math.sin(this.t * 0.9) * 0.06;
    parts.heartMat.emissiveIntensity = 1.5 + Math.sin(this.t * (enraged ? 12 : 4)) * 0.8;
  }

  thornLine(angle) {
    const g = this.game;
    const x0 = this.pos.x;
    const z0 = this.pos.z;
    const n = 18;
    for (let i = 1; i <= n; i++) {
      const x = x0 + Math.sin(angle) * i * 1.5;
      const z = z0 + Math.cos(angle) * i * 1.5;
      const delay = i * 0.06;
      let t = -delay;
      let warned = false;
      let done = false;
      g.addTicker((dt) => {
        t += dt;
        if (t < 0) return true;
        if (!warned) {
          warned = true;
          g.fx.ring(x, z, { r0: 1.1, r1: 1.1, dur: 0.55, color: '#ff2040', pulse: true, fill: true, opacity: 0.4 });
        }
        if (t > 0.55 && !done) {
          done = true;
          const y = g.world.height(x, z);
          g.fx.burst(new THREE.Vector3(x, y + 0.3, z), 10, '#1a3a1a', { matter: true, speed: 7, g: 12, size: 0.3, life: 0.7 });
          g.fx.burst(new THREE.Vector3(x, y + 0.5, z), 6, '#ff2040', { speed: 6, g: 4, size: 0.35, life: 0.4 });
          const p = g.player;
          if (p.alive && Math.hypot(p.pos.x - x, p.pos.z - z) < 1.3 && p.pos.y - y < 1.5) p.hurt(16 * this.dmgMult);
          return false;
        }
        return true;
      });
    }
  }

  heartDrop(x, z, fall) {
    const g = this.game;
    const ring = g.fx.ring(x, z, { r0: 2.2, r1: 2.2, dur: fall, color: '#ff2a50', pulse: true });
    let t = 0;
    const y0 = g.world.height(x, z);
    const orb = new THREE.Mesh(g.combat.orbGeo, g.combat.enemyMats.heart);
    orb.scale.setScalar(2.2);
    g.scene.add(orb);
    g.addTicker((dt) => {
      t += dt;
      const k = Math.min(1, t / fall);
      orb.position.set(x, y0 + 30 * (1 - k * k), z);
      g.fx.trail(orb.position, '#ff3050', 0.9, 0.3, 0.8);
      if (k >= 1) {
        g.scene.remove(orb);
        ring.dead = true;
        g.combat.explode(new THREE.Vector3(x, y0 + 0.4, z), 2.2, 0, { dmg: 18 * this.dmgMult, color: '#ff3050' });
        g.gore.splat(x, z, 1.2, '#6a0818');
        return false;
      }
      return true;
    });
  }

  endAttack(cd) {
    this.state = 'chase';
    this.didHit = false;
    this.parts.scepter.rotation.x = 0;
    this.cooldown = cd * (this.hp < this.maxHp * 0.5 ? 0.7 : 1);
  }

  onDeath() {
    WhiteRabbit.prototype.onDeath.call(this);
    this.game.hud.banner('The Queen Has Fallen', '“…I’ll have your head for this.”', '#ff5a5a', '👑');
  }
}

// ───────────────────────── Director ─────────────────────────
// Enemy types register here so stage packs (e.g. clockenemies.js) can add
// their own without a circular import.
export const REGISTRY = {};
export const BOSS_ADDS = 4; // during a boss fight, at most this many other enemies
export const CARDS = {
  guard: { cost: 12, weight: 5, min: 0 },
  teacup: { cost: 15, weight: 3, min: 0 },
  wisp: { cost: 11, weight: 3, min: 0.6 },
  diamond: { cost: 13, weight: 3, min: 0 },
};

export class Director {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.credits = 75;
    this.timer = 0.8;
  }

  spawn(type, x, z, elite) {
    const g = this.game;
    const level = g.enemyLevel();
    const o = { level, elite };
    const Cls = REGISTRY[type];
    const e = new Cls(g, x, z, o);
    g.enemies.push(e);
    if (e.tier > (this.tierSeen || 0)) {
      this.tierSeen = e.tier;
      const tn = TIERS[e.tier];
      g.hud.banner(`The creatures evolve: ${tn.name}s`, e.tier === 1 ? 'Bigger, faster, and they have learned new tricks.' : 'Nightmares walk the garden now. Run, or grow stronger.', tn.color, e.tier === 1 ? '⚔️' : '💀');
      sfx('boss');
    }
    g.fx.portal(x, z, e.boss ? 5 : 1.6 * e.scale, e.elite ? e.elite.color : e.tier === 2 ? '#b040ff' : e.tier === 1 ? '#ffb040' : '#a040ff', e.boss ? 1.8 : 1.1);
    g.fx.burst(new THREE.Vector3(x, g.world.height(x, z) + 0.3, z), e.boss ? 60 : 14, '#8040ff', { speed: 4, g: -4, size: 0.4, life: 0.9 });
    sfx('spawn');
    return e;
  }

  // How many more non-boss enemies may join while a boss is up.
  addRoom() {
    const alive = this.game.enemies.filter((e) => e.alive && !e.boss).length;
    return Math.max(0, BOSS_ADDS - alive);
  }

  update(dt) {
    const g = this.game;
    const coeff = g.difficulty();
    const event = g.teleporter && g.teleporter.state === 'charging';
    this.credits += dt * (1.9 + 1.1 * coeff) * (event ? 1.8 : 1);
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1.6 + rand() * 2.2;
    const alive = g.enemies.filter((e) => e.alive && !e.boss).length;
    const bossUp = g.enemies.some((e) => e.boss && e.alive);
    if (bossUp && alive >= BOSS_ADDS) return;
    const minutes = g.runTime / 60;
    // the crowd cap starts small and grows with time and depth
    if (alive >= Math.min(32, 12 + Math.floor(minutes * 2.5) + (g.depth - 1) * 3)) return;
    const roster = g.world.theme.enemies || ['guard', 'teacup', 'wisp'];
    const opts = roster.map((type) => ({ type, ...CARDS[type] })).filter((c) => g.runTime / 60 >= c.min || g.depth > 1);
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
    const n = clamp(Math.floor(this.credits / cost), 1, elite ? 1 : Math.min(6, 3 + Math.floor(minutes / 3) + (g.depth - 1)));
    const nCap = bossUp ? Math.max(0, BOSS_ADDS - alive) : n;
    if (nCap <= 0) return;
    this.credits -= Math.min(n, nCap) * cost;
    // spawn cluster somewhere around the player, not on top of them
    const p = g.player.pos;
    const eliteType = elite ? ELITES[Math.floor(rand() * ELITES.length)] : null;
    for (let tries = 0; tries < 12; tries++) {
      const a = rand() * TAU;
      const R = 22 + rand() * 18;
      const cx = p.x + Math.cos(a) * R;
      const cz = p.z + Math.sin(a) * R;
      if (!g.world.canSpawn(cx, cz)) continue;
      for (let i = 0; i < Math.min(n, nCap); i++) {
        let x = cx + (rand() - 0.5) * 5;
        let z = cz + (rand() - 0.5) * 5;
        if (!g.world.canSpawn(x, z)) {
          x = cx;
          z = cz;
        }
        this.spawn(card.type, x, z, eliteType);
      }
      break;
    }
  }
}

Object.assign(REGISTRY, { guard: CardGuard, diamond: DiamondGuard, teacup: Teacup, wisp: ClockWisp, rabbit: WhiteRabbit, queen: QueenOfHearts });
