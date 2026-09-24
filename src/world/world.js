// Stage generation: terrain heightfield, marble plazas, props, sky, lights.

import * as THREE from 'three';
import { makeRng, TAU, clamp, smooth } from '../engine/util.js';
import {
  marbleChecker, groundTexture, barkTexture, gillsTexture, capTexture, porcelainTexture,
  clockFaceTexture, cardTexture, moonTexture, cheshireTexture, skylineTexture, glowTexture, rockTexture, leafTexture,
} from '../gfx/textures.js';
import { mat } from '../gfx/models.js';
import { RIM } from '../gfx/rim.js';
import { buildClockworks } from './clockworks.js';

const GARDEN_FOES = ['guard', 'diamond', 'teacup', 'wisp'];
const CLOCK_FOES = ['hatter', 'spider', 'cannon'];
export const STAGES = [
  { name: 'The Hollow Tea Garden', kind: 'garden', size: 2, boss: 'rabbit', enemies: GARDEN_FOES, summon: 'guard', fog: '#35204a', skyTop: '#0c0620', skyHor: '#7a3a96', glow: '#3ff5dc', glow2: '#ff3fbf', moon: '#d8c8ff' },
  { name: 'The Mad Hatter’s Clockworks', kind: 'clockworks', boss: 'madhatter', enemies: CLOCK_FOES, summon: 'spider', fog: '#2a1a12', skyTop: '#070a1c', skyHor: '#40305e', glow: '#ff9a30', glow2: '#b060ff', moon: '#dcd0ff' },
  { name: 'The Weeping Rosewood', kind: 'garden', boss: 'queen', enemies: GARDEN_FOES, summon: 'guard', fog: '#3a1422', skyTop: '#12040a', skyHor: '#962a40', glow: '#ff5a7a', glow2: '#ffb347', moon: '#ffd0d0' },
  { name: "The Queen's Croquet Grounds", kind: 'garden', boss: 'rabbit', enemies: GARDEN_FOES, summon: 'guard', fog: '#182a34', skyTop: '#040c12', skyHor: '#2a7080', glow: '#7dff9a', glow2: '#ff4040', moon: '#c8fff0' },
  { name: 'The Pool of Tears', kind: 'garden', boss: 'queen', enemies: GARDEN_FOES, summon: 'guard', fog: '#14203e', skyTop: '#030514', skyHor: '#2e52a0', glow: '#5ab4ff', glow2: '#d05aff', moon: '#d0e0ff' },
];

const HALF = 115; // playable half-extent

// Concatenate indexed geometries sharing position/normal/uv into one.
function mergeGeometries(list) {
  let vCount = 0;
  let iCount = 0;
  for (const g of list) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vo = 0;
  let io = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) {
      const src = g.index.array;
      for (let k = 0; k < src.length; k++) idx[io + k] = src[k] + vo;
      io += src.length;
    } else {
      for (let k = 0; k < n; k++) idx[io + k] = vo + k;
      io += n;
    }
    vo += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
let shared = null;
function sharedAssets() {
  if (shared) return shared;
  const marble = marbleChecker(21);
  shared = {
    marble,
    ground: groundTexture(4),
    bark: barkTexture(8),
    porcelain: porcelainTexture(31),
    clock: clockFaceTexture(),
    card: cardTexture('♥', 'Q'),
    card2: cardTexture('♠', '3'),
    moon: moonTexture(),
    cheshire: cheshireTexture(),
    skyline: skylineTexture(9),
    glow: glowTexture(),
    rock: rockTexture(61),
    leaf: leafTexture(13),
  };
  return shared;
}

export class World {
  constructor(scene, depth, seed) {
    this.scene = scene;
    this.depth = depth;
    this.theme = STAGES[(depth - 1) % STAGES.length];
    this.rng = makeRng(seed);
    this.seed = seed;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.colliders = []; // {x,z,r,top}
    this.camBlockers = []; // soft props the camera shouldn't pass through
    this.plazas = [];
    this.lanterns = [];
    this.anim = []; // per-frame animated things
    this.assets = sharedAssets();
    this.phase = this.rng() * 100;
    this.S = this.theme.size || 1; // linear scale of the garden
    this.A = this.S * this.S; // area factor for prop counts

    if (this.theme.kind === 'clockworks') {
      this.buildSky();
      buildClockworks(this);
      this.buildGrid();
      return;
    }
    this.planLayout();
    this.buildSky();
    this.buildTerrain();
    this.buildPlazas();
    this.buildMushrooms();
    this.buildTrees();
    this.buildRocks();
    this.buildHedges();
    this.buildTeacups();
    this.buildClocks();
    this.buildLanterns();
    this.buildFloatingCards();
    this.buildLights();
    this.buildGrid();
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const l of [this.sun]) {
      if (!l) continue;
      this.scene.remove(l);
      this.scene.remove(l.target);
    }
  }

  // ─── layout ───
  planLayout() {
    const r = this.rng;
    const S = this.S;
    this.spawn = { x: r.range(-20, 20) * S, z: r.range(55, 75) * S };
    // Looking glass placed far from spawn
    const a = r.range(0, TAU);
    // the Looking Glass hides deep on the far side of the garden
    this.glassPos = S > 1
      ? { x: r.range(-0.55, 0.55) * 88 * S, z: -r.range(0.55, 0.78) * 88 * S }
      : { x: Math.cos(a) * 25 + r.range(-10, 10), z: -60 + Math.sin(a) * 15 };
    this.plazas.push({ x: this.spawn.x, z: this.spawn.z, r: 14 });
    this.plazas.push({ x: this.glassPos.x, z: this.glassPos.z, r: 20 });
    let tries = 0;
    while (this.plazas.length < Math.round(9 * this.A * 0.65) && tries++ < 600) {
      const p = { x: r.range(-90, 90) * S, z: r.range(-90, 90) * S, r: r.range(9, 18) };
      if (Math.hypot(p.x, p.z) > 92 * S) continue;
      if (this.plazas.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < q.r + p.r + 8)) continue;
      this.plazas.push(p);
    }
    for (const p of this.plazas) p.h = this.rawHeight(p.x, p.z);
  }

  rawHeight(x, z) {
    const s = this.phase;
    let h = 2.6 * Math.sin(x * 0.04 + s) * Math.cos(z * 0.045 - s * 0.7)
      + 1.3 * Math.sin(x * 0.09 + z * 0.07 + s * 1.3)
      + 0.6 * Math.sin(x * 0.21 - z * 0.17 + s * 2.1);
    const d = Math.hypot(x, z);
    const edge = 96 * this.S;
    if (d > edge) h += Math.min(14, (d - edge) ** 2 * 0.06) + Math.max(0, d - edge - 24) * 0.2;
    return h;
  }

  height(x, z) {
    let h = this.heightFn ? this.heightFn(x, z) : this.gardenHeight(x, z);
    if (this.platforms) {
      for (const p of this.platforms) {
        if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r && p.h > h) h = p.h;
      }
    }
    return h;
  }

  gardenHeight(x, z) {
    let h = this.rawHeight(x, z);
    for (const p of this.plazas) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r + 10) {
        const w = d < p.r ? 1 : 1 - smooth((d - p.r) / 10);
        h = h + (p.h - h) * w;
      }
    }
    return h;
  }

  onPlaza(x, z) {
    return this.plazas.some((p) => Math.hypot(x - p.x, z - p.z) < p.r * 0.9);
  }

  // March a ray against the heightfield. Returns distance or -1.
  raycastGround(o, d, maxDist) {
    let t = 0;
    let prev = o.y - this.height(o.x, o.z);
    const step = 0.6;
    while (t < maxDist) {
      t += step;
      const x = o.x + d.x * t;
      const y = o.y + d.y * t;
      const z = o.z + d.z * t;
      const diff = y - this.height(x, z);
      if (diff < 0) {
        const k = prev / (prev - diff);
        return t - step + step * k;
      }
      prev = diff;
    }
    return -1;
  }

  // Push a circle out of solid props. Returns true if it collided.
  // ─── collision grid ───
  buildGrid() {
    this.grid = new Map();
    this.stamp = 0;
    for (const c of this.colliders) this.insertGrid(c);
  }

  insertGrid(c) {
    const k = 6;
    for (let gx = Math.floor((c.x - c.r) / k); gx <= Math.floor((c.x + c.r) / k); gx++) {
      for (let gz = Math.floor((c.z - c.r) / k); gz <= Math.floor((c.z + c.r) / k); gz++) {
        const key = gx * 1000 + gz;
        let cell = this.grid.get(key);
        if (!cell) this.grid.set(key, (cell = []));
        cell.push(c);
      }
    }
  }

  addCollider(c) {
    this.colliders.push(c);
    if (this.grid) this.insertGrid(c);
  }

  // Visit each collider whose cell overlaps the circle (x, z, r) once.
  near(x, z, r, fn) {
    const k = 6;
    const stamp = ++this.stamp;
    for (let gx = Math.floor((x - r) / k); gx <= Math.floor((x + r) / k); gx++) {
      for (let gz = Math.floor((z - r) / k); gz <= Math.floor((z + r) / k); gz++) {
        const cell = this.grid.get(gx * 1000 + gz);
        if (!cell) continue;
        for (const c of cell) {
          if (c._q === stamp) continue;
          c._q = stamp;
          fn(c);
        }
      }
    }
  }

  collide(pos, radius, y = 0) {
    let hit = false;
    this.near(pos.x, pos.z, radius, (c) => {
      if (y > c.top) return;
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const rr = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.001;
        pos.x = c.x + (dx / d) * rr;
        pos.z = c.z + (dz / d) * rr;
        hit = true;
      }
    });
    const d = Math.hypot(pos.x, pos.z);
    const lim = this.bound ?? HALF * this.S - 12;
    if (d > lim) {
      pos.x *= lim / d;
      pos.z *= lim / d;
    }
    return hit;
  }

  cameraBlocked(x, y, z) {
    if (y < this.height(x, z) + 0.3) return true;
    for (const c of this.camBlockers) {
      if (y < c.top && (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
    }
    return this.solidAt(x, y, z);
  }

  solidAt(x, y, z) {
    if (!this.grid) return this.colliders.some((c) => y <= c.top && (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r);
    let hit = false;
    this.near(x, z, 0, (c) => {
      if (!hit && y <= c.top && (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) hit = true;
    });
    return hit;
  }

  // Can an enemy be spawned standing here?
  canSpawn(x, z) {
    if (this.spawnOk) return this.spawnOk(x, z);
    return Math.hypot(x, z) < 95 * this.S && !this.solidAt(x, this.height(x, z) + 0.5, z);
  }

  freeSpot(minClear = 3, avoid = [], tries = 80) {
    for (let i = 0; i < tries; i++) {
      const s = this.sampleSpot ? this.sampleSpot() : { x: this.rng.range(-88, 88) * this.S, z: this.rng.range(-88, 88) * this.S };
      const { x, z } = s;
      if (!this.sampleSpot && Math.hypot(x, z) > 90 * this.S) continue;
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + minClear)) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < (a.r || 6))) continue;
      return { x, z };
    }
    return this.sampleSpot ? this.sampleSpot() : { x: this.rng.range(-50, 50), z: this.rng.range(-50, 50) };
  }

  add(obj) {
    this.group.add(obj);
    return obj;
  }

  // ─── sky ───
  buildSky() {
    const t = this.theme;
    const moonDir = new THREE.Vector3(140, 175, -320).normalize();
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(t.skyTop) },
        hor: { value: new THREE.Color(t.skyHor) },
        moonCol: { value: new THREE.Color(t.moon) },
        glow: { value: new THREE.Color(t.glow2) },
        moonDir: { value: moonDir },
        time: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 top, hor, moonCol, glow, moonDir; uniform float time;
        float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float noise(vec3 x){
          vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y), f.z);
        }
        float fbm(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a*noise(p); p *= 2.03; a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          float md = max(dot(d, moonDir), 0.0);
          // base gradient with a bright horizon band
          vec3 c = mix(hor, top, smoothstep(0.0, 0.8, h));
          c += hor * 0.45 * exp(-abs(h) * 6.0);
          // moon halo: wide soft bloom + tight corona
          c += moonCol * (0.16 * pow(md, 14.0) + 0.8 * pow(md, 110.0));
          c += hor * 0.3 * pow(md, 4.0) * smoothstep(-0.05, 0.3, h);
          // stars, hidden behind cloud
          vec3 q = floor(d * 520.0);
          float sh = hash(q);
          float star = step(0.9965, sh) * smoothstep(0.08, 0.45, h) * (0.55 + 0.45 * sin(time * 2.5 + sh * 70.0));
          // clouds: two drifting layers projected onto a dome
          vec2 uv = d.xz / (h + 0.18);
          float t = time * 0.012;
          float cl = fbm(vec3(uv * 1.1 + vec2(t, t * 0.4), t * 0.5));
          float cl2 = fbm(vec3(uv * 2.6 - vec2(t * 1.7, 0.0), 3.0 + t));
          float cover = smoothstep(0.42, 0.78, cl * 0.75 + cl2 * 0.4);
          cover *= smoothstep(-0.02, 0.18, h) * (1.0 - smoothstep(0.75, 1.0, h) * 0.5);
          // cloud shading: dark bellies, moon-lit silver edges, violet underglow near the horizon
          vec3 cloudCol = mix(top * 0.5, hor * 0.65, smoothstep(0.3, 0.9, cl2));
          cloudCol += moonCol * 0.55 * pow(md, 8.0) * (1.0 - cl);
          cloudCol += glow * 0.18 * exp(-h * 5.0);
          float edge = smoothstep(0.35, 0.55, cl * 0.75 + cl2 * 0.4) - smoothstep(0.55, 0.8, cl * 0.75 + cl2 * 0.4);
          cloudCol += moonCol * edge * 0.6 * pow(md, 2.0);
          c = mix(c + vec3(star), cloudCol, cover * 0.9);
          // faint aurora ribbon
          float rib = sin(d.x * 5.0 + time * 0.05 + sin(d.z * 3.0 + time * 0.03) * 2.0);
          float aur = exp(-pow((h - 0.38 - rib * 0.06) * 14.0, 2.0)) * smoothstep(0.2, 0.9, noise(vec3(d.xz * 4.0, time * 0.05)));
          c += glow * aur * 0.22 * (1.0 - cover);
          // below the horizon: sink into the fog
          c = mix(c, hor * 0.45, smoothstep(0.0, -0.15, d.y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.skyMat = skyMat;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 48, 24), skyMat);
    sky.renderOrder = -10;
    this.add(sky);
    this.sky = sky;
    this.buildCastle();

    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.assets.moon, fog: false, color: t.moon, depthWrite: false }));
    moon.scale.set(170, 170, 1);
    moon.position.set(120, 190, -380);
    this.add(moon);
    this.moon = moon;

    const ches = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.assets.cheshire, fog: false, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
    ches.scale.set(480, 240, 1);
    ches.position.set(-60, 150, -400);
    this.add(ches);
    this.cheshire = ches;

    const skyline = new THREE.Mesh(
      new THREE.CylinderGeometry(330, 330, 110, 48, 1, true),
      new THREE.MeshBasicMaterial({ map: this.assets.skyline, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false, color: new THREE.Color(t.fog).multiplyScalar(1.8) }),
    );
    this.assets.skyline.repeat.set(3, 1);
    skyline.position.y = 30;
    this.add(skyline);

    this.scene.fog = new THREE.FogExp2(t.fog, 0.0135);
    this.scene.background = new THREE.Color(t.fog);
  }


  // A distant gothic castle under the moon: layered silhouette with lit windows.
  buildCastle() {
    const W = 2048;
    const H = 1024;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    const rng = makeRng(this.seed ^ 0xca57);
    const fogC = new THREE.Color(this.theme.fog);
    const layer = (shade, scale, baseY, count, lit) => {
      x.fillStyle = `rgb(${(fogC.r * 255 * shade) | 0},${(fogC.g * 255 * shade) | 0},${(fogC.b * 255 * shade) | 0})`;
      const windows = [];
      for (let i = 0; i < count; i++) {
        const cx = W * 0.2 + rng() * W * 0.6;
        const w = (30 + rng() * 70) * scale;
        const h = (150 + rng() * 380) * scale * (1 - Math.abs(cx / W - 0.5) * 1.2);
        const top = baseY - h;
        x.fillRect(cx - w / 2, top, w, H - top);
        // spire or crenellations
        if (rng() < 0.65) {
          x.beginPath();
          x.moveTo(cx - w / 2 - 6 * scale, top);
          x.lineTo(cx, top - (60 + rng() * 140) * scale);
          x.lineTo(cx + w / 2 + 6 * scale, top);
          x.fill();
        } else {
          for (let k = 0; k < 4; k++) x.fillRect(cx - w / 2 + (k * w) / 4, top - 12 * scale, w / 8, 12 * scale);
        }
        for (let k = 0; k < 3 + rng() * 6; k++) windows.push([cx + (rng() - 0.5) * w * 0.6, top + 20 * scale + rng() * h * 0.7]);
      }
      // connecting walls and a great arched gate on the front layer
      x.fillRect(W * 0.18, baseY - 110 * scale, W * 0.64, H);
      if (lit) {
        for (const [wx, wy] of windows) {
          if (rng() < 0.45) continue;
          x.fillStyle = `rgba(255,${150 + rng() * 60},${70 + rng() * 40},${0.6 + rng() * 0.4})`;
          x.fillRect(wx, wy, 4 * scale, 8 * scale);
        }
        x.fillStyle = 'rgba(255,60,90,0.8)';
        x.beginPath();
        x.moveTo(W / 2 - 18, baseY - 110 * scale + 10);
        x.bezierCurveTo(W / 2 - 40, baseY - 140 * scale, W / 2 - 10, baseY - 150 * scale, W / 2, baseY - 128 * scale);
        x.bezierCurveTo(W / 2 + 10, baseY - 150 * scale, W / 2 + 40, baseY - 140 * scale, W / 2 + 18, baseY - 110 * scale + 10);
        x.fill();
      }
    };
    layer(0.85, 1.25, H * 0.95, 9, false);
    layer(0.45, 1.0, H, 12, true);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 210),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false, alphaTest: 0.02 }),
    );
    m.renderOrder = -8;
    this.add(m);
    this.castle = m;
    // alpha from luminance-free shapes: anything not drawn stays transparent
  }

  // ─── terrain ───
  buildTerrain() {
    const size = HALF * 2 * this.S + 60;
    const seg = Math.round(170 * Math.min(this.S, 1.4));
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const fogC = new THREE.Color(this.theme.fog);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let h = this.height(x, z);
      // tuck the terrain under the marble so the two never z-fight
      for (const p of this.plazas) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < p.r * 0.78) h -= 0.35 * Math.min(1, (p.r * 0.78 - d) / 2);
      }
      pos.setY(i, h);
      const k = clamp(0.55 + h * 0.06, 0.3, 1.0);
      colors[i * 3] = k * (0.9 + fogC.r * 0.4);
      colors[i * 3 + 1] = k * (0.85 + fogC.g * 0.3);
      colors[i * 3 + 2] = k * (1.0 + fogC.b * 0.4);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const tex = this.assets.ground;
    tex.repeat.set(size / 7, size / 7);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 4, vertexColors: true, roughness: 0.92 }));
    m.receiveShadow = true;
    this.add(m);
    this.terrain = m;
  }

  buildPlazas() {
    const { marble } = this.assets;
    const tileWorld = 1.5 * 8; // texture holds 8 tiles
    const matP = new THREE.MeshStandardMaterial({
      map: marble.map,
      emissiveMap: marble.emissive,
      emissive: new THREE.Color('#ff2030'),
      emissiveIntensity: 1.4,
      bumpMap: marble.bump,
      bumpScale: 3,
      roughnessMap: marble.rough,
      roughness: 1,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
    for (const p of this.plazas) {
      const seg = 64;
      const rings = 6;
      const verts = [0, 0, 0];
      const uvs = [p.x / tileWorld, -p.z / tileWorld];
      const idx = [];
      const jag = [];
      for (let s = 0; s < seg; s++) jag.push(0.82 + this.rng() * 0.2 + (this.rng() < 0.12 ? -0.15 : 0));
      for (let r = 1; r <= rings; r++) {
        for (let s = 0; s < seg; s++) {
          const a = (s / seg) * TAU;
          const rr = (r / rings) * p.r * (r === rings ? jag[s] : 1);
          const x = p.x + Math.cos(a) * rr;
          const z = p.z + Math.sin(a) * rr;
          verts.push(Math.cos(a) * rr, this.height(x, z) - p.h + 0.04, Math.sin(a) * rr);
          uvs.push(x / tileWorld, -z / tileWorld);
        }
      }
      for (let s = 0; s < seg; s++) idx.push(0, 1 + ((s + 1) % seg), 1 + s);
      for (let r = 1; r < rings; r++) {
        for (let s = 0; s < seg; s++) {
          const a = 1 + (r - 1) * seg + s;
          const b = 1 + (r - 1) * seg + ((s + 1) % seg);
          const c = 1 + r * seg + s;
          const d = 1 + r * seg + ((s + 1) % seg);
          idx.push(a, b, c, b, d, c);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, matP);
      m.position.set(p.x, p.h, p.z);
      m.receiveShadow = true;
      this.add(m);

      // stone rim fragments + a broken balustrade on some
      const rimMat = this.rockMaterial();
      const rimGeo = this.rimGeo ||= (() => {
        const g = new THREE.BoxGeometry(1.4, 0.4, 0.55, 6, 2, 3);
        const q = g.attributes.position;
        for (let i = 0; i < q.count; i++) {
          const n = Math.sin(q.getX(i) * 9.1 + q.getZ(i) * 5.3) * 0.03 + Math.sin(q.getY(i) * 13.7 + q.getX(i) * 3.1) * 0.025;
          q.setXYZ(i, q.getX(i) * (1 + n), q.getY(i) + (q.getY(i) > 0 ? n : 0), q.getZ(i) * (1 + n * 2));
        }
        g.computeVertexNormals();
        return g;
      })();
      const count = Math.floor(p.r * 2.2);
      const rim = new THREE.InstancedMesh(rimGeo, rimMat, count);
      const dummy = new THREE.Object3D();
      let n = 0;
      for (let i = 0; i < count; i++) {
        if (this.rng() < 0.35) continue;
        const a = (i / count) * TAU;
        const rr = p.r * 0.98;
        const x = p.x + Math.cos(a) * rr;
        const z = p.z + Math.sin(a) * rr;
        dummy.position.set(x, this.height(x, z) + 0.12, z);
        dummy.rotation.set((this.rng() - 0.5) * 0.2, -a + Math.PI / 2, (this.rng() - 0.5) * 0.2);
        dummy.updateMatrix();
        rim.setMatrixAt(n++, dummy.matrix);
        this.colliders.push({ x, z, r: 0.6, top: this.height(x, z) + 0.35, low: true });
      }
      rim.count = n;
      rim.castShadow = rim.receiveShadow = true;
      this.add(rim);
    }
  }

  // ─── mushrooms ───
  buildMushrooms() {
    const t = this.theme;
    const variants = [
      { cap: capTexture('#2a1f3a', '#3a2c52'), glow: t.glow },
      { cap: capTexture('#3a1030', '#5a1a48'), glow: t.glow2 },
    ];
    const gills = variants.map((v) => {
      const c = new THREE.Color(v.glow);
      return gillsTexture((c.r * 255) | 0, (c.g * 255) | 0, (c.b * 255) | 0);
    });
    const stemMat = new THREE.MeshStandardMaterial({ color: '#cfc2d8', roughness: 0.8, emissive: '#1a0f24' });
    const count = Math.round(22 * Math.max(1, this.A * 0.6));
    for (let i = 0; i < count; i++) {
      const spot = this.freeSpot(6, [...this.plazas.map((p) => ({ x: p.x, z: p.z, r: p.r * 0.7 })), { ...this.glassPos, r: 14 }]);
      const vi = this.rng() < 0.65 ? 0 : 1;
      const v = variants[vi];
      const H = this.rng.range(5, 15);
      const R = H * this.rng.range(0.35, 0.6);
      const stemR = R * 0.14 + 0.3;
      const g = new THREE.Group();
      const y0 = this.height(spot.x, spot.z);
      g.position.set(spot.x, y0 - 0.3, spot.z);
      const bend = this.rng.range(-1, 1) * H * 0.08;
      const stemGeo = new THREE.CylinderGeometry(stemR * 0.8, stemR * 1.3, H, 12, 10);
      const sp = stemGeo.attributes.position;
      for (let k = 0; k < sp.count; k++) {
        const yy = sp.getY(k) / H + 0.5;
        sp.setX(k, sp.getX(k) + Math.sin(yy * Math.PI) * bend);
      }
      stemGeo.computeVertexNormals();
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = H / 2;
      stem.castShadow = true;
      g.add(stem);
      // cap
      const prof = [];
      for (let k = 0; k <= 12; k++) {
        const u = k / 12;
        prof.push(new THREE.Vector2(Math.sin(u * Math.PI * 0.5) * R, Math.cos(u * Math.PI * 0.5) * R * 0.45 - u * u * R * 0.12));
      }
      prof.reverse();
      const capMat = new THREE.MeshStandardMaterial({ map: v.cap, roughness: 0.6, emissive: new THREE.Color(v.glow), emissiveIntensity: 0.08 });
      const cap = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), capMat);
      cap.position.y = H;
      cap.castShadow = true;
      g.add(cap);
      const under = new THREE.Mesh(
        new THREE.CircleGeometry(R * 0.98, 32),
        new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color(v.glow), emissiveMap: gills[vi], emissiveIntensity: 2.2, side: THREE.DoubleSide }),
      );
      under.rotation.x = Math.PI / 2;
      under.position.y = H - R * 0.12;
      g.add(under);
      // glowing drips hanging off the rim
      const dripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(v.glow).multiplyScalar(1.6) });
      const drips = Math.floor(R * 3);
      const dripGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const dm = new THREE.InstancedMesh(dripGeo, dripMat, drips);
      const dummy = new THREE.Object3D();
      for (let k = 0; k < drips; k++) {
        const a = this.rng() * TAU;
        const len = this.rng.range(0.4, 2.2);
        dummy.position.set(Math.cos(a) * R * 0.97, H - R * 0.12 - len / 2, Math.sin(a) * R * 0.97);
        dummy.scale.set(1, len * 6, 1);
        dummy.updateMatrix();
        dm.setMatrixAt(k, dummy.matrix);
      }
      g.add(dm);
      // real light only on the bigger ones
      if (H > 10 && this.lightBudget() ) {
        const l = new THREE.PointLight(v.glow, 40, R * 4, 2);
        l.position.y = H - R * 0.4;
        g.add(l);
      }
      this.add(g);
      this.colliders.push({ x: spot.x, z: spot.z, r: stemR * 1.2, top: y0 + H });
      this.colliders.push({ x: spot.x, z: spot.z, r: R * 0.9, top: y0 + H + R * 0.3, bottom: y0 + H - R * 0.2, cap: true });
      this.mushroomGlows = this.mushroomGlows || [];
      this.mushroomGlows.push({ x: spot.x, y: y0 + H - R * 0.2, z: spot.z, r: R, color: v.glow });
    }
    // caps shouldn't block walking under them
    this.colliders = this.colliders.filter((c) => !c.cap);

    // small glowing mushroom clusters
    const smallGeo = new THREE.SphereGeometry(0.3, 8, 6, 0, TAU, 0, Math.PI / 2);
    const smallMat = new THREE.MeshStandardMaterial({ color: '#221830', emissive: new THREE.Color(t.glow), emissiveIntensity: 0.75 });
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.4, 5);
    const n = Math.round(260 * Math.max(1, this.A * 0.6));
    const caps = new THREE.InstancedMesh(smallGeo, smallMat, n);
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, n);
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      let cx = this.rng.range(-95, 95) * this.S;
      let cz = this.rng.range(-95, 95) * this.S;
      if (this.onPlaza(cx, cz)) {
        cx = this.rng.range(-95, 95) * this.S;
        cz = this.rng.range(-95, 95) * this.S;
      }
      const s = this.onPlaza(cx, cz) ? 0.001 : this.rng.range(0.4, 1.6);
      const y = this.height(cx, cz);
      d.position.set(cx, y + 0.4 * s, cz);
      d.scale.setScalar(s);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      caps.setMatrixAt(i, d.matrix);
      d.position.y = y + 0.2 * s;
      d.updateMatrix();
      stems.setMatrixAt(i, d.matrix);
    }
    this.add(caps);
    this.add(stems);
  }

  lightBudget() {
    this.lights = (this.lights || 0) + 1;
    return this.lights <= 7;
  }

  // ─── twisted dead trees ───
  buildTrees() {
    const barkMat = new THREE.MeshStandardMaterial({ map: this.assets.bark, roughness: 0.95, color: '#8a7a90' });
    const branch = (group, start, dir, len, rad, depth) => {
      const pts = [start.clone()];
      const p = start.clone();
      const d = dir.clone();
      for (let i = 0; i < 5; i++) {
        d.x += (this.rng() - 0.5) * 0.6;
        d.z += (this.rng() - 0.5) * 0.6;
        d.y += (this.rng() - 0.3) * 0.2;
        d.normalize();
        p.addScaledVector(d, len / 5);
        pts.push(p.clone());
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 10, rad, 6, false);
      // taper
      const pa = geo.attributes.position;
      const tmp = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) {
        const seg = Math.floor(i / 7) / 10;
        const c = curve.getPoint(seg);
        tmp.set(pa.getX(i), pa.getY(i), pa.getZ(i)).sub(c).multiplyScalar(1 - seg * 0.75).add(c);
        pa.setXYZ(i, tmp.x, tmp.y, tmp.z);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, barkMat);
      m.castShadow = true;
      group.add(m);
      if (depth > 0) {
        const kids = 2 + Math.floor(this.rng() * 2);
        for (let k = 0; k < kids; k++) {
          const at = curve.getPoint(0.45 + this.rng() * 0.5);
          const nd = new THREE.Vector3(this.rng() - 0.5, this.rng() * 0.6 + 0.1, this.rng() - 0.5).normalize();
          branch(group, at, nd, len * 0.6, rad * 0.5, depth - 1);
        }
      }
    };
    for (let i = 0; i < Math.round(16 * Math.max(1, this.A * 0.45)); i++) {
      const s = this.freeSpot(4, this.plazas.map((p) => ({ x: p.x, z: p.z, r: p.r })));
      const g = new THREE.Group();
      const y = this.height(s.x, s.z);
      const h = this.rng.range(7, 14);
      branch(g, new THREE.Vector3(), new THREE.Vector3(0, 1, 0), h, this.rng.range(0.45, 0.8), 2);
      // one draw call per tree: fold every branch into a single mesh
      const tree = new THREE.Mesh(mergeGeometries(g.children.map((c) => c.geometry)), barkMat);
      g.children.forEach((c) => c.geometry.dispose());
      tree.position.set(s.x, y - 0.5, s.z);
      tree.castShadow = true;
      this.add(tree);
      this.colliders.push({ x: s.x, z: s.z, r: 0.7, top: y + h });
    }
  }


  rockMaterial() {
    if (!this.assets.rockMat) {
      const { map, bump } = this.assets.rock;
      this.assets.rockMat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 6, roughness: 0.85, color: '#e0d8e4' });
    }
    return this.assets.rockMat;
  }

  rockGeometries() {
    if (this.assets.rockGeos) return this.assets.rockGeos;
    const geos = [];
    for (let v = 0; v < 4; v++) {
      const g = new THREE.IcosahedronGeometry(1, v < 2 && this.S <= 1 ? 3 : 2);
      const q = g.attributes.position;
      const ph = v * 12.7;
      const vec = new THREE.Vector3();
      for (let i = 0; i < q.count; i++) {
        vec.fromBufferAttribute(q, i);
        const n = 0.22 * Math.sin(vec.x * 2.1 + ph) * Math.cos(vec.z * 1.7 - ph)
          + 0.12 * Math.sin(vec.y * 4.3 + vec.x * 3.1 + ph)
          + 0.06 * Math.sin(vec.x * 9.7 + vec.z * 8.3 + ph * 2)
          + 0.03 * Math.sin(vec.y * 17.0 + vec.z * 15.0);
        vec.multiplyScalar(1 + n);
        // facet-y chiselled planes
        if (vec.y > 0.8) vec.y = 0.8 + (vec.y - 0.8) * 0.5;
        if (vec.y < -0.1) vec.y = -0.1 + (vec.y + 0.1) * 0.25; // flat, sunk base
        vec.x *= 1 + v * 0.12;
        q.setXYZ(i, vec.x, vec.y, vec.z);
      }
      g.computeVertexNormals();
      geos.push(g);
    }
    this.assets.rockGeos = geos;
    return geos;
  }

  // Boulder clusters and scattered stones — all solid.
  buildRocks() {
    const geos = this.rockGeometries();
    const matR = this.rockMaterial();
    const per = geos.map(() => []);
    const place = (x, z, size, tilt = 0.25) => {
      const y = this.height(x, z);
      // big rocks get the finer meshes, pebbles the coarse ones
      const v = (size > 1.3 ? 0 : 2) + Math.floor(this.rng() * 2);
      const sy = size * this.rng.range(0.85, 1.35);
      per[v].push({ x, y: y - size * 0.08, z, sx: size * this.rng.range(0.8, 1.25), sy, sz: size * this.rng.range(0.8, 1.2), ry: this.rng() * TAU, rx: (this.rng() - 0.5) * tilt, rz: (this.rng() - 0.5) * tilt });
      this.colliders.push({ x, z, r: size * 0.95, top: y + sy * 0.8, low: size < 1.2 });
      if (size > 1.8) (this.boulders ||= []).push({ x, z, size });
    };
    const avoid = [...this.plazas.map((p) => ({ x: p.x, z: p.z, r: p.r + 1 })), { ...this.glassPos, r: 24 }];
    // boulder clusters
    for (let i = 0; i < Math.round(18 * Math.max(1, this.A * 0.7)); i++) {
      const s = this.freeSpot(5, avoid);
      const n = 2 + Math.floor(this.rng() * 4);
      for (let k = 0; k < n; k++) {
        const a = this.rng() * TAU;
        const d = k === 0 ? 0 : this.rng.range(1.5, 4);
        const size = k === 0 ? this.rng.range(1.8, 3.4) : this.rng.range(0.6, 1.6);
        const x = s.x + Math.cos(a) * d;
        const z = s.z + Math.sin(a) * d;
        if (this.colliders.some((c) => !c.low && Math.hypot(c.x - x, c.z - z) < c.r + size * 0.5)) continue;
        place(x, z, size);
      }
    }
    // loose stones, some on plaza edges
    for (let i = 0; i < Math.round(140 * Math.max(1, this.A * 0.6)); i++) {
      let x;
      let z;
      if (i < 50) {
        const p = this.plazas[Math.floor(this.rng() * this.plazas.length)];
        const a = this.rng() * TAU;
        const r = p.r * this.rng.range(0.95, 1.4);
        x = p.x + Math.cos(a) * r;
        z = p.z + Math.sin(a) * r;
      } else {
        x = this.rng.range(-92, 92) * this.S;
        z = this.rng.range(-92, 92) * this.S;
        if (this.onPlaza(x, z)) continue;
      }
      if (Math.hypot(x - this.glassPos.x, z - this.glassPos.z) < 7 || Math.hypot(x - this.spawn.x, z - this.spawn.z) < 5) continue;
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.4)) continue;
      place(x, z, this.rng.range(0.3, 1.0), 0.6);
    }
    const d = new THREE.Object3D();
    per.forEach((list, v) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geos[v], matR, list.length);
      list.forEach((r, i) => {
        d.position.set(r.x, r.y, r.z);
        d.rotation.set(r.rx, r.ry, r.rz);
        d.scale.set(r.sx, r.sy, r.sz);
        d.updateMatrix();
        im.setMatrixAt(i, d.matrix);
      });
      im.castShadow = im.receiveShadow = true;
      this.add(im);
    });
  }

  // ─── rose hedges ───
  buildHedges() {
    const bushGeo = new THREE.IcosahedronGeometry(1, this.S > 1 ? 1 : 2);
    const bp = bushGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const k = 0.88 + Math.sin(bp.getX(i) * 7 + bp.getY(i) * 5) * 0.08 + Math.sin(bp.getZ(i) * 11) * 0.05;
      bp.setXYZ(i, bp.getX(i) * k, bp.getY(i) * k, bp.getZ(i) * k);
    }
    bushGeo.computeVertexNormals();
    const leaf = this.assets.leaf;
    leaf.repeat.set(2, 2);
    const bushMat = new THREE.MeshStandardMaterial({ map: leaf, bumpMap: leaf, bumpScale: 3, color: '#b8d0c0', roughness: 0.55 });
    const roseGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const roseMat = new THREE.MeshStandardMaterial({ color: '#9a0a1a', roughness: 0.45, emissive: '#3a0008' });
    const N = Math.round(340 * Math.max(1, this.A * 0.6));
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, N);
    const roses = new THREE.InstancedMesh(roseGeo, roseMat, N * 6);
    const d = new THREE.Object3D();
    let rn = 0;
    let bn = 0;
    // hedges hug the plaza rims and the world edge
    const place = (x, z, s) => {
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + s)) return;
      const y = this.height(x, z);
      d.position.set(x, y + s * 0.35, z);
      d.scale.set(s * 1.2, s * 0.8, s * 1.2);
      d.rotation.set(0, this.rng() * TAU, 0);
      d.updateMatrix();
      bushes.setMatrixAt(bn++, d.matrix);
      this.camBlockers.push({ x, z, r: s * 1.1, top: y + s * 1.2 });
      this.colliders.push({ x, z, r: s * 0.95, top: y + s * 1.0, low: true });
      for (let k = 0; k < 6; k++) {
        const a = this.rng() * TAU;
        const e = this.rng() * 1.2;
        d.position.set(x + Math.cos(a) * s * 1.05 * Math.cos(e * 0.6), y + s * 0.35 + Math.sin(e) * s * 0.75, z + Math.sin(a) * s * 1.05 * Math.cos(e * 0.6));
        d.scale.setScalar(this.rng.range(0.8, 1.5) * Math.min(1.5, s * 0.6));
        d.updateMatrix();
        roses.setMatrixAt(rn++, d.matrix);
      }
    };
    for (const p of this.plazas) {
      const arcs = 2 + Math.floor(this.rng() * 2);
      for (let a = 0; a < arcs; a++) {
        const a0 = this.rng() * TAU;
        const len = this.rng.range(0.5, 1.4);
        for (let t = 0; t < len; t += 1.6 / p.r) {
          if (bn >= N - 60) break;
          const ang = a0 + t;
          const rr = p.r + 1.6;
          place(p.x + Math.cos(ang) * rr, p.z + Math.sin(ang) * rr, this.rng.range(0.9, 1.5));
        }
      }
    }
    while (bn < N) {
      const a = this.rng() * TAU;
      const rr = this.rng.range(20, 100 * this.S);
      const before = bn;
      place(Math.cos(a) * rr, Math.sin(a) * rr, this.rng.range(0.7, 1.6));
      if (bn === before) bn++; // skip slot to guarantee termination
    }
    bushes.count = Math.min(bn, N);
    roses.count = rn;
    bushes.castShadow = true;
    bushes.receiveShadow = true;
    roses.castShadow = true;
    this.add(bushes);
    this.add(roses);
  }

  // ─── toppled giant teacups ───
  buildTeacups() {
    const porc = new THREE.MeshPhysicalMaterial({ map: this.assets.porcelain, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.2, side: THREE.DoubleSide });
    const teaMat = new THREE.MeshStandardMaterial({ color: '#2a0c05', roughness: 0.05, metalness: 0.2 });
    const prof = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      prof.push(new THREE.Vector2(0.45 + Math.sin(u * Math.PI * 0.5) * 0.55 + u * u * 0.08, u * 1.0));
    }
    const cupGeo = new THREE.LatheGeometry([new THREE.Vector2(0, 0), ...prof], 32);
    for (let i = 0; i < Math.round(8 * Math.max(1, this.A * 0.5)); i++) {
      const s = this.freeSpot(7, this.plazas.map((p) => ({ x: p.x, z: p.z, r: p.r + 7 })));
      const scale = this.rng.range(2.5, 5.5);
      const y = this.height(s.x, s.z);
      const g = new THREE.Group();
      g.position.set(s.x, y, s.z);
      g.rotation.y = this.rng() * TAU;
      const cup = new THREE.Mesh(cupGeo, porc);
      cup.scale.setScalar(scale);
      const toppled = this.rng() < 0.65;
      if (toppled) {
        cup.rotation.z = Math.PI / 2 - 0.15;
        cup.position.y = scale * 0.95;
        cup.position.x = -scale * 0.3;
      }
      cup.castShadow = cup.receiveShadow = true;
      g.add(cup);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.28 * scale, 0.07 * scale, 8, 16, Math.PI * 1.3), porc);
      handle.castShadow = true;
      if (toppled) handle.position.set(-scale * 0.3, scale * 1.95, 0);
      else handle.position.set(-1.05 * scale, 0.5 * scale, 0);
      handle.rotation.z = toppled ? Math.PI * 0.85 : Math.PI * 0.35;
      g.add(handle);
      // spilled tea
      const pool = new THREE.Mesh(new THREE.CircleGeometry(scale * 1.6, 24), teaMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(toppled ? scale * 1.4 : 0, 0.05, 0);
      pool.scale.set(1.3, 0.8, 1);
      pool.receiveShadow = true;
      g.add(pool);
      // saucer
      if (!toppled || this.rng() < 0.5) {
        const saucer = new THREE.Mesh(new THREE.CylinderGeometry(scale * 1.5, scale * 1.1, scale * 0.15, 32), porc);
        saucer.position.set(toppled ? -scale * 2.2 : 0, scale * 0.07, 0);
        saucer.rotation.x = toppled ? 0.3 : 0;
        saucer.receiveShadow = saucer.castShadow = true;
        g.add(saucer);
      }
      this.add(g);
      const cx = s.x + (toppled ? Math.cos(g.rotation.y) * -scale * 0.3 : 0);
      const cz = s.z - (toppled ? Math.sin(g.rotation.y) * -scale * 0.3 : 0);
      this.colliders.push({ x: cx, z: cz, r: scale * 1.05, top: y + scale * 2 });
    }
  }

  buildClocks() {
    const face = new THREE.MeshStandardMaterial({ map: this.assets.clock, roughness: 0.5, emissive: '#ffcf8a', emissiveMap: this.assets.clock, emissiveIntensity: 0.15 });
    const gold = mat('#9a7a3a', { metalness: 0.8, roughness: 0.35 });
    for (let i = 0; i < Math.round(5 * Math.max(1, this.A * 0.5)); i++) {
      const s = this.freeSpot(6, this.plazas.map((p) => ({ x: p.x, z: p.z, r: p.r + 5 })));
      const R = this.rng.range(2, 4.5);
      const y = this.height(s.x, s.z);
      const g = new THREE.Group();
      g.position.set(s.x, y + R * 0.55, s.z);
      g.rotation.set(this.rng.range(-0.4, 0.2), this.rng() * TAU, this.rng.range(-0.3, 0.3));
      const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, R * 0.25, 40), gold);
      body.rotation.x = Math.PI / 2;
      body.castShadow = true;
      g.add(body);
      const f = new THREE.Mesh(new THREE.CircleGeometry(R * 0.9, 40), face);
      f.position.z = R * 0.13;
      g.add(f);
      const hands = [];
      for (const [len, w] of [[0.55, 0.06], [0.8, 0.035]]) {
        const h = new THREE.Group();
        h.position.z = R * 0.15;
        const b = new THREE.Mesh(new THREE.BoxGeometry(R * w, R * len, 0.05), mat('#140a0a'));
        b.position.y = (R * len) / 2;
        h.add(b);
        g.add(h);
        hands.push(h);
      }
      const speed = this.rng.range(0.2, 1.5) * (this.rng() < 0.5 ? -1 : 1);
      this.anim.push((t) => {
        hands[0].rotation.z = -t * speed * 0.08;
        hands[1].rotation.z = -t * speed;
      });
      this.add(g);
      this.colliders.push({ x: s.x, z: s.z, r: R * 0.7, top: y + R * 1.5 });
    }
  }

  buildLanterns() {
    const iron = mat('#16111a', { metalness: 0.7, roughness: 0.4 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffb257' });
    const haloMat = new THREE.SpriteMaterial({ map: this.assets.glow, color: '#ff9a40', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
    for (const p of this.plazas) {
      const n = 2 + Math.floor(this.rng() * 3);
      for (let i = 0; i < n; i++) {
        const a = this.rng() * TAU;
        const x = p.x + Math.cos(a) * (p.r - 1.2);
        const z = p.z + Math.sin(a) * (p.r - 1.2);
        const y = this.height(x, z);
        const g = new THREE.Group();
        g.position.set(x, y, z);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 4.2, 6), iron);
        pole.position.y = 2.1;
        pole.castShadow = true;
        g.add(pole);
        const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.6, 6, 1, true), new THREE.MeshStandardMaterial({ color: '#16111a', metalness: 0.7, roughness: 0.4, wireframe: true }));
        cage.position.y = 4.4;
        g.add(cage);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.4, 6), iron);
        cap.position.y = 4.9;
        g.add(cap);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), bulbMat);
        bulb.position.y = 4.4;
        g.add(bulb);
        const halo = new THREE.Sprite(haloMat);
        halo.scale.set(3, 3, 1);
        halo.position.y = 4.4;
        g.add(halo);
        if (this.lightBudget()) {
          const l = new THREE.PointLight('#ff9a48', 30, 16, 1.8);
          l.position.y = 4.3;
          g.add(l);
          const phase = this.rng() * 10;
          this.anim.push((t) => {
            l.intensity = 26 + Math.sin(t * 13 + phase) * 3 + Math.sin(t * 7.3 + phase) * 3;
          });
        }
        this.add(g);
        this.colliders.push({ x, z, r: 0.3, top: y + 5 });
      }
    }
  }

  buildFloatingCards() {
    const n = Math.round(90 * this.S);
    const geo = new THREE.PlaneGeometry(0.7, 1.0);
    const m1 = new THREE.MeshStandardMaterial({ map: this.assets.card, side: THREE.DoubleSide, roughness: 0.7, emissive: '#221018' });
    const inst = new THREE.InstancedMesh(geo, m1, n);
    const data = [];
    for (let i = 0; i < n; i++) {
      data.push({
        x: this.rng.range(-90, 90) * this.S, z: this.rng.range(-90, 90) * this.S, y: this.rng.range(3, 22),
        rx: this.rng() * TAU, ry: this.rng() * TAU, sp: this.rng.range(0.2, 0.9), ph: this.rng() * TAU,
      });
    }
    const d = new THREE.Object3D();
    this.anim.push((t, dt) => {
      for (let i = 0; i < n; i++) {
        const c = data[i];
        c.x += Math.sin(t * 0.1 + c.ph) * dt * 0.8;
        c.z += dt * 0.6 * c.sp;
        if (c.z > 95 * this.S) c.z = -95 * this.S;
        d.position.set(c.x, c.y + Math.sin(t * c.sp + c.ph) * 1.2, c.z);
        d.rotation.set(c.rx + t * c.sp, c.ry + t * c.sp * 0.7, 0);
        d.updateMatrix();
        inst.setMatrixAt(i, d.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    });
    inst.frustumCulled = false;
    this.add(inst);
  }

  buildLights() {
    const t = this.theme;
    const hemi = new THREE.HemisphereLight(new THREE.Color(t.skyHor).lerp(new THREE.Color('#9a88d0'), 0.5), '#150a14', 0.7);
    this.add(hemi);
    const amb = new THREE.AmbientLight('#3a2850', 0.25);
    this.add(amb);
    const sun = new THREE.DirectionalLight(t.moon, 1.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -40;
    sc.right = 40;
    sc.top = 40;
    sc.bottom = -40;
    sc.near = 1;
    sc.far = 200;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    RIM.rimColor.value.set(t.glow2).lerp(new THREE.Color('#c0a0ff'), 0.55);
  }

  update(t, dt, focus) {
    for (const f of this.anim) f(t, dt);
    if (this.onUpdate) this.onUpdate(t, dt, focus);
    this.skyMat.uniforms.time.value = t;
    this.cheshire.material.opacity = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.25));
    // celestial props ride along with the player so they sit at a fixed sky angle
    this.moon.position.set(focus.x + 140, 175, focus.z - 320);
    this.sky.position.set(focus.x, 0, focus.z);
    this.castle.position.set(focus.x + 110, this.castleY ?? 70, focus.z - 330);
    this.castle.lookAt(focus.x, this.castleY ?? 70, focus.z);
    this.cheshire.position.set(focus.x - 90, 150, focus.z + 360);
    // shadow frustum follows the player
    this.sun.position.set(focus.x + 60, focus.y + 90, focus.z - 70);
    this.sun.target.position.set(focus.x, focus.y, focus.z);
  }
}
