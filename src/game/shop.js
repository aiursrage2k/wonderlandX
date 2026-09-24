// The Dormouse's Curio Cart: a market stall on each stage selling chosen
// items (not gambles), healing tea, and rerolls. Opening it pauses the game.

import * as THREE from 'three';
import { mat } from '../gfx/models.js';
import { ITEMS, RARITY, ITEM_BY_ID } from './items.js';
import { rand, TAU, makeCanvas } from '../engine/util.js';
import { sfx } from '../engine/audio.js';

const BASE_PRICE = { common: 45, uncommon: 110, legendary: 280 };
const $ = (id) => document.getElementById(id);

function awningTexture() {
  const c = makeCanvas(256, 64);
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    x.fillStyle = i % 2 ? '#efe4cf' : '#8e1020';
    x.fillRect(i * 32, 0, 32, 64);
  }
  x.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 8; i++) {
    x.beginPath();
    x.arc(i * 32 + 16, 64, 16, Math.PI, 0);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture() {
  const c = makeCanvas(512, 160);
  const x = c.getContext('2d');
  x.fillStyle = '#1a0e0a';
  x.fillRect(0, 0, 512, 160);
  x.strokeStyle = '#c9a04a';
  x.lineWidth = 6;
  x.strokeRect(8, 8, 496, 144);
  x.fillStyle = '#f2d792';
  x.font = 'bold 44px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('CURIOS & TEAS', 256, 62);
  x.font = 'italic 26px Georgia, serif';
  x.fillStyle = '#e0c8a8';
  x.fillText('~ the Dormouse, proprietor ~', 256, 116);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildStall(glowTex) {
  const root = new THREE.Group();
  const wood = mat('#3a2216', { roughness: 0.75 });
  const dark = mat('#1e120c', { roughness: 0.8 });
  const gold = mat('#c9a04a', { metalness: 0.85, roughness: 0.3 });
  const add = (g, m, x, y, z) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    root.add(o);
    return o;
  };
  // counter + back shelves
  add(new THREE.BoxGeometry(3.2, 1.0, 1.0), wood, 0, 0.5, 0.4);
  add(new THREE.BoxGeometry(3.3, 0.08, 1.1), dark, 0, 1.04, 0.4);
  add(new THREE.BoxGeometry(3.2, 2.4, 0.2), dark, 0, 1.2, -0.6);
  for (const y of [1.5, 2.1]) add(new THREE.BoxGeometry(3.0, 0.06, 0.4), wood, 0, y, -0.4);
  // posts + striped awning
  for (const x of [-1.6, 1.6]) for (const z of [0.9, -0.6]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.0, 8), wood, x, 1.5, z);
  const aw = new THREE.MeshStandardMaterial({ map: awningTexture(), roughness: 0.8, side: THREE.DoubleSide });
  const awning = add(new THREE.PlaneGeometry(3.6, 1.9, 1, 4), aw, 0, 3.05, 0.35);
  awning.rotation.x = -Math.PI / 2 + 0.35;
  // scalloped valance
  const val = add(new THREE.PlaneGeometry(3.6, 0.35), aw, 0, 2.62, 1.2);
  val.rotation.x = 0.1;
  // sign
  const sign = add(new THREE.PlaneGeometry(2.2, 0.68), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.6, emissive: '#3a2a10', emissiveIntensity: 0.4 }), 0, 3.55, 0.05);
  sign.rotation.x = -0.1;
  // wares: bottles, teapots, jars
  const glassCols = ['#40c0a0', '#b040ff', '#ff4060', '#ffc040', '#60a0ff'];
  for (let i = 0; i < 9; i++) {
    const y = i < 5 ? 1.66 : 2.26;
    const x = -1.2 + (i % 5) * 0.6 + (i >= 5 ? 0.3 : 0);
    const col = glassCols[i % glassCols.length];
    const bm = new THREE.MeshStandardMaterial({ color: col, roughness: 0.1, metalness: 0.2, emissive: col, emissiveIntensity: 0.7 });
    add(new THREE.CylinderGeometry(0.09, 0.11, 0.26, 12), bm, x, y, -0.4);
    add(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 8), dark, x, y + 0.17, -0.4);
  }
  const porc = mat('#f2ece2', { roughness: 0.3 });
  for (const x of [-0.9, 0.3, 1.1]) {
    const p = add(new THREE.SphereGeometry(0.16, 14, 10), porc, x, 1.22, 0.4);
    p.scale.y = 0.8;
    add(new THREE.ConeGeometry(0.04, 0.18, 6), porc, x + 0.18, 1.25, 0.4).rotation.z = -1.1;
  }
  // a sleeping dormouse in a teapot on the counter
  const pot = add(new THREE.SphereGeometry(0.3, 16, 12), porc, -0.2, 1.3, 0.45);
  pot.scale.y = 0.85;
  const mouse = add(new THREE.SphereGeometry(0.14, 14, 10), mat('#8a6a50', { roughness: 1 }), -0.2, 1.56, 0.45);
  mouse.scale.set(1.1, 0.8, 1);
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.06, 10, 8), mat('#c89080'), -0.2 + s * 0.09, 1.66, 0.43).scale.z = 0.4;
  // hanging lanterns (emissive + halo, no real light)
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffb257' });
  const halo = new THREE.SpriteMaterial({ map: glowTex, color: '#ff9a40', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
  for (const x of [-1.5, 1.5]) {
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4), dark, x, 2.55, 1.15);
    add(new THREE.SphereGeometry(0.12, 10, 8), bulb, x, 2.3, 1.15);
    const h = new THREE.Sprite(halo);
    h.scale.set(2.2, 2.2, 1);
    h.position.set(x, 2.3, 1.15);
    root.add(h);
  }
  // coin-glow ring on the ground so it reads from afar
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.5, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.position.set(0, 0.06, 0.6);
  root.add(ring);
  add(new THREE.TorusGeometry(0.28, 0.05, 8, 20), gold, 1.25, 1.35, 0.45).rotation.x = Math.PI / 2;
  return { root, ring };
}

export class Shop {
  constructor(game, x, z, faceX, faceZ) {
    this.game = game;
    this.kind = 'shop';
    const b = buildStall(game.glowTex);
    this.model = b.root;
    this.ring = b.ring;
    const y = game.world.height(x, z);
    this.pos = new THREE.Vector3(x, y, z);
    this.model.position.copy(this.pos);
    this.model.rotation.y = Math.atan2(faceX - x, faceZ - z);
    game.scene.add(this.model);
    game.world.addCollider({ x, z, r: 1.5, top: y + 3.5 });
    this.used = false;
    this.teaMult = 1;
    this.rerollMult = 1;
    this.stock();
    // interaction point: in front of the counter
    const f = new THREE.Vector3(Math.sin(this.model.rotation.y), 0, Math.cos(this.model.rotation.y));
    this.interactPos = this.pos.clone().addScaledVector(f, 1.8);
  }

  stock() {
    const pick = (rarity, taken) => {
      const pool = ITEMS.filter((i) => i.rarity === rarity && !taken.has(i.id));
      return pool[Math.floor(rand() * pool.length)];
    };
    const taken = new Set();
    const wants = ['common', 'common', 'common', 'uncommon', rand() < 0.3 ? 'legendary' : 'uncommon'];
    this.offers = wants.map((r) => {
      const it = pick(r, taken);
      taken.add(it.id);
      return { id: it.id, sold: false };
    });
  }

  price(base) {
    return Math.round(base * this.game.difficulty() ** 1.25);
  }

  label() {
    return '<kbd>E</kbd> Browse the Dormouse’s Curio Cart';
  }

  interact() {
    this.game.openShop(this);
  }

  update() {
    this.ring.material.opacity = 0.25 + Math.sin(this.game.time * 2.5) * 0.12;
  }

  // ─── UI ───
  render() {
    const g = this.game;
    const p = g.player;
    $('shop-gold').textContent = p.gold;
    const grid = $('shop-items');
    grid.innerHTML = '';
    this.offers.forEach((o, i) => {
      const it = ITEM_BY_ID[o.id];
      const cost = this.price(BASE_PRICE[it.rarity]);
      const have = p.inv.count(it.id);
      const card = document.createElement('div');
      card.className = `ware${o.sold ? ' sold' : ''}`;
      card.style.setProperty('--rc', RARITY[it.rarity].color);
      card.innerHTML = `
        <div class="ware-icon">${it.icon}</div>
        <div class="ware-rarity">${RARITY[it.rarity].label}${have ? ` · owned ×${have}` : ''}</div>
        <div class="ware-name">${it.name}</div>
        <div class="ware-desc">${it.desc}</div>
        <button class="ware-buy" ${o.sold || p.gold < cost ? 'disabled' : ''}>${o.sold ? 'Sold' : `◈ ${cost}`}</button>`;
      card.querySelector('button').onclick = () => this.buy(i);
      grid.appendChild(card);
    });
    const tea = this.price(22 * this.teaMult);
    const reroll = this.price(18 * this.rerollMult);
    const full = p.hp >= p.stats.maxHp - 0.5;
    $('shop-tea').disabled = p.gold < tea || full;
    $('shop-tea').innerHTML = `🫖 Healing Tea <small>restore 50% health</small><b>${full ? 'Full health' : `◈ ${tea}`}</b>`;
    $('shop-reroll').disabled = p.gold < reroll || this.offers.every((o) => o.sold);
    $('shop-reroll').innerHTML = `🎲 Reroll <small>new wares for unsold shelves</small><b>◈ ${reroll}</b>`;
    $('shop-tea').onclick = () => this.buyTea(tea);
    $('shop-reroll').onclick = () => this.reroll(reroll);
  }

  buy(i) {
    const g = this.game;
    const p = g.player;
    const o = this.offers[i];
    const it = ITEM_BY_ID[o.id];
    const cost = this.price(BASE_PRICE[it.rarity]);
    if (o.sold || p.gold < cost) return;
    p.gold -= cost;
    o.sold = true;
    p.inv.add(it.id);
    p.recompute();
    g.hud.updateItems(p.inv);
    g.hud.goldPop(-cost);
    sfx('chest');
    this.flash(`${it.icon} ${it.name} — yours.`);
    this.render();
  }

  buyTea(cost) {
    const p = this.game.player;
    if (p.gold < cost) return;
    p.gold -= cost;
    p.heal(p.stats.maxHp * 0.5);
    this.teaMult *= 1.5;
    sfx('orb');
    this.flash('🫖 Warm, sweet, and only slightly poisoned.');
    this.render();
  }

  reroll(cost) {
    const p = this.game.player;
    if (p.gold < cost) return;
    p.gold -= cost;
    this.rerollMult *= 1.6;
    const keep = this.offers;
    this.stock();
    this.offers = this.offers.map((o, i) => (keep[i].sold ? keep[i] : o));
    sfx('cards');
    this.flash('🎲 The Dormouse shuffles the shelves in its sleep.');
    this.render();
  }

  flash(msg) {
    const el = $('shop-msg');
    el.textContent = msg;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }
}
