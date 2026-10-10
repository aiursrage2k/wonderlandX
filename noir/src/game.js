// The streets: Mack on foot or behind the wheel, Sally on rockets, the
// Technicolor Syndicate painting the town, portals, bosses and the case logic.
import * as THREE from 'three';
import { NU, splat, stroke, wash, fadeAll, clearPaint, flushPaint, coverage } from './paint.js';
import { buildCity, knock, L, C, DISTRICTS, roadC, nodeIndex, pushOut, rayDist, clearLine, roadPoint, lamps, vents, cops, copCars, flaskSpots, signs } from './city.js';
import { rainbowCoat as rainbowMatLocal } from './models.js';
import { makeDetective, makeSally, makeGangster, makeCar, makePortal, makePrismKing, makeMayor, makeFlask, makeRainbowGoon, makeRoomba, makeTruck, makeCopter, makeMech, makeCultist, makeImp, makeBeast, makeRobot, makeCivilian, setInfected, makeCop, drainModel, GANG_COLORS, gangMat } from './models.js';
import { makeRain, Particles, Tracers, Flashes, hexToRgb, fx } from './fx.js';
import { sfx, setEngine } from './audio.js';
import { BOSSES, LINES, DONUT_LINES, COP_RETORTS, MONOLOGUES, EVIDENCE, RADIO, RADIO_FILLER } from './story.js';
import { clamp, rand, pick, weighted, wrapAngle, Deck } from './util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// how much paint each case's bleedCap tolerates; tuned so standing idle loses in ~4 minutes
const BLEED_SCALE = 0.65;
// Sally's rockets: speed, how hard they turn toward a lock (rad/s), blast radius and damage
const ROCKET_SPEED = 46, ROCKET_TURN = 3.4, BLAST_R = 9.5, BLAST_DMG = 115;
const TRAIL_TYPES = new Set(['dauber', 'hood', 'goon', 'cultist']);
// portals: an opening burst, then one goon every few seconds; at most 5 alive per portal and 20 on the streets
const PORTAL_BURST = 5, PORTAL_TRICKLE = 5, PORTAL_MAX = 5, MAX_GOONS = 20;
const TYPES = {
  dauber: { hp: 30, speed: 6.5, r: 0.8, scale: 1 },
  hood: { hp: 55, speed: 7.2, r: 0.8, scale: 1 },
  roller: { hp: 210, speed: 4.3, r: 1.2, scale: 1.4 },
  lowrider: { hp: 170, speed: 19, r: 2.6, scale: 1 },
  goon: { hp: 95, speed: 7.6, r: 0.8, scale: 1.05 },
  roomba: { hp: 380, speed: 7.5, r: 3.6, scale: 1 },
  truck: { hp: 340, speed: 15, r: 3.2, scale: 1 },
  copter: { hp: 240, speed: 15, r: 4, scale: 1 },
  cultist: { hp: 70, speed: 5.5, r: 0.8, scale: 1 },
  imp: { hp: 45, speed: 11.5, r: 0.7, scale: 1 },
  demon: { hp: 120, speed: 13, r: 1.4, scale: 1.6 },
  beast: { hp: 900, speed: 4.2, r: 3.2, scale: 1 },
  cop: { hp: 60, speed: 6, r: 1.0, scale: 1 },
  copcar: { hp: 260, speed: 24, r: 2.6, scale: 1 },
};

export function createGame({ renderer, hud, onEnd, onBar }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x24272c);
  scene.fog = new THREE.FogExp2(0x24272c, 0.0058);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 900);

  // environment for wet reflections: a dim city glow
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0b0c0e);
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4 + Math.random() * 10, 2 + Math.random() * 10), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(0.4 + Math.random() * 1.6), side: THREE.DoubleSide }));
    const a = Math.random() * Math.PI * 2;
    m.position.set(Math.cos(a) * 40, Math.random() * 20 - 2, Math.sin(a) * 40);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.7;

  const hemi = new THREE.HemisphereLight(0x9aa6b8, 0x2a2a2e, 1.15);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xc8d4e6, 1.5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 220 });
  moon.shadow.bias = -0.0008;
  scene.add(moon, moon.target);
  // skid marks: a ring buffer of dark rubber stripes on the wet road
  const SKIDS = 900;
  const skids = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 1.0), new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.55, depthWrite: false }), SKIDS);
  skids.frustumCulled = false; skids.count = 0;
  const _sm = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _sp = new THREE.Vector3(), _ss = new THREE.Vector3(1, 1, 1);
  let skidI = 0;
  function skidMark(x, z, ang, len) {
    _sq.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang));
    _sp.set(x, 0.06, z); _ss.set(1, Math.max(0.3, len), 1);
    skids.setMatrixAt(skidI, _sm.compose(_sp, _sq, _ss));
    skidI = (skidI + 1) % SKIDS; skids.count = Math.max(skids.count, skidI === 0 ? SKIDS : skidI);
    skids.instanceMatrix.needsUpdate = true;
  }
  // a hard pool of light that follows Mack, like every noir hero gets
  const heroSpot = new THREE.SpotLight(0xfff4e6, 2600, 70, 0.42, 0.75, 1.4);
  heroSpot.castShadow = true;
  heroSpot.shadow.mapSize.set(1024, 1024);
  heroSpot.shadow.bias = -0.0006;
  scene.add(heroSpot, heroSpot.target);
  const lampPool = [];
  for (let i = 0; i < 8; i++) { const l = new THREE.PointLight(0xfff1d8, 0, 34, 1.6); scene.add(l); lampPool.push(l); }

  const city = buildCity(scene);
  scene.add(skids);
  const rain = makeRain(24000);
  scene.add(rain);
  const parts = new Particles(6000);
  scene.add(parts.mesh);
  const tracers = new Tracers(300);
  scene.add(tracers.mesh);
  const flashes = new Flashes(scene, 5);

  // headlights for Mack's car
  const headL = new THREE.SpotLight(0xffffff, 0, 60, 0.45, 0.5, 1.2);
  const headR = headL.clone();
  scene.add(headL, headR, headL.target, headR.target);

  // ---- persistent actors
  const mack = makeDetective();
  scene.add(mack.root);
  const sallyM = makeSally();
  scene.add(sallyM.root);
  const carM = makeCar('sedan');
  scene.add(carM.root);
  const sallyInCar = new THREE.Group(); // Sally's red dress through the passenger window
  {
    const red = sallyM.root.children.find((c) => c.isMesh && c.geometry.type === 'CylinderGeometry');
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), red.material);
    torso.position.set(0.55, 1.35, -0.2); sallyInCar.add(torso);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe2b64a, roughness: 0.35, emissive: 0x4a3200 }));
    hair.position.set(0.55, 1.85, -0.2); sallyInCar.add(hair);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.4, 10), new THREE.MeshStandardMaterial({ color: 0x3c3f3a }));
    tube.rotation.x = Math.PI / 2; tube.position.set(1.15, 1.6, 0.2); sallyInCar.add(tube);
    sallyInCar.userData.tube = tube;
    carM.body.add(sallyInCar);
  }
  const rocketGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.0, 8);
  rocketGeo.rotateX(Math.PI / 2);
  const rocketMat = new THREE.MeshBasicMaterial({ color: 0xff1a2a });
  // Sally's lock-on reticle: a red ring with four ticks, drawn on top of everything
  const lockRet = new THREE.Group();
  {
    const lm = new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40), lm); ring.rotation.x = -Math.PI / 2; lockRet.add(ring);
    for (let k = 0; k < 4; k++) { const tk = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.45), lm); tk.rotation.x = -Math.PI / 2; tk.rotation.z = k * Math.PI / 2; tk.position.set(Math.sin(k * Math.PI / 2) * 1.12, 0, Math.cos(k * Math.PI / 2) * 1.12); lockRet.add(tk); }
    lockRet.renderOrder = 5; lockRet.traverse((o) => { o.renderOrder = 5; });
    lockRet.visible = false; scene.add(lockRet);
  }
  const ballGeo = new THREE.SphereGeometry(0.32, 10, 8);
  const donutGeo = new THREE.TorusGeometry(1.1, 0.5, 10, 18);
  const pillMat = new THREE.MeshStandardMaterial({ color: 0xff8a1a, roughness: 0.3, emissive: 0x552200 });
  const pillCap = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const pillPickupModel = () => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14), pillMat); b.position.y = 0.5; g.add(b);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.25, 14), pillCap); c.position.y = 1.1; g.add(c);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.02), pillCap); l.position.set(0, 0.5, 0.42); g.add(l);
    return g;
  };
  const evPaper = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.7, emissive: 0x555555 });
  const evPin = new THREE.MeshBasicMaterial({ color: 0xff2030 });
  const evidenceModel = () => {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 1.5), evPaper); p.rotation.x = -0.9; p.position.y = 1.0; g.add(p);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), evPin); pin.position.set(0, 1.55, -0.3); g.add(pin);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.6, 30), new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
    return g;
  };
  const flaskPickupModel = () => { const f = makeFlask(1.4); f.traverse((o) => { if (o.isMesh) o.castShadow = false; }); return f; };

  // beam for the Prism King
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float t; varying vec2 vUv; void main(){ vec3 c = 0.6 + 0.5 * cos(6.2831 * (vec3(0.0,0.33,0.67) + vUv.y * 3.0 - t)); gl_FragColor = vec4(c * 1.4, 0.85); }',
  });
  const aimLine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.45, depthWrite: false }));
  aimLine.visible = false;
  scene.add(aimLine);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 10, 1, true), beamMat);
  beam.visible = false;
  scene.add(beam);

  // ---- input
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, right: false };
  const aim = V();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(V(0, 1, 0), -1.4);
  const pressed = new Set();
  addEventListener('keydown', (e) => { if (!keys.has(e.code)) pressed.add(e.code); keys.add(e.code); if (S && S.running && ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  const canvas = renderer.domElement;
  canvas.addEventListener('mousemove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1; });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.down = true; if (e.button === 2) mouse.right = true; });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.right = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  let zoom = 1;
  canvas.addEventListener('wheel', (e) => { zoom = clamp(zoom * (e.deltaY > 0 ? 1.1 : 1 / 1.1), 0.45, 1.9); e.preventDefault(); }, { passive: false });

  // ---- state
  let S = null;
  const P = { pos: V(), face: 0, hp: 100, maxHp: 100, flasks: 3, maxFlasks: 5, focus: 0, focusMeter: 1, focusHeld: false, pills: 2, color: 0, ammo: 6, reload: 0, kick: 0, aiming: false, aimT: 0, focusOn: false, holsterT: 0, inCar: false, fireCd: 0, roll: 0, rollCd: 0, rollDir: V(), hurtT: 0, lastHurt: 0, walk: 0 };
  const SA = { pos: V(), face: 0, cd: 2, walk: 0, inCar: false, hp: 120, maxHp: 120, down: false, lastHurt: 0, downT: 0 };
  const CAR = { pos: V(), ang: 0, vx: 0, vz: 0, steer: 0, hp: 400, alive: true, respawn: 0, speed: 0, boost: 1, boosting: false, skidT: 0, screechT: 0 };
  const radioDeck = new Deck(RADIO_FILLER), killDeck = new Deck(LINES.kill), rocketDeck = new Deck(LINES.sallyRocket), donutDeck = new Deck(DONUT_LINES), copDeck = new Deck(COP_RETORTS);

  // ===================================================================== newsreel recording
  const r1 = (v) => Math.round(v * 10) / 10;
  function recEvent(ev) { if (S && !S.replay && S.rec.events.length < 8000) S.rec.events.push([r1(S.time), ...ev]); }
  function recFrame(rdt) {
    S.recT -= rdt;
    if (S.recT > 0 || S.rec.frames.length > 9000) return;
    S.recT = 0.12;
    S.rec.frames.push([r1(S.time), r1(P.pos.x), r1(P.pos.z), Math.round(P.face * 100) / 100, P.inCar ? 1 : 0, r1(CAR.pos.x), r1(CAR.pos.z), Math.round(CAR.ang * 100) / 100, r1(SA.pos.x), r1(SA.pos.z), S.firing ? 1 : 0]);
    S.firing = false;
  }

  function startReplay(caseDef, rec) {
    start(caseDef, {});
    for (const p of S.pickups) scene.remove(p.mesh);
    S.pickups.length = 0;
    S.replay = rec; S.ri = 0; S.ei = 0; S.stage = null; S.shotT = 0;
    hud.objective('From the vaults of the Daily Grey'); hud.progress('');
  }

  function updateReplay(rdt) {
    const R = S.replay, F = R.frames;
    S.time += rdt;
    while (S.ri < F.length - 2 && F[S.ri + 1][0] <= S.time) S.ri++;
    const a = F[S.ri], b = F[Math.min(F.length - 1, S.ri + 1)];
    const k = b[0] > a[0] ? clamp((S.time - a[0]) / (b[0] - a[0]), 0, 1) : 0;
    const L2 = (i) => a[i] + (b[i] - a[i]) * k;
    const lastP = P.pos.clone();
    P.pos.set(L2(1), 0, L2(2)); P.face = a[3] + wrapAngle(b[3] - a[3]) * k;
    if (!!a[4] !== P.inCar) { P.inCar = !!a[4]; SA.inCar = P.inCar; mack.root.visible = !P.inCar; sallyM.root.visible = !P.inCar; }
    CAR.pos.set(L2(5), 0, L2(6)); CAR.ang = a[7] + wrapAngle(b[7] - a[7]) * k;
    const lastS = SA.pos.clone();
    SA.pos.set(L2(8), 0, L2(9));
    const pv = P.pos.distanceTo(lastP) / Math.max(rdt, 1e-3);
    P.moving = pv > 1;
    CAR.vx = (CAR.pos.x - (carM.root.position.x)) / Math.max(rdt, 1e-3); CAR.vz = (CAR.pos.z - carM.root.position.z) / Math.max(rdt, 1e-3);
    CAR.speed = Math.hypot(CAR.vx, CAR.vz);
    carM.root.position.set(CAR.pos.x, 0, CAR.pos.z); carM.root.rotation.y = CAR.ang;
    carM.wheels.forEach((w) => w.children.forEach((c) => (c.rotation.x += CAR.speed * rdt / 0.42)));
    sallyInCar.visible = SA.inCar;
    headL.intensity = headR.intensity = P.inCar ? 160 : 0;
    aim.set(P.pos.x + Math.sin(P.face) * 10, 1.4, P.pos.z + Math.cos(P.face) * 10);
    P.aimT = a[10] ? 1 : Math.max(0, P.aimT - rdt * 2);
    S.shotT -= rdt;
    if (a[10] && !P.inCar && S.shotT <= 0) {
      S.shotT = 0.09;
      const o = V(P.pos.x + Math.sin(P.face) * 1.3, 1.45, P.pos.z + Math.cos(P.face) * 1.3);
      const d = rayDist(o.x, o.z, Math.sin(P.face), Math.cos(P.face), 60);
      tracers.add(o, V(o.x + Math.sin(P.face) * d, 1.45, o.z + Math.cos(P.face) * d), [1, 0.95, 0.8]);
      sfx.tommy(); flashes.light(o.x, o.y, o.z, 120, 0.05);
    }
    const E = R.events;
    while (S.ei < E.length && E[S.ei][0] <= S.time) {
      const ev = E[S.ei++];
      if (ev[1] === 'k') { const e = addEnemy(ev[5] === 'lowrider' ? 'hood' : ev[5], ev[2], ev[3], { color: ev[4] }); e.model.root.position.set(ev[2], 0, ev[3]); killEnemy(e); }
      else if (ev[1] === 'po') openPortal({ x: ev[2], z: ev[3] });
      else if (ev[1] === 'pc') { const q = S.portals.find((o) => Math.hypot(o.pos.x - ev[2], o.pos.z - ev[3]) < 3); if (q) closePortal(q); }
      else if (ev[1] === 'r') { const m = new THREE.Mesh(rocketGeo, rocketMat); const dx = ev[4] - ev[2], dz = ev[5] - ev[3], dd = Math.hypot(dx, dz) || 1; m.position.set(ev[2], 1.7, ev[3]); scene.add(m); S.rockets.push({ mesh: m, pos: m.position.clone(), vx: dx / dd * 48, vz: dz / dd * 48, life: Math.min(1.6, dd / 48), target: null }); sfx.rocket(); }
    }
    // gangsters keep painting around the hero in the reel
    if (Math.random() < rdt * 4) { const p = roadPoint(S.area); splat(p.x, p.z, rand(1.5, 3.5), pick(GANG_COLORS), 0.8, 6); }
    updatePlayerModel(rdt);
    sallyM.root.position.set(SA.pos.x, 0, SA.pos.z);
    const sv = SA.pos.distanceTo(lastS) / Math.max(rdt, 1e-3);
    if (sv > 0.5) sallyM.root.rotation.y = Math.atan2(SA.pos.x - lastS.x, SA.pos.z - lastS.z);
    animWalk(sallyM, Math.min(13, sv), rdt);
    updatePortals(rdt); updateRockets(rdt); updateBodies(rdt);
    world(rdt, rdt); updateCamera(rdt);
    S.bleedT -= rdt;
    if (S.bleedT <= 0) { S.bleedT = 0.5; S.bleed = clamp(coverage(S.area) / S.caseDef.bleedCap, 0, 1); NU.paintH.value = 6 + S.bleed * 24; }
    flushPaint(rdt);
    hud.update({ hp: 1, flasks: 0, maxFlasks: 0, focusMeter: 1, pills: 0, ammo: 6, bleed: Math.min(1, S.bleed), focus: false, inCar: P.inCar, carHp: 1, carAlive: true, player: focus(), enemies: S.enemies, portals: S.portals, car: CAR, sally: SA, boss: null, hint: '', camera, time: S.time });
    if (S.time > F[F.length - 1][0] + 1.5 || pressed.has('Escape')) { S.running = false; onEnd({ replay: true }); }
    pressed.clear();
  }

  // timers on the game clock (pause-safe, and they run under fast-forward)
  function later(fn, ms) { if (S) S.timers.push({ t: ms / 1000, fn, s: S }); }
  function runTimers(dt) {
    const T = S.timers;
    for (let i = T.length - 1; i >= 0; i--) {
      T[i].t -= dt;
      if (T[i].t <= 0) { const x = T.splice(i, 1)[0]; if (x.s === S) x.fn(); if (!S) return; }
    }
  }

  // ===================================================================== hell
  const fissureMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float t; varying vec2 vUv;
      void main(){
        float jag = abs(vUv.x - 0.5 - 0.18 * sin(vUv.y * 40.0) * sin(vUv.y * 7.0 + 1.0));
        float core = smoothstep(0.16, 0.0, jag), glow = smoothstep(0.5, 0.0, jag) * 0.5;
        vec3 c = 0.6 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + vUv.y * 2.0 - t * 0.4));
        float ends = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
        gl_FragColor = vec4(c * (core * 2.0 + glow), (core + glow) * ends);
      }`,
  });
  const baseBg = scene.background.clone(), hellBg = new THREE.Color(0x3a0c14), hellBg2 = new THREE.Color(0x52101a);
  function makeFissures(level) {
    S.fissures = [];
    const n = level * 7;
    for (let i = 0; i < n; i++) {
      const p = S.area ? roadPoint(S.area) : (i % 2 ? roadPoint(DISTRICTS['Civic Center']) : roadPoint(null));
      const len = rand(24, 50);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(rand(2, 4), len), fissureMat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = rand(0, Math.PI);
      m.position.set(p.x, 0.12, p.z);
      scene.add(m);
      S.fissures.push({ m, x: p.x, z: p.z, len, t: rand(0, 2) });
    }
  }
  function updateHell(dt) {
    const lvl = S.caseDef.hell || 0;
    const target = lvl === 2 ? hellBg2 : lvl === 1 ? hellBg : baseBg;
    scene.background.lerp(target, Math.min(1, dt));
    scene.fog.color.copy(scene.background);
    if (!S.fissures) return;
    fissureMat.uniforms.t.value = S.time;
    for (const f2 of S.fissures) {
      f2.t -= dt;
      if (Math.random() < dt * 6) parts.spawn(f2.x + rand(-6, 6), 0.3, f2.z + rand(-6, 6), rand(-0.5, 0.5), rand(3, 7), rand(-0.5, 0.5), { life: 1.2, size: 0.4, color: hexToRgb(pick(GANG_COLORS)) });
      if (f2.t <= 0) { f2.t = rand(3.5, 6); splat(f2.x + rand(-8, 8), f2.z + rand(-8, 8), rand(1, 2), pick(GANG_COLORS), 0.75, 4); }
    }
  }

  // ===================================================================== smash
  // Crashes hurt the Packard visibly: sparks, flying debris, parts tearing off,
  // smoke from the hood and finally fire.
  const debrisGeo = new THREE.BoxGeometry(0.3, 0.12, 0.4);
  const debrisMats = [new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.1, metalness: 1 }), new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.05, metalness: 0.9 })];
  const debris = [];
  function spawnDebris(x, y, z, vx, vz, n = 6, mesh = null) {
    for (let k = 0; k < n; k++) {
      let m;
      if (mesh && k === 0) {
        m = mesh.clone(); m.material = mesh.material;
        mesh.updateWorldMatrix(true, false);
        mesh.getWorldPosition(m.position); mesh.getWorldQuaternion(m.quaternion); mesh.getWorldScale(m.scale);
        mesh.visible = false;
      } else {
        m = new THREE.Mesh(debrisGeo, pick(debrisMats));
        m.position.set(x + rand(-1, 1), y + rand(0, 1), z + rand(-1, 1));
        m.scale.setScalar(rand(0.6, 1.8));
      }
      m.castShadow = true;
      scene.add(m);
      debris.push({ m, v: V(vx * rand(0.3, 0.8) + rand(-6, 6), rand(4, 10), vz * rand(0.3, 0.8) + rand(-6, 6)), w: V(rand(-8, 8), rand(-8, 8), rand(-8, 8)), rest: false });
    }
    while (debris.length > 140) scene.remove(debris.shift().m);
  }
  function updateDebris(dt) {
    for (const d of debris) {
      if (d.rest) continue;
      d.v.y -= 22 * dt;
      d.m.position.addScaledVector(d.v, dt);
      d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
      if (d.m.position.y < 0.08) { d.m.position.y = 0.08; d.v.y *= -0.3; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.5); if (Math.abs(d.v.y) < 1) d.rest = true; }
    }
  }
  function sparks(x, y, z, n = 18, dx = 0, dz = 0) {
    for (let k = 0; k < n; k++) parts.spawn(x, y, z, dx * 0.3 + rand(-9, 9), rand(2, 9), dz * 0.3 + rand(-9, 9), { life: rand(0.2, 0.5), size: rand(0.15, 0.35), color: [1, 0.85, 0.45], grav: 25 });
  }
  // impact on the Packard: a big hit is a SMASH
  function smashCar(force, x, z, nx = 0, nz = 0) {
    sparks(x, 1, z, Math.min(40, 10 + force * 1.5), -nx * 10, -nz * 10);
    if (force > 10) {
      fx.shake = Math.max(fx.shake, Math.min(1, force / 30));
      spawnDebris(x, 1, z, -nx * 8 + CAR.vx * 0.3, -nz * 8 + CAR.vz * 0.3, Math.min(8, Math.floor(force / 5)));
      if (force > 18) hud.floater(V(x, 0, z), pick(['SMASH!', 'CRUNCH!', 'KRAK!', 'WHAM!']));
    }
    carDamageVisuals();
  }
  function carDamageVisuals() {
    const b = carM.breakable; if (!b) return;
    const hp = CAR.hp / 400;
    const tear = (mesh) => { if (mesh && mesh.visible) spawnDebris(0, 0, 0, CAR.vx, CAR.vz, 1, mesh); };
    if (hp < 0.8) tear(b.orn[0]), tear(b.orn[1]);
    if (hp < 0.65) tear(b.bumperF), b.guards.slice(0, 2).forEach(tear);
    if (hp < 0.5) tear(b.lights[0]);
    if (hp < 0.38) tear(b.bumperR), b.guards.slice(2).forEach(tear);
    if (hp < 0.25) tear(b.lights[1]);
    carM.body.rotation.z = (1 - hp) * 0.06; // the frame sags
  }
  function restoreCar() {
    const b = carM.breakable; if (!b) return;
    for (const m of [b.bumperF, b.bumperR, ...b.orn, ...b.lights, ...b.guards]) m.visible = true;
  }
  function carSmoke(dt) {
    if (!CAR.alive) return;
    const hp = CAR.hp / 400;
    if (hp > 0.55) return;
    const hx = CAR.pos.x + Math.sin(CAR.ang) * 2.2, hz = CAR.pos.z + Math.cos(CAR.ang) * 2.2;
    if (Math.random() < dt * (hp < 0.3 ? 30 : 12)) parts.spawn(hx + rand(-0.5, 0.5), 1.4, hz + rand(-0.5, 0.5), rand(-0.5, 0.5), rand(2, 4), rand(-0.5, 0.5), { life: 1.6, size: 1.6, grow: 2.5, color: hp < 0.3 ? [0.08, 0.08, 0.09] : [0.55, 0.56, 0.58], alpha: 0.6, drag: 1, kind: 1 });
    if (hp < 0.25 && Math.random() < dt * 25) parts.spawn(hx + rand(-0.4, 0.4), 1.3, hz + rand(-0.4, 0.4), rand(-0.3, 0.3), rand(2, 4), rand(-0.3, 0.3), { life: 0.4, size: rand(0.6, 1.1), color: [1, 0.55, 0.15], kind: 1 });
  }

  // ===================================================================== score
  // Kills and seals score points times the multiplier; chaining kills builds it,
  // getting hit or going quiet bleeds it away.
  const POINTS = { dauber: 100, hood: 150, goon: 250, roller: 300, lowrider: 400, truck: 600, roomba: 700, copter: 700, cultist: 250, imp: 120, demon: 350, beast: 1500, boss: 5000, cop: 0, copcar: 0 };
  function addScore(base, x, z, label) {
    const pts = Math.round(base * S.mult);
    S.score += pts;
    if (x !== undefined && pts) hud.floater(V(x, 0, z), `${label ? label + ' ' : ''}+${pts}${S.mult > 1 ? ' ×' + S.mult.toFixed(1).replace('.0', '') : ''}`);
  }
  function bumpCombo(by = 0.25) { S.mult = Math.min(8, S.mult + by); S.comboT = 5; }
  function dropCombo(by = 1) { S.mult = Math.max(1, S.mult - by); }
  function updateCombo(dt) { if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.mult = 1; } }

  // ===================================================================== knocking things over
  const knockGrid = new Map();
  const kCell = (x, z) => `${Math.floor(x / 12)},${Math.floor(z / 12)}`;
  if (knock.lamps) lamps.forEach((l, i) => { const k = kCell(l.x, l.z); if (!knockGrid.has(k)) knockGrid.set(k, []); knockGrid.get(k).push({ lamp: i, x: l.x, z: l.z }); });
  for (const p of knock.props) { const k = kCell(p.x, p.z); if (!knockGrid.has(k)) knockGrid.set(k, []); knockGrid.get(k).push({ prop: p, x: p.x, z: p.z }); }
  const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function resetKnocks() {
    const K = knock.lamps;
    if (K) lamps.forEach((l, i) => { if (!l.down) return; l.down = false; K.poles.setMatrixAt(i, K.orig[i][0]); K.arms.setMatrixAt(i, K.orig[i][1]); K.heads.setMatrixAt(i, K.orig[i][2]); K.streaks.setMatrixAt(i, K.orig[i][3]); });
    if (K) for (const m of [K.poles, K.arms, K.heads, K.streaks]) m.instanceMatrix.needsUpdate = true;
    for (const p of knock.props) if (p.down) { p.down = false; p.mesh.setMatrixAt(p.i, p.orig); p.mesh.instanceMatrix.needsUpdate = true; }
    if (knock.meterHeads) { let j = 0; for (const p of knock.props) if (p.type === 'meter') knock.meterHeads.setMatrixAt(j++, new THREE.Matrix4().makeTranslation(p.x, 0.3, p.z)); knock.meterHeads.instanceMatrix.needsUpdate = true; }
  }
  function knockAt(x, z, r, vx, vz, power) {
    const cx = Math.floor(x / 12), cz = Math.floor(z / 12);
    for (let i = cx - 1; i <= cx + 1; i++) for (let k = cz - 1; k <= cz + 1; k++) {
      const list = knockGrid.get(`${i},${k}`); if (!list) continue;
      for (const it of list) {
        if (Math.hypot(it.x - x, it.z - z) > r) continue;
        if (it.lamp !== undefined) knockLamp(it.lamp, vx, vz, power); else knockProp(it.prop, vx, vz, power);
      }
    }
  }
  function knockLamp(i, vx, vz, power) {
    const l = lamps[i], K = knock.lamps;
    if (l.down) return;
    l.down = true;
    for (const m of [K.poles, K.arms, K.heads, K.streaks]) { m.setMatrixAt(i, _zero); m.instanceMatrix.needsUpdate = true; }
    // the post topples as a single piece: pole, arm and head
    const g = new THREE.Group();
    const pole = new THREE.Mesh(K.poles.geometry, K.poles.material); pole.position.y = 4; g.add(pole);
    const head = new THREE.Mesh(K.heads.geometry, K.heads.material); head.position.set(l.dx * 1.2, 7.75, 0); g.add(head);
    g.position.set(l.x, 0, l.z);
    g.traverse((o) => { o.castShadow = true; });
    scene.add(g);
    debris.push({ m: g, v: V(vx * 0.4, 2 + power * 0.05, vz * 0.4), w: V(Math.sign(vz || 1) * rand(1.5, 2.5), rand(-0.5, 0.5), -Math.sign(vx || 1) * rand(1.5, 2.5)), rest: false, lamp: true });
    sparks(l.hx || l.x, 7.6, l.z, 24); sfx.crash(0.7); sfx.glass();
    addScore(40, l.x, l.z, 'LAMP');
  }
  function knockProp(p, vx, vz, power) {
    if (p.down) return;
    p.down = true;
    p.mesh.setMatrixAt(p.i, _zero); p.mesh.instanceMatrix.needsUpdate = true;
    if (p.type === 'meter' && knock.meterHeads) { let j = 0; for (const q of knock.props) { if (q.type !== 'meter') continue; if (q === p) { knock.meterHeads.setMatrixAt(j, _zero); knock.meterHeads.instanceMatrix.needsUpdate = true; } j++; } }
    const m = new THREE.Mesh(p.mesh.geometry, p.mesh.material);
    m.position.set(p.x, 0.3, p.z); m.rotation.y = p.ry; m.castShadow = true;
    scene.add(m);
    debris.push({ m, v: V(vx * rand(0.5, 0.9) + rand(-3, 3), rand(4, 9) + power * 0.1, vz * rand(0.5, 0.9) + rand(-3, 3)), w: V(rand(-9, 9), rand(-9, 9), rand(-9, 9)), rest: false });
    sparks(p.x, 0.8, p.z, 8);
    if (p.type === 'hydrant') { S.geysers = S.geysers || []; S.geysers.push({ x: p.x, z: p.z, t: 12 }); sfx.splash(); }
    else if (p.type === 'meter') { for (let k = 0; k < 10; k++) parts.spawn(p.x, 1.3, p.z, rand(-4, 4), rand(3, 7), rand(-4, 4), { life: 0.9, size: 0.25, color: [0.85, 0.85, 0.8], grav: 20 }); sfx.pickup(); }
    else sfx.crash(0.4);
    addScore(25, p.x, p.z, '');
  }
  function updateKnocks(dt) {
    if (P.inCar && Math.abs(CAR.speed) > 5) {
      const fx2 = Math.sin(CAR.ang), fz2 = Math.cos(CAR.ang);
      knockAt(CAR.pos.x + fx2 * 2, CAR.pos.z + fz2 * 2, 2.4, CAR.vx, CAR.vz, Math.abs(CAR.speed));
      knockAt(CAR.pos.x - fx2 * 1.5, CAR.pos.z - fz2 * 1.5, 2.2, CAR.vx, CAR.vz, Math.abs(CAR.speed));
    }
    if (S.geysers) for (let i = S.geysers.length - 1; i >= 0; i--) {
      const gz = S.geysers[i]; gz.t -= dt;
      for (let k = 0; k < 3; k++) parts.spawn(gz.x + rand(-0.2, 0.2), 0.8, gz.z + rand(-0.2, 0.2), rand(-1.5, 1.5), rand(9, 14), rand(-1.5, 1.5), { life: 1.1, size: rand(0.3, 0.6), color: [0.8, 0.85, 0.9], alpha: 0.7, grav: 16 });
      if (gz.t <= 0) S.geysers.splice(i, 1);
    }
  }

  // ===================================================================== civilians
  // Rain City's citizens: umbrellas, hats, places to be. They keep clear of portals,
  // but the longer a portal stays open the farther its influence reaches. Kill one
  // and the cops come out of the Holy Glaze for you.
  // pedestrian network: four sidewalk corners at every intersection.
  // Walk along a block's sidewalk to the next corner, or cross on the zebra crosswalk.
  const SW = 13.8;
  const cornerPos = (n, lane = 0) => ({ x: roadC(n.I) + n.a * (SW + lane), z: roadC(n.K) + n.b * (SW + lane) });
  function nearestCorner(x, z) {
    const I = nodeIndex(x), K = nodeIndex(z);
    return { I, K, a: x >= roadC(I) ? 1 : -1, b: z >= roadC(K) ? 1 : -1 };
  }
  function nextCorner(n, prev) {
    const opts = [];
    // along the sidewalk to the neighbouring intersection (same block edge)
    if (n.I + n.a >= 0 && n.I + n.a <= C.N) opts.push([{ I: n.I + n.a, K: n.K, a: -n.a, b: n.b }, 3]);
    if (n.K + n.b >= 0 && n.K + n.b <= C.N) opts.push([{ I: n.I, K: n.K + n.b, a: n.a, b: -n.b }, 3]);
    // across the street on a crosswalk
    opts.push([{ I: n.I, K: n.K, a: -n.a, b: n.b }, 1]);
    opts.push([{ I: n.I, K: n.K, a: n.a, b: -n.b }, 1]);
    const ok = opts.filter(([o]) => !prev || !(o.I === prev.I && o.K === prev.K && o.a === prev.a && o.b === prev.b) && Math.abs(roadC(o.I) + o.a * SW) < C.edge && Math.abs(roadC(o.K) + o.b * SW) < C.edge);
    const list = ok.length ? ok : opts;
    let tot = list.reduce((s2, o) => s2 + o[1], 0), r = Math.random() * tot;
    for (const [o, w] of list) { r -= w; if (r <= 0) return o; }
    return list[0][0];
  }
  function sidewalkPoint(near, minD, maxD) {
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * 6.28, d = rand(minD, maxD);
      const x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d;
      const ix = nodeIndex(x), iz = nodeIndex(z);
      const p = Math.random() < 0.5 ? { x: roadC(ix) + (Math.random() < 0.5 ? -14 : 14), z } : { x, z: roadC(iz) + (Math.random() < 0.5 ? -14 : 14) };
      if (Math.abs(p.x) < C.edge - 4 && Math.abs(p.z) < C.edge - 4) return p;
    }
    return { x: near.x + 20, z: near.z };
  }
  function updateCivilians(dt) {
    const f = focus();
    // keep about two dozen people on the sidewalks around Mack
    S.civT -= dt;
    if (S.civT <= 0) {
      S.civT = 0.4;
      const live = S.civs.filter((c) => !c.dead);
      if (live.length < 24) {
        const p = sidewalkPoint(f, 50, 120);
        const model = makeCivilian(Math.random());
        scene.add(model.root);
        const node = nearestCorner(p.x, p.z), lane = rand(-1.2, 1.2);
        const np = cornerPos(node, lane);
        // start partway along the sidewalk toward the next corner
        const nx = nextCorner(node, null), q = cornerPos(nx, lane), k = Math.random();
        const sx2 = Math.abs(nx.I - node.I) + Math.abs(nx.K - node.K) ? np.x + (q.x - np.x) * k : np.x, sz2 = Math.abs(nx.I - node.I) + Math.abs(nx.K - node.K) ? np.z + (q.z - np.z) * k : np.z;
        S.civs.push({ model, pos: V(sx2, 0, sz2), face: 0, node: nx, prev: node, lane, infected: false, dead: false, t: 0, hp: 20 });
      }
    }
    for (let i = S.civs.length - 1; i >= 0; i--) {
      const c = S.civs[i];
      c.t += dt;
      if (c.dead) {
        c.model.root.rotation.x = -Math.min(1, c.t * 3) * Math.PI / 2;
        c.model.root.position.y = 0.3;
        if (c.t > 8) { scene.remove(c.model.root); S.civs.splice(i, 1); }
        continue;
      }
      if (Math.abs(c.pos.x - f.x) + Math.abs(c.pos.z - f.z) > 260) { scene.remove(c.model.root); S.civs.splice(i, 1); continue; }
      let sp = c.infected ? 1.6 : 2.6, mx = 0, mz = 0;
      // infection: a portal's reach grows with its age; painters rub off on people too
      if (!c.infected) {
        for (const p of S.portals) {
          const d = Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z);
          const reach = Math.min(90, 20 + (p.age || 0) * 0.7);
          if (d < reach && Math.random() < dt * 0.35) infectCiv(c);
          if (d < 45) { mx += (c.pos.x - p.pos.x) / d; mz += (c.pos.z - p.pos.z) / d; sp = 6; } // run from it
        }
        for (const o of S.civs) if (o.infected && !o.dead && Math.hypot(c.pos.x - o.pos.x, c.pos.z - o.pos.z) < 3 && Math.random() < dt * 0.25) infectCiv(c);
        for (const e of S.enemies) if (!e.cop && (e.type === 'dauber' || e.type === 'goon' || e.type === 'cultist') && Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z) < 3.5 && Math.random() < dt * 0.3) infectCiv(c);
        // dive out of the way of a speeding Packard
        if (P.inCar && Math.abs(CAR.speed) > 8) {
          const dx = c.pos.x - CAR.pos.x, dz = c.pos.z - CAR.pos.z, d = Math.hypot(dx, dz);
          if (d < 9) { const fx2 = Math.sin(CAR.ang), fz2 = Math.cos(CAR.ang); const side = dx * fz2 - dz * fx2 > 0 ? 1 : -1; mx += fz2 * side * 3; mz += -fx2 * side * 3; sp = 9; }
        }
      }
      if (mx || mz) { const l = Math.hypot(mx, mz); c.pos.x += mx / l * sp * dt; c.pos.z += mz / l * sp * dt; c.face = Math.atan2(mx, mz); c.lost = true; }
      else {
        // walk the pedestrian network: corner to corner, crossing only at crosswalks
        if (!c.node || c.lost) { c.node = nearestCorner(c.pos.x, c.pos.z); c.prev = null; c.lost = false; }
        let tgt = cornerPos(c.node, c.lane || 0);
        if (Math.hypot(tgt.x - c.pos.x, tgt.z - c.pos.z) < 0.8) { const nx = nextCorner(c.node, c.prev); c.prev = c.node; c.node = nx; tgt = cornerPos(nx, c.lane || 0); }
        c.target = tgt;
        const dx = c.target.x - c.pos.x, dz = c.target.z - c.pos.z, d = Math.hypot(dx, dz) || 1;
        c.pos.x += dx / d * sp * dt; c.pos.z += dz / d * sp * dt;
        c.face += wrapAngle(Math.atan2(dx, dz) - c.face) * Math.min(1, dt * 5);
      }
      pushOut(c.pos, 0.5);
      if (c.infected) {
        c.paintT = (c.paintT || 0) - dt;
        if (c.paintT <= 0) { c.paintT = 1.5; splat(c.pos.x, c.pos.z, 0.8, pick(GANG_COLORS), 0.65, 1); }
      }
      const m = c.model;
      m.root.position.set(c.pos.x, 0, c.pos.z);
      m.root.rotation.set(0, c.face, c.infected ? Math.sin(S.time * 4 + m.walk) * 0.15 : 0);
      animWalk(m, sp, dt);
      if (m.umbrella) m.umbrella.rotation.z = Math.sin(S.time * 2 + m.walk) * 0.08;
    }
  }
  function infectCiv(c) {
    if (c.infected || c.dead) return;
    c.infected = true;
    setInfected(c.model, true);
    if (Math.random() < 0.25) say(pick(['MACK', 'SALLY']), pick(['That fella just turned turquoise. Don\'t shoot him, Mack — he\'s still a citizen.', 'Civilians are getting painted! Seal that portal and they\'ll snap out of it!', 'Poor sap\'s seeing color. Leave him be. Close the hole and he\'s cured.']), 3);
  }
  function cureNear(x, z, r) {
    let n = 0;
    for (const c of S.civs) if (c.infected && !c.dead && Math.hypot(c.pos.x - x, c.pos.z - z) < r) { c.infected = false; setInfected(c.model, false); n++; }
    if (n) { hud.floater(V(x, 0, z), `${n} CITIZENS CURED`); later(() => S && say('NARR', pick(['"Where am I? Why is my coat... oh. It\'s grey again. Thank God."', '"I had the strangest dream. Everything was teal."', '"Officer? Is it raining? Oh good. Good."']), 2.6), 600); }
  }
  function killCiv(c, byMack) {
    if (c.dead) return;
    c.dead = true; c.t = 0;
    drainModel(c.model);
    for (let k = 0; k < 14; k++) parts.spawn(c.pos.x, 1.4, c.pos.z, rand(-4, 4), rand(2, 6), rand(-4, 4), { life: 0.6, size: 0.4, color: [0.85, 0.1, 0.12], grav: 18 });
    sfx.hurt();
    S.stats.civilians = (S.stats.civilians || 0) + 1;
    if (byMack) { S.score = Math.max(0, S.score - 500); S.mult = 1; S.comboT = 0; hud.floater(V(c.pos.x, 0, c.pos.z), 'CIVILIAN −500'); }
    if (byMack) goWanted();
  }
  // ===================================================================== the cops
  function goWanted() {
    if (S.wanted) { say('MACK', pick(['Another one. The cops won\'t forget this.', 'I\'m digging my own grave in the rain.']), 2.2); return; }
    S.wanted = true; S.copT = 3;
    hud.wanted(true);
    say('PORK', 'ALL UNITS! Malone just plugged a citizen! Put down the crullers! ...Okay, finish the crullers, THEN get him!', 4.5);
    later(() => S && say('MACK', 'That\'s it. I\'m an enemy of the city tonight. Should\'ve watched where I was pointing.', 3.5), 4600);
    later(() => S && say('SALLY', 'The COPS are after US? Mack, this is the best night of my life. And the worst. Mostly the best.', 3.2), 8400);
  }
  function updateCops(dt) {
    if (!S.wanted || S.over) return;
    S.copT -= dt; S.sirenT -= dt;
    if (S.sirenT <= 0) { S.sirenT = 1.4; sfx.siren(); }
    const cops = S.enemies.filter((e) => e.cop).length;
    if (S.copT <= 0 && cops < 6) {
      S.copT = rand(9, 14);
      const p = spawnPoint(55, 110);
      const car = addEnemy('copcar', p.x, p.z); car.cop = true;
      for (let k = 0; k < 2; k++) { const q = sidewalkPoint(focus(), 35, 60); const c2 = addEnemy('cop', q.x, q.z); c2.cop = true; }
    }
  }
  function updateCopCar(e, dt, dp) {
    const f = focus();
    const want = Math.atan2(f.x - e.pos.x, f.z - e.pos.z);
    e.face += clamp(wrapAngle(want - e.face), -dt * 2.4, dt * 2.4);
    const sp = dp < 10 ? 12 : e.speed;
    e.pos.x += Math.sin(e.face) * sp * dt; e.pos.z += Math.cos(e.face) * sp * dt;
    if (pushOut(e.pos, 2.0)) e.face += rand(-1, 1);
    if (dp < (P.inCar ? 4.8 : 2.8) && e.hitCd <= 0) { e.hitCd = 1.5; sfx.crash(1); fx.shake = 0.5; damagePlayer(P.inCar ? 22 : 18); if (P.inCar) smashCar(24, (e.pos.x + CAR.pos.x) / 2, (e.pos.z + CAR.pos.z) / 2); if (P.inCar) { CAR.vx += Math.sin(e.face) * 14; CAR.vz += Math.cos(e.face) * 14; } }
    if (dp < 32 && e.cd <= 0) { e.cd = 1.1; const a = want + rand(-0.1, 0.1); enemyShot(V(e.pos.x + Math.sin(a) * 2, 1.5, e.pos.z + Math.cos(a) * 2), Math.sin(a), Math.cos(a), '#bbbbbb', 40, 6, 'bullet'); sfx.pistol(0, 0.7); }
    const m = e.model;
    m.root.position.set(e.pos.x, 0, e.pos.z); m.root.rotation.y = e.face;
    const bl = Math.floor(S.time * 6) % 2;
    m.car.lightbar.userData.a.visible = !!bl; m.car.lightbar.userData.b.visible = !bl;
    m.car.wheels.forEach((w) => w.children.forEach((c) => (c.rotation.x += sp * dt / 0.42)));
  }

  // ===================================================================== wayfinding
  function gotoPoint(at) {
    const lm = L[at];
    const x = lm.door ? lm.door.x : lm.x, z = lm.door ? lm.door.z + 6 : lm.z + 40;
    return { x, z };
  }
  // road-grid route from a to b: along the road you're on, then the cross street
  function route(ax, az, bx, bz) {
    const ix = nodeIndex(ax), iz = nodeIndex(az), tx = nodeIndex(bx), tz = nodeIndex(bz);
    const onV = Math.abs(ax - roadC(ix)) < 12, onH = Math.abs(az - roadC(iz)) < 12;
    const pts = [{ x: ax, z: az }];
    if (onV && !onH) { pts.push({ x: roadC(ix), z: roadC(tz) }, { x: roadC(tx), z: roadC(tz) }); }
    else if (onH && !onV) { pts.push({ x: roadC(tx), z: roadC(iz) }, { x: roadC(tx), z: roadC(tz) }); }
    else { pts.push({ x: roadC(ix), z: roadC(iz) }, { x: roadC(tx), z: roadC(iz) }, { x: roadC(tx), z: roadC(tz) }); }
    pts.push({ x: bx, z: bz });
    return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.5);
  }

  // glowing red chevrons painted on the road, flowing toward the destination
  const chevShape = new THREE.Shape();
  chevShape.moveTo(-1.4, -0.6); chevShape.lineTo(0, 0.9); chevShape.lineTo(1.4, -0.6); chevShape.lineTo(1.4, -1.4); chevShape.lineTo(0, 0.1); chevShape.lineTo(-1.4, -1.4); chevShape.closePath();
  const chevGeo = new THREE.ShapeGeometry(chevShape);
  chevGeo.rotateX(-Math.PI / 2);
  chevGeo.rotateY(Math.PI);
  const chevMat = new THREE.MeshBasicMaterial({ color: 0xff3fb4, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  const chevrons = new THREE.InstancedMesh(chevGeo, chevMat, 90);
  // a glowing neon line painted down the route, under the chevrons
  const pathGeo = new THREE.PlaneGeometry(1, 1); pathGeo.rotateX(-Math.PI / 2);
  const pathMat = new THREE.MeshBasicMaterial({ color: 0xc040ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const pathLine = new THREE.InstancedMesh(pathGeo, pathMat, 64);
  pathLine.frustumCulled = false; pathLine.count = 0; scene.add(pathLine);
  chevrons.frustumCulled = false; chevrons.count = 0;
  scene.add(chevrons);
  const beacon = new THREE.Group();
  const beamM = new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const bcol = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 80, 20, 1, true), beamM); bcol.position.y = 40; beacon.add(bcol);
  const bring = new THREE.Mesh(new THREE.RingGeometry(5, 6, 40), new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
  bring.rotation.x = -Math.PI / 2; bring.position.y = 0.1; beacon.add(bring);
  beacon.visible = false;
  scene.add(beacon);
  const _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _cs = V(), _cp = V(), _up = V(0, 1, 0);
  function updateWayfinding(dt) {
    let g = S.stage && S.stage.goal;
    const f = focus();
    if (g && g.type === 'portals' && S.portals.length) {
      let best = null, bd = 1e9;
      for (const p of S.portals) { const d = Math.hypot(p.pos.x - f.x, p.pos.z - f.z) - (p.cracked ? 40 : 0); if (d < bd) { bd = d; best = p; } }
      if (bd < 18) best = null; // you're there; no arrows in the way of the fight
      g = best ? { type: 'lead', x: best.pos.x, z: best.pos.z } : null;
      if (best && (!S.leadP || S.leadP !== best)) { S.leadP = best; S.route = null; }
    }
    if (!g || (g.type !== 'goto' && g.type !== 'lead') || S.over) { chevrons.count = 0; pathLine.count = 0; beacon.visible = false; return; }
    S.routeT -= dt;
    if (S.routeT <= 0 || !S.route) { S.routeT = 0.25; S.route = route(f.x, f.z, g.x, g.z); S.route[0] = { x: f.x, z: f.z }; }
    S.route[0] = { x: f.x, z: f.z };
    beacon.visible = true;
    beacon.position.set(g.x, 0, g.z);
    bring.scale.setScalar(1 + Math.sin(S.time * 4) * 0.12);
    // walk the polyline, dropping a chevron every 7 units, scrolling with time
    const gap = 7, flow = (S.time * 14) % gap;
    let n = 0, acc = -flow + 5, total = 0;
    for (let i = 0; i < S.route.length - 1 && n < 90; i++) {
      const a = S.route[i], b = S.route[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const yaw = Math.atan2(dx, dz);
      while (acc < len && n < 90) {
        if (acc >= 0 && total + acc > 4) {
          const far = total + acc;
          _cp.set(a.x + dx / len * acc, 0.09, a.z + dz / len * acc);
          _cq.setFromAxisAngle(_up, yaw);
          const sc = far > 220 ? 0 : (far < 10 ? far / 10 : 1) * (1.7 + Math.sin(S.time * 6 - far * 0.3) * 0.2);
          _cs.set(sc, 1, sc);
          chevrons.setMatrixAt(n++, _cm.compose(_cp, _cq, _cs));
        }
        acc += gap;
      }
      acc -= len; total += len;
    }
    chevrons.count = n;
    chevrons.instanceMatrix.needsUpdate = true;
    let m = 0, run = 0;
    for (let i = 0; i < S.route.length - 1 && m < 64 && run < 220; i++) {
      const a = S.route[i], b = S.route[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      _cp.set((a.x + b.x) / 2, 0.07, (a.z + b.z) / 2);
      _cq.setFromAxisAngle(_up, Math.atan2(dx, dz));
      _cs.set(0.7, 1, len + 0.7);
      pathLine.setMatrixAt(m++, _cm.compose(_cp, _cq, _cs));
      run += len;
    }
    pathLine.count = m;
    pathLine.instanceMatrix.needsUpdate = true;
    pathMat.opacity = 0.45 + Math.sin(S.time * 3) * 0.1;
    chevMat.opacity = 0.7 + Math.sin(S.time * 5) * 0.15;
    if (g.type === 'goto') { updateObjective(); if (Math.hypot(f.x - g.x, f.z - g.z) < (g.r || 20)) checkStage(); }
  }

  // Z: whistle for the Packard and it drives itself to you
  function summonCar() {
    if (!CAR.alive || P.inCar) return;
    if (P.pos.distanceTo(CAR.pos) < 9) return;
    CAR.intro = null;
    CAR.auto = { path: route(CAR.pos.x, CAR.pos.z, P.pos.x, P.pos.z), i: 1, t: 0, stuck: 0, rev: 0 };
    sfx.horn();
    say('MACK', pick(['*whistles* Come to papa.', 'Here, girl. *whistle*', 'The Packard knows the way. Mostly.']), 2.2);
  }
  function autopilot(dt, vf) {
    const A = CAR.auto;
    A.t -= dt;
    if (A.t <= 0) { A.t = 1; A.path = route(CAR.pos.x, CAR.pos.z, P.pos.x, P.pos.z); A.i = 1; }
    const dp = Math.hypot(P.pos.x - CAR.pos.x, P.pos.z - CAR.pos.z);
    if (dp < 8) { CAR.auto = null; sfx.horn(); if (SA.driving) SA.parkT = 6; return { thr: -1, st: 0 }; }
    let w = A.path[Math.min(A.i, A.path.length - 1)];
    // keep right: offset waypoints into the right-hand lane of travel
    if (Math.hypot(w.x - CAR.pos.x, w.z - CAR.pos.z) < 8 && A.i < A.path.length - 1) { A.i++; w = A.path[A.i]; }
    const want = Math.atan2(w.x - CAR.pos.x, w.z - CAR.pos.z);
    const diff = wrapAngle(want - CAR.ang);
    const st = clamp(diff * 2.2, -1, 1);
    const target = Math.abs(diff) > 0.6 ? 9 : dp < 25 ? 12 : 30;
    if (Math.abs(vf) < 2) A.stuck += dt; else A.stuck = 0;
    if (A.stuck > 1.2) { A.rev = 0.8; A.stuck = 0; }
    if (A.rev > 0) { A.rev -= dt; return { thr: -1, st: -st }; }
    if (A.stuck > 0 && A.t > 0.95 && Math.random() < 0.002) { const p = roadPoint(null); CAR.pos.set(p.x, 0, p.z); }
    return { thr: vf < target ? 1 : vf > target + 4 ? -1 : 0, st };
  }

  // Sally at the wheel: run down every foot thug near Mack, never Mack, then park beside him
  const NO_RAM = new Set(['lowrider', 'roomba', 'truck', 'copter', 'demon', 'beast', 'boss', 'copcar']);
  function sallyDrive(dt, vf) {
    const D = SA.drv;
    const dm = Math.hypot(P.pos.x - CAR.pos.x, P.pos.z - CAR.pos.z);
    if (SA.parkT > 0) { SA.parkT -= dt; return { thr: vf > 0.5 ? -1 : vf < -0.5 ? 1 : 0, st: 0, top: 0 }; }
    SA.huntT -= dt;
    if (SA.huntT <= 0 || (SA.prey && (SA.prey.dead || !S.enemies.includes(SA.prey)))) {
      SA.huntT = 0.4; SA.prey = null;
      let bd = 1e9;
      for (const e of S.enemies) {
        if (e.dead || e.emerge > 0 || NO_RAM.has(e.type) || (e.cop && !S.wanted)) continue;
        if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) > 34) continue;
        const d = Math.hypot(e.pos.x - CAR.pos.x, e.pos.z - CAR.pos.z);
        if (d < bd && d < 70) { bd = d; SA.prey = e; }
      }
    }
    let gx, gz, top, boost = false, zig = 0;
    if (SA.prey) { gx = SA.prey.pos.x; gz = SA.prey.pos.z; top = 26; D.joy = null; }
    else {
      // nothing to hit: joyride laps around Mack, zig-zagging, stamping on the rocket boost in bursts
      D.joyT = (D.joyT || 0) - dt;
      if (!D.joy || D.joyT <= 0 || Math.hypot(D.joy.x - CAR.pos.x, D.joy.z - CAR.pos.z) < 10 || Math.hypot(D.joy.x - P.pos.x, D.joy.z - P.pos.z) > 50) {
        const a = Math.random() * Math.PI * 2, rr = rand(18, 40);
        const q = { x: P.pos.x + Math.cos(a) * rr, z: P.pos.z + Math.sin(a) * rr }; pushOut(q, 3);
        D.joy = q; D.joyT = 5;
      }
      gx = D.joy.x; gz = D.joy.z;
      D.bT = (D.bT || 0) - dt;
      if (D.bT <= 0) { D.boost = !D.boost; D.bT = D.boost ? rand(1.0, 1.8) : rand(0.6, 1.4); }
      boost = D.boost; top = boost ? 60 : 30;
      zig = Math.sin(S.time * 4.2) * 0.55;
    }
    // through the streets if the line is blocked
    if (!clearLine(CAR.pos.x, CAR.pos.z, gx, gz)) {
      D.pathT -= dt;
      if (D.pathT <= 0 || !D.path) { D.pathT = 1; D.path = route(CAR.pos.x, CAR.pos.z, gx, gz); D.i = 1; }
      let w = D.path[Math.min(D.i, D.path.length - 1)];
      if (Math.hypot(w.x - CAR.pos.x, w.z - CAR.pos.z) < 8 && D.i < D.path.length - 1) { D.i++; w = D.path[D.i]; }
      gx = w.x; gz = w.z;
    }
    const diff = wrapAngle(Math.atan2(gx - CAR.pos.x, gz - CAR.pos.z) - CAR.ang);
    let st = clamp(diff * 2.4 + (Math.abs(diff) < 0.5 ? zig : 0), -1, 1);
    if (Math.abs(diff) > 0.7) { top = Math.min(top, 11); boost = false; }
    // Mack in front of the grille: stand on the brakes
    const fx2 = Math.sin(CAR.ang), fz2 = Math.cos(CAR.ang);
    const mx = P.pos.x - CAR.pos.x, mz = P.pos.z - CAR.pos.z, ahead = mx * fx2 + mz * fz2, side = Math.abs(mx * fz2 - mz * fx2);
    if (ahead > 1.8 && ahead < 4.5 + Math.max(0, vf) * 0.45 && side < 2.4) return { thr: vf > 0 ? -1 : 0, st: side < 1.2 ? (mx * fz2 - mz * fx2 > 0 ? -1 : 1) : st, top: 0 };
    if (Math.abs(vf) < 2) D.stuck += dt; else D.stuck = 0;
    if (D.stuck > 1.0) { D.rev = 0.8; D.stuck = 0; }
    if (D.rev > 0) { D.rev -= dt; return { thr: -1, st: -st, top: 10 }; }
    return { thr: vf < top ? 1 : vf > top + 4 ? -1 : 0, st, top, boost };
  }

  // Sally can get hurt. If she drops she's out for the rest of the case.
  function damageSally(d) {
    if (SA.down || SA.inCar || S.over) return;
    SA.hp -= d;
    SA.lastHurt = S.time;
    if (SA.hp <= 0) {
      SA.hp = 0; SA.down = true; SA.downT = 0;
      say('SALLY', pick(['Ow! OW! That\'s it, I\'m out! I\'m going to the Last Drop! Don\'t wait up, Mack!', 'They got my DRESS, Mack! I\'m done! Tell Gus to start pouring!', 'Mack... I\'m taking a cab to the bar. Finish it without me. Don\'t you dare finish it without me. Okay finish it.']), 4.5);
      later(() => S && say('MACK', 'Sally\'s out. Just me and the rain now.', 3), 4200);
    } else if (Math.random() < 0.15) say('SALLY', pick(['Hey! Not the dress!', 'Ow! Rude!', 'Mack, they\'re shooting at ME now!']), 2);
  }

  // ===================================================================== mission
  function start(caseDef, opts = {}) {
    stop();
    clearPaint();
    const area = caseDef.district === 'City' ? null : DISTRICTS[caseDef.district];
    S = {
      caseDef, area, stageIdx: -1, stage: null, time: 0, running: true, over: false, endT: 0,
      enemies: [], portals: [], shots: [], rockets: [], pickups: [], bodies: [], boss: null,
      stageKills: 0, stagePortals: 0, spawnT: 1.5, bleed: 0, peak: 0, bleedT: 0, quipT: 0, bleedWarn: 0,
      stats: { kills: 0, rockets: 0, flasks: 0, portals: 0 },
      fx: new Set(opts.effects || []), barUsed: false, donutIn: false, donutT: 0, retortT: 0, lightningT: 6,
      rec: { v: 1, caseId: caseDef.id, frames: [], events: [] }, recT: 0, firing: false,
      stages: null, routeT: 0, route: null, timers: [],
      evidence: [], evidenceLeft: (EVIDENCE[caseDef.id] || []).slice(),
      civs: [], civT: 0, wanted: false, copT: 0, sirenT: 0,
      radio: (RADIO[caseDef.id] || []).slice(), radioT: 32,
      score: 0, mult: 1, comboT: 0,
    };
    resetKnocks();
    // unless the case opens with its own errand, the first job is getting to the scene
    const goTo = area ? roadPoint(area, () => 0.5) : { x: L.cityHall.x, z: L.cityHall.z + 40 };
    const dest = area ? { x: roadC(nodeIndex((area.x0 + area.x1) / 2)), z: roadC(nodeIndex((area.z0 + area.z1) / 2)) } : goTo;
    S.stages = caseDef.stages.slice();
    if (!S.stages[0].goal.type.startsWith('goto')) S.stages.unshift({ text: `Get to ${caseDef.district === 'City' ? 'City Hall' : caseDef.district}`, goal: { type: 'goto', x: dest.x, z: dest.z, r: 30, label: caseDef.district === 'City' ? 'CITY HALL' : caseDef.district.toUpperCase() }, mix: { dauber: 0.4, hood: 0.35, goon: caseDef.id > 2 ? 0.25 : 0 }, max: 5, interval: 3, roam: true, line: ['SALLY', pick(['Keys, Mack! Let\'s ride!', 'Follow the red arrows, handsome. Or don\'t, and I\'ll drive.', 'Shotgun! I mean rocket-gun!']) ] });
    else for (const s2 of S.stages) if (s2.goal.type === 'goto' && s2.goal.at) Object.assign(s2.goal, gotoPoint(s2.goal.at));
    // every case starts on the sidewalk outside Malone Investigations, the Packard at the curb
    const sx = L.office.x, sz = L.office.z + 40;
    P.pos.set(sx - 4, 0, sz - 9); P.hp = P.maxHp; P.flasks = Math.min(P.maxFlasks, 3 + (S.fx.has('extraFlask') ? 2 : 0) + (opts.bonusFlasks || 0));
    P.inCar = false; P.focus = 0; P.roll = 0; P.focusMeter = 0.6; P.pills = 2; P.color = 0; P.ammo = 6; P.reload = 0; P.focusOn = false; P.aiming = false; NU.seeColor.value = 0;
    SA.pos.set(sx - 7, 0, sz - 9); SA.inCar = false; SA.cd = 2; SA.lock = null; SA.lockT = 0; SA.driving = false; sallyInCar.position.x = 0; SA.hp = SA.maxHp; SA.down = false; SA.downT = 0;
    sallyM.root.rotation.set(0, 0, 0);
    // Sally brings the car round: it comes tearing down the block and skids up beside Mack
    CAR.pos.set(sx - 75, 0, sz - 7); CAR.ang = Math.PI / 2; CAR.auto = null;
    CAR.intro = { x: sx + 2, z: sz - 7, wait: 0 };
    SA.inCar = true; CAR.vx = CAR.vz = 0; CAR.hp = 400; CAR.alive = true; CAR.respawn = 0;
    carM.root.visible = true; carM.root.traverse((o) => { if (o.userData.origMat) o.material = o.userData.origMat; });
    restoreCar();
    while (debris.length) scene.remove(debris.pop().m);
    mack.root.visible = true; sallyM.root.visible = false;
    if (opts.inCar && L.bar.door) {
      // straight out of the Last Drop: the Packard's idling at the curb, Mack at the wheel, Sally riding shotgun
      const d = L.bar.door, rz = roadC(nodeIndex(d.z)), rx = roadC(nodeIndex(d.x));
      if (Math.abs(rz - d.z) <= Math.abs(rx - d.x)) { CAR.pos.set(d.x, 0, rz); CAR.ang = Math.PI / 2; }
      else { CAR.pos.set(rx, 0, d.z); CAR.ang = 0; }
      CAR.intro = null;
      P.pos.set(CAR.pos.x, 0, CAR.pos.z); SA.pos.set(CAR.pos.x, 0, CAR.pos.z);
      enterCar();
    }
    // flask pickups scattered around
    const spots = flaskSpots.filter((p) => !area || (p.x > area.x0 - 40 && p.x < area.x1 + 40 && p.z > area.z0 - 40 && p.z < area.z1 + 40));
    (spots.length ? spots : flaskSpots).slice(0, 10).forEach((p, i) => addPickup(p.x, p.z, i % 3 === 2 ? 'pills' : 'flask'));
    if (caseDef.hell) makeFissures(caseDef.hell);
    // the opening monologue, Sally cutting in; the first stage's own line waits its turn
    const mono = MONOLOGUES[caseDef.id] || [];
    mono.forEach(([w, t], i) => later(() => S && say(w, t, 4.8), 600 + i * 4700));
    S.monoUntil = mono.length ? 0.6 + mono.length * 4.7 : 0;
    nextStage();
    hud.caseTitle(caseDef.id ? `Case No. ${caseDef.id}` : 'Off the books', caseDef.title);
    // a few goons loitering near the office: something to shoot, something to run over
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.5; addEnemy(i === 3 && caseDef.id > 2 ? 'goon' : pick(['dauber', 'hood']), P.pos.x + Math.cos(a) * 45, P.pos.z + Math.sin(a) * 45 + 10); }
    // pre-paint a little so the case starts already bleeding
    for (let i = 0; i < 18; i++) { const p = roadPoint(area); splat(p.x, p.z, 2 + Math.random() * 4, pick(GANG_COLORS), 0.85, 8); }
    snapCamera();
  }

  function stop() {
    if (!S) return;
    for (const e of S.enemies) removeEnemy(e);
    for (const b of S.bodies) scene.remove(b.root);
    for (const p of S.portals) scene.remove(p.g);
    for (const s of S.shots) scene.remove(s.mesh);
    for (const r of S.rockets) scene.remove(r.mesh);
    for (const p of S.pickups) scene.remove(p.mesh);
    for (const c of S.civs) scene.remove(c.model.root);
    hud.wanted(false);
    if (S.fissures) for (const f2 of S.fissures) scene.remove(f2.m);
    scene.background.copy(baseBg); scene.fog.color.copy(baseBg);
    beam.visible = false;
    setEngine(false);
    headL.intensity = headR.intensity = 0;
    S.running = false;
    S = null;
  }

  function nextStage() {
    S.stageIdx++;
    const st = S.stages[S.stageIdx];
    if (!st) { win(); return; }
    S.stage = st; S.stageKills = 0; S.stagePortals = 0; S.stageRoombas = 0; S.spawnT = 2; S.wave = 1; S.waveT = 24;
    if (st.beasts) for (let i = 0; i < st.beasts; i++) later(() => { if (S && S.stage === st) { const p = spawnPoint(60, 120); addEnemy('beast', p.x, p.z); say('SALLY', pick(['Mack. MACK. That thing is the size of the Holy Glaze!', 'BIG ONE! Big rainbow one! I need a bigger rocket!']), 2.6); } }, 2500 + i * 6000);
    if (st.copters) for (let i = 0; i < st.copters; i++) later(() => { if (S && S.stage === st) { const p = spawnPoint(80, 160); addEnemy('copter', p.x, p.z); } }, 800 + i * 2500);
    if (st.roombas) for (let i = 0; i < st.roombas; i++) later(() => { if (S && S.stage === st) { const p = spawnPoint(60, 150); addEnemy('roomba', p.x, p.z); } }, 400 + i * 900);
    if (st.portals) for (let i = 0; i < st.portals; i++) later(() => S && S.stage === st && openPortal(null, st.spread ? { spread: true, minD: st.minD || 120, maxD: st.maxD || 480, sep: st.sep || 220 } : null), 600 + i * 1600);
    if (st.stamp) hud.stamp(st.stamp);
    if (st.goal.type === 'breather') {
      S.breathT = st.goal.t;
      S.radioT = Math.min(S.radioT, 4);
      // wave cleared: every goon left on the streets goes off like a firecracker, nearest first
      const f0 = focus();
      S.enemies.filter((e) => e.type !== 'boss' && !e.cop && !e.dead)
        .sort((a, b) => Math.hypot(a.pos.x - f0.x, a.pos.z - f0.z) - Math.hypot(b.pos.x - f0.x, b.pos.z - f0.z))
        .forEach((e, i) => later(() => {
          if (!S || e.dead || !S.enemies.includes(e)) return;
          e.unloaded = true; // a truck pops with its crew still inside
          explode(e.pos.x, 1, e.pos.z, 3 + (e.r || 1), 0);
          hitEnemy(e, 1e6, 'rocket');
        }, 250 + i * 140));
      if (st.banter) st.banter.forEach(([w, t], i) => later(() => S && S.stage === st && say(w, t, 3.6), 1500 + i * 3800));
    }
    if (st.boss) spawnBoss(st.boss);
    if (st.line) { if (S.time < (S.monoUntil || 0)) later(() => S && say(st.line[0], st.line[1], 4.5), (S.monoUntil - S.time) * 1000); else say(st.line[0], st.line[1], 4.5); }
    hud.objective(st.text, S.stageIdx + 1, S.stages.length);
    updateObjective();
  }

  function updateObjective() {
    const g = S.stage.goal;
    let prog = '';
    if (g.type === 'kill') prog = `${Math.min(S.stageKills, g.n)} / ${g.n}`;
    else if (g.type === 'portals') prog = `${S.stagePortals} / ${g.n} sealed`;
    else if (g.type === 'roombas') prog = `${S.stageRoombas} / ${g.n} scrapped`;
    else if (g.type === 'goto') prog = `${Math.round(Math.hypot(focus().x - g.x, focus().z - g.z))} m`;
    else if (g.type === 'breather') prog = `next wave in ${Math.max(0, Math.ceil(S.breathT))}s`;
    else if (g.type === 'boss') prog = S.boss ? `${Math.ceil(S.boss.hp / S.boss.maxHp * 100)}%` : '';
    hud.progress(prog);
  }

  function checkStage() {
    if (!S.stage || S.over) return;
    const st0 = S.stage, g = S.stage.goal;
    let done = false;
    if (g.type === 'goto') done = Math.hypot(focus().x - g.x, focus().z - g.z) < (g.r || 20);
    if (g.type === 'kill') done = S.stageKills >= g.n;
    else if (g.type === 'portals') done = S.stagePortals >= g.n;
    else if (g.type === 'breather') done = S.breathT <= 0;
    else if (g.type === 'roombas') done = S.stageRoombas >= g.n;
    else if (g.type === 'boss') done = S.boss && S.boss.dead;
    updateObjective();
    if (done) {
      sfx.stamp();
      hud.stamp(S.stageIdx + 1 >= S.stages.length ? 'CASE CLOSED' : st0.goal.type === 'goto' ? 'ARRIVED' : 'DONE');
      if (st0.goal.arrive) st0.goal.arrive.forEach(([w, t], i) => later(() => S && say(w, t, 4), i * 3600));
      later(() => { if (S && !S.over) nextStage(); }, 1200);
      S.stage = null;
    }
  }

  function win() {
    S.over = true; S.result = 'win'; S.endT = 3.6;
    sfx.victory();
    S.hush = true; hud.hush(); // no more talk on the street: the card says it
    if (!S.caseDef.patrol) hud.wasted(true, pick([`${S.caseDef.title}. The color washed down the gutters and the city went back to grey.`, 'Rain City is grey again. For tonight.', 'The Technicolor Syndicate just lost a round. First drink\'s on Sally.']), 'CASE CLOSED');
    P.focus = 3;
    for (const e of S.enemies.slice()) killEnemy(e, true);
    for (const p of S.portals.slice()) closePortal(p);
    fadeAll(0.6);
  }
  function lose(reason) {
    if (S.over) return;
    S.over = true; S.result = 'lose'; S.reason = reason; S.endT = 2.6;
    if (reason === 'bleed') {
      // too much color: the whole city floods with it, and Mack loses his lunch
      S.endT = 5; S.puke = 0; P.color = 8;
      if (P.inCar) exitCar();
      say('MACK', pick(['Too much... color... I\'m gonna be sick.', 'Everything\'s... turquoise... *hurk*', 'I can see... MAUVE... *blaaargh*']), 4);
      later(() => S && say('SALLY', 'Ew! Mack! On the SHOES?!', 3), 2600);
      later(() => { if (!S) return; sfx.wasted(); hud.wasted(true, pick(['The Technicolor Syndicate wins. Rain City is a rainbow now. Mack is a puddle.', 'Every street, every lamp post, every cop. Turquoise.', 'Somewhere a saxophone turned pink and wept.']), 'PAINTED THE TOWN'); }, 1400);
    }
    if (reason === 'dead') {
      // you go down: slow motion, Mack hits the wet street, big red WASTED
      S.endT = 4.2; S.down = 0;
      P.focusOn = false;
      if (P.inCar) exitCar();
      sfx.wasted();
      hud.wasted(true, pick(['Face down in a puddle. The rain didn\'t care.', 'The city wins this round. The city always wins a round.', 'Mack Malone, horizontal. Sally\'s already ordering.']));
    }
  }

  // ===================================================================== dialogue
  function say(who, text, dur = 3.5) { if (S && S.hush) return; hud.say(who, text, dur); }
  function quip(who, deck, chance = 1, gap = 5) {
    if (S.quipT > 0 || Math.random() > chance) return;
    S.quipT = gap;
    say(who, Array.isArray(deck) ? pick(deck) : deck.draw(), 2.6);
  }

  // ===================================================================== spawn
  function spawnPoint(minD = 45, maxD = 120) {
    for (let i = 0; i < 40; i++) {
      const p = roadPoint(S.area);
      const d = Math.hypot(p.x - focus().x, p.z - focus().z);
      if (d > minD && d < maxD) return p;
    }
    for (let i = 0; i < 40; i++) {
      const p = roadPoint(null);
      const d = Math.hypot(p.x - focus().x, p.z - focus().z);
      if (d > minD && d < maxD) return p;
    }
    return roadPoint(S.area);
  }

  function addEnemy(type, x, z, opts = {}) {
    const t = TYPES[type];
    const color = opts.color || pick(GANG_COLORS);
    let model, car = null;
    if (type === 'truck') {
      const tk = makeTruck(color);
      model = { root: tk.root, car: tk, truck: true };
    } else if (type === 'lowrider') {
      car = makeCar('lowrider', color);
      const driver = makeGangster(color, 'hood', 0.7);
      driver.root.position.set(-0.5, 0.6, -0.3);
      car.body.add(driver.root);
      model = { root: car.root, car, driver };
    } else if (type === 'copter') model = makeCopter(color);
    else if (type === 'cultist') model = makeCultist(color);
    else if (type === 'imp') model = makeImp(color);
    else if (type === 'demon') model = makeImp(color, 1.6);
    else if (type === 'beast') model = makeBeast(color);
    else if (type === 'cop') { const c = makeCop(); model = { root: c.root, arm: c.arm }; }
    else if (type === 'copcar') { const c = makeCar('cop'); model = { root: c.root, car: c }; }
    else if (type === 'goon') model = makeRainbowGoon();
    else if (type === 'roomba') model = makeRoomba(color);
    else model = makeGangster(color, type === 'roller' ? 'roller' : type === 'dauber' ? 'dauber' : 'hood', t.scale);
    scene.add(model.root);
    const e = {
      type, model, color, rgb: hexToRgb(color), pos: V(x, 0, z), face: Math.random() * 6, hp: t.hp, maxHp: t.hp, speed: t.speed * rand(0.9, 1.1), r: t.r,
      cd: rand(1, 2.5), paintCd: 0, wp: null, losT: 0, wander: null, flash: 0, walk: Math.random() * 6, dead: false, last: V(x, 0, z),
      node: null, prevNode: null, vx: 0, vz: 0, hitCd: 0, stage: S.stage, turnT: rand(3, 7), hue: 0, hueT: 0,
    };
    if (type === 'lowrider' || type === 'truck') {
      if (type === 'lowrider') e.hp = e.maxHp = S.fx.has('lowriderWeak') ? 80 : t.hp;
      const ix = nodeIndex(x), iz = nodeIndex(z);
      e.node = [ix, iz]; e.pos.set(roadC(ix), 0, roadC(iz));
    }
    model.root.position.copy(e.pos);
    S.enemies.push(e);
    return e;
  }

  function removeEnemy(e) { scene.remove(e.model.root); }

  function spawnBoss(id) {
    const b = BOSSES[id];
    const lm = L[b.at];
    const x = roadC(nodeIndex(lm.x)) + (lm.x > roadC(nodeIndex(lm.x)) ? 14 : -14), z = lm.z + 40;
    let model;
    if (id === 'king') model = makePrismKing();
    else if (id === 'krane') model = makeMech();
    else if (b.model === 'cultist') {
      model = makeCultist(b.color);
      if (id === 'chromancer') { const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 32), rainbowMatLocal()); halo.position.y = 2.95; halo.rotation.x = Math.PI / 2; model.root.add(halo); model.halo = halo; }
    } else if (b.model === 'imp') model = makeImp(b.color);
    else if (b.model === 'mother') {
      const r = makeRoomba(b.color);
      const bot = makeRobot(); bot.root.position.set(0, 1.5, -0.6); bot.root.scale.setScalar(0.9); r.body.add(bot.root);
      model = { root: r.root, body: r.body, brush: r.brush, eye: r.eye, dottie: bot };
    }
    else {
      model = makeGangster(b.color, 'hood', b.scale);
      if (id === 'cruller') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.32, 12, 24), gangMat('#ff7ac8'));
        ring.rotation.x = Math.PI / 2; ring.position.y = 1.2; model.root.add(ring);
        const sprinkles = gangMat('#62ff2e');
        for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.18), sprinkles); const a = i / 12 * Math.PI * 2; s.position.set(Math.cos(a) * 0.75, 1.55, Math.sin(a) * 0.75); s.rotation.y = a * 3; model.root.add(s); }
      }
    }
    scene.add(model.root);
    const hpMul = S.fx.has('portalWeak') && id === 'king' ? 0.9 : 1;
    const e = {
      type: 'boss', id, def: b, model, color: b.color === '#ffffff' ? '#ff2d95' : b.color, rgb: hexToRgb(b.color), pos: V(x, 0, z), anchor: V(x, 0, z), face: 0,
      hp: b.hp * hpMul, maxHp: b.hp * hpMul, speed: b.speed, r: 0.9 * b.scale, cd: 2, summonCd: 6, paintCd: 0, wp: null, losT: 0, flash: 0, walk: 0, dead: false, burst: 0, beamA: 0, beamT: 0, phase: 0, last: V(x, 0, z), hitCd: 0,
    };
    S.enemies.push(e);
    S.boss = e;
    hud.boss(b.name, b.sub, 1);
    flashes.light(x, 10, z, 3000, 0.5);
    sfx.portal();
  }

  function openPortal(at, o = null) {
    if (!S) return;
    let p = at;
    if (!p && o && o.spread) {
      // spread across the city: far from Mack and far from each other
      for (let tries = 0; tries < 400 && !p; tries++) {
        const relax = tries > 250 ? 0.6 : 1;
        const ix = Math.floor(Math.random() * (C.N + 1)), iz = Math.floor(Math.random() * (C.N + 1));
        const q = { x: roadC(ix), z: roadC(iz) };
        const d = Math.hypot(q.x - focus().x, q.z - focus().z);
        if (d < o.minD * relax || d > o.maxD / relax) continue;
        if (S.portals.some((x) => Math.hypot(x.pos.x - q.x, x.pos.z - q.z) < o.sep * relax)) continue;
        p = q;
      }
    }
    if (!p) {
      for (let i = 0; i < 40; i++) {
        const ix = Math.floor(Math.random() * (C.N + 1)), iz = Math.floor(Math.random() * (C.N + 1));
        const q = { x: roadC(ix), z: roadC(iz) };
        if (S.area && !(q.x > S.area.x0 - 15 && q.x < S.area.x1 + 15 && q.z > S.area.z0 - 15 && q.z < S.area.z1 + 15)) continue;
        const d = Math.hypot(q.x - focus().x, q.z - focus().z);
        if (d < 50 || d > 200) continue;
        if (S.portals.some((o) => Math.hypot(o.pos.x - q.x, o.pos.z - q.z) < 70)) continue;
        p = q; break;
      }
      if (!p) p = spawnPoint(50, 160);
    }
    const g = makePortal(5);
    g.position.set(p.x, 6.5, p.z);
    scene.add(g);
    const hp = S.fx.has('portalWeak') ? 240 : 450;
    if (!S.replay) recEvent(['po', r1(p.x), r1(p.z)]);
    const portal = { g, pos: V(p.x, 0, p.z), hp, maxHp: hp, spawnCd: 3, paintCd: 0, paintR: 4, open: 0, stage: S.stage, color: pick(GANG_COLORS), flash: 0 };
    S.portals.push(portal);
    sfx.portal();
    flashes.light(p.x, 12, p.z, 4000, 0.6);
    fx.flash = Math.max(fx.flash, 0.35);
    quip('MACK', LINES.portal, 1, 3);
    return portal;
  }

  function closePortal(p) {
    const i = S.portals.indexOf(p);
    if (i < 0) return;
    S.portals.splice(i, 1);
    scene.remove(p.g);
    recEvent(['pc', r1(p.pos.x), r1(p.pos.z)]);
    sfx.close();
    for (let k = 0; k < 80; k++) {
      const a = Math.random() * Math.PI * 2;
      parts.spawn(p.pos.x + Math.cos(a) * 5, 6.5 + Math.sin(a) * 5, p.pos.z, -Math.cos(a) * 12, -Math.sin(a) * 12, 0, { life: 0.5, size: 0.6, color: hexToRgb(pick(GANG_COLORS)), kind: 0 });
    }
    flashes.ball(p.pos.x, 6.5, p.pos.z, 8, 0.5);
    wash(p.pos.x, p.pos.z, 40, 1);
    fadeAll(0.05);
    cureNear(p.pos.x, p.pos.z, 100);
    S.stats.portals++;
    if (p.stage === S.stage) S.stagePortals++;
    if (!S.over && !S.replay) { addScore(1000, p.pos.x, p.pos.z, 'SEALED'); bumpCombo(1); }
    if (!S.over) quip('MACK', LINES.close, 0.8, 3);
    checkStage();
  }

  function addPickup(x, z, kind = 'flask', item = null) {
    const mesh = kind === 'evidence' ? evidenceModel() : kind === 'pills' ? pillPickupModel() : flaskPickupModel();
    mesh.position.set(x, 0.6, z);
    scene.add(mesh);
    S.pickups.push({ mesh, x, z, kind, item, t: Math.random() * 6 });
  }

  // ===================================================================== combat
  function focus() { return P.inCar ? CAR.pos : P.pos; }

  function damagePlayer(d, fromX, fromZ) {
    if (S.over) return;
    if (P.inCar) {
      CAR.hp -= d * 0.8;
      if (Math.random() < 0.3) sparks(CAR.pos.x, 1.2, CAR.pos.z, 5);
      carDamageVisuals();
      if (CAR.hp <= 0 && CAR.alive) destroyCar();
      return;
    }
    if (P.roll > 0) return;
    dropCombo(d >= 15 ? 1 : 0.5);
    P.hp -= d;
    P.lastHurt = S.time;
    hud.hurt();
    sfx.hurt();
    fx.shake = Math.max(fx.shake, 0.35);
    if (Math.random() < 0.15) quip('MACK', LINES.hurt, 1, 6);
    if (P.hp <= 0) { P.hp = 0; lose('dead'); }
  }

  function destroyCar() {
    CAR.alive = false;
    explode(CAR.pos.x, 1.2, CAR.pos.z, 8, 0, false);
    carM.root.traverse((o) => { if (o.isMesh) { o.userData.origMat = o.userData.origMat || o.material; o.material = new THREE.MeshLambertMaterial({ color: 0x151515 }); } });
    if (P.inCar) exitCar(true);
    if (SA.driving) {
      SA.driving = false; SA.inCar = false; sallyInCar.position.x = 0;
      SA.pos.set(CAR.pos.x + Math.cos(CAR.ang) * 2.6, 0, CAR.pos.z - Math.sin(CAR.ang) * 2.6); pushOut(SA.pos, 0.7);
      sallyM.root.visible = true;
    }
    say('MACK', pick(LINES.carDead), 2.5);
    later(() => S && say('SALLY', pick(LINES.sallyCarDead), 3), 1800);
    CAR.respawn = 14;
  }

  function hitEnemy(e, dmg, kind = 'bullet') {
    if (e.dead) return;
    if (e.type === 'truck' && !e.unloaded) unloadTruck(e);
    if (e.type === 'boss' && kind === 'rocket' && S.fx.has('rocket2x')) dmg *= 2;
    e.hp -= dmg;
    e.flash = 0.08;
    if (e === S.boss) hud.boss(e.def.name, e.def.sub, Math.max(0, e.hp / e.maxHp));
    if (e.hp <= 0) killEnemy(e);
  }

  // the first hit on a Goon Truck: everybody in the back jumps and runs for it
  function unloadTruck(e) {
    e.unloaded = true;
    const n = e.model.car.goons.length;
    e.model.car.goons.forEach((g, i) => {
      g.root.visible = false;
      const type = i === 0 ? 'goon' : i === 1 ? 'hood' : 'dauber';
      const r = addEnemy(type, e.pos.x, e.pos.z);
      r.emerge = 0.6; r.emergeDir = (i / n) * 6.28 + rand(-0.4, 0.4);
      r.scatterT = rand(2.5, 4); r.scattered = true;
    });
    say(pick(['SALLY', 'MACK']), pick(['They\'re JUMPING! Look at \'em go!', 'Rats off a sinking truck.', 'Scatter, you painted rats!']), 2.2);
  }

  function killEnemy(e, silent = false) {
    if (e.dead) return;
    e.dead = true;
    S.enemies.splice(S.enemies.indexOf(e), 1);
    const big = S.fx.has('bigWash') ? 1.6 : 1;
    wash(e.pos.x, e.pos.z, (e.type === 'boss' ? 60 : e.type === 'roomba' || e.type === 'truck' || e.type === 'beast' ? 34 : e.type === 'lowrider' ? 22 : 16) * big, 1);
    fadeAll(e.type === 'boss' ? 0.3 : 0.018 * big);
    if (e.type === 'copter') { sfx.crash(1); hud.floater(e.pos, 'SHOT DOWN'); }
    if (e.type === 'truck') {
      // the paint drums in the bed go up: a color explosion, a big rainbow decal, riders flung clear
      later(() => {
        if (!S) return;
        for (let k = 0; k < 120; k++) { const a = Math.random() * 6.28, v = rand(6, 26); parts.spawn(e.pos.x, 2, e.pos.z, Math.cos(a) * v, rand(4, 18), Math.sin(a) * v, { life: rand(0.8, 1.6), size: rand(0.5, 1.2), color: hexToRgb(GANG_COLORS[k % 6]), grav: 18 }); }
        for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28 + rand(-0.3, 0.3); splat(e.pos.x + Math.cos(a) * rand(4, 9), e.pos.z + Math.sin(a) * rand(4, 9), rand(3, 5), GANG_COLORS[k], 0.95, 10); }
        splat(e.pos.x, e.pos.z, 5, '#ffffff', 0.6, 12);
        flashes.ball(e.pos.x, 2, e.pos.z, 10, 0.5);
        if (!e.unloaded) for (let k = 0; k < 3; k++) { const g2 = addEnemy(k === 0 ? 'hood' : 'dauber', e.pos.x, e.pos.z); g2.emerge = 0.7; g2.emergeDir = Math.random() * 6.28; g2.scattered = true; g2.scatterT = 3; }
      }, 120);
    }
    if (e.type === 'beast') { explode(e.pos.x, 3, e.pos.z, 10, 60, false); hud.floater(e.pos, 'THE BEAST GOES GREY'); }
    if (e.type === 'lowrider' || e.type === 'roomba' || e.type === 'truck') explode(e.pos.x, 1, e.pos.z, e.type === 'lowrider' ? 7 : 9, 60, false);
    if (e.type === 'roomba' && e.stage === S.stage) S.stageRoombas++;
    for (let k = 0; k < 26; k++) parts.spawn(e.pos.x, 1.5, e.pos.z, rand(-6, 6), rand(3, 9), rand(-6, 6), { life: 0.7, size: 0.5, color: e.rgb, grav: 20, kind: 0 });
    drainModel(e.model);
    e.model.root.userData.fall = 0;
    S.bodies.push({ root: e.model.root, t: 0, car: e.type === 'lowrider' || e.type === 'roomba' || e.type === 'truck', copter: e.type === 'copter' ? { y: e.model.root.position.y, spin: rand(2, 4) } : null });
    if (silent) return;
    if (e.cop) { sfx.hurt(); quip('MACK', ['Sorry, officer.', 'Nothing personal, flatfoot.', 'Go back to your crullers.'], 0.6, 3); return; }
    sfx.kill();
    S.stats.kills++;
    addScore(e.type === 'boss' ? POINTS.boss : POINTS[e.type] || 100, e.pos.x, e.pos.z);
    bumpCombo(e.type === 'boss' ? 2 : e.type === 'beast' || e.type === 'truck' ? 0.75 : 0.25);
    recEvent(['k', r1(e.pos.x), r1(e.pos.z), e.color, e.type === 'boss' ? 'hood' : e.type]);
    S.stageKills++;
    hud.floater(e.pos, e.type === 'boss' ? 'THE COLOR DIES WITH HIM' : e.type === 'roomba' ? 'PAINTBOT SCRAPPED' : '−COLOR');
    if (e.type === 'roomba' && Math.random() < 0.6) later(() => S && say(pick(['MACK', 'SALLY']), pick(['Scrapped. Somebody tell the warranty department.', 'Bad robot! BAD!', 'That\'s one less appliance with ambitions.', 'Dottie\'s gonna be upset. That was her cousin.']), 2.6), 400);
    if (e.type === 'boss') { beam.visible = false; hud.boss(null); fx.shake = 1; P.focus = Math.max(P.focus, 2.5); }
    else if (S.evidenceLeft.length && S.stats.kills >= 4 && (Math.random() < 0.12 || S.stats.kills % 11 === 0)) { addPickup(e.pos.x, e.pos.z, 'evidence', S.evidenceLeft.shift()); hud.floater(e.pos, 'DROPPED SOMETHING'); }
    else if (Math.random() < 0.14) addPickup(e.pos.x, e.pos.z, Math.random() < 0.35 ? 'pills' : 'flask');
    P.focusMeter = Math.min(1, P.focusMeter + (e.type === 'lowrider' ? 0.2 : 0.1));
    quip('MACK', killDeck, 0.3, 5);
    checkStage();
  }

  function explode(x, y, z, r, dmg, friendly = true, civR = r * 0.8) {
    const far = clamp(1 - Math.hypot(x - focus().x, z - focus().z) / 140, 0.1, 1);
    sfx.boom(far);
    flashes.light(x, y + 2, z, 2500, 0.25);
    flashes.ball(x, y, z, r * 0.8, 0.3);
    fx.shake = Math.max(fx.shake, 0.6 * far);
    for (let k = 0; k < 30; k++) parts.spawn(x, y, z, rand(-1, 1) * 18, rand(4, 16), rand(-1, 1) * 18, { life: rand(0.3, 0.8), size: rand(0.3, 0.7), color: [1, 0.95, 0.85], grav: 25, kind: 0 });
    for (let k = 0; k < 16; k++) parts.spawn(x + rand(-2, 2), y + rand(0, 2), z + rand(-2, 2), rand(-3, 3), rand(2, 6), rand(-3, 3), { life: rand(1.2, 2.4), size: rand(3, 6), grow: 4, color: [0.12, 0.12, 0.13], alpha: 0.85, drag: 1.2, kind: 1 });
    for (let k = 0; k < 6; k++) parts.spawn(x, y, z, rand(-8, 8), rand(2, 8), rand(-8, 8), { life: 0.5, size: 0.4, color: [1, 0.1, 0.15], grav: 18, kind: 0 }); // Sally's red
    if (dmg > 0) {
      for (const e of S.enemies.slice()) {
        const d = Math.hypot(e.pos.x - x, e.pos.z - z);
        if (d < r + e.r) hitEnemy(e, dmg * (1 - 0.5 * d / (r + e.r)), 'rocket');
      }
      for (const p of S.portals.slice()) {
        if (Math.hypot(p.pos.x - x, p.pos.z - z) < r + 4.5) hitPortal(p, dmg * 0.9);
      }
    }
    if (!friendly && !P.inCar && Math.hypot(P.pos.x - x, P.pos.z - z) < r) damagePlayer(25, x, z);
    knockAt(x, z, r * 0.8, 0, 0, 30);
    if (friendly && dmg > 0) for (const c of S.civs) if (!c.dead && Math.hypot(c.pos.x - x, c.pos.z - z) < civR) killCiv(c, true);
    if (Math.hypot(x - L.donut.x, z - L.donut.z) < 45 && S.retortT <= 0) { S.retortT = 8; later(() => S && say('COP', pick(['HEY! There\'s crullers in here!', 'Watch it, Malone! That\'s police property!', 'You almost hit the bear claws!']), 2.5), 500); }
  }

  // bullets and rockets only crack a portal; Mack has to seal it by hand with his flask of grey
  function hitPortal(p, dmg) {
    if (p.cracked) return;
    p.hp -= dmg;
    p.flash = 0.1;
    if (p.hp <= 0) {
      p.hp = 0; p.cracked = true; p.seal = 0;
      sfx.close();
      for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28; parts.spawn(p.pos.x + Math.cos(a) * 5, 6.5 + Math.sin(a) * 5, p.pos.z, Math.cos(a) * 4, Math.sin(a) * 4, rand(-2, 2), { life: 0.6, size: 0.5, color: [1, 1, 1] }); }
      hud.floater(p.pos, 'CRACKED — SEAL IT ON FOOT');
      if (!S.sealHint) { S.sealHint = true; say('MACK', 'It\'s cracked. Now I walk up and jam the flask of grey in it. Hold E. Three seconds. Sally, cover me.', 4); later(() => S && say('SALLY', 'Covering! I\'m covering! I\'m covering EVERYTHING!', 2.4), 4200); }
    }
  }
  function nearestCracked() {
    let best = null, bd = 8;
    for (const p of S.portals) if (p.cracked) { const d = Math.hypot(p.pos.x - P.pos.x, p.pos.z - P.pos.z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  function updateSealing(pdt) {
    const p = !P.inCar && !S.over ? nearestCracked() : null;
    for (const q of S.portals) if (q !== p && q.seal > 0) q.seal = Math.max(0, q.seal - pdt);
    P.sealing = null;
    if (!p) return;
    if (keys.has('KeyE')) {
      p.seal += pdt;
      P.sealing = p;
      P.face = Math.atan2(p.pos.x - P.pos.x, p.pos.z - P.pos.z);
      if (Math.random() < pdt * 30) parts.spawn(p.pos.x + rand(-1, 1), rand(1, 10), p.pos.z, rand(-1, 1), rand(-2, 2), rand(1, 3), { life: 0.6, size: 0.6, color: [0.75, 0.75, 0.78], kind: 1 });
      if (p.seal >= 3) {
        sfx.gulp();
        say('MACK', pick(['Grey. Drink up.', 'Last call.', 'Closing time, sweetheart.', 'Take it straight, no chaser.']), 2);
        closePortal(p);
      }
    } else p.seal = Math.max(0, p.seal - pdt * 2);
  }

  // hitscan from (o) in direction (d): returns hit point
  const _hp = V();
  function shoot(o, dx, dz, range, dmg, color, pierce = 1) {
    const wall = rayDist(o.x, o.z, dx, dz, range);
    const hits = [];
    for (const e of S.enemies) {
      const ex = e.pos.x - o.x, ez = e.pos.z - o.z;
      const t = ex * dx + ez * dz;
      if (t < 0 || t > wall) continue;
      const px = ex - dx * t, pz = ez - dz * t;
      if (px * px + pz * pz < (e.r + 0.35) * (e.r + 0.35)) hits.push([t, e, null]);
    }
    for (const p of S.portals) {
      const ex = p.pos.x - o.x, ez = p.pos.z - o.z;
      const t = ex * dx + ez * dz;
      if (t < 0 || t > wall) continue;
      const px = ex - dx * t, pz = ez - dz * t;
      if (px * px + pz * pz < 20) hits.push([t, null, p]);
    }
    for (const c of S.civs) {
      if (c.dead) continue;
      const ex = c.pos.x - o.x, ez = c.pos.z - o.z;
      const t = ex * dx + ez * dz;
      if (t < 0 || t > wall) continue;
      const px = ex - dx * t, pz = ez - dz * t;
      if (px * px + pz * pz < 0.6) hits.push([t, null, null, c]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    let end = wall, n = 0;
    for (const [t, e, p, civ] of hits) {
      if (n >= pierce) break;
      n++;
      end = t;
      _hp.set(o.x + dx * t, o.y, o.z + dz * t);
      if (civ) { killCiv(civ, true); continue; }
      if (e) {
        hitEnemy(e, dmg * (n === 1 ? 1 : 0.7));
        for (let k = 0; k < 6; k++) parts.spawn(_hp.x, _hp.y, _hp.z, dx * 5 + rand(-4, 4), rand(1, 5), dz * 5 + rand(-4, 4), { life: 0.4, size: 0.4, color: e.rgb, grav: 15 });
      } else {
        hitPortal(p, dmg);
        parts.spawn(_hp.x, 4 + Math.random() * 5, _hp.z, rand(-3, 3), rand(-3, 3), 0, { life: 0.3, size: 0.6, color: hexToRgb(p.color) });
        n = pierce; // portals stop the round
        break;
      }
    }
    if (n < pierce) end = wall;
    _hp.set(o.x + dx * end, o.y, o.z + dz * end);
    tracers.add(o, _hp, color, 0.09);
    if (!hits.length && wall < range) {
      for (let k = 0; k < 4; k++) parts.spawn(_hp.x, _hp.y, _hp.z, -dx * rand(2, 6) + rand(-2, 2), rand(1, 4), -dz * rand(2, 6) + rand(-2, 2), { life: 0.3, size: 0.3, color: [0.9, 0.9, 0.9], grav: 12 });
    }
    return _hp;
  }

  function fireRocket(from, tx, tz, target) {
    const dx = tx - from.x, dz = tz - from.z, d = Math.hypot(dx, dz) || 1;
    const mesh = new THREE.Mesh(rocketGeo, rocketMat);
    mesh.position.copy(from);
    scene.add(mesh);
    // with a lock, she fires a touch wide and lets the heat-seeker curve it in
    const a = Math.atan2(dx, dz) + (target && d > 12 ? (Math.random() < 0.5 ? -1 : 1) * rand(0.25, 0.45) : 0);
    S.rockets.push({ mesh, pos: from.clone(), vx: Math.sin(a) * ROCKET_SPEED, vz: Math.cos(a) * ROCKET_SPEED, life: 2.2, target });
    recEvent(['r', r1(from.x), r1(from.z), r1(tx), r1(tz)]);
    S.stats.rockets++;
    sfx.rocket();
    flashes.light(from.x, from.y, from.z, 300, 0.08);
    if (Math.random() < 0.35) quip('SALLY', rocketDeck, 1, 4);
  }

  function enemyRocket(from, tx, tz, color) {
    const dx = tx - from.x, dz = tz - from.z, d = Math.hypot(dx, dz) || 1;
    const mesh = new THREE.Mesh(rocketGeo, gangMat(color));
    mesh.position.copy(from);
    scene.add(mesh);
    S.rockets.push({ mesh, pos: from.clone(), vx: dx / d * 34, vz: dz / d * 34, life: Math.min(2.2, d / 34 + 0.3), target: null, enemy: true, color });
    sfx.rocket();
  }

  function enemyShot(from, dx, dz, color, speed = 34, dmg = 7, kind = 'ball') {
    const big = kind === 'donut' || kind === 'bomb';
    const mesh = new THREE.Mesh(kind === 'donut' ? donutGeo : ballGeo, gangMat(color));
    if (kind === 'bomb') mesh.scale.setScalar(2.2);
    mesh.position.copy(from);
    scene.add(mesh);
    S.shots.push({ mesh, pos: from.clone(), vx: dx * speed, vz: dz * speed, vy: big ? 9 : 0, life: big ? 2.4 : 1.8, color, dmg, big, kind });
    sfx.pop(clamp(1 - Math.hypot(from.x - focus().x, from.z - focus().z) / 90, 0.1, 1));
  }

  // ===================================================================== car
  function enterCar() {
    P.inCar = true;
    CAR.auto = null;
    if (SA.driving) { SA.driving = false; sallyInCar.position.x = 0; quip('SALLY', ['Fine, you drive. I\'ll shoot.', 'Back to the rockets!', 'Did you SEE that? Tell me you saw that.'], 1, 2); }
    if (CAR.intro) { CAR.intro = null; say('SALLY', pick(['Scoot over? No. YOU drive. I shoot.', 'Took you long enough. Shotgun!']), 2.4); }
    SA.inCar = !SA.down;
    mack.root.visible = false;
    sallyM.root.visible = false;
    sfx.door();
    quip('SALLY', LINES.carIn, 0.8, 3);
  }
  function exitCar(forced = false, sallyDrives = false) {
    aimLine.visible = false;
    P.inCar = false;
    const s = Math.sin(CAR.ang), c = Math.cos(CAR.ang);
    P.pos.set(CAR.pos.x - c * 2.4, 0, CAR.pos.z + s * 2.4);
    if (sallyDrives && !forced && !SA.down && CAR.alive && !S.over) {
      // Mack hops out; Sally slides over to the wheel and goes hunting
      pushOut(P.pos, 0.7);
      mack.root.visible = true;
      SA.inCar = true; SA.driving = true; SA.huntT = 0; SA.parkT = 0.6; SA.drv = { stuck: 0, rev: 0, path: null, pathT: 0 };
      sallyInCar.position.x = -1.1; // driver's seat
      sallyM.root.visible = false;
      sfx.door();
      quip('SALLY', ['Scoot! My turn to drive!', 'Go seal it, handsome. I\'ll mow the lawn.', 'Ooh, the wheel! Watch THIS!', 'I got the thugs. You got the hole in the sky.'], 1, 2);
      return;
    }
    if (!SA.down) SA.pos.set(CAR.pos.x + c * 2.4, 0, CAR.pos.z - s * 2.4);
    pushOut(P.pos, 0.7); pushOut(SA.pos, 0.7);
    mack.root.visible = true;
    sallyM.root.visible = !SA.down || SA.downT < 3;
    SA.inCar = false;
    if (forced) damagePlayer(15);
    else { sfx.door(); quip('SALLY', LINES.carOut, 0.6, 3); }
    setEngine(false);
  }

  function updateCar(dt) {
    const fwdX = Math.sin(CAR.ang), fwdZ = Math.cos(CAR.ang);
    const rgtX = Math.cos(CAR.ang), rgtZ = -Math.sin(CAR.ang);
    let vf = CAR.vx * fwdX + CAR.vz * fwdZ;
    let vr = CAR.vx * rgtX + CAR.vz * rgtZ;
    if (!P.inCar) CAR.boosting = false; // only Mack's foot or Sally's sets it below
    if (P.inCar && !S.over) {
      const thr = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const st = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
      if (thr > 0) vf += (vf < 0 ? 60 : 30) * dt;
      else if (thr < 0) vf -= (vf > 0 ? 60 : 18) * dt;
      CAR.steer += (st - CAR.steer) * Math.min(1, dt * 8);
      const hb = keys.has('Space');
      vr *= Math.exp(-(hb ? 0.9 : 9) * dt);
      if (hb) vf *= Math.exp(-0.6 * dt);
      // Shift: rocket boost out the tailpipes
      CAR.boosting = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && CAR.boost > 0.02 && thr >= 0;
      if (CAR.boosting) { vf += 70 * dt; CAR.boost = Math.max(0, CAR.boost - dt * 0.45); if (!CAR.wasBoosting) { sfx.boost(); fx.shake = Math.max(fx.shake, 0.3); } }
      else CAR.boost = Math.min(1, CAR.boost + dt * (Math.abs(vr) > 5 ? 0.35 : 0.1)); // drifting refills the tank
      CAR.wasBoosting = CAR.boosting;
      vf = clamp(vf, -16, CAR.boosting ? 78 : 50);
      CAR.drift = Math.abs(vr);
    } else if (CAR.intro && !S.over) {
      const I = CAR.intro;
      const d = (I.x - CAR.pos.x) * Math.sin(CAR.ang) + (I.z - CAR.pos.z) * Math.cos(CAR.ang);
      if (!I.arrived) {
        const want = Math.max(0, Math.min(34, d * 1.6));
        vf += clamp(want - vf, -70 * dt, 40 * dt);
        vr *= Math.exp(-9 * dt);
        setEngine(true, vf);
        if (d < 14 && vf > 6) {
          // hard on the brakes: smoke, rubber and a squeal
          const nfX0 = Math.sin(CAR.ang), nfZ0 = Math.cos(CAR.ang), nrX0 = Math.cos(CAR.ang), nrZ0 = -Math.sin(CAR.ang);
          for (const side of [1, -1]) {
            const wx = CAR.pos.x - nfX0 * 1.98 + nrX0 * side, wz = CAR.pos.z - nfZ0 * 1.98 + nrZ0 * side;
            skidMark(wx, wz, CAR.ang, vf * dt * 1.2);
            if (Math.random() < 0.6) parts.spawn(wx, 0.4, wz, rand(-1, 1), rand(0.5, 2), rand(-1, 1), { life: 1.2, size: 2, grow: 3, color: [0.82, 0.83, 0.86], alpha: 0.45, drag: 1.5, kind: 1 });
          }
          CAR.screechT -= dt;
          if (CAR.screechT <= 0) { CAR.screechT = 0.18; sfx.screech(1); }
        }
        if (d < 0.6 || (vf < 0.5 && d < 4)) {
          I.arrived = true; vf = 0; CAR.vx = CAR.vz = 0;
          setEngine(false);
          sfx.horn();
          say('SALLY', pick(['Get in, loser! We\'re solving crimes!', 'Get in, loser! The city\'s turning colors!', 'GET IN, LOSER! I already loaded the rockets!']), 3.2);
        }
      } else {
        vf = 0; vr = 0;
        I.wait += dt;
        // ignored? she climbs out and follows on foot, complaining
        if (I.wait > 12 && SA.inCar && Math.hypot(P.pos.x - CAR.pos.x, P.pos.z - CAR.pos.z) > 25) {
          const s = Math.sin(CAR.ang), c = Math.cos(CAR.ang);
          SA.inCar = false; SA.pos.set(CAR.pos.x + c * 2.4, 0, CAR.pos.z - s * 2.4); sallyM.root.visible = true;
          sfx.door();
          say('SALLY', pick(['Fine! I\'ll WALK! In HEELS!', 'Rude! Wait up, Mack!', 'You walk, I walk. That\'s the rule. I just made it up.']), 2.6);
          CAR.intro = null;
        }
      }
    } else if (SA.driving && !CAR.auto && !S.over) {
      const c = sallyDrive(dt, vf);
      if (c.thr > 0) vf += 30 * dt; else if (c.thr < 0) vf -= 45 * dt;
      CAR.boosting = !!c.boost && c.thr >= 0;
      if (CAR.boosting) { vf += 60 * dt; if (!CAR.wasBoosting && Math.hypot(P.pos.x - CAR.pos.x, P.pos.z - CAR.pos.z) < 60) sfx.boost(); }
      CAR.wasBoosting = CAR.boosting;
      CAR.steer += (c.st - CAR.steer) * Math.min(1, dt * 7);
      CAR.drift = Math.abs(vr);
      vr *= Math.exp(-5 * dt);
      vf = clamp(vf, -12, CAR.boosting ? 62 : 36);
      setEngine(Math.hypot(P.pos.x - CAR.pos.x, P.pos.z - CAR.pos.z) < 70, vf);
    } else if (CAR.auto && !S.over) {
      const c = autopilot(dt, vf);
      if (c.thr > 0) vf += 26 * dt; else if (c.thr < 0) vf -= 40 * dt;
      CAR.steer += (c.st - CAR.steer) * Math.min(1, dt * 6);
      vr *= Math.exp(-9 * dt);
      vf = clamp(vf, -10, 32);
      setEngine(true, vf);
    } else {
      CAR.steer *= 0.9;
      vr *= Math.exp(-9 * dt);
      vf *= Math.exp(-2.5 * dt);
    }
    vf *= Math.exp(-0.25 * dt);
    const turn = CAR.steer * 2.3 * clamp(vf / 10, -1, 1) * (1 - Math.min(0.45, Math.abs(vf) / 110)) * (P.inCar && keys.has('Space') ? 1.7 : 1);
    CAR.ang += turn * dt;
    const nfX = Math.sin(CAR.ang), nfZ = Math.cos(CAR.ang), nrX = Math.cos(CAR.ang), nrZ = -Math.sin(CAR.ang);
    CAR.vx = nfX * vf + nrX * vr;
    CAR.vz = nfZ * vf + nrZ * vr;
    CAR.pos.x += CAR.vx * dt;
    CAR.pos.z += CAR.vz * dt;
    CAR.speed = vf;
    // two-circle collision against the city
    for (const off of [1.5, -1.5]) {
      const p = { x: CAR.pos.x + nfX * off, z: CAR.pos.z + nfZ * off };
      const n = pushOut(p, 1.35);
      if (n) {
        CAR.pos.x = p.x - nfX * off; CAR.pos.z = p.z - nfZ * off;
        const vn = CAR.vx * n.x + CAR.vz * n.z;
        if (vn < 0) {
          CAR.vx -= vn * n.x * 1.4; CAR.vz -= vn * n.z * 1.4;
          if (-vn > 8) { sfx.crash(Math.min(1, -vn / 25)); CAR.hp -= Math.max(0, -vn - 8) * 0.7; smashCar(-vn, p.x - n.x * 1.3, p.z - n.z * 1.3, n.x, n.z); if (CAR.hp <= 0 && CAR.alive) destroyCar(); }
        }
      }
    }
    carM.root.position.set(CAR.pos.x, 0, CAR.pos.z);
    carM.root.rotation.y = CAR.ang;
    if (P.inCar || SA.driving) {
      const bx = CAR.pos.x - nfX * 3.3, bz = CAR.pos.z - nfZ * 3.3;
      if (CAR.boosting) for (let k = 0; k < 4; k++) {
        for (const side of [0.55, -0.55]) {
          const x = bx + nrX * side, z = bz + nrZ * side;
          parts.spawn(x, 0.55, z, -nfX * rand(14, 24) + rand(-1, 1), rand(0, 1.5), -nfZ * rand(14, 24) + rand(-1, 1), { life: rand(0.12, 0.25), size: rand(0.9, 1.6), color: k % 2 ? [1, 0.55, 0.12] : [1, 0.9, 0.4], kind: 1, drag: 3 });
        }
        if (k === 0) flashes.light(bx, 1, bz, 180, 0.05);
      }
      const drifting = (CAR.drift || 0) > 4.5 && Math.abs(vf) > 6;
      if (drifting || CAR.boosting) {
        for (const side of [1.0, -1.0]) {
          const wx = CAR.pos.x - nfX * 1.98 + nrX * side, wz = CAR.pos.z - nfZ * 1.98 + nrZ * side;
          if (Math.random() < 0.7) parts.spawn(wx, 0.4, wz, rand(-1, 1) - CAR.vx * 0.05, rand(0.5, 2), rand(-1, 1) - CAR.vz * 0.05, { life: rand(0.8, 1.6), size: rand(1.5, 2.6), grow: 3, color: [0.82, 0.83, 0.86], alpha: 0.45, drag: 1.5, kind: 1 });
          skidMark(wx, wz, Math.atan2(CAR.vx, CAR.vz), Math.hypot(CAR.vx, CAR.vz) * dt * 1.2);
        }
        CAR.screechT -= dt;
        if (CAR.screechT <= 0) { CAR.screechT = 0.2; sfx.screech(drifting ? clamp(Math.abs(vf) / 30, 0.5, 1.2) : 0.7); }
      }
    }
    carM.body.rotation.z = -CAR.steer * clamp(vf / 40, -1, 1) * 0.06;
    carM.body.rotation.x = -clamp(vf / 50, -1, 1) * 0.02;
    carM.wheels.forEach((w, i) => { w.children.forEach((c) => (c.rotation.x += vf * dt / 0.42)); if (i < 2) w.rotation.y = CAR.steer * 0.45; });
    sallyInCar.visible = SA.inCar;
    if (P.inCar) setEngine(true, vf);
    const on = P.inCar ? 160 : 0;
    headL.intensity = headR.intensity = on;
    for (const [l, side] of [[headL, 0.8], [headR, -0.8]]) {
      l.position.set(CAR.pos.x + nfX * 2.6 + nrX * side, 1.0, CAR.pos.z + nfZ * 2.6 + nrZ * side);
      l.target.position.set(CAR.pos.x + nfX * 22 + nrX * side, 0, CAR.pos.z + nfZ * 22 + nrZ * side);
    }
    // run the Syndicate over
    if (Math.abs(vf) > 8 && P.inCar) for (const c of S.civs) if (!c.dead && Math.hypot(c.pos.x - CAR.pos.x, c.pos.z - CAR.pos.z) < 2.6) killCiv(c, true);
    // foot thugs never stop the Packard: anything faster than a crawl goes straight through them
    if (Math.abs(vf) > 3 && (P.inCar || SA.driving)) {
      for (const e of S.enemies.slice()) {
        if (e.dead) continue;
        if (e.type === 'lowrider' || e.type === 'roomba' || e.type === 'truck' || e.type === 'copter' || e.type === 'demon') continue;
        if (e.type === 'beast' && Math.hypot(e.pos.x - CAR.pos.x, e.pos.z - CAR.pos.z) < 2.4 + e.r) { if (e.hitCd <= 0) { e.hitCd = 1; hitEnemy(e, 50); CAR.vx *= -0.4; CAR.vz *= -0.4; sfx.crash(1); fx.shake = 0.6; } continue; }
        if (Math.hypot(e.pos.x - CAR.pos.x, e.pos.z - CAR.pos.z) < 2.4 + e.r) {
          if (e.type === 'boss') { if (e.hitCd <= 0) { hitEnemy(e, 60); e.hitCd = 1; vf *= 0.3; sfx.crash(1); CAR.vx *= 0.3; CAR.vz *= 0.3; CAR.hp -= 15; smashCar(20, e.pos.x, e.pos.z); } }
          else { const ex = e.pos.x, ez = e.pos.z; hitEnemy(e, 999); explode(ex, 1.2, ez, 5, 45, true); splat(ex, ez, 3, e.color, 0.5); if (Math.random() < 0.3) quip('SALLY', ['SPLAT!', 'Ten points!', 'Hood ornament!', 'He EXPLODED, Mack! Do it again!'], 1, 3); }
        }
      }
    }
  }

  // ===================================================================== update
  function update(rdt) {
    if (!S) return;
    if (S.ended) return; // the case is over; onEnd has already been called once
    runTimers(rdt);
    if (!S) return;
    if (S.replay) { updateReplay(rdt); return; }
    // Focus (F toggles): time crawls, paid for with the color Mack has stolen
    if (!S.over && pressed.has('KeyF')) {
      if (P.focusOn) P.focusOn = false;
      else if (P.focusMeter > 0.05) { P.focusOn = true; sfx.focus(); } else quip('MACK', ['Nothing left in the tank. Go take some color off somebody.'], 1, 2);
    }
    if (P.focusOn) { P.focusMeter = Math.max(0, P.focusMeter - rdt * 0.14); if (P.focusMeter <= 0 || S.over) P.focusOn = false; }
    P.focusHeld = P.focusOn;
    const slowed = P.focus > 0 || P.focusHeld;
    const slow = S.down !== undefined ? 0.3 : slowed ? 0.3 : 1;
    const dt = rdt * slow, pdt = rdt * (slowed ? 0.85 : 1);
    S.time += dt;
    P.focus = Math.max(0, P.focus - rdt);
    // pain pills: the world floods with color for a while
    if (P.color > 0) { P.color = Math.max(0, P.color - rdt); if (P.color === 0) say('MACK', pick(LINES.pillsOff), 2.5); }
    NU.ntime.value += rdt;
    const nausea = Math.max(clamp((S.bleed - 0.55) / 0.45, 0, 1), (S.caseDef.hell || 0) * 0.35);
    NU.seeColor.value += (Math.max(P.color > 0 ? Math.min(1, P.color / 1.5) : P.focusOn ? 0.38 : 0, nausea * 0.3) - NU.seeColor.value) * Math.min(1, rdt * 3);
    S.quipT -= rdt; S.donutT -= rdt; S.retortT -= rdt;

    // aim on the ground plane
    ray.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), camera);
    if (!ray.ray.intersectPlane(plane, aim)) {
      // looking at the sky: aim far down the line of sight instead
      const d = ray.ray.direction, f0 = focus(), hl = Math.hypot(d.x, d.z) || 1;
      aim.set(f0.x + d.x / hl * 120, 1.4, f0.z + d.z / hl * 120);
    } else if (camMode === 'chase') {
      // keep the aim point within sensible range
      const f0 = focus(), dx = aim.x - f0.x, dz = aim.z - f0.z, dd = Math.hypot(dx, dz);
      if (dd > 140) aim.set(f0.x + dx / dd * 140, 1.4, f0.z + dz / dd * 140);
    }

    if (S.over) {
      S.endT -= rdt;
      if (S.endT <= 0) {
        const r = { win: S.result === 'win', reason: S.reason, stats: { ...S.stats, score: S.score, time: S.time, peak: S.peak, hp: P.hp / P.maxHp, evidence: S.evidence.length, evidenceTotal: (EVIDENCE[S.caseDef.id] || []).length }, rec: S.rec, evidence: S.evidence.slice() };
        S.running = false;
        S.ended = true;
        onEnd(r);
        return;
      }
    } else handleInput(rdt, pdt);

    updateWayfinding(rdt);
    updateHell(rdt);
    updateDebris(dt);
    carSmoke(dt);
    updateKnocks(dt);
    updateCombo(dt);
    updateCivilians(dt);
    // the radio crackles between the action: news, fake news, and the odd hint
    S.radioT -= rdt;
    if (S.radioT <= 0 && !S.over) {
      S.radioT = rand(55, 80);
      const line = S.radio.length ? S.radio.shift() : radioDeck.draw();
      sfx.radio();
      say('RADIO', line, 6.5);
    }
    updateCops(dt);
    if (CAR.alive) updateCar(P.inCar ? pdt : dt);
    else if (CAR.respawn > 0) {
      CAR.respawn -= dt;
      if (CAR.respawn <= 0) {
        const p = spawnPoint(25, 45);
        CAR.pos.set(p.x, 0, p.z); CAR.vx = CAR.vz = 0; CAR.hp = 400; CAR.alive = true; CAR.ang = Math.random() * 6;
        carM.root.traverse((o) => { if (o.userData.origMat) o.material = o.userData.origMat; });
        restoreCar(); carM.body.rotation.z = 0;
        say('SALLY', 'Got us a new ride, Mack! Don\'t ask whose!', 3);
      }
    }
    updatePlayerModel(pdt);
    updateSally(dt);
    updateEnemies(dt);
    updatePortals(dt);
    updateShots(dt);
    updateRockets(dt);
    updatePickups(dt);
    updateBodies(dt);
    spawner(dt);
    world(rdt, dt);
    updateCamera(rdt);
    // bleed
    S.bleedT -= rdt;
    if (S.bleedT <= 0) {
      S.bleedT = 0.5;
      // between waves the rain gets a chance: the color washes back a little (about a quarter over a breather)
      fadeAll(S.stage && S.stage.goal.type === 'breather' ? 0.007 : 0.001);
      S.bleed = clamp(coverage(S.area) / (S.caseDef.bleedCap * BLEED_SCALE), 0, 1.2);
      S.peak = Math.max(S.peak, S.bleed);
      NU.paintH.value = 6 + S.bleed * 24;
      // Mack's stomach turns as the city fills with color
      const lvl = S.bleed < 0.35 ? 0 : S.bleed < 0.6 ? 1 : S.bleed < 0.85 ? 2 : 3;
      if (lvl > (S.sickLvl || 0)) say('MACK', pick(LINES.sick[lvl - 1]), 3.2);
      S.sickLvl = Math.max(S.sickLvl || 0, lvl);
      if (lvl < (S.sickLvl || 0) - 1) S.sickLvl = lvl + 1;
      if (S.bleed >= 1 && !S.over) lose('bleed');
    }
    flushPaint(rdt);
    // HUD
    hud.update({
      score: S.score, mult: S.mult, combo: S.comboT / 5, wave: waveInfo(),
      boost: CAR.boost, hp: P.hp / P.maxHp, flasks: P.flasks, maxFlasks: P.maxFlasks, bleed: Math.min(1, S.bleed), focus: P.focus > 0 || P.focusHeld, focusMeter: P.focusMeter, pills: P.pills, ammo: P.ammo, reloading: P.reload > 0, seeColor: P.color > 0,
      inCar: P.inCar, carHp: CAR.alive ? CAR.hp / 400 : 0, carAlive: CAR.alive,
      player: focus(), enemies: S.enemies, portals: S.portals, car: CAR, sally: SA, boss: S.boss && !S.boss.dead ? S.boss : null,
      civs: S.civs, aim, hint: currentHint(), camera, time: S.time, heading: camMode === 'chase' ? camYaw : Math.PI, speed: Math.abs(CAR.speed), clock: S.time, stageText: S.stage ? S.stage.text : '', objectives: objectiveMarks(), sallyHp: SA.hp / SA.maxHp, sallyDown: SA.down,
    });
    recFrame(rdt);
    pressed.clear();
  }

  function objectiveMarks() {
    const g = S.stage && S.stage.goal, out = [];
    if (!g) return out;
    if (g.type === 'goto') out.push({ x: g.x, z: g.z, c: '#ff2a3a', k: 'goto', label: g.label });
    if (g.type === 'portals') for (const p of S.portals) out.push({ x: p.pos.x, z: p.pos.z, c: '#ff2d95', k: 'portal' });
    if (g.type === 'roombas' || S.stage.roombas) for (const e of S.enemies) if (e.type === 'roomba') out.push({ x: e.pos.x, z: e.pos.z, c: '#18e0ff', k: 'bot' });
    if (S.wanted) for (const e of S.enemies) if (e.type === 'copcar') out.push({ x: e.pos.x, z: e.pos.z, c: '#3060ff', k: 'cop' });
    for (const e of S.enemies) if (e.type === 'copter' || e.type === 'beast') out.push({ x: e.pos.x, z: e.pos.z, c: '#ffe11a', k: e.type });
    if (g.type === 'boss' && S.boss && !S.boss.dead) out.push({ x: S.boss.pos.x, z: S.boss.pos.z, c: '#ffe11a', k: 'boss' });
    if (g.type === 'kill') { let best = null, bd = 1e9; for (const e of S.enemies) { const d = Math.hypot(e.pos.x - focus().x, e.pos.z - focus().z); if (d < bd) { bd = d; best = e; } } if (best && bd > 50) out.push({ x: best.pos.x, z: best.pos.z, c: '#ffffff', k: 'kill' }); }
    return out;
  }

  function waveInfo() {
    const waves = S.stages.filter((x) => x.stamp && x.stamp.startsWith('WAVE'));
    if (!waves.length) return null;
    const total = waves.length;
    let n = 1, state = 'incoming';
    for (let i = 0; i <= S.stageIdx && i < S.stages.length; i++) {
      const st = S.stages[i];
      if (st.stamp && st.stamp.startsWith('WAVE')) { n = waves.indexOf(st) + 1; state = 'live'; }
      if (st.goal.type === 'breather' && i === S.stageIdx) state = 'cleared';
    }
    if (S.stageIdx < S.stages.indexOf(waves[0])) { n = 1; state = 'incoming'; }
    if (S.over && S.result === 'win') state = 'done';
    return { n, total, open: S.portals.length, state, next: Math.max(0, Math.ceil(S.breathT || 0)) };
  }

  function currentHint() {
    if (S.over) return '';
    { const cp = !P.inCar && nearestCracked(); if (cp) return cp.seal > 0 ? `SEALING ${'▮'.repeat(Math.ceil(cp.seal / 3 * 10))}${'▯'.repeat(10 - Math.ceil(cp.seal / 3 * 10))}` : 'Hold E — jam the flask of grey into the portal'; }
    if (!P.inCar && CAR.alive && P.pos.distanceTo(CAR.pos) < 5) return 'E — Get in the car';
    if (P.inCar) return '';
    if (L.bar.door && Math.hypot(P.pos.x - L.bar.door.x, P.pos.z - L.bar.door.z) < 5) return S.barUsed ? 'The Last Drop — Gus already patched you up' : 'E — Duck into The Last Drop';
    return '';
  }

  function handleInput(rdt, pdt) {
    if (pressed.has('KeyZ')) summonCar();
    if (pressed.has('KeyC')) toggleCam();
    if (pressed.has('KeyE') && !(!P.inCar && nearestCracked())) {
      if (P.inCar) exitCar(false, true);
      else if (CAR.alive && P.pos.distanceTo(CAR.pos) < (SA.driving ? 7 : 5)) enterCar();
      else if (SA.driving && CAR.alive) summonCar(); // Sally, come get me
      else if (!S.barUsed && L.bar.door && Math.hypot(P.pos.x - L.bar.door.x, P.pos.z - L.bar.door.z) < 5) {
        S.barUsed = true;
        P.hp = P.maxHp; P.flasks = P.maxFlasks;
        keys.clear(); mouse.down = false;
        onBar(S.caseDef);
      }
    }
    if (pressed.has('KeyQ')) {
      if (P.flasks > 0) {
        P.flasks--; S.stats.flasks++;
        P.hp = Math.min(P.maxHp, P.hp + 45);
        P.focus = 4;
        sfx.gulp();
        say('MACK', pick(LINES.flask), 2.2);
        hud.focus();
      } else quip('MACK', LINES.noFlask, 1, 2);
    }
    if (pressed.has('KeyG')) {
      if (P.pills > 0) {
        P.pills--; S.stats.flasks++;
        P.hp = P.maxHp; P.color = 12;
        sfx.pickup(); sfx.gulp();
        say('MACK', pick(LINES.pills), 3.2);
        hud.floater(P.pos, 'FULL GRIT · EVERYTHING IS IN COLOR');
      } else quip('MACK', LINES.noPills, 1, 2);
    }
    updateSealing(pdt);
    // holster for a moment and Mack thumbs fresh rounds in
    P.holsterT = P.aiming ? 0 : P.holsterT + pdt;
    if (!P.inCar && P.holsterT > 0.6 && P.ammo < 6 && P.reload <= 0) { P.reload = 1.0; sfx.reload(); }
    if (P.reload > 0) { P.reload -= pdt; if (P.reload <= 0) P.ammo = 6; }
    P.fireCd -= pdt; P.rollCd -= pdt;
    if (P.inCar) {
      P.pos.copy(CAR.pos);
      SA.cd -= pdt;
      if (mouse.down && SA.cd <= 0) {
        SA.cd = 0.55;
        const s = Math.sin(CAR.ang), c = Math.cos(CAR.ang);
        fireRocket(V(CAR.pos.x - c * 1.2, 1.7, CAR.pos.z + s * 1.2), aim.x, aim.z, nearestTarget(aim.x, aim.z, 10) || sallyPick(aim.x, aim.z, 14));
      }
      return;
    }
    // on foot
    let mx = 0, mz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    P.moveFwd = mz < 0;
    if (camMode === 'chase' && (mx || mz)) {
      // W walks away from the camera, A/D strafe across it
      const iy = -mz, ix = mx, fx0 = Math.sin(camYaw), fz0 = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
      mx = fx0 * iy + rx * ix; mz = fz0 * iy + rz * ix;
    }
    const ml = Math.hypot(mx, mz);
    if (ml) { mx /= ml; mz /= ml; }
    if ((pressed.has('KeyR') || pressed.has('Space') || pressed.has('ShiftLeft')) && P.rollCd <= 0) {
      P.roll = 0.38; P.rollCd = 0.9;
      P.rollDir.set(ml ? mx : Math.sin(P.face), 0, ml ? mz : Math.cos(P.face));
      for (let k = 0; k < 8; k++) parts.spawn(P.pos.x, 0.3, P.pos.z, rand(-3, 3), rand(1, 3), rand(-3, 3), { life: 0.4, size: 0.5, color: [0.7, 0.7, 0.75], kind: 0, grav: 10 });
    }
    if (P.roll > 0) {
      P.roll -= pdt;
      P.pos.x += P.rollDir.x * 22 * pdt; P.pos.z += P.rollDir.z * 22 * pdt;
    } else {
      const sp = P.sealing ? 0 : P.aiming ? 7 : 11;
      P.pos.x += mx * sp * pdt; P.pos.z += mz * sp * pdt;
    }
    P.moving = ml > 0;
    pushOut(P.pos, 0.7);
    // right mouse draws the big red revolver; left mouse only fires while aiming
    P.aiming = mouse.right && P.roll <= 0 && !P.sealing;
    P.aimT = clamp(P.aimT + (P.aiming ? pdt : -pdt) * 7, 0, 1);
    if (P.aiming) P.face = Math.atan2(aim.x - P.pos.x, aim.z - P.pos.z);
    else if (ml) P.face += wrapAngle(Math.atan2(mx, mz) - P.face) * Math.min(1, pdt * 12);
    if (mouse.down && !P.aiming && P.roll <= 0 && P.aimT === 0) { if (!P.drawHint) { P.drawHint = 1; say('MACK', 'Right mouse to pull the iron, genius. Then left to talk.', 2.6); } }
    if (P.aiming && P.aimT > 0.6 && mouse.down && P.fireCd <= 0 && P.roll <= 0 && P.reload <= 0) {
      if (P.ammo <= 0) { P.reload = 1.0; sfx.reload(); }
      else {
        // the big red revolver: heavy, slow, punches through two men
        P.fireCd = 0.2; P.ammo--;
        const sp = (Math.random() - 0.5) * 0.03;
        const a = P.face + sp;
        const o = V(P.pos.x + Math.sin(P.face) * 2.0 + Math.cos(P.face) * 0.42, 1.8, P.pos.z + Math.cos(P.face) * 2.0 - Math.sin(P.face) * 0.42);
        shoot(o, Math.sin(a), Math.cos(a), 85, 32, [1, 0.35, 0.3], 2);
        S.firing = true;
        sfx.revolver();
        flashes.light(o.x, o.y, o.z, 260, 0.06);
        parts.spawn(o.x, o.y, o.z, Math.sin(P.face) * 6, 0.5, Math.cos(P.face) * 6, { life: 0.08, size: 2.6, color: [1, 0.9, 0.8], kind: 1 });
        for (let k = 0; k < 3; k++) parts.spawn(o.x, o.y, o.z, Math.sin(P.face) * 3 + rand(-1, 1), rand(0.5, 1.5), Math.cos(P.face) * 3 + rand(-1, 1), { life: 0.9, size: 1.2, grow: 2, color: [0.7, 0.7, 0.72], alpha: 0.4, kind: 1 });
        fx.shake = Math.max(fx.shake, 0.18);
        P.kick = 1;
        if (P.ammo === 0) later(() => { if (S && P.ammo === 0 && P.reload <= 0) { P.reload = 1.0; sfx.reload(); } }, 250);
      }
    }
    // regen when out of trouble
    if (S.time - P.lastHurt > 6 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + 3 * pdt);
  }

  function nearestTarget(x, z, maxD) {
    let best = null, bd = maxD;
    for (const e of S.enemies) { const d = Math.hypot(e.pos.x - x, e.pos.z - z); if (d < bd) { bd = d; best = e; } }
    if (!best) for (const p of S.portals) { const d = Math.hypot(p.pos.x - x, p.pos.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  // goons only (no cops unless Mack's wanted); used for rocket re-acquire
  function nearestFoe(x, z, maxD) {
    let best = null, bd = maxD;
    for (const e of S.enemies) { if (e.dead || (e.cop && !S.wanted)) continue; const d = Math.hypot(e.pos.x - x, e.pos.z - z); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  // Sally's lock: whoever's standing in the biggest crowd she can see, closer is better
  function sallyPick(x, z, maxD) {
    let best = null, bs = 0;
    for (const e of S.enemies) {
      if (e.dead || e.emerge > 0 || (e.cop && !S.wanted)) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d > maxD || d < 4) continue;
      let crowd = 0;
      for (const o of S.enemies) if (o !== e && !o.dead && !o.cop && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < BLAST_R * 0.8) crowd++;
      const sc = (1 + crowd * 0.7 + (e.type === 'boss' || e.type === 'beast' ? 1.5 : 0)) / (0.35 + d / maxD);
      if (sc > bs && clearLine(x, z, e.pos.x, e.pos.z)) { bs = sc; best = e; }
    }
    if (!best) for (const p of S.portals) { const d = Math.hypot(p.pos.x - x, p.pos.z - z); if (!p.cracked && d < maxD && clearLine(x, z, p.pos.x, p.pos.z)) { best = p; break; } }
    return best;
  }
  // a rocket lands: a big flat-bottomed blast, a shockwave across the street, and goons come apart in paint
  function sallyBlast(x, y, z) {
    const hit = S.enemies.filter((e) => !e.dead && Math.hypot(e.pos.x - x, e.pos.z - z) < BLAST_R + e.r);
    explode(x, y, z, BLAST_R, BLAST_DMG, true, 5.5);
    flashes.ball(x, Math.max(1, y), z, BLAST_R * 0.75, 0.32);
    flashes.ring(x, z, BLAST_R * 1.5, 0xff2a3a, 0.5);
    flashes.ring(x, z, BLAST_R * 0.9, 0xffffff, 0.3, 0.3);
    flashes.light(x, 3, z, 3200, 0.3);
    // embers and Sally-red sparks in a hot ring
    for (let k = 0; k < 28; k++) { const a = Math.random() * 6.28, s = rand(14, 26); parts.spawn(x, 1, z, Math.cos(a) * s, rand(1, 5), Math.sin(a) * s, { life: rand(0.25, 0.5), size: rand(0.4, 0.8), color: [1, rand(0.15, 0.5), 0.1], drag: 3, kind: 0 }); }
    let n = 0;
    for (const e of hit) {
      // whoever was in the blast bursts into the paint they were made of; survivors get thrown
      const col = hexToRgb(e.color || pick(GANG_COLORS));
      for (let k = 0; k < 14; k++) parts.spawn(e.pos.x, 1.4, e.pos.z, rand(-9, 9), rand(5, 14), rand(-9, 9), { life: rand(0.6, 1.1), size: rand(0.4, 0.8), color: col, grav: 22, kind: 0 });
      if (!e.dead && e.type !== 'boss' && e.type !== 'beast' && e.type !== 'truck' && e.type !== 'copter') {
        const dx = e.pos.x - x, dz = e.pos.z - z, d = Math.hypot(dx, dz) || 1;
        e.pos.x += dx / d * 3; e.pos.z += dz / d * 3; pushOut(e.pos, e.r);
      }
      if (e.dead) n++;
    }
    if (n >= 3) { fx.shake = Math.max(fx.shake, 0.9); quip('SALLY', ['STRIKE!', `${n} in one! Somebody count that!`, 'Look at \'em FLY, Mack!', 'Bowling! It\'s just bowling with more screaming!'], 1, 3); }
  }

  function animWalk(m, speed, dt, phaseKey = 'walk') {
    if (!m.legL) return;
    m[phaseKey] += speed * dt * 0.9;
    const s = Math.sin(m[phaseKey]) * Math.min(1, speed / 6) * 0.7;
    m.legL.rotation.x = s; m.legR.rotation.x = -s;
    m.root.position.y = Math.abs(Math.sin(m[phaseKey])) * 0.08 * Math.min(1, speed / 6);
  }

  const _ro = V();
  function updatePlayerModel(dt) {
    if (P.inCar) return;
    const m = mack;
    m.root.rotation.order = 'YXZ';
    if (S.down !== undefined) {
      // shot down: knees give, then flat on his back in the rain
      S.down += dt;
      const k = Math.min(1, S.down * 1.6), e = k * k * (3 - 2 * k);
      m.root.position.set(P.pos.x - Math.sin(P.face) * e * 0.9, e * 0.25, P.pos.z - Math.cos(P.face) * e * 0.9);
      m.root.rotation.set(-e * 1.45, P.face, e * 0.2);
      m.legL.rotation.x = -e * 0.3; m.legR.rotation.x = e * 0.15;
      m.armL.rotation.x = -e * 2.6; m.armR.rotation.x = -e * 2.2; m.armR.rotation.z = -e * 0.6;
      aimLine.visible = false;
      return;
    }
    if (S.puke !== undefined) {
      S.puke += dt;
      const bend = Math.min(1, S.puke * 2);
      m.root.position.set(P.pos.x, 0, P.pos.z);
      m.root.rotation.set(bend * 0.85, P.face, 0);
      m.legL.rotation.x = m.legR.rotation.x = -bend * 0.4;
      m.armL.rotation.x = m.armR.rotation.x = -bend * 0.6;
      aimLine.visible = false;
      if (S.puke > 0.6 && Math.sin(S.puke * 5) > 0) for (let k = 0; k < 3; k++) {
        const hx = P.pos.x + Math.sin(P.face) * 1.0, hz = P.pos.z + Math.cos(P.face) * 1.0;
        parts.spawn(hx, 1.6, hz, Math.sin(P.face) * rand(2, 5) + rand(-1, 1), rand(-1, 1), Math.cos(P.face) * rand(2, 5) + rand(-1, 1), { life: 0.9, size: 0.45, color: hexToRgb(pick(GANG_COLORS)), grav: 16 });
        if (Math.random() < 0.2) splat(hx + Math.sin(P.face) * 2, hz + Math.cos(P.face) * 2, 0.8, pick(GANG_COLORS), 0.9, 3);
      }
      return;
    }
    if (P.roll > 0) {
      // tuck and roll: a full forward somersault around the hips, along the dive
      const k = 1 - P.roll / 0.38;
      const th = k * Math.PI * 2;
      const yaw = Math.atan2(P.rollDir.x, P.rollDir.z);
      const h = 0.95; // pivot height
      _ro.set(0, h - h * Math.cos(th), -h * Math.sin(th)).applyAxisAngle(V(0, 1, 0), yaw);
      m.root.position.set(P.pos.x + _ro.x, _ro.y, P.pos.z + _ro.z);
      m.root.rotation.set(th, yaw, 0);
      const tuck = Math.sin(k * Math.PI);
      m.legL.rotation.x = m.legR.rotation.x = -1.9 * tuck;
      m.armL.rotation.x = -1.4 - tuck * 0.6; m.armR.rotation.x = -1.45 - tuck * 0.4;
      m.head.rotation.x = 0.5 * tuck;
      m.root.scale.set(1, 1 - 0.18 * tuck, 1);
      if (Math.random() < dt * 40) parts.spawn(P.pos.x, 0.2, P.pos.z, rand(-2, 2), rand(1, 3), rand(-2, 2), { life: 0.45, size: 0.5, color: [0.8, 0.83, 0.88], alpha: 0.6, grav: 9 });
      return;
    }
    m.root.scale.set(1, 1, 1);
    m.root.rotation.set(0, P.face, 0);
    m.root.position.set(P.pos.x, 0, P.pos.z);
    m.head.rotation.x = 0;
    animWalk(m, P.moving ? 10 : 0, dt);
    if (!P.moving) { m.legL.rotation.x *= 0.8; m.legR.rotation.x *= 0.8; }
    // revolver kick and the reload flip
    P.kick = Math.max(0, P.kick - dt * 8);
    const up = P.aimT;
    if (P.sealing) { m.armL.rotation.x = -1.6; m.armR.rotation.x = -0.4; m.root.rotation.x = 0.25; m.flask.position.set(-0.42, 1.7, 0.9); }
    else { m.flask.position.set(0.42, 1.2, 0.05); }
    m.armR.rotation.x = -0.15 - up * 1.3 - P.kick * 0.45 + (P.reload > 0 ? 0.5 : 0);
    m.gun.position.set(0.42, 1.78 - (1 - up) * 0.75, 0.68 - (1 - up) * 0.5);
    m.gun.rotation.x = (1 - up) * 1.2 - P.kick * 0.5 + (P.reload > 0 ? 0.8 + Math.sin(P.reload * 18) * 0.2 : 0);
    m.armL.rotation.x = P.reload > 0 ? -1.2 : -0.25 - up * 0.9;
    m.armL.rotation.z = -0.15 - up * -0.5;
    aimLine.visible = up > 0.6;
    if (aimLine.visible) {
      const o = V(P.pos.x + Math.sin(P.face) * 2.2 + Math.cos(P.face) * 0.42, 1.8, P.pos.z + Math.cos(P.face) * 2.2 - Math.sin(P.face) * 0.42);
      const d = Math.min(rayDist(o.x, o.z, Math.sin(P.face), Math.cos(P.face), 60), Math.hypot(aim.x - o.x, aim.z - o.z));
      aimLine.position.set(o.x + Math.sin(P.face) * d / 2, 1.8, o.z + Math.cos(P.face) * d / 2);
      aimLine.rotation.set(0, P.face, 0);
      aimLine.scale.set(1, 1, d);
    }
  }

  // Sally picks her mark a few times a second; a red reticle tightens on whoever she's locked
  function updateSallyLock(dt) {
    SA.lockT = (SA.lockT || 0) - dt;
    if (SA.lock && (SA.lock.dead || !(S.enemies.includes(SA.lock) || S.portals.includes(SA.lock)))) SA.lock = null;
    if (SA.lockT <= 0) {
      SA.lockT = 0.25;
      const o = SA.inCar ? CAR.pos : SA.pos;
      const prev = SA.lock;
      SA.lock = SA.down || S.over ? null : sallyPick(o.x, o.z, SA.inCar ? 48 : 42);
      if (SA.lock && SA.lock !== prev) { SA.lockAge = 0; if (!prev && Math.random() < 0.15) quip('SALLY', ['Got one!', 'Locked!', 'Ooh, a crowd!', 'Hold still, sweetie.'], 1, 6); }
    }
    SA.lockAge = (SA.lockAge || 0) + dt;
    const t = SA.lock;
    lockRet.visible = !!t;
    if (t) {
      const big = t.r ? Math.max(1.6, t.r * 1.3) : 5.5;
      const k = Math.max(0, 1 - SA.lockAge * 4);
      lockRet.position.set(t.pos.x, S.portals.includes(t) ? 6 : 0.3, t.pos.z);
      lockRet.scale.setScalar(big * (1 + k * 1.5));
      lockRet.rotation.y += dt * 2.5;
    }
  }

  function updateSally(dt) {
    updateSallyLock(dt);
    if (SA.down) {
      // she sits down in the rain, then storms off to the bar
      SA.downT += dt;
      sallyInCar.visible = false;
      sallyM.root.rotation.x = -Math.min(1, SA.downT * 2) * 1.2;
      sallyM.root.position.y = 0.2;
      if (SA.downT > 3) sallyM.root.visible = false;
      return;
    }
    if (S.time - SA.lastHurt > 6 && SA.hp < SA.maxHp) SA.hp = Math.min(SA.maxHp, SA.hp + 4 * dt);
    if (SA.inCar) {
      // auto-fire from the passenger window when Mack isn't pointing (not while she's got the wheel)
      if (!mouse.down && !S.over && !SA.driving) {
        SA.cd -= dt;
        if (SA.cd <= 0) {
          const t = SA.lock;
          if (t) {
            SA.cd = 1.25;
            const s = Math.sin(CAR.ang), c = Math.cos(CAR.ang);
            fireRocket(V(CAR.pos.x - c * 1.2, 1.7, CAR.pos.z + s * 1.2), t.pos.x, t.pos.z, t);
          } else SA.cd = 0.3;
        }
      }
      const tube = sallyInCar.userData.tube;
      tube.rotation.y = Math.atan2(aim.x - CAR.pos.x, aim.z - CAR.pos.z) - CAR.ang;
      return;
    }
    // follow Mack, keep a little to his side
    const tx = P.pos.x - Math.sin(P.face) * 3 + Math.cos(P.face) * 2.5, tz = P.pos.z - Math.cos(P.face) * 3 - Math.sin(P.face) * 2.5;
    const dx = tx - SA.pos.x, dz = tz - SA.pos.z, d = Math.hypot(dx, dz);
    let sp = 0;
    if (d > 1.2) { sp = Math.min(13, d * 3); SA.pos.x += dx / d * sp * dt; SA.pos.z += dz / d * sp * dt; }
    pushOut(SA.pos, 0.6);
    if (d > 35) SA.pos.set(P.pos.x - Math.sin(P.face) * 3, 0, P.pos.z - Math.cos(P.face) * 3);
    SA.cd -= dt;
    const t = SA.lock;
    if (t) SA.face = Math.atan2(t.pos.x - SA.pos.x, t.pos.z - SA.pos.z);
    else if (sp > 0.5) SA.face = Math.atan2(dx, dz);
    if (t && SA.cd <= 0 && !S.over) {
      SA.cd = 2.4;
      fireRocket(V(SA.pos.x + Math.sin(SA.face) * 1.2, 2.0, SA.pos.z + Math.cos(SA.face) * 1.2), t.pos.x, t.pos.z, t);
    }
    sallyM.root.position.set(SA.pos.x, 0, SA.pos.z);
    sallyM.root.rotation.y = SA.face;
    animWalk(sallyM, sp, dt);
  }

  // ---- AI
  function nav(e, tx, tz, dt, speed) {
    e.losT -= dt;
    if (e.losT <= 0) {
      e.losT = 0.4;
      e.direct = clearLine(e.pos.x, e.pos.z, tx, tz);
      if (!e.direct) {
        const ix = nodeIndex(e.pos.x), iz = nodeIndex(e.pos.z);
        const nx = roadC(ix), nz = roadC(iz);
        if (Math.hypot(nx - e.pos.x, nz - e.pos.z) > 4 && (Math.abs(nx - e.pos.x) < 9 || Math.abs(nz - e.pos.z) < 9)) e.wp = { x: nx, z: nz };
        else {
          const tix = nodeIndex(tx), tiz = nodeIndex(tz);
          const ddx = tix - ix, ddz = tiz - iz;
          let sx = ix, sz = iz;
          if (Math.abs(ddx) >= Math.abs(ddz) && ddx) sx += Math.sign(ddx); else if (ddz) sz += Math.sign(ddz); else if (ddx) sx += Math.sign(ddx);
          if (sx === ix && sz === iz) e.direct = true; // same intersection: just slide along the walls toward it
          else e.wp = { x: roadC(sx), z: roadC(sz) };
        }
      }
    }
    const gx = e.direct ? tx : e.wp ? e.wp.x : tx, gz = e.direct ? tz : e.wp ? e.wp.z : tz;
    const dx = gx - e.pos.x, dz = gz - e.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.5) {
      e.pos.x += dx / d * speed * dt; e.pos.z += dz / d * speed * dt;
      e.moveFace = Math.atan2(dx, dz);
    }
    if (d < 2 && !e.direct) e.losT = 0;
    return d;
  }

  function wanderTarget(e) {
    e.wanderT = (e.wanderT || 0) - 1 / 30;
    if (!e.wander || e.wanderT <= 0 || Math.hypot(e.wander.x - e.pos.x, e.wander.z - e.pos.z) < 4) {
      e.wanderT = rand(5, 9);
      const ix = nodeIndex(e.pos.x) + pick([-1, 0, 1]), iz = nodeIndex(e.pos.z) + pick([-1, 0, 1]);
      e.wander = { x: roadC(clamp(ix, 0, C.N)) + rand(-8, 8), z: roadC(clamp(iz, 0, C.N)) + rand(-8, 8) };
      if (S.area && Math.random() < 0.5) { const p = roadPoint(S.area); e.wander = p; }
    }
    return e.wander;
  }

  function updateEnemies(dt) {
    const f = focus();
    for (const e of S.enemies.slice()) {
      if (e.dead) continue;
      e.cd -= dt; e.paintCd -= dt; e.hitCd -= dt; e.flash -= dt;
      let dxp = f.x - e.pos.x, dzp = f.z - e.pos.z, dp = Math.hypot(dxp, dzp);
      e.last.copy(e.pos);
      if (e.emerge > 0) {
        e.emerge -= dt;
        const k = 1 - e.emerge / 0.7;
        e.pos.x += Math.cos(e.emergeDir) * 9 * dt; e.pos.z += Math.sin(e.emergeDir) * 9 * dt;
        e.model.root.position.set(e.pos.x, 6.5 * (1 - k) + Math.sin(k * Math.PI) * 2, e.pos.z);
        e.model.root.rotation.x = (1 - k) * 2;
        if (e.emerge <= 0) { e.model.root.rotation.x = 0; splat(e.pos.x, e.pos.z, 3, e.color, 0.9, 8); sfx.splat(0.5); }
        continue;
      }
      if (e.scatterT > 0) {
        // running for their lives, painting as they go
        e.scatterT -= dt;
        if (e.scatterT <= 0 && e.vanish) { S.enemies.splice(S.enemies.indexOf(e), 1); removeEnemy(e); continue; }
        e.pos.x += Math.cos(e.emergeDir) * 9 * dt; e.pos.z += Math.sin(e.emergeDir) * 9 * dt;
        if (pushOut(e.pos, e.r)) e.emergeDir += Math.PI / 2;
        e.face = Math.atan2(Math.cos(e.emergeDir), Math.sin(e.emergeDir));
        if (e.paintCd <= 0 && !e.vanish) { e.paintCd = 0.15; splat(e.pos.x, e.pos.z, 1.2, e.color, 0.8, 2); }
        e.model.root.position.set(e.pos.x, 0, e.pos.z); e.model.root.rotation.y = e.face;
        animWalk(e.model, 12, dt);
        continue;
      }
      if (e.guard) {
        const gp = e.guard;
        if (!S.portals.includes(gp)) { e.guard = null; e.scatterT = rand(1.5, 3); e.scattered = true; e.emergeDir = Math.random() * 6.28; }
        else {
          const pd = Math.hypot(f.x - gp.pos.x, f.z - gp.pos.z);
          const ld = Math.hypot(e.pos.x - gp.pos.x, e.pos.z - gp.pos.z);
          if (pd > 34 || ld > 22) {
            // walk the beat around the portal (or hurry back to it)
            e.patrolA += dt * 0.35;
            const tx = gp.pos.x + Math.cos(e.patrolA) * 11, tz = gp.pos.z + Math.sin(e.patrolA) * 11;
            const sp = ld > 22 ? e.speed : e.speed * 0.45;
            nav(e, tx, tz, dt, sp);
            e.face = e.moveFace ?? e.face;
            pushOut(e.pos, e.r);
            const m = e.model;
            m.root.position.set(e.pos.x, 0, e.pos.z); m.root.rotation.y = e.face;
            animWalk(m, sp, dt);
            if (e.type === 'goon') { m.root.rotation.order = 'XYZ'; m.armR.rotation.x = -1.45; }
            continue;
          }
        }
      }
      if (e.type === 'lowrider' || e.type === 'truck') { updateLowrider(e, dt, dp); continue; }
      if (e.type === 'roomba') { updateRoomba(e, dt, dp); continue; }
      if (e.type === 'copter') { updateCopter(e, dt, dp); continue; }
      if (e.type === 'copcar') { updateCopCar(e, dt, dp); continue; }
      let speed = 0;
      if (e.type === 'dauber') {
        if (dp < 16) { const tx = e.pos.x - dxp, tz = e.pos.z - dzp; nav(e, tx, tz, dt, e.speed * 1.2); speed = e.speed * 1.2; }
        else { const w = wanderTarget(e); nav(e, w.x, w.z, dt, e.speed); speed = e.speed; }
        if (e.paintCd <= 0) { e.paintCd = 0.18; splat(e.pos.x + rand(-1, 1), e.pos.z + rand(-1, 1), rand(1.2, 2.6), e.color, 0.8, 3); if (dp < 50 && Math.random() < 0.2) sfx.spray(clamp(1 - dp / 50, 0, 1)); }
        e.face = e.moveFace ?? e.face;
      } else if (e.type === 'hood' && e.scattered && dp > 30) {
        const w = wanderTarget(e); nav(e, w.x, w.z, dt, e.speed); speed = e.speed; e.face = e.moveFace ?? e.face;
        if (e.paintCd <= 0) { e.paintCd = 0.2; splat(e.pos.x, e.pos.z, 1.6, e.color, 0.8, 3); }
      } else if (e.type === 'hood') {
        if (!SA.down && !SA.inCar && dp < 30 && e.walk % 1 < 0.35) { const sx2 = SA.pos.x - e.pos.x, sz2 = SA.pos.z - e.pos.z, sd = Math.hypot(sx2, sz2); if (sd < dp) { dxp = sx2; dzp = sz2; dp = sd; } }
        if (dp > 22 || !clearLine(e.pos.x, e.pos.z, f.x, f.z)) { if (dp < 120) nav(e, f.x, f.z, dt, e.speed); else { const w = wanderTarget(e); nav(e, w.x, w.z, dt, e.speed); } speed = e.speed; e.face = e.moveFace ?? e.face; }
        else {
          // strafe and shoot
          const sx = -dzp / dp, sz = dxp / dp, dir = Math.sin(S.time * 0.7 + e.walk) > 0 ? 1 : -1;
          e.pos.x += sx * dir * 3 * dt; e.pos.z += sz * dir * 3 * dt;
          speed = 3;
          e.face = Math.atan2(dxp, dzp);
          if (e.cd <= 0) {
            e.cd = rand(1.0, 1.7);
            const a = e.face + rand(-0.08, 0.08);
            enemyShot(V(e.pos.x + Math.sin(a) * 1.2, 1.5, e.pos.z + Math.cos(a) * 1.2), Math.sin(a), Math.cos(a), e.color);
          }
        }
        if (e.paintCd <= 0) { e.paintCd = 0.3; splat(e.pos.x + rand(-0.6, 0.6), e.pos.z + rand(-0.6, 0.6), 1.5, e.color, 0.75, 3); }
      } else if (e.type === 'cultist') {
        // keeps its distance, chants, heals the faithful, paints the eye
        if (dp > 28) { nav(e, f.x, f.z, dt, e.speed); speed = e.speed; e.face = e.moveFace ?? e.face; }
        else {
          const away = dp < 16 ? -1 : 0, sx = -dzp / dp, sz = dxp / dp, dir = Math.sin(S.time * 0.4 + e.walk) > 0 ? 1 : -1;
          e.pos.x += (sx * dir * 2.5 + dxp / dp * away * 4) * dt; e.pos.z += (sz * dir * 2.5 + dzp / dp * away * 4) * dt;
          speed = 3; e.face = Math.atan2(dxp, dzp);
          if (e.cd <= 0) { e.cd = rand(2, 2.8); for (const k of [-0.25, 0, 0.25]) { const a = e.face + k; enemyShot(V(e.pos.x + Math.sin(a), 1.8, e.pos.z + Math.cos(a)), Math.sin(a), Math.cos(a), pick(GANG_COLORS), 20, 9); } }
        }
        e.healT = (e.healT || 0) - dt;
        if (e.healT <= 0) {
          e.healT = 1;
          for (const o of S.enemies) if (o !== e && o.type !== 'boss' && o.hp < o.maxHp && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 12) { o.hp = Math.min(o.maxHp, o.hp + 6); parts.spawn(o.pos.x, 2.5, o.pos.z, 0, 2, 0, { life: 0.6, size: 0.6, color: [1, 1, 1] }); }
        }
        if (e.paintCd <= 0) { e.paintCd = 8; for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; splat(e.pos.x + Math.cos(a) * 4, e.pos.z + Math.sin(a) * 4, 0.6, e.color, 0.8, 1); } splat(e.pos.x, e.pos.z, 1.4, '#ffffff', 0.9, 0); }
        e.model.eye.rotation.z += dt * 2;
      } else if (e.type === 'cop') {
        // a cop from the Holy Glaze: slow, round, and finally doing his job
        if (dp > 18) { nav(e, f.x, f.z, dt, e.speed); speed = e.speed; e.face = e.moveFace ?? e.face; }
        else { e.face = Math.atan2(dxp, dzp); if (e.cd <= 0) { e.cd = rand(1.2, 1.8); const a = e.face + rand(-0.08, 0.08); enemyShot(V(e.pos.x + Math.sin(a), 1.8, e.pos.z + Math.cos(a)), Math.sin(a), Math.cos(a), '#bbbbbb', 40, 6, 'bullet'); sfx.pistol(0, 0.6); } }
        if (Math.random() < dt * 0.05) say('COP', pick(['Freeze, Malone!', 'Halt! In the name of the... the... donut!', 'Stop or I\'ll... huff... stop!', 'You have the right to remain grey!']), 2);
        e.model.arm.rotation.x = -1.6;
      } else if (e.type === 'demon') {
        // winged demon: circles overhead, then swoops
        e.ang = (e.ang ?? Math.random() * 6.28) + dt * 0.9;
        const swoop = e.swoop > 0;
        const tx = swoop ? e.sx : f.x + Math.cos(e.ang) * 14, tz = swoop ? e.sz : f.z + Math.sin(e.ang) * 14;
        const ddx = tx - e.pos.x, ddz = tz - e.pos.z, dd = Math.hypot(ddx, ddz) || 1;
        const sp = swoop ? 30 : e.speed;
        e.pos.x += ddx / dd * Math.min(sp * dt, dd); e.pos.z += ddz / dd * Math.min(sp * dt, dd);
        e.face = Math.atan2(ddx, ddz);
        e.alt = swoop ? Math.max(1.4, (e.alt ?? 7) - dt * 18) : Math.min(7.5, (e.alt ?? 7) + dt * 6);
        if (!swoop && e.cd <= 0 && dp < 40) { e.cd = rand(2.5, 3.5); e.swoop = 0.9; e.sx = f.x; e.sz = f.z; sfx.spray(0.8); }
        if (swoop) { e.swoop -= dt; if (Math.hypot(f.x - e.pos.x, f.z - e.pos.z) < (P.inCar ? 3 : 1.8) && e.hitCd <= 0) { e.hitCd = 1; damagePlayer(14); splat(f.x, f.z, 2.5, e.color, 0.9, 5); } }
        if (e.paintCd <= 0) { e.paintCd = 0.15; e.hue = ((e.hue || 0) + 1) % 6; splat(e.pos.x, e.pos.z, 1.1, GANG_COLORS[e.hue], 0.7, 2); }
        speed = 0;
        e.flying = true;
      } else if (e.type === 'beast') {
        // giant Technicolor beast: lumbers after Mack and stomps
        nav(e, f.x, f.z, dt, e.speed); speed = e.speed * 0.6; e.face = e.moveFace ?? e.face;
        if (e.paintCd <= 0) { e.paintCd = 0.5; e.hue = ((e.hue || 0) + 1) % 6; splat(e.pos.x + rand(-2, 2), e.pos.z + rand(-2, 2), 2.6, GANG_COLORS[e.hue], 0.85, 4); }
        if (dp < 10 && e.cd <= 0) {
          e.cd = 2.6; fx.shake = 0.8; sfx.boom(0.9);
          splat(e.pos.x, e.pos.z, 9, pick(GANG_COLORS), 0.9, 12);
          damagePlayer(P.inCar ? 22 : 18);
          if (!SA.down && Math.hypot(SA.pos.x - e.pos.x, SA.pos.z - e.pos.z) < 10) damageSally(12);
          for (let k = 0; k < 30; k++) { const a = k / 30 * 6.28; parts.spawn(e.pos.x + Math.cos(a) * 2, 0.4, e.pos.z + Math.sin(a) * 2, Math.cos(a) * 18, 2, Math.sin(a) * 18, { life: 0.5, size: 0.9, color: [0.9, 0.9, 0.9], kind: 1 }); }
        }
        if (Math.random() < dt * 0.15) say('NARR', pick(['*a roar in seven colors*', '*the beast bellows a show tune*', '*BWAAAAAAMP*']), 1.8);
      } else if (e.type === 'imp') {
        // fast, low, lunges for Mack (or Sally)
        let tx = f.x, tz = f.z;
        if (!SA.down && !SA.inCar && Math.hypot(SA.pos.x - e.pos.x, SA.pos.z - e.pos.z) < dp) { tx = SA.pos.x; tz = SA.pos.z; }
        const td = Math.hypot(tx - e.pos.x, tz - e.pos.z);
        if (e.lunge > 0) {
          e.lunge -= dt;
          e.pos.x += e.lx * 26 * dt; e.pos.z += e.lz * 26 * dt;
          if (td < 1.6 && e.hitCd <= 0) { e.hitCd = 0.8; if (tx === f.x && tz === f.z) damagePlayer(P.inCar ? 8 : 10); else damageSally(10); splat(tx, tz, 1.6, e.color, 0.8, 4); }
          speed = 14;
        } else {
          nav(e, tx, tz, dt, e.speed); speed = e.speed; e.face = e.moveFace ?? e.face;
          if (td < 10 && e.cd <= 0) { e.cd = rand(1.2, 1.8); e.lunge = 0.35; e.lx = (tx - e.pos.x) / td; e.lz = (tz - e.pos.z) / td; e.face = Math.atan2(e.lx, e.lz); }
        }
        if (e.paintCd <= 0) { e.paintCd = 0.2; e.hue = ((e.hue || 0) + 1) % 6; splat(e.pos.x, e.pos.z, 0.9, GANG_COLORS[e.hue], 0.75, 2); }
      } else if (e.type === 'goon') {
        // rainbow trenchcoat, three-round burst, leaves a rainbow behind him
        if (dp > 24 || !clearLine(e.pos.x, e.pos.z, f.x, f.z)) { if (dp < 140) nav(e, f.x, f.z, dt, e.speed); else { const w = wanderTarget(e); nav(e, w.x, w.z, dt, e.speed); } speed = e.speed; e.face = e.moveFace ?? e.face; }
        else {
          const sx = -dzp / dp, sz = dxp / dp, dir = Math.sin(S.time * 0.5 + e.walk) > 0 ? 1 : -1;
          e.pos.x += sx * dir * 4 * dt; e.pos.z += sz * dir * 4 * dt; speed = 4;
          e.face = Math.atan2(dxp, dzp);
          if (e.cd <= 0) {
            e.cd = rand(1.3, 1.9); e.burst = 3;
          }
        }
        if (e.burst > 0 && e.cd < 1.3 - (3 - e.burst) * 0.12) {
          e.burst--;
          const a = e.face + rand(-0.06, 0.06);
          enemyShot(V(e.pos.x + Math.sin(a) * 1.4, 1.6, e.pos.z + Math.cos(a) * 1.4), Math.sin(a), Math.cos(a), GANG_COLORS[e.burst % 6], 38, 7);
        }
        if (e.paintCd <= 0) { e.paintCd = 0.25; e.hue = (e.hue + 1) % 6; splat(e.pos.x, e.pos.z, 1.3, GANG_COLORS[e.hue], 0.7, 2); }
      } else if (e.type === 'roller') {
        if (dp < 45) { nav(e, f.x, f.z, dt, e.speed * (dp < 12 ? 1.6 : 1)); speed = e.speed; }
        else { const w = wanderTarget(e); nav(e, w.x, w.z, dt, e.speed); speed = e.speed; }
        e.face = e.moveFace ?? e.face;
        if (e.paintCd <= 0) { e.paintCd = 0.1; stroke(e.lastPaint?.x ?? e.pos.x, e.lastPaint?.z ?? e.pos.z, e.pos.x, e.pos.z, 4.2, e.color, 0.85); e.lastPaint = { x: e.pos.x, z: e.pos.z }; }
        if (dp < 3.2 + (P.inCar ? 1.5 : 0) && e.cd <= 0) { e.cd = 1.3; damagePlayer(P.inCar ? 30 : 20); sfx.splat(1); splat(f.x, f.z, 3, e.color, 0.8); }
      } else if (e.type === 'boss') { speed = updateBoss(e, dt, dp, dxp, dzp, f); }
      pushOut(e.pos, e.r);
      // foot goons drip paint everywhere they go: a thin snail trail behind every one
      if (TRAIL_TYPES.has(e.type)) {
        if (!e.trail) e.trail = { x: e.pos.x, z: e.pos.z };
        const td = Math.hypot(e.pos.x - e.trail.x, e.pos.z - e.trail.z);
        if (td > 6) e.trail = { x: e.pos.x, z: e.pos.z }; // shoved or teleported: don't streak across town
        else if (td > 0.9) { stroke(e.trail.x, e.trail.z, e.pos.x, e.pos.z, 0.9, e.color, 0.55); e.trail = { x: e.pos.x, z: e.pos.z }; }
      }
      // separation
      for (const o of S.enemies) {
        if (o === e || o.type === 'lowrider') continue;
        const sx = e.pos.x - o.pos.x, sz = e.pos.z - o.pos.z, sd = Math.hypot(sx, sz), rr = e.r + o.r;
        if (sd > 0.01 && sd < rr) { e.pos.x += sx / sd * (rr - sd) * 0.5; e.pos.z += sz / sd * (rr - sd) * 0.5; }
      }
      // step on foot Mack
      const m = e.model;
      m.root.position.set(e.pos.x, 0, e.pos.z);
      m.root.rotation.y = e.face;
      animWalk(m, speed, dt);
      m.root.scale.setScalar((e.type === 'boss' ? e.def.scale : TYPES[e.type].scale) * (e.flash > 0 ? 1.08 : 1));
      if (e.type === 'goon') { m.root.rotation.order = 'XYZ'; m.armR.rotation.x = -1.45; m.gun.rotation.x = 0; }
      if (e.type === 'imp') m.root.position.y = Math.abs(Math.sin(S.time * 9 + e.walk)) * (e.lunge > 0 ? 1.2 : 0.5);
      if (e.type === 'demon') m.root.position.y = e.alt + Math.sin(S.time * 3 + e.walk) * 0.4;
      if (m.wings) m.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.2 + Math.sin(S.time * (e.type === 'demon' ? 14 : 22) + e.walk) * 0.7); });
      if (m.halo) m.halo.rotation.z += dt * 2;
      if (m.dottie) { m.brush.rotation.y += dt * 14; m.dottie.head.rotation.z = Math.sin(S.time * 3) * 0.3; m.dottie.armL.rotation.z = 2.5 + Math.sin(S.time * 5) * 0.4; }
      if (m.prism) { m.prism.rotation.y += dt * 2; m.prism.rotation.x = Math.sin(S.time) * 0.3; }
    }
  }

  function updateBoss(e, dt, dp, dxp, dzp, f) {
    const def = e.def;
    const leash = Math.hypot(e.pos.x - e.anchor.x, e.pos.z - e.anchor.z);
    let speed = 0;
    if (e.speed <= 0.1) { speed = 0; }
    else if (dp > 14 && leash < 70) { nav(e, f.x, f.z, dt, e.speed); speed = e.speed; }
    else if (leash >= 70) { nav(e, e.anchor.x, e.anchor.z, dt, e.speed); speed = e.speed; }
    else { const a = S.time * 0.6; e.pos.x += Math.cos(a) * 3 * dt; e.pos.z += Math.sin(a) * 3 * dt; speed = 3; }
    e.face = Math.atan2(dxp, dzp);
    if (e.paintCd <= 0) { e.paintCd = 0.12; stroke(e.lastPaint?.x ?? e.pos.x, e.lastPaint?.z ?? e.pos.z, e.pos.x, e.pos.z, Math.min(4.5, 2 + def.scale), e.color, 0.6); e.lastPaint = { x: e.pos.x, z: e.pos.z }; }
    const enraged = e.hp < e.maxHp * 0.4;
    const mz = V(e.pos.x + Math.sin(e.face) * 1.5 * def.scale, 1.2 * def.scale, e.pos.z + Math.cos(e.face) * 1.5 * def.scale);
    if (dp < 75 && e.cd <= 0) {
      if (def.attack === 'shotgun') {
        e.cd = enraged ? 1.1 : 1.6;
        for (let k = -3; k <= 3; k++) { const a = e.face + k * 0.09; enemyShot(mz, Math.sin(a), Math.cos(a), e.color, 32, 7); }
      } else if (def.attack === 'drum') {
        e.burst = 14; e.cd = enraged ? 2.2 : 3.2;
      } else if (def.attack === 'donuts') {
        e.cd = enraged ? 0.9 : 1.4;
        const k = dp / 26;
        enemyShot(mz, dxp / dp * k, dzp / dp * k, '#ff7ac8', 18, 18, 'donut');
      } else if (def.attack === 'bombs') {
        e.cd = enraged ? 1.0 : 1.5;
        for (let k = 0; k < (enraged ? 3 : 2); k++) {
          const tx = f.x + rand(-6, 6), tz = f.z + rand(-6, 6);
          const ddx = tx - mz.x, ddz = tz - mz.z, dd = Math.hypot(ddx, ddz);
          enemyShot(mz, ddx / dd * dd / 30, ddz / dd * dd / 30, pick(GANG_COLORS), 18, 16, 'bomb');
        }
      } else if (def.attack === 'cult') {
        // teleports in a puff of color, rings of prism orbs
        e.cd = enraged ? 1.6 : 2.3;
        const n = enraged ? 16 : 12;
        for (let k = 0; k < n; k++) { const a = k / n * 6.28 + S.time; enemyShot(V(e.pos.x, 2.2 * def.scale * 0.5, e.pos.z), Math.sin(a), Math.cos(a), GANG_COLORS[k % 6], 18, 8); }
        e.tpT = (e.tpT || 0) - 1;
        if (e.tpT <= 0) {
          e.tpT = 3;
          for (let k = 0; k < 30; k++) parts.spawn(e.pos.x, 2, e.pos.z, rand(-6, 6), rand(0, 6), rand(-6, 6), { life: 0.6, size: 0.8, color: hexToRgb(pick(GANG_COLORS)) });
          const a = Math.random() * 6.28, r = rand(14, 20);
          const p = { x: f.x + Math.cos(a) * r, z: f.z + Math.sin(a) * r }; pushOut(p, e.r);
          e.pos.x = p.x; e.pos.z = p.z; e.anchor.set(p.x, 0, p.z);
          sfx.portal();
        }
        if (Math.random() < 0.35) say('NARR', pick(def.taunts || ['"Behold the Seventh Color!"']), 2.4);
      } else if (def.attack === 'mother') {
        e.cd = enraged ? 1.3 : 1.9;
        const n = 18;
        for (let k = 0; k < n; k++) { const a = k / n * 6.28 + S.time * 0.5; enemyShot(V(e.pos.x, 2, e.pos.z), Math.sin(a), Math.cos(a), GANG_COLORS[k % 6], 22, 8); }
        if (Math.random() < 0.4) say('DOTTIE', pick(['*hic* JOIN USSS, boss! The rainbow is so WARM!', 'Beep boop! Hallelujah! *hic*', 'Malone Investigations has been REPAINTED! Please hold for ENLIGHTENMENT.', 'I see seven colors, boss! SEVEN! *hic* I only had three drinks!']), 2.6);
      } else if (def.attack === 'hell') {
        e.mode = ((e.mode || 0) + 1) % 3;
        if (e.mode === 0) { e.cd = enraged ? 3 : 4; e.beamT = 3; e.beamA = e.face - 1.3; }
        else if (e.mode === 1) {
          e.cd = enraged ? 1.4 : 2;
          for (let k = 0; k < (enraged ? 6 : 4); k++) { const tx = f.x + rand(-9, 9), tz = f.z + rand(-9, 9); const ddx = tx - mz.x, ddz = tz - mz.z, dd = Math.hypot(ddx, ddz); enemyShot(V(mz.x, 10, mz.z), ddx / dd * dd / 30, ddz / dd * dd / 30, pick(GANG_COLORS), 18, 15, 'bomb'); }
        } else { e.cd = 1.6; for (let k = 0; k < 20; k++) { const a = k / 20 * 6.28; enemyShot(V(e.pos.x, 3, e.pos.z), Math.sin(a), Math.cos(a), GANG_COLORS[k % 6], 24, 9); } }
        if (Math.random() < 0.3) say('NARR', pick(def.taunts), 2.6);
      } else if (def.attack === 'mech') {
        // the Re-Election Machine: sweeping paint cannons, money bombs and a stomp
        e.mode = ((e.mode || 0) + 1) % 3;
        if (e.mode === 0) { e.sweep = 1.8; e.sweepA = e.face - 0.9; e.cd = 2.6; }
        else if (e.mode === 1) {
          e.cd = enraged ? 1.2 : 1.8;
          for (let k = 0; k < (enraged ? 4 : 3); k++) {
            const tx = f.x + rand(-7, 7), tz = f.z + rand(-7, 7);
            const ddx = tx - mz.x, ddz = tz - mz.z, dd = Math.hypot(ddx, ddz);
            enemyShot(V(mz.x, 7, mz.z), ddx / dd * dd / 30, ddz / dd * dd / 30, pick(['#ffd35a', '#62ff2e']), 18, 15, 'bomb');
          }
          if (Math.random() < 0.5) say('NARR', pick(['"VOTE! FOR! KRAAANE!" (over a loudspeaker)', '"This machine was paid for by the people of Rain City! Thank you, people!"', '"I\'m not a crook, Malone. I\'m a MECH!"', '"Re-elect me or I\'ll step on you!"']), 2.4);
        } else {
          e.cd = 1.4;
          if (dp < 16) { fx.shake = 0.9; sfx.boom(1); splat(e.pos.x, e.pos.z, 14, pick(GANG_COLORS), 0.9, 14); damagePlayer(P.inCar ? 25 : 18); if (Math.hypot(SA.pos.x - e.pos.x, SA.pos.z - e.pos.z) < 16) damageSally(14); for (let k = 0; k < 40; k++) { const a = k / 40 * 6.28; parts.spawn(e.pos.x + Math.cos(a) * 3, 0.5, e.pos.z + Math.sin(a) * 3, Math.cos(a) * 20, 2, Math.sin(a) * 20, { life: 0.5, size: 0.8, color: [0.9, 0.9, 0.9], kind: 1 }); } }
        }
      } else if (def.attack === 'money') {
        // hurls bags of painted money and sprays gold
        e.cd = enraged ? 1.0 : 1.5;
        for (let k = 0; k < (enraged ? 3 : 2); k++) {
          const tx = f.x + rand(-5, 5), tz = f.z + rand(-5, 5);
          const ddx = tx - mz.x, ddz = tz - mz.z, dd = Math.hypot(ddx, ddz);
          enemyShot(mz, ddx / dd * dd / 30, ddz / dd * dd / 30, pick(['#ffd35a', '#62ff2e']), 18, 15, 'bomb');
        }
        for (let k = -2; k <= 2; k++) { const a = e.face + k * 0.12; enemyShot(mz, Math.sin(a), Math.cos(a), '#ffd35a', 30, 6); }
        if (Math.random() < 0.3) say('NARR', pick(['"A vote for Krane is a vote for COLOR!"', '"Four more years, Malone! FOUR MORE YEARS!"', '"I\'ll have you rezoned!"', '"Do you know how much this sash COST?"']), 2.2);
      } else if (def.attack === 'beam') {
        e.cd = enraged ? 3.5 : 5;
        e.beamT = 2.6; e.beamA = e.face - 1.2;
        for (let k = 0; k < 10; k++) { const a = e.face + (k - 4.5) * 0.12; enemyShot(mz, Math.sin(a), Math.cos(a), pick(GANG_COLORS), 28, 7); }
      }
    }
    if (e.sweep > 0) {
      e.sweep -= dt;
      e.sweepA += dt * 1.0;
      e.sweepCd = (e.sweepCd || 0) - dt;
      if (e.sweepCd <= 0) {
        e.sweepCd = 0.09;
        e.hue = ((e.hue || 0) + 1) % 6;
        for (const side of [e.hue % 2 ? -1 : 1]) {
          const ox = e.pos.x + Math.cos(e.face) * side * 3.5, oz = e.pos.z - Math.sin(e.face) * side * 3.5;
          enemyShot(V(ox, 5, oz), Math.sin(e.sweepA), Math.cos(e.sweepA), GANG_COLORS[e.hue], 30, 5);
        }
      }
    }
    if (e.burst > 0 && e.cd < (enraged ? 2.2 : 3.2) - 0.08 * (14 - e.burst)) {
      e.burst--;
      const a = e.face + rand(-0.15, 0.15);
      enemyShot(mz, Math.sin(a), Math.cos(a), e.color, 36, 6);
    }
    if (e.beamT > 0) {
      e.beamT -= dt;
      e.beamA += dt * 0.95;
      const len = 46;
      const bx = Math.sin(e.beamA), bz = Math.cos(e.beamA);
      const wd = rayDist(e.pos.x, e.pos.z, bx, bz, len);
      beam.visible = true;
      beam.position.set(e.pos.x + bx * wd / 2, 3.2, e.pos.z + bz * wd / 2);
      beam.scale.set(1, wd, 1);
      beam.rotation.set(Math.PI / 2, 0, -e.beamA, 'YXZ');
      beam.rotation.set(0, 0, 0);
      beam.quaternion.setFromUnitVectors(V(0, 1, 0), V(bx, 0, bz));
      beamMat.uniforms.t.value = S.time;
      stroke(e.pos.x, e.pos.z, e.pos.x + bx * wd, e.pos.z + bz * wd, 2.5, pick(GANG_COLORS), 0.25);
      // on the beam?
      const px = f.x - e.pos.x, pz = f.z - e.pos.z, t = px * bx + pz * bz;
      if (t > 0 && t < wd && Math.abs(px * bz - pz * bx) < (P.inCar ? 2.5 : 1.4) && e.hitCd <= 0) { e.hitCd = 0.35; damagePlayer(9); }
      if (e.beamT <= 0) beam.visible = false;
    }
    e.summonCd -= dt;
    if (e.summonCd <= 0 && dp < 120) {
      e.summonCd = enraged ? 9 : 13;
      if (def.summon === 'portal') { if (S.portals.length < 3) openPortal(); }
      else for (let k = 0; k < 2; k++) { const a = Math.random() * 6; addEnemy(def.summon, e.pos.x + Math.cos(a) * 8, e.pos.z + Math.sin(a) * 8); }
    }
    if ((def.attack === 'beam' || def.attack === 'hell') && e.phase === 0 && e.hp < e.maxHp * 0.66) { e.phase = 1; openPortal(); say('SALLY', 'He\'s opening MORE holes! Rude!', 2.5); }
    if ((def.attack === 'beam' || def.attack === 'hell') && e.phase === 1 && e.hp < e.maxHp * 0.33) { e.phase = 2; openPortal(); }
    return speed;
  }

  // Paint copters: cruise the district at rooftop height, dump buckets of color, and love to hover over Mack
  function updateCopter(e, dt, dp) {
    const f = focus();
    e.turnT -= dt;
    if (!e.goal || e.turnT <= 0 || Math.hypot(e.goal.x - e.pos.x, e.goal.z - e.pos.z) < 8) {
      e.turnT = rand(6, 11);
      if (dp < 110 && Math.random() < 0.6) { const a = Math.random() * 6.28; e.goal = { x: f.x + Math.cos(a) * 14, z: f.z + Math.sin(a) * 14 }; }
      else e.goal = roadPoint(S.area);
    }
    const dx = e.goal.x - e.pos.x, dz = e.goal.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
    const sp = Math.min(e.speed, d * 0.8);
    e.vx = (e.vx || 0) + (dx / d * sp - (e.vx || 0)) * Math.min(1, dt * 1.5);
    e.vz = (e.vz || 0) + (dz / d * sp - (e.vz || 0)) * Math.min(1, dt * 1.5);
    e.pos.x += e.vx * dt; e.pos.z += e.vz * dt;
    e.pos.x = clamp(e.pos.x, -C.edge, C.edge); e.pos.z = clamp(e.pos.z, -C.edge, C.edge);
    e.face += wrapAngle(Math.atan2(e.vx, e.vz) - e.face) * Math.min(1, dt * 2);
    const alt = 24 + Math.sin(S.time * 0.8 + e.walk) * 1.5;
    // dump the bucket
    if (e.paintCd <= 0) {
      e.paintCd = dp < 30 ? 0.55 : 0.9;
      e.hue = (e.hue + 1) % 6;
      const b = V(e.pos.x, alt - 4, e.pos.z);
      enemyShot(b, e.vx / 18, e.vz / 18, GANG_COLORS[e.hue], 18, 12, 'bomb');
      S.shots[S.shots.length - 1].vy = -2; S.shots[S.shots.length - 1].life = 3.2;
    }
    const m = e.model;
    m.root.position.set(e.pos.x, alt, e.pos.z);
    m.root.rotation.set(0, e.face, 0);
    m.body.rotation.x = clamp(Math.hypot(e.vx, e.vz) / 60, 0, 0.3);
    m.rotor.rotation.y += dt * 30;
    m.tail.rotation.x += dt * 40;
    m.beam.rotation.z = Math.sin(S.time * 0.9 + e.walk) * 0.35;
    m.root.scale.setScalar(e.flash > 0 ? 1.05 : 1);
    if (dp < 90 && Math.random() < dt * 0.4) sfx.spray(0.4);
  }

  // Paintbots wander like real robot vacuums: straight lines, bounce off walls, turn at random
  function updateRoomba(e, dt, dp) {
    e.turnT -= dt;
    const sp = e.speed * (e.flash > 0 ? 0.6 : 1);
    e.pos.x += Math.sin(e.face) * sp * dt; e.pos.z += Math.cos(e.face) * sp * dt;
    const hit = pushOut(e.pos, e.r);
    const edge = Math.abs(e.pos.x) > C.edge - 6 || Math.abs(e.pos.z) > C.edge - 6;
    if (hit || edge || e.turnT <= 0) {
      e.face += (hit || edge ? Math.PI : 0) + rand(-1.4, 1.4);
      e.turnT = rand(3, 8);
      if (S.area && Math.random() < 0.5) { const c = { x: (S.area.x0 + S.area.x1) / 2, z: (S.area.z0 + S.area.z1) / 2 }; if (Math.hypot(c.x - e.pos.x, c.z - e.pos.z) > 160) e.face = Math.atan2(c.x - e.pos.x, c.z - e.pos.z); }
    }
    e.hueT -= dt;
    if (e.hueT <= 0) { e.hueT = 0.6; e.hue = (e.hue + 1) % 6; }
    if (e.paintCd <= 0) {
      e.paintCd = 0.06;
      const bx = e.pos.x - Math.sin(e.face) * 2.6, bz = e.pos.z - Math.cos(e.face) * 2.6;
      stroke(e.lastPaint?.x ?? bx, e.lastPaint?.z ?? bz, bx, bz, 5, GANG_COLORS[e.hue], 0.85);
      e.lastPaint = { x: bx, z: bz };
      if (Math.random() < 0.3) splat(e.pos.x + rand(-5, 5), e.pos.z + rand(-5, 5), rand(0.8, 1.8), GANG_COLORS[e.hue], 0.8, 3);
      if (dp < 60 && Math.random() < 0.08) sfx.spray(clamp(1 - dp / 60, 0, 1));
    }
    const f = focus();
    if (dp < (P.inCar ? 6.2 : 4.3) && e.hitCd <= 0) {
      e.hitCd = 1;
      sfx.crash(1); fx.shake = 0.4;
      if (P.inCar) {
        const rel = Math.hypot(CAR.vx, CAR.vz);
        hitEnemy(e, rel * 2.5);
        const nx = (f.x - e.pos.x) / dp, nz = (f.z - e.pos.z) / dp;
        smashCar(rel, (e.pos.x + CAR.pos.x) / 2, (e.pos.z + CAR.pos.z) / 2, -nx, -nz);
        CAR.vx = nx * 14; CAR.vz = nz * 14;
        CAR.hp -= 12;
      } else { damagePlayer(12); P.pos.x += (f.x - e.pos.x) / dp * 3; P.pos.z += (f.z - e.pos.z) / dp * 3; }
      e.face += Math.PI + rand(-0.6, 0.6);
    }
    e.model.root.position.set(e.pos.x, 0, e.pos.z);
    e.model.root.rotation.y = e.face;
    e.model.brush.rotation.y += dt * 14;
    e.model.eye.rotation.z += dt * 3;
    e.model.body.position.y = Math.sin(S.time * 9 + e.walk) * 0.05;
    e.model.root.scale.setScalar(e.flash > 0 ? 1.04 : 1);
    if (Math.random() < dt * 30) { const a = Math.random() * 6; parts.spawn(e.pos.x + Math.cos(a) * 3.3, 0.4, e.pos.z + Math.sin(a) * 3.3, Math.cos(a) * 4, rand(1, 3), Math.sin(a) * 4, { life: 0.5, size: 0.4, color: hexToRgb(GANG_COLORS[e.hue]), grav: 14 }); }
  }

  function updateLowrider(e, dt, dp) {
    // drive the grid on the right-hand lane
    if (!e.target) {
      const [ix, iz] = e.node;
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => {
        const nx = ix + a, nz = iz + b;
        if (nx < 0 || nz < 0 || nx > C.N || nz > C.N) return false;
        if (e.prevNode && e.prevNode[0] === nx && e.prevNode[1] === nz) return false;
        return true;
      });
      // when Mack is near, take the turn that closes the distance
      const f0 = focus();
      const near = Math.hypot(f0.x - e.pos.x, f0.z - e.pos.z) < (e.type === 'truck' ? 140 : 90);
      const [a, b] = near && Math.random() < 0.75 ? opts.slice().sort((p, q) => Math.hypot(roadC(ix + p[0]) - f0.x, roadC(iz + p[1]) - f0.z) - Math.hypot(roadC(ix + q[0]) - f0.x, roadC(iz + q[1]) - f0.z))[0] : pick(opts);
      e.prevNode = e.node;
      e.node = [ix + a, iz + b];
      e.dir = [a, b];
      e.target = { x: roadC(ix + a) + (-b) * 6, z: roadC(iz + b) + a * 6 };
    }
    const dx = e.target.x - e.pos.x, dz = e.target.z - e.pos.z, d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    e.face += wrapAngle(want - e.face) * Math.min(1, dt * 5);
    const sp = e.speed * (Math.abs(wrapAngle(want - e.face)) > 0.6 ? 0.5 : 1);
    e.pos.x += Math.sin(e.face) * sp * dt; e.pos.z += Math.cos(e.face) * sp * dt;
    if (d < 4) e.target = null;
    if (e.paintCd <= 0) { e.paintCd = 0.08; stroke(e.lastPaint?.x ?? e.pos.x, e.lastPaint?.z ?? e.pos.z, e.pos.x, e.pos.z, 2.6, e.color, 0.8); e.lastPaint = { x: e.pos.x, z: e.pos.z }; }
    if (e.type === 'truck' && !e.unloaded) {
      // every so often a couple of painters hop off the back
      e.dropT = (e.dropT ?? rand(10, 18)) - dt;
      if (e.dropT <= 0 && S.enemies.length < 30) { e.dropT = rand(16, 24); for (let k = 0; k < 2; k++) { const g2 = addEnemy('dauber', e.pos.x - Math.sin(e.face) * 4, e.pos.z - Math.cos(e.face) * 4); g2.emerge = 0.5; g2.emergeDir = e.face + Math.PI + rand(-0.8, 0.8); g2.scattered = true; } }
      // goons in the back fire rockets
      if (dp < 60 && e.cd <= 0 && !e.unloaded) {
        const f2 = focus();
        if (clearLine(e.pos.x, e.pos.z, f2.x, f2.z)) {
          e.cd = rand(1.8, 2.6);
          const g = pick(e.model.car.goons);
          const wp = V(); g.root.getWorldPosition(wp); wp.y = 2.8;
          enemyRocket(wp, f2.x + rand(-2, 2), f2.z + rand(-2, 2), e.color);
        } else e.cd = 0.4;
      }
      for (const g of e.model.car.goons) if (g.root.visible) g.root.rotation.y = Math.atan2(focus().x - e.pos.x, focus().z - e.pos.z) - e.face;
    } else if (dp < 28 && e.cd <= 0) {
      e.cd = 0.55;
      const f = focus();
      const a = Math.atan2(f.x - e.pos.x, f.z - e.pos.z) + rand(-0.1, 0.1);
      enemyShot(V(e.pos.x + Math.sin(a) * 2, 1.5, e.pos.z + Math.cos(a) * 2), Math.sin(a), Math.cos(a), e.color, 36, 6);
    }
    // collisions with Mack / his car
    const f = focus();
    if (dp < (P.inCar ? 4.6 : 2.8) + (e.type === 'truck' ? 1.2 : 0) && e.hitCd <= 0) {
      e.hitCd = 1;
      sfx.crash(1);
      fx.shake = 0.5;
      if (P.inCar) {
        const rel = Math.hypot(CAR.vx - Math.sin(e.face) * sp, CAR.vz - Math.cos(e.face) * sp);
        hitEnemy(e, rel * 3.5);
        damagePlayer(rel * 0.8);
        smashCar(rel, (e.pos.x + CAR.pos.x) / 2, (e.pos.z + CAR.pos.z) / 2, (e.pos.x - CAR.pos.x) / dp, (e.pos.z - CAR.pos.z) / dp);
        spawnDebris(e.pos.x, 1, e.pos.z, -CAR.vx * 0.4, -CAR.vz * 0.4, Math.min(6, Math.floor(rel / 6)));
        const nx = (f.x - e.pos.x) / dp, nz = (f.z - e.pos.z) / dp;
        CAR.vx += nx * 12; CAR.vz += nz * 12;
      } else damagePlayer(30);
    }
    e.model.root.position.set(e.pos.x, 0, e.pos.z);
    e.model.root.rotation.y = e.face;
    // hydraulics bounce
    e.model.car.body.position.y = e.type === 'truck' ? Math.sin(S.time * 8 + e.walk) * 0.06 : Math.abs(Math.sin(S.time * 6 + e.walk)) * 0.35;
    e.model.car.wheels.forEach((w) => w.children.forEach((c) => (c.rotation.x += sp * dt / 0.42)));
  }

  function updatePortals(dt) {
    for (const p of S.portals.slice()) {
      p.open = Math.min(1, p.open + dt * 0.7);
      p.g.userData.uni.t.value = S.time;
      p.g.userData.uni.open.value = p.open;
      p.g.scale.setScalar((0.2 + p.open * 0.8) * (p.flash > 0 ? 1.06 : 1) * (p.cracked ? 0.85 + Math.sin(S.time * 30) * 0.04 - (p.seal || 0) * 0.15 : 1));
      p.flash -= dt;
      p.age = (p.age || 0) + dt;
      p.g.rotation.y = Math.sin(S.time * 0.3) * 0.2;
      p.paintCd -= dt;
      if (p.paintCd <= 0) {
        p.paintCd = 0.35;
        p.paintR = Math.min(26, p.paintR + 0.25);
        const a = Math.random() * Math.PI * 2, r = Math.random() * p.paintR;
        splat(p.pos.x + Math.cos(a) * r, p.pos.z + Math.sin(a) * r, rand(1.5, 4), pick(GANG_COLORS), 0.8, 6);
      }
      if (Math.random() < dt * 20) parts.spawn(p.pos.x + rand(-4, 4), 6.5 + rand(-4, 4), p.pos.z, rand(-2, 2), rand(-1, 3), rand(1, 4), { life: 1, size: 0.5, color: hexToRgb(pick(GANG_COLORS)) });
    }
  }

  function spawner(dt) {
    const st = S.stage;
    if (!st || S.over) return;
    if (st.goal.type === 'breather') {
      S.breathT -= dt;
      S.breathUi = (S.breathUi || 0) - dt;
      if (S.breathUi <= 0) { S.breathUi = 0.25; updateObjective(); }
      if (S.breathT <= 0) checkStage();
      return;
    }
    if (st.perPortal) {
      // each tear in the sky keeps spitting goons until it's sealed; they scatter and go paint the town
      for (const p of S.portals) {
        // the moment it opens: 5 goons, half a second apart. After that it only refills:
        // with fewer than 5 of its goons alive, one more every 5 seconds (20 on the streets, tops)
        if (p.burst === undefined) { p.burst = PORTAL_BURST; p.spawnCd = 0; }
        if (p.cracked) continue;
        const full = S.enemies.filter((e) => e.src === p && !e.dead).length >= PORTAL_MAX || S.enemies.filter((e) => !e.cop && e.type !== 'boss' && !e.dead).length >= MAX_GOONS;
        if (full) { if (p.burst <= 0) p.spawnCd = PORTAL_TRICKLE; continue; } // the refill clock starts when one of them dies
        p.spawnCd -= dt;
        if (p.spawnCd > 0) continue;
        p.spawnCd = p.burst > 1 ? 0.5 : PORTAL_TRICKLE;
        if (p.burst > 0) p.burst--;
        // the first few stay behind and guard the portal; the rest go paint the town
        const guards = S.enemies.filter((e) => e.guard === p).length;
        if (guards < (st.guards || 0)) {
          const g2 = addEnemy(st.guardType || 'hood', p.pos.x, p.pos.z);
          g2.src = p; g2.guard = p; g2.emerge = 0.7; g2.emergeDir = Math.random() * 6.28; g2.patrolA = Math.random() * 6.28;
          continue;
        }
        const type = weighted(st.mix);
        const e2 = addEnemy(type, p.pos.x, p.pos.z);
        e2.src = p; e2.emerge = 0.7; e2.emergeDir = Math.random() * 6.28; e2.scatterT = rand(1.5, 3); e2.scattered = true;
        if (Math.hypot(p.pos.x - focus().x, p.pos.z - focus().z) < 90) sfx.pop(0.6);
      }
      return;
    }
    // goons left far behind melt back into the rain so the fight stays where Mack is
    const f = focus();
    for (const e of S.enemies.slice()) {
      if (e.type === 'boss' || e.cop || (e.type === 'roomba' && st.roombas) || e.emerge > 0) continue;
      if (Math.abs(e.pos.x - f.x) + Math.abs(e.pos.z - f.z) > 340) { S.enemies.splice(S.enemies.indexOf(e), 1); removeEnemy(e); }
    }
    S.spawnT -= dt;
    const alive = S.enemies.filter((e) => e.type !== 'boss' && !e.cop).length;
    // ramp: the longer a stage runs, the faster they come
    const interval = st.interval * (S.portals.length ? 0.8 : 1);
    // waves: every so often the sky opens wider and a crowd of goons pours out
    if (!st.roam && st.max > 0 && st.goal.type !== 'goto' && !st.portals) {
      S.waveT = (S.waveT ?? 22) - dt;
      if (S.waveT <= 0) {
        S.wave = (S.wave || 1) + 1;
        S.waveT = Math.max(16, 30 - S.wave * 2);
        const n = Math.min(10, 3 + S.wave);
        hud.stamp(`WAVE ${S.wave}`);
        say(pick(['SALLY', 'MACK']), pick(['Here comes another bunch!', 'The sky\'s spitting out a whole parade!', 'More of \'em. There\'s always more of \'em.', 'WAVE! Ooh, I love a wave!']), 2.4);
        for (let k = 0; k < n; k++) later(() => {
          if (!S || S.stage !== st) return;
          const src = S.portals.length ? pick(S.portals) : null;
          const type = weighted(st.mix);
          if (src && !['lowrider', 'truck', 'roomba', 'copter'].includes(type)) { const e2 = addEnemy(type, src.pos.x, src.pos.z); e2.emerge = 0.7; e2.emergeDir = Math.random() * 6.28; }
          else { const p = spawnPoint(40, 100); addEnemy(type, p.x, p.z); }
        }, k * 350);
      }
    }
    // every fight has at least one tear in the sky spitting goons out
    if (!st.roam && st.max > 0 && !st.portals && !S.portals.length && !S.ambientOpening) { S.ambientOpening = true; later(() => { S.ambientOpening = false; if (S.stage && !S.portals.length) openPortal(); }, 1500); }
    if (S.spawnT <= 0 && alive < Math.min(MAX_GOONS, st.max) && S.enemies.length < st.max * 1.8) {
      S.spawnT = interval;
      const type = weighted(st.mix);
      let p;
      if (type === 'imp' && S.fissures && S.fissures.length) { const f2 = pick(S.fissures); const e2 = addEnemy('imp', f2.x, f2.z); e2.emerge = 0.7; e2.emergeDir = Math.random() * 6.28; return; }
      const portal = S.portals.length && Math.random() < 0.9 ? pick(S.portals) : null;
      if (portal && type !== 'lowrider' && type !== 'truck' && type !== 'roomba') { const e2 = addEnemy(type, portal.pos.x, portal.pos.z); e2.emerge = 0.7; e2.emergeDir = Math.random() * Math.PI * 2; sfx.pop(0.6); return; }
      else { const sa = S.area; if (st.roam) S.area = null; p = spawnPoint(40, 110); S.area = sa; }
      addEnemy(type, p.x, p.z);
    }
  }

  function updateShots(dt) {
    const f = focus();
    for (let i = S.shots.length - 1; i >= 0; i--) {
      const s = S.shots[i];
      s.life -= dt;
      const nx = s.pos.x + s.vx * dt, nz = s.pos.z + s.vz * dt;
      let hitWall = false;
      const sd = Math.hypot(s.vx, s.vz) * dt;
      if (sd > 0 && rayDist(s.pos.x, s.pos.z, s.vx * dt / sd, s.vz * dt / sd, sd) < sd) hitWall = true;
      s.pos.x = nx; s.pos.z = nz;
      if (s.big) { s.vy -= 14 * dt; s.pos.y += s.vy * dt; s.mesh.rotation.x += dt * 5; }
      s.mesh.position.copy(s.pos);
      const pr = P.inCar ? 2.6 : 0.9;
      let hitP = !s.big && Math.hypot(s.pos.x - f.x, s.pos.z - f.z) < pr;
      const hitS = !s.big && !hitP && !SA.down && !SA.inCar && Math.hypot(s.pos.x - SA.pos.x, s.pos.z - SA.pos.z) < 0.9;
      const landed = s.big && s.pos.y <= 0.3;
      if (hitP || hitS || hitWall || s.life <= 0 || landed) {
        if (hitP) damagePlayer(s.dmg, s.pos.x, s.pos.z);
        else if (!s.big && !SA.down && !SA.inCar && Math.hypot(s.pos.x - SA.pos.x, s.pos.z - SA.pos.z) < 0.9) damageSally(s.dmg);
        if (s.big) {
          splat(s.pos.x, s.pos.z, s.kind === 'bomb' ? 7 : 5, s.color, 0.9, 10);
          if (Math.hypot(s.pos.x - f.x, s.pos.z - f.z) < (s.kind === 'bomb' ? 6 : 4.5)) damagePlayer(s.dmg);
          if (Math.hypot(s.pos.x - SA.pos.x, s.pos.z - SA.pos.z) < (s.kind === 'bomb' ? 6 : 4.5)) damageSally(s.dmg * 0.8);
          sfx.splat(1);
          for (let k = 0; k < 16; k++) parts.spawn(s.pos.x, 0.8, s.pos.z, rand(-8, 8), rand(3, 9), rand(-8, 8), { life: 0.7, size: 0.6, color: hexToRgb(s.color), grav: 22 });
        } else if (s.kind !== 'bullet') splat(s.pos.x, s.pos.z, rand(0.9, 1.6), s.color, 0.8, 3);
        scene.remove(s.mesh);
        S.shots.splice(i, 1);
      }
    }
  }

  function updateRockets(dt) {
    for (let i = S.rockets.length - 1; i >= 0; i--) {
      const r = S.rockets[i];
      r.life -= dt;
      if (!r.enemy) {
        // heat-seeking: turn toward the lock at a limited rate; if the lock dies, sniff out the next warm body
        if (r.target && (r.target.dead || !(S.enemies.includes(r.target) || S.portals.includes(r.target)))) r.target = null;
        if (!r.target && (r.seekT = (r.seekT || 0) - dt) <= 0) { r.seekT = 0.15; r.target = nearestFoe(r.pos.x + r.vx * 0.25, r.pos.z + r.vz * 0.25, 16); }
        if (r.target) {
          const cur = Math.atan2(r.vx, r.vz), want = Math.atan2(r.target.pos.x - r.pos.x, r.target.pos.z - r.pos.z);
          const a = cur + clamp(wrapAngle(want - cur), -ROCKET_TURN * dt, ROCKET_TURN * dt);
          r.vx = Math.sin(a) * ROCKET_SPEED; r.vz = Math.cos(a) * ROCKET_SPEED;
        }
      } else if (r.target && !r.target.dead && (S.enemies.includes(r.target) || S.portals.includes(r.target))) {
        const dx = r.target.pos.x - r.pos.x, dz = r.target.pos.z - r.pos.z, d = Math.hypot(dx, dz) || 1;
        r.vx += (dx / d * 48 - r.vx) * Math.min(1, dt * 3);
        r.vz += (dz / d * 48 - r.vz) * Math.min(1, dt * 3);
      }
      const sp = Math.hypot(r.vx, r.vz), st = sp * dt;
      const wall = rayDist(r.pos.x, r.pos.z, r.vx / sp, r.vz / sp, st);
      r.pos.x += r.vx * dt; r.pos.z += r.vz * dt;
      const ty = r.target && S.portals.includes(r.target) ? 6 : r.target && r.target.type === 'copter' ? 22 : 1.3;
      r.pos.y += (ty - r.pos.y) * Math.min(1, dt * 2.5);
      r.mesh.position.copy(r.pos);
      r.mesh.rotation.y = Math.atan2(r.vx, r.vz);
      parts.spawn(r.pos.x, r.pos.y, r.pos.z, rand(-0.5, 0.5), rand(0.5, 1.5), rand(-0.5, 0.5), { life: 0.9, size: 1.2, grow: 2.5, color: r.enemy ? hexToRgb(r.color) : [0.7, 0.7, 0.72], alpha: 0.5, drag: 2, kind: 1 });
      let boom = wall < st || r.life <= 0;
      if (r.enemy) {
        const f = focus();
        if (Math.hypot(f.x - r.pos.x, f.z - r.pos.z) < (P.inCar ? 2.8 : 1.3) || (!SA.down && !SA.inCar && Math.hypot(SA.pos.x - r.pos.x, SA.pos.z - r.pos.z) < 1.2)) boom = true;
        if (boom) {
          explode(r.pos.x, r.pos.y, r.pos.z, 5, 0, false);
          splat(r.pos.x, r.pos.z, 5, r.color, 0.9, 8);
          if (Math.hypot(f.x - r.pos.x, f.z - r.pos.z) < 5.5) damagePlayer(P.inCar ? 30 : 20);
          if (Math.hypot(SA.pos.x - r.pos.x, SA.pos.z - r.pos.z) < 5) damageSally(18);
          scene.remove(r.mesh); S.rockets.splice(i, 1);
        }
        continue;
      }
      if (!boom) for (const e of S.enemies) if (Math.hypot(e.pos.x - r.pos.x, e.pos.z - r.pos.z) < e.r + 1) { boom = true; break; }
      if (!boom) for (const p of S.portals) if (Math.hypot(p.pos.x - r.pos.x, p.pos.z - r.pos.z) < 4.5) { boom = true; break; }
      if (boom) {
        sallyBlast(r.pos.x, r.pos.y, r.pos.z);
        scene.remove(r.mesh);
        S.rockets.splice(i, 1);
      }
    }
  }

  function updatePickups(dt) {
    const f = focus();
    for (let i = S.pickups.length - 1; i >= 0; i--) {
      const p = S.pickups[i];
      p.t += dt;
      p.mesh.position.y = 0.6 + Math.sin(p.t * 3) * 0.2;
      p.mesh.rotation.y += dt * 2;
      if (Math.random() < dt * 3) parts.spawn(p.x + rand(-0.6, 0.6), 1.5, p.z + rand(-0.6, 0.6), 0, 1.5, 0, { life: 0.6, size: 0.25, color: [1, 1, 1] });
      if (p.kind === 'evidence') {
        p.mesh.rotation.y -= dt * 2; p.mesh.children[2].rotation.z += dt;
        if (P.inCar && Math.hypot(p.x - f.x, p.z - f.z) < 12 && !S.evHint) { S.evHint = true; say('SALLY', 'Evidence, Mack! You gotta get out and pick it up. I don\'t touch paper. Paper cuts.', 3); }
        if (!P.inCar && Math.hypot(p.x - f.x, p.z - f.z) < 2.4) {
          scene.remove(p.mesh); S.pickups.splice(i, 1);
          S.evidence.push(p.item); sfx.stamp();
          hud.floater(V(p.x, 0, p.z), `EVIDENCE: ${p.item.name.toUpperCase()}`);
          say('MACK', p.item.read, 5);
        }
        continue;
      }
      if (Math.hypot(p.x - f.x, p.z - f.z) < (P.inCar ? 3.5 : 2)) {
        scene.remove(p.mesh); S.pickups.splice(i, 1);
        sfx.pickup();
        if (p.kind === 'pills') { if (P.pills < 4) { P.pills++; hud.floater(V(p.x, 0, p.z), '+PAIN PILLS'); } else { P.hp = Math.min(P.maxHp, P.hp + 25); hud.floater(V(p.x, 0, p.z), '+GRIT'); } }
        else if (P.flasks < P.maxFlasks) { P.flasks++; hud.floater(V(p.x, 0, p.z), '+FLASK'); } else { P.hp = Math.min(P.maxHp, P.hp + 25); hud.floater(V(p.x, 0, p.z), '+GRIT'); }
      }
    }
  }

  function updateBodies(dt) {
    for (let i = S.bodies.length - 1; i >= 0; i--) {
      const b = S.bodies[i];
      b.t += dt;
      if (b.copter) {
        // spinning down out of the rain, then boom
        if (b.copter.y > 0) {
          b.copter.y -= dt * (6 + b.t * 14);
          b.root.rotation.y += dt * b.copter.spin * 3;
          b.root.rotation.z = Math.min(0.8, b.t);
          b.root.position.y = Math.max(0, b.copter.y);
          if (Math.random() < dt * 30) parts.spawn(b.root.position.x, b.root.position.y, b.root.position.z, rand(-1, 1), rand(1, 3), rand(-1, 1), { life: 1.4, size: 2.5, grow: 2, color: [0.1, 0.1, 0.11], alpha: 0.7, kind: 1 });
          if (b.copter.y <= 0) { explode(b.root.position.x, 1, b.root.position.z, 9, 70, false); wash(b.root.position.x, b.root.position.z, 30, 1); }
        }
        if (b.t > 9.5) { scene.remove(b.root); S.bodies.splice(i, 1); }
        continue;
      }
      if (!b.car) b.root.rotation.x = -Math.min(1, b.t * 3) * Math.PI / 2;
      b.root.position.y = b.car ? 0 : 0.3;
      if (b.t > 8) { b.root.position.y -= (b.t - 8) * 2; }
      if (b.t > 9.5) { scene.remove(b.root); S.bodies.splice(i, 1); }
    }
  }

  // ---- city life: rain, splashes, lamps, cops, the donut shop, lightning
  const _v = V();
  function world(rdt, dt) {
    const f = focus();
    rain.userData.uni.t.value += dt;
    rain.userData.uni.center.value.set(f.x, 25, f.z);
    // splashes
    const n = Math.floor(rdt * 240 + Math.random());
    for (let i = 0; i < n; i++) {
      const x = f.x + rand(-55, 55), z = f.z + rand(-45, 35);
      parts.spawn(x, 0.12, z, 0, 0, 0, { life: 0.35, size: 0.4, grow: 3, color: [0.85, 0.88, 0.92], alpha: 0.3, kind: 2 });
    }
    // steam + barrel fires near the camera
    for (const v of vents) {
      if (Math.abs(v.x - f.x) > 70 || Math.abs(v.z - f.z) > 60) continue;
      if (v.fire) {
        if (Math.random() < rdt * 14) parts.spawn(v.x + rand(-0.3, 0.3), 1.8, v.z + rand(-0.3, 0.3), rand(-0.3, 0.3), rand(2, 4), rand(-0.3, 0.3), { life: 0.5, size: rand(0.5, 1.1), color: [1, 0.95, 0.85], kind: 1, alpha: 0.9 });
        if (Math.random() < rdt * 4) parts.spawn(v.x, 2.5, v.z, rand(-0.5, 0.5), 3, rand(-0.5, 0.5), { life: 2, size: 2, grow: 2, color: [0.2, 0.2, 0.22], alpha: 0.5, kind: 1 });
      } else if (Math.random() < rdt * 6) parts.spawn(v.x + rand(-0.5, 0.5), 0.3, v.z + rand(-0.5, 0.5), rand(-0.4, 0.4) - 1, rand(2, 3.5), rand(-0.4, 0.4), { life: 2.5, size: 2.5, grow: 3, color: [0.75, 0.77, 0.8], alpha: 0.3, drag: 0.5, kind: 1 });
    }
    // lamp pool: light the 8 lamps nearest the camera focus
    const near = [];
    for (const l of lamps) {
      if (l.down) continue;
      const d = Math.abs(l.x - f.x) + Math.abs(l.z - (f.z - 8));
      if (d < 120) near.push([d, l]);
    }
    near.sort((a, b) => a[0] - b[0]);
    lampPool.forEach((pl, i) => {
      const l = near[i] && near[i][1];
      if (l) { pl.position.set(l.hx, 7.4, l.z); pl.intensity = 260; } else pl.intensity = 0;
    });
    // cop cars flash red/blue, cops eat
    const blink = Math.floor(S.time * 6) % 2;
    for (const c of copCars) { c.lightbar.userData.a.visible = !!blink; c.lightbar.userData.b.visible = !blink; }
    cops.forEach((c, i) => { c.arm.rotation.x = -1.6 - Math.max(0, Math.sin(S.time * 1.5 + i)) * 0.9; c.root.rotation.z = Math.sin(S.time * 0.8 + i) * 0.03; });
    for (const s of signs) {
      if (s.userData.spin) s.rotation.y += rdt * s.userData.spin;
      if (s.userData.prism && s.material.color) s.material.color.setHSL((S.time * 0.1) % 1, 0.5, 0.7);
    }
    // the Holy Glaze: every pass gets a remark
    const dd = Math.hypot(f.x - L.donut.x, f.z - L.donut.z);
    const inZone = dd < 50;
    if (inZone && !S.donutIn && S.donutT <= 0 && !S.over) {
      S.donutT = 7;
      const [who, text] = donutDeck.draw();
      say(who === 'SALLY' && !SA.inCar && Math.hypot(SA.pos.x - L.donut.x, SA.pos.z - L.donut.z) > 70 ? 'MACK' : who, text, 3.6);
      if (Math.random() < 0.6) later(() => S && say('COP', copDeck.draw(), 2.4), 3400);
    }
    S.donutIn = inZone;
    // lightning
    S.lightningT -= rdt;
    if (S.lightningT <= 0) {
      S.lightningT = rand(8, 22);
      fx.flash = 1;
      sfx.thunder(rand(0.3, 1.4));
    }
    fx.flash = Math.max(0, fx.flash - rdt * 3);
    hemi.intensity = 1.15 + fx.flash * 2.5;
    moon.intensity = 1.5 + fx.flash * 3;
    rain.userData.uni.flash.value = fx.flash * 0.2;
    // particles etc
    parts.update(dt);
    tracers.update(dt);
    flashes.update(dt);
    heroSpot.position.set(f.x - 6, 30, f.z + 10);
    heroSpot.target.position.set(f.x, 0, f.z);
    moon.position.set(f.x + 40, 90, f.z + 25);
    moon.target.position.set(f.x, 0, f.z);
    _v.copy(f);
  }

  // ---- camera
  // 'chase': third person behind Mack or the Packard, looking down the street (default)
  // 'top':   the old high overhead view. C toggles; the choice is remembered.
  const camPos = V(), camLook = V();
  let camMode = 'chase';
  try { camMode = localStorage.getItem('gcb-cam') || 'chase'; } catch (e) { /* private window */ }
  let camYaw = 0;
  function toggleCam() {
    camMode = camMode === 'chase' ? 'top' : 'chase';
    try { localStorage.setItem('gcb-cam', camMode); } catch (e) { /* ignore */ }
    snapCamera();
    say('MACK', camMode === 'chase' ? 'Down at street level. Where the rain lives.' : 'Bird\'s-eye. Like a pigeon with a pension.', 2);
  }
  function camYawTarget() {
    if (P.inCar) return Math.abs(CAR.speed) > 2 || !S.camInit ? CAR.ang : camYaw;
    if (S.down !== undefined || S.puke !== undefined) return camYaw;
    if (P.aiming) {
      // aiming steers the camera only when you push the sights well off-center
      const d = wrapAngle(P.face - camYaw);
      return Math.abs(d) > 0.55 ? camYaw + d - Math.sign(d) * 0.55 : camYaw;
    }
    return P.moveFwd ? P.face : camYaw;
  }
  function chaseTargets() {
    const f = focus();
    const fx0 = Math.sin(camYaw), fz0 = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    const down = S && S.down !== undefined ? Math.max(0.5, 1 - S.down * 0.4) : 1;
    if (P.inCar) {
      const sp = Math.abs(CAR.speed);
      const dist = (11 + Math.min(7, sp * 0.09)) * zoom, h = (4.4 + Math.min(1.5, sp * 0.02)) * zoom;
      return { pos: V(f.x - fx0 * dist, h, f.z - fz0 * dist), look: V(f.x + fx0 * 10, 1.4, f.z + fz0 * 10) };
    }
    const aimK = P.aimT || 0;
    const dist = (7.5 - aimK * 2.2) * zoom * down, h = (3.7 - aimK * 0.7) * zoom * down, sh = aimK * 1.3;
    return {
      pos: V(f.x - fx0 * dist + rx * sh, h, f.z - fz0 * dist + rz * sh),
      look: V(f.x + fx0 * (5 + aimK * 6) + rx * sh * 0.6, 1.5, f.z + fz0 * (5 + aimK * 6) + rz * sh * 0.6),
    };
  }
  function camTargets() {
    if (camMode === 'chase') return chaseTargets();
    const f = focus();
    const lead = P.inCar ? 0.55 : 0;
    const lx = f.x + CAR.vx * lead * (P.inCar ? 1 : 0), lz = f.z + CAR.vz * lead * (P.inCar ? 1 : 0);
    const ax = P.inCar ? 0 : (aim.x - f.x) * 0.18, az = P.inCar ? 0 : (aim.z - f.z) * 0.18;
    const h = (P.inCar ? 46 + Math.min(18, Math.abs(CAR.speed) * 0.35) : 28) * zoom * (S && S.down !== undefined ? Math.max(0.45, 1 - S.down * 0.5) : 1);
    return { pos: V(lx + ax, h, lz + az + h * 0.62), look: V(lx + ax, 0, lz + az - 2) };
  }
  function snapCamera() { if (S) { camYaw = camYawTarget(); S.camInit = true; } const t = camTargets(); camPos.copy(t.pos); camLook.copy(t.look); }
  function updateCamera(dt) {
    if (camMode === 'chase') {
      const rate = P.inCar ? 3.2 : P.aiming ? 1.6 : 2.4;
      camYaw += wrapAngle(camYawTarget() - camYaw) * Math.min(1, dt * rate);
    }
    const t = camTargets();
    const k = 1 - Math.exp(-dt * (camMode === 'chase' ? (P.inCar ? 9 : 7) : 5));
    camPos.lerp(t.pos, k); camLook.lerp(t.look, k);
    camera.position.copy(camPos);
    fx.shake = Math.max(0, fx.shake - dt * 2.5);
    if (fx.shake > 0) camera.position.add(V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(fx.shake * 0.8));
    camera.lookAt(camLook);
    // the nausea sway
    const nz = S ? clamp((S.bleed - 0.55) / 0.45, 0, 1) + (S.puke !== undefined ? 0.6 : 0) : 0;
    if (nz > 0) { const t = performance.now() / 1000; camera.rotateZ(Math.sin(t * 1.3) * 0.05 * nz); camera.rotateX(Math.sin(t * 0.9) * 0.02 * nz); }
    // see-through cutaway for buildings between camera and Mack
    NU.cutA.value.copy(camera.position);
    NU.cutB.value.set(focus().x, 1.5, focus().z);
    NU.cutR.value = P.inCar ? 10 : 7;
  }

  return {
    scene, camera, start, stop, update, startReplay,
    get running() { return !!(S && S.running); },
    get state() { return S; },
    resumeFromBar() { keys.clear(); },
    debug: {
      killAll() { if (!S) return; for (const e of S.enemies.slice()) hitEnemy(e, 99999); for (const p of S.portals.slice()) closePortal(p); },
      win() { if (S) { S.stageIdx = S.stages.length - 1; S.stage = null; win(); } },
      player: P, car: CAR, sally: SA, aim, mouse, keys, enterCar, openPortal, summonCar,
      lose(reason) { if (S) lose(reason); },
      hit(e, d = 99999) { hitEnemy(e, d); },
      killCiv(c) { killCiv(c, true); },
      spawn(type, x, z) { const p = { x, z }; pushOut(p, 3); return addEnemy(type, p.x, p.z); },
      tp(x, z) { P.pos.set(x, 0, z); if (P.inCar) CAR.pos.set(x, 0, z); snapCamera(); },
    },
  };
}
