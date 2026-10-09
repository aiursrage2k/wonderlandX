// All sound is synthesised: rain, guns, rockets, and a little generative jazz
// combo (Rhodes, upright bass, brushes/ride, sax/trumpet/vibes) that plays a
// rotating set of tunes so the same song never loops forever.
import { pick } from './util.js';

let ctx = null;
let master, musicBus, sfxBus, ambBus, reverb, noiseBuf;
const vol = { music: 0.6, sfx: 0.8 };
const listeners = [];

export const audio = {
  get ready() { return !!ctx; },
  get time() { return ctx ? ctx.currentTime : 0; },
  onTrack(fn) { listeners.push(fn); },
  setVolume(kind, v) {
    vol[kind] = v;
    if (!ctx) return;
    if (kind === 'music') musicBus.gain.setTargetAtTime(v * 0.55, ctx.currentTime, 0.1);
    if (kind === 'sfx') { sfxBus.gain.setTargetAtTime(v * 0.9, ctx.currentTime, 0.1); ambBus.gain.setTargetAtTime(v * 0.7, ctx.currentTime, 0.1); }
  },
  getVolume(kind) { return vol[kind]; },
};

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = vol.music * 0.55; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx * 0.9; sfxBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = vol.sfx * 0.7; ambBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // small smoky-room reverb
  reverb = ctx.createConvolver();
  const len = ctx.sampleRate * 2.4;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = ir.getChannelData(c);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  reverb.buffer = ir;
  const rvGain = ctx.createGain(); rvGain.gain.value = 0.32;
  reverb.connect(rvGain).connect(musicBus);
  startRain();
  setInterval(tickMusic, 40);
}

// ---------------------------------------------------------------- helpers
function noise(t, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.5, attack = 0.002, out = sfxBus, rate = 1, endFreq } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = rate;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 1.5, dur + 0.05);
  return g;
}

function tone(t, freq, dur, { type = 'sine', gain = 0.3, attack = 0.005, out = sfxBus, endFreq, decay } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (decay ?? dur));
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + (decay ?? dur) + 0.05);
  return o;
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- ambience
let rainGain, rainFilter, engine = null;
function startRain() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
  rainFilter = ctx.createBiquadFilter(); rainFilter.type = 'lowpass'; rainFilter.frequency.value = 5200;
  rainGain = ctx.createGain(); rainGain.gain.value = 0.16;
  src.connect(hp).connect(rainFilter).connect(rainGain).connect(ambBus);
  src.start();
  const src2 = ctx.createBufferSource();
  src2.buffer = noiseBuf; src2.loop = true; src2.playbackRate.value = 0.5;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
  const g2 = ctx.createGain(); g2.gain.value = 0.12;
  src2.connect(lp).connect(g2).connect(ambBus);
  src2.start();
}

// indoors = muffled rain behind glass
export function setIndoors(on) {
  if (!ctx) return;
  rainFilter.frequency.setTargetAtTime(on ? 900 : 5200, ctx.currentTime, 0.4);
  rainGain.gain.setTargetAtTime(on ? 0.1 : 0.16, ctx.currentTime, 0.4);
}

export function setEngine(on, speed = 0) {
  if (!ctx) return;
  if (on && !engine) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g).connect(sfxBus);
    o.start(); o2.start();
    engine = { o, o2, f, g };
  }
  if (!engine) return;
  const t = ctx.currentTime;
  const s = Math.min(1, Math.abs(speed) / 45);
  engine.o.frequency.setTargetAtTime(38 + s * 70, t, 0.08);
  engine.o2.frequency.setTargetAtTime(19 + s * 35, t, 0.08);
  engine.f.frequency.setTargetAtTime(250 + s * 700, t, 0.08);
  engine.g.gain.setTargetAtTime(on ? 0.05 + s * 0.06 : 0, t, 0.15);
}

// ---------------------------------------------------------------- sfx
const at = () => ctx.currentTime;
export const sfx = {
  tommy() {
    if (!ctx) return; const t = at();
    noise(t, 0.09, { type: 'lowpass', freq: 3500, gain: 0.32 });
    tone(t, 140, 0.08, { type: 'square', gain: 0.12, endFreq: 50 });
  },
  revolver() {
    if (!ctx) return; const t = at();
    noise(t, 0.35, { type: 'lowpass', freq: 2600, gain: 0.55, endFreq: 300 });
    tone(t, 95, 0.3, { type: 'sine', gain: 0.45, endFreq: 38 });
    noise(t, 0.05, { type: 'highpass', freq: 3500, gain: 0.25 });
    noise(t + 0.08, 0.6, { type: 'bandpass', freq: 500, q: 0.7, gain: 0.08, attack: 0.05 }); // echo down the street
  },
  radio() {
    if (!ctx) return; const t = at();
    noise(t, 0.5, { type: 'bandpass', freq: 1800, q: 1.5, gain: 0.12, attack: 0.02 });
    tone(t + 0.45, 1000, 0.06, { type: 'sine', gain: 0.05 });
  },
  glass() {
    if (!ctx) return; const t = at();
    for (let i = 0; i < 6; i++) tone(t + i * 0.03, 2500 + Math.random() * 3000, 0.12, { type: 'triangle', gain: 0.05 });
  },
  splash() {
    if (!ctx) return; const t = at();
    noise(t, 1.2, { type: 'highpass', freq: 1500, gain: 0.25, attack: 0.05 });
  },
  siren() {
    if (!ctx) return; const t = at();
    tone(t, 740, 0.55, { type: 'square', gain: 0.035, attack: 0.05 });
    tone(t + 0.6, 560, 0.55, { type: 'square', gain: 0.035, attack: 0.05 });
  },
  boost() {
    if (!ctx) return; const t = at();
    noise(t, 0.9, { type: 'bandpass', freq: 300, q: 0.7, gain: 0.45, endFreq: 2400, attack: 0.03 });
    tone(t, 60, 0.7, { type: 'sawtooth', gain: 0.18, endFreq: 140 });
  },
  screech(v = 1) {
    if (!ctx) return; const t = at();
    noise(t, 0.26, { type: 'bandpass', freq: 2400 + Math.random() * 700, q: 12, gain: 0.22 * v, attack: 0.02 });
    tone(t, 1900 + Math.random() * 300, 0.24, { type: 'sawtooth', gain: 0.025 * v, attack: 0.02 });
  },
  focus() {
    if (!ctx) return; const t = at();
    tone(t, 400, 0.8, { type: 'sine', gain: 0.18, endFreq: 90 });
    noise(t, 0.6, { type: 'lowpass', freq: 1200, gain: 0.15, endFreq: 150 });
  },
  reload() {
    if (!ctx) return; const t = at();
    for (let i = 0; i < 6; i++) tone(t + 0.1 + i * 0.09, 1800 + Math.random() * 400, 0.03, { type: 'square', gain: 0.03 });
    tone(t + 0.85, 600, 0.06, { type: 'square', gain: 0.06, endFreq: 300 });
  },
  pistol(pan = 0, far = 1) {
    if (!ctx) return; const t = at();
    noise(t, 0.12, { type: 'bandpass', freq: 1800, q: 0.8, gain: 0.2 * far });
    tone(t, 600, 0.06, { type: 'triangle', gain: 0.06 * far, endFreq: 200 });
  },
  pop(far = 1) { // paintball
    if (!ctx) return; const t = at();
    tone(t, 900, 0.07, { type: 'sine', gain: 0.12 * far, endFreq: 300 });
    noise(t, 0.05, { type: 'highpass', freq: 3000, gain: 0.08 * far });
  },
  splat(far = 1) {
    if (!ctx) return; const t = at();
    noise(t, 0.18, { type: 'lowpass', freq: 900, gain: 0.18 * far, endFreq: 200 });
  },
  spray(far = 1) {
    if (!ctx) return; const t = at();
    noise(t, 0.22, { type: 'highpass', freq: 5000, gain: 0.05 * far, attack: 0.03 });
  },
  rocket() {
    if (!ctx) return; const t = at();
    noise(t, 0.7, { type: 'bandpass', freq: 600, q: 0.6, gain: 0.3, endFreq: 3500, attack: 0.02 });
    tone(t, 90, 0.3, { type: 'sawtooth', gain: 0.1, endFreq: 40 });
  },
  boom(far = 1) {
    if (!ctx) return; const t = at();
    noise(t, 1.4, { type: 'lowpass', freq: 1400, gain: 0.7 * far, endFreq: 80 });
    tone(t, 70, 0.9, { type: 'sine', gain: 0.6 * far, endFreq: 25 });
    noise(t + 0.02, 0.25, { type: 'highpass', freq: 2500, gain: 0.25 * far });
  },
  hit() {
    if (!ctx) return; const t = at();
    tone(t, 220, 0.12, { type: 'square', gain: 0.1, endFreq: 90 });
  },
  hurt() {
    if (!ctx) return; const t = at();
    noise(t, 0.2, { type: 'lowpass', freq: 600, gain: 0.3 });
    tone(t, 110, 0.25, { type: 'sawtooth', gain: 0.1, endFreq: 60 });
  },
  kill() {
    if (!ctx) return; const t = at();
    // the color draining out: a falling glassy sweep
    tone(t, 1400, 0.5, { type: 'sine', gain: 0.07, endFreq: 180 });
    tone(t + 0.03, 2100, 0.4, { type: 'sine', gain: 0.04, endFreq: 260 });
  },
  crash(far = 1) {
    if (!ctx) return; const t = at();
    noise(t, 0.5, { type: 'bandpass', freq: 900, q: 0.5, gain: 0.45 * far });
    noise(t, 0.3, { type: 'highpass', freq: 4000, gain: 0.2 * far });
  },
  door() {
    if (!ctx) return; const t = at();
    tone(t, 160, 0.15, { type: 'square', gain: 0.07, endFreq: 90 });
    noise(t + 0.12, 0.08, { type: 'bandpass', freq: 1200, gain: 0.15 });
  },
  gulp() {
    if (!ctx) return; const t = at();
    for (let i = 0; i < 3; i++) tone(t + i * 0.22, 180, 0.16, { type: 'sine', gain: 0.18, endFreq: 90 });
    noise(t + 0.75, 0.4, { type: 'bandpass', freq: 700, q: 2, gain: 0.08, attack: 0.05 });
  },
  type() {
    if (!ctx) return; const t = at();
    noise(t, 0.03, { type: 'bandpass', freq: 2500 + Math.random() * 800, q: 3, gain: 0.07 });
  },
  bell() {
    if (!ctx) return; const t = at();
    tone(t, 2100, 1.4, { type: 'sine', gain: 0.08 });
    tone(t, 2650, 1.0, { type: 'sine', gain: 0.04 });
  },
  portal() {
    if (!ctx) return; const t = at();
    tone(t, 55, 2.5, { type: 'sawtooth', gain: 0.15, endFreq: 220, attack: 0.4 });
    tone(t, 82, 2.5, { type: 'sawtooth', gain: 0.1, endFreq: 330, attack: 0.4 });
    noise(t, 2.5, { type: 'bandpass', freq: 300, q: 4, gain: 0.2, endFreq: 4000, attack: 0.5 });
  },
  close() {
    if (!ctx) return; const t = at();
    tone(t, 600, 1.2, { type: 'sine', gain: 0.2, endFreq: 40 });
    noise(t + 0.6, 1.0, { type: 'lowpass', freq: 800, gain: 0.5, endFreq: 60 });
  },
  thunder(delay = 0) {
    if (!ctx) return; const t = at() + delay;
    noise(t, 3.5, { type: 'lowpass', freq: 380, gain: 0.8, attack: 0.08, rate: 0.5, endFreq: 60 });
    noise(t, 0.6, { type: 'lowpass', freq: 1500, gain: 0.3, attack: 0.01 });
  },
  pickup() {
    if (!ctx) return; const t = at();
    tone(t, 660, 0.1, { gain: 0.1 }); tone(t + 0.08, 990, 0.18, { gain: 0.1 });
  },
  horn() {
    if (!ctx) return; const t = at();
    tone(t, 330, 0.45, { type: 'sawtooth', gain: 0.06 }); tone(t, 415, 0.45, { type: 'sawtooth', gain: 0.05 });
  },
  harp() {
    // dream harp: a glissando up two octaves and back down, strings left ringing
    if (!ctx) return; const t = at();
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
    const base = 261.6;
    scale.forEach((s, i) => { const f = base * Math.pow(2, s / 12); tone(t + i * 0.055, f, 1.8, { type: 'triangle', gain: 0.07, attack: 0.004 }); tone(t + i * 0.055, f * 2, 1.0, { type: 'sine', gain: 0.025, attack: 0.004 }); });
    const t2 = t + scale.length * 0.055 + 0.08;
    [...scale].reverse().forEach((s, i) => { const f = base * Math.pow(2, s / 12); tone(t2 + i * 0.05, f, 1.6, { type: 'triangle', gain: 0.05, attack: 0.004 }); });
  },
  wasted() {
    if (!ctx) return; const t = at();
    noise(t, 0.25, { type: 'lowpass', freq: 600, gain: 0.7 });
    tone(t, 110, 2.6, { type: 'sawtooth', gain: 0.12, endFreq: 41 });
    tone(t, 116, 2.6, { type: 'sawtooth', gain: 0.08, endFreq: 43 });
    tone(t + 0.5, 70, 1.4, { gain: 0.35, endFreq: 30 });
  },
  stamp() {
    if (!ctx) return; const t = at();
    noise(t, 0.15, { type: 'lowpass', freq: 500, gain: 0.6 });
    tone(t, 80, 0.15, { gain: 0.4, endFreq: 40 });
  },
};

// ================================================================= JAZZ
const QUAL = {
  maj7: { tones: [0, 4, 7, 11], voic: [4, 7, 11, 14], scale: [0, 2, 4, 7, 9, 11, 14] },
  maj9: { tones: [0, 4, 7, 11], voic: [4, 11, 14, 19], scale: [0, 2, 4, 7, 9, 11] },
  6: { tones: [0, 4, 7, 9], voic: [4, 9, 14, 19], scale: [0, 2, 4, 7, 9] },
  m7: { tones: [0, 3, 7, 10], voic: [3, 7, 10, 14], scale: [0, 2, 3, 5, 7, 9, 10] },
  m9: { tones: [0, 3, 7, 10], voic: [3, 10, 14, 17], scale: [0, 2, 3, 5, 7, 9, 10] },
  m6: { tones: [0, 3, 7, 9], voic: [3, 9, 14, 19], scale: [0, 2, 3, 5, 7, 9, 11] },
  7: { tones: [0, 4, 7, 10], voic: [4, 9, 10, 14], scale: [0, 2, 3, 4, 7, 9, 10] },
  9: { tones: [0, 4, 7, 10], voic: [4, 10, 14, 21], scale: [0, 2, 4, 7, 9, 10] },
  '7alt': { tones: [0, 4, 8, 10], voic: [4, 10, 13, 20], scale: [0, 1, 3, 4, 6, 8, 10] },
  m7b5: { tones: [0, 3, 6, 10], voic: [3, 6, 10, 13], scale: [0, 1, 3, 5, 6, 8, 10] },
  dim7: { tones: [0, 3, 6, 9], voic: [3, 6, 9, 12], scale: [0, 2, 3, 5, 6, 8, 9, 11] },
  sus: { tones: [0, 5, 7, 10], voic: [5, 10, 14, 19], scale: [0, 2, 5, 7, 9, 10] },
  '7sus': { tones: [0, 5, 7, 10], voic: [5, 10, 14, 19], scale: [0, 2, 5, 7, 9, 10] },
};
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function chord(name) {
  let r = NOTE[name[0]], i = 1;
  if (name[1] === 'b') { r--; i++; } else if (name[1] === '#') { r++; i++; }
  const q = name.slice(i) || 'maj7';
  return { root: (r + 12) % 12, ...QUAL[q] };
}
const prog = (s) => s.split('|').map((bar) => bar.trim().split(/\s+/).map(chord));

// Each tune: a progression, a feel and a lead voice. The melody is generated
// fresh each time the tune comes round, but the "head" repeats within a play
// so it still sounds like a song.
export const TRACKS = [
  { name: 'Rain on Rye', feel: 'ballad', tempo: 66, lead: 'sax', choruses: 3,
    prog: prog('Dbmaj7 | Bbm7 | Ebm7 | Ab7 | Fm7 | Bb7 | Ebm7 | Ab7 | Gbmaj7 | Cb7 | Fm7 | Bb7alt | Ebm7 | Ab7 | Dbmaj7 | Ab7alt') },
  { name: 'Grey Street Shuffle', feel: 'swing', tempo: 128, lead: 'sax', choruses: 6,
    prog: prog('F7 | Bb7 | F7 | Cm7 F7 | Bb7 | Bdim7 | F7 | Am7 D7 | Gm7 | C7 | F7 D7 | Gm7 C7') },
  { name: 'Neon Never Sleeps', feel: 'bossa', tempo: 124, lead: 'vibes', choruses: 4,
    prog: prog('Am9 | Am9 | Dm9 | Dm9 | Bm7b5 | E7alt | Am9 | A7 | Dm9 | G9 | Cmaj9 | Fmaj7 | Bm7b5 | E7alt | Am9 | E7alt') },
  { name: 'Last Call Waltz', feel: 'waltz', tempo: 108, lead: 'trumpet', choruses: 4,
    prog: prog('Ebmaj7 | Cm7 | Fm7 | Bb7 | Gm7 | C7 | Fm7 | Bb7 | Abmaj7 | Abm6 | Gm7 | C7alt | Fm7 | Bb7 | Eb6 | Bb7') },
  { name: 'Hot Lead, Cold Rain', feel: 'hot', tempo: 184, lead: 'trumpet', choruses: 6,
    prog: prog('Cm7 Ab7 | Dm7b5 G7alt | Cm7 Ab7 | Dm7b5 G7alt | Fm7 Bb7 | Ebmaj7 Abmaj7 | Dm7b5 | G7alt') },
  { name: 'Smoke Ring Serenade', feel: 'ballad', tempo: 60, lead: 'vibes', choruses: 3,
    prog: prog('Fmaj7 | Bbmaj7 | Am7 | D7 | Gm7 | C7 | Am7 | D7alt | Gm7 | C7 | Fmaj7 | Dm7 | Gm7 | C7sus | Fmaj7 | C7alt') },
  { name: 'Alley Cat Strut', feel: 'swing', tempo: 112, lead: 'trumpet', choruses: 5,
    prog: prog('Gm7 | C7 | Fm7 | Bb7 | Ebmaj7 | Am7b5 D7alt | Gm7 | D7alt | Gm7 | Gm7 | Cm7 | F7 | Bbmaj7 | Ebmaj7 | Am7b5 | D7alt') },
  { name: 'Blue Velvet Bossa', feel: 'bossa', tempo: 116, lead: 'sax', choruses: 4,
    prog: prog('Dmaj7 | Dmaj7 | E7 | E7 | Em7 | A7 | Dmaj7 | A7alt | Dmaj7 | Dmaj7 | G6 | Gm6 | F#m7 | B7alt | Em7 A7 | Dmaj7') },
  { name: 'Midnight Precinct', feel: 'hot', tempo: 168, lead: 'sax', choruses: 6,
    prog: prog('Fm7 | Fm7 | Bbm7 | Bbm7 | Gm7b5 | C7alt | Fm7 | C7alt | Dbmaj7 | Gb7 | Fm7 | Bb7 | Gm7b5 | C7alt | Fm7 | C7alt') },
  { name: 'The Last Drop', feel: 'swing', tempo: 96, lead: 'piano', choruses: 4,
    prog: prog('Bbmaj7 | G7alt | Cm7 | F7 | Dm7 | G7 | Cm7 | F7 | Fm7 | Bb7 | Ebmaj7 | Ab7 | Dm7 | G7alt | Cm7 F7 | Bbmaj7') },
];

export const PLAYLISTS = {
  office: ['Rain on Rye', 'Smoke Ring Serenade', 'Neon Never Sleeps', 'Last Call Waltz', 'Blue Velvet Bossa'],
  bar: ['The Last Drop', 'Grey Street Shuffle', 'Blue Velvet Bossa', 'Last Call Waltz', 'Alley Cat Strut'],
  low: ['Grey Street Shuffle', 'Neon Never Sleeps', 'Alley Cat Strut', 'Blue Velvet Bossa', 'Last Call Waltz'],
  high: ['Hot Lead, Cold Rain', 'Midnight Precinct', 'Grey Street Shuffle', 'Alley Cat Strut'],
  boss: ['Hot Lead, Cold Rain', 'Midnight Precinct'],
};

const music = { list: null, track: null, bar: 0, nextT: 0, last: null, head: null, fade: null, cur: 72, gap: 0 };

export function playlist(name) {
  if (music.list === name) return;
  music.list = name;
  if (!ctx) return;
  if (music.track && !PLAYLISTS[name].includes(music.track.name)) fadeTrack();
}
export function skipTrack() { if (ctx && music.track) fadeTrack(); }

function fadeTrack() {
  const t = ctx.currentTime;
  musicBus.gain.setTargetAtTime(0, t, 0.5);
  music.track = null;
  music.gap = t + 1.8;
  setTimeout(() => musicBus.gain.setTargetAtTime(vol.music * 0.55, ctx.currentTime, 0.2), 1700);
}

function startTrack() {
  const names = PLAYLISTS[music.list || 'office'];
  let choices = names.filter((n) => n !== music.last);
  if (!choices.length) choices = names;
  const want = pick(choices);
  const tr = TRACKS.find((x) => x.name === want);
  music.track = tr;
  music.last = tr.name;
  music.bar = 0;
  music.nextT = ctx.currentTime + 0.15;
  music.cur = tr.lead === 'trumpet' ? 74 : 70;
  // compose the head once for this play
  const heads = [];
  for (let b = 0; b < tr.prog.length; b++) heads.push(melodyBar(tr, b, true));
  music.head = heads;
  // pick soloists for the middle choruses
  music.solos = ['lead', tr.lead === 'piano' ? 'lead' : 'piano', 'lead', 'bass', 'lead'];
  listeners.forEach((fn) => fn(tr.name));
}

function tickMusic() {
  if (!ctx || !music.list) return;
  if (ctx.state !== 'running') return;
  if (!music.track) {
    if (ctx.currentTime < music.gap) return;
    startTrack();
  }
  const tr = music.track;
  while (music.track === tr && music.nextT < ctx.currentTime + 0.35) {
    const total = tr.prog.length * tr.choruses;
    if (music.bar >= total) {
      // tag ending: ring the final chord, then move on
      const spb = 60 / tr.tempo;
      const c = tr.prog[0][0];
      for (const iv of c.voic) epiano(music.nextT, 48 + c.root + iv, spb * 4, 0.16);
      bass(music.nextT, 36 + c.root, spb * 4, 0.5);
      music.track = null;
      music.gap = music.nextT + spb * 4 + 2.5;
      return;
    }
    scheduleBar(tr, music.bar, music.nextT);
    const beats = tr.feel === 'waltz' ? 3 : 4;
    music.nextT += beats * 60 / tr.tempo;
    music.bar++;
  }
}

function eighthTime(tr, i) {
  // i in 8ths within the bar → seconds offset, with swing
  const spb = 60 / tr.tempo;
  const sw = tr.feel === 'bossa' ? 0.5 : tr.feel === 'hot' ? 0.6 : 0.64;
  const beat = Math.floor(i / 2);
  return (beat + (i % 2 ? sw : 0)) * spb;
}

function chordAt(tr, bar, beat) {
  const b = tr.prog[bar % tr.prog.length];
  const beats = tr.feel === 'waltz' ? 3 : 4;
  if (b.length === 1) return b[0];
  return b[Math.min(b.length - 1, Math.floor(beat / (beats / b.length)))];
}

function scheduleBar(tr, bar, t0) {
  const spb = 60 / tr.tempo;
  const beats = tr.feel === 'waltz' ? 3 : 4;
  const len = tr.prog.length;
  const chorus = Math.floor(bar / len);
  const inBar = bar % len;
  const lastChorus = chorus === tr.choruses - 1;
  const isHead = chorus === 0 || lastChorus;
  const soloist = isHead ? 'lead' : music.solos[(chorus - 1) % music.solos.length];
  const hot = tr.feel === 'hot';

  // ---- drums
  for (let b = 0; b < beats; b++) {
    const t = t0 + b * spb;
    if (tr.feel === 'ballad') {
      brush(t, spb * 0.9, 0.05);
      if (b % 2 === 1) hat(t, 0.05);
      if (b === 0) kick(t, 0.12);
    } else if (tr.feel === 'waltz') {
      if (b === 0) { ride(t, 0.07); kick(t, 0.14); brush(t, spb * 1.8, 0.05); } else hat(t, 0.05);
    } else if (tr.feel === 'bossa') {
      shaker(t, 0.05); shaker(t + spb * 0.5, 0.035);
      if (b === 0 || b === 2) kick(t, 0.18);
      if (b === 1 || b === 3) kick(t + spb * 0.5, 0.1);
      const clave = (inBar % 2 === 0) ? [0, 1.5, 3] : [1, 2];
      for (const c of clave) if (c >= b && c < b + 1) rim(t0 + c * spb, 0.12);
    } else {
      ride(t, hot ? 0.11 : 0.08);
      if (b === 1 || b === 3) { ride(t0 + eighthTime(tr, b * 2 + 1), hot ? 0.07 : 0.05); hat(t, 0.08); }
      kick(t, hot ? 0.07 : 0.05);
      if (Math.random() < (hot ? 0.3 : 0.12)) snare(t0 + eighthTime(tr, b * 2 + (Math.random() < 0.5 ? 1 : 0)), hot ? 0.09 : 0.05);
    }
  }
  if (hot && inBar % 4 === 3 && Math.random() < 0.6) snare(t0 + eighthTime(tr, 7), 0.16);

  // ---- bass
  if (soloist !== 'bass' || isHead) {
    if (tr.feel === 'swing' || tr.feel === 'hot') {
      for (let b = 0; b < beats; b++) {
        const c = chordAt(tr, bar, b);
        let n;
        if (b === 0 || (chordAt(tr, bar, b - 1) !== c)) n = c.root;
        else if (b === beats - 1) {
          const next = chordAt(tr, bar + 1, 0);
          n = next.root + (Math.random() < 0.5 ? 1 : -1);
        } else n = c.root + pick(c.tones.slice(1));
        bass(t0 + b * spb, 36 + ((n % 12) + 12) % 12, spb * 0.92, 0.55);
      }
    } else if (tr.feel === 'bossa') {
      const c = chordAt(tr, bar, 0), c2 = chordAt(tr, bar, 2);
      bass(t0, 36 + c.root, spb * 1.4, 0.55);
      bass(t0 + spb * 1.5, 36 + ((c.root + 7) % 12), spb * 0.45, 0.4);
      bass(t0 + spb * 2, 36 + ((c2.root + 7) % 12), spb * 1.4, 0.5);
      bass(t0 + spb * 3.5, 36 + c2.root, spb * 0.45, 0.4);
    } else if (tr.feel === 'waltz') {
      const c = chordAt(tr, bar, 0);
      bass(t0, 36 + c.root, spb * 0.95, 0.55);
      bass(t0 + spb, 36 + ((c.root + 7) % 12), spb * 0.9, 0.35);
      bass(t0 + spb * 2, 36 + ((c.root + c.tones[1]) % 12), spb * 0.9, 0.35);
    } else {
      const c = chordAt(tr, bar, 0), c2 = chordAt(tr, bar, 2);
      bass(t0, 36 + c.root, spb * 1.9, 0.55);
      bass(t0 + spb * 2, 36 + ((c2.root + (c2 === c ? 7 : 0)) % 12), spb * 1.9, 0.45);
    }
  } else {
    // bass solo: busier, higher line
    for (let i = 0; i < beats * 2; i++) {
      if (Math.random() < 0.35) continue;
      const c = chordAt(tr, bar, i / 2);
      const s = c.scale;
      bass(t0 + eighthTime(tr, i), 43 + c.root % 12 + s[Math.floor(Math.random() * s.length)] % 12, spb * 0.45, 0.6);
    }
  }

  // ---- comping (Rhodes)
  if (soloist !== 'piano' || isHead) {
    const pats = {
      ballad: [[[0, 4]], [[0, 2], [2, 2]], [[0, 3], [3.5, 0.5]]],
      swing: [[[0, 0.6], [1.5, 1]], [[0.5, 0.4], [2, 1.2]], [[1, 0.5], [2.5, 1]], [[0, 0.5], [3.5, 0.4]]],
      hot: [[[0.5, 0.3], [2.5, 0.3]], [[1.5, 0.4], [3, 0.4]], [[0, 0.3], [1.5, 0.3], [3.5, 0.3]]],
      bossa: [[[0, 1], [1.5, 1], [3, 0.4]], [[0.5, 1], [2, 1.2], [3.5, 0.5]]],
      waltz: [[[1, 0.5], [2, 0.5]], [[1, 1.8]], [[0.5, 0.4], [2, 0.6]]],
    };
    for (const [b, d] of pick(pats[tr.feel])) {
      const c = chordAt(tr, bar, b);
      const t = t0 + (tr.feel === 'bossa' ? b * spb : eighthTime(tr, Math.round(b * 2)));
      for (const iv of c.voic) {
        let m = 48 + c.root + iv;
        while (m > 70) m -= 12;
        while (m < 53) m += 12;
        epiano(t + Math.random() * 0.015, m, d * spb, tr.feel === 'ballad' ? 0.11 : 0.09);
      }
    }
  } else {
    playLead(tr, melodyBar(tr, bar, false), t0, 'piano');
  }

  // ---- lead
  if (soloist === 'lead' || isHead) {
    const events = isHead ? music.head[inBar] : melodyBar(tr, bar, false);
    // the tune breathes: rest some bars in solos, all of the very first 2 bars of chorus 1 get the head
    if (isHead || Math.random() > 0.12) playLead(tr, events, t0, tr.lead);
  }
}

// Build one bar of melody: [{e: eighthIndex, len: eighths, m: midi, v}]
function melodyBar(tr, bar, head) {
  const beats = tr.feel === 'waltz' ? 3 : 4;
  const slots = beats * 2;
  const density = { ballad: 0.32, waltz: 0.45, bossa: 0.45, swing: 0.6, hot: 0.72 }[tr.feel] * (head ? 0.9 : 1);
  const phrasePos = bar % 4;
  const lo = tr.lead === 'trumpet' ? 64 : tr.lead === 'vibes' ? 65 : 60;
  const hi = lo + 19;
  const ev = [];
  if (phrasePos === 3 && Math.random() < 0.7) {
    // phrase ending: one long chord tone then breathe
    const c = chordAt(tr, bar, 0);
    const m = nearestTone(music.cur, c, c.tones.slice(1, 3));
    ev.push({ e: 0, len: Math.ceil(slots * 0.6), m, v: 0.75 });
    music.cur = m;
    return ev;
  }
  let i = phrasePos === 0 && Math.random() < 0.5 ? 1 : 0;
  while (i < slots) {
    const strong = i % 2 === 0;
    if (Math.random() > density && !(i === 0 && phrasePos === 0)) { i++; continue; }
    const c = chordAt(tr, bar, i / 2);
    let m;
    if (strong && Math.random() < 0.65) m = nearestTone(music.cur + (Math.random() < 0.5 ? 2 : -2), c, c.tones);
    else {
      const step = pick([-2, -1, -1, 1, 1, 2, 3, -3]);
      m = stepScale(music.cur, c, step);
    }
    if (tr.feel !== 'bossa' && Math.random() < 0.06) m = 12 * Math.floor(m / 12) + ((c.root + 3) % 12); // blue note
    while (m > hi) m -= 12;
    while (m < lo) m += 12;
    const long = tr.feel === 'ballad' || tr.feel === 'waltz' ? (Math.random() < 0.5 ? 2 : 3) : (Math.random() < 0.25 ? 2 : 1);
    const len = Math.min(long, slots - i);
    ev.push({ e: i, len, m, v: strong ? 0.8 : 0.62 });
    music.cur = m;
    i += len;
  }
  return ev;
}

function nearestTone(m, c, tones) {
  let best = m, bd = 99;
  for (let o = 4; o <= 7; o++) for (const t of tones) {
    const n = o * 12 + ((c.root + t) % 12);
    const d = Math.abs(n - m);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
function stepScale(m, c, steps) {
  const pcs = c.scale.map((s) => (c.root + s) % 12);
  let n = m;
  const dir = Math.sign(steps);
  let k = Math.abs(steps);
  let guard = 0;
  while (k > 0 && guard++ < 24) {
    n += dir;
    if (pcs.includes(((n % 12) + 12) % 12)) k--;
  }
  return n;
}

function playLead(tr, events, t0, voice) {
  const spb = 60 / tr.tempo;
  for (const n of events) {
    const t = t0 + (tr.feel === 'bossa' ? n.e * spb / 2 : eighthTime(tr, n.e));
    const dur = n.len * spb / 2 * 0.95;
    if (voice === 'sax') sax(t, n.m, dur, n.v);
    else if (voice === 'trumpet') trumpet(t, n.m, dur, n.v);
    else if (voice === 'vibes') vibes(t, n.m, dur, n.v);
    else epiano(t, n.m, dur, 0.2 * n.v, true);
  }
}

// ---------------------------------------------------------------- instruments
function out(g, wet = 0.4) {
  g.connect(musicBus);
  const s = ctx.createGain(); s.gain.value = wet;
  g.connect(s).connect(reverb);
}

function epiano(t, m, dur, v, bright = false) {
  const f = mtof(m);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.008);
  g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.5);
  g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.001;
  const g2 = ctx.createGain(); g2.gain.value = bright ? 0.35 : 0.2;
  const tine = ctx.createOscillator(); tine.type = 'sine'; tine.frequency.value = f * 7.02;
  const gt = ctx.createGain(); gt.gain.setValueAtTime(bright ? 0.25 : 0.12, t); gt.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright ? 4200 : 2600;
  o1.connect(g); o2.connect(g2).connect(g); tine.connect(gt).connect(g);
  g.connect(lp); out(lp, 0.35);
  const end = t + dur + 0.8;
  for (const o of [o1, o2, tine]) { o.start(t); o.stop(end); }
}

function bass(t, m, dur, v) {
  const f = mtof(m);
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v * 0.45, t + 0.012);
  g.gain.exponentialRampToValueAtTime(v * 0.22, t + 0.3);
  g.gain.setTargetAtTime(0.0001, t + dur, 0.04);
  o.connect(lp); o2.connect(lp); lp.connect(g); out(g, 0.08);
  o.start(t); o2.start(t); o.stop(t + dur + 0.4); o2.stop(t + dur + 0.4);
}

function sax(t, m, dur, v) {
  const f = mtof(m);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
  const vib = ctx.createOscillator(); vib.frequency.value = 5.3;
  const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.4, dur));
  vib.connect(vg).connect(o.frequency);
  // little scoop into the note
  o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.8;
  lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(1500 + v * 900, t + 0.08);
  lp.frequency.setTargetAtTime(1200, t + 0.1, 0.3);
  const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1100; pk.gain.value = 5; pk.Q.value = 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.11 * v, t + 0.05);
  g.gain.setTargetAtTime(0.085 * v, t + 0.08, 0.2);
  g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
  o.connect(lp).connect(pk).connect(g); out(g, 0.5);
  noise(t, Math.min(dur, 0.25), { type: 'bandpass', freq: f * 3, q: 2, gain: 0.015 * v, attack: 0.03, out: musicBus });
  const end = t + dur + 0.5;
  o.start(t); vib.start(t); o.stop(end); vib.stop(end);
}

function trumpet(t, m, dur, v) {
  const f = mtof(m);
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
  o.frequency.setValueAtTime(f * 0.985, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  const vib = ctx.createOscillator(); vib.frequency.value = 5.6;
  const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.009, t + Math.min(0.35, dur));
  vib.connect(vg).connect(o.frequency);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 2.2; // harmon mute
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.03);
  g.gain.setTargetAtTime(0.12 * v, t + 0.05, 0.2);
  g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
  o.connect(bp).connect(lp).connect(g); out(g, 0.55);
  const end = t + dur + 0.4;
  o.start(t); vib.start(t); o.stop(end); vib.stop(end);
}

function vibes(t, m, dur, v) {
  const f = mtof(m);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4;
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  const trem = ctx.createOscillator(); trem.frequency.value = 5;
  const tg = ctx.createGain(); tg.gain.value = 0.3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(1.2, dur * 1.5));
  const am = ctx.createGain(); am.gain.value = 0.75;
  trem.connect(tg).connect(am.gain);
  o.connect(am); o2.connect(g2).connect(am); am.connect(g); out(g, 0.5);
  const end = t + Math.max(1.3, dur * 1.6);
  for (const x of [o, o2, trem]) { x.start(t); x.stop(end); }
}

function ride(t, v) {
  noise(t, 0.5, { type: 'bandpass', freq: 6200, q: 1.2, gain: v, attack: 0.001, out: musicBus });
  noise(t, 0.08, { type: 'highpass', freq: 9000, gain: v * 0.6, attack: 0.001, out: musicBus });
}
function hat(t, v) { noise(t, 0.06, { type: 'highpass', freq: 7500, gain: v, attack: 0.001, out: musicBus }); }
function brush(t, dur, v) { noise(t, dur, { type: 'bandpass', freq: 3200, q: 0.6, gain: v, attack: dur * 0.6, out: musicBus }); }
function shaker(t, v) { noise(t, 0.07, { type: 'highpass', freq: 5500, gain: v, attack: 0.02, out: musicBus }); }
function rim(t, v) {
  noise(t, 0.04, { type: 'bandpass', freq: 1900, q: 4, gain: v, attack: 0.001, out: musicBus });
  tone(t, 1700, 0.02, { type: 'square', gain: v * 0.2, out: musicBus });
}
function snare(t, v) {
  noise(t, 0.18, { type: 'bandpass', freq: 1800, q: 0.7, gain: v, attack: 0.001, out: musicBus });
  tone(t, 190, 0.08, { type: 'triangle', gain: v * 0.6, out: musicBus });
}
function kick(t, v) { tone(t, 95, 0.22, { type: 'sine', gain: v, endFreq: 42, out: musicBus }); }

export function currentTrack() { return music.track ? music.track.name : null; }
