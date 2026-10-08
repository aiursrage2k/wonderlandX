// Two interiors: Malone's office (main menu + the corkboard of case files)
// and the Last Drop bar. Both sit far outside the city so no paint reaches them.
import * as THREE from 'three';
import { nmat, noirify } from './paint.js';
import { makeDetective, makeSally, makeFlask, makeRobot, makeDame, part } from './models.js';
import { sfx } from './audio.js';

const OFF = new THREE.Vector3(4000, 0, 4000);
const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);

function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const mat = (o) => noirify(new THREE.MeshStandardMaterial(o), { paint: false });
const M = (c, o = {}) => nmat(c, { paint: false, ...o });

function room(g, W, D, H, floorTex, wallTex) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat({ map: floorTex, roughness: 0.45, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M(0x3a3836));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; g.add(ceil);
  const wm = mat({ map: wallTex, roughness: 0.9 });
  const walls = [];
  for (const [x, z, ry, w] of [[0, -D / 2, 0, W], [-W / 2, 0, Math.PI / 2, D], [W / 2, 0, -Math.PI / 2, D], [0, D / 2, Math.PI, W]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wm);
    m.position.set(x, H / 2, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); walls.push(m);
  }
  // wainscot
  const wain = M(0x2e2620, { kind: 'std', rough: 0.5 });
  part(box, wain, 0, 0.55, -D / 2 + 0.05, W, 1.1, 0.1, g).receiveShadow = true;
  part(box, wain, -W / 2 + 0.05, 0.55, 0, 0.1, 1.1, D, g).receiveShadow = true;
  part(box, wain, W / 2 - 0.05, 0.55, 0, 0.1, 1.1, D, g).receiveShadow = true;
  return walls;
}

const wood0 = () => M(0x3a2a1e, { kind: 'std', rough: 0.35 });
const woodTex = () => tex(512, 512, (g, w, h) => {
  for (let y = 0; y < h; y += 32) {
    const b = 60 + Math.random() * 25;
    g.fillStyle = `rgb(${b},${b * 0.85},${b * 0.7})`; g.fillRect(0, y, w, 32);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, y, w, 2);
    const off = Math.random() * w; g.fillRect(off, y, 2, 32);
    for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, y + Math.random() * 30, 40 + Math.random() * 120, 1); }
  }
}, [4, 4]);
const stripeTex = (a, b) => tex(256, 256, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h);
  g.fillStyle = b; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 12, h);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3 + Math.random() * 30); }
}, [6, 2]);

function bottle(g, x, y, z, h = 0.5, c = 0x333333) {
  const b = new THREE.Group();
  const gl = M(c, { kind: 'std', rough: 0.05, metal: 0.3 });
  part(cyl, gl, 0, h * 0.35, 0, 0.16, h * 0.7, 0.16, b);
  part(cyl, gl, 0, h * 0.8, 0, 0.06, h * 0.25, 0.06, b);
  part(box, M(0xd8d0c0), 0, h * 0.35, 0.081, 0.12, h * 0.25, 0.005, b);
  b.position.set(x, y, z); g.add(b);
  return b;
}

// rain running down the glass
function rainGlass(w, h) {
  const uni = { t: { value: 0 }, flash: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float t, flash; varying vec2 vUv;
      float h(float n){ return fract(sin(n*91.3)*47453.1); }
      void main(){
        vec2 uv = vUv * vec2(40.0, 1.0);
        float col = floor(uv.x); float r = h(col);
        float speed = 0.15 + r * 0.35;
        float y = fract(vUv.y * (1.0 + r) + t * speed + r * 7.0);
        float streak = smoothstep(0.5, 0.0, abs(fract(uv.x) - 0.5) * 2.0 - 0.6) * smoothstep(0.0, 0.25, y) * smoothstep(1.0, 0.7, y) * step(0.55, r);
        float drops = step(0.985, h(floor(vUv.x * 160.0) + floor(vUv.y * 90.0) * 13.0));
        float a = streak * 0.35 + drops * 0.4 + 0.05;
        gl_FragColor = vec4(vec3(0.75 + flash), a);
      }`,
  });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  p.userData.uni = uni;
  return p;
}

function skyline(w, h) {
  return tex(1024, 512, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1d2024'); gr.addColorStop(1, '#3a3e44');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const bw = 40 + Math.random() * 90, bh = 120 + Math.random() * 360, x = Math.random() * W;
      g.fillStyle = `rgb(${18 + Math.random() * 14},${18 + Math.random() * 14},${22 + Math.random() * 14})`;
      g.fillRect(x, H - bh, bw, bh);
      for (let yy = H - bh + 8; yy < H; yy += 14) for (let xx = x + 5; xx < x + bw - 6; xx += 11) {
        if (Math.random() < 0.22) { const b = 150 + Math.random() * 100; g.fillStyle = `rgb(${b},${b},${b * 0.9})`; g.fillRect(xx, yy, 5, 7); }
      }
    }
  });
}

// ===================================================================== office
export function buildOffice() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050506);
  const g = new THREE.Group(); g.position.copy(OFF); scene.add(g);
  const W = 14, D = 12, H = 4.6;
  room(g, W, D, H, woodTex(), stripeTex('#5d5850', '#555048'));
  // the back wall gets a window: cover the plane with 4 boxes around the hole
  const wallM = M(0x58534b);
  g.children.filter((c) => c.isMesh && c.position.z === -D / 2 && c.geometry.type === 'PlaneGeometry').forEach((c) => g.remove(c));
  const winX = -1.6, winW = 5, winY0 = 1.2, winY1 = 3.9;
  part(box, wallM, -W / 2 + (winX - winW / 2 + W / 2) / 2, H / 2, -D / 2 - 0.1, winX - winW / 2 + W / 2, H, 0.2, g).receiveShadow = true;
  part(box, wallM, (winX + winW / 2 + W / 2) / 2, H / 2, -D / 2 - 0.1, W / 2 - (winX + winW / 2), H, 0.2, g).receiveShadow = true;
  part(box, wallM, winX, winY0 / 2, -D / 2 - 0.1, winW, winY0, 0.2, g);
  part(box, wallM, winX, (winY1 + H) / 2, -D / 2 - 0.1, winW, H - winY1, 0.2, g);
  const frame = M(0x241e19, { kind: 'std', rough: 0.4 });
  part(box, frame, winX, winY0 - 0.05, -D / 2 + 0.15, winW + 0.3, 0.12, 0.5, g); // sill
  part(box, frame, winX, (winY0 + winY1) / 2, -D / 2, 0.08, winY1 - winY0, 0.08, g);
  part(box, frame, winX, (winY0 + winY1) / 2, -D / 2, winW, 0.08, 0.08, g);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: skyline() }));
  sky.position.set(winX, 2, -D / 2 - 14); g.add(sky);
  const glass = rainGlass(winW, winY1 - winY0); glass.position.set(winX, (winY0 + winY1) / 2, -D / 2 + 0.02); g.add(glass);
  // venetian blinds: real slats, real shadows
  const slatM = M(0xb8b2a6);
  const slats = [];
  for (let y = winY1 - 0.08; y > winY0 + 0.6; y -= 0.13) {
    const s = part(box, slatM, winX, y, -D / 2 + 0.12, winW - 0.1, 0.012, 0.09, g);
    s.rotation.x = 0.7; s.castShadow = true; slats.push(s);
  }
  part(box, frame, winX, winY1 - 0.02, -D / 2 + 0.12, winW, 0.06, 0.1, g);
  // lettering on the frosted door (right wall)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), noirify(new THREE.MeshStandardMaterial({ roughness: 0.2, transparent: true, opacity: 0.9, map: tex(256, 440, (c, w, h) => { c.fillStyle = '#9a9890'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.font = 'bold 26px Georgia'; c.textAlign = 'center'; c.save(); c.scale(-1, 1); c.fillText('MACK MALONE', -w / 2, 120); c.font = 'italic 20px Georgia'; c.fillText('Private Investigations', -w / 2, 150); c.restore(); }) }), { paint: false }));
  door.position.set(-W / 2 + 0.03, 1.25, 3.6); door.rotation.y = Math.PI / 2; g.add(door);
  part(box, frame, -W / 2 + 0.05, 2.5, 3.6, 0.12, 0.12, 1.6, g);
  // DOTTIE-9 at the reception desk by the door
  const rdesk = new THREE.Group(); rdesk.position.set(-4.4, 0, 2.4); g.add(rdesk);
  part(box, wood0(), 0, 0.5, 0, 0.8, 1.0, 2.0, rdesk);
  part(box, M(0x1a1a1a, { kind: 'std', rough: 0.3 }), 0, 1.1, 0.3, 0.45, 0.2, 0.5, rdesk); // her typewriter
  bottle(rdesk, 0.1, 1.0, -0.6, 0.55, 0x444444);
  const dottie = makeRobot(); dottie.root.position.set(-5.4, 0, 2.4); dottie.root.rotation.y = Math.PI / 2; g.add(dottie.root);
  const dLight = new THREE.PointLight(0xe0e8ff, 5, 6, 1.5); dLight.position.set(-4.9, 2.2, 2.4); g.add(dLight);

  // corkboard on the right wall: map + pinned files + red string (the case board)
  const board = new THREE.Group(); board.position.set(W / 2 - 0.06, 2.35, -1.2); board.rotation.y = -Math.PI / 2; g.add(board);
  part(box, M(0x2a2018), 0, 0, -0.02, 4.4, 2.8, 0.06, board);
  const corkM = mat({ map: tex(256, 256, (c, w, h) => { c.fillStyle = '#7a6a55'; c.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { const b = 80 + Math.random() * 60; c.fillStyle = `rgb(${b},${b * 0.85},${b * 0.65})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [2, 1.3]), roughness: 1 });
  part(box, corkM, 0, 0, 0.02, 4.2, 2.6, 0.04, board);
  const mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), M(0xffffff));
  mapPlane.position.set(-0.9, 0, 0.05); board.add(mapPlane);
  board.userData.mapPlane = mapPlane;
  const paper = M(0xd8d2c4);
  for (let i = 0; i < 9; i++) {
    const p = part(box, paper, 0.55 + (i % 3) * 0.55, 0.85 - Math.floor(i / 3) * 0.75, 0.05, 0.42, 0.55, 0.005, board);
    p.rotation.z = (Math.random() - 0.5) * 0.2;
    part(new THREE.SphereGeometry(0.03, 8, 6), M(0xc0102a, { keep: 1 }), p.position.x, p.position.y + 0.24, 0.08, 1, 1, 1, board);
  }
  const strM = new THREE.LineBasicMaterial({ color: 0xc0102a });
  const pts = []; for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(-1.6 + Math.random() * 3.4, -1 + Math.random() * 2, 0.09));
  board.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), strM));

  // desk
  const wood = M(0x3a2a1e, { kind: 'std', rough: 0.35 });
  const desk = new THREE.Group(); desk.position.set(0, 0, 0.3); g.add(desk);
  part(box, wood, 0, 1.0, 0, 3.6, 0.1, 1.7, desk).receiveShadow = true;
  part(box, wood, -1.4, 0.5, 0, 0.7, 0.95, 1.6, desk);
  part(box, wood, 1.4, 0.5, 0, 0.7, 0.95, 1.6, desk);
  part(box, wood, 0, 0.6, 0.78, 2.1, 0.7, 0.05, desk);
  for (let k = 0; k < 3; k++) part(box, M(0x9a8a6a, { kind: 'std', metal: 0.8, rough: 0.3 }), 1.4, 0.25 + k * 0.28, 0.81, 0.18, 0.03, 0.02, desk);
  // desk lamp (banker's lamp)
  const lampM = M(0x2c3a30, { kind: 'std', rough: 0.2, metal: 0.4 });
  part(cyl, M(0x9a8a6a, { kind: 'std', metal: 0.9, rough: 0.25 }), 1.15, 1.08, -0.35, 0.3, 0.05, 0.3, desk);
  part(cyl, M(0x9a8a6a, { kind: 'std', metal: 0.9 }), 1.15, 1.3, -0.35, 0.04, 0.45, 0.04, desk);
  const shade = part(cyl, lampM, 1.15, 1.55, -0.3, 0.32, 0.18, 0.7, desk); shade.rotation.z = Math.PI / 2; shade.scale.set(0.32, 0.7, 0.22);
  const lampLight = new THREE.PointLight(0xffe2b0, 14, 10, 1.4);
  lampLight.position.set(1.15, 1.45, -0.2); desk.add(lampLight);
  lampLight.castShadow = true; lampLight.shadow.mapSize.set(512, 512);
  // typewriter, phone, ashtray, papers, a gun, a glass
  const tw = new THREE.Group(); tw.position.set(-0.3, 1.05, 0.15); desk.add(tw);
  part(box, M(0x1a1a1a, { kind: 'std', rough: 0.3 }), 0, 0.1, 0, 0.6, 0.2, 0.45, tw);
  part(cyl, M(0x111111), 0, 0.27, -0.12, 0.08, 0.6, 0.08, tw).rotation.z = Math.PI / 2;
  part(box, M(0xe8e4dc), 0, 0.38, -0.16, 0.42, 0.28, 0.005, tw).rotation.x = -0.2;
  const phone = new THREE.Group(); phone.position.set(-1.25, 1.05, -0.3); desk.add(phone);
  part(box, M(0x111111, { kind: 'std', rough: 0.2 }), 0, 0.08, 0, 0.3, 0.16, 0.35, phone);
  part(box, M(0x111111, { kind: 'std', rough: 0.2 }), 0, 0.22, 0, 0.42, 0.07, 0.1, phone);
  part(cyl, M(0xdddddd), 0, 0.165, 0.1, 0.14, 0.01, 0.14, phone);
  part(cyl, M(0x777777, { kind: 'std', metal: 0.8 }), 0.55, 1.08, 0.4, 0.3, 0.04, 0.3, desk);
  for (let i = 0; i < 6; i++) part(box, M(0xddd8cc), -0.9 + Math.random() * 0.4, 1.06 + i * 0.006, 0.4 + Math.random() * 0.15, 0.4, 0.005, 0.55, desk).rotation.y = Math.random() * 0.5;
  part(box, M(0xc8b890), 0.3, 1.07, 0.55, 0.5, 0.02, 0.36, desk).rotation.y = 0.2; // a manila case file
  part(cyl, M(0xaaaaaa, { kind: 'std', rough: 0.05, metal: 0.2, transparent: true, opacity: 0.6 }), 0.85, 1.12, 0.3, 0.14, 0.15, 0.14, desk);
  const smokeOrigin = new THREE.Vector3(0.55, 1.15, 0.7).add(desk.position).add(OFF);

  // chair + Mack, tipped back, flask in hand
  const chair = new THREE.Group(); chair.position.set(0, 0, -1.0); g.add(chair);
  const leather = M(0x2a211c, { kind: 'std', rough: 0.4 });
  part(box, leather, 0, 0.6, 0, 0.9, 0.15, 0.8, chair);
  part(box, leather, 0, 1.25, -0.4, 0.9, 1.2, 0.15, chair).rotation.x = -0.15;
  part(cyl, M(0x222222), 0, 0.3, 0, 0.08, 0.5, 0.08, chair);
  const mack = makeDetective();
  mack.gun.visible = false; mack.flask.visible = false;
  mack.root.position.set(0, -0.32, -0.95); g.add(mack.root);
  mack.legL.rotation.x = mack.legR.rotation.x = -1.45;
  mack.armL.rotation.set(-0.3, 0, -0.1);
  const handFlask = makeFlask(0.42); mack.armR.add(handFlask); handFlask.position.set(0, -0.78, 0.08);
  // Sally by the window in her red dress
  const sally = makeSally();
  sally.root.position.set(-5.0, 0, -4.4); sally.root.rotation.y = 0.55; g.add(sally.root);
  sally.launcher.visible = false;
  sally.armL.rotation.set(-0.2, 0, 0.6); sally.armR.rotation.set(-2.0, 0, -0.5);
  const sallyLauncher = part(cyl, M(0x3c3f3a, { kind: 'std', metal: 0.4, rough: 0.5 }), -6.5, 0.85, -5.3, 0.26, 1.7, 0.26, g);
  sallyLauncher.rotation.z = 0.25;

  // bookshelf left wall
  const shelf = new THREE.Group(); shelf.position.set(-W / 2 + 0.4, 0, 1.5); shelf.rotation.y = Math.PI / 2; g.add(shelf);
  part(box, wood, 0, 1.4, 0, 2.4, 2.8, 0.06, shelf);
  for (let k = 0; k < 5; k++) part(box, wood, 0, 0.2 + k * 0.62, 0.2, 2.4, 0.05, 0.42, shelf);
  const flasks = [];
  const addFlask = (parent, x, y, z, s = 0.5, ry = Math.random() * 6, rz = 0) => { const f = makeFlask(s); f.position.set(x, y, z); f.rotation.set(0, ry, rz); parent.add(f); flasks.push(f); return f; };
  for (let k = 0; k < 4; k++) {
    let x = -1.1;
    while (x < 1.1) {
      if (Math.random() < 0.55) { const bw = 0.06 + Math.random() * 0.06, bh = 0.35 + Math.random() * 0.17; const b = Math.random() * 40 + 30; part(box, M(new THREE.Color(b / 255, b / 255, b / 255).getHex()), x, 0.23 + k * 0.62 + bh / 2, 0.2, bw, bh, 0.3, shelf); x += bw + 0.01; } else { addFlask(shelf, x + 0.08, 0.23 + k * 0.62, 0.2, 0.42); x += 0.22; }
    }
  }
  // filing cabinet back-right, covered in flasks
  const cab = new THREE.Group(); cab.position.set(5.6, 0, -5.4); g.add(cab);
  const steel = M(0x5a5c5e, { kind: 'std', rough: 0.4, metal: 0.6 });
  part(box, steel, 0, 0.75, 0, 0.9, 1.5, 0.75, cab);
  for (let k = 0; k < 3; k++) { part(box, M(0x4a4c4e, { kind: 'std', metal: 0.6 }), 0, 0.3 + k * 0.45, 0.38, 0.8, 0.38, 0.02, cab); part(box, M(0xaaaaaa, { kind: 'std', metal: 1 }), 0, 0.42 + k * 0.45, 0.4, 0.2, 0.03, 0.03, cab); }
  for (let k = 0; k < 5; k++) addFlask(cab, -0.3 + (k % 3) * 0.3, 1.5, -0.15 + Math.floor(k / 3) * 0.3, 0.5);
  bottle(cab, 0.35, 1.5, 0.2, 0.6);
  // flasks on the desk, sill and floor — everywhere
  for (let k = 0; k < 5; k++) addFlask(desk, -1.6 + k * 0.14 + (k > 2 ? 2.6 : 0), 1.05, -0.65 + Math.random() * 0.2, 0.42);
  addFlask(desk, 0.15, 1.06, -0.1, 0.42, 0.4, Math.PI / 2); // lying on its side
  for (let k = 0; k < 6; k++) addFlask(g, winX - 2.2 + k * 0.85, winY0, -D / 2 + 0.2, 0.42);
  for (let k = 0; k < 16; k++) {
    const a = Math.random() * Math.PI * 2, r = 1.7 + Math.random() * 3.2;
    const x = Math.cos(a) * r, z = -1 + Math.sin(a) * r * 0.8;
    if (Math.abs(x) > 6.5 || z > 5.5 || z < -5.6) continue;
    addFlask(g, x, 0.02 + (Math.random() < 0.6 ? 0.04 : 0), z, 0.45, Math.random() * 6, Math.random() < 0.6 ? Math.PI / 2 : 0);
  }
  for (let k = 0; k < 3; k++) bottle(g, -3 + k * 0.4, 0, 3 + Math.random(), 0.6);
  // coat rack with spare fedora
  const rack = new THREE.Group(); rack.position.set(5.9, 0, 4.7); g.add(rack);
  part(cyl, frame, 0, 1.0, 0, 0.06, 2.0, 0.06, rack);
  part(cyl, M(0x2b2926), 0.15, 1.95, 0, 0.6, 0.03, 0.6, rack);
  part(cyl, M(0x2b2926), 0.15, 2.05, 0, 0.32, 0.18, 0.32, rack);
  // ceiling fan
  const fan = new THREE.Group(); fan.position.set(0, H - 0.4, 0.5); g.add(fan);
  part(cyl, M(0x222222), 0, 0.2, 0, 0.05, 0.4, 0.05, fan);
  part(cyl, M(0x222222), 0, 0, 0, 0.25, 0.15, 0.25, fan);
  for (let k = 0; k < 4; k++) { const b = part(box, wood, Math.cos(k * Math.PI / 2) * 0.75, 0, Math.sin(k * Math.PI / 2) * 0.75, 1.2, 0.02, 0.25, fan); b.rotation.y = -k * Math.PI / 2; b.castShadow = true; }

  // lights: moonlight through the blinds + desk lamp + faint fill
  const moon = new THREE.SpotLight(0xc8d4e8, 900, 50, 0.32, 0.4, 1.5);
  moon.position.copy(OFF).add(new THREE.Vector3(winX - 1, 9, -D / 2 - 9));
  moon.target.position.copy(OFF).add(new THREE.Vector3(0.5, 0, 0.5));
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0005; moon.shadow.camera.near = 4; moon.shadow.camera.far = 40;
  scene.add(moon, moon.target);
  scene.add(new THREE.HemisphereLight(0x8090a0, 0x2a2420, 0.9));
  // a bare bulb overhead and the hallway light spilling in from the door
  const bulb = new THREE.PointLight(0xffe8c8, 14, 14, 1.4); bulb.position.copy(OFF).add(new THREE.Vector3(0, H - 0.6, 1.2)); scene.add(bulb);
  const hall = new THREE.SpotLight(0xdde4ff, 160, 18, 0.6, 0.7, 1.4);
  hall.position.copy(OFF).add(new THREE.Vector3(-W / 2 + 0.3, 2.6, 3.6)); hall.target.position.copy(OFF).add(new THREE.Vector3(-2, 0, 2.5)); scene.add(hall, hall.target);
  g.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; if (o.castShadow === undefined) o.castShadow = true; } });

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const views = {
    menu: { pos: new THREE.Vector3(3.2, 2.5, 5.0), look: new THREE.Vector3(-0.8, 1.55, -1.6) },
    board: { pos: new THREE.Vector3(2.3, 2.35, -1.2), look: new THREE.Vector3(7, 2.35, -1.2) },
    wide: { pos: new THREE.Vector3(5.4, 3.2, 5.6), look: new THREE.Vector3(-2.4, 1.3, 0.6) },
    desk: { pos: new THREE.Vector3(1.6, 2.3, 4.0), look: new THREE.Vector3(-0.2, 1.3, -0.6) },
    door: { pos: new THREE.Vector3(1.5, 2.3, 4.6), look: new THREE.Vector3(-5.5, 1.5, 2.8) },
  };
  for (const k in views) { views[k].pos.add(OFF); views[k].look.add(OFF); }
  let view = 'menu';
  const curPos = views.menu.pos.clone(), curLook = views.menu.look.clone();
  camera.position.copy(curPos);
  let flash = 0, swig = 0, time = 0;

  // ---- cutscene actors
  const SALLY_HOME = { x: -5.0, z: -4.4, ry: 0.55 };
  let sleep = 0; // 1 = head on the desk
  let dame = null;
  const walkers = [];
  const walkTo = (model, x, z, speed = 1.6, face) => {
    for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].m === model) walkers.splice(i, 1);
    walkers.push({ m: model, x, z, speed, face });
  };
  const resetActors = () => {
    sally.root.visible = true;
    sally.root.position.set(SALLY_HOME.x, 0, SALLY_HOME.z); sally.root.rotation.y = SALLY_HOME.ry;
    sally.armL.rotation.set(-0.2, 0, 0.6); sally.armR.rotation.set(-2.0, 0, -0.5);
    if (dame) { g.remove(dame.root); dame = null; }
    walkers.length = 0;
    sleep = 0;
  };
  const cut = {
    begin(caseDef) {
      resetActors();
      sally.root.visible = false;
      dame = makeDame(caseDef.dame);
      dame.root.position.set(-8.5, 0, 3.6); dame.root.rotation.y = Math.PI / 2;
      dame.root.visible = false;
      g.add(dame.root);
      sleep = 1;
      view = 'wide';
    },
    act(a) {
      if (a === 'sleep') { sleep = 1; view = 'desk'; }
      else if (a === 'dameIn') { sfx.door(); dame.root.visible = true; dame.root.position.set(-7.4, 0, 3.6); walkTo(dame, -3.3, 3.2, 1.4, -Math.PI / 2); view = 'door'; }
      else if (a === 'dameDesk') { walkTo(dame, 0.5, 2.3, 1.3, Math.PI); view = 'wide'; }
      else if (a === 'wake') { sleep = 0; view = 'desk'; }
      else if (a === 'sallyIn') {
        sfx.door(); sfx.crash(0.6);
        sally.root.visible = true; sally.root.position.set(-7.4, 0, 3.6); sally.root.rotation.y = Math.PI / 2;
        sally.armL.rotation.set(-1.4, 0, 0.3); sally.armR.rotation.set(-0.9, 0, 0);
        walkTo(sally, -2.0, 2.6, 4.5, Math.PI * 0.8);
        view = 'wide';
        flash = 0.3;
      } else if (a === 'stamp') { sfx.stamp(); view = 'desk'; }
    },
    end() { resetActors(); view = 'menu'; },
  };

  return {
    scene, camera, board, flasks, smokeOrigin, cut,
    setView(v) { view = v; },
    flash(a = 1) { flash = a; },
    swig() { swig = 2.2; },
    update(dt) {
      time += dt;
      const v = views[view];
      const k = 1 - Math.exp(-dt * 2.2);
      curPos.lerp(v.pos, k); curLook.lerp(v.look, k);
      const sway = view === 'menu' ? 0.12 : 0.03;
      camera.position.copy(curPos).add(new THREE.Vector3(Math.sin(time * 0.21) * sway, Math.sin(time * 0.17) * sway * 0.5, 0));
      camera.lookAt(curLook);
      fan.rotation.y += dt * 1.6;
      glass.userData.uni.t.value = time;
      flash = Math.max(0, flash - dt * 2.5);
      if (Math.random() < dt / 14) flash = 0.8 + Math.random() * 0.4; // lightning
      glass.userData.uni.flash.value = flash;
      moon.intensity = 900 + flash * 6000;
      lampLight.intensity = 14 + Math.sin(time * 13) * 0.3;
      // Mack: asleep on the desk, or taking a pull from the flask now and then
      swig = Math.max(0, swig - dt);
      if (sleep) {
        mack.root.rotation.x = 0.55 + Math.sin(time * 1.3) * 0.03;
        mack.root.position.z = -0.75;
        mack.head.rotation.x = 0.45;
        mack.armR.rotation.set(-1.5, 0, 0.2); mack.armL.rotation.set(-1.5, 0, -0.2);
      } else {
        mack.root.rotation.x *= 1 - Math.min(1, dt * 6);
        mack.root.position.z = -0.95;
        if (swig === 0 && Math.random() < dt / 9) swig = 2.2;
        const s = swig > 0 ? Math.sin(Math.min(1, (2.2 - swig) / 0.5) * Math.PI / 2) * (swig < 0.5 ? swig / 0.5 : 1) : 0;
        mack.armR.rotation.set(-0.6 - s * 1.9, 0, s * 0.5);
        mack.armL.rotation.set(-0.3, 0, -0.1);
        mack.head.rotation.x = -s * 0.35;
      }
      // Dottie sways. She is always a little drunk.
      dottie.body.rotation.z = Math.sin(time * 1.1) * 0.08;
      dottie.body.rotation.x = Math.sin(time * 0.7) * 0.05;
      dottie.head.rotation.z = Math.sin(time * 1.7) * 0.15;
      dottie.armR.rotation.x = -1.2 + Math.sin(time * 0.9) * 0.3;
      const blink = (Math.sin(time * 2.3) > 0.97) ? 0.1 : 1;
      dottie.eyeL.scale.y = 0.14 * blink; dottie.eyeR.scale.y = 0.14 * blink;
      // walkers
      for (let i = walkers.length - 1; i >= 0; i--) {
        const w = walkers[i], p = w.m.root.position;
        const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.05) { if (w.face !== undefined) w.m.root.rotation.y = w.face; walkers.splice(i, 1); w.m.armL && (w.m.armL.rotation.x = -0.2); continue; }
        const st = Math.min(d, w.speed * dt);
        p.x += dx / d * st; p.z += dz / d * st;
        w.m.root.rotation.y = Math.atan2(dx, dz);
        const ph = time * w.speed * 5;
        if (w.m.legL) { w.m.legL.rotation.x = Math.sin(ph) * 0.5; w.m.legR.rotation.x = -Math.sin(ph) * 0.5; }
        w.m.root.position.y = Math.abs(Math.sin(ph)) * 0.05;
      }
      if (dame) dame.head.rotation.y = Math.sin(time * 0.5) * 0.2;
      if (sally.root.visible && !walkers.find((w) => w.m === sally)) {
        sally.head.rotation.y = Math.sin(time * 0.4) * 0.3;
        sally.root.rotation.z = Math.sin(time * 0.7) * 0.015;
        if (sally.legL) { sally.legL.rotation.x *= 0.9; sally.legR.rotation.x *= 0.9; }
      }
    },
  };
}

// ===================================================================== bar
export function buildBar() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040404);
  scene.fog = new THREE.FogExp2(0x0a0a0b, 0.04);
  const g = new THREE.Group(); g.position.copy(OFF); scene.add(g);
  const W = 18, D = 12, H = 4.4;
  room(g, W, D, H, tex(512, 512, (c, w, h) => { for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { c.fillStyle = ((x + y) / 64) % 2 ? '#2a2a2a' : '#8a8a86'; c.fillRect(x, y, 64, 64); } for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; c.fillRect(Math.random() * w, Math.random() * h, 4, 4); } }, [8, 6]), stripeTex('#3a3430', '#332e2a'));
  const wood = M(0x30221a, { kind: 'std', rough: 0.25 });
  // the bar counter
  part(box, wood, 0, 0.55, -2.2, 10, 1.1, 1.0, g);
  part(box, M(0x1a1410, { kind: 'std', rough: 0.15 }), 0, 1.13, -2.2, 10.2, 0.08, 1.2, g);
  part(box, M(0x9a8a6a, { kind: 'std', metal: 1, rough: 0.3 }), 0, 0.15, -1.6, 10, 0.06, 0.06, g); // foot rail
  // back bar: mirror + shelves of bottles (and flasks)
  part(box, M(0x0c0c0e, { kind: 'std', rough: 0.02, metal: 1 }), 0, 2.4, -5.9, 9, 2, 0.05, g);
  for (let k = 0; k < 3; k++) {
    part(box, wood, 0, 1.45 + k * 0.7, -5.6, 9.4, 0.06, 0.5, g);
    for (let x = -4.3; x < 4.3; x += 0.32 + Math.random() * 0.1) {
      if (Math.random() < 0.15) { const f = makeFlask(0.38); f.position.set(x, 1.48 + k * 0.7, -5.6); g.add(f); } else bottle(g, x, 1.48 + k * 0.7, -5.6, 0.4 + Math.random() * 0.25, [0x2a2a2a, 0x555555, 0x888888, 0x1a1a1a][Math.floor(Math.random() * 4)]);
    }
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.1), noirify(new THREE.MeshBasicMaterial({ transparent: true, map: tex(512, 112, (c, w, h) => { c.strokeStyle = '#fff'; c.lineWidth = 5; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#fff'; c.font = 'italic bold 64px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('The Last Drop', w / 2, h / 2 + 4); }) }), { paint: false }));
  sign.position.set(0, 3.8, -5.85); g.add(sign);
  // stools
  for (let k = 0; k < 7; k++) {
    const x = -4 + k * 1.35;
    part(cyl, M(0x9a9a9a, { kind: 'std', metal: 1, rough: 0.3 }), x, 0.4, -0.9, 0.08, 0.8, 0.08, g);
    part(cyl, M(0x1c1a1a, { kind: 'std', rough: 0.4 }), x, 0.85, -0.9, 0.5, 0.12, 0.5, g);
  }
  // Gus the bartender
  const gus = new THREE.Group(); gus.position.set(0.5, 0, -3.4); g.add(gus);
  part(cyl, M(0x222222), 0, 0.6, 0, 0.6, 1.2, 0.5, gus);
  part(cyl, M(0xdedad2), 0, 1.6, 0, 0.75, 0.9, 0.55, gus);
  part(box, M(0x1a1a1a), 0, 1.6, 0.2, 0.6, 0.8, 0.2, gus); // vest
  part(box, M(0x111111), 0, 2.0, 0.29, 0.25, 0.08, 0.04, gus); // bowtie
  const gusHead = part(new THREE.SphereGeometry(0.5, 16, 12), M(0xc4b8ac), 0, 2.38, 0, 0.42, 0.48, 0.44, gus);
  part(box, M(0x222222), 0, 2.27, 0.2, 0.3, 0.05, 0.05, gus); // mustache
  const gusArm = new THREE.Group(); gusArm.position.set(0.4, 1.9, 0); gus.add(gusArm);
  part(cyl, M(0xdedad2), 0, -0.3, 0, 0.18, 0.6, 0.18, gusArm);
  part(cyl, M(0xaaaaaa, { kind: 'std', rough: 0.05, transparent: true, opacity: 0.6 }), 0, -0.68, 0.1, 0.16, 0.2, 0.16, gusArm);
  gusArm.rotation.x = -0.8;
  // Mack and Sally on stools
  const mack = makeDetective(); mack.gun.visible = false;
  mack.root.position.set(-1.6, 0.0, -1.0); mack.root.rotation.y = Math.PI; g.add(mack.root);
  mack.legL.rotation.x = mack.legR.rotation.x = -1.3; mack.root.position.y = -0.1;
  mack.root.rotation.y = Math.PI + 0.25;
  const sally = makeSally();
  sally.root.position.set(-0.25, 0.05, -1.0); sally.root.rotation.y = Math.PI - 0.5; g.add(sally.root);
  sally.legL.rotation.x = sally.legR.rotation.x = -1.2;
  sally.launcher.position.set(0.3, 1.5, -0.4); sally.launcher.rotation.x = 1.0;
  // booths on the left
  for (let k = 0; k < 3; k++) {
    const z = -1 + k * 2.6;
    part(box, M(0x241c18, { kind: 'std', rough: 0.4 }), -8.3, 0.7, z, 0.9, 1.4, 1.9, g);
    part(box, wood, -7.0, 0.85, z, 1.4, 0.08, 1.4, g);
    bottle(g, -7.0, 0.9, z, 0.45);
    const f = makeFlask(0.4); f.position.set(-6.7, 0.9, z + 0.3); g.add(f);
  }
  // the piano and a piano player who never stops
  const piano = new THREE.Group(); piano.position.set(6, 0, 1.2); piano.rotation.y = -0.6; g.add(piano);
  part(box, M(0x0a0a0a, { kind: 'std', rough: 0.08 }), 0, 0.9, 0, 2.2, 1.2, 0.8, piano);
  part(box, M(0xeeeeee), 0, 0.98, 0.45, 2.0, 0.05, 0.25, piano);
  part(box, M(0x0a0a0a, { kind: 'std', rough: 0.08 }), 0, 1.75, -0.2, 2.2, 0.6, 0.4, piano);
  const player = makeDetective(); player.gun.visible = false; player.flask.visible = false;
  player.root.position.set(0, -0.3, 1.2); player.root.rotation.y = Math.PI; piano.add(player.root);
  player.legL.rotation.x = player.legR.rotation.x = -1.4;
  player.root.traverse((o) => { if (o.isMesh) o.material = M(0x1a1a1a); });
  // jukebox glowing in the corner
  const juke = new THREE.Group(); juke.position.set(7.8, 0, -4.8); juke.rotation.y = -0.6; g.add(juke);
  part(box, M(0x2a2a2a, { kind: 'std', rough: 0.3 }), 0, 0.9, 0, 1.2, 1.8, 0.7, juke);
  const jukeGlow = part(new THREE.CylinderGeometry(0.6, 0.6, 0.72, 20, 1, false, 0, Math.PI), M(0xffffff, { kind: 'basic' }), 0, 1.8, 0, 1, 1, 1, juke);
  jukeGlow.rotation.y = -Math.PI / 2;
  // hanging lamps
  const lights = [];
  for (let k = 0; k < 4; k++) {
    const x = -5 + k * 3.4;
    part(cyl, M(0x111111), x, H - 0.5, -1.5, 0.02, 1.0, 0.02, g);
    const sh = part(new THREE.ConeGeometry(0.45, 0.4, 16, 1, true), M(0x1e1e1e, { side: THREE.DoubleSide }), x, H - 1.1, -1.5, 1, 1, 1, g);
    sh.castShadow = false;
    part(new THREE.SphereGeometry(0.12, 8, 6), M(0xffffff, { kind: 'basic' }), x, H - 1.25, -1.5, 1, 1, 1, g);
    const l = new THREE.PointLight(0xffe6c0, 9, 10, 1.6); l.position.set(x, H - 1.35, -1.5); g.add(l); lights.push(l);
  }
  const spot = new THREE.SpotLight(0xd0d8e8, 120, 20, 0.5, 0.6, 1.4);
  spot.position.copy(OFF).add(new THREE.Vector3(2, H - 0.2, 5)); spot.target.position.copy(OFF).add(new THREE.Vector3(-1, 1, -1.5));
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024);
  scene.add(spot, spot.target);
  scene.add(new THREE.HemisphereLight(0x8090a0, 0x1a1410, 0.7));
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const pos = new THREE.Vector3(1.5, 2.3, 5.2).add(OFF), look = new THREE.Vector3(-0.6, 1.5, -2.5).add(OFF);
  let time = 0;
  return {
    scene, camera,
    smokeOrigin: new THREE.Vector3(-1.4, 1.2, -1.8).add(OFF),
    update(dt) {
      time += dt;
      camera.position.copy(pos).add(new THREE.Vector3(Math.sin(time * 0.2) * 0.15, Math.sin(time * 0.15) * 0.05, 0));
      camera.lookAt(look);
      gusArm.rotation.z = Math.sin(time * 3) * 0.35; // polishing a glass
      gusHead.rotation.y = Math.sin(time * 0.5) * 0.4;
      player.armL.rotation.x = -1.1 + Math.sin(time * 9) * 0.12;
      player.armR.rotation.x = -1.1 + Math.sin(time * 7 + 1) * 0.12;
      player.head.rotation.z = Math.sin(time * 2) * 0.1;
      sally.head.rotation.y = -0.4 + Math.sin(time * 0.6) * 0.25;
      lights.forEach((l, i) => { l.intensity = 9 + Math.sin(time * 10 + i * 3) * 0.2; });
    },
  };
}
