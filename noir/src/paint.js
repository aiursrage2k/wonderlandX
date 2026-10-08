// The color system. The whole world renders in rain-grey; the Syndicate's paint
// lives in a top-down canvas that every world material samples. Paint shows
// through as vivid color, and each gang kill washes it back out.
import * as THREE from 'three';

export const PAINT = { origin: -700, size: 1400, res: 2048 };

const canvas = document.createElement('canvas');
canvas.width = canvas.height = PAINT.res;
const ctx = canvas.getContext('2d');
export const paintCanvas = canvas;

export const paintTex = new THREE.CanvasTexture(canvas);
paintTex.colorSpace = THREE.SRGBColorSpace;
paintTex.flipY = false;
paintTex.generateMipmaps = false;
paintTex.minFilter = THREE.LinearFilter;
paintTex.magFilter = THREE.LinearFilter;

// Uniforms shared by reference across every noir material.
export const NU = {
  paintMap: { value: paintTex },
  paintOrigin: { value: new THREE.Vector2(PAINT.origin, PAINT.origin) },
  paintSize: { value: PAINT.size },
  paintH: { value: 7 },
  paintGain: { value: 1 },
  cutA: { value: new THREE.Vector3() },
  cutB: { value: new THREE.Vector3(0, -999, 0) },
  cutR: { value: 7 },
  seeColor: { value: 0 }, // pain pills: Mack sees in color (and hates it)
  ntime: { value: 0 },
};

const VERT_HEAD = 'varying vec3 vNW;\n';
const VERT_BODY = `#include <begin_vertex>
{
  vec4 nw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  nw = instanceMatrix * nw;
#endif
  vNW = (modelMatrix * nw).xyz;
}`;
const FRAG_HEAD = `varying vec3 vNW;
uniform sampler2D paintMap;
uniform vec2 paintOrigin;
uniform float paintSize, paintH, paintGain, cutR, seeColor;
uniform vec3 cutA, cutB;
`;

function fragBody(keep, paint) {
  return `{
  float nl = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  vec3 ncol = mix(vec3(nl) * vec3(0.92, 0.96, 1.0), outgoingLight, ${keep.toFixed(3)});
  if (seeColor > 0.0) {
    vec3 sat = clamp(vec3(nl) + (outgoingLight - vec3(nl)) * 5.0, 0.0, 4.0);
    sat = mix(sat, sat * (0.75 + 0.35 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + vNW.x * 0.01 + vNW.z * 0.013))), 0.35);
    ncol = mix(ncol, sat, seeColor * (1.0 - ${keep.toFixed(3)}));
  }
  ${paint ? `
  vec2 puv = (vNW.xz - paintOrigin) / paintSize;
  vec4 pc = texture2D(paintMap, puv);
  float inb = step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
  float pa = pc.a * inb * paintGain * (1.0 - smoothstep(paintH * 0.55, paintH, vNW.y));
  vec3 pcol = pc.rgb * (0.32 + nl * 2.1);
  ncol = mix(ncol, pcol, clamp(pa, 0.0, 1.0));` : ''}
  outgoingLight = ncol;
}
#include <opaque_fragment>`;
}

const CUT = `
{
  vec3 ab = cutB - cutA;
  float t = dot(vNW - cutA, ab) / max(dot(ab, ab), 1e-3);
  if (t > 0.0 && t < 0.94 && length(vNW - (cutA + ab * t)) < cutR) discard;
}
`;

// Patch a three material so it renders noir: desaturated, painted by the
// paint map. keep = how much of its own color survives (1 for Sally's dress
// and the Syndicate), cut = see-through when between camera and player.
export function noirify(mat, { keep = 0, cut = false, paint = true } = {}) {
  mat.onBeforeCompile = (sh) => {
    for (const k in NU) sh.uniforms[k] = NU[k];
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', VERT_BODY);
    let fs = FRAG_HEAD + sh.fragmentShader.replace('#include <opaque_fragment>', fragBody(keep, paint));
    if (cut) fs = fs.replace('void main() {', 'void main() {' + CUT);
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `noir|${keep}|${cut}|${paint}`;
  return mat;
}

const matCache = new Map();
// Cached noir materials. kind: 'lambert' | 'std' | 'basic'
export function nmat(color, o = {}) {
  const key = JSON.stringify([color, o]);
  if (matCache.has(key)) return matCache.get(key);
  const { kind = 'lambert', keep = 0, cut = false, paint = true, rough = 0.7, metal = 0, emissive = 0, ei = 1, side, transparent, opacity } = o;
  let m;
  const base = { color };
  if (side !== undefined) base.side = side;
  if (transparent) { base.transparent = true; base.opacity = opacity ?? 1; }
  if (kind === 'std') m = new THREE.MeshStandardMaterial({ ...base, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei });
  else if (kind === 'basic') m = new THREE.MeshBasicMaterial(base);
  else m = new THREE.MeshLambertMaterial({ ...base, emissive, emissiveIntensity: ei });
  noirify(m, { keep, cut, paint });
  matCache.set(key, m);
  return m;
}

// ---- drawing ---------------------------------------------------------------
let dirty = false;
const toPx = (w) => ((w - PAINT.origin) / PAINT.size) * PAINT.res;
const scale = PAINT.res / PAINT.size;

export function splat(x, z, r, color, alpha = 0.9, drops = 5) {
  const px = toPx(x), py = toPx(z), pr = Math.max(1.2, r * scale);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < drops; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = pr * (0.8 + Math.random() * 1.1);
    ctx.beginPath();
    ctx.arc(px + Math.cos(a) * d, py + Math.sin(a) * d, pr * (0.12 + Math.random() * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  dirty = true;
}

// A painted stroke (rollers, lowriders, beams).
export function stroke(x0, z0, x1, z1, w, color, alpha = 0.85) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, w * scale);
  ctx.beginPath();
  ctx.moveTo(toPx(x0), toPx(z0));
  ctx.lineTo(toPx(x1), toPx(z1));
  ctx.stroke();
  ctx.globalAlpha = 1;
  dirty = true;
}

// Rain washes the color out: a soft erase around a point.
export function wash(x, z, r, strength = 1) {
  const px = toPx(x), py = toPx(z), pr = r * scale;
  const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(0.6, `rgba(0,0,0,${strength * 0.8})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = g;
  ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  ctx.globalCompositeOperation = 'source-over';
  dirty = true;
}

export function fadeAll(a) {
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fillRect(0, 0, PAINT.res, PAINT.res);
  ctx.globalCompositeOperation = 'source-over';
  dirty = true;
}

export function clearPaint() {
  ctx.clearRect(0, 0, PAINT.res, PAINT.res);
  dirty = true;
}

let uploadT = 0;
export function flushPaint(dt) {
  uploadT -= dt;
  if (dirty && uploadT <= 0) {
    paintTex.needsUpdate = true;
    dirty = false;
    uploadT = 1 / 9;
  }
}

// Fraction of the city covered in paint (0..1), sampled on a small copy.
const small = document.createElement('canvas');
small.width = small.height = 128;
const sctx = small.getContext('2d', { willReadFrequently: true });
export function coverage(area) {
  sctx.clearRect(0, 0, 128, 128);
  if (area) {
    const x0 = toPx(area.x0), z0 = toPx(area.z0);
    sctx.drawImage(canvas, x0, z0, toPx(area.x1) - x0, toPx(area.z1) - z0, 0, 0, 128, 128);
  } else sctx.drawImage(canvas, 0, 0, 128, 128);
  const d = sctx.getImageData(0, 0, 128, 128).data;
  let s = 0;
  for (let i = 3; i < d.length; i += 4) s += d[i];
  return s / (128 * 128 * 255);
}
