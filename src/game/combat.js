// Projectiles, explosions, ground hazards, damage application and item procs.

import * as THREE from 'three';
import { rand, TAU } from '../engine/util.js';
import { sfx } from '../engine/audio.js';

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();

// Closest-approach test of segment p0→p1 against a sphere.
function segHitsSphere(p0, p1, c, r) {
  const d = tmpA.subVectors(p1, p0);
  const m = tmpB.subVectors(c, p0);
  const len2 = d.lengthSq() || 1e-6;
  const t = Math.max(0, Math.min(1, m.dot(d) / len2));
  const px = p0.x + d.x * t - c.x;
  const py = p0.y + d.y * t - c.y;
  const pz = p0.z + d.z * t - c.z;
  return px * px + py * py + pz * pz < r * r;
}

const SHOT_STYLE = {
  card: { color: '#ffd89a', trail: '#ffb050', size: 1 },
  madcard: { color: '#d8a0ff', trail: '#9a40ff', size: 1.1 },
  mirror: { color: '#c8f0ff', trail: '#60c0ff', size: 0.9 },
  vorpal: { color: '#e8fcff', trail: '#60f0ff', size: 3.2 },
  feather: { color: '#ffe0f0', trail: '#ff70c0', size: 1.2 },
};

export class Combat {
  constructor(game) {
    this.game = game;
    this.shots = [];
    this.enemyShots = [];
    this.puddles = [];
    this.teapots = [];
    const cardGeo = new THREE.PlaneGeometry(0.2, 0.3);
    this.cardGeo = cardGeo;
    this.bladeGeo = new THREE.TorusGeometry(0.45, 0.06, 4, 16, Math.PI);
    this.mats = {};
    for (const [k, s] of Object.entries(SHOT_STYLE)) {
      this.mats[k] = new THREE.MeshBasicMaterial({ color: s.color, side: THREE.DoubleSide });
    }
    this.teapotGeo = (() => {
      const g = new THREE.SphereGeometry(0.28, 12, 10);
      g.scale(1, 0.8, 1);
      return g;
    })();
    this.teapotMat = new THREE.MeshStandardMaterial({ color: '#f0e8dc', roughness: 0.3, emissive: '#402010' });
    this.orbGeo = new THREE.SphereGeometry(0.22, 10, 8);
    this.enemyMats = {
      tea: new THREE.MeshBasicMaterial({ color: '#ff8a30' }),
      bolt: new THREE.MeshBasicMaterial({ color: '#c890ff' }),
      clock: new THREE.MeshBasicMaterial({ color: '#ffd060' }),
      heart: new THREE.MeshBasicMaterial({ color: '#ff3050' }),
    };
  }

  clear() {
    for (const s of [...this.shots, ...this.enemyShots, ...this.teapots]) this.game.scene.remove(s.mesh);
    for (const p of this.puddles) this.game.fx.scene.remove(p.ring?.mesh);
    this.shots = [];
    this.enemyShots = [];
    this.puddles = [];
    this.teapots = [];
  }

  // ─── player projectiles ───
  spawnPlayerShot(o) {
    const g = this.game;
    const mesh = new THREE.Mesh(o.kind === 'vorpal' ? this.bladeGeo : this.cardGeo, this.mats[o.kind]);
    const sz = SHOT_STYLE[o.kind].size;
    mesh.scale.setScalar(sz);
    mesh.position.copy(o.pos);
    g.scene.add(mesh);
    this.shots.push({
      ...o,
      mesh,
      vel: o.dir.clone().multiplyScalar(o.speed),
      life: 1.6,
      hit: new Set(),
      spin: rand() * TAU,
      prev: o.pos.clone(),
      style: SHOT_STYLE[o.kind],
    });
  }

  spawnTeapot(pos, vel) {
    const mesh = new THREE.Mesh(this.teapotGeo, this.teapotMat);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    // spout
    this.spoutGeo ||= new THREE.ConeGeometry(0.06, 0.3, 6);
    const spout = new THREE.Mesh(this.spoutGeo, this.teapotMat);
    spout.position.set(0.3, 0.05, 0);
    spout.rotation.z = -1.1;
    mesh.add(spout);
    this.game.scene.add(mesh);
    this.teapots.push({ mesh, pos: pos.clone(), vel: vel.clone(), life: 3 });
  }

  // ─── enemy projectiles ───
  spawnEnemyShot(kind, pos, vel, dmg, o = {}) {
    const mesh = new THREE.Mesh(this.orbGeo, this.enemyMats[kind]);
    mesh.position.copy(pos);
    mesh.scale.setScalar(o.size || 1);
    this.game.scene.add(mesh);
    this.enemyShots.push({ kind, mesh, pos: pos.clone(), vel: vel.clone(), dmg, life: o.life || 4, gravity: o.gravity || 0, splash: o.splash || 0, prev: pos.clone(), size: o.size || 1 });
  }

  // ─── damage ───
  damageEnemy(e, coef, o = {}) {
    const g = this.game;
    const p = g.player;
    if (!e.alive) return 0;
    let dmg = p.stats.damage * coef;
    let crit = false;
    if (o.canCrit !== false && rand() < p.stats.crit) {
      crit = true;
      dmg *= 2;
    }
    const dealt = e.hurt(dmg, crit, o.dir);
    p.damageDealt += dealt;
    g.hud.number(tmpC.copy(e.pos).setY(e.pos.y + e.height + 0.2), Math.round(dmg), crit ? 'crit' : o.kind || 'normal');
    g.hud.hitMarker(crit);
    p.corruption = Math.min(100, p.corruption + 0.2 * (o.proc ?? 1));
    if (crit) sfx('crit');
    else sfx('hit');

    const proc = o.proc ?? 1;
    const inv = p.inv;
    if (proc > 0 && e.alive) {
      const thorn = inv.count('rose_thorn');
      if (thorn && rand() < 0.1 * thorn * proc) e.addBleed(p.stats.damage * 2.4);
      const jub = inv.count('jubjub');
      if (jub && rand() < 0.1 * jub * proc) {
        this.spawnPlayerShot({ kind: 'feather', pos: p.handPos(new THREE.Vector3()), dir: new THREE.Vector3(rand() - 0.5, 1, rand() - 0.5).normalize(), speed: 22, coef: 3, homing: true, target: e, proc: 0.3 });
      }
      const tooth = inv.count('cheshire');
      if (tooth && rand() < 0.2 * proc) this.chain(e, 3 + (tooth - 1) * 2, 0.8, proc * 0.2);
    }
    if (!e.alive) this.onKill(e);
    return dmg;
  }

  chain(from, n, coef, proc) {
    const g = this.game;
    let cur = from;
    const done = new Set([from]);
    for (let i = 0; i < n; i++) {
      let best = null;
      let bd = 15 * 15;
      for (const e of g.enemies) {
        if (!e.alive || done.has(e)) continue;
        const d = e.pos.distanceToSquared(cur.pos);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (!best) break;
      done.add(best);
      const a = cur.pos.clone().setY(cur.pos.y + cur.height * 0.6);
      const b = best.pos.clone().setY(best.pos.y + best.height * 0.6);
      g.fx.beam(a, b, { color: '#b070ff', width: 0.07, dur: 0.25 });
      g.fx.flash(b, '#c080ff', 1.5, 0.2);
      this.damageEnemy(best, coef, { proc, kind: 'proc' });
      cur = best;
    }
  }

  onKill(e) {
    const g = this.game;
    const p = g.player;
    p.kills++;
    p.corruption = Math.min(100, p.corruption + (e.elite ? 10 : e.boss ? 40 : 4));
    const gold = Math.round(e.goldValue);
    p.gold += gold;
    g.hud.goldPop(gold);
    const tart = p.inv.count('tart');
    if (tart) p.heal(8 + 6 * (tart - 1));
    const kettle = p.inv.count('kettle');
    if (kettle) {
      this.explode(e.pos.clone().setY(e.pos.y + 0.5), 4 + 2 * (kettle - 1), 1.5, { owner: 'player', color: '#ff8a30', ring: '#ffa050', proc: 0 });
    }
    // gold motes stream to the player
    for (let i = 0; i < Math.min(12, 3 + gold / 5); i++) {
      g.fx.spark(e.pos.x, e.pos.y + 1, e.pos.z, '#ffd24a', { speed: 5, g: 6, size: 0.2, life: 0.7 });
    }
  }

  explode(center, radius, coef, o = {}) {
    const g = this.game;
    g.fx.ring(center.x, center.z, { r0: 0.3, r1: radius, dur: 0.35, color: o.ring || o.color || '#ffa040' });
    g.fx.flash(center, o.color || '#ffa040', radius * 1.6, 0.25);
    g.fx.burst(center, 40, o.color || '#ffa040', { speed: radius * 3, size: 0.4, life: 0.6 });
    g.fx.smoke(center, '#1a0f14', 5, radius * 0.5);
    g.camShake(Math.min(0.4, radius * 0.05));
    if (o.owner === 'player') {
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const c = e.hitCenter(tmpC);
        if (c.distanceTo(center) < radius + e.hitR) this.damageEnemy(e, coef, { proc: o.proc ?? 1, kind: 'aoe' });
      }
    } else if (g.player.alive) {
      if (g.player.center.distanceTo(center) < radius + 0.4) g.player.hurt(o.dmg || 10);
    }
  }

  puddle(x, z, r, dur, o) {
    const g = this.game;
    const ring = g.fx.ring(x, z, { r0: r, r1: r, dur, color: o.color, pulse: true, fill: true, opacity: 0.35 });
    this.puddles.push({ x, z, r, t: dur, tick: 0, ring, ...o });
  }

  // ─── update ───
  update(dt) {
    const g = this.game;
    const w = g.world;

    // player shots
    for (const s of this.shots) {
      s.life -= dt;
      if (s.homing) {
        let tgt = s.target && s.target.alive ? s.target : null;
        if (!tgt) {
          let bd = 22 * 22;
          for (const e of g.enemies) {
            if (!e.alive) continue;
            const d = e.pos.distanceToSquared(s.mesh.position);
            if (d < bd) {
              const to = tmpA.subVectors(e.pos, s.mesh.position).normalize();
              if (to.dot(tmpB.copy(s.vel).normalize()) > 0.2 || s.kind === 'feather') {
                bd = d;
                tgt = e;
              }
            }
          }
          s.target = tgt;
        }
        if (tgt) {
          const want = tgt.hitCenter(tmpC).sub(s.mesh.position).normalize().multiplyScalar(s.speed);
          const k = 1 - Math.exp(-(s.kind === 'feather' ? 6 : 4) * dt);
          s.vel.lerp(want, k);
          s.vel.setLength(s.speed);
        }
      }
      s.prev.copy(s.mesh.position);
      s.mesh.position.addScaledVector(s.vel, dt);
      s.spin += dt * 30;
      if (s.kind === 'vorpal') {
        s.mesh.lookAt(tmpA.copy(s.mesh.position).add(s.vel));
        s.mesh.rotateZ(Math.PI / 2);
      } else {
        s.mesh.lookAt(tmpA.copy(s.mesh.position).add(s.vel));
        s.mesh.rotateX(Math.PI / 2);
        s.mesh.rotateY(s.spin);
      }
      g.fx.trail(s.mesh.position, s.style.trail, 0.28 * s.style.size, 0.18, 0.7);
      // hits
      for (const e of g.enemies) {
        if (!e.alive || s.hit.has(e)) continue;
        if (segHitsSphere(s.prev, s.mesh.position, e.hitCenter(tmpC), e.hitR + (s.kind === 'vorpal' ? 0.5 : 0.1))) {
          s.hit.add(e);
          this.damageEnemy(e, s.coef, { proc: s.proc ?? 1, dir: s.vel });
          g.fx.burst(s.mesh.position, 6, s.style.trail, { speed: 6, size: 0.18, life: 0.25 });
          g.fx.flash(s.mesh.position, s.style.trail, 1, 0.08);
          if (!s.pierce || s.hit.size > s.pierce) {
            s.life = 0;
            break;
          }
        }
      }
      const p = s.mesh.position;
      if (s.life > 0 && (p.y < w.height(p.x, p.z) || w.solidAt(p.x, p.y, p.z))) {
        s.life = 0;
        g.fx.burst(p, 4, '#ffe0b0', { speed: 4, size: 0.12, life: 0.2 });
      }
    }
    this.shots = this.shots.filter((s) => {
      if (s.life <= 0) g.scene.remove(s.mesh);
      return s.life > 0;
    });

    // teapots
    for (const t of this.teapots) {
      t.life -= dt;
      t.vel.y -= 25 * dt;
      t.pos.addScaledVector(t.vel, dt);
      t.mesh.position.copy(t.pos);
      t.mesh.rotation.x += dt * 8;
      t.mesh.rotation.z += dt * 5;
      g.fx.trail(t.pos, '#ff9040', 0.3, 0.3, 0.5);
      if (Math.random() < 0.5) g.fx.smoke(t.pos, '#d0c8d8', 1, 0.3);
      let boom = t.pos.y < w.height(t.pos.x, t.pos.z) + 0.1 || w.solidAt(t.pos.x, t.pos.y, t.pos.z) || t.life <= 0;
      if (!boom) {
        for (const e of g.enemies) {
          if (e.alive && e.hitCenter(tmpC).distanceTo(t.pos) < e.hitR + 0.3) {
            boom = true;
            break;
          }
        }
      }
      if (boom) {
        t.life = -1;
        const c = t.pos.clone();
        c.y = Math.max(c.y, w.height(c.x, c.z) + 0.3);
        this.explode(c, 5, 6, { owner: 'player', color: '#ff9a40', ring: '#ffcf70' });
        g.fx.burst(c, 30, '#f0ece4', { matter: true, speed: 10, size: 0.18, life: 1.2, g: 20 });
        this.puddle(c.x, c.z, 3.5, 3.5, { owner: 'player', coef: 0.6, color: '#ff7020' });
        sfx('shatter');
      }
    }
    this.teapots = this.teapots.filter((t) => {
      if (t.life < 0) g.scene.remove(t.mesh);
      return t.life >= 0;
    });

    // enemy shots
    const pl = g.player;
    for (const s of this.enemyShots) {
      s.life -= dt;
      s.vel.y -= s.gravity * dt;
      s.prev.copy(s.pos);
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos);
      const col = s.kind === 'tea' ? '#ff7a20' : s.kind === 'clock' ? '#ffc040' : s.kind === 'heart' ? '#ff3050' : '#a060ff';
      g.fx.trail(s.pos, col, 0.6 * s.size, 0.25, 0.8);
      if (pl.alive && segHitsSphere(s.prev, s.pos, pl.center, 0.55 + s.size * 0.15)) {
        if (s.splash) this.explode(s.pos.clone(), s.splash, 0, { dmg: s.dmg, color: col });
        else if (pl.hurt(s.dmg)) g.fx.burst(s.pos, 10, col, { speed: 6, size: 0.25, life: 0.3 });
        s.life = 0;
        continue;
      }
      const gh = w.height(s.pos.x, s.pos.z);
      if (s.pos.y < gh || w.solidAt(s.pos.x, s.pos.y, s.pos.z)) {
        if (s.splash) {
          this.explode(new THREE.Vector3(s.pos.x, gh + 0.3, s.pos.z), s.splash, 0, { dmg: s.dmg, color: col });
          if (s.kind === 'tea') this.puddle(s.pos.x, s.pos.z, 2.2, 3, { owner: 'enemy', dmg: s.dmg * 0.3, color: '#ff5010' });
          sfx('boil');
        } else g.fx.burst(s.pos, 6, col, { speed: 4, size: 0.2, life: 0.3 });
        s.life = 0;
      }
    }
    this.enemyShots = this.enemyShots.filter((s) => {
      if (s.life <= 0) g.scene.remove(s.mesh);
      return s.life > 0;
    });

    // puddles
    for (const p of this.puddles) {
      p.t -= dt;
      p.tick -= dt;
      if (Math.random() < 0.4) {
        const a = rand() * TAU;
        const r = rand() * p.r;
        const y = w.height(p.x, p.z);
        g.fx.spark(p.x + Math.cos(a) * r, y + 0.1, p.z + Math.sin(a) * r, p.color, { speed: 1, g: -3, size: 0.25, life: 0.6 });
      }
      if (p.tick <= 0) {
        p.tick = 0.5;
        if (p.owner === 'player') {
          for (const e of g.enemies) {
            if (e.alive && !e.flying && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < p.r + e.radius) this.damageEnemy(e, p.coef, { proc: 0.2, canCrit: false, kind: 'dot' });
          }
        } else if (pl.alive && pl.onGround && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < p.r) {
          pl.hurt(p.dmg);
        }
      }
    }
    this.puddles = this.puddles.filter((p) => p.t > 0);
  }
}
