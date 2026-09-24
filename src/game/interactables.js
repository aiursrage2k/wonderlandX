// Tea chests, biscuit tins, dropped items, and the Looking Glass (teleporter).

import * as THREE from 'three';
import { buildChest, buildLookingGlass, buildTeaTable, mat } from '../gfx/models.js';
import { rollItem, RARITY } from './items.js';
import { rand, TAU } from '../engine/util.js';
import { sfx } from '../engine/audio.js';

export class Chest {
  constructor(game, x, z, big) {
    this.game = game;
    this.kind = 'chest';
    this.big = big;
    const b = buildChest(big);
    this.model = b.root;
    this.parts = b.parts;
    const y = game.world.height(x, z);
    this.pos = new THREE.Vector3(x, y, z);
    this.model.position.copy(this.pos);
    this.model.rotation.y = rand() * TAU;
    game.scene.add(this.model);
    this.baseCost = big ? 50 : 25;
    this.used = false;
    this.openT = 0;
    this.name = big ? 'Royal Tea Chest' : 'Tea Chest';
  }

  get cost() {
    return Math.round(this.baseCost * this.game.difficulty() ** 1.25);
  }

  label() {
    return `<kbd>E</kbd> Open ${this.name} <span style="color:#ffd24a">◈ ${this.cost}</span>`;
  }

  interact() {
    const g = this.game;
    const p = g.player;
    if (p.gold < this.cost) {
      g.hud.banner('Not enough gold', `The ${this.name} wants ◈ ${this.cost}.`, '#a08080', '🔒');
      return;
    }
    p.gold -= this.cost;
    this.used = true;
    sfx('chest');
    const item = rollItem(rand, this.big ? { legendary: 0.2, uncommon: 0.8 } : { legendary: 0.01, uncommon: 0.2 });
    const from = this.pos.clone().setY(this.pos.y + 1);
    g.spawnPickup(item, from, new THREE.Vector3((rand() - 0.5) * 3, 9, (rand() - 0.5) * 3));
    g.fx.burst(from, 30, '#ffd070', { speed: 7, size: 0.3, life: 0.7 });
  }

  update(dt) {
    if (this.used && this.openT < 1) {
      this.openT = Math.min(1, this.openT + dt * 3);
      this.parts.lid.rotation.x = -this.openT * 1.9;
      this.parts.glow.opacity = (1 - this.openT) * 0.9;
    } else if (!this.used) {
      this.parts.glow.opacity = 0.25 + Math.sin(this.game.time * 3) * 0.15;
    }
  }
}

// Chance shrine: pay the Hatter, and maybe he pours you something good.
const HATTER_MISSES = [
  'The Hatter sips his tea and says nothing.',
  '“Why is a raven like a writing desk?” He keeps your gold.',
  '“No room! No room!” Nothing for you.',
  'The Dormouse snores. Your gold vanishes into the teapot.',
];
export class TeaTable {
  constructor(game, x, z) {
    this.game = game;
    this.kind = 'shrine';
    const b = buildTeaTable();
    this.model = b.root;
    this.parts = b.parts;
    const y = game.world.height(x, z);
    this.pos = new THREE.Vector3(x, y, z);
    this.model.position.copy(this.pos);
    this.model.rotation.y = rand() * TAU;
    game.scene.add(this.model);
    this.uses = 0;
    this.priceMult = 1;
    this.used = false;
    this.wait = 0;
  }

  get cost() {
    return Math.round(18 * this.priceMult * this.game.difficulty() ** 1.25);
  }

  label() {
    if (this.wait > 0) return null;
    return `<kbd>E</kbd> Pour the Hatter a cup <span style="color:#ffd24a">◈ ${this.cost}</span>`;
  }

  interact() {
    const g = this.game;
    const p = g.player;
    if (p.gold < this.cost) {
      g.hud.banner('Not enough gold', `The Hatter wants ◈ ${this.cost}.`, '#a08080', '🎩');
      return;
    }
    p.gold -= this.cost;
    this.wait = 0.6;
    this.priceMult *= 1.5;
    const hatPos = this.parts.hat.getWorldPosition(new THREE.Vector3());
    if (rand() < 0.45) {
      this.uses++;
      const item = rollItem(rand, { legendary: 0.03, uncommon: 0.2 });
      g.spawnPickup(item, hatPos.clone().setY(hatPos.y + 0.6), new THREE.Vector3((rand() - 0.5) * 3, 8, (rand() - 0.5) * 3));
      g.fx.burst(hatPos, 30, '#ffd070', { speed: 6, size: 0.3, life: 0.7 });
      sfx('chest');
      if (this.uses >= 2) {
        this.used = true;
        g.hud.banner('Clean cup, move down!', 'The tea party moves on without you.', '#c9a45a', '🎩');
      }
    } else {
      g.hud.banner('No luck', HATTER_MISSES[Math.floor(rand() * HATTER_MISSES.length)], '#a08888', '🫖');
      g.fx.smoke(hatPos, '#8a7a90', 6, 0.4);
      sfx('boil');
    }
  }

  update(dt) {
    this.wait = Math.max(0, this.wait - dt);
    const t = this.game.time;
    this.parts.hat.position.y = 1.06 + (this.wait > 0 ? Math.sin(this.wait * 30) * 0.1 : 0);
    this.parts.hat.rotation.y = t * 0.6;
    this.parts.glow.opacity = this.used ? 0 : 0.3 + Math.sin(t * 3) * 0.2;
  }
}

export class BiscuitTin {
  constructor(game, x, z) {
    this.game = game;
    this.kind = 'tin';
    const y = game.world.height(x, z);
    this.pos = new THREE.Vector3(x, y, z);
    const g = new THREE.Group();
    const tinMat = mat('#2a4a6a', { metalness: 0.7, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.6, 20), tinMat);
    body.position.y = 0.3;
    body.castShadow = true;
    g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.12, 20), mat('#c9a04a', { metalness: 0.8, roughness: 0.3 }));
    band.position.y = 0.3;
    g.add(band);
    this.lid = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 20), mat('#c9a04a', { metalness: 0.8, roughness: 0.3 }));
    this.lid.position.y = 0.64;
    g.add(this.lid);
    g.position.copy(this.pos);
    game.scene.add(g);
    this.model = g;
    this.used = false;
    this.t = 0;
  }

  label() {
    return '<kbd>E</kbd> Open Biscuit Tin';
  }

  interact() {
    const g = this.game;
    this.used = true;
    const gold = Math.round(12 * g.difficulty() * (0.8 + rand() * 0.6));
    g.player.gold += gold;
    g.hud.goldPop(gold);
    g.fx.burst(this.pos.clone().setY(this.pos.y + 0.7), 20, '#ffd24a', { speed: 6, size: 0.22, life: 0.8 });
    sfx('orb');
  }

  update(dt) {
    if (this.used && this.t < 1) {
      this.t += dt * 2;
      this.lid.position.y = 0.64 + this.t * 0.6;
      this.lid.rotation.z = this.t * 2;
      this.lid.position.x = this.t * 0.6;
    }
  }
}

export class Pickup {
  constructor(game, item, pos, vel) {
    this.game = game;
    this.item = item;
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.color = RARITY[item.rarity].color;
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: this.color }));
    g.add(core);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: game.glowTex, color: this.color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    halo.scale.set(2.2, 2.2, 1);
    g.add(halo);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.25, 7, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    beam.position.y = 3.5;
    g.add(beam);
    this.core = core;
    this.model = g;
    game.scene.add(g);
    this.t = 0;
    this.landed = false;
  }

  update(dt) {
    const g = this.game;
    this.t += dt;
    if (!this.landed) {
      this.vel.y -= 20 * dt;
      this.pos.addScaledVector(this.vel, dt);
      const gy = g.world.height(this.pos.x, this.pos.z) + 0.8;
      if (this.pos.y < gy && this.vel.y < 0) {
        this.pos.y = gy;
        this.landed = true;
      }
      g.fx.trail(this.pos, this.color, 0.4, 0.4, 0.8);
    }
    this.model.position.copy(this.pos);
    this.model.position.y += this.landed ? Math.sin(this.t * 3) * 0.15 : 0;
    this.core.rotation.y += dt * 2;
    this.core.rotation.x += dt;
    const pc = g.player.center;
    const d = this.pos.distanceTo(pc);
    if (this.landed && g.player.alive && d < 4.5) {
      this.pos.lerp(pc, 1 - Math.exp(-(9 - d) * dt));
    }
    if (this.t > 0.4 && g.player.alive && d < 1.6) {
      g.collect(this);
      return false;
    }
    return true;
  }

  remove() {
    this.game.scene.remove(this.model);
  }
}

// The Looking Glass: activate → survive while it charges → beat the boss → go through.
export class LookingGlass {
  constructor(game, x, z) {
    this.game = game;
    this.kind = 'glass';
    const b = buildLookingGlass();
    this.model = b.root;
    this.parts = b.parts;
    const y = game.world.height(x, z);
    this.pos = new THREE.Vector3(x, y, z);
    this.model.position.copy(this.pos);
    this.model.rotation.y = Math.atan2(game.world.spawn.x - x, game.world.spawn.z - z);
    game.scene.add(this.model);
    this.state = 'idle';
    this.charge = 0;
    this.radius = 24;
    this.used = false;
    this.inZone = false;
    this.light = new THREE.PointLight('#ff3a70', 30, 22, 1.8);
    this.light.position.set(0, 4.5, 1);
    this.model.add(this.light);
    // stepped dais is walkable
    const base = y;
    game.world.platforms = [5.2, 4.3, 3.4, 2.5].map((r, i) => ({ x, z, r, h: base + 0.35 * (i + 1) }));
    game.world.addCollider({ x, z, r: 1.4, top: y + 8 });
  }

  label() {
    if (this.state === 'idle') return '<kbd>E</kbd> Touch the Looking Glass <span style="color:#ff8aa0">(the hour begins)</span>';
    if (this.state === 'ready') return '<kbd>E</kbd> Step through the Looking Glass';
    return null;
  }

  get interactPos() {
    return this.pos.clone().setY(this.pos.y + 1.4);
  }

  interact() {
    const g = this.game;
    if (this.state === 'idle') {
      this.state = 'charging';
      sfx('boss');
      sfx('bell');
      const boss = g.world.theme.boss || 'rabbit';
      const intro = {
        rabbit: ['The White Rabbit', '“I’m late! I’m late! For a very important date!”', '🐇'],
        queen: ['The Queen of Hearts', '“Who has been painting my roses red?”', '👑'],
        madhatter: ['The Mad Hatter', '“No room! No room! …Oh, there’s always room for YOU.”', '🎩'],
      }[boss];
      g.hud.banner(intro[0], intro[1], '#ff3a50', intro[2]);
      g.camShake(0.6);
      // find standing room near the glass (the Clockworks has tea to avoid)
      let bx = this.pos.x;
      let bz = this.pos.z + 14;
      for (let k = 0; k < 30; k++) {
        const a = rand() * TAU;
        const r = 12 + rand() * 8;
        const x = this.pos.x + Math.cos(a) * r;
        const z = this.pos.z + Math.sin(a) * r;
        if (g.world.canSpawn(x, z)) {
          bx = x;
          bz = z;
          break;
        }
      }
      g.boss = g.director.spawn(boss, bx, bz, null);
      this.zoneRing = g.fx.ring(this.pos.x, this.pos.z, { r0: this.radius, r1: this.radius, dur: 1e9, color: '#ff2a5a', pulse: true, opacity: 0.4 });
      this.zoneRing.hold = true;
    } else if (this.state === 'ready') {
      g.nextStage();
    }
  }

  update(dt) {
    const g = this.game;
    const u = this.parts.glassMat.uniforms;
    u.t.value = g.time;
    u.charge.value = this.charge;
    u.uActive.value = this.state === 'ready' ? 1 : this.state === 'charging' ? 0.4 : 0;
    this.parts.heartMat.emissiveIntensity = 1 + Math.sin(g.time * (this.state === 'charging' ? 8 : 2)) * 0.5 + this.charge;
    this.light.intensity = 25 + this.charge * 40 + (this.state === 'ready' ? 40 : 0);
    if (this.state === 'charging') {
      const p = g.player;
      this.inZone = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < this.radius;
      if (this.inZone && p.alive) this.charge = Math.min(1, this.charge + dt / 75);
      if (Math.random() < 0.4) {
        const a = rand() * TAU;
        const x = this.pos.x + Math.cos(a) * this.radius;
        const z = this.pos.z + Math.sin(a) * this.radius;
        g.fx.spark(x, g.world.height(x, z) + 0.2, z, '#ff3a6a', { speed: 1, g: -3, size: 0.4, life: 1 });
      }
      if (this.charge >= 1) {
        this.state = 'charged';
        g.hud.banner('The Glass Resonates', 'A gift falls from the mirror.', '#ff8aa0', '🪞');
        g.spawnPickup(rollItem(rand, { legendary: 0.1, uncommon: 0.6 }), this.pos.clone().setY(this.pos.y + 4), new THREE.Vector3((rand() - 0.5) * 4, 8, 4));
        sfx('bell');
      }
    }
    if (this.state === 'charged' || this.state === 'charging') {
      // the boss falling is what opens the way; charging is a bonus timer
      if (g.boss && !g.boss.alive) {
        this.state = 'ready';
        if (this.zoneRing) this.zoneRing.dead = true;
        g.hud.banner('The Way Is Open', 'Step through the Looking Glass… deeper still.', '#d0b0ff', '✨');
        sfx('chest');
      }
    }
    if (this.state === 'ready' && Math.random() < 0.6) {
      const c = this.pos.clone();
      c.y += 1.4 + 1 + rand() * 3;
      c.x += (rand() - 0.5) * 2;
      c.z += (rand() - 0.5) * 2;
      g.fx.spark(c.x, c.y, c.z, '#d0a0ff', { speed: 2, g: -1, size: 0.4, life: 1 });
    }
  }
}
