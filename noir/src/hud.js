// In-game HUD: grit, flasks, the City Color meter, objective, minimap,
// captions (who said what), boss bar, floaters and off-screen pointers.
import * as THREE from 'three';
import { CAST } from './story.js';
import { drawCityMap, L, C } from './city.js';
import { paintCanvas, PAINT } from './paint.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const el = {
    hud: $('hud'), grit: $('grit-fill'), flasks: $('flasks'), carRow: $('car-row'), car: $('car-fill'),
    caseNo: $('case-no'), caseTitle: $('case-title'), objText: $('obj-text'), objProg: $('obj-prog'),
    bossbar: $('bossbar'), bossName: $('boss-name'), bossFill: $('boss-fill'), bossSub: $('boss-sub'),
    bleed: $('bleed-fill'), bleedPct: $('bleed-pct'), bleedBar: document.querySelector('.bar.bleed'),
    captions: $('captions'), hint: $('hint'), floaters: $('floaters'), pointers: $('pointers'),
    sally: $('sally-fill'), sallyState: $('sally-state'), ptMack: $('pt-mack'), ptSally: $('pt-sally'),
    stomach: $('stomach'), boost: $('boost-fill'),
    ammo: $('ammo'), pillsN: $('pills-n'), colorWarn: $('color-warn'), focus: $('focus-fill'),
    vigHurt: $('vig-hurt'), vigFocus: $('vig-focus'), mini: $('minimap'), stamp: $('stamp'),
  };
  const mctx = el.mini.getContext('2d');
  let mapImg = null;
  const floaters = [];
  const caps = [];
  let hurtT = 0, lastFlasks = -1, lastAmmo = -1;
  const v = new THREE.Vector3();

  function show(on) { el.hud.classList.toggle('hidden', !on); }

  function say(who, text, dur = 3.5) {
    const c = CAST[who] || { name: who, cls: 'dame' };
    const d = document.createElement('div');
    d.className = 'cap';
    d.innerHTML = `${c.name ? `<b class="who-${c.cls}">${c.name}</b>` : ''}<span class="who-${c.cls}">${text}</span>`;
    const wrap = document.createElement('div');
    wrap.appendChild(d);
    el.captions.appendChild(wrap);
    caps.push({ wrap, t: dur + text.length * 0.02 });
    while (caps.length > 3) caps.shift().wrap.remove();
  }

  function stamp(text) {
    el.stamp.textContent = text;
    el.stamp.classList.remove('hidden');
    el.stamp.style.animation = 'none';
    void el.stamp.offsetWidth;
    el.stamp.style.animation = '';
    clearTimeout(stamp.t);
    stamp.t = setTimeout(() => el.stamp.classList.add('hidden'), 1500);
  }

  function floater(pos, text) {
    const d = document.createElement('div');
    d.textContent = text;
    el.floaters.appendChild(d);
    floaters.push({ d, pos: pos.clone(), t: 1.4 });
  }

  function update(s) {
    const dt = 1 / 60;
    el.grit.style.transform = `scaleX(${Math.max(0, s.hp)})`;
    if (s.flasks !== lastFlasks) {
      lastFlasks = s.flasks;
      el.flasks.innerHTML = '';
      for (let i = 0; i < s.maxFlasks; i++) { const f = document.createElement('div'); f.className = 'flask' + (i < s.flasks ? '' : ' empty'); el.flasks.appendChild(f); }
    }
    if (s.ammo !== lastAmmo) {
      lastAmmo = s.ammo;
      el.ammo.innerHTML = '';
      for (let i = 0; i < 6; i++) { const r = document.createElement('div'); r.className = 'round' + (i < s.ammo ? '' : ' spent'); el.ammo.appendChild(r); }
    }
    el.ammo.classList.toggle('reloading', !!s.reloading);
    el.pillsN.textContent = s.pills ?? 0;
    el.colorWarn.classList.toggle('hidden', !s.seeColor);
    el.focus.style.transform = `scaleX(${s.focusMeter ?? 1})`;
    el.sally.style.transform = `scaleX(${s.sallyDown ? 0 : s.sallyHp ?? 1})`;
    el.sallyState.textContent = s.sallyDown ? '· AT THE BAR' : '';
    el.ptSally.classList.toggle('down', !!s.sallyDown);
    el.carRow.classList.toggle('hidden', !s.inCar);
    el.car.style.transform = `scaleX(${s.carHp})`;
    el.boost.style.transform = `scaleX(${s.boost ?? 1})`;
    el.bleed.style.transform = `scaleX(${s.bleed})`;
    el.bleedPct.textContent = `${Math.round(s.bleed * 100)}%`;
    el.bleedBar.classList.toggle('warn', s.bleed > 0.75);
    const st = s.bleed < 0.35 ? 0 : s.bleed < 0.6 ? 1 : s.bleed < 0.85 ? 2 : 3;
    el.stomach.textContent = ['FINE', 'QUEASY', 'GREEN', 'ABOUT TO BLOW'][st];
    el.stomach.className = st ? `s${st}` : '';
    hurtT = Math.max(0, hurtT - dt * 1.5);
    el.vigHurt.style.opacity = Math.max(hurtT, s.hp < 0.3 ? 0.35 + Math.sin(s.time * 5) * 0.15 : 0);
    el.vigFocus.style.opacity = s.focus ? 1 : 0;
    el.hint.textContent = s.hint || '';
    // captions
    for (let i = caps.length - 1; i >= 0; i--) {
      caps[i].t -= dt;
      if (caps[i].t < 0.4) caps[i].wrap.style.opacity = Math.max(0, caps[i].t / 0.4);
      if (caps[i].t <= 0) { caps[i].wrap.remove(); caps.splice(i, 1); }
    }
    // floaters
    const w = innerWidth, h = innerHeight;
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.t -= dt;
      v.set(f.pos.x, 3 + (1.4 - f.t) * 3, f.pos.z).project(s.camera);
      f.d.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      f.d.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      f.d.style.opacity = Math.min(1, f.t);
      if (f.t <= 0) { f.d.remove(); floaters.splice(i, 1); }
    }
    enemyBars(s, w, h);
    pointers(s, w, h);
    minimap(s);
  }

  // rainbow health bars over anyone hurt but still standing
  const barEls = [];
  const ebars = document.getElementById('ebars');
  function enemyBars(s, w, h) {
    const list = [];
    for (const e of s.enemies) if (!e.dead && e.hp < e.maxHp && e.type !== 'boss' && !(e.emerge > 0)) list.push([e.pos, e.hp / e.maxHp, e.type === 'copter' ? 26 : e.type === 'roomba' || e.type === 'truck' ? 7 : e.type === 'lowrider' ? 4.5 : 3.4 * (e.model.root.scale.x || 1), e.type === 'roomba' || e.type === 'truck' || e.type === 'copter' ? 70 : 40]);
    for (const p of s.portals) if (p.hp < p.maxHp) list.push([p.pos, p.hp / p.maxHp, 13, 80]);
    while (barEls.length < Math.min(list.length, 30)) { const d = document.createElement('div'); d.appendChild(document.createElement('i')); ebars.appendChild(d); barEls.push(d); }
    barEls.forEach((d, i) => {
      const it = list[i];
      if (!it) { d.style.display = 'none'; return; }
      v.set(it[0].x, it[2], it[0].z).project(s.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { d.style.display = 'none'; return; }
      d.style.display = 'block';
      d.style.left = `${(v.x * 0.5 + 0.5) * w}px`; d.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      d.style.width = `${it[3]}px`;
      d.style.setProperty('--w', `${it[3]}px`);
      d.firstChild.style.width = `${Math.max(0, it[1]) * 100}%`;
    });
  }

  // arrows at the screen edge for portals and the boss
  const ptrEls = [];
  function pointers(s, w, h) {
    // every goon gets a small arrow in his own color; objectives get big ones
    const targets = [];
    for (const o of s.objectives || []) targets.push([o, o.c, 1.4]);
    for (const p of s.portals) targets.push([p.pos, '#ff2d95', 1.3]);
    if (s.boss) targets.push([s.boss.pos, '#ffe11a', 1.5]);
    const pl = s.player;
    const goons = s.enemies.filter((e) => e.type !== 'boss' && Math.abs(e.pos.x - pl.x) + Math.abs(e.pos.z - pl.z) < 220)
      .sort((a, b) => (Math.abs(a.pos.x - pl.x) + Math.abs(a.pos.z - pl.z)) - (Math.abs(b.pos.x - pl.x) + Math.abs(b.pos.z - pl.z))).slice(0, 18);
    for (const e of goons) targets.push([e.pos, e.color, e.type === 'roomba' || e.type === 'truck' ? 1.1 : 0.65]);
    while (ptrEls.length < targets.length) { const d = document.createElement('div'); el.pointers.appendChild(d); ptrEls.push(d); }
    ptrEls.forEach((d, i) => {
      const t = targets[i];
      if (!t) { d.style.display = 'none'; return; }
      v.set(t[0].x, 2, t[0].z).project(s.camera);
      d.style.scale = t[2];
      const on = Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9 && v.z < 1;
      if (on) { d.style.display = 'none'; return; }
      let x = v.x, y = v.y;
      if (v.z > 1) { x = -x; y = -y; }
      const m = Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.82);
      x /= m; y /= m;
      d.style.display = 'block';
      d.style.left = `${(x * 0.5 + 0.5) * w - 10}px`;
      d.style.top = `${(-y * 0.5 + 0.5) * h - 11}px`;
      d.style.borderBottomColor = t[1];
      d.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
    });
  }

  function minimap(s) {
    const W = 200, R = 70; // world radius shown
    if (!mapImg) {
      mapImg = document.createElement('canvas');
      mapImg.width = mapImg.height = C.span;
      drawCityMap(mapImg.getContext('2d'), C.span, C.span);
    }
    const p = s.player;
    const sc = W / (R * 2);
    mctx.save();
    mctx.clearRect(0, 0, W, W);
    mctx.beginPath(); mctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); mctx.clip();
    mctx.fillStyle = '#111'; mctx.fillRect(0, 0, W, W);
    const sx = (p.x - R + C.span / 2), sz = (p.z - R + C.span / 2);
    mctx.drawImage(mapImg, sx, sz, R * 2, R * 2, 0, 0, W, W);
    mctx.globalAlpha = 0.9;
    const ps = PAINT.res / PAINT.size;
    mctx.drawImage(paintCanvas, (p.x - R - PAINT.origin) * ps, (p.z - R - PAINT.origin) * ps, R * 2 * ps, R * 2 * ps, 0, 0, W, W);
    mctx.globalAlpha = 1;
    const P = (x, z) => [(x - p.x + R) * sc, (z - p.z + R) * sc];
    // landmarks
    const mark = (lm, txt, col) => { const [x, y] = P(lm.x, lm.z); mctx.fillStyle = col; mctx.font = 'bold 12px Georgia'; mctx.textAlign = 'center'; mctx.fillText(txt, x, y); };
    mark(L.donut, '🍩', '#ff6fb5');
    if (L.bar.door) mark(L.bar.door, 'BAR', '#4fa8ff');
    for (const e of s.enemies) { const [x, y] = P(e.pos.x, e.pos.z); mctx.fillStyle = e.color; mctx.beginPath(); mctx.arc(x, y, e.type === 'boss' ? 7 : e.type === 'roomba' ? 8 : e.type === 'lowrider' ? 4.5 : 3, 0, 7); mctx.fill(); }
    for (const q of s.portals) { const [x, y] = P(q.pos.x, q.pos.z); mctx.strokeStyle = '#fff'; mctx.lineWidth = 3; mctx.beginPath(); mctx.arc(x, y, 7, 0, 7); mctx.stroke(); }
    if (s.carAlive && !s.inCar) { const [x, y] = P(s.car.pos.x, s.car.pos.z); mctx.fillStyle = '#ddd'; mctx.fillRect(x - 3, y - 3, 6, 6); }
    if (!s.sally.inCar) { const [x, y] = P(s.sally.pos.x, s.sally.pos.z); mctx.fillStyle = '#ff2a3a'; mctx.beginPath(); mctx.arc(x, y, 3, 0, 7); mctx.fill(); }
    mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(W / 2, W / 2, 4, 0, 7); mctx.fill();
    // objectives: icon inside radar range, arrow on the rim when outside
    const t = performance.now() / 1000;
    for (const o of s.objectives || []) {
      const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
      mctx.fillStyle = o.c; mctx.strokeStyle = o.c;
      if (d < R * 0.92) {
        const [x, y] = P(o.x, o.z);
        mctx.lineWidth = 2.5; mctx.beginPath(); mctx.arc(x, y, 7 + Math.sin(t * 5) * 2, 0, 7); mctx.stroke();
        mctx.beginPath(); mctx.arc(x, y, 3, 0, 7); mctx.fill();
      } else {
        const a = Math.atan2(dz, dx), rr = W / 2 - 10;
        const x = W / 2 + Math.cos(a) * rr, y = W / 2 + Math.sin(a) * rr;
        mctx.save(); mctx.translate(x, y); mctx.rotate(a);
        mctx.beginPath(); mctx.moveTo(9, 0); mctx.lineTo(-6, -7); mctx.lineTo(-3, 0); mctx.lineTo(-6, 7); mctx.closePath(); mctx.fill();
        mctx.restore();
        if (o.k === 'goto') { mctx.font = 'bold 10px Georgia'; mctx.textAlign = 'center'; mctx.fillText(`${Math.round(d)}m`, W / 2 + Math.cos(a) * (rr - 18), W / 2 + Math.sin(a) * (rr - 18) + 3); }
      }
    }
    mctx.restore();
  }

  // little painted portraits: Mack in his fedora, Sally in her red dress
  (function portraits() {
    const pm = el.ptMack.getContext('2d'), ps = el.ptSally.getContext('2d');
    const bg = (g) => { const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#3a3c40'); gr.addColorStop(1, '#0d0d0e'); g.fillStyle = gr; g.fillRect(0, 0, 96, 96); };
    bg(pm);
    pm.fillStyle = '#6d665d'; pm.beginPath(); pm.moveTo(10, 96); pm.lineTo(22, 70); pm.lineTo(74, 70); pm.lineTo(86, 96); pm.fill(); // coat
    pm.fillStyle = '#4a443c'; pm.beginPath(); pm.moveTo(30, 70); pm.lineTo(48, 92); pm.lineTo(66, 70); pm.fill(); // collar
    pm.fillStyle = '#c4b8ac'; pm.beginPath(); pm.ellipse(48, 52, 17, 21, 0, 0, 7); pm.fill(); // face
    pm.fillStyle = '#7d7468'; pm.fillRect(33, 58, 30, 12); // stubble
    pm.fillStyle = '#1d1c1a'; pm.fillRect(14, 30, 68, 6); pm.fillRect(28, 12, 40, 20); // fedora
    pm.fillStyle = '#000'; pm.fillRect(28, 27, 40, 4);
    pm.fillStyle = '#111'; pm.fillRect(38, 46, 7, 3); pm.fillRect(52, 46, 7, 3); // eyes in the hat shadow
    pm.fillStyle = '#fff'; pm.fillRect(55, 63, 14, 2); // cigarette
    bg(ps);
    ps.fillStyle = '#d0102a'; ps.beginPath(); ps.moveTo(14, 96); ps.quadraticCurveTo(48, 64, 82, 96); ps.fill(); // red dress
    ps.fillStyle = '#d8cfc6'; ps.beginPath(); ps.ellipse(48, 52, 15, 19, 0, 0, 7); ps.fill();
    ps.fillStyle = '#0a0a0a'; ps.beginPath(); ps.ellipse(48, 44, 22, 20, 0, Math.PI, 0); ps.fill(); ps.fillRect(26, 44, 9, 24); ps.fillRect(61, 44, 9, 24); // bob
    ps.fillStyle = '#d0102a'; ps.fillRect(42, 62, 12, 4); // lips
    ps.beginPath(); ps.arc(66, 32, 6, 0, 7); ps.fill(); // flower
    ps.fillStyle = '#111'; ps.fillRect(39, 50, 6, 3); ps.fillRect(52, 50, 6, 3);
  })();

  return {
    show, say, stamp, floater, update,
    wanted(on) { document.getElementById('wanted').classList.toggle('hidden', !on); },
    caseTitle(no, t) { el.caseNo.textContent = no.toUpperCase(); el.caseTitle.textContent = t; },
    objective(t) { el.objText.textContent = t; },
    progress(p) { el.objProg.textContent = p; },
    hurt() { hurtT = 0.7; },
    focus() {},
    boss(name, sub, frac) {
      if (!name) { el.bossbar.classList.add('hidden'); return; }
      el.bossbar.classList.remove('hidden');
      el.bossName.textContent = name; el.bossSub.textContent = sub;
      el.bossFill.style.transform = `scaleX(${frac})`;
    },
    clear() {
      caps.splice(0).forEach((c) => c.wrap.remove());
      floaters.splice(0).forEach((f) => f.d.remove());
      barEls.forEach((d) => (d.style.display = 'none'));
      el.bossbar.classList.add('hidden');
      lastFlasks = -1; lastAmmo = -1;
    },
  };
}
