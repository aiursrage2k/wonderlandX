// Alice: third-person controller, camera, skills, and procedural animation.

import * as THREE from 'three';
import { buildAlice } from '../gfx/alice.js';
import { rimModel } from '../gfx/rim.js';
import { Inventory, PERKS, xpToNext } from './items.js';
import { clamp, lerp, angleDiff, rand } from '../engine/util.js';
import { sfx } from '../engine/audio.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export const SKILLS = [
  { key: 'LMB', name: 'Razor Deck', desc: 'Fling razor-edged playing cards. 100% damage.' },
  { key: 'RMB', name: 'Teapot Grenade', desc: 'Lob a boiling teapot that bursts for 600% damage and scalds the ground.' },
  { key: 'SHIFT', name: 'Rabbit Hop', desc: 'Dash a short distance. You cannot be hit while dashing.' },
  { key: 'Q', name: 'Down the Rabbit Hole', desc: 'Spend Corruption (50+) to erupt for 500% and enter Madness: faster, homing, violet cards.' },
  { key: 'C', name: 'Tumble', desc: 'Roll forward. Untouchable for the whole roll.' },
];

export class Player {
  constructor(game) {
    this.game = game;
    const { root, parts } = buildAlice();
    this.model = root;
    this.parts = parts;
    rimModel(root);
    game.scene.add(root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; // body facing
    this.camYaw = Math.PI;
    this.camPitch = -0.12;
    this.inv = new Inventory();
    this.level = 1;
    this.xp = 0;
    this.perks = {};
    this.recompute();
    this.hp = this.stats.maxHp;
    this.corruption = 0;
    this.gold = 0;
    this.alive = true;
    this.onGround = false;
    this.jumpsUsed = 0;
    this.primaryT = 0;
    this.teapotCharges = this.stats.teapotCharges;
    this.teapotT = 0;
    this.dashCd = 0;
    this.dashT = 0;
    this.rollT = 0;
    this.rollMax = 0.42;
    this.rollCd = 0;
    this.dashDir = new THREE.Vector3();
    this.madness = 0;
    this.madnessMax = 1;
    this.invuln = 0;
    this.shots = 0;
    this.lastShot = 10;
    this.runPhase = 0;
    this.hurtFlash = 0;
    this.kills = 0;
    this.damageDealt = 0;
    this.cam = new THREE.Vector3();
    this.lookDir = new THREE.Vector3(0, 0, 1);
    this.aimPoint = new THREE.Vector3();
    this.hairVel = 0;
    this.throwKick = 0;
    this.sprinting = false;
  }

  recompute() {
    const old = this.stats;
    const s = this.inv.stats();
    // level bonuses, RoR2-style: every level adds health, damage and regen
    const L = (this.level || 1) - 1;
    s.maxHp += 24 * L;
    s.damage *= 1 + 0.12 * L;
    s.regen += 0.25 * L;
    for (const perk of PERKS) {
      const r = this.perks?.[perk.id] || 0;
      if (r) perk.apply(s, r);
    }
    this.stats = s;
    if (old && this.stats.maxHp > old.maxHp) this.hp += this.stats.maxHp - old.maxHp;
    if (this.hp > this.stats.maxHp) this.hp = this.stats.maxHp;
    if (old && this.stats.teapotCharges > old.teapotCharges) this.teapotCharges++;
  }

  placeAt(x, z) {
    const w = this.game.world;
    this.pos.set(x, w.height(x, z) + 0.1, z);
    this.vel.set(0, 0, 0);
  }

  get center() {
    return tmp2.set(this.pos.x, this.pos.y + 0.95, this.pos.z);
  }

  handPos(out) {
    this.parts.arms[1].hand.getWorldPosition(out);
    return out;
  }

  look(dx, dy) {
    this.camYaw -= dx * 0.0024;
    this.camPitch = clamp(this.camPitch - dy * 0.0022, -1.25, 1.0);
  }

  hurt(dmg, from) {
    if (!this.alive || this.invuln > 0 || this.dashT > 0 || this.rollT > 0) return false;
    const red = 100 / (100 + this.stats.armor);
    const d = dmg * red;
    this.hp -= d;
    this.hurtFlash = 1;
    this.game.hud.damageFlash(Math.min(1, d / 25));
    this.game.camShake(Math.min(0.5, d / 40));
    this.corruption = Math.min(100, this.corruption + 1.5);
    sfx('hurt');
    if (this.hp <= 0) {
      if (this.inv.count('unbirthday') > 0) {
        this.inv.remove('unbirthday');
        this.recompute();
        this.hp = this.stats.maxHp * 0.6;
        this.invuln = 3;
        this.game.hud.banner('Unbirthday Present', 'A very merry unbirthday — you wake up and carry on.', '#ff5a5a', '🎁');
        this.game.fx.burst(this.center, 80, '#ff9ad0', { speed: 14, size: 0.5, life: 1.2 });
        sfx('chest');
        this.game.hud.updateItems(this.inv);
      } else {
        this.hp = 0;
        this.alive = false;
        this.killer = from && from.name ? from : this.game.guessAttacker();
        this.game.onPlayerDeath();
      }
    }
    return true;
  }

  gainXp(n) {
    if (!this.alive) return;
    this.xp += n;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.levelUp();
    }
  }

  levelUp() {
    const g = this.game;
    const before = this.stats.maxHp;
    this.level++;
    this.recompute();
    this.hp = Math.min(this.stats.maxHp, this.hp + (this.stats.maxHp - before) + this.stats.maxHp * 0.15);
    g.hud.banner(`Level ${this.level}`, '+24 max health · +12% damage · +0.25 regen', '#ffd24a', '⬆️');
    g.hud.levelFlash();
    sfx('chest');
    // a golden pillar and a burst of motes
    const base = this.pos.clone();
    g.fx.ring(base.x, base.z, { y: base.y, r0: 0.3, r1: 4, dur: 0.6, color: '#ffd24a' });
    g.fx.beam(base.clone().setY(base.y - 0.2), base.clone().setY(base.y + 14), { color: '#ffd870', width: 0.9, dur: 0.8, opacity: 0.6 });
    for (let i = 0; i < 60; i++) g.fx.spark(base.x, base.y + Math.random() * 2, base.z, i % 2 ? '#ffd24a' : '#fff0b0', { speed: 5, g: -6, size: 0.3, life: 1.2 });
  }

  heal(n) {
    if (!this.alive) return;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
    if (this.hp - before > 3) this.game.hud.number(this.center.clone().add(new THREE.Vector3(0, 1, 0)), Math.round(this.hp - before), 'heal');
  }

  update(dt, input) {
    const g = this.game;
    const w = g.world;
    const st = this.stats;
    if (!this.alive) {
      this.animateDeath(dt);
      return;
    }
    this.lastShot += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.hp = Math.min(st.maxHp, this.hp + st.regen * dt);

    // ── movement ──
    const mv = input.moveVector();
    const fwd = tmp.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3().addScaledVector(fwd, mv.y).addScaledVector(right, mv.x);
    const moving = wish.lengthSq() > 0.01;
    this.sprinting = moving && mv.y > 0.5 && this.lastShot > 0.6 && input.sprintHeld !== false;
    const speed = st.speed * (this.sprinting ? 1.45 : 1) * (this.madness > 0 ? 1.15 : 1) * (this.envSlow || 1);
    this.envSlow = 1;

    if (this.rollT > 0) {
      this.rollT -= dt;
      this.vel.x = this.rollDir.x * 15;
      this.vel.z = this.rollDir.z * 15;
      if (Math.random() < 0.5) g.fx.spark(this.pos.x, this.pos.y + 0.4, this.pos.z, '#d8c8ff', { speed: 1, g: 0, size: 0.5, life: 0.3, a: 0.5 });
    } else if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.x = this.dashDir.x * 36;
      this.vel.z = this.dashDir.z * 36;
      if (Math.random() < 0.9) {
        g.fx.spark(this.pos.x, this.pos.y + 0.9, this.pos.z, '#e8dcff', { speed: 1, g: 0, size: 0.9, life: 0.35, a: 0.5 });
        g.fx.spark(this.pos.x, this.pos.y + 0.5, this.pos.z, '#8a5aff', { speed: 2, g: 0, size: 0.5, life: 0.4, a: 0.6 });
      }
    } else {
      const accel = this.onGround ? 14 : 5;
      const k = 1 - Math.exp(-accel * dt);
      this.vel.x = lerp(this.vel.x, wish.x * speed, k);
      this.vel.z = lerp(this.vel.z, wish.z * speed, k);
    }

    if (input.hit(' ')) {
      if (this.onGround || this.jumpsUsed < st.jumps) {
        if (!this.onGround) {
          this.jumpsUsed++;
          g.fx.ring(this.pos.x, this.pos.z, { y: this.pos.y - 0.1, r0: 0.3, r1: 1.6, dur: 0.3, color: '#c8b0ff' });
          g.fx.burst(this.pos, 10, '#d8c8ff', { speed: 4, size: 0.25, life: 0.4 });
          // a front flip on every air jump
          this.flipT = this.flipMax = 0.5;
        }
        this.vel.y = 10.5;
        this.onGround = false;
      }
    }

    this.vel.y -= 28 * dt;
    this.pos.addScaledVector(this.vel, dt);
    w.collide(this.pos, 0.4, this.pos.y);
    const gy = w.height(this.pos.x, this.pos.z);
    if (this.pos.y <= gy) {
      if (!this.onGround && this.vel.y < -14) {
        g.fx.burst(new THREE.Vector3(this.pos.x, gy + 0.1, this.pos.z), 8, '#6a5a70', { matter: true, speed: 3, size: 0.4, life: 0.5 });
      }
      this.pos.y = gy;
      this.vel.y = 0;
      this.onGround = true;
      this.jumpsUsed = 1;
    } else if (this.pos.y > gy + 0.25) {
      if (this.onGround) this.jumpsUsed = 1;
      this.onGround = false;
    } else if (this.vel.y <= 0) {
      this.pos.y = gy; // stick to slopes / steps
      this.vel.y = 0;
      this.onGround = true;
      this.jumpsUsed = 1;
    }

    // ── camera ──
    this.updateCamera(dt);

    // ── aim + skills ──
    g.computeAim(this.cam, this.lookDir, this.aimPoint);
    const cdm = st.cdMult;
    this.primaryT -= dt;
    const madMult = this.madness > 0 ? 1.6 : 1;
    if ((input.mouse.left || input.touchFire) && this.primaryT <= 0) {
      this.primaryT = 1 / (4.2 * st.attackSpeed * madMult);
      this.fireCard();
    }
    if (this.teapotCharges < st.teapotCharges) {
      this.teapotT += dt;
      if (this.teapotT >= 5 * cdm) {
        this.teapotT = 0;
        this.teapotCharges++;
      }
    }
    if ((input.hit('rmb') || input.hit('touch2')) && this.teapotCharges > 0) {
      this.teapotCharges--;
      this.throwTeapot();
    }
    this.dashCd = Math.max(0, this.dashCd - dt);
    if ((input.hit('shift') || input.hit('touch3')) && this.dashCd <= 0) {
      this.dashCd = 4.5 * cdm;
      this.dashT = 0.2;
      this.dashDir.copy(moving ? wish.normalize() : fwd).setY(0).normalize();
      this.vel.y = Math.max(this.vel.y, 3);
      this.jumpsUsed = Math.min(this.jumpsUsed, 1);
      g.fx.ring(this.pos.x, this.pos.z, { y: this.pos.y, r0: 0.4, r1: 2.5, dur: 0.35, color: '#b090ff' });
      sfx('dash');
      this.onDodge();
    }
    this.rollCd = Math.max(0, (this.rollCd || 0) - dt);
    if ((input.hit('r') || input.hit('touch5')) && this.rollCd <= 0 && this.rollT <= 0 && this.dashT <= 0) {
      this.rollCd = 1.2 * cdm;
      this.rollT = 0.42;
      this.rollMax = 0.42;
      this.rollDir = (moving ? wish.clone().normalize() : fwd.clone()).setY(0).normalize();
      this.yaw = Math.atan2(this.rollDir.x, this.rollDir.z);
      sfx('dash');
      this.onDodge();
    }
    if ((input.hit('q') || input.hit('touch4')) && this.corruption >= 50 && this.madness <= 0) {
      this.goMad();
    }
    if (this.madness > 0) {
      this.madness -= dt;
      if (Math.random() < 0.6) {
        g.fx.spark(this.pos.x + (rand() - 0.5) * 0.8, this.pos.y + rand() * 1.8, this.pos.z + (rand() - 0.5) * 0.8, '#a050ff', { speed: 1.5, g: -2, size: 0.35, life: 0.7 });
      }
    }

    // ── facing ──
    const wantYaw = this.lastShot < 1.0 || !moving ? this.camYaw : Math.atan2(this.vel.x, this.vel.z);
    if ((moving || this.lastShot < 1.0) && this.rollT <= 0) this.yaw += angleDiff(this.yaw, wantYaw) * (1 - Math.exp(-14 * dt));

    this.animate(dt, moving, speed);
  }

  updateCamera(dt) {
    const cy = Math.cos(this.camPitch);
    this.lookDir.set(Math.sin(this.camYaw) * cy, Math.sin(this.camPitch), Math.cos(this.camYaw) * cy);
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const pivot = new THREE.Vector3(this.pos.x, this.pos.y + 1.65, this.pos.z);
    const desired = pivot.clone().addScaledVector(right, 0.8).addScaledVector(this.lookDir, -4.6);
    desired.y += 0.25;
    // walk the boom out from the pivot and stop short of anything solid
    const w = this.game.world;
    const p = new THREE.Vector3();
    const reach = (from, to) => {
      for (let i = 1; i <= 12; i++) {
        p.lerpVectors(from, to, i / 12);
        if (w.cameraBlocked(p.x, p.y, p.z)) return Math.max(0.15, (i - 1) / 12);
      }
      return 1;
    };
    let k = reach(pivot, desired);
    if (k < 0.6) {
      // boxed in (a pit, a wall of raised floor): try looking down from higher up
      const hiPivot = pivot.clone();
      hiPivot.y += 2.6;
      const hiDesired = desired.clone();
      hiDesired.y += 3.2;
      const k2 = reach(hiPivot, hiDesired);
      if (k2 > k + 0.2) {
        pivot.copy(hiPivot);
        desired.copy(hiDesired);
        k = k2;
      }
    }
    this.boom = this.boom === undefined ? k : k < this.boom ? k : lerp(this.boom, k, 1 - Math.exp(-4 * dt));
    this.cam.lerpVectors(pivot, desired, this.boom);
    const floor = w.height(this.cam.x, this.cam.z) + 0.3;
    if (this.cam.y < floor) this.cam.y = floor;
  }

  fireCard() {
    const g = this.game;
    this.shots++;
    this.lastShot = 0;
    this.throwKick = 1;
    const from = this.handPos(new THREE.Vector3());
    const dir = this.aimPoint.clone().sub(from).normalize();
    const vorpal = this.inv.count('vorpal') > 0 && this.shots % 5 === 0;
    const mad = this.madness > 0;
    if (vorpal) {
      g.combat.spawnPlayerShot({ kind: 'vorpal', pos: from, dir, speed: 70, coef: 6 * this.inv.count('vorpal'), pierce: 99, size: 1 });
      sfx('slash3');
    } else {
      g.combat.spawnPlayerShot({ kind: mad ? 'madcard' : 'card', pos: from, dir, speed: 85, coef: mad ? 1.2 : 1, homing: mad });
      sfx('slash');
    }
    const mirror = this.inv.count('mirror');
    if (mirror && Math.random() < 0.15 * mirror) {
      const d2 = dir.clone().applyAxisAngle(UP, (Math.random() - 0.5) * 0.1);
      g.combat.spawnPlayerShot({ kind: 'mirror', pos: from, dir: d2, speed: 85, coef: 1, homing: true });
    }
    g.fx.flash(from, mad ? '#b060ff' : '#ffc070', 0.3, 0.06);
  }

  throwTeapot() {
    const g = this.game;
    this.lastShot = 0;
    this.throwKick = 1.4;
    const from = this.handPos(new THREE.Vector3());
    const to = this.aimPoint.clone();
    const flat = Math.hypot(to.x - from.x, to.z - from.z);
    const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
    // pick a flight time from distance, solve for launch velocity
    const T = clamp(flat / 30, 0.35, 1.2);
    const v = dir.multiplyScalar(flat / T);
    v.y = (to.y - from.y + 0.5 * 25 * T * T) / T;
    g.combat.spawnTeapot(from, v);
    sfx('dash');
  }

  // Dodges (dash or roll) trigger the cursed Broken Pocket Watch.
  onDodge() {
    const g = this.game;
    const watch = this.inv.count('broken_watch');
    if (!watch) return;
    for (const e of g.enemies) {
      if (e.alive && e.pos.distanceTo(this.pos) < 14) e.slowT = 1.5 + watch;
    }
    this.corruption = Math.min(100, this.corruption + 8);
    g.fx.ring(this.pos.x, this.pos.z, { y: this.pos.y, r0: 1, r1: 14, dur: 0.5, color: '#b060ff' });
    g.fx.ring(this.pos.x, this.pos.z, { y: this.pos.y, r0: 14, r1: 14, dur: 0.6, color: '#8040ff', fill: true, opacity: 0.18 });
    sfx('tick');
  }

  goMad() {
    const g = this.game;
    this.madnessMax = 3 + (this.corruption / 100) * 6;
    this.madness = this.madnessMax;
    this.corruption = 0;
    sfx('q');
    g.camShake(0.6);
    g.combat.explode(this.center.clone(), 9, 5, { color: '#9a40ff', owner: 'player', ring: '#c080ff' });
    for (let i = 0; i < 90; i++) {
      g.fx.spark(this.pos.x, this.pos.y + 1, this.pos.z, i % 2 ? '#b060ff' : '#ff60c0', { speed: 16, g: 2, size: 0.5, life: 1 });
    }
    g.hud.banner('MADNESS', 'We’re all mad here.', '#b060ff', '🐇');
  }

  animate(dt, moving, speed) {
    const p = this.parts;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const k = clamp(hs / 7, 0, 1.5);
    this.runPhase += dt * (4 + hs * 1.25);
    const s = Math.sin(this.runPhase);
    const c = Math.cos(this.runPhase);
    const air = !this.onGround;
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;

    // legs
    for (let i = 0; i < 2; i++) {
      const sgn = i ? 1 : -1;
      const target = air ? (i ? -0.9 : 0.3) : s * 0.9 * k * sgn;
      p.legs[i].rotation.x = lerp(p.legs[i].rotation.x, target, 1 - Math.exp(-20 * dt));
      // knee bends on the recovering leg, tucks in the air
      const phase = Math.sin(this.runPhase + (i ? Math.PI : 0) - 0.9);
      const kneeT = this.rollT > 0 || this.flipT > 0 ? 1.9 : air ? (i ? 1.3 : 0.5) : Math.max(0, phase) * 1.2 * k + 0.05;
      p.knees[i].rotation.x = lerp(p.knees[i].rotation.x, kneeT, 1 - Math.exp(-20 * dt));
    }
    if (this.flipT > 0) this.flipT -= dt;
    const flipping = this.flipT > 0 && this.rollT <= 0;
    if (this.rollT > 0 || flipping) {
      // somersault around the hips; the air flip eases out so she lands upright
      const u = flipping ? 1 - this.flipT / this.flipMax : 1 - this.rollT / this.rollMax;
      const a = (flipping ? 1 - (1 - u) ** 2 : u) * Math.PI * 2;
      const hc = 0.75;
      p.body.rotation.x = a;
      p.body.position.set(0, hc - hc * Math.cos(a), -hc * Math.sin(a));
      this.model.rotation.y = this.yaw;
    } else {
      p.body.position.set(0, air ? 0.05 : Math.abs(c) * 0.06 * k, 0);
      if (p.body.rotation.x > 1) p.body.rotation.x = 0;
      p.body.rotation.x = lerp(p.body.rotation.x, this.dashT > 0 ? 0.5 : k * 0.12, 1 - Math.exp(-10 * dt));
    }
    p.skirt.rotation.x = -k * 0.08 + Math.sin(this.runPhase * 2) * 0.03 * k;
    p.skirt.rotation.z = c * 0.04 * k;

    // left arm swings; right arm aims when throwing
    p.arms[0].sh.rotation.x = air ? -2.2 : -s * 0.7 * k;
    p.arms[0].sh.rotation.z = air ? 0.6 : 0.12;
    this.throwKick = Math.max(0, this.throwKick - dt * 6);
    const aiming = this.lastShot < 0.8;
    const aimPitch = this.camPitch;
    const rTarget = aiming ? -Math.PI / 2 - aimPitch * 0.9 + this.throwKick * 0.5 : s * 0.7 * k;
    p.arms[1].sh.rotation.x = lerp(p.arms[1].sh.rotation.x, rTarget, 1 - Math.exp(-25 * dt));
    p.arms[1].sh.rotation.z = aiming ? -0.15 - this.throwKick * 0.4 : -0.12;
    p.arms[1].elbow.rotation.x = aiming ? -0.2 - this.throwKick * 0.8 : -0.3;
    p.arms[0].elbow.rotation.x = -0.4;
    p.torso.rotation.y = aiming ? -0.25 : c * 0.1 * k;
    p.head.rotation.x = aiming ? -aimPitch * 0.4 : 0;

    // hair lags behind motion
    this.hairVel = lerp(this.hairVel, k + (air ? -this.vel.y * 0.05 : 0), 1 - Math.exp(-6 * dt));
    for (let i = 0; i < p.hairChain.length; i++) {
      p.hairChain[i].rotation.x = -this.hairVel * 0.18 * (i + 1) * 0.5 - 0.05 + Math.sin(this.runPhase * 2 - i) * 0.04 * k;
    }
    p.fanMat.emissiveIntensity = 0.4 + this.throwKick * 3 + (this.madness > 0 ? 2 : 0);
    p.fanMat.emissive.set(this.madness > 0 ? '#9a40ff' : '#ffb060');
    this.model.visible = !(this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0);
  }

  // Stagger, a burst of cards, a fall onto her back — then she comes apart
  // into petals and cards drifting upward (waking up, Wonderland-style).
  animateDeath(dt) {
    const g = this.game;
    const p = this.parts;
    if (this.deathT === undefined) {
      this.deathT = 0;
      const c = this.center.clone();
      g.fx.burst(c, 40, '#efe6d4', { matter: true, speed: 9, g: 10, size: 0.3, life: 1.6 });
      g.fx.burst(c, 30, '#c01030', { speed: 6, g: 4, size: 0.3, life: 1.2 });
      g.fx.flash(c, '#ffb0c0', 1.6, 0.2);
    }
    this.deathT += dt;
    const t = this.deathT;
    const k = 1 - Math.exp(-10 * dt);
    // 0–0.35 s: knees buckle and the arms fly up
    const buckle = t < 0.35;
    for (let i = 0; i < 2; i++) {
      p.knees[i].rotation.x = lerp(p.knees[i].rotation.x, buckle ? 1.3 : 0.35, k);
      p.legs[i].rotation.x = lerp(p.legs[i].rotation.x, buckle ? -0.4 : 0.15 * (i ? 1 : -1), k);
    }
    p.arms[0].sh.rotation.x = lerp(p.arms[0].sh.rotation.x, -2.7, k);
    p.arms[1].sh.rotation.x = lerp(p.arms[1].sh.rotation.x, -2.4, k);
    p.arms[0].sh.rotation.z = lerp(p.arms[0].sh.rotation.z, 0.9, k);
    p.arms[1].sh.rotation.z = lerp(p.arms[1].sh.rotation.z, -0.9, k);
    p.body.rotation.x = 0;
    p.body.position.set(0, buckle ? -0.25 * (t / 0.35) : 0, 0);
    p.head.rotation.x = lerp(p.head.rotation.x, -0.4, k);
    // 0.3–1.1 s: topple backwards, with a small bounce as she lands
    const f = Math.max(0, Math.min(1, (t - 0.3) / 0.8));
    const bounce = f < 1 ? f * f : 1;
    const land = t > 1.1 ? Math.sin(Math.min(1, (t - 1.1) / 0.25) * Math.PI) * 0.12 : 0;
    this.model.rotation.x = -Math.PI / 2 * bounce + land;
    this.model.position.set(this.pos.x, this.pos.y + 0.18 * bounce, this.pos.z);
    if (t > 1.1 && !this.landed) {
      this.landed = true;
      g.fx.burst(this.pos.clone().setY(this.pos.y + 0.2), 20, '#8a7a90', { matter: true, speed: 4, g: 12, size: 0.25, life: 0.8 });
      g.camShake(0.25);
    }
    // from 2.2 s: she dissolves into drifting petals and cards
    if (t > 2.2) {
      const d = Math.min(1, (t - 2.2) / 1.6);
      this.model.scale.setScalar(Math.max(0.001, 1 - d * d));
      if (Math.random() < 0.8) {
        const q = this.pos;
        g.fx.spark(q.x + (Math.random() - 0.5) * 1.4, q.y + 0.3, q.z + (Math.random() - 0.5) * 1.4, Math.random() < 0.5 ? '#ff5070' : '#f0e6d8', { speed: 1.2, g: -2.5, size: 0.28, life: 1.6, drag: 0.4 });
      }
    }
  }
}
