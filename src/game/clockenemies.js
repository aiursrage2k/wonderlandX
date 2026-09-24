// The Clockworks cast: Scissor-Handed Hatters, Pocket-Watch Spiders,
// Walking Teapot Cannons, and the Mad Hatter himself.

import * as THREE from 'three';
import { Enemy, REGISTRY, CARDS } from './enemies.js';
import { buildScissorHatter, buildWatchSpider, buildTeapotCannon } from '../gfx/clockmodels.js';
import { buildMadHatter } from '../gfx/bossmodels.js';
import { rearrange, CLOCK_R, CH_OUT } from '../world/clockworks.js';
import { rollItem, ITEM_BY_ID } from './items.js';
import { rand, clamp, lerp, angleDiff, TAU } from '../engine/util.js';
import { sfx } from '../engine/audio.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

// Lob a tea bomb that lands on a telegraphed ring.
function teaBomb(g, from, target, dmg, T, o = {}) {
  target.y = g.world.height(target.x, target.z);
  const v = new THREE.Vector3((target.x - from.x) / T, 0, (target.z - from.z) / T);
  v.y = (target.y - from.y + 0.5 * 20 * T * T) / T;
  g.combat.spawnEnemyShot('tea', from, v, dmg, { gravity: 20, splash: o.splash || 2.6, size: o.size || 1.6 });
  g.fx.ring(target.x, target.z, { r0: o.splash || 2.6, r1: o.splash || 2.6, dur: T, color: '#ff4010', pulse: true, fill: true, opacity: 0.3 });
}

// ───────────────────────── Scissor-Handed Hatter ─────────────────────────
export class ScissorHatter extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildScissorHatter(), x, z, { ...o, hp: 52, gold: 16, xp: 12 });
    this.name = 'Scissor-Handed Hatter';
    this.radius = 0.5;
    this.height = 2.4;
    this.hitR = 0.75;
    this.hitOffset = 1.3;
    this.speed = 6.6 + rand() * 0.8;
    this.dir = new THREE.Vector3();
    this.bloodColor = '#9a0c18';
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.distToPlayer();
    const parts = this.parts;
    this.cooldown -= dt;
    switch (this.state) {
      case 'chase':
        this.steer(p.pos.x, p.pos.z, this.speed * (1 + 0.08 * this.tier), dt);
        this.faceToward(p.pos.x, p.pos.z, dt, 10);
        if (d < 4.2 && this.cooldown <= 0 && p.alive) {
          this.state = 'windup';
          this.t = 0;
          this.snips = this.snips ?? this.tier;
          g.fx.sector(this.pos.x, this.pos.z, this.yaw, 1.3, 4.6, 0.45, { follow: this.pos, yawFn: () => this.yaw, color: '#ff3040' });
          sfx('telegraph');
        }
        break;
      case 'windup':
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        this.faceToward(p.pos.x, p.pos.z, dt, 8);
        if (this.t > 0.45) {
          this.state = 'snip';
          this.t = 0;
          this.didHit = false;
          this.dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          sfx('slash');
        }
        break;
      case 'snip': {
        this.vel.x = this.dir.x * 12;
        this.vel.z = this.dir.z * 12;
        const tip = tmp.copy(this.pos).addScaledVector(this.dir, 1.4);
        tip.y += 1.1;
        if (!this.didHit && tip.distanceTo(p.center) < 1.6) {
          this.didHit = true;
          p.hurt(13 * this.dmgMult);
          g.gore.spray(p.center.clone(), this.dir, 6);
        }
        if (this.t > 0.25) {
          if (this.snips > 0) {
            this.snips--;
            this.state = 'windup';
            this.t = 0.2;
          } else {
            this.snips = undefined;
            this.state = 'recover';
            this.t = 0;
          }
        }
        break;
      }
      case 'recover':
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (this.t > 0.5) {
          this.state = 'chase';
          this.cooldown = 0.8 + rand() * 0.8;
        }
        break;
    }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const k = clamp(hs / 6, 0, 1.3);
    const ph = this.t * 11 + this.phase;
    parts.legs[0].rotation.x = Math.sin(ph) * 0.8 * k;
    parts.legs[1].rotation.x = -Math.sin(ph) * 0.8 * k;
    parts.torso.rotation.x = this.state === 'snip' ? 0.35 : 0.12 * k;
    const open = this.state === 'windup' ? 0.7 : this.state === 'snip' ? 0.05 : 0.2 + Math.sin(this.t * 6) * 0.1;
    for (const a of parts.arms) {
      a.sh.rotation.x = this.state === 'windup' ? -1.0 : this.state === 'snip' ? -1.6 : -0.4 + Math.sin(ph) * 0.3 * k;
      a.blades[0].rotation.z = -open;
      a.blades[1].rotation.z = open;
    }
    parts.head.rotation.z = Math.sin(this.t * 2 + this.phase) * 0.2;
  }

  onDeath() {
    const g = this.game;
    g.gore.explode(this.hitCenter(new THREE.Vector3()), this.lastHitDir, { gibs: ['flesh', 'chunk', 'card', 'gear'], count: 11, scale: this.scale });
    sfx('shatter');
  }
}

// ───────────────────────── Pocket-Watch Spider ─────────────────────────
export class WatchSpider extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildWatchSpider(), x, z, { ...o, hp: 20, gold: 7, xp: 6 });
    this.name = 'Pocket-Watch Spider';
    this.radius = 0.45;
    this.height = 0.8;
    this.hitR = 0.6;
    this.hitOffset = 0.5;
    this.speed = 8.5 + rand() * 1.5;
    this.orbit = rand() < 0.5 ? 1 : -1;
    this.bloodColor = '#c9a04a';
    this.cooldown = 0.5 + rand() * 1.5;
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.distToPlayer();
    this.cooldown -= dt;
    switch (this.state) {
      case 'chase': {
        // skitter in, circling slightly
        tmp.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
        const tx = p.pos.x - tmp.x * 2 + -tmp.z * this.orbit * 3;
        const tz = p.pos.z - tmp.z * 2 + tmp.x * this.orbit * 3;
        this.steer(tx, tz, this.speed * (1 + 0.1 * this.tier), dt);
        this.faceToward(p.pos.x, p.pos.z, dt, 12);
        if (d < 7 && this.cooldown <= 0 && this.grounded && p.alive) {
          this.state = 'crouch';
          this.t = 0;
          this.target = p.pos.clone().addScaledVector(p.vel, 0.35);
          g.fx.ring(this.target.x, this.target.z, { r0: 1.2, r1: 1.2, dur: 0.4, color: '#ff3040', pulse: true, fill: true, opacity: 0.3 });
        }
        break;
      }
      case 'crouch':
        this.vel.multiplyScalar(Math.exp(-14 * dt));
        this.parts.body.position.y = 0.5 - Math.min(1, this.t / 0.4) * 0.25;
        if (this.t > 0.4) {
          this.state = 'leap';
          this.t = 0;
          this.didHit = false;
          const T = 0.45;
          this.vel.set((this.target.x - this.pos.x) / T, 7, (this.target.z - this.pos.z) / T);
          this.parts.body.position.y = 0.5;
        }
        break;
      case 'leap':
        if (!this.didHit && this.hitCenter(tmp).distanceTo(p.center) < 1.1) {
          this.didHit = true;
          p.hurt(8 * this.dmgMult);
        }
        if (this.t > 0.2 && this.grounded) {
          this.state = 'chase';
          this.cooldown = 1.2 + rand() * 1.2 - 0.3 * this.tier;
          this.vel.x *= 0.2;
          this.vel.z *= 0.2;
        }
        break;
    }
    // eight-legged gait
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const k = clamp(hs / 8, 0, 1.2);
    for (const L of this.parts.legs) {
      const s = Math.sin(this.t * 22 + L.phase);
      L.hip.rotation.x = s * 0.35 * k;
      L.knee.rotation.x = Math.max(0, -s) * 0.5 * k + (this.state === 'leap' ? -0.6 : 0);
    }
    this.parts.body.rotation.z = Math.sin(this.t * 30) * 0.04 * k;
  }

  onDeath() {
    const g = this.game;
    g.gore.explode(this.hitCenter(new THREE.Vector3()), this.lastHitDir, { gibs: ['gear', 'gear', 'shard'], count: 6, scale: 0.6, blood: '#6a3a10' });
    sfx('shatter');
  }
}

// ───────────────────────── Walking Teapot Cannon ─────────────────────────
export class TeapotCannon extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildTeapotCannon(), x, z, { ...o, hp: 95, gold: 24, xp: 18 });
    this.name = 'Teapot Cannon';
    this.radius = 1.0;
    this.height = 2.6;
    this.hitR = 1.1;
    this.hitOffset = 1.4;
    this.speed = 2.8;
    this.strafe = rand() < 0.5 ? 1 : -1;
    this.cooldown = 2 + rand() * 2;
    this.bloodColor = '#7a2a08';
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.distToPlayer();
    this.cooldown -= dt;
    this.faceToward(p.pos.x, p.pos.z, dt, 3);
    if (this.state === 'aim') {
      this.vel.multiplyScalar(Math.exp(-8 * dt));
      this.parts.muzzle.material.color.setRGB(1, 0.45 + Math.sin(this.t * 30) * 0.3, 0.1);
      const shots = 3 + this.tier;
      if (this.t > 0.7 && this.fired < shots && this.t > 0.7 + this.fired * 0.28) {
        this.fired++;
        const from = new THREE.Vector3();
        this.parts.muzzle.getWorldPosition(from);
        const T = clamp(d / 15, 0.8, 1.6);
        const spread = (this.fired - (shots + 1) / 2) * 2.6;
        const target = p.pos.clone().addScaledVector(p.vel, T * 0.5);
        target.x += Math.cos(this.yaw) * spread;
        target.z -= Math.sin(this.yaw) * spread;
        teaBomb(g, from, target, 14 * this.dmgMult, T);
        g.fx.flash(from, '#ff8020', 2.5, 0.12);
        g.fx.smoke(from, '#6a5a58', 3, 0.6);
        this.recoil = 1;
        sfx('boil');
      }
      if (this.t > 0.7 + shots * 0.28 + 0.4) {
        this.state = 'chase';
        this.cooldown = 3.2 + rand() * 1.5 - 0.4 * this.tier;
      }
    } else {
      // keep artillery range, sidle
      const want = d > 24 ? 1 : d < 12 ? -1 : 0;
      tmp.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
      this.steer(this.pos.x + tmp.x * want * 4 - tmp.z * this.strafe * 2, this.pos.z + tmp.z * want * 4 + tmp.x * this.strafe * 2, this.speed, dt);
      if (rand() < 0.005) this.strafe *= -1;
      if (this.cooldown <= 0 && d < 34 && p.alive) {
        this.state = 'aim';
        this.t = 0;
        this.fired = 0;
        sfx('telegraph');
      }
    }
    // piston walk
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const k = clamp(hs / 3, 0, 1);
    this.parts.legs.forEach((L, i) => {
      L.knee.rotation.x = Math.sin(this.t * 7 + i * Math.PI * 0.5) * 0.35 * k;
    });
    this.recoil = Math.max(0, (this.recoil || 0) - dt * 4);
    this.parts.spout.position.z = 0.7 - this.recoil * 0.2;
    this.parts.body.position.y = 1.3 + Math.abs(Math.sin(this.t * 7)) * 0.06 * k;
    if (Math.random() < 0.2) {
      const c = this.hitCenter(tmp2);
      g.fx.smoke(tmp.set(c.x, c.y + 1.4, c.z), '#c8c0c8', 1, 0.4);
    }
  }

  onDeath() {
    const g = this.game;
    const c = this.hitCenter(new THREE.Vector3());
    g.gore.explode(c, this.lastHitDir, { gibs: ['gear', 'shard', 'gear', 'chunk'], count: 12, blood: '#7a2a08', scale: this.scale });
    g.combat.explode(c, 3, 0, { dmg: 0, color: '#ff8020' });
    g.combat.puddle(this.pos.x, this.pos.z, 2.6, 3, { owner: 'enemy', dmg: 4, color: '#ff5010' });
    sfx('shatter');
  }
}

// ───────────────────────── The Mad Hatter ─────────────────────────
export class MadHatter extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildMadHatter(), x, z, { ...o, hp: 2800, gold: 170, xp: 260, elite: null, boss: true });
    this.name = 'The Mad Hatter';
    this.subtitle = 'Keeper of the Unbirthday Hour';
    this.boss = true;
    this.radius = 1.4;
    this.height = 6.4;
    this.hitR = 1.8;
    this.hitOffset = 3.2;
    this.speed = 5.2;
    this.cooldown = 2.2;
    this.summonT = 16;
    this.twelveT = 9; // first strike comes early so players learn it
    this.dir = new THREE.Vector3();
    this.bloodColor = '#9a0c18';
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.distToPlayer();
    const parts = this.parts;
    const enraged = this.hp < this.maxHp * 0.5;
    this.cooldown -= dt;
    this.summonT -= dt;
    this.twelveT -= dt;
    switch (this.state) {
      case 'chase':
        this.steer(p.pos.x, p.pos.z, this.speed * (enraged ? 1.25 : 1), dt);
        this.faceToward(p.pos.x, p.pos.z, dt, 4);
        if (this.cooldown <= 0 && p.alive) {
          this.t = 0;
          this.didHit = false;
          this.fired = 0;
          if (this.twelveT <= 0 && g.world.clock) this.state = 'twelve';
          else if (d < 6) this.state = 'snip';
          else if (this.summonT <= 0) this.state = 'summon';
          else this.state = rand() < 0.5 ? 'teatime' : 'hat';
          this.telegraph();
        }
        break;
      case 'twelve': {
        // the watch strikes twelve: tick, toll, and the floor rearranges
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        parts.watch.rotation.x = -1.4;
        parts.watchGlow.opacity = 0.4 + Math.sin(this.t * 20) * 0.4;
        const tolls = Math.floor(this.t / 0.22);
        if (tolls > (this.tolled || 0) && tolls <= 12) {
          this.tolled = tolls;
          sfx(tolls === 12 ? 'bell' : 'tick');
        }
        if (this.t > 3.2) {
          parts.watchGlow.opacity = 0;
          this.tolled = 0;
          this.twelveT = enraged ? 16 : 22;
          this.endAttack(0.8);
        }
        break;
      }
      case 'teatime':
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        parts.arms[1].sh.rotation.x = -2.2;
        if (this.t > 0.6 && !this.didHit) {
          this.didHit = true;
          const from = new THREE.Vector3();
          parts.pot.getWorldPosition(from);
          for (const tg of this.bombTargets) teaBomb(g, from, tg, 16 * this.dmgMult, 1.1 + rand() * 0.5, { splash: 2.8, size: 1.8 });
          sfx('boil');
        }
        if (this.t > 1.6) this.endAttack(1.1);
        break;
      case 'hat': {
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (this.t > 0.7 && !this.didHit) {
          this.didHit = true;
          this.throwHat();
        }
        if (this.t > 1.2) this.endAttack(1.4);
        break;
      }
      case 'snip': {
        if (this.t < 0.75) {
          this.vel.multiplyScalar(Math.exp(-10 * dt));
          this.yaw += angleDiff(this.yaw, Math.atan2(this.dir.x, this.dir.z)) * 0.3;
        } else if (this.t < 1.2) {
          this.vel.x = this.dir.x * 20;
          this.vel.z = this.dir.z * 20;
          if (!this.didHit && this.pos.distanceTo(p.pos) < 2.6) {
            this.didHit = true;
            p.hurt(24 * this.dmgMult);
            p.vel.addScaledVector(this.dir, 12);
            p.vel.y = 7;
          }
        } else this.endAttack(1.0);
        break;
      }
      case 'summon':
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (this.t > 1.0 && !this.didHit) {
          this.didHit = true;
          sfx('bell');
          for (const sp of this.summonSpots.slice(0, g.director.addRoom())) g.director.spawn('spider', sp.x, sp.z, null);
          this.summonT = 20;
        }
        if (this.t > 1.5) this.endAttack(0.8);
        break;
    }

    // animation: loping walk, hat tilt, watch swing
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const k = clamp(hs / 5, 0, 1.4);
    const ph = this.t * 7 + this.phase;
    parts.legs[0].rotation.x = Math.sin(ph) * 0.7 * k;
    parts.legs[1].rotation.x = -Math.sin(ph) * 0.7 * k;
    parts.torso.rotation.z = Math.sin(ph) * 0.07 * k;
    parts.torso.rotation.x = this.state === 'snip' && this.t > 0.75 ? 0.45 : 0.05;
    if (this.state !== 'teatime') parts.arms[1].sh.rotation.x = lerp(parts.arms[1].sh.rotation.x, -Math.sin(ph) * 0.5 * k, 0.2);
    if (this.state !== 'twelve') {
      parts.arms[0].sh.rotation.x = Math.sin(ph) * 0.5 * k - 0.3;
      parts.watch.rotation.x = Math.sin(this.t * 3) * 0.5;
    } else parts.arms[0].sh.rotation.x = -1.6;
    parts.head.rotation.z = Math.sin(this.t * 1.7) * 0.15;
    parts.hat.visible = !this.hatOut;
  }

  // Name the attack and paint its danger zone before it lands.
  telegraph() {
    const g = this.game;
    const p = g.player;
    const enraged = this.hp < this.maxHp * 0.5;
    sfx('telegraph');
    switch (this.state) {
      case 'twelve': {
        rearrange(g.world, enraged ? 5 : 4, 3, 3.2, 9);
        g.hud.warn('The Watch Strikes Twelve!', 'red hours sink into tea — gold hours rise. Move!', 3.0);
        g.camShake(0.3);
        break;
      }
      case 'teatime': {
        this.bombTargets = [];
        const n = enraged ? 8 : 6;
        for (let i = 0; i < n; i++) {
          const a = rand() * TAU;
          const r = i === 0 ? 0 : 2 + rand() * 7;
          this.bombTargets.push(new THREE.Vector3(p.pos.x + p.vel.x * 0.5 + Math.cos(a) * r, 0, p.pos.z + p.vel.z * 0.5 + Math.sin(a) * r));
        }
        g.hud.warn('Tea Time!', 'scalding bombs incoming — leave the rings', 1.2);
        break;
      }
      case 'hat': {
        this.hatDir = new THREE.Vector3(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
        const y = this.pos.y + 0.3;
        const from = new THREE.Vector3(this.pos.x, y, this.pos.z);
        g.fx.beam(from, from.clone().addScaledVector(this.hatDir, 26), { color: '#ff3050', width: 1.4, dur: 0.7, opacity: 0.35 });
        g.hud.warn('Hat Throw', 'it comes back — stay out of the lane', 0.9);
        break;
      }
      case 'snip': {
        this.dir.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
        const end = this.pos.clone().addScaledVector(this.dir, 9);
        g.fx.beam(this.pos.clone().setY(this.pos.y + 0.3), end.setY(this.pos.y + 0.3), { color: '#ff2020', width: 2.2, dur: 0.75, opacity: 0.4 });
        g.hud.warn('Snip Dash', 'sidestep!', 0.75);
        break;
      }
      case 'summon':
        this.summonSpots = [0, 1, 2, 3].map(() => {
          for (let k = 0; k < 12; k++) {
            const a = rand() * TAU;
            const x = this.pos.x + Math.cos(a) * 5;
            const z = this.pos.z + Math.sin(a) * 5;
            if (g.world.canSpawn(x, z)) return { x, z };
          }
          return { x: this.pos.x, z: this.pos.z };
        });
        for (const sp of this.summonSpots) g.fx.ring(sp.x, sp.z, { r0: 1.2, r1: 1.2, dur: 1.0, color: '#a040ff', pulse: true, fill: true, opacity: 0.4 });
        g.hud.warn('Wind-Up Spiders', 'reinforcements incoming', 1.0);
        break;
    }
  }

  // The hat flies out along the lane and spins back to his head.
  throwHat() {
    const g = this.game;
    const hat = this.parts.hat.clone(true);
    hat.scale.setScalar(1.6);
    g.scene.add(hat);
    this.hatOut = true;
    const start = this.hitCenter(new THREE.Vector3());
    start.y = this.pos.y + 1.3;
    const dir = this.hatDir.clone();
    let t = 0;
    const out = 1.0;
    const hitAt = new Set();
    g.addTicker((dt) => {
      t += dt;
      const k = t < out ? Math.sin((t / out) * Math.PI * 0.5) : Math.max(0, 1 - (t - out) / out);
      const back = t >= out;
      const target = back ? this.hitCenter(tmp2).setY(this.pos.y + 1.3) : start;
      hat.position.copy(target).addScaledVector(dir, 24 * k);
      hat.rotation.y += dt * 18;
      g.fx.trail(hat.position, '#ff3050', 0.6, 0.25, 0.8);
      const p = g.player;
      const phase = back ? 1 : 0;
      if (!hitAt.has(phase) && p.alive && hat.position.distanceTo(p.center) < 1.8) {
        hitAt.add(phase);
        p.hurt(18 * this.dmgMult);
      }
      if ((back && k <= 0.02) || !this.alive || t > 3) {
        g.scene.remove(hat);
        this.hatOut = false;
        return false;
      }
      return true;
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
    g.fx.burst(c, 80, '#ffffff', { speed: 18, size: 0.5, life: 1.2 });
    g.gore.explode(c, this.lastHitDir, { gibs: ['flesh', 'card', 'gear', 'chunk', 'flesh'], count: 16, scale: 2.6 });
    g.fx.ring(this.pos.x, this.pos.z, { r0: 1, r1: 18, dur: 0.8, color: '#ff8030' });
    g.camShake(1.2);
    sfx('bell');
    sfx('boss');
    // the floor settles when its keeper dies
    if (g.world.clock) for (const s of g.world.clock.sectors) {
      s.warn = null;
      s.warnT = 0;
      s.target = 0;
    }
    // the cursed reward, plus the usual spoils
    const drops = [ITEM_BY_ID.broken_watch, rollItem(rand, { legendary: 0.12, uncommon: 0.88 })];
    for (let i = 0; i < Math.min(3, g.depth); i++) drops.push(rollItem(rand, { legendary: 0.02, uncommon: 0.25 }));
    const at = this.pos.clone().setY(this.pos.y + 2);
    // keep the loot over solid floor
    if (Math.hypot(at.x, at.z) > CLOCK_R - 3 && Math.hypot(at.x, at.z) < CH_OUT + 1) at.multiplyScalar((CLOCK_R - 6) / Math.hypot(at.x, at.z));
    drops.forEach((it, i) => {
      const a = (i / drops.length) * TAU;
      g.spawnPickup(it, at, new THREE.Vector3(Math.cos(a) * 3, 12, Math.sin(a) * 3));
    });
    g.hud.banner('The Hatter Is Dead', '“…It’s always six o’clock now.”', '#ff9a40', '🎩');
  }
}

Object.assign(CARDS, {
  hatter: { cost: 13, weight: 5, min: 0 },
  spider: { cost: 6, weight: 4, min: 0 },
  cannon: { cost: 22, weight: 2, min: 0 },
});
Object.assign(REGISTRY, { hatter: ScissorHatter, spider: WatchSpider, cannon: TeapotCannon, madhatter: MadHatter });
