// Procedural WebAudio: sfx are synthesised, and a slow music-box motif plays
// over a dark drone. Nothing to download.

import { initMusic, setMusic } from './music.js';

export { setMusic };

let ctx = null;
let master = null;
let musicGain = null;
let noiseBuf = null;
let started = false;
export let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.7;
  musicGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// test hook: an analyser on the master bus
export function debugAnalyser() {
  const a = ctx.createAnalyser();
  a.fftSize = 2048;
  master.connect(a);
  return a;
}

export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  if (!started) {
    started = true;
    startMusic();
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.55;
  return muted;
}

function env(g, t, a, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
}

function noise(t, dur, freq, q, peak, type = 'bandpass', sweepTo) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.005, peak, dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function tone(t, freq, dur, type, peak, slideTo, dest = master) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain();
  env(g, t, 0.004, peak, dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const last = {};
export function sfx(name) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  // light rate-limit so crowds don't clip
  if (last[name] && t - last[name] < 0.03) return;
  last[name] = t;
  switch (name) {
    case 'slash':
      noise(t, 0.16, 2400, 1.2, 0.35, 'bandpass', 700);
      tone(t, 900, 0.08, 'triangle', 0.05, 1800);
      break;
    case 'slash3':
      noise(t, 0.26, 3200, 1.0, 0.45, 'bandpass', 500);
      tone(t, 1200, 0.2, 'sawtooth', 0.04, 300);
      break;
    case 'hit':
      noise(t, 0.09, 900, 2, 0.5, 'lowpass');
      tone(t, 180, 0.12, 'square', 0.12, 60);
      break;
    case 'crit':
      tone(t, 1760, 0.18, 'triangle', 0.12, 2640);
      noise(t, 0.12, 1200, 3, 0.4);
      break;
    case 'spin':
      noise(t, 0.5, 600, 1.5, 0.35, 'bandpass', 3000);
      break;
    case 'dash':
      noise(t, 0.2, 4000, 0.8, 0.25, 'highpass', 1500);
      break;
    case 'hurt':
      tone(t, 300, 0.25, 'sawtooth', 0.15, 90);
      noise(t, 0.2, 500, 1, 0.3, 'lowpass');
      break;
    case 'shatter':
      for (let i = 0; i < 5; i++) tone(t + i * 0.02, 2000 + Math.random() * 3000, 0.12, 'triangle', 0.05);
      noise(t, 0.25, 5000, 2, 0.3, 'highpass');
      break;
    case 'cards':
      for (let i = 0; i < 6; i++) noise(t + i * 0.025, 0.04, 3000 + i * 300, 4, 0.2);
      break;
    case 'orb':
      tone(t, 660, 0.25, 'sine', 0.12, 990);
      tone(t + 0.07, 990, 0.3, 'sine', 0.08, 1320);
      break;
    case 'q':
      tone(t, 110, 0.9, 'sawtooth', 0.2, 40);
      noise(t, 0.8, 300, 0.7, 0.6, 'lowpass', 3000);
      tone(t, 440, 0.6, 'square', 0.05, 1760);
      break;
    case 'telegraph':
      tone(t, 220, 0.35, 'square', 0.04, 330);
      break;
    case 'boil':
      noise(t, 0.4, 400, 3, 0.4, 'bandpass', 150);
      break;
    case 'bell':
      [523, 784, 1046].forEach((f, i) => tone(t + i * 0.01, f, 1.4, 'sine', 0.09));
      break;
    case 'door':
      tone(t, 98, 1.2, 'sawtooth', 0.12, 49);
      noise(t, 1.0, 200, 1, 0.3, 'lowpass');
      break;
    case 'chest':
      [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.08, f, 0.5, 'triangle', 0.1));
      break;
    case 'boss':
      [65, 69, 98].forEach((f) => tone(t, f, 2.5, 'sawtooth', 0.12, f * 0.98));
      break;
    case 'slam':
      noise(t, 0.6, 180, 0.8, 0.5, 'lowpass', 60);
      tone(t, 70, 0.7, 'sine', 0.3, 32);
      break;
    case 'spawn':
      noise(t, 0.5, 200, 1.5, 0.18, 'bandpass', 1400);
      tone(t, 90, 0.5, 'sine', 0.06, 180);
      break;
    case 'xp':
      tone(t, 1300 + Math.random() * 500, 0.1, 'sine', 0.05, 2200);
      break;
    case 'coin':
      tone(t, 1800 + Math.random() * 400, 0.08, 'triangle', 0.05, 2600);
      break;
    case 'tick':
      tone(t, 1500, 0.05, 'sine', 0.03);
      break;
  }
}

// Music lives in music.js; it starts once the browser lets audio play.
function startMusic() {
  initMusic(ctx, musicGain, noiseBuf);
}
