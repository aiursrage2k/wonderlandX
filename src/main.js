// Wonderland X — bootstrap, game state, render loop.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { Input } from './engine/input.js';
import { unlockAudio, toggleMute, sfx } from './engine/audio.js';
import { makeRng, rand, TAU } from './engine/util.js';
import { World } from './world/world.js';
import { FX } from './fx/fx.js';
import { Gore } from './fx/gore.js';
import { glowTexture } from './gfx/textures.js';
import { Player } from './game/player.js';
import { Combat } from './game/combat.js';
import { Director } from './game/enemies.js';
import './game/clockenemies.js'; // registers the Clockworks cast
import { Chest, BiscuitTin, Pickup, LookingGlass, TeaTable } from './game/interactables.js';
import { Shop } from './game/shop.js';
import { RARITY } from './game/items.js';
import { HUD } from './ui/hud.js';
import { renderPerks } from './ui/perks.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, mad: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float mad; uniform vec2 res; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c,c);
      // chromatic fringe toward the edges (stronger in madness)
      float ca = (0.0025 + mad*0.006) * r2 * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c*ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c*ca).b;
      // lift shadows toward violet, gently warm highlights
      float l = dot(col, vec3(0.299,0.587,0.114));
      col += vec3(0.035,0.012,0.06) * (1.0 - smoothstep(0.0, 0.35, l));
      col = mix(col, col*vec3(1.04,1.0,0.96), smoothstep(0.5,1.0,l));
      // madness: hue drift toward magenta
      col = mix(col, vec3(dot(col,vec3(0.5,0.2,0.6)), col.g*0.7, dot(col,vec3(0.4,0.1,0.9))), mad*0.25);
      // vignette
      col *= mix(1.0, 0.25, smoothstep(0.12, 0.62, r2*1.35));
      // film grain
      col += (hash(uv*res + fract(time)*100.0) - 0.5) * 0.035;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, DEBUG ? 1 : 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1200);
    this.glowTex = glowTexture();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.9, 0.6, 0.62);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.input = new Input(this.canvas);
    this.hud = new HUD(this);
    this.enemies = [];
    this.interactables = [];
    this.pickups = [];
    this.tickers = [];
    this.time = 0;
    this.runTime = 0;
    this.depth = 1;
    this.state = 'title';
    this.shake = 0;
    this.director = new Director(this);
    this.combat = new Combat(this);
    this.gore = new Gore(this);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.bindUI();

    // a title-screen backdrop: build a world and orbit it
    this.loadStage(1, true);
    document.getElementById('loading').classList.add('hidden');

    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 85 : 70;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.grade.uniforms.res.value.set(w * pr, h * pr);
    if (this.fx) this.fx.setScale(h * pr);
  }

  bindUI() {
    const start = () => {
      unlockAudio();
      document.getElementById('screen-title').classList.add('hidden');
      this.startRun();
      this.input.requestLock();
    };
    document.getElementById('btn-start').onclick = start;
    document.getElementById('btn-resume').onclick = () => {
      unlockAudio();
      this.input.requestLock();
      this.setPaused(false);
    };
    document.getElementById('btn-shop-close').onclick = () => this.closeShop();
    document.getElementById('btn-perks-close').onclick = () => this.closePerks();
    document.getElementById('btn-shop-perks').onclick = () => {
      this.closeShop(false);
      this.openPerks(true);
    };
    document.getElementById('btn-restart').onclick = () => {
      document.getElementById('screen-dead').classList.add('hidden');
      this.startRun();
      this.input.requestLock();
    };
    this.canvas.addEventListener('click', () => {
      if (this.state === 'play' && !this.input.locked) this.input.requestLock();
    });
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'play' && !this.input.isTouch && !this.input.fallbackAim && !DEBUG) this.setPaused(true);
    };
    if (this.input.isTouch) document.getElementById('touch').classList.remove('hidden');
  }

  openShop(shop) {
    if (this.state !== 'play') return;
    this.state = 'shop';
    this.openShopRef = shop;
    this.input.mouse.left = false;
    this.hud.prompt(null);
    shop.render();
    document.getElementById('screen-shop').classList.remove('hidden');
    document.exitPointerLock?.();
  }

  closeShop(relock = true) {
    if (this.state !== 'shop') return;
    this.state = 'play';
    document.getElementById('screen-shop').classList.add('hidden');
    this.last = performance.now();
    if (relock) this.input.requestLock();
  }

  openPerks(fromShop = false) {
    if (this.state !== 'play') return;
    this.state = 'perks';
    this.perksFromShop = fromShop;
    this.input.mouse.left = false;
    this.hud.prompt(null);
    renderPerks(this);
    document.getElementById('screen-perks').classList.remove('hidden');
    document.exitPointerLock?.();
  }

  closePerks() {
    if (this.state !== 'perks') return;
    this.state = 'play';
    document.getElementById('screen-perks').classList.add('hidden');
    this.last = performance.now();
    if (this.perksFromShop && this.openShopRef) this.openShop(this.openShopRef);
    else this.input.requestLock();
  }

  setPaused(p) {
    if (p && this.state === 'play') {
      this.state = 'pause';
      document.getElementById('screen-pause').classList.remove('hidden');
    } else if (!p && this.state === 'pause') {
      this.state = 'play';
      document.getElementById('screen-pause').classList.add('hidden');
      this.last = performance.now();
    }
  }

  // ─── run / stage lifecycle ───
  startRun() {
    this.runTime = 0;
    this.depth = 1;
    if (this.player) this.scene.remove(this.player.model);
    this.player = new Player(this);
    this.hud.updateItems(this.player.inv);
    this.loadStage(1);
    this.state = 'play';
    this.hud.show(true);
    this.fadeIn();
  }

  clearStage() {
    for (const e of this.enemies) e.remove();
    for (const i of this.interactables) this.scene.remove(i.model);
    for (const p of this.pickups) p.remove();
    this.enemies = [];
    this.interactables = [];
    this.pickups = [];
    this.tickers = [];
    this.combat.clear();
    this.gore.clear();
    if (this.fx) this.fx.clear();
    if (this.world) this.world.dispose();
  }

  loadStage(depth, preview = false) {
    this.clearStage();
    this.depth = depth;
    const seed = preview ? 777 : (Math.random() * 1e9) | 0;
    this.world = new World(this.scene, depth, seed);
    this.world.game = this;
    if (!this.fx) {
      this.fx = new FX(this.scene, this.glowTex, this.world);
      this.resize();
    }
    this.fx.world = this.world;
    this.makeEnvironment();
    this.hud.setStage(this.world.theme.name, depth);
    const w = this.world;
    this.teleporter = new LookingGlass(this, w.glassPos.x, w.glassPos.z);
    this.interactables.push(this.teleporter);
    const rng = makeRng(seed ^ 0x5bd1e995);
    const avoid = [{ ...w.glassPos, r: 8 }];
    const nChest = 11 + Math.min(6, depth);
    for (let i = 0; i < nChest + 3; i++) {
      // bias toward plazas so loot lives in the "rooms"
      let s;
      if (rng() < 0.55) {
        const p = w.plazas[1 + Math.floor(rng() * (w.plazas.length - 1))] || w.plazas[0];
        const a = rng() * TAU;
        const r = rng() * p.r * 0.75;
        s = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r };
        if (w.colliders.some((c) => Math.hypot(c.x - s.x, c.z - s.z) < c.r + 1.5)) s = w.freeSpot(2, avoid);
      } else s = w.freeSpot(2, avoid);
      avoid.push({ ...s, r: 3 });
      this.interactables.push(new Chest(this, s.x, s.z, i >= nChest));
    }
    for (let i = 0; i < 8; i++) {
      const s = w.freeSpot(2, avoid);
      avoid.push({ ...s, r: 3 });
      this.interactables.push(new BiscuitTin(this, s.x, s.z));
    }
    // the curio cart sits on the edge of the starting plaza, facing its centre
    {
      const sp = w.plazas[0];
      const a = Math.atan2(w.glassPos.z - sp.z, w.glassPos.x - sp.x) + 0.9;
      let sx = sp.x + Math.cos(a) * sp.r * 0.62;
      let sz = sp.z + Math.sin(a) * sp.r * 0.62;
      this.shop = new Shop(this, sx, sz, sp.x, sp.z);
      this.interactables.push(this.shop);
      avoid.push({ x: sx, z: sz, r: 5 });
      // nudge any loot that landed where the stall now stands
      for (const it of this.interactables) {
        if (it === this.shop || it.kind === 'glass') continue;
        if (Math.hypot(it.pos.x - sx, it.pos.z - sz) < 4) {
          const f = w.freeSpot(2, avoid);
          it.pos.set(f.x, w.height(f.x, f.z), f.z);
          it.model.position.copy(it.pos);
        }
      }
    }
    for (let i = 0; i < 2; i++) {
      const s = w.freeSpot(3, avoid);
      avoid.push({ ...s, r: 4 });
      this.interactables.push(new TeaTable(this, s.x, s.z));
    }
    this.director.reset();
    if (this.player) {
      this.player.placeAt(w.spawn.x, w.spawn.z);
      this.player.camYaw = Math.atan2(w.glassPos.x - w.spawn.x, w.glassPos.z - w.spawn.z);
      this.player.camPitch = -0.1;
      this.player.yaw = this.player.camYaw;
      this.player.model.rotation.set(0, 0, 0);
    }
  }

  // Image-based lighting for the stage: a tiny sky with the moon, glow
  // hotspots and lantern warmth, prefiltered so every PBR surface can
  // reflect something that matches the world around it.
  makeEnvironment() {
    const t = this.world.theme;
    const env = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        top: { value: new THREE.Color(t.skyTop) },
        hor: { value: new THREE.Color(t.skyHor) },
        fog: { value: new THREE.Color(t.fog) },
        glow: { value: new THREE.Color(t.glow) },
        glow2: { value: new THREE.Color(t.glow2) },
        moon: { value: new THREE.Color(t.moon) },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vDir; uniform vec3 top, hor, fog, glow, glow2, moon;
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = h > 0.0 ? mix(hor, top, smoothstep(0.0, 0.7, h)) * 1.1 : mix(fog * 0.6, fog * 0.15, smoothstep(0.0, -0.4, h));
          c += moon * 6.0 * pow(max(dot(d, normalize(vec3(0.4, 0.45, -0.8))), 0.0), 60.0);
          float az = atan(d.z, d.x);
          float band = exp(-abs(h - 0.05) * 14.0);
          c += glow * 1.4 * band * pow(0.5 + 0.5 * sin(az * 3.0), 6.0);
          c += glow2 * 1.1 * band * pow(0.5 + 0.5 * sin(az * 2.0 + 1.7), 8.0);
          c += vec3(1.0, 0.55, 0.2) * 1.2 * exp(-abs(h - 0.12) * 20.0) * pow(0.5 + 0.5 * sin(az * 5.0 + 0.4), 12.0);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat));
    this.pmrem ||= new THREE.PMREMGenerator(this.renderer);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(env, 0.015);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.32;
    mat.dispose();
  }

  nextStage() {
    this.state = 'transition';
    sfx('door');
    this.fadeOut(() => {
      this.loadStage(this.depth + 1);
      this.player.heal(this.player.stats.maxHp * 0.25);
      this.state = 'play';
      this.fadeIn();
      this.hud.banner(this.world.theme.name, `Depth ${String(this.depth).padStart(2, '0')} — it only gets madder.`, '#c9a45a', '🕳️');
    });
  }

  fadeOut(cb) {
    const f = document.getElementById('fade');
    f.style.opacity = 1;
    setTimeout(cb, 650);
  }

  fadeIn() {
    const f = document.getElementById('fade');
    f.style.opacity = 1;
    requestAnimationFrame(() => requestAnimationFrame(() => (f.style.opacity = 0)));
  }

  onPlayerDeath() {
    this.state = 'dying';
    sfx('boss');
    setTimeout(() => {
      this.state = 'dead';
      document.exitPointerLock?.();
      const p = this.player;
      const t = this.runTime;
      const quotes = ['“Off with her head!”', '“Who in the world am I? Ah, that’s the great puzzle.”', '“It’s no use going back to yesterday.”', '“I can’t go back to yesterday, because I was a different person then.”'];
      document.getElementById('dead-quote').textContent = quotes[Math.floor(rand() * quotes.length)];
      document.getElementById('dead-stats').innerHTML = `
        Reached <b>Depth ${String(this.depth).padStart(2, '0')}</b> — ${this.world.theme.name}<br>
        Survived <b>${Math.floor(t / 60)}m ${Math.floor(t % 60)}s</b> · Slain <b>${p.kills}</b> · Damage <b>${Math.round(p.damageDealt).toLocaleString()}</b><br>
        Items collected <b>${[...p.inv.stacks.values()].reduce((a, b) => a + b, 0)}</b>`;
      document.getElementById('screen-dead').classList.remove('hidden');
    }, 2200);
  }

  // ─── helpers used by entities ───
  difficulty() {
    return (1 + 0.0506 * 2.2 * (this.runTime / 60)) * 1.15 ** (this.depth - 1);
  }

  enemyLevel() {
    return 1 + Math.floor((this.difficulty() - 1) / 0.33);
  }

  camShake(m) {
    this.shake = Math.min(1.2, this.shake + m);
  }

  addTicker(fn) {
    this.tickers.push(fn);
  }

  spawnPickup(item, pos, vel) {
    this.pickups.push(new Pickup(this, item, pos, vel));
  }

  collect(pk) {
    const p = this.player;
    p.inv.add(pk.item.id);
    p.recompute();
    this.hud.updateItems(p.inv);
    this.hud.banner(pk.item.name, pk.item.desc, RARITY[pk.item.rarity].color, pk.item.icon);
    this.fx.burst(pk.pos, 30, pk.color, { speed: 6, size: 0.3, life: 0.6 });
    sfx('orb');
  }

  splat(x, z, r, color = '#5a0610', dir = null) {
    this.gore.splat(x, z, r, color, dir);
  }

  // Freeze-frame on impact: game time crawls for a few real milliseconds.
  hitStop(t) {
    this.hitStopT = Math.max(this.hitStopT || 0, t);
  }

  // Aim ray from the camera: nearest of enemies / props / terrain.
  computeAim(origin, dir, out) {
    let best = 150;
    const oc = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.hitCenter(c);
      oc.subVectors(c, origin);
      const t = oc.dot(dir);
      if (t < 2 || t > best) continue;
      const d2 = oc.lengthSq() - t * t;
      const r = e.hitR * 1.1;
      if (d2 < r * r) best = t - Math.sqrt(r * r - d2);
    }
    const tg = this.world.raycastGround(origin, dir, best);
    if (tg > 0 && tg < best) best = tg;
    out.copy(origin).addScaledVector(dir, best);
    return best;
  }

  // ─── frame ───
  frame() {
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.hitStopT > 0) {
      this.hitStopT -= dt;
      dt *= 0.06;
    }
    this.update(dt);
    this.render(dt);
  }

  update(dt) {
    const input = this.input;
    if (input.hit('m')) toggleMute();
    if (input.hit('escape') && this.state === 'pause') this.setPaused(false);
    if (input.hit('p') && this.state === 'play') this.setPaused(true);
    if (this.state === 'shop' && (input.hit('escape') || input.hit('e'))) this.closeShop();
    else if (this.state === 'perks' && (input.hit('escape') || input.hit('tab'))) this.closePerks();
    else if (this.state === 'play' && input.hit('tab')) this.openPerks();

    const playing = this.state === 'play' || this.state === 'dying';
    if (this.state === 'pause' || this.state === 'dead' || this.state === 'shop' || this.state === 'perks') dt = 0;
    this.time += dt;
    this.dt = dt;

    if (playing) {
      if (this.state === 'play') this.runTime += dt;
      input.fallbackLook(dt);
      const look = input.consumeLook();
      if (this.state === 'play') this.player.look(look.dx, look.dy);
      if (this.autopilot) this.autopilot(dt);
      this.player.update(dt, input);
      this.director.update(dt);
      this.enemies = this.enemies.filter((e) => {
        const keep = e.update(dt);
        if (!keep) e.remove();
        return keep;
      });
      this.combat.update(dt);
      for (const i of this.interactables) i.update(dt);
      this.pickups = this.pickups.filter((p) => {
        const keep = p.update(dt);
        if (!keep) p.remove();
        return keep;
      });
      this.tickers = this.tickers.filter((f) => f(dt));
      this.updateInteract();
    }

    if (this.state === 'title') this.titleCam();
    else this.world.update(this.time, dt, this.player.pos);
    this.fx.update(dt);
    this.gore.update(dt);
    if (this.state !== 'title') this.hud.update(dt);
    input.endFrame();
  }

  render(dt) {
    if (this.player && this.state !== 'title') {
      this.camera.position.copy(this.player.cam);
      this.camera.lookAt(this.player.cam.clone().add(this.player.lookDir));
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * 2.5);
        const s = this.shake * this.shake * 0.35;
        this.camera.rotation.x += (Math.random() - 0.5) * s * 0.2;
        this.camera.rotation.y += (Math.random() - 0.5) * s * 0.2;
      }
    }
    this.grade.uniforms.time.value = this.time;
    const madTarget = this.player && this.player.madness > 0 ? 1 : 0;
    this.grade.uniforms.mad.value += (madTarget - this.grade.uniforms.mad.value) * Math.min(1, dt * 4);
    this.composer.render();
  }

  titleCam() {
    const w = this.world;
    const t = this.time * 0.05;
    const R = 40;
    const cx = w.glassPos.x;
    const cz = w.glassPos.z;
    const x = cx + Math.cos(t) * R;
    const z = cz + Math.sin(t) * R;
    this.camera.position.set(x, w.height(x, z) + 7, z);
    this.camera.lookAt(cx, w.height(cx, cz) + 4, cz);
    this.world.update(this.time, this.dt || 0, new THREE.Vector3(cx, 0, cz));
  }

  updateInteract() {
    const p = this.player;
    if (!p.alive || this.state !== 'play') {
      this.hud.prompt(null);
      return;
    }
    let best = null;
    let bd = 3.2;
    for (const it of this.interactables) {
      if (it.used) continue;
      const pos = it.interactPos || it.pos;
      const d = Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z);
      const reach = it.kind === 'glass' ? 6 : 3.2;
      if (d < reach && d < bd + (it.kind === 'glass' ? 3 : 0)) {
        if (!it.label()) continue;
        best = it;
        bd = d;
      }
    }
    this.hud.prompt(best ? best.label() : null);
    if (best && this.input.hit('e')) best.interact();
  }
}

const game = new Game();
window.game = game;

// Debug hooks for automated screenshots: ?debug
if (DEBUG) {
  window.debugStart = () => {
    document.getElementById('screen-title').classList.add('hidden');
    game.startRun();
  };
}
