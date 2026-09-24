// Tea chests, biscuit tins, dropped items, and the Looking Glass (teleporter).

import * as THREE from 'three';
import { buildChest, buildLookingGlass, buildTeaTable, mat } from '../gfx/models.js';
import { rollItem, RARITY, PERKS } from './items.js';
import { rand, TAU } from '../engine/util.js';
import { sfx, setMusic } from '../engine/audio.js';
import { ascend, QUEEN_POS } from '../world/throne.js';

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

// A violet reliquary: pay gold, gain a free rank in a random perk.
export class PerkChest {
  constructor(game, x, z) {
    this.game = game;
    this.kind = 'perkchest';
    const b = buildChest(false);
    this.model = b.root;
    this.parts = b.parts;
    this.model.traverse((o) => {
      if (o.isMesh && o.material.color && o.material.color.getHexString() === '3b2418') o.material = PerkChest.wood ||= mat('#3a1450', { roughness: 0.5 });
    });
    this.parts.glow.color.set('#c070ff');
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: game.glowTex, color: '#c070ff', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    star.scale.set(2.4, 2.4, 1);
    star.position.y = 1.4;
    this.model.add(star);
    this.star = star;
    const y = game.world.height(x, z);
    this.pos = new THREE.Vector3(x, y, z);
    this.model.position.copy(this.pos);
    this.model.rotation.y = rand() * TAU;
    game.scene.add(this.model);
    this.used = false;
    this.openT = 0;
  }

  get cost() {
    return Math.round(35 * this.game.difficulty() ** 1.25);
  }

  label() {
    return `<kbd>E</kbd> Open Perk Reliquary <span style="color:#ffd24a">◈ ${this.cost}</span> <span style="color:#c9a0ff">(a random perk rank)</span>`;
  }

  interact() {
    const g = this.game;
    const p = g.player;
    if (p.gold < this.cost) {
      g.hud.banner('Not enough gold', `The reliquary wants ◈ ${this.cost}.`, '#a08080', '🔒');
      return;
    }
    const open = PERKS.filter((k) => (p.perks[k.id] || 0) < k.max);
    if (!open.length) {
      g.hud.banner('Nothing left to learn', 'Every perk is already mastered.', '#c9a0ff', '✦');
      return;
    }
    p.gold -= this.cost;
    this.used = true;
    const perk = open[Math.floor(rand() * open.length)];
    p.perks[perk.id] = (p.perks[perk.id] || 0) + 1;
    const before = p.stats.maxHp;
    p.recompute();
    if (p.stats.maxHp > before) p.hp += p.stats.maxHp - before;
    g.hud.updateItems();
    g.hud.banner(`${perk.name} ${p.perks[perk.id]}/${perk.max}`, `Perk Reliquary: ${perk.per}.`, '#c9a0ff', perk.icon);
    g.fx.burst(this.pos.clone().setY(this.pos.y + 1), 40, '#c070ff', { speed: 7, size: 0.35, life: 0.8 });
    g.fx.beam(this.pos.clone(), this.pos.clone().setY(this.pos.y + 10), { color: '#c070ff', width: 0.6, dur: 0.7, opacity: 0.6 });
    sfx('chest');
  }

  update(dt) {
    if (this.used && this.openT < 1) {
      this.openT = Math.min(1, this.openT + dt * 3);
      this.parts.lid.rotation.x = -this.openT * 1.9;
      this.parts.glow.opacity = (1 - this.openT) * 0.9;
      this.star.material.opacity = 1 - this.openT;
    } else if (!this.used) {
      const t = this.game.time;
      this.parts.glow.opacity = 0.35 + Math.sin(t * 3) * 0.2;
      this.star.material.opacity = 0.5 + Math.sin(t * 2) * 0.3;
    }
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
// A clockwork seal: a gold ring around a burning Roman-numeral sigil.
let sealTex = null;
function sealTexture() {
  if (sealTex) return sealTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.translate(128, 128);
  const glow = x.createRadialGradient(0, 0, 10, 0, 0, 128);
  glow.addColorStop(0, 'rgba(255,200,120,0.9)');
  glow.addColorStop(0.5, 'rgba(255,120,40,0.35)');
  glow.addColorStop(1, 'rgba(255,80,20,0)');
  x.fillStyle = glow;
  x.fillRect(-128, -128, 256, 256);
  x.strokeStyle = 'rgba(255,230,180,0.95)';
  x.fillStyle = 'rgba(255,230,180,0.95)';
  x.lineWidth = 5;
  x.beginPath();
  x.arc(0, 0, 96, 0, TAU);
  x.stroke();
  x.font = 'bold 26px serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const nums = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  nums.forEach((n, i) => {
    const a = (i / 12) * TAU - Math.PI / 2;
    x.fillText(n, Math.cos(a) * 76, Math.sin(a) * 76);
  });
  // a keyhole at the heart of the seal
  x.beginPath();
  x.arc(0, -10, 16, 0, TAU);
  x.moveTo(-9, 0);
  x.lineTo(9, 0);
  x.lineTo(14, 36);
  x.lineTo(-14, 36);
  x.fill();
  sealTex = new THREE.CanvasTexture(c);
  sealTex.colorSpace = THREE.SRGBColorSpace;
  return sealTex;
}

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
    // some stages chain the Glass behind seals that only slaughter can break
    this.sealCount = game.world.theme.seals || 0;
    this.killsPerSeal = 7;
    this.broken = 0;
    this.seals = [];
    if (this.sealCount) {
      this.state = 'sealed';
      this.buildSeals();
    }
  }

  buildSeals() {
    const tex = sealTexture();
    const ringGeo = new THREE.TorusGeometry(1.1, 0.09, 8, 40);
    const discGeo = new THREE.CircleGeometry(1.0, 32);
    const chainGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5).translate(0, 0.5, 0).rotateX(Math.PI / 2);
    for (let i = 0; i < this.sealCount; i++) {
      const root = new THREE.Group();
      const ringMat = new THREE.MeshStandardMaterial({ color: '#c9a04a', metalness: 0.9, roughness: 0.3, emissive: '#ff9a30', emissiveIntensity: 0.8 });
      const discMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffb070' });
      root.add(new THREE.Mesh(ringGeo, ringMat));
      root.add(new THREE.Mesh(discGeo, discMat));
      const chain = new THREE.Mesh(chainGeo, new THREE.MeshBasicMaterial({ color: '#ff9a40', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.game.scene.add(chain);
      this.game.scene.add(root);
      this.seals.push({ root, ringMat, discMat, chain, a: (i / this.sealCount) * TAU, alive: true, pop: 0 });
    }
  }

  // The final battle: the Queen and two knights, then the Crimson Queen.
  startCourt() {
    const g = this.game;
    const q = g.boss;
    q.maxHp = q.hp = q.maxHp * 0.65;
    q.pos.set(0, 0, -30);
    const knights = [
      g.director.spawn('knight', -9, -26, null),
      g.director.spawn('knight', 9, -26, null),
    ];
    knights[1].name = 'The Knave of Hearts';
    this.court = { phase: 1, members: [q, ...knights], t: 0 };
  }

  updateCourt(dt) {
    const g = this.game;
    const c = this.court;
    c.t += dt;
    if (c.phase === 1 && c.members.every((e) => !e.alive)) {
      c.phase = 2;
      c.t = 0;
      ascend(g.world);
      setMusic(null);
      g.hud.banner('The Heart Refuses to Die', 'The hall is tearing apart. Something vast is rising behind the throne…', '#ff2040', '💔');
      g.camShake(1.2);
      sfx('boss');
      // clear the floor for the finale
      for (const e of g.enemies) if (e.alive && !e.boss) {
        e.alive = false;
        e.deadT = 0.6;
      }
    }
    if (c.phase === 2 && c.t > 2.2) {
      c.phase = 3;
      g.boss = g.director.spawn('crimson', QUEEN_POS.x, QUEEN_POS.z, null);
      setMusic('final');
    }
    if (c.phase === 3 && g.boss && !g.boss.alive) {
      c.phase = 4;
      c.t = 0;
      setMusic(null);
      this.state = 'won';
      if (this.zoneRing) this.zoneRing.dead = true;
    }
    if (c.phase === 4 && c.t > 5 && !c.done) {
      c.done = true;
      g.victory();
    }
  }

  get sealKills() {
    const p = this.game.player;
    if (this.killBase === undefined) this.killBase = p.kills;
    return p.kills - this.killBase;
  }

  updateSeals(dt) {
    const g = this.game;
    const centre = this.pos.clone().setY(this.pos.y + 4.2);
    const want = Math.min(this.sealCount, Math.floor(this.sealKills / this.killsPerSeal));
    while (this.broken < want) {
      const s = this.seals.find((q) => q.alive);
      s.alive = false;
      this.broken++;
      const at = s.root.position.clone();
      g.fx.burst(at, 50, '#ffb040', { speed: 9, g: -6, size: 0.5, life: 1.1 });
      g.fx.flash(at, '#ffb040', 14, 0.35);
      g.camShake(0.35);
      sfx('bell');
      const left = this.sealCount - this.broken;
      if (left > 0) g.hud.banner(`Seal Broken — ${this.broken} / ${this.sealCount}`, `${left} seal${left > 1 ? 's' : ''} still bind the Looking Glass. Keep killing.`, '#ffb040', '🔓');
      else {
        this.state = 'idle';
        this.discovered = true;
        g.hud.banner('The Glass Is Unsealed', 'The last chain snaps. Touch the Looking Glass to face the Hatter.', '#ff8aa0', '🪞');
        sfx('chest');
      }
    }
    for (const s of this.seals) {
      if (!s.alive) {
        // shattered seals spin away and fade
        s.pop += dt;
        s.root.position.y += dt * 6;
        s.root.rotation.z += dt * 8;
        s.root.scale.setScalar(Math.max(0.001, 1.5 * (1 - s.pop * 1.4)));
        s.chain.visible = false;
        if (s.pop > 0.8 && s.root.parent) {
          s.root.removeFromParent();
          s.chain.removeFromParent();
        }
        continue;
      }
      s.a += dt * 0.35;
      const r = 6;
      s.root.scale.setScalar(1.5);
      s.root.position.set(this.pos.x + Math.cos(s.a) * r, this.pos.y + 5 + Math.sin(g.time * 1.3 + s.a * 3) * 0.5, this.pos.z + Math.sin(s.a) * r);
      s.root.lookAt(centre.x, s.root.position.y, centre.z);
      s.root.rotateZ(g.time * 0.8);
      const pulse = 0.8 + Math.sin(g.time * 3 + s.a) * 0.3;
      s.ringMat.emissiveIntensity = pulse;
      s.discMat.opacity = 0.6 + pulse * 0.3;
      s.chain.position.copy(s.root.position);
      s.chain.lookAt(centre);
      s.chain.scale.set(1, 1, s.root.position.distanceTo(centre));
    }
  }

  label() {
    if (this.state === 'sealed') {
      const left = this.killsPerSeal - (this.sealKills % this.killsPerSeal);
      return `<span style="color:#ffb040">🔒 Sealed — ${this.sealCount - this.broken} seals remain · slay ${left} more to break the next</span>`;
    }
    if (this.state === 'idle' && this.game.world.theme.final) return '<kbd>E</kbd> Touch the Queen’s Mirror <span style="color:#ff8aa0">(begin the final battle)</span>';
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
      if (g.world.theme.final) intro.splice(0, 3, 'The Queen’s Court', '“Knights! Let us have a trial — and then the execution.”', '👑');
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
      setMusic('boss');
      if (g.world.theme.final) this.startCourt();
      // boss fights stay readable: the extra crowd scatters back into the dark
      const others = g.enemies.filter((e) => e.alive && !e.boss).sort((a, b) => b.distToPlayer() - a.distToPlayer());
      for (const e of others.slice(0, Math.max(0, others.length - 4))) {
        e.alive = false;
        e.deadT = 0.6;
        g.fx.portal(e.pos.x, e.pos.z, 1.4, '#6020a0', 0.8);
      }
      this.zoneRing = g.fx.ring(this.pos.x, this.pos.z, { r0: this.radius, r1: this.radius, dur: 1e9, color: '#ff2a5a', pulse: true, opacity: 0.4 });
      this.zoneRing.hold = true;
    } else if (this.state === 'ready') {
      g.nextStage();
    }
  }

  update(dt) {
    const g = this.game;
    if (this.seals.length) this.updateSeals(dt);
    // discovery: close enough to see it, or the Cheshire Cat takes pity
    if (!this.discovered) {
      const d = Math.hypot(g.player.pos.x - this.pos.x, g.player.pos.z - this.pos.z);
      const small = (g.world.S || 1) <= 1;
      if (small || d < 60) {
        this.discovered = true;
        if (!small) g.hud.banner('The Looking Glass', 'There it is — marked on your map.', '#ff8aa0', '🪞');
      } else if (g.stageTime > 240) {
        this.discovered = true;
        g.hud.banner('The Cheshire Cat whispers…', '“Lost, are we? It’s where the light is.” The Glass is on your map.', '#c080ff', '😸');
        this.revealBeam = g.fx.beam(this.pos.clone(), this.pos.clone().setY(this.pos.y + 80), { color: '#ff5a8a', width: 1.6, dur: 1e9, opacity: 0.35 });
        this.revealBeam.hold = true;
      }
    }
    if (this.revealBeam && this.state !== 'idle' && this.state !== 'sealed') {
      this.revealBeam.dead = true;
      this.revealBeam = null;
    }
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
    if (this.court) this.updateCourt(dt);
    else if (this.state === 'charged' || this.state === 'charging') {
      // the boss falling is what opens the way; charging is a bonus timer
      if (g.boss && !g.boss.alive) {
        this.state = 'ready';
        if (this.zoneRing) this.zoneRing.dead = true;
        g.hud.banner('The Way Is Open', 'Step through the Looking Glass… deeper still.', '#d0b0ff', '✨');
        setMusic('stage');
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
