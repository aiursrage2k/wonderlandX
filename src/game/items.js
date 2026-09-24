// Stacking items, Risk-of-Rain style. Stats are recomputed from the inventory;
// on-hit / on-kill procs are read by combat code via count(id).

export const RARITY = {
  common: { label: 'Common', color: '#e8e4dc' },
  uncommon: { label: 'Uncommon', color: '#7ee07e' },
  legendary: { label: 'Legendary', color: '#ff5a5a' },
  cursed: { label: 'Cursed', color: '#c070ff' },
};

export const ITEMS = [
  { id: 'drink_me', name: 'Drink Me Potion', rarity: 'common', icon: '🧪', desc: 'Attack speed +15%.' },
  { id: 'eat_me', name: 'Eat Me Cake', rarity: 'common', icon: '🍰', desc: 'Max health +25.' },
  { id: 'pocket_watch', name: "Rabbit's Pocket Watch", rarity: 'common', icon: '⏱️', desc: 'Move speed +14%.' },
  { id: 'whetstone', name: 'Vorpal Whetstone', rarity: 'common', icon: '🗡️', desc: 'Critical chance +10%.' },
  { id: 'rose_thorn', name: 'Rose Thorn', rarity: 'common', icon: '🌹', desc: '10% chance on hit to bleed for 240% damage.' },
  { id: 'tart', name: 'Tart of Hearts', rarity: 'common', icon: '❤️', desc: 'Heal 8 (+6 per stack) on kill.' },
  { id: 'turtle', name: 'Mock Turtle Shell', rarity: 'common', icon: '🐢', desc: 'Armor +15.' },
  { id: 'hookah', name: "Caterpillar's Hookah", rarity: 'common', icon: '💨', desc: 'Health regen +1.6/s.' },
  { id: 'sugar', name: 'Sugar Cube', rarity: 'common', icon: '🧊', desc: 'Damage +12%.' },
  { id: 'top_hat', name: "Hatter's Top Hat", rarity: 'uncommon', icon: '🎩', desc: '+1 extra jump (triple jump!).' },
  { id: 'jubjub', name: 'Jubjub Feather', rarity: 'uncommon', icon: '🪶', desc: '10% chance on hit to loose a homing feather for 300% damage.' },
  { id: 'cheshire', name: 'Cheshire Tooth', rarity: 'uncommon', icon: '😸', desc: '20% chance on hit to arc a grin-bolt to 3 enemies for 80% damage.' },
  { id: 'kettle', name: 'Boiling Kettle', rarity: 'uncommon', icon: '🫖', desc: 'Kills erupt in scalding tea for 150% damage in 4m (+2m per stack).' },
  { id: 'decree', name: "Queen's Decree", rarity: 'uncommon', icon: '📜', desc: 'Skill cooldowns -15%. +1 Teapot charge.' },
  { id: 'mirror', name: 'Looking-Glass Shard', rarity: 'uncommon', icon: '🪞', desc: '15% chance to throw a mirrored extra card.' },
  { id: 'vorpal', name: 'The Vorpal Blade', rarity: 'legendary', icon: '⚔️', desc: 'Every 5th throw is a piercing vorpal blade for 600% damage.' },
  { id: 'unbirthday', name: 'Unbirthday Present', rarity: 'legendary', icon: '🎁', desc: 'Upon death, wake up and keep going. Consumed.' },
  { id: 'jabberwock', name: "Jabberwock's Heart", rarity: 'legendary', icon: '🐉', desc: 'Damage +60%. Max health +40.' },
  { id: 'broken_watch', name: 'Broken Pocket Watch', rarity: 'cursed', icon: '🕰️', desc: 'Dodging freezes time: enemies within 14m are slowed for 2.5s (+1s per stack). Each dodge raises Corruption by 8.' },
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export function rollItem(rng, weights) {
  const r = rng();
  let rarity = 'common';
  if (r < weights.legendary) rarity = 'legendary';
  else if (r < weights.legendary + weights.uncommon) rarity = 'uncommon';
  const pool = ITEMS.filter((i) => i.rarity === rarity);
  return pool[Math.floor(rng() * pool.length)];
}

export class Inventory {
  constructor() {
    this.stacks = new Map();
    this.order = [];
  }

  add(id) {
    if (!this.stacks.has(id)) this.order.push(id);
    this.stacks.set(id, (this.stacks.get(id) || 0) + 1);
  }

  remove(id) {
    const n = (this.stacks.get(id) || 0) - 1;
    if (n <= 0) {
      this.stacks.delete(id);
      this.order = this.order.filter((x) => x !== id);
    } else this.stacks.set(id, n);
  }

  count(id) {
    return this.stacks.get(id) || 0;
  }

  stats() {
    const c = (id) => this.count(id);
    return {
      maxHp: 110 + 25 * c('eat_me') + 40 * c('jabberwock'),
      regen: 1.0 + 1.6 * c('hookah'),
      speed: 7.2 * (1 + 0.14 * c('pocket_watch')),
      attackSpeed: 1 + 0.15 * c('drink_me'),
      crit: 0.01 + 0.1 * c('whetstone'),
      damage: 16 * (1 + 0.12 * c('sugar') + 0.6 * c('jabberwock')),
      armor: 15 * c('turtle'),
      jumps: 2 + c('top_hat'),
      cdMult: 0.85 ** c('decree'),
      teapotCharges: 1 + c('decree'),
    };
  }
}

// Perks: permanent (per run) upgrades bought with gold. Each rank stacks.
export const PERKS = [
  { id: 'vitality', name: 'Vitality', icon: '❤️', per: '+15 max health', max: 10, apply: (s, r) => { s.maxHp += 15 * r; } },
  { id: 'ferocity', name: 'Ferocity', icon: '🗡️', per: '+8% damage', max: 10, apply: (s, r) => { s.damage *= 1 + 0.08 * r; } },
  { id: 'alacrity', name: 'Alacrity', icon: '🃏', per: '+7% attack speed', max: 10, apply: (s, r) => { s.attackSpeed += 0.07 * r; } },
  { id: 'fleetfoot', name: 'Fleetfoot', icon: '👢', per: '+5% move speed', max: 8, apply: (s, r) => { s.speed *= 1 + 0.05 * r; } },
  { id: 'sharpeye', name: 'Sharp Eye', icon: '🎯', per: '+3% critical chance', max: 10, apply: (s, r) => { s.crit += 0.03 * r; } },
  { id: 'steeped', name: 'Steeped', icon: '🍵', per: '+0.6 health regen/s', max: 10, apply: (s, r) => { s.regen += 0.6 * r; } },
  { id: 'ironskin', name: 'Ironskin', icon: '🛡️', per: '+6 armor', max: 10, apply: (s, r) => { s.armor += 6 * r; } },
];

export function perkCost(rank, coeff) {
  return Math.round(40 * 1.45 ** rank * coeff ** 0.8);
}

// XP needed to go from `level` to level + 1 (RoR2-like exponential curve).
export function xpToNext(level) {
  return Math.round(60 * 1.5 ** (level - 1));
}
