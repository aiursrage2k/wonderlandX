// Rain (lots of it), splashes, particles, tracers, explosions and flashes.
import * as THREE from 'three';

export const fx = { shake: 0, flash: 0 };

// ------------------------------------------------------------------ rain
export function makeRain(count = 14000, size = new THREE.Vector3(150, 70, 150)) {
  const pos = new Float32Array(count * 2 * 3);
  const seed = new Float32Array(count * 2 * 4);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let k = 0; k < 2; k++) {
      seed.set(s, (i * 2 + k) * 4);
      end[i * 2 + k] = k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('endp', new THREE.BufferAttribute(end, 1));
  const uni = { t: { value: 0 }, center: { value: new THREE.Vector3() }, size: { value: size }, wind: { value: new THREE.Vector2(-9, 4) }, alpha: { value: 0.3 }, flash: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false,
    vertexShader: `attribute vec4 seed; attribute float endp; uniform float t; uniform vec3 center, size; uniform vec2 wind; varying float vA;
      void main(){
        float spd = 55.0 + seed.w * 25.0;
        vec3 vel = vec3(wind.x, -spd, wind.y);
        vec3 p = seed.xyz * size + vel * t;
        p = center + mod(p - center + size * 0.5, size) - size * 0.5;
        p += normalize(vel) * endp * (1.4 + seed.w * 1.2);
        vA = endp;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'uniform float alpha, flash; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.82 + flash), alpha * (0.35 + vA * 0.65)); }',
  });
  const lines = new THREE.LineSegments(g, m);
  lines.frustumCulled = false;
  lines.userData.uni = uni;
  return lines;
}

// ------------------------------------------------------------------ points
const pointVS = `attribute float size; attribute float alpha; attribute vec3 tint; attribute float kind; varying float vA; varying vec3 vC; varying float vK;
  uniform float scale;
  void main(){ vA = alpha; vC = tint; vK = kind; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const pointFS = `varying float vA; varying vec3 vC; varying float vK;
  void main(){
    vec2 c = gl_PointCoord - 0.5; float r = length(c);
    float a;
    if (vK > 1.5) a = smoothstep(0.5, 0.42, r) * smoothstep(0.3, 0.4, r);   // ring (rain splash)
    else if (vK > 0.5) a = smoothstep(0.5, 0.0, r);                      // soft smoke
    else a = smoothstep(0.5, 0.3, r);                                   // hard drop / spark
    if (a * vA < 0.01) discard;
    gl_FragColor = vec4(vC, a * vA);
  }`;

export class Particles {
  constructor(n = 5000) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.tint = new Float32Array(n * 3);
    this.kindA = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.grow = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.a0 = new Float32Array(n);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('kind', new THREE.BufferAttribute(this.kindA, 1).setUsage(THREE.DynamicDrawUsage));
    this.uni = { scale: { value: 600 } };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: pointVS, fragmentShader: pointFS, transparent: true, depthWrite: false }));
    this.mesh.frustumCulled = false;
    this.geo = g;
  }
  // kind: 0 drop/spark, 1 smoke, 2 ring
  spawn(x, y, z, vx, vy, vz, { life = 1, size = 1, color = [1, 1, 1], alpha = 1, grow = 0, grav = 0, drag = 0, kind = 0 } = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grow[i] = grow; this.grav[i] = grav; this.drag[i] = drag;
    this.tint[i * 3] = color[0]; this.tint[i * 3 + 1] = color[1]; this.tint[i * 3 + 2] = color[2];
    this.alpha[i] = alpha; this.a0[i] = alpha; this.kindA[i] = kind;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.2; this.vel[i * 3] *= 0.5; this.vel[i * 3 + 2] *= 0.5; }
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.max[i];
      this.alpha[i] = this.a0[i] * Math.min(1, t * 2.5);
      if (this.life[i] <= 0) this.alpha[i] = 0;
    }
    for (const k of ['position', 'size', 'alpha', 'tint', 'kind']) this.geo.attributes[k].needsUpdate = true;
  }
}

// ------------------------------------------------------------------ tracers
export class Tracers {
  constructor(n = 300) {
    this.n = n;
    this.pos = new Float32Array(n * 6);
    this.col = new Float32Array(n * 8);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('rgba', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mesh = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'attribute vec4 rgba; varying vec4 vC; void main(){ vC = rgba; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec4 vC; void main(){ gl_FragColor = vC; }',
    }));
    this.mesh.frustumCulled = false;
  }
  add(a, b, color = [1, 1, 0.9], life = 0.07) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    this.life[i] = life; this.max[i] = life;
    this.col.set([color[0], color[1], color[2], 0.2, color[0], color[1], color[2], 0.9], i * 8);
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const a = Math.max(0, this.life[i] / this.max[i]);
      this.col[i * 8 + 3] = 0.2 * a; this.col[i * 8 + 7] = 0.9 * a;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.rgba.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ helpers
export function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

export class Flashes {
  constructor(scene, n = 4) {
    this.lights = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xfff0dd, 0, 40, 1.6);
      scene.add(l);
      this.lights.push({ l, t: 0, max: 1, i0: 0 });
    }
    this.k = 0;
    this.balls = [];
    const geo = new THREE.SphereGeometry(1, 16, 12);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
      m.visible = false; scene.add(m);
      this.balls.push({ m, t: 0, max: 1, r: 1 });
    }
    this.bk = 0;
  }
  light(x, y, z, intensity = 400, life = 0.12) {
    const s = this.lights[this.k]; this.k = (this.k + 1) % this.lights.length;
    s.l.position.set(x, y, z); s.t = life; s.max = life; s.i0 = intensity; s.l.intensity = intensity;
  }
  ball(x, y, z, r, life = 0.35) {
    const b = this.balls[this.bk]; this.bk = (this.bk + 1) % this.balls.length;
    b.m.position.set(x, y, z); b.m.visible = true; b.t = life; b.max = life; b.r = r;
  }
  update(dt) {
    for (const s of this.lights) { if (s.t > 0) { s.t -= dt; s.l.intensity = Math.max(0, s.i0 * (s.t / s.max)); } }
    for (const b of this.balls) {
      if (b.t <= 0) continue;
      b.t -= dt;
      const k = 1 - b.t / b.max;
      b.m.scale.setScalar(b.r * (0.4 + k));
      b.m.material.opacity = Math.max(0, 1 - k);
      if (b.t <= 0) b.m.visible = false;
    }
  }
}
