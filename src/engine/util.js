// Small math + randomness helpers shared across the game.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Mulberry32 — deterministic PRNG so rooms/textures are reproducible per seed.
export function makeRng(seed) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + rng() * (b - a);
  rng.int = (a, b) => Math.floor(a + rng() * (b - a + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  return rng;
}

export const rand = makeRng((Math.random() * 2 ** 32) >>> 0);

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function rgba(r, g, b, a) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

// Radial glow sprite cache: additive blobs are the backbone of the lighting look.
const glowCache = new Map();
export function glowSprite(r, g, b, soft = 0.5) {
  const key = `${r},${g},${b},${soft}`;
  let c = glowCache.get(key);
  if (c) return c;
  c = makeCanvas(128, 128);
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, rgba(r, g, b, 1));
  grd.addColorStop(soft * 0.35, rgba(r, g, b, 0.55));
  grd.addColorStop(soft, rgba(r, g, b, 0.18));
  grd.addColorStop(1, rgba(r, g, b, 0));
  x.fillStyle = grd;
  x.fillRect(0, 0, 128, 128);
  glowCache.set(key, c);
  return c;
}
