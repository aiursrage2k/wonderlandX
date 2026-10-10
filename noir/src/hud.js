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
    stomach: $('stomach'), boost: $('boost-fill'), waveinfo: $('waveinfo'), score: $('score'), mult: $('mult'), combo: $('combo-fill'),
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

  let radioT = 0, tutT = 0;
  function say(who, text, dur = 3.5) {
    if (who === 'RADIO') {
      // the radio gets its own little set on the left, not a caption
      document.getElementById('radio-text').textContent = text;
      document.getElementById('radio').classList.remove('hidden');
      radioT = dur + text.length * 0.03;
      return;
    }
    const c = CAST[who] || { name: who, cls: 'dame' };
    const d = document.createElement('div');
    d.className = 'cap';
    d.innerHTML = `${c.name ? `<b class="who-${c.cls}">${c.name}</b>` : ''}<span class="who-${c.cls}">${text}</span>`;
    const wrap = document.createElement('div');
    wrap.appendChild(d);
    el.captions.appendChild(wrap);
    caps.push({ wrap, t: dur + text.length * 0.02 });
    while (caps.length > 2) caps.shift().wrap.remove();
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
    if (tutT > 0) { tutT -= dt; if (tutT <= 0) document.getElementById('tutorial').classList.add('hidden'); }
    if (radioT > 0) { radioT -= dt; if (radioT <= 0) document.getElementById('radio').classList.add('hidden'); }
    if (s.clock !== undefined) {
      const m = Math.floor(s.clock / 60), sec = Math.floor(s.clock % 60);
      document.getElementById('clock').textContent = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    if (s.inCar && s.speed !== undefined) document.getElementById('speed').textContent = Math.round(s.speed * 2.2);
    if (s.score !== undefined) {
      el.score.textContent = String(Math.round(s.score)).padStart(7, '0');
      el.mult.textContent = `×${s.mult.toFixed(2).replace(/\.?0+$/, '')}`;
      el.mult.classList.toggle('hot', s.mult >= 4);
      el.combo.style.transform = `scaleX(${Math.max(0, s.combo || 0)})`;
    }
    const W = s.wave;
    el.waveinfo.classList.toggle('hidden', !W);
    if (W) {
      el.waveinfo.className = W.state === 'cleared' || W.state === 'done' ? 'cleared' : '';
      const portals = `${W.open} PORTAL${W.open === 1 ? '' : 'S'} OPEN`;
      el.waveinfo.innerHTML = W.state === 'incoming' ? `WAVE 1 OF ${W.total} · <b>INCOMING</b>`
        : W.state === 'live' ? `WAVE ${W.n} OF ${W.total} · <b>${portals}</b>`
        : W.state === 'cleared' ? `WAVE ${W.n} OF ${W.total} CLEARED · NEXT IN ${W.next}s`
        : `ALL ${W.total} WAVES CLEARED`;
    }
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
    civTags(s, w, h);
    pointers(s, w, h);
    minimap(s);
  }

  // rainbow health bars over anyone hurt but still standing
  const barEls = [];
  const ebars = document.getElementById('ebars');
  function enemyBars(s, w, h) {
    const list = [];
    for (const e of s.enemies) if (!e.dead && e.hp < e.maxHp && e.type !== 'boss' && !(e.emerge > 0)) list.push([e.pos, e.hp / e.maxHp, e.type === 'copter' ? 26 : e.type === 'roomba' || e.type === 'truck' ? 7 : e.type === 'lowrider' ? 4.5 : 3.4 * (e.model.root.scale.x || 1), e.type === 'roomba' || e.type === 'truck' || e.type === 'copter' ? 70 : 40]);
    for (const p of s.portals) {
      if (p.walker) { if (!p.toppled) { const t = p.legs.reduce((a, l) => a + Math.max(0, l.alive ? l.hp : 0), 0) / (p.legs.length * 150); if (t < 1) list.push([p.pos, t, p.y + 7, 110]); } }
      else if (p.hp < p.maxHp) list.push([p.pos, p.hp / p.maxHp, 13, 80]);
    }
    smashPcts(s, w, h);
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

  // Smash-style % over a toppled walker eye: white, warming to red the more it's been hit
  const pctEls = [];
  const pctBox = document.getElementById('pcts');
  function smashPcts(s, w, h) {
    const list = s.portals.filter((p) => p.walker && p.toppled);
    while (pctEls.length < list.length) { const d = document.createElement('div'); pctBox.appendChild(d); pctEls.push(d); }
    pctEls.forEach((d, i) => {
      const p = list[i];
      if (!p) { d.style.display = 'none'; return; }
      v.set(p.pos.x, p.y + 6, p.pos.z).project(s.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { d.style.display = 'none'; return; }
      d.style.display = 'block';
      d.style.left = `${(v.x * 0.5 + 0.5) * w}px`; d.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      const k = Math.min(1, p.pct / 150);
      d.style.color = `rgb(255, ${Math.round(255 - k * 215)}, ${Math.round(255 - k * 225)})`;
      d.style.fontSize = `${34 + k * 26}px`;
      d.textContent = `${Math.round(p.pct)}%`;
    });
  }

  // civilians wear a little "don't shoot" tag; the infected ones are rainbow
  const tagEls = [];
  const civtags = document.getElementById('civtags');
  const cross = document.getElementById('cross');
  function civTags(s, w, h) {
    const list = (s.civs || []).filter((c) => !c.dead && Math.abs(c.pos.x - s.player.x) + Math.abs(c.pos.z - s.player.z) < 90);
    while (tagEls.length < Math.min(list.length, 24)) { const d = document.createElement('div'); civtags.appendChild(d); tagEls.push(d); }
    let aimed = false;
    tagEls.forEach((d, i) => {
      const c = list[i];
      if (!c) { d.style.display = 'none'; return; }
      v.set(c.pos.x, 3.2, c.pos.z).project(s.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { d.style.display = 'none'; return; }
      d.style.display = 'block';
      d.style.left = `${(v.x * 0.5 + 0.5) * w}px`; d.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      d.className = c.infected ? 'inf' : '';
      d.textContent = c.infected ? 'INFECTED · DON\'T SHOOT' : 'CIVILIAN';
      if (s.aim && Math.hypot(s.aim.x - c.pos.x, s.aim.z - c.pos.z) < 1.6) aimed = true;
    });
    cross.classList.toggle('noshoot', aimed);
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

  // the radar: heading always up, city blocks, paint, every goon and portal, a compass ring that turns
  function minimap(s) {
    const W = 240, R = 95; // world radius shown
    if (mctx.canvas.width !== W) { mctx.canvas.width = mctx.canvas.height = W; }
    if (!mapImg) {
      mapImg = document.createElement('canvas');
      mapImg.width = mapImg.height = C.span;
      drawCityMap(mapImg.getContext('2d'), C.span, C.span);
    }
    const p = s.player, sc = W / (R * 2), c0 = W / 2;
    // rotate so the way you're facing points up
    const hd = s.heading ?? Math.PI;
    const rot = -Math.PI / 2 - Math.atan2(Math.cos(hd), Math.sin(hd));
    const t = performance.now() / 1000;
    mctx.save();
    mctx.clearRect(0, 0, W, W);
    mctx.beginPath(); mctx.arc(c0, c0, c0 - 2, 0, Math.PI * 2); mctx.clip();
    mctx.fillStyle = '#16130f'; mctx.fillRect(0, 0, W, W);
    mctx.save();
    mctx.translate(c0, c0); mctx.rotate(rot); mctx.translate(-c0, -c0);
    const ext = R * 1.45; // draw a bit wider than the radius so the corners stay filled while turning
    const sx = (p.x - ext + C.span / 2), sz = (p.z - ext + C.span / 2);
    const off = (ext - R) * sc;
    mctx.globalAlpha = 0.85;
    mctx.drawImage(mapImg, sx, sz, ext * 2, ext * 2, -off, -off, W + off * 2, W + off * 2);
    mctx.globalAlpha = 0.9;
    const ps = PAINT.res / PAINT.size;
    mctx.drawImage(paintCanvas, (p.x - ext - PAINT.origin) * ps, (p.z - ext - PAINT.origin) * ps, ext * 2 * ps, ext * 2 * ps, -off, -off, W + off * 2, W + off * 2);
    mctx.globalAlpha = 1;
    // sepia wash so it reads as an old street map
    mctx.fillStyle = 'rgba(70, 52, 30, 0.28)'; mctx.fillRect(-off, -off, W + off * 2, W + off * 2);
    const P = (x, z) => [(x - p.x + R) * sc, (z - p.z + R) * sc];
    const upright = (x, y, fn) => { mctx.save(); mctx.translate(x, y); mctx.rotate(-rot); fn(); mctx.restore(); };
    const mark = (lm, txt, col) => { const [x, y] = P(lm.x, lm.z); upright(x, y, () => { mctx.fillStyle = col; mctx.font = 'bold 12px Georgia'; mctx.textAlign = 'center'; mctx.fillText(txt, 0, 4); }); };
    mark(L.donut, '🍩', '#ff6fb5');
    if (L.bar.door) mark(L.bar.door, 'BAR', '#e8c98a');
    // goons: little diamonds in their own color; portals: a pulsing pink eye
    for (const e of s.enemies) {
      if (e.dead) continue;
      const [x, y] = P(e.pos.x, e.pos.z);
      const r = e.type === 'boss' ? 7 : e.type === 'roomba' || e.type === 'truck' ? 6 : 3.4;
      mctx.fillStyle = e.cop ? '#5a8cff' : e.color || '#ff2a3a';
      mctx.beginPath(); mctx.moveTo(x, y - r); mctx.lineTo(x + r, y); mctx.lineTo(x, y + r); mctx.lineTo(x - r, y); mctx.closePath(); mctx.fill();
    }
    for (const q of s.portals) {
      const [x, y] = P(q.pos.x, q.pos.z);
      mctx.strokeStyle = '#ff2d95'; mctx.lineWidth = 2.5;
      mctx.beginPath(); mctx.arc(x, y, 7 + Math.sin(t * 5) * 1.5, 0, 7); mctx.stroke();
      mctx.fillStyle = q.cracked ? '#fff' : '#ff2d95'; mctx.beginPath(); mctx.arc(x, y, 3, 0, 7); mctx.fill();
    }
    if (s.carAlive && !s.inCar) { const [x, y] = P(s.car.pos.x, s.car.pos.z); upright(x, y, () => { mctx.fillStyle = '#e8e2d4'; mctx.font = 'bold 11px Georgia'; mctx.textAlign = 'center'; mctx.fillText('P', 0, 4); }); }
    if (!s.sally.inCar) { const [x, y] = P(s.sally.pos.x, s.sally.pos.z); mctx.fillStyle = '#ff2a3a'; mctx.beginPath(); mctx.arc(x, y, 3, 0, 7); mctx.fill(); }
    mctx.restore(); // back to screen space (heading up)
    // objectives: icon inside range, arrow + distance on the rim outside it
    for (const o of s.objectives || []) {
      const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx) + rot;
      mctx.fillStyle = o.c; mctx.strokeStyle = o.c;
      if (d < R * 0.9) {
        const x = c0 + Math.cos(a) * d * sc, y = c0 + Math.sin(a) * d * sc;
        mctx.lineWidth = 2.5; mctx.beginPath(); mctx.arc(x, y, 8 + Math.sin(t * 5) * 2, 0, 7); mctx.stroke();
      } else {
        const rr = c0 - 16, x = c0 + Math.cos(a) * rr, y = c0 + Math.sin(a) * rr;
        mctx.save(); mctx.translate(x, y); mctx.rotate(a);
        mctx.beginPath(); mctx.moveTo(9, 0); mctx.lineTo(-6, -7); mctx.lineTo(-3, 0); mctx.lineTo(-6, 7); mctx.closePath(); mctx.fill();
        mctx.restore();
        if (o.k === 'goto' || o.k === 'portal') { mctx.font = 'bold 10px Georgia'; mctx.textAlign = 'center'; mctx.fillText(`${Math.round(d)}m`, c0 + Math.cos(a) * (rr - 18), c0 + Math.sin(a) * (rr - 18) + 3); }
      }
    }
    // you: an arrow pointing up
    mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.lineWidth = 1.5;
    mctx.beginPath(); mctx.moveTo(c0, c0 - 9); mctx.lineTo(c0 + 6, c0 + 6); mctx.lineTo(c0, c0 + 2); mctx.lineTo(c0 - 6, c0 + 6); mctx.closePath(); mctx.fill(); mctx.stroke();
    mctx.restore();
    // compass letters ride the brass ring
    const ring = document.getElementById('compass');
    if (ring) ring.style.transform = `rotate(${rot}rad)`;
    const lab = ring && ring.children;
    if (lab) for (const d of lab) d.style.transform = `translate(-50%, -50%) rotate(${-rot}rad)`;
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
    ps.fillStyle = '#e2b64a'; ps.beginPath(); ps.ellipse(48, 44, 22, 20, 0, Math.PI, 0); ps.fill(); ps.fillRect(26, 44, 9, 24); ps.fillRect(61, 44, 9, 24); // golden bob
    ps.fillStyle = 'rgba(255,240,180,0.6)'; ps.fillRect(34, 30, 10, 3);
    ps.fillStyle = '#d0102a'; ps.fillRect(42, 62, 12, 4); // lips
    ps.beginPath(); ps.arc(66, 32, 6, 0, 7); ps.fill(); // flower
    ps.fillStyle = '#111'; ps.fillRect(39, 50, 6, 3); ps.fillRect(52, 50, 6, 3);
  })();

  return {
    show, say, stamp, floater, update,
    hush() { caps.splice(0).forEach((c) => c.wrap.remove()); },
    // a how-to card pinned beside the case card: a title and numbered steps
    tutorial(lines, sec = 14) {
      const t = document.getElementById('tutorial');
      t.innerHTML = `<div class="tut-head">${lines[0]}</div>` + lines.slice(1).map((l, i) => `<div class="tut-step"><b>${i + 1}</b><span>${l}</span></div>`).join('');
      t.classList.remove('hidden');
      tutT = sec;
    },
    wasted(on, sub = '', word = 'WASTED') {
      const w = document.getElementById('wasted');
      document.getElementById('wasted-sub').textContent = sub;
      w.querySelector('.w-word').textContent = word;
      w.classList.toggle('painted', word === 'PAINTED THE TOWN');
      w.classList.toggle('victory', word === 'CASE CLOSED');
      w.classList.toggle('hidden', !on);
      if (on) { w.style.animation = 'none'; void w.offsetWidth; w.style.animation = ''; }
    },
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
      tagEls.forEach((d) => (d.style.display = 'none'));
      pctEls.forEach((d) => (d.style.display = 'none'));
      el.bossbar.classList.add('hidden');
      radioT = 0; document.getElementById('radio').classList.add('hidden');
      tutT = 0; document.getElementById('tutorial').classList.add('hidden');
      document.getElementById('wasted').classList.add('hidden');
      lastFlasks = -1; lastAmmo = -1;
    },
  };
}
