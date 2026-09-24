// The final court: two Knights of Hearts at the Queen's side, and the
// Crimson Queen she becomes when they all fall.

import * as THREE from 'three';
import { Enemy, REGISTRY } from './enemies.js';
import { buildHeartKnight, buildCrimsonQueen } from '../gfx/thronemodels.js';
import { cardTexture } from '../gfx/textures.js';
import { rollItem } from './items.js';
import { rand, lerp, angleDiff, TAU } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { ARENA_R } from '../world/throne.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

// ───────────────────────── Knight of Hearts ─────────────────────────
export class HeartKnight extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildHeartKnight(o.rank || 'K'), x, z, { ...o, hp: 900, gold: 90, xp: 160, elite: null, boss: true });
    this.name = o.rank === 'J' ? 'The Knave of Hearts' : 'The King’s Knight';
    this.subtitle = 'Sworn Shield of the Court';
    this.boss = true;
    this.radius = 0.8;
    this.height = 3.6;
    this.hitR = 1.1;
    this.hitOffset = 1.9;
    this.speed = 5.2;
    this.cooldown = 1.5 + rand();
    this.scale = 1.25;
    this.state = 'kneel';
    this.kneelT = 1.8 + rand() * 0.6;
    this.dashDir = new THREE.Vector3();
    this.gibKinds = ['card', 'chunk', 'flesh', 'card'];
  }

  hurt(dmg, crit, dir) {
    // the heart shield turns aside blows from the front while raised
    if (this.state === 'guard' && dir) {
      const fwd = tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      if (fwd.dot(tmp2.copy(dir).setY(0).normalize()) < -0.3) {
        dmg *= 0.15;
        const c = this.hitCenter(tmp2).addScaledVector(fwd, 0.8);
        this.game.fx.burst(c, 5, '#ffd070', { speed: 6, size: 0.2, life: 0.25 });
      }
    }
    return super.hurt(dmg, crit, dir);
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.distToPlayer();
    const parts = this.parts;
    this.cooldown -= dt;
    let walk = 0;
    switch (this.state) {
      case 'kneel':
        this.vel.set(0, 0, 0);
        this.faceToward(p.pos.x, p.pos.z, dt, 2);
        if (this.t > this.kneelT) {
          this.state = 'chase';
          sfx('telegraph');
        }
        break;
      case 'chase': {
        this.steer(p.pos.x, p.pos.z, this.speed * (this.hp < this.maxHp * 0.5 ? 1.2 : 1), dt);
        this.faceToward(p.pos.x, p.pos.z, dt, 6);
        walk = 1;
        if (this.cooldown <= 0 && p.alive) {
          this.t = 0;
          this.didHit = false;
          const r = rand();
          if (d < 5.5) this.state = r < 0.7 ? 'cleave' : 'guard';
          else if (d < 22) this.state = r < 0.55 ? 'charge' : r < 0.8 ? 'guard' : 'chase';
          if (this.state === 'cleave') {
            g.fx.sector(this.pos.x, this.pos.z, this.yaw, 2.0, 5.8, 0.75, { follow: this.pos, yawFn: () => this.yaw });
            sfx('telegraph');
          } else if (this.state === 'charge') {
            this.dashDir.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
            const end = this.pos.clone().addScaledVector(this.dashDir, 20);
            end.y = 0.3;
            g.fx.beam(this.pos.clone().setY(0.3), end, { color: '#ff2040', width: 1.5, dur: 0.9, opacity: 0.4 });
            g.hud.warn('Shield Charge', 'dodge sideways', 0.9);
            sfx('telegraph');
          } else if (this.state === 'guard') {
            this.guardT = 2.2;
          } else this.cooldown = 0.6;
        }
        break;
      }
      case 'cleave': {
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        if (this.t < 0.45) this.faceToward(p.pos.x, p.pos.z, dt, 4);
        if (this.t > 0.75 && !this.didHit) {
          this.didHit = true;
          const fwd = tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          const to = tmp2.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z);
          if (to.length() < 6 && fwd.dot(to.normalize()) > Math.cos(1.0)) p.hurt(24 * this.dmgMult);
          const c = this.pos.clone().addScaledVector(fwd, 3);
          g.fx.ring(c.x, c.z, { r0: 0.5, r1: 4, dur: 0.3, color: '#ff4060' });
          g.fx.burst(c.setY(c.y + 0.5), 24, '#ffd070', { speed: 9, size: 0.3, life: 0.35 });
          g.camShake(0.3);
          sfx('slash3');
        }
        if (this.t > 1.3) this.endAttack(1.2);
        break;
      }
      case 'charge': {
        if (this.t < 0.9) {
          this.vel.multiplyScalar(Math.exp(-10 * dt));
          break;
        }
        if (this.t < 1.65) {
          this.vel.set(this.dashDir.x * 27, this.vel.y, this.dashDir.z * 27);
          walk = 2;
          if (!this.didHit && p.alive && this.distToPlayer() < 2.2) {
            this.didHit = true;
            if (p.hurt(26 * this.dmgMult)) p.vel.addScaledVector(this.dashDir, 14).setY(7);
          }
          if (Math.random() < 0.6) g.fx.spark(this.pos.x, this.pos.y + 0.3, this.pos.z, '#ff4060', { speed: 3, g: -2, size: 0.4, life: 0.4 });
        } else {
          this.vel.multiplyScalar(Math.exp(-8 * dt));
          if (this.t > 2.2) this.endAttack(1.0);
        }
        break;
      }
      case 'guard':
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        this.faceToward(p.pos.x, p.pos.z, dt, 8);
        this.guardT -= dt;
        if (this.guardT <= 0) this.endAttack(0.4);
        break;
    }
    // animation
    const L = parts.legs;
    const ph = this.t * 9;
    const kneel = this.state === 'kneel' ? 1 : 0;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const sw = walk ? Math.min(1, hs / 5) * 0.7 : 0;
    L[0].hip.rotation.x = kneel ? -1.5 : Math.sin(ph) * sw;
    L[0].knee.rotation.x = kneel ? 1.5 : Math.max(0, -Math.sin(ph)) * sw * 1.2;
    L[1].hip.rotation.x = kneel ? 0.2 : -Math.sin(ph) * sw;
    L[1].knee.rotation.x = kneel ? 1.7 : Math.max(0, Math.sin(ph)) * sw * 1.2;
    parts.body.position.y = kneel ? -0.62 : Math.abs(Math.sin(ph)) * 0.05 * sw;
    parts.torso.rotation.x = kneel ? 0.35 : this.state === 'charge' && this.t > 0.9 ? 0.35 : 0;
    const A = parts.arms;
    const cl = this.state === 'cleave' ? (this.t < 0.65 ? -2.7 * Math.min(1, this.t / 0.5) : Math.min(0.6, -2.7 + (this.t - 0.65) * 18)) : null;
    A[1].sh.rotation.x = cl !== null ? cl : kneel ? -0.4 : -0.3 + Math.sin(ph) * sw * 0.3;
    parts.halberd.rotation.x = cl !== null ? 1.2 : kneel ? 0.1 : 0.25;
    const guard = this.state === 'guard' || (this.state === 'charge' && this.t > 0.5) ? 1 : 0;
    A[0].sh.rotation.x = lerp(A[0].sh.rotation.x, guard ? -1.45 : -0.3, 1 - Math.exp(-12 * this.game.dt));
    A[0].sh.rotation.z = guard ? 0.5 : 0.1;
    A[0].el.rotation.x = guard ? -0.3 : -0.5;
    parts.glowMat.emissiveIntensity = 2 + (this.state === 'guard' ? Math.sin(this.t * 14) * 1.2 : 0);
  }

  endAttack(cd) {
    this.state = 'chase';
    this.didHit = false;
    this.cooldown = cd * (this.hp < this.maxHp * 0.5 ? 0.7 : 1);
  }

  onDeath() {
    const g = this.game;
    const c = this.hitCenter(new THREE.Vector3());
    g.gore.explode(c, this.lastHitDir, { gibs: this.gibKinds, count: 12, scale: 1.8 });
    g.fx.burst(c, 50, '#ffd070', { speed: 12, size: 0.4, life: 0.9 });
    g.fx.ring(this.pos.x, this.pos.z, { r0: 1, r1: 10, dur: 0.6, color: '#ff3050' });
    g.spawnPickup(rollItem(rand, { legendary: 0.05, uncommon: 0.6 }), c, new THREE.Vector3((rand() - 0.5) * 4, 10, (rand() - 0.5) * 4));
    g.hud.banner(`${this.name} Falls`, '“For the Queen…”', '#ff5a6a', '🛡️');
    sfx('bell');
  }
}

// ───────────────────────── The Crimson Queen ─────────────────────────
const ATTACKS = ['rake', 'slam', 'decree', 'lance', 'thorns'];

export class CrimsonQueen extends Enemy {
  constructor(game, x, z, o) {
    super(game, buildCrimsonQueen(), x, z, { ...o, hp: 6500, gold: 500, xp: 800, elite: null, boss: true });
    this.name = 'The Crimson Queen';
    this.subtitle = 'Phase II — Heart of the Deck';
    this.boss = true;
    this.colossus = true;
    this.radius = 7;
    this.height = 30;
    this.scale = 2.2;
    this.hitR = 3.2 * this.scale;
    this.hitOffset = 0;
    this.state = 'rise';
    this.riseY0 = -80;
    this.riseY1 = -27;
    this.pos.y = this.riseY0;
    this.yaw = Math.atan2(-x, -z);
    this.cooldown = 2.5;
    this.summonT = 20;
    this.lastAtk = null;
    this.bloodColor = '#c01030';
    this.gibKinds = ['card', 'card', 'flesh', 'chunk'];
    this.model.scale.setScalar(this.scale);
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;
    this.cardMat = new THREE.MeshStandardMaterial({ map: cardTexture('♥', 'Q'), side: THREE.DoubleSide, roughness: 0.6, emissive: '#400010', emissiveIntensity: 0.6 });
    this.cardGeo = new THREE.PlaneGeometry(2.4, 3.4);
    this.claw = this.buildClaw();
    // she needs her own light to read against the dark: a crimson key from
    // below and a cold moonlit fill from above
    const key = new THREE.PointLight('#ff4060', 380, 70, 1.5);
    key.position.set(0, 24, 11);
    this.model.add(key);
    const fill = new THREE.PointLight('#c0a0ff', 420, 80, 1.4);
    fill.position.set(0, 36, 8);
    this.model.add(fill);
  }

  // A talon torn through the air above the target.
  buildClaw() {
    const g = new THREE.Group();
    const black = new THREE.MeshStandardMaterial({ color: '#140a10', metalness: 0.6, roughness: 0.3 });
    const gold = new THREE.MeshStandardMaterial({ color: '#d2a64c', metalness: 0.95, roughness: 0.25 });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + 0.4;
      const f = new THREE.Group();
      f.position.set(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6);
      f.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 3, 6), black);
      bone.position.y = 1.5;
      f.add(bone);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.1, 4, 10), gold);
      band.rotation.x = Math.PI / 2;
      band.position.y = 1.8;
      f.add(band);
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.4, 6), black);
      talon.rotation.x = Math.PI;
      talon.position.y = -1.7;
      f.add(talon);
      g.add(f);
    }
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 8), black);
    palm.scale.y = 0.6;
    palm.position.y = 3.2;
    g.add(palm);
    g.visible = false;
    this.game.scene.add(g);
    return g;
  }

  // her weak point is the crystal heart in her chest
  hitCenter(out) {
    this.parts.crystal.getWorldPosition(out);
    return out;
  }

  // a colossus doesn't strobe white on every hit: the heart flares instead
  flash(t) {
    this.flashT = t;
    this.meshes = [];
  }

  unflash() {}

  integrate() {}

  update(dt) {
    this.baseUpdate(dt);
    const parts = this.parts;
    const t = this.game.time;
    // the card vortex churns around her
    for (const c of parts.cards) {
      const a = c.a + t * c.s;
      c.m.position.set(Math.cos(a) * c.r, c.y + Math.sin(t * 0.8 + c.a * 3) * 0.6, Math.sin(a) * c.r);
      c.m.rotation.set(t * c.s * 2 + c.a, a, 0.3);
    }
    parts.wings.forEach((w, i) => {
      w.rotation.y = Math.sin(t * 0.7 + i) * 0.08;
      w.rotation.z = Math.sin(t * 0.5 + i * 2) * 0.05;
    });
    const beat = Math.max(0, Math.sin(t * (this.enraged ? 7 : 3.5)));
    parts.heartMat.emissiveIntensity = 1.1 + beat * 1.0 + (this.flashT > 0 ? 2 : 0) + (this.charging || 0) * 4;
    parts.crystal.scale.setScalar(1 + beat * 0.06 + (this.flashT > 0 ? 0.05 : 0));
    if (!this.alive) {
      this.deadT += dt;
      this.deathAnim(dt);
      return this.deadT < 6;
    }
    if (this.state === 'rise') {
      const k = Math.min(1, this.t / 5.5);
      this.pos.y = lerp(this.riseY0, this.riseY1, 1 - (1 - k) ** 3);
      if (Math.random() < 0.5) this.game.camShake(0.08);
      if (k >= 1) {
        this.state = 'idle';
        this.t = 0;
        this.game.hud.banner('The Crimson Queen', '“I AM the heart of this deck. Kneel, or be cut.”', '#ff2040', '👑');
        sfx('boss');
        this.game.camShake(1);
      }
    } else this.think(dt);
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;
    return true;
  }

  get enraged() {
    return this.hp < this.maxHp * 0.5;
  }

  think(dt) {
    const g = this.game;
    const p = g.player;
    const parts = this.parts;
    this.cooldown -= dt;
    this.summonT -= dt;
    // she tracks Alice with her whole body, slowly
    const want = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    this.yaw += angleDiff(this.yaw, want) * (1 - Math.exp(-0.8 * dt));
    if (this.enraged && !this.enrageSaid) {
      this.enrageSaid = true;
      this.subtitle = 'Phase III — The Heart Breaks';
      g.hud.banner('The Heart Breaks', 'She bleeds light. Everything comes faster now.', '#ff2040', '💔');
      sfx('boss');
    }
    if (this.enraged && Math.random() < 0.3) {
      const c = this.hitCenter(tmp);
      g.fx.spark(c.x + (rand() - 0.5) * 3, c.y - 2, c.z + (rand() - 0.5) * 3, '#ff2040', { speed: 2, g: 6, size: 0.5, life: 1.2 });
    }
    if (this.state === 'idle') {
      if (this.cooldown > 0 || !p.alive) return this.pose(dt, null);
      this.t = 0;
      this.didHit = false;
      this.fired = 0;
      let atk;
      if (this.summonT <= 0 && g.director.addRoom() > 1) atk = 'summon';
      else {
        do atk = ATTACKS[Math.floor(rand() * ATTACKS.length)];
        while (atk === this.lastAtk);
      }
      this.lastAtk = atk;
      this.state = atk;
      this.begin(atk);
    }
    const E = this.enraged;
    switch (this.state) {
      case 'rake': {
        // two passes of claw furrows across the hall
        const passes = E ? 2 : 1;
        if (this.t > 1.15 + this.fired * 0.9 && this.fired < passes) {
          this.rakeHit(this.rakeYaws[this.fired]);
          this.fired++;
          if (this.fired < passes) this.telegraphRake(1);
        }
        if (this.t > 1.2 + passes * 0.9) this.end(2.0);
        break;
      }
      case 'slam': {
        const n = E ? 4 : 3;
        if (this.t > 0.2 + this.fired * 0.75 && this.fired < n) {
          this.fired++;
          const tx = p.pos.x + p.vel.x * 0.5 + (this.fired > 1 ? (rand() - 0.5) * 4 : 0);
          const tz = p.pos.z + p.vel.z * 0.5 + (this.fired > 1 ? (rand() - 0.5) * 4 : 0);
          this.talon(tx, tz);
        }
        if (this.t > 0.2 + n * 0.75 + 1.8) this.end(1.8);
        break;
      }
      case 'decree': {
        if (!this.didHit && this.t > 0.6) {
          this.didHit = true;
          const n = E ? 18 : 12;
          for (let i = 0; i < n; i++) {
            const a = rand() * TAU;
            const r = i === 0 ? 0 : 2.5 + rand() * 11;
            let x = p.pos.x + p.vel.x * 0.5 + Math.cos(a) * r;
            let z = p.pos.z + p.vel.z * 0.5 + Math.sin(a) * r;
            const d = Math.hypot(x, z);
            if (d > ARENA_R - 1) {
              x *= (ARENA_R - 1) / d;
              z *= (ARENA_R - 1) / d;
            }
            this.cardDrop(x, z, 1.1 + i * 0.08);
          }
        }
        if (this.t > 3.4) this.end(1.6);
        break;
      }
      case 'lance': {
        const n = E ? 3 : 2;
        const per = 1.5;
        const k = this.t - this.fired * per;
        this.charging = Math.min(1, Math.max(0, k / 1.1));
        if (k > 0 && !this.lanceAim) {
          // aim, and paint the lane on the floor
          this.lanceAim = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
          g.fx.sector(this.pos.x, this.pos.z, this.lanceAim, 0.055, 130, 1.1, { y: 0.02, color: '#ff1030' });
          sfx('telegraph');
        }
        if (k > 1.1 && this.lanceAim !== null) {
          this.fireLance(this.lanceAim);
          this.lanceAim = null;
          this.fired++;
          if (this.fired >= n) this.charging = 0;
        }
        if (this.fired >= n && this.t > n * per + 0.6) this.end(1.8);
        break;
      }
      case 'thorns': {
        const rings = E ? 2 : 1;
        if (this.t > 1.0 + this.fired * 1.3 && this.fired < rings) {
          this.fired++;
          this.roseRing(this.fired === 2);
        }
        if (this.t > 1.0 + rings * 1.3 + 2.8) this.end(1.4);
        break;
      }
      case 'summon':
        if (!this.didHit && this.t > 1.0) {
          this.didHit = true;
          g.hud.banner('“Deal them in!”', 'The deck answers its Queen.', '#ff3048', '♠');
          const n = Math.min(4, g.director.addRoom());
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + rand();
            const r = 12 + rand() * 20;
            g.director.spawn(i % 2 ? 'diamond' : 'guard', Math.cos(a) * r, Math.sin(a) * r, null);
          }
          this.summonT = 26;
        }
        if (this.t > 1.8) this.end(1.0);
        break;
    }
    this.pose(dt, this.state);
  }

  begin(atk) {
    const g = this.game;
    sfx(atk === 'thorns' || atk === 'rake' ? 'boss' : 'telegraph');
    switch (atk) {
      case 'rake':
        this.telegraphRake(0);
        g.hud.warn('Talon Rake', 'get out of the red furrows', 1.1);
        break;
      case 'slam':
        g.hud.warn('Talons from the Void', 'keep moving — then JUMP the shockwave', 1.4);
        break;
      case 'decree':
        g.hud.warn('Royal Decree', 'the deck is falling — leave the circles', 1.2);
        break;
      case 'lance':
        this.lanceAim = null;
        g.hud.warn('Heart Lance', 'sidestep the burning line', 1.2);
        break;
      case 'thorns':
        g.hud.warn('Ring of Thorns', 'JUMP as it passes', 1.4);
        break;
      case 'summon':
        g.hud.warn('Deal Them In', 'reinforcements', 1.0);
        break;
    }
  }

  end(cd) {
    this.state = 'idle';
    this.t = 0;
    this.charging = 0;
    this.cooldown = cd * (this.enraged ? 0.6 : 1);
  }

  // Three claw furrows, fanned around where Alice stands.
  telegraphRake(pass) {
    const g = this.game;
    const p = g.player;
    const base = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + (pass ? (rand() < 0.5 ? -0.06 : 0.06) : 0);
    const yaws = [base - 0.13, base, base + 0.13];
    (this.rakeYaws ||= [])[pass] = yaws;
    for (const y of yaws) g.fx.sector(this.pos.x, this.pos.z, y, 0.05, 130, pass ? 0.9 : 1.15, { y: 0.02, color: '#ff2040' });
  }

  rakeHit(yaws) {
    const g = this.game;
    const p = g.player;
    const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const pa = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    for (const y of yaws) {
      if (Math.abs(angleDiff(pa, y)) < 0.03 + 1.1 / Math.max(10, d)) {
        p.hurt(30 * this.dmgMult);
        break;
      }
    }
    // gouges ripping across the marble, nearest first
    for (const y of yaws) {
      for (let i = 0; i < 16; i++) {
        const r = 20 + i * 4.5;
        const x = this.pos.x + Math.sin(y) * r;
        const z = this.pos.z + Math.cos(y) * r;
        if (Math.hypot(x, z) > ARENA_R) continue;
        let tt = -i * 0.025;
        g.addTicker((dt) => {
          tt += dt;
          if (tt < 0) return true;
          g.fx.burst(new THREE.Vector3(x, 0.4, z), 8, '#ff3050', { speed: 7, g: 10, size: 0.35, life: 0.45 });
          g.fx.burst(new THREE.Vector3(x, 0.3, z), 4, '#1a1016', { matter: true, speed: 6, g: 16, size: 0.3, life: 0.7 });
          g.gore.splat(x, z, 1.1, '#3a0610');
          return false;
        });
      }
    }
    g.camShake(0.6);
    sfx('slash3');
  }

  // A talon tears down through a sigil, then sends out a shockwave.
  talon(x, z) {
    const g = this.game;
    const R = 5.5;
    const warnT = 1.25;
    g.fx.ring(x, z, { r0: R, r1: R, dur: warnT, color: '#ff2040', pulse: true, fill: true, opacity: 0.35 });
    const sigil = g.fx.ring(x, z, { y: 15, r0: 4, r1: 4, dur: warnT + 0.6, color: '#ff3060', pulse: true });
    void sigil;
    const claw = this.claw.clone();
    claw.visible = true;
    claw.position.set(x, 30, z);
    claw.rotation.y = rand() * TAU;
    g.scene.add(claw);
    let t = 0;
    let hit = false;
    let waveHit = false;
    g.addTicker((dt) => {
      t += dt;
      const p = g.player;
      if (t < warnT) claw.position.y = lerp(30, 16, t / warnT);
      else if (t < warnT + 0.18) claw.position.y = lerp(16, 3.4, (t - warnT) / 0.18);
      else {
        if (!hit) {
          hit = true;
          const c = new THREE.Vector3(x, 0.4, z);
          g.fx.burst(c, 50, '#ff3050', { speed: 14, size: 0.45, life: 0.6 });
          g.fx.burst(c, 20, '#1a1016', { matter: true, speed: 10, g: 18, size: 0.5, life: 0.9 });
          g.fx.flash(c, '#ff2040', 14, 0.3);
          g.gore.splat(x, z, 3, '#300410');
          g.camShake(0.7);
          sfx('slam');
          if (p.alive && Math.hypot(p.pos.x - x, p.pos.z - z) < R + 0.4) p.hurt(34 * this.dmgMult);
          g.fx.ring(x, z, { r0: R, r1: 19, dur: 0.8, color: '#ff5070' });
        }
        // the shockwave: jump it
        const k = (t - warnT - 0.18) / 0.8;
        if (k < 1 && !waveHit && p.alive) {
          const rr = R + (19 - R) * k;
          const dd = Math.hypot(p.pos.x - x, p.pos.z - z);
          if (Math.abs(dd - rr) < 1.1 && p.pos.y - g.world.height(p.pos.x, p.pos.z) < 0.8) {
            waveHit = true;
            p.hurt(18 * this.dmgMult);
          }
        }
        claw.position.y = 3.4 + Math.max(0, t - warnT - 0.8) * 30;
        if (t > warnT + 1.6) {
          g.scene.remove(claw);
          return false;
        }
      }
      return true;
    });
  }

  cardDrop(x, z, fall) {
    const g = this.game;
    const R = 2.6;
    const ring = g.fx.ring(x, z, { r0: R, r1: R, dur: fall, color: '#ff2a50', pulse: true, fill: true, opacity: 0.25 });
    const card = new THREE.Mesh(this.cardGeo, this.cardMat);
    const spin = (rand() - 0.5) * 8;
    g.scene.add(card);
    let t = 0;
    let landed = false;
    g.addTicker((dt) => {
      t += dt;
      const k = Math.min(1, t / fall);
      card.position.set(x, 1.7 + 34 * (1 - k * k), z);
      if (!landed) card.rotation.set(0, spin * t, 0);
      if (k >= 1 && !landed) {
        landed = true;
        ring.dead = true;
        g.fx.burst(new THREE.Vector3(x, 0.5, z), 22, '#ff3050', { speed: 9, size: 0.35, life: 0.45 });
        g.fx.ring(x, z, { r0: 0.4, r1: R + 0.6, dur: 0.3, color: '#ffd070' });
        const p = g.player;
        if (p.alive && Math.hypot(p.pos.x - x, p.pos.z - z) < R + 0.3) p.hurt(20 * this.dmgMult);
        sfx('cards');
      }
      // the card stands embedded in the floor for a moment, then fades away
      if (k >= 1 && t > fall + 1.2) {
        g.scene.remove(card);
        return false;
      }
      return true;
    });
  }

  fireLance(yaw) {
    const g = this.game;
    const p = g.player;
    const from = this.hitCenter(new THREE.Vector3());
    const far = new THREE.Vector3(this.pos.x + Math.sin(yaw) * 130, 0, this.pos.z + Math.cos(yaw) * 130);
    g.fx.beam(from, far, { color: '#ff2040', width: 2.6, dur: 0.45, opacity: 0.85 });
    g.fx.beam(from, far, { color: '#ffd0e0', width: 0.8, dur: 0.35, opacity: 0.9 });
    g.fx.flash(from, '#ff2040', 20, 0.3);
    g.camShake(0.5);
    sfx('slam');
    const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const pa = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    if (p.alive && Math.abs(angleDiff(pa, yaw)) * d < 2.0) p.hurt(32 * this.dmgMult);
    for (let i = 0; i < 18; i++) {
      const r = 22 + i * 4;
      const x = this.pos.x + Math.sin(yaw) * r;
      const z = this.pos.z + Math.cos(yaw) * r;
      if (Math.hypot(x, z) > ARENA_R) continue;
      g.fx.burst(new THREE.Vector3(x, 0.3, z), 5, '#ff4060', { speed: 5, g: 6, size: 0.35, life: 0.5 });
    }
  }

  // A wall of thorns sweeping outward from the medallion (or inward from the rim).
  roseRing(inward) {
    const g = this.game;
    const r0 = inward ? ARENA_R : 3;
    const r1 = inward ? 3 : ARENA_R;
    const dur = 3.0;
    g.fx.ring(0, 0, { y: 0, r0, r1, dur, color: '#ff1a3a', fade: false });
    g.fx.ring(0, 0, { y: 0.4, r0, r1, dur, color: '#ff7090', fade: false });
    let t = 0;
    let hitDone = false;
    g.addTicker((dt) => {
      t += dt;
      const rr = r0 + (r1 - r0) * Math.min(1, t / dur);
      // thorns erupt along the front
      for (let i = 0; i < 6; i++) {
        const a = rand() * TAU;
        g.fx.spark(Math.cos(a) * rr, 0.3, Math.sin(a) * rr, i % 2 ? '#ff2040' : '#2a4a2a', { speed: 4, g: 8, size: 0.45, life: 0.5 });
      }
      const p = g.player;
      if (!hitDone && p.alive) {
        const d = Math.hypot(p.pos.x, p.pos.z);
        if (Math.abs(d - rr) < 1.0 && p.pos.y - g.world.height(p.pos.x, p.pos.z) < 0.9) {
          hitDone = true;
          p.hurt(22 * this.dmgMult);
        }
      }
      return t < dur;
    });
  }

  pose(dt, s) {
    const A = this.parts.arms;
    const t = this.game.time;
    const k = 1 - Math.exp(-4 * dt);
    // [shoulder pitch (−: forward), shoulder roll (left arm −: outward), elbow bend]
    let l = [-0.75, -0.45, 0.8];
    let r = [-0.75, 0.45, 0.8];
    if (s === 'rake') {
      const up = this.t < 1.1;
      r = up ? [-2.5, 0.5, 0.4] : [-0.2, -0.4, 0.2];
      if (this.fired > 0 && this.enraged) l = this.t < 1.9 ? [-2.5, -0.5, 0.4] : [-0.2, 0.4, 0.2];
    } else if (s === 'slam') {
      l = [-1.5, -0.8, 1.2];
      r = [-1.5, 0.8, 1.2];
    } else if (s === 'decree' || s === 'summon') {
      l = [-2.7, -0.5, 0.2];
      r = [-2.7, 0.5, 0.2];
    } else if (s === 'lance') {
      l = [-1.0, 0.9, 1.6];
      r = [-1.0, -0.9, 1.6];
    } else if (s === 'thorns') {
      l = [-0.3, -1.3, 0.2];
      r = [-0.3, 1.3, 0.2];
    }
    const sway = Math.sin(t * 0.9) * 0.06;
    A[0].sh.rotation.x = lerp(A[0].sh.rotation.x, l[0] + sway, k);
    A[0].sh.rotation.z = lerp(A[0].sh.rotation.z, l[1], k);
    A[0].el.rotation.x = lerp(A[0].el.rotation.x, -l[2], k);
    A[1].sh.rotation.x = lerp(A[1].sh.rotation.x, r[0] - sway, k);
    A[1].sh.rotation.z = lerp(A[1].sh.rotation.z, r[1], k);
    A[1].el.rotation.x = lerp(A[1].el.rotation.x, -r[2], k);
    const glow = s === 'slam' || s === 'summon' ? 0.8 : 0;
    for (const a of A) {
      a.sig.material.opacity = lerp(a.sig.material.opacity, glow, k);
      a.sig.rotation.z += dt * 2;
      for (const c of a.claws) c.rotation.x = 0.5 + Math.sin(t * 2 + c.id) * 0.1 + (s === 'rake' ? -0.3 : 0);
    }
    this.parts.head.rotation.x = Math.sin(t * 0.5) * 0.05 + 0.15;
    this.parts.head.rotation.z = Math.sin(t * 0.37) * 0.05;
    this.parts.mouth.scale.y = 0.5 + (s && s !== 'idle' ? 0.35 : 0) + Math.max(0, Math.sin(t * 5)) * 0.05;
  }

  onDeath() {
    const g = this.game;
    const c = this.hitCenter(new THREE.Vector3());
    g.fx.flash(c, '#ffffff', 60, 0.8);
    g.fx.burst(c, 150, '#ff2040', { speed: 30, size: 0.8, life: 1.8 });
    g.camShake(1.5);
    sfx('boss');
    sfx('bell');
    g.hud.banner('The Crimson Queen Is Shattered', '“…Off with… my… head.”', '#ffd070', '💔');
    // the spoils land in the hall, not in the abyss
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      g.spawnPickup(rollItem(rand, { legendary: 0.3, uncommon: 0.7 }), new THREE.Vector3(0, 3, -6), new THREE.Vector3(Math.cos(a) * 4, 10, Math.sin(a) * 4));
    }
  }

  deathAnim(dt) {
    const g = this.game;
    // she comes apart into a storm of cards and sinks into the dark
    this.pos.y -= dt * (2 + this.deadT * 4);
    this.model.position.copy(this.pos);
    this.model.rotation.z = Math.sin(this.deadT * 7) * 0.03 * (6 - this.deadT);
    if (Math.random() < 0.7) {
      const c = this.hitCenter(tmp);
      c.x += (rand() - 0.5) * 16;
      c.y += (rand() - 0.5) * 16;
      g.fx.burst(c, 10, rand() < 0.5 ? '#ff2040' : '#ffd070', { speed: 12, size: 0.6, life: 1 });
      if (Math.random() < 0.2) g.camShake(0.2);
    }
  }

  remove() {
    super.remove();
    this.game.scene.remove(this.claw);
  }
}

Object.assign(REGISTRY, { knight: HeartKnight, crimson: CrimsonQueen });
