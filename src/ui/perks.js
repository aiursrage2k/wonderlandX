// Perk upgrade screen: gold → permanent ranks for this run.

import { PERKS, perkCost } from '../game/items.js';
import { sfx } from '../engine/audio.js';

const $ = (id) => document.getElementById(id);

export function renderPerks(game) {
  const p = game.player;
  const coeff = game.difficulty();
  $('perk-gold').textContent = p.gold;
  const list = $('perk-list');
  list.innerHTML = '';
  for (const perk of PERKS) {
    const rank = p.perks[perk.id] || 0;
    const maxed = rank >= perk.max;
    const cost = perkCost(rank, coeff);
    const row = document.createElement('div');
    row.className = 'perk';
    row.innerHTML = `
      <div class="perk-icon">${perk.icon}</div>
      <div>
        <div class="perk-name">${perk.name} <span style="color:#b8a890;font-size:12px">${rank}/${perk.max}</span></div>
        <div class="perk-per">${perk.per} per rank</div>
        <div class="pips">${Array.from({ length: perk.max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      <button ${maxed || p.gold < cost ? 'disabled' : ''}>${maxed ? 'Max' : `◈ ${cost}`}</button>`;
    row.querySelector('button').onclick = () => {
      const c = perkCost(p.perks[perk.id] || 0, game.difficulty());
      if (p.gold < c || (p.perks[perk.id] || 0) >= perk.max) return;
      p.gold -= c;
      p.perks[perk.id] = (p.perks[perk.id] || 0) + 1;
      const before = p.stats.maxHp;
      p.recompute();
      if (p.stats.maxHp > before) p.hp += p.stats.maxHp - before;
      game.hud.goldPop(-c);
      sfx('chest');
      const msg = $('perk-msg');
      msg.textContent = `${perk.icon} ${perk.name} rank ${p.perks[perk.id]}: ${perk.per}.`;
      msg.classList.remove('pop');
      void msg.offsetWidth;
      msg.classList.add('pop');
      renderPerks(game);
    };
    list.appendChild(row);
  }
}
