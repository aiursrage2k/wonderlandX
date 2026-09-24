// Stacking items, Risk-of-Rain style. Stats are recomputed from the inventory;
// on-hit / on-kill procs are read by combat code via count(id).

export const RARITY = {
  common: { label: 'Common', color: '#e8e4dc' },
  uncommon: { label: 'Uncommon', color: '#7ee07e' },
  legendary: { label: 'Legendary', color: '#ff5a5a' },
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
  { id: 'top_hat', name: "Hatter's Top Hat", rarity: 'uncommon', icon: '🎩', desc: '+1 extra jump.' },
  { id: 'jubjub', name: 'Jubjub Feather', rarity: 'uncommon', icon: '🪶', desc: '10% chance on hit to loose a homing feather for 300% damage.' },
  { id: 'cheshire', name: 'Cheshire Tooth', rarity: 'uncommon', icon: '😸', desc: '20% chance on hit to arc a grin-bolt to 3 enemies for 80% damage.' },
  { id: 'kettle', name: 'Boiling Kettle', rarity: 'uncommon', icon: '🫖', desc: 'Kills erupt in scalding tea for 150% damage in 4m (+2m per stack).' },
  { id: 'decree', name: "Queen's Decree", rarity: 'uncommon', icon: '📜', desc: 'Skill cooldowns -15%. +1 Teapot charge.' },
  { id: 'mirror', name: 'Looking-Glass Shard', rarity: 'uncommon', icon: '🪞', desc: '15% chance to throw a mirrored extra card.' },
  { id: 'vorpal', name: 'The Vorpal Blade', rarity: 'legendary', icon: '⚔️', desc: 'Every 5th throw is a piercing vorpal blade for 600% damage.' },
  { id: 'unbirthday', name: 'Unbirthday Present', rarity: 'legendary', icon: '🎁', desc: 'Upon death, wake up and keep going. Consumed.' },
  { id: 'jabberwock', name: "Jabberwock's Heart", rarity: 'legendary', icon: '🐉', desc: 'Damage +60%. Max health +40.' },
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
      jumps: 1 + c('top_hat'),
      cdMult: 0.85 ** c('decree'),
      teapotCharges: 1 + c('decree'),
    };
  }
}
