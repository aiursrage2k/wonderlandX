// DOM HUD: bars, minimap, skills, items, floating numbers, banners.

import * as THREE from 'three';
import { ITEM_BY_ID, RARITY, xpToNext, PERKS } from '../game/items.js';
import { SKILLS } from '../game/player.js';
import { TAU } from '../engine/util.js';
import { TIERS } from '../game/enemies.js';

const $ = (id) => document.getElementById(id);
const proj = new THREE.Vector3();

// ── painted icons ──
function drawPortrait(c) {
  const x = c.getContext('2d');
  const W = c.width;
  const bg = x.createRadialGradient(W / 2, W * 0.4, 5, W / 2, W / 2, W * 0.7);
  bg.addColorStop(0, '#5a3a7a');
  bg.addColorStop(1, '#120a1c');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, W);
  // back hair
  x.fillStyle = '#c89a3a';
  x.beginPath();
  x.ellipse(W / 2, W * 0.62, W * 0.36, W * 0.46, 0, 0, TAU);
  x.fill();
  // shoulders / dress
  x.fillStyle = '#2e4fa8';
  x.beginPath();
  x.ellipse(W / 2, W * 1.05, W * 0.45, W * 0.3, 0, 0, TAU);
  x.fill();
  x.fillStyle = '#eee';
  x.beginPath();
  x.moveTo(W * 0.38, W * 0.82);
  x.lineTo(W / 2, W * 0.95);
  x.lineTo(W * 0.62, W * 0.82);
  x.lineTo(W * 0.6, W);
  x.lineTo(W * 0.4, W);
  x.fill();
  // face
  const fg = x.createRadialGradient(W * 0.47, W * 0.45, 4, W / 2, W / 2, W * 0.26);
  fg.addColorStop(0, '#fbe6d8');
  fg.addColorStop(1, '#d9aa98');
  x.fillStyle = fg;
  x.beginPath();
  x.ellipse(W / 2, W * 0.5, W * 0.2, W * 0.25, 0, 0, TAU);
  x.fill();
  // eyes
  for (const s of [-1, 1]) {
    x.fillStyle = '#fff';
    x.beginPath();
    x.ellipse(W / 2 + s * W * 0.08, W * 0.5, W * 0.045, W * 0.03, 0, 0, TAU);
    x.fill();
    x.fillStyle = '#2e5ab8';
    x.beginPath();
    x.arc(W / 2 + s * W * 0.08, W * 0.5, W * 0.025, 0, TAU);
    x.fill();
    x.fillStyle = '#000';
    x.beginPath();
    x.arc(W / 2 + s * W * 0.08, W * 0.5, W * 0.011, 0, TAU);
    x.fill();
    x.strokeStyle = '#3a2010';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(W / 2 + s * W * 0.03, W * 0.44);
    x.lineTo(W / 2 + s * W * 0.13, W * 0.43);
    x.stroke();
  }
  x.fillStyle = '#b0505a';
  x.beginPath();
  x.ellipse(W / 2, W * 0.64, W * 0.035, W * 0.012, 0, 0, TAU);
  x.fill();
  // fringe
  x.fillStyle = '#e8c46a';
  x.beginPath();
  x.moveTo(W * 0.28, W * 0.5);
  x.quadraticCurveTo(W * 0.25, W * 0.18, W / 2, W * 0.2);
  x.quadraticCurveTo(W * 0.75, W * 0.18, W * 0.72, W * 0.5);
  x.quadraticCurveTo(W * 0.66, W * 0.3, W * 0.52, W * 0.34);
  x.quadraticCurveTo(W * 0.4, W * 0.3, W * 0.28, W * 0.5);
  x.fill();
  // bow
  x.fillStyle = '#111';
  x.beginPath();
  x.moveTo(W / 2, W * 0.2);
  x.lineTo(W * 0.32, W * 0.1);
  x.lineTo(W * 0.34, W * 0.26);
  x.fill();
  x.beginPath();
  x.moveTo(W / 2, W * 0.2);
  x.lineTo(W * 0.68, W * 0.1);
  x.lineTo(W * 0.66, W * 0.26);
  x.fill();
}

function frameBg(x, W, c1, c2) {
  const g = x.createRadialGradient(W / 2, W / 2, 4, W / 2, W / 2, W * 0.7);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  x.fillStyle = g;
  x.fillRect(0, 0, W, W);
}

const SKILL_ICONS = [
  (x, W) => {
    frameBg(x, W, '#6a3a20', '#140a0a');
    x.save();
    x.translate(W / 2, W * 0.62);
    for (let i = 0; i < 5; i++) {
      x.save();
      x.rotate(-0.7 + i * 0.35);
      x.fillStyle = '#f2e6d0';
      x.strokeStyle = '#6a2010';
      x.lineWidth = 2;
      x.fillRect(-10, -48, 20, 30);
      x.strokeRect(-10, -48, 20, 30);
      x.fillStyle = '#b0101e';
      x.font = '14px serif';
      x.textAlign = 'center';
      x.fillText('♥', 0, -28);
      x.restore();
    }
    x.restore();
    x.strokeStyle = 'rgba(255,200,120,0.9)';
    x.lineWidth = 3;
    x.beginPath();
    x.arc(W / 2, W * 0.95, W * 0.62, -2.4, -0.75);
    x.stroke();
  },
  (x, W) => {
    frameBg(x, W, '#5a4a70', '#0e0a14');
    x.fillStyle = '#efe8dc';
    x.beginPath();
    x.ellipse(W / 2, W * 0.58, W * 0.26, W * 0.2, 0, 0, TAU);
    x.fill();
    x.fillRect(W * 0.42, W * 0.34, W * 0.16, W * 0.06);
    x.beginPath();
    x.arc(W / 2, W * 0.33, W * 0.05, 0, TAU);
    x.fill();
    x.strokeStyle = '#efe8dc';
    x.lineWidth = 6;
    x.beginPath();
    x.moveTo(W * 0.74, W * 0.58);
    x.quadraticCurveTo(W * 0.9, W * 0.5, W * 0.88, W * 0.38);
    x.stroke();
    x.beginPath();
    x.arc(W * 0.22, W * 0.58, W * 0.1, Math.PI * 0.5, Math.PI * 1.5);
    x.stroke();
    x.fillStyle = '#3f5aa8';
    x.beginPath();
    x.arc(W / 2, W * 0.58, W * 0.07, 0, TAU);
    x.fill();
    x.fillStyle = 'rgba(255,170,80,0.8)';
    for (let i = 0; i < 3; i++) {
      x.beginPath();
      x.arc(W * (0.8 + i * 0.05), W * (0.3 - i * 0.07), 3 + i, 0, TAU);
      x.fill();
    }
  },
  (x, W) => {
    frameBg(x, W, '#3a4a9a', '#0a0a18');
    x.fillStyle = '#eef';
    x.save();
    x.translate(W * 0.52, W * 0.55);
    x.beginPath();
    x.arc(0, -W * 0.25, W * 0.08, 0, TAU);
    x.fill();
    x.lineCap = 'round';
    x.strokeStyle = '#eef';
    x.lineWidth = 9;
    x.beginPath();
    x.moveTo(0, -W * 0.15);
    x.lineTo(-W * 0.06, W * 0.05);
    x.lineTo(-W * 0.24, W * 0.12);
    x.moveTo(-W * 0.06, W * 0.05);
    x.lineTo(W * 0.12, W * 0.2);
    x.moveTo(-W * 0.02, -W * 0.1);
    x.lineTo(W * 0.2, -W * 0.02);
    x.moveTo(-W * 0.02, -W * 0.1);
    x.lineTo(-W * 0.22, -W * 0.05);
    x.stroke();
    x.restore();
    x.strokeStyle = 'rgba(180,200,255,0.6)';
    x.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      x.beginPath();
      x.moveTo(W * 0.08, W * (0.35 + i * 0.12));
      x.lineTo(W * 0.28, W * (0.35 + i * 0.12));
      x.stroke();
    }
  },
  (x, W) => {
    frameBg(x, W, '#7a2ac0', '#12041e');
    x.shadowColor = '#d080ff';
    x.shadowBlur = 16;
    x.fillStyle = '#1a0628';
    x.beginPath();
    x.ellipse(W / 2, W * 0.66, W * 0.2, W * 0.17, 0, 0, TAU);
    x.fill();
    for (const s of [-1, 1]) {
      x.beginPath();
      x.ellipse(W / 2 + s * W * 0.1, W * 0.34, W * 0.06, W * 0.22, s * 0.25, 0, TAU);
      x.fill();
    }
    x.shadowBlur = 0;
    x.fillStyle = '#ff40a0';
    for (const s of [-1, 1]) {
      x.beginPath();
      x.arc(W / 2 + s * W * 0.07, W * 0.63, W * 0.03, 0, TAU);
      x.fill();
    }
  },
  (x, W) => {
    frameBg(x, W, '#4a3a70', '#0c0816');
    x.strokeStyle = '#e8dcff';
    x.lineWidth = 7;
    x.lineCap = 'round';
    x.beginPath();
    x.arc(W / 2, W / 2, W * 0.26, -0.3, Math.PI * 1.55);
    x.stroke();
    x.fillStyle = '#e8dcff';
    x.beginPath();
    x.moveTo(W * 0.78, W * 0.33);
    x.lineTo(W * 0.9, W * 0.52);
    x.lineTo(W * 0.66, W * 0.5);
    x.fill();
    x.beginPath();
    x.arc(W / 2, W / 2, W * 0.08, 0, TAU);
    x.fill();
  }
];

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = $('hud');
    drawPortrait($('portrait'));
    this.skills = [...document.querySelectorAll('.skill')].map((el, i) => {
      SKILL_ICONS[i](el.querySelector('canvas').getContext('2d'), 96);
      el.title = `${SKILLS[i].name} — ${SKILLS[i].desc}`;
      return { el, cd: el.querySelector('.cd'), charges: el.querySelector('.charges') };
    });
    this.map = $('minimap').getContext('2d');
    this.nums = [];
    this.numPool = [];
    this.barEls = new Map();
    this.hurtV = 0;
    this.bannerT = 0;
    this.hitT = 0;
    this.last = {};
  }

  show(v) {
    this.el.classList.toggle('hidden', !v);
  }

  setText(id, v) {
    if (this.last[id] !== v) {
      this.last[id] = v;
      $(id).textContent = v;
    }
  }

  setStage(name, depth) {
    this.setText('stage-name', name);
    this.setText('depth', `Depth ${String(depth).padStart(2, '0')}`);
  }

  damageFlash(k) {
    this.hurtV = Math.min(1, this.hurtV + 0.4 + k);
  }

  levelFlash() {
    const b = $('lvl');
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
  }

  hitMarker(crit) {
    this.hitT = 0.12;
    const c = $('crosshair');
    c.classList.add('hit');
    c.classList.toggle('crit', crit);
  }

  goldPop(n) {
    // merge rapid pickups into one rising number
    const now = performance.now();
    if (this.goldEl && now - this.goldT < 350) {
      this.goldSum += n;
      this.goldEl.textContent = this.goldSum >= 0 ? `+${this.goldSum}` : `${this.goldSum}`;
      return;
    }
    const d = document.createElement('div');
    d.className = 'goldpop';
    d.textContent = n >= 0 ? `+${n}` : `${n}`;
    if (n < 0) d.style.color = '#ff8080';
    $('goldpops').appendChild(d);
    this.goldEl = d;
    this.goldSum = n;
    this.goldT = now;
    setTimeout(() => d.remove(), 1000);
  }

  banner(name, desc, color, icon) {
    const b = $('banner');
    b.classList.remove('hidden');
    b.style.setProperty('--bc', color);
    b.querySelector('.name').textContent = name;
    b.querySelector('.desc').textContent = desc;
    b.querySelector('.icon').textContent = icon || '';
    // restart animation
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    this.bannerT = 3.5;
  }

  // Big centred warning naming an incoming boss attack.
  warn(title, hint, t = 1.2) {
    const w = $('warn');
    w.innerHTML = `⚠ ${title}${hint ? `<small>${hint}</small>` : ''}`;
    w.classList.remove('hidden');
    this.warnT = t;
  }

  prompt(html) {
    const p = $('prompt');
    if (!html) {
      p.classList.add('hidden');
      this.last.prompt = '';
      return;
    }
    p.classList.remove('hidden');
    if (this.last.prompt !== html) {
      this.last.prompt = html;
      p.innerHTML = html;
    }
  }

  itemEl(id, n) {
    const it = ITEM_BY_ID[id];
    const d = document.createElement('div');
    d.className = 'item';
    d.style.setProperty('--rc', RARITY[it.rarity].color);
    d.innerHTML = `${it.icon}${n > 1 ? `<span class="n">×${n}</span>` : ''}<div class="tip"><b>${it.name}</b>${it.desc}</div>`;
    return d;
  }

  perkEl(perk, rank) {
    const d = document.createElement('div');
    d.className = 'item perk-item';
    d.innerHTML = `${perk.icon}<span class="n">${rank}</span><div class="tip"><b>${perk.name} — rank ${rank}/${perk.max}</b>${perk.per} per rank.</div>`;
    return d;
  }

  // Items first, then perks, RoR2-style: icon plus a count / rank badge.
  updateItems(inv = this.game.player.inv) {
    const perks = this.game.player?.perks || {};
    for (const host of [$('items'), $('pause-items')]) {
      host.innerHTML = '';
      for (const id of inv.order) host.appendChild(this.itemEl(id, inv.count(id)));
      for (const perk of PERKS) if (perks[perk.id]) host.appendChild(this.perkEl(perk, perks[perk.id]));
    }
  }

  number(pos, value, kind = 'normal') {
    let el = this.numPool.pop();
    if (!el) {
      el = document.createElement('div');
      $('numbers').appendChild(el);
    }
    el.className = `dmg ${kind}`;
    el.textContent = kind === 'heal' ? `+${value}` : value;
    el.style.display = '';
    this.nums.push({ el, pos: pos.clone(), vy: 2.2, vx: (Math.random() - 0.5) * 1.5, t: 0, life: kind === 'crit' ? 1.0 : 0.8 });
    if (this.nums.length > 90) this.killNum(this.nums.shift());
  }

  killNum(n) {
    n.el.style.display = 'none';
    this.numPool.push(n.el);
  }

  toScreen(v, cam, W, H) {
    proj.copy(v).project(cam);
    if (proj.z > 1) return null;
    return { x: (proj.x * 0.5 + 0.5) * W, y: (-proj.y * 0.5 + 0.5) * H };
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const cam = g.camera;
    const W = window.innerWidth;
    const H = window.innerHeight;

    // bars
    const hpk = Math.max(0, p.hp / p.stats.maxHp);
    $('hp-fill').style.transform = `scaleX(${hpk})`;
    $('hp-ghost').style.transform = `scaleX(${hpk})`;
    this.setText('hp-text', `${Math.ceil(p.hp)} / ${Math.round(p.stats.maxHp)}`);
    $('corr-fill').style.transform = `scaleX(${p.corruption / 100})`;
    $('corr-fill').parentElement.classList.toggle('ready', p.corruption >= 50);
    this.setText('gold-text', String(p.gold));
    $('xp-fill').style.transform = `scaleX(${Math.min(1, p.xp / xpToNext(p.level))})`;
    this.setText('lvl', String(p.level));

    // timer & difficulty
    const t = g.runTime;
    this.setText('timer', `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
    const d = g.difficulty();
    const names = ['Curious', 'Curiouser', 'Peculiar', 'Mad', 'Mad as a Hatter', 'Off With Her Head', 'Unbirthday'];
    const di = Math.min(names.length - 1, Math.floor((d - 1) / 0.5));
    this.setText('diff-name', names[di]);
    // the bar fills toward the next difficulty name
    $('diff-fill').style.width = `${Math.min(100, (((d - 1) / 0.5) % 1) * 100)}%`;

    // skills
    const st = p.stats;
    const cds = [
      { k: 1, txt: '' },
      { k: p.teapotCharges > 0 ? 1 : p.teapotT / (5 * st.cdMult), txt: p.teapotCharges > 0 ? '' : Math.ceil(5 * st.cdMult - p.teapotT), charges: st.teapotCharges > 1 ? p.teapotCharges : '' },
      { k: 1 - p.dashCd / (4.5 * st.cdMult), txt: p.dashCd > 0 ? Math.ceil(p.dashCd) : '' },
      { k: p.madness > 0 ? p.madness / p.madnessMax : Math.min(1, p.corruption / 50), txt: p.madness > 0 ? '' : p.corruption >= 50 ? '' : `${Math.floor(p.corruption)}%` },
      { k: 1 - (p.rollCd || 0) / (1.2 * st.cdMult), txt: p.rollCd > 0 ? (p.rollCd).toFixed(1) : '' },
    ];
    cds.forEach((c, i) => {
      const s = this.skills[i];
      const ready = c.txt === '';
      s.cd.style.display = ready ? 'none' : '';
      if (!ready) {
        s.cd.style.background = `linear-gradient(to top, rgba(5,2,8,0.35) ${c.k * 100}%, rgba(5,2,8,0.78) ${c.k * 100}%)`;
        if (s.lastTxt !== c.txt) {
          s.cd.textContent = c.txt;
          s.lastTxt = c.txt;
        }
      }
      s.charges.textContent = c.charges || '';
      s.el.classList.toggle('flash', i === 3 && p.madness > 0);
    });

    // vignettes
    this.hurtV = Math.max(0, this.hurtV - dt * 2.2);
    const low = hpk < 0.3 ? (0.3 - hpk) * 1.5 * (0.7 + 0.3 * Math.sin(g.time * 6)) : 0;
    $('vignette-hurt').style.opacity = Math.min(1, this.hurtV + low);
    $('vignette-mad').style.opacity = p.madness > 0 ? 0.8 : 0;

    // crosshair
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0) $('crosshair').classList.remove('hit', 'crit');
    }

    if (this.warnT > 0) {
      this.warnT -= dt;
      if (this.warnT <= 0) $('warn').classList.add('hidden');
    }

    // banner
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) $('banner').classList.add('hidden');
    }

    // floating numbers
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      n.pos.y += n.vy * dt;
      n.vy -= 3 * dt;
      const s = this.toScreen(n.pos, cam, W, H);
      if (!s || n.t > n.life) {
        this.killNum(n);
        this.nums.splice(i, 1);
        continue;
      }
      const k = n.t / n.life;
      const pop = n.t < 0.08 ? 1 + (0.08 - n.t) * 8 : 1;
      n.el.style.transform = `translate(${s.x + n.vx * n.t * 30}px, ${s.y}px) translate(-50%,-50%) scale(${pop})`;
      n.el.style.opacity = k > 0.6 ? (1 - k) / 0.4 : 1;
    }

    // enemy health bars
    const seen = new Set();
    for (const e of g.enemies) {
      if (!e.alive || e.boss) continue;
      if (e.hp >= e.maxHp && !e.elite) continue;
      if (e.pos.distanceToSquared(p.pos) > 50 * 50) continue;
      const s = this.toScreen(proj.set(e.pos.x, e.pos.y + (e.flying ? 1.1 : e.height * e.scale + 0.35), e.pos.z), cam, W, H);
      if (!s) continue;
      seen.add(e);
      let b = this.barEls.get(e);
      if (!b) {
        const el = document.createElement('div');
        el.className = 'ebar';
        const tn = TIERS[e.tier || 0];
        const label = `<span class="lv">Lv ${e.level}</span> ${e.elite ? `<span style="color:${e.elite.color}">${e.elite.name}</span> ` : ''}${tn.name ? `<span style="color:${tn.color}">${tn.name}</span> ` : ''}${e.elite || e.tier ? e.name : ''}`;
        el.innerHTML = `<div class="f"></div><div class="nm">${label}</div>`;
        $('bars').appendChild(el);
        b = { el, f: el.firstChild };
        this.barEls.set(e, b);
      }
      b.el.style.transform = `translate(${s.x - 32}px, ${s.y}px)`;
      b.f.style.transform = `scaleX(${Math.max(0, e.hp / e.maxHp)})`;
    }
    for (const [e, b] of this.barEls) {
      if (!seen.has(e)) {
        b.el.remove();
        this.barEls.delete(e);
      }
    }

    // boss bar: the main boss up top, any other bosses (the court) beneath
    const bosses = g.enemies.filter((e) => e.boss && e.alive);
    const boss = g.boss && g.boss.alive ? g.boss : bosses[0];
    $('bossbar').classList.toggle('hidden', !boss);
    if (boss) {
      this.setText('boss-name', boss.name);
      this.setText('boss-sub', boss.subtitle);
      $('boss-fill').style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
    }
    const others = bosses.filter((e) => e !== boss);
    const ex = $('boss-extra');
    const key = others.map((e) => e.name).join('|');
    if (ex.dataset.key !== key) {
      ex.dataset.key = key;
      ex.innerHTML = others.map((e) => `<div class="mini-boss"><span>${e.name}</span><div class="bar"><div class="fill"></div></div></div>`).join('');
    }
    ex.querySelectorAll('.fill').forEach((f, i) => {
      const e = others[i];
      if (e) f.style.transform = `scaleX(${Math.max(0, e.hp / e.maxHp)})`;
    });

    // objective + charge
    const tp = g.teleporter;
    let obj = tp.discovered ? 'Touch the Looking Glass (♥ on the map)' : 'Find the Looking Glass — explore the garden';
    if (tp.state === 'sealed') obj = `Break the seals — ${tp.broken} / ${tp.sealCount} · slay ${tp.killsPerSeal - (tp.sealKills % tp.killsPerSeal)} more`;
    if (tp.state === 'charging' || tp.state === 'charged') obj = `Defeat ${g.boss ? g.boss.name : 'the boss'}`;
    if (tp.state === 'ready') obj = 'Step through the Looking Glass';
    if (g.world.theme.final) {
      const c = tp.court;
      if (tp.state === 'idle') obj = tp.discovered ? 'Touch the Queen’s Mirror before the throne — the final battle' : 'Approach the throne';
      else if (c && c.phase === 1) obj = `Defeat the Queen’s Court — ${c.members.filter((e) => e.alive).length} remain`;
      else if (c && c.phase < 4) obj = 'Shatter the Crimson Queen’s heart';
      else if (c) obj = 'Wonderland falls silent…';
    }
    this.setText('objective', obj);
    const charging = tp.state === 'charging';
    $('charge').classList.toggle('hidden', !charging);
    if (charging) {
      $('charge-fill').style.transform = `scaleX(${tp.charge})`;
      this.setText('charge-text', tp.inZone ? `Glass resonance ${Math.floor(tp.charge * 100)}% — full charge grants a gift` : 'Stand by the Glass to charge a bonus gift');
    }

    this.drawMap();
  }

  drawMap() {
    const g = this.game;
    const x = this.map;
    const S = 220;
    const R = S / 2;
    const scale = R / 55; // world units shown to the edge
    const p = g.player;
    x.clearRect(0, 0, S, S);
    x.save();
    x.beginPath();
    x.rect(0, 0, S, S);
    x.clip();
    x.fillStyle = 'rgba(14,8,20,0.9)';
    x.fillRect(0, 0, S, S);
    // camera-forward is up: project world offsets onto the camera's right/forward
    const sy = Math.sin(p.camYaw);
    const cy = Math.cos(p.camYaw);
    const m = (wx, wz) => {
      const dx = wx - p.pos.x;
      const dz = wz - p.pos.z;
      return [R + (-dx * cy + dz * sy) * scale, R - (dx * sy + dz * cy) * scale];
    };
    const glyph = (wx, wz, ch, size, color, glow) => {
      const [cx, cz] = m(wx, wz);
      x.save();
      x.font = `${size}px serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      if (color) x.fillStyle = color;
      if (glow) {
        x.shadowColor = glow;
        x.shadowBlur = 8;
      }
      x.fillText(ch, Math.max(8, Math.min(S - 8, cx)), Math.max(8, Math.min(S - 8, cz)));
      x.restore();
    };
    x.lineWidth = 2;
    for (const pl of g.world.plazas) {
      const [cx, cz] = m(pl.x, pl.z);
      x.fillStyle = 'rgba(90,80,100,0.45)';
      x.strokeStyle = 'rgba(150,140,160,0.6)';
      x.beginPath();
      x.arc(cx, cz, pl.r * scale, 0, TAU);
      x.fill();
      x.stroke();
    }
    for (const it of g.interactables) {
      if (it.used) continue;
      if (it.kind === 'shop') {
        glyph(it.pos.x, it.pos.z, '⚖', 17, '#ffd24a', '#ffb000');
        continue;
      }
      const [cx, cz] = m(it.pos.x, it.pos.z);
      x.fillStyle = it.kind === 'tin' ? '#a08040' : it.kind === 'shrine' ? '#60e0ff' : it.kind === 'perkchest' ? '#c070ff' : it.big ? '#ff5060' : '#ffd060';
      x.fillRect(cx - 3, cz - 3, 6, 6);
    }
    for (const it of g.pickups) {
      const [cx, cz] = m(it.pos.x, it.pos.z);
      x.fillStyle = it.color;
      x.beginPath();
      x.arc(cx, cz, 3.5, 0, TAU);
      x.fill();
    }
    const gp = g.world.glassPos;
    if (g.teleporter.discovered) glyph(gp.x, gp.z, '♥', 20, g.teleporter.state === 'ready' ? '#ffffff' : '#ff2a4a', '#ff2a4a');
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (e.boss) {
        glyph(e.pos.x, e.pos.z, '💀', 16);
        continue;
      }
      const [cx, cz] = m(e.pos.x, e.pos.z);
      x.fillStyle = e.elite ? e.elite.color : '#e02030';
      x.beginPath();
      x.arc(cx, cz, e.elite ? 3.5 : 2.5, 0, TAU);
      x.fill();
    }
    x.restore();
    // player arrow (always up)
    x.fillStyle = '#ffffff';
    x.save();
    x.translate(R, R);
    x.rotate(p.camYaw - p.yaw);
    x.beginPath();
    x.moveTo(0, -8);
    x.lineTo(5, 6);
    x.lineTo(0, 3);
    x.lineTo(-5, 6);
    x.closePath();
    x.fill();
    x.restore();
    // vignette ring
    const vg = x.createRadialGradient(R, R, R * 0.6, R, R, R * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.7)');
    x.fillStyle = vg;
    x.fillRect(0, 0, S, S);
  }
}
