// Grey City Blues — boot, screens and the flow between them:
// office (main menu) → big board → case intro → the streets → outro → board.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { initAudio, audio, playlist, skipTrack, setIndoors, sfx, setEngine } from './audio.js';
import { buildOffice, buildBar } from './interiors.js';
import { createGame } from './game.js';
import { createHud } from './hud.js';
import { CASES, CAST, GUS_HINTS, DOTTIE_IDLE, PATROL, BAR_CLOSERS, TOASTS } from './story.js';
import { drawCityMap, L, DISTRICTS, C } from './city.js';
import { fx } from './fx.js';
import { pick } from './util.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

// film grain, vignette, rain on the lens, lightning, hurt and flask focus
const NoirShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.05 }, vign: { value: 1.0 }, flash: { value: 0 }, focus: { value: 0 }, drops: { value: 1 }, res: { value: new THREE.Vector2(1, 1) }, scratch: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, grain, vign, flash, focus, drops, scratch; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      // rain beading on the lens: a few drops that refract and slowly slide
      vec2 off = vec2(0.0);
      if (drops > 0.0) {
        vec2 g = uv * vec2(res.x / res.y, 1.0) * 7.0;
        vec2 id = floor(g); vec2 f = fract(g) - 0.5;
        float r = h(id);
        float life = fract(time * (0.05 + r * 0.08) + r);
        vec2 c = vec2(r - 0.5, 0.35 - life * 0.9) * 0.6;
        float d = length(f - c);
        float m = r > 0.72 ? smoothstep(0.11, 0.0, d) : 0.0;
        off = (f - c) * m * 0.06 * drops;
      }
      vec3 col = texture2D(tDiffuse, uv + off).rgb;
      // focus (flask slow-mo): harder contrast
      col = mix(col, smoothstep(0.02, 0.9, col), focus * 0.6);
      // lightning
      col += flash * 0.35;
      // vignette
      vec2 q = uv - 0.5; q.x *= res.x / res.y;
      col *= mix(1.0, smoothstep(0.95, 0.25, length(q)), vign * (0.85 + focus * 0.4));
      // film grain + flicker + the odd scratch
      float n = h(uv * res + fract(time * 13.7) * 100.0) - 0.5;
      col += n * grain;
      col *= 0.97 + 0.03 * sin(time * 43.0);
      float sx = fract(time * 0.37) ; float sc = step(0.995, 1.0 - abs(uv.x - h(vec2(floor(time * 6.0), 1.0))) ) * step(0.9, h(vec2(floor(time * 6.0), 2.0)));
      col = mix(col, vec3(0.75), sc * 0.35 * scratch);
      gl_FragColor = vec4(col, 1.0);
    }`,
};
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
const noirPass = new ShaderPass(NoirShader);
composer.addPass(renderPass);
composer.addPass(noirPass);
composer.addPass(new OutputPass());

// ------------------------------------------------------------------ save data
const SAVE_KEY = 'gcb.save.v1';
const save = (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || null; } catch { return null; } })() || { open: 1, best: {}, clues: {}, bonus: 0, name: '' };
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ } };
const reelKey = (id) => `gcb.reel.${id}`;
const loadReel = (id) => { try { return JSON.parse(localStorage.getItem(reelKey(id))); } catch { return null; } };
const storeReel = (id, reel) => { try { localStorage.setItem(reelKey(id), JSON.stringify(reel)); } catch { /* quota */ } };

// ------------------------------------------------------------------ world
const hud = createHud();
let office, bar, game;
let mode = 'boot'; // boot | splash | title | board | intro | play | pause | bar | barMid | outro | result | reel
let currentCase = null;
let lastBar = null;
let lastIndoor = 'office';
let selectedCase = 1;

function setMode(m) {
  mode = m;
  for (const id of ['title', 'board', 'barui', 'pause', 'result']) $(id).classList.add('hidden');
  hud.show(m === 'play' || m === 'pause' || m === 'reel');
  $('newsreel-tag').classList.toggle('hidden', m !== 'reel');
  document.body.classList.toggle('playing', m === 'play');
  $('cross').style.display = m === 'play' ? 'block' : 'none';
  if (m === 'title') { $('title').classList.remove('hidden'); office.setView('menu'); }
  if (m === 'board') { $('board').classList.remove('hidden'); office.setView('board'); renderBoard(); }
  if (m === 'bar' || m === 'barMid') $('barui').classList.remove('hidden');
  if (m === 'pause') $('pause').classList.remove('hidden');
  if (m === 'result') $('result').classList.remove('hidden');
  if (m === 'board' || m === 'title') lastIndoor = 'office';
  if (m === 'barOutro' || m === 'bar') lastIndoor = 'bar';
  const indoors = !['play', 'pause', 'reel'].includes(m);
  setIndoors(indoors);
  if (indoors) setEngine(false);
  if (m === 'bar' || m === 'barMid') playlist('bar');
  else if (indoors) playlist('office');
  noirPass.uniforms.drops.value = indoors ? 0 : 1;
}

function fade(fn, ms = 650) {
  $('fade').classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => $('fade').classList.remove('on'), 60); }, ms);
}

// ------------------------------------------------------------------ dialogue
const dlg = { lines: null, i: 0, typed: 0, full: '', done: null, timer: 0, act: null };
function speakerOf(who, caseDef) {
  if (who === 'DAME') return { name: caseDef ? caseDef.dame.name : 'A dame', cls: 'dame' };
  return CAST[who] || { name: who, cls: 'dame' };
}
function runDialog(lines, { caseDef, onAct, done, door = false } = {}) {
  dlg.lines = lines; dlg.i = -1; dlg.done = done; dlg.caseDef = caseDef; dlg.onAct = onAct; dlg.door = door;
  $('dlg-skip').textContent = door ? 'Walk out the door 🚪' : 'Skip ⏭';
  $('dialog').classList.remove('hidden');
  nextLine();
}
function nextLine() {
  if (!dlg.lines) return;
  if (dlg.typed < dlg.full.length && dlg.i >= 0) { dlg.typed = dlg.full.length; $('dlg-text').textContent = dlg.full; return; }
  dlg.i++;
  if (dlg.i >= dlg.lines.length) { endDialog(); return; }
  const line = dlg.lines[dlg.i];
  let act = null, who, text;
  if (line.length === 3) [act, who, text] = line; else [who, text] = line;
  if (act && dlg.onAct) dlg.onAct(act);
  const sp = speakerOf(who, dlg.caseDef);
  $('dlg-name').textContent = sp.name;
  $('dlg-name').className = `who-${sp.cls}`;
  $('dialog').classList.toggle('narr', who === 'NARR');
  dlg.full = text; dlg.typed = 0;
  $('dlg-text').textContent = '';
}
function endDialog() {
  const d = dlg.done;
  dlg.lines = null; dlg.full = ''; dlg.typed = 0;
  $('dialog').classList.add('hidden');
  if (d) d();
}
function tickDialog(dt) {
  if (!dlg.lines || dlg.typed >= dlg.full.length) return;
  dlg.timer += dt;
  while (dlg.timer > 0.018 && dlg.typed < dlg.full.length) {
    dlg.timer -= 0.018;
    dlg.typed++;
    if (dlg.typed % 3 === 0 && dlg.full[dlg.typed - 1] !== ' ') sfx.type();
  }
  $('dlg-text').textContent = dlg.full.slice(0, dlg.typed);
}
$('dialog').addEventListener('click', (e) => { if (e.target.id !== 'dlg-skip') nextLine(); });
$('dlg-skip').addEventListener('click', (e) => { e.stopPropagation(); if (dlg.door) sfx.door(); endDialog(); });

// ------------------------------------------------------------------ the big board
const mapCanvas = $('citymap');
const mctx = mapCanvas.getContext('2d');
const caseSpot = (c) => {
  if (c.district === 'City') return { x: L.cityHall.x, z: L.cityHall.z };
  const d = DISTRICTS[c.district];
  return { x: (d.x0 + d.x1) / 2, z: (d.z0 + d.z1) / 2 };
};
function drawBoardMap() {
  const W = mapCanvas.width;
  drawCityMap(mctx, W, W, { paper: true });
  const X = (x) => (x + C.span / 2) * W / C.span;
  mctx.font = 'bold 15px Georgia'; mctx.textAlign = 'center'; mctx.fillStyle = 'rgba(40,32,24,0.75)';
  for (const n in DISTRICTS) { const d = DISTRICTS[n]; mctx.fillText(n.toUpperCase(), X((d.x0 + d.x1) / 2), X(d.z0) + 16); }
  // landmarks
  const lm = (l, label, col) => { mctx.fillStyle = col; mctx.beginPath(); mctx.arc(X(l.x), X(l.z), 6, 0, 7); mctx.fill(); mctx.fillStyle = '#2a241c'; mctx.font = 'italic 12px Georgia'; mctx.fillText(label, X(l.x), X(l.z) + 18); };
  lm(L.office, 'Malone Inv.', '#d0102a'); lm(L.bar, 'The Last Drop', '#4fa8ff'); lm(L.donut, 'Holy Glaze', '#ff6fb5');
  lm(L.casino, 'Silver Dollar', '#c9a43a'); lm(L.cityHall, 'City Hall', '#555'); lm(L.bank1, 'First Grey Bank', '#555'); lm(L.club, 'Kaleidoscope', '#555');
  // red string between open/closed cases
  const pts = CASES.filter((c) => c.id <= save.open).map(caseSpot);
  mctx.strokeStyle = '#c0102a'; mctx.lineWidth = 2.5; mctx.beginPath();
  pts.forEach((p, i) => (i ? mctx.lineTo(X(p.x), X(p.z)) : mctx.moveTo(X(p.x), X(p.z))));
  mctx.stroke();
  // pinned case tags
  const used = [];
  for (const c of CASES) {
    const p = caseSpot(c);
    let x = X(p.x), y = X(p.z);
    // cases in the same district stack down the board instead of overlapping
    while (used.some(([ux, uy]) => Math.abs(ux - x) < 90 && Math.abs(uy - y) < 56)) y += 58;
    used.push([x, y]);
    const open = c.id <= save.open, closed = !!save.best[c.id];
    mctx.save();
    mctx.translate(x, y); mctx.rotate(((c.id * 37) % 11 - 5) * 0.02);
    mctx.fillStyle = !open ? '#6b665c' : closed ? '#efe9dc' : '#fff8e8';
    mctx.shadowColor = 'rgba(0,0,0,0.5)'; mctx.shadowBlur = 8; mctx.shadowOffsetY = 3;
    mctx.fillRect(-46, -26, 92, 52);
    mctx.shadowColor = 'transparent';
    if (c.id === selectedCase) { mctx.strokeStyle = '#d0102a'; mctx.lineWidth = 4; mctx.strokeRect(-46, -26, 92, 52); }
    mctx.fillStyle = '#1b1814'; mctx.font = 'bold 22px Georgia'; mctx.fillText(`No. ${c.id}`, 0, 0);
    mctx.font = '11px Georgia'; mctx.fillText(open ? (closed ? 'CLOSED' : 'OPEN') : 'SEALED', 0, 17);
    mctx.fillStyle = '#c0102a'; mctx.beginPath(); mctx.arc(0, -22, 6, 0, 7); mctx.fill();
    mctx.restore();
    c._mapXY = [x, y];
  }
  // also paint it onto the corkboard in the office
  const t = office.board.userData.mapPlane;
  if (!t.material.map) { t.material.map = new THREE.CanvasTexture(mapCanvas); t.material.map.colorSpace = THREE.SRGBColorSpace; }
  t.material.map.needsUpdate = true;
  t.material.needsUpdate = true;
}
mapCanvas.addEventListener('click', (e) => {
  const r = mapCanvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * mapCanvas.width / r.width, y = (e.clientY - r.top) * mapCanvas.height / r.height;
  for (const c of CASES) if (c._mapXY && Math.abs(c._mapXY[0] - x) < 50 && Math.abs(c._mapXY[1] - y) < 30) { selectedCase = c.id; sfx.type(); renderBoard(); document.querySelector(`.case[data-id="${c.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
});

function gradeOf(c, score) {
  const r = score / (4000 + c.id * 1500);
  return r >= 1.6 ? 'S' : r >= 1.3 ? 'A' : r >= 1 ? 'B' : r >= 0.7 ? 'C' : 'D';
}
function renderBoard() {
  drawBoardMap();
  const total = Object.values(save.best).reduce((a, b) => a + b.score, 0);
  $('board-score').textContent = total ? `career score ${total.toLocaleString()}` : '';
  const box = $('cases');
  box.innerHTML = '';
  const pd = document.createElement('div');
  pd.className = 'case closed';
  pd.innerHTML = `<div class="case-n">OFF THE BOOKS · CITYWIDE</div><div class="case-t">${PATROL.title}</div><div class="case-s open">ANYTIME</div><div class="case-b">${PATROL.blurb}</div><div class="case-act"><button class="go">Hit the streets</button></div>`;
  pd.querySelector('button').onclick = () => beginCase(PATROL, false);
  box.appendChild(pd);
  for (const c of CASES) {
    const open = c.id <= save.open, best = save.best[c.id], reel = open && loadReel(c.id);
    const d = document.createElement('div');
    d.className = `case ${open ? '' : 'locked'} ${best ? 'closed' : ''} ${selectedCase === c.id ? 'sel' : ''}`;
    d.dataset.id = c.id;
    d.innerHTML = `<div class="case-n">CASE No. ${c.id} · ${c.district === 'City' ? 'CITYWIDE' : c.district.toUpperCase()}</div>
      <div class="case-t">${open ? c.title : '— sealed —'}</div>
      <div class="case-s ${!open ? 'sealed' : best ? 'closed' : 'open'}">${!open ? 'SEALED' : best ? 'CLOSED' : 'OPEN'}</div>
      ${open ? `<div class="case-d">Client: ${c.dame.name}</div><div class="case-b">${c.blurb}</div>` : '<div class="case-b">Close the case before it to break the seal.</div>'}
      ${best ? `<div class="case-best">Best: ${best.score.toLocaleString()} pts · grade ${best.grade} · ${fmtTime(best.time)}</div>` : ''}
      ${open && c.clue && save.clues[c.id] ? '<div class="case-clue">✦ Clue from Gus: ' + c.clue.text + '</div>' : open && c.clue && !best ? '<div class="case-clue">✦ Gus at the Last Drop might know something about this one.</div>' : ''}
      ${open ? `<div class="case-act"><button class="go" data-a="take">${best ? 'Reopen the case' : 'Take the case'}</button>${best ? '<button data-a="skipintro">Straight to the streets</button>' : ''}${reel ? '<button data-a="reel">▶ Newsreel</button><button data-a="export">Export reel</button>' : ''}</div>` : ''}`;
    d.addEventListener('click', (e) => {
      if (!open) return;
      const a = e.target.dataset && e.target.dataset.a;
      selectedCase = c.id;
      if (a === 'take') beginCase(c, true);
      else if (a === 'skipintro') beginCase(c, false);
      else if (a === 'reel') playReel(c, reel);
      else if (a === 'export') exportReel(c, reel);
      else { renderBoard(); }
    });
    box.appendChild(d);
  }
}
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------------ case flow
function beginCase(c, withIntro) {
  currentCase = c;
  if (!withIntro) { fade(() => startStreets(c)); return; }
  $('board').classList.add('hidden');
  $('title').classList.add('hidden');
  mode = 'intro';
  office.cut.begin(c);
  runDialog(c.intro, { caseDef: c, onAct: (a) => office.cut.act(a), done: () => fade(() => { office.cut.end(); startStreets(c); }) });
}

function startStreets(c) {
  currentCase = c;
  const effects = save.clues[c.id] && c.clue ? c.clue.effects : [];
  hud.clear();
  game.start(c, { effects, bonusFlasks: save.bonus || 0 });
  save.bonus = 0; persist();
  setMode('play');
  playlist(c.music === 'boss' ? 'high' : c.music);
}

function onEnd(r) {
  setEngine(false);
  if (r.replay) { fade(() => { game.stop(); hud.clear(); setMode('board'); }); return; }
  if (currentCase && currentCase.patrol && r.win) { fade(() => { game.stop(); hud.clear(); setMode('board'); }); return; }
  const c = currentCase;
  if (r.win) {
    const s = r.stats;
    const score = Math.round(s.kills * 100 + s.portals * 400 + 2500 + Math.max(0, 4000 - s.time * 6) + (1 - Math.min(1, s.peak)) * 2500 + s.hp * 800 + (c.stages.some((x) => x.boss) ? 3000 : 0));
    const grade = gradeOf(c, score);
    const prev = save.best[c.id];
    const newBest = !prev || score > prev.score;
    if (newBest) {
      save.best[c.id] = { score, grade, time: s.time };
      storeReel(c.id, { caseId: c.id, name: save.name || 'Mack Malone', score, grade, date: new Date().toISOString().slice(0, 10), rec: r.rec });
    }
    if (c.id >= save.open && c.id < CASES.length) save.open = c.id + 1;
    persist();
    selectedCase = Math.min(CASES.length, c.id + 1);
    fade(() => {
      game.stop(); hud.clear();
      // case closed: walk into the Last Drop, Mack broods over it, Sally orders another round
      mode = 'barOutro';
      setIndoors(true); playlist('bar'); sfx.door();
      // the evidence goes on the bar; Gus reads it, and it points at the next case
      const ev = r.evidence || [];
      const next = CASES.find((x) => x.id === c.id + 1);
      const evLines = [];
      if (ev.length) {
        evLines.push(['MACK', `I laid it out on the bar for Gus. ${ev.map((x) => x.name.toLowerCase()).join('. ')}.`]);
        for (const x of ev) evLines.push(['GUS', x.gus]);
        if (next && next.clue && !save.clues[next.id]) { save.clues[next.id] = true; persist(); evLines.push(['GUS', `And Mack, for whatever comes next: ${next.clue.text}`]); }
      } else if (next) evLines.push(['GUS', 'Nothing in your pockets, Mack? Next time pick something up off those goons. A receipt. A matchbook. I can read a city from a matchbook.']);
      lastIndoor = 'bar';
      hud.show(false); $('cross').style.display = 'none'; document.body.classList.remove('playing');
      // the bar scene plays the first time a case closes; replays go straight to the score (rewatchable from there)
      const barLines = [...c.outro, ...evLines, ...(BAR_CLOSERS[c.id] || [])];
      lastBar = { c, lines: barLines };
      save.seenBar = save.seenBar || {};
      const seen = save.seenBar[c.id];
      save.seenBar[c.id] = true; persist();
      // first close: the full debrief. After that: a quick toast. Either way, the door walks you out.
      runDialog(seen ? pick(TOASTS) : barLines, { caseDef: c, door: true, done: () => showResult(true, { ...s, score, grade, newBest }) });
    }, 900);
  } else {
    showResult(false, { ...r.stats, reason: r.reason });
  }
}

function showResult(win, s) {
  setMode('result');
  const c = currentCase;
  $('res-title').textContent = win ? 'CASE CLOSED' : 'CASE GONE COLD';
  $('res-sub').innerHTML = win ? `${c.title} — ${c.dame.name} can sleep tonight. Nobody else in Rain City can.` : s.reason === 'bleed' ? 'The city went Technicolor. Mack Malone took one look at a turquoise sky, lost his lunch in the gutter, and gave up. Somewhere a saxophone turned pink and wept.' : `Mack Malone, face down in a puddle. The rain didn't care. The rain never does.<br><br><span class="who-sally">Crazy Sally:</span> ${pick(['Well. That\'s that. I\'m going to the Last Drop to get drunk. Somebody scrape him up and bring him by.', 'Get up, Mack. ...No? Fine. I\'ll be at the bar. Getting drunk. Very drunk. In your honor.', 'Gus! GUS! Pour me everything! Mack\'s taking a nap in a puddle again!'])}`;
  const row = (a, b) => `<div><span>${a}</span><span>${b}</span></div>`;
  $('res-stats').innerHTML = (win ? `<div class="grade">GRADE ${s.grade} · ${s.score.toLocaleString()}${s.newBest ? ' ★ NEW BEST' : ''}</div>` : '') +
    row('Syndicate put down', s.kills) + (s.evidenceTotal ? row('Evidence found', `${s.evidence} / ${s.evidenceTotal}`) : '') + row('Portals closed', s.portals) + row('Rockets Sally fired', s.rockets) + row('Flasks emptied', s.flasks) + row('Peak city color', `${Math.round(s.peak * 100)}%`) + row('Time on the streets', fmtTime(s.time)) +
    (win && s.newBest ? row('Newsreel', 'recorded — find it on the Big Board') : '');
  const btns = $('res-btns');
  btns.innerHTML = '';
  const b = (label, fn) => { const x = document.createElement('button'); x.className = 'btn'; x.textContent = label; x.onclick = fn; btns.appendChild(x); };
  if (win) {
    b('Back to the Big Board', () => setMode('board'));
    const reel = loadReel(c.id);
    if (reel) b('▶ Watch the newsreel', () => playReel(c, reel));
    if (lastBar && lastBar.c === c) b('▶ Full bar scene', () => { $('result').classList.add('hidden'); mode = 'barOutro'; runDialog(lastBar.lines, { caseDef: c, door: true, done: () => setMode('result') }); });
  } else {
    b('Try again', () => fade(() => { game.stop(); startStreets(c); }));
    b('Back to the office', () => fade(() => { game.stop(); hud.clear(); setMode('board'); }));
  }
}

// ------------------------------------------------------------------ newsreels
function playReel(c, reel) {
  if (!reel || !reel.rec || !reel.rec.frames || reel.rec.frames.length < 2) return;
  currentCase = c;
  fade(() => {
    hud.clear();
    game.startReplay(c, reel.rec);
    $('newsreel-who').textContent = `— starring ${reel.name} · ${Number(reel.score).toLocaleString()} pts`;
    setMode('reel');
    playlist('high');
  });
}
function exportReel(c, reel) {
  const name = prompt('Who\'s the hero of this newsreel?', save.name || 'Mack Malone');
  if (name === null) return;
  save.name = name.slice(0, 40); persist();
  const data = { ...reel, name: save.name, game: 'grey-city-blues' };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `grey-city-blues-case${c.id}-${save.name.replace(/\W+/g, '_')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('btn-import').onclick = () => $('import-file').click();
$('import-file').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const reel = JSON.parse(await f.text());
    const c = CASES.find((x) => x.id === reel.caseId);
    if (!c || !reel.rec) throw new Error('not a newsreel');
    playReel(c, reel);
  } catch { alert('That reel is warped. Not a Grey City Blues newsreel.'); }
  e.target.value = '';
};

// ------------------------------------------------------------------ the Last Drop
let barFrom = 'title';
function openBar(from) {
  barFrom = from;
  fade(() => {
    setMode(from === 'mission' ? 'barMid' : 'bar');
    const opts = $('bar-opts');
    opts.innerHTML = '';
    const add = (label, fn) => { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = label; b.onclick = fn; opts.appendChild(b); };
    const gus = (t) => { $('bar-text').innerHTML = `<b>Gus:</b> ${t}`; sfx.type(); };
    if (from === 'mission') {
      const c = currentCase;
      let t = 'You look like something the storm dragged in, Mack. Sit. Drink. There — grit\'s back, flasks are full. Once a case. House rules.';
      if (c.clue && !save.clues[c.id]) { save.clues[c.id] = true; persist(); t += ` <br><br><b>Clue:</b> ${c.clue.text}`; for (const e of c.clue.effects) game.state.fx.add(e); }
      gus(t);
      add('Any word on the street?', () => gus(pick(GUS_HINTS)));
      add('Back to the rain →', () => fade(() => { game.resumeFromBar(); setMode('play'); playlist(c.music === 'boss' ? 'high' : c.music); }));
      return;
    }
    const next = CASES.find((c) => c.id === save.open) || CASES[CASES.length - 1];
    gus(pick(['Mack. Sally. The usual?', 'Rain\'s heavy tonight. Heavier than usual. Like it\'s got somewhere to be.', 'Your tab\'s longer than the Strip, Mack. But I like you.']));
    let poured = false;
    add('Pour me one (fill the flasks for the next case)', () => {
      if (poured) { gus('That\'s enough, Mack. Even Dottie\'d cut you off.'); return; }
      poured = true; save.bonus = 2; persist(); sfx.gulp();
      gus('On the house. You\'ll head out with two extra flasks next case. Don\'t drink \'em all at once. Drink \'em all at twice.');
    });
    add('Any word on the street?', () => gus(pick(GUS_HINTS)));
    add(`Ask about "${next.title}"`, () => {
      let t = next.gus;
      if (next.clue) { save.clues[next.id] = true; persist(); t += `<br><br><b>Clue:</b> ${next.clue.text}`; }
      gus(t);
    });
    add('Ask Sally how she\'s doing', () => { $('bar-text').innerHTML = `<b style="color:#ff2a3a">Sally:</b> ${pick(['I\'m GREAT, Mack. I named my rockets. That one\'s Gerald.', 'This bar needs more explosions. Like, structurally.', 'Do you think Dottie and the coffee machine will have little espresso babies?', 'Red\'s my color. It\'s the only color. Everybody else can get bent.'])}`; });
    add('← Back to the office', () => fade(() => setMode(barFrom === 'board' ? 'board' : 'title')));
  });
}

// ------------------------------------------------------------------ menus
$('btn-board').onclick = () => { sfx.type(); setMode('board'); };
$('btn-board-back').onclick = () => { sfx.type(); setMode('title'); };
$('btn-bar').onclick = () => openBar('title');
$('btn-dottie').onclick = () => {
  $('title').classList.add('hidden');
  office.setView('door');
  runDialog([['DOTTIE', pick(DOTTIE_IDLE)], ['MACK', pick(['Go easy on the rye, Dottie.', 'Any calls?', 'You\'re a good kid, Dottie. A tin kid. But good.'])], ['DOTTIE', pick(['*hic* I love you too, boss.', 'The coffee machine says hi.', 'Fourteen calls. All from the moon. Kidding. *hic* Twelve were from the moon.'])]], { done: () => setMode('title') });
};
$('btn-jazz').onclick = () => skipTrack();
$('vol-music').value = audio.getVolume('music');
$('vol-sfx').value = audio.getVolume('sfx');
$('vol-music').oninput = (e) => audio.setVolume('music', +e.target.value);
$('vol-sfx').oninput = (e) => audio.setVolume('sfx', +e.target.value);
$('btn-resume').onclick = () => setMode('play');
$('btn-quit').onclick = () => fade(() => { game.stop(); hud.clear(); setMode('board'); });
audio.onTrack((name) => { const n = $('np'); n.classList.add('hidden'); void n.offsetWidth; n.textContent = `♪ now playing — "${name}"`; n.classList.remove('hidden'); });

addEventListener('keydown', (e) => {
  if (e.code === 'KeyN' && mode !== 'boot') skipTrack();
  if (dlg.lines && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); nextLine(); return; }
  if (e.code === 'Escape') {
    if (mode === 'play') setMode('pause');
    else if (mode === 'pause') setMode('play');
    else if (mode === 'board') setMode('title');
  }
});
addEventListener('mousemove', (e) => { const c = $('cross'); c.style.left = `${e.clientX}px`; c.style.top = `${e.clientY}px`; });

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  noirPass.uniforms.res.value.set(w, h);
  for (const cam of [office?.camera, bar?.camera, game?.camera]) if (cam) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
}
addEventListener('resize', resize);

// ------------------------------------------------------------------ loop
let last = performance.now(), time = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  tickDialog(dt);
  let scene, camera;
  if (mode === 'play' || mode === 'reel') {
    game.update(dt);
    scene = game.scene; camera = game.camera;
    if (game.state && game.state.boss && !game.state.boss.dead) playlist('boss');
  } else if (mode === 'pause' || (mode === 'result' && game.running === false && game.state)) {
    scene = game.scene; camera = game.camera;
  } else if (mode === 'bar' || mode === 'barMid' || mode === 'barOutro' || (mode === 'result' && lastIndoor === 'bar')) {
    bar.update(dt); scene = bar.scene; camera = bar.camera;
  } else if (office) {
    office.update(dt); scene = office.scene; camera = office.camera;
  }
  if (!scene) return;
  renderPass.scene = scene; renderPass.camera = camera;
  noirPass.uniforms.time.value = time;
  noirPass.uniforms.flash.value = mode === 'play' || mode === 'reel' ? fx.flash : 0;
  noirPass.uniforms.focus.value = mode === 'play' && (game.debug.player.focus > 0 || game.debug.player.focusHeld) ? 1 : mode === 'reel' ? 0.5 : 0;
  noirPass.uniforms.grain.value = mode === 'reel' ? 0.13 : 0.05;
  noirPass.uniforms.scratch.value = mode === 'reel' ? 3 : 1;
  composer.render();
}

// ------------------------------------------------------------------ boot
function boot() {
  office = buildOffice();
  bar = buildBar();
  game = createGame({ renderer, hud, onEnd, onBar: () => { $('cross').style.display = 'none'; openBar('mission'); } });
  resize();
  // warm up shaders for the city so the first case doesn't hitch
  renderer.compile(game.scene, game.camera);
  drawBoardMap();
  mode = 'splash';
  $('splash-status').textContent = 'Click to light a cigarette';
  requestAnimationFrame(frame);
  if (params.has('debug')) window.__noir = {
    game, office, bar, save, setMode, beginCase, startStreets, CASES, playReel, loadReel, get mode() { return mode; },
    // fast-forward the streets without rendering (headless testing)
    step(sec, dt = 1 / 30) { for (let t = 0; t < sec && mode === 'play'; t += dt) game.update(dt); },
  };
}
$('splash').addEventListener('click', () => {
  if (mode !== 'splash') return;
  initAudio();
  playlist('office');
  $('splash').classList.add('hidden');
  const q = +params.get('case');
  if (q && CASES[q - 1]) { currentCase = CASES[q - 1]; startStreets(currentCase); } else setMode('title');
});
setTimeout(boot, 30);
