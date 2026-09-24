// Risk-of-Rain-style multishop: three terminals side by side, each holding a
// real item (or a perk rank) floating in a glass capsule. Walk up and press E
// to buy one. Buy from one terminal and the other two lock.

import * as THREE from 'three';
import { rollItem, RARITY, PERKS, perkCost } from './items.js';
import { rand, TAU } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { mat } from '../gfx/models.js';

const PRICE = { common: 30, uncommon: 60, legendary: 150 };

// A glowing token for the offer: its icon on a disc of rarity colour.
const iconCache = new Map();
function iconTexture(icon, color) {
  const key = icon + color;
  if (iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, color);
  g.addColorStop(0.45, color + 'aa');
  g.addColorStop(1, color + '00');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  x.fillStyle = 'rgba(12,6,18,0.82)';
  x.beginPath();
  x.arc(128, 128, 74, 0, TAU);
  x.fill();
  x.lineWidth = 7;
  x.strokeStyle = color;
  x.stroke();
  x.font = '92px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(icon, 128, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  iconCache.set(key, t);
  return t;
}

function priceTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(10,6,14,0.75)';
  x.beginPath();
  x.roundRect(20, 8, 216, 48, 14);
  x.fill();
  x.strokeStyle = '#c9a04a';
  x.lineWidth = 3;
  x.stroke();
  x.font = 'bold 30px Georgia, serif';
  x.fillStyle = '#ffd24a';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const geos = {};
function G(key, make) {
  geos[key] ||= make();
  return geos[key];
}

export class ShopTerminal {
  constructor(game, shop, x, z, yaw, offer) {
    this.game = game;
    this.shop = shop;
    this.kind = 'terminal';
    this.offer = offer;
    const y = game.world.height(x, z);
    this.pos = new THREE.Vector3(x, y, z);
    const col = offer.color;
    const root = new THREE.Group();
    root.position.copy(this.pos);
    root.rotation.y = yaw;
    const brass = mat('#b08a3e', { metalness: 0.9, roughness: 0.3 });
    const dark = mat('#1c1420', { roughness: 0.5, metalness: 0.3 });
    const base = new THREE.Mesh(G('base', () => new THREE.CylinderGeometry(0.62, 0.72, 0.9, 8)), dark);
    base.position.y = 0.45;
    base.castShadow = true;
    root.add(base);
    const collar = new THREE.Mesh(G('collar', () => new THREE.CylinderGeometry(0.66, 0.66, 0.12, 8)), brass);
    collar.position.y = 0.92;
    root.add(collar);
    this.bandMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const band = new THREE.Mesh(G('band', () => new THREE.TorusGeometry(0.66, 0.035, 6, 32)), this.bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.62;
    root.add(band);
    // the glass capsule
    this.glassMat = new THREE.MeshStandardMaterial({ color: '#d8e8ff', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false });
    const glass = new THREE.Mesh(G('glass', () => new THREE.CylinderGeometry(0.46, 0.46, 1.25, 20, 1, true)), this.glassMat);
    glass.position.y = 1.62;
    root.add(glass);
    const cap = new THREE.Mesh(G('cap', () => new THREE.SphereGeometry(0.5, 16, 8, 0, TAU, 0, Math.PI / 2)), brass);
    cap.position.y = 2.24;
    root.add(cap);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const rib = new THREE.Mesh(G('rib', () => new THREE.CylinderGeometry(0.03, 0.03, 1.25, 5)), brass);
      rib.position.set(Math.cos(a) * 0.47, 1.62, Math.sin(a) * 0.47);
      root.add(rib);
    }
    // the offer itself: a spinning medallion stamped with its icon, in a soft glow
    const face = new THREE.MeshStandardMaterial({ map: iconTexture(offer.icon, col), roughness: 0.35, metalness: 0.2, emissive: '#ffffff', emissiveMap: iconTexture(offer.icon, col), emissiveIntensity: 0.55 });
    const rim = new THREE.MeshStandardMaterial({ color: col, metalness: 0.9, roughness: 0.25, emissive: col, emissiveIntensity: 0.35 });
    this.token = new THREE.Mesh(G('coin', () => new THREE.CylinderGeometry(0.36, 0.36, 0.09, 32).rotateX(Math.PI / 2)), [rim, face, face]);
    this.tokenMats = [rim, face];
    this.token.position.y = 1.62;
    root.add(this.token);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: game.glowTex, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.7 }));
    glow.scale.set(1.3, 1.3, 1);
    glow.position.y = 1.62;
    root.add(glow);
    this.glow = glow;
    this.halo = new THREE.Mesh(G('halo', () => new THREE.TorusGeometry(0.34, 0.02, 4, 28)), this.bandMat);
    this.halo.position.y = 1.62;
    root.add(this.halo);
    this.priceMat = new THREE.SpriteMaterial({ map: priceTexture(`◈ ${offer.cost}`), transparent: true, depthWrite: false, depthTest: false });
    this.price = new THREE.Sprite(this.priceMat);
    this.price.scale.set(1.2, 0.3, 1);
    this.price.position.y = 2.75;
    this.price.renderOrder = 10;
    root.add(this.price);
    this.model = root;
    game.scene.add(root);
    game.world.addCollider({ x, z, r: 0.7, top: y + 2.3 });
    this.used = false;
    this.phase = rand() * TAU;
  }

  label() {
    const o = this.offer;
    const tag = o.perk ? `<span style="color:#c9a0ff">perk ${o.rank}/${o.perk.max}</span>` : `<span style="color:${o.color}">${RARITY[o.item.rarity].label}</span>`;
    return `<kbd>E</kbd> Buy <b>${o.name}</b> ${tag} <span style="color:#ffd24a">◈ ${o.cost}</span><br><small style="opacity:.8">${o.desc}</small>`;
  }

  interact() {
    const g = this.game;
    const p = g.player;
    const o = this.offer;
    if (p.gold < o.cost) {
      g.hud.banner('Not enough gold', `${o.name} costs ◈ ${o.cost}.`, '#a08080', '🔒');
      sfx('tick');
      return;
    }
    p.gold -= o.cost;
    if (o.perk) {
      p.perks[o.perk.id] = (p.perks[o.perk.id] || 0) + 1;
      p.recompute();
      g.hud.banner(`${o.perk.name} ${p.perks[o.perk.id]}/${o.perk.max}`, `${o.perk.per}.`, '#c9a0ff', o.perk.icon);
    } else {
      p.inv.add(o.item.id);
      p.recompute();
      g.hud.banner(o.item.name, o.item.desc, RARITY[o.item.rarity].color, o.item.icon);
    }
    g.hud.updateItems(p.inv);
    sfx('chest');
    const at = this.pos.clone().setY(this.pos.y + 1.6);
    g.fx.burst(at, 40, o.color, { speed: 7, size: 0.35, life: 0.7 });
    g.fx.flash(at, o.color, 4, 0.25);
    // the token flies to Alice
    this.fly = { t: 0, from: at };
    this.shop.sold(this);
  }

  close(bought) {
    this.used = true;
    this.closed = !bought;
    this.glassMat.color.set(bought ? '#d8e8ff' : '#402030');
    this.glassMat.opacity = bought ? 0.1 : 0.55;
    this.bandMat.color.set(bought ? '#806040' : '#401018');
    this.price.visible = false;
    this.glow.visible = false;
    if (!bought) for (const m of this.tokenMats) {
      m.color.multiplyScalar(0.25);
      m.emissiveIntensity = 0;
    }
  }

  update(dt) {
    const t = this.game.time;
    if (this.fly) {
      const f = this.fly;
      f.t += dt;
      const k = Math.min(1, f.t / 0.45);
      const target = this.game.player.center;
      const w = f.from.clone().lerp(target, k * k);
      w.y += Math.sin(k * Math.PI) * 1.5;
      this.model.worldToLocal(w);
      this.token.position.copy(w);
      this.token.scale.setScalar(0.95 * (1 - k * 0.7));
      if (k >= 1) {
        this.token.visible = false;
        this.fly = null;
      }
      return;
    }
    if (this.used) return;
    this.token.position.y = 1.62 + Math.sin(t * 2 + this.phase) * 0.08;
    this.token.rotation.y = t * 1.6 + this.phase;
    this.glow.position.y = this.token.position.y;
    this.halo.rotation.x = t * 1.3 + this.phase;
    this.halo.rotation.y = t * 0.9;
    this.bandMat.opacity = 0.6 + Math.sin(t * 3 + this.phase) * 0.3;
  }
}

// Build the three offers: mostly items, sometimes a perk rank. No repeats.
function makeOffers(game) {
  // the title screen previews a stage before Alice exists
  const perks = (game.player && game.player.perks) || {};
  const coeff = game.difficulty();
  const offers = [];
  const taken = new Set();
  for (let i = 0; i < 3; i++) {
    let o = null;
    const open = PERKS.filter((k) => (perks[k.id] || 0) < k.max && !taken.has(k.id));
    if (i === 2 && open.length && rand() < 0.6) {
      const perk = open[Math.floor(rand() * open.length)];
      const rank = (perks[perk.id] || 0) + 1;
      o = { perk, rank, name: perk.name, icon: perk.icon, desc: perk.per, color: '#b070ff', cost: Math.round(perkCost(rank - 1, coeff) * 0.85) };
      taken.add(perk.id);
    } else {
      let item;
      for (let k = 0; k < 12; k++) {
        item = rollItem(rand, { legendary: 0.04, uncommon: 0.3 });
        if (!taken.has(item.id)) break;
      }
      taken.add(item.id);
      o = { item, name: item.name, icon: item.icon, desc: item.desc, color: RARITY[item.rarity].color, cost: Math.round(PRICE[item.rarity] * coeff ** 1.25) };
    }
    offers.push(o);
  }
  return offers;
}

export class MultiShop {
  constructor(game, x, z, facing) {
    this.game = game;
    this.terminals = [];
    const offers = makeOffers(game);
    // three in a gentle arc, facing `facing` (radians)
    const right = new THREE.Vector3(Math.cos(facing), 0, -Math.sin(facing));
    const fwd = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
    offers.forEach((o, i) => {
      const k = i - 1;
      const px = x + right.x * k * 2.4 - fwd.x * Math.abs(k) * 0.6;
      const pz = z + right.z * k * 2.4 - fwd.z * Math.abs(k) * 0.6;
      this.terminals.push(new ShopTerminal(game, this, px, pz, facing, o));
    });
    // a lamp post with a hanging sign behind the middle terminal
    const sign = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6), mat('#2a1c14', { roughness: 0.7 }));
    post.position.y = 1.7;
    sign.add(post);
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: game.glowTex, color: '#ffc070', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    lamp.scale.set(1.6, 1.6, 1);
    lamp.position.y = 3.5;
    sign.add(lamp);
    sign.position.set(x - fwd.x * 1.6, game.world.height(x, z), z - fwd.z * 1.6);
    game.scene.add(sign);
    this.sign = sign;
  }

  sold(term) {
    for (const t of this.terminals) t.close(t === term);
  }

  remove() {
    this.game.scene.remove(this.sign);
  }
}
