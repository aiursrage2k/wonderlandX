// Small shared helpers.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export function weighted(obj) {
  let total = 0;
  for (const k in obj) total += obj[k];
  let r = Math.random() * total;
  for (const k in obj) {
    r -= obj[k];
    if (r <= 0) return k;
  }
  return Object.keys(obj)[0];
}

// Picks lines from a pool without repeating until the pool is exhausted.
export class Deck {
  constructor(items) { this.items = items; this.left = []; }
  draw() {
    if (!this.left.length) this.left = this.items.slice().sort(() => Math.random() - 0.5);
    return this.left.pop();
  }
}
