// Procedural score. Five looping tracks, synthesised on the fly and
// cross-faded through a shared reverb:
//   title  — "Down the Rabbit Hole": music box and choir in D minor
//   stage  — the garden waltz: a detuned music box over a drone
//   boss   — "A Very Mad Galop": driving 16ths, harpsichord lead, drums
//   final  — "The Crimson Queen": choir, organ, timpani, bells in C minor
//   victory— a bright fanfare that settles into a lullaby

let ctx = null;
let bus = null;
let noiseBuf = null;
let verb = null;
let current = null;
const live = [];
let timer = null;

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

function makeReverb() {
  const len = Math.floor(ctx.sampleRate * 2.8);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.4;
  }
  const c = ctx.createConvolver();
  c.buffer = buf;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  c.connect(wet).connect(bus);
  return c;
}

// ─── voices ───
function voice(t, freq, dur, o, out) {
  const osc = ctx.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain();
  const a = o.attack ?? 0.005;
  const peak = o.peak ?? 0.1;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  if (o.sustain) {
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - (o.release ?? 0.3)));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  } else g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  let node = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filterType || 'lowpass';
    f.frequency.setValueAtTime(o.filter, t);
    if (o.filterTo) f.frequency.exponentialRampToValueAtTime(o.filterTo, t + dur);
    f.Q.value = o.q ?? 0.7;
    node.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(out.dry);
  if (o.wet) {
    const s = ctx.createGain();
    s.gain.value = o.wet;
    g.connect(s).connect(out.wet);
  }
  osc.start(t);
  osc.stop(t + dur + (o.attack ?? 0) + 0.1);
}

function hit(t, dur, o, out) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.freq, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out.dry);
  if (o.wet) {
    const s = ctx.createGain();
    s.gain.value = o.wet;
    g.connect(s).connect(out.wet);
  }
  src.start(t, Math.random() * 0.4);
  src.stop(t + dur + 0.05);
}

const bell = (t, m, dur, peak, out) => {
  voice(t, hz(m), dur, { type: 'sine', peak, wet: 0.6 }, out);
  voice(t, hz(m) * 2.76, dur * 0.4, { type: 'sine', peak: peak * 0.25, wet: 0.6 }, out);
  voice(t, hz(m) * 5.4, dur * 0.15, { type: 'sine', peak: peak * 0.12, wet: 0.6 }, out);
};
const musicBox = (t, m, peak, out) => {
  voice(t, hz(m) * (1 + (Math.random() - 0.5) * 0.004), 1.1, { type: 'sine', peak, wet: 0.5 }, out);
  voice(t, hz(m) * 4.02, 0.25, { type: 'sine', peak: peak * 0.2, wet: 0.5 }, out);
};
const pluck = (t, m, peak, out) => {
  voice(t, hz(m), 0.22, { type: 'square', peak, filter: 5200, filterTo: 900, wet: 0.2 }, out);
  voice(t, hz(m) * 2, 0.12, { type: 'sawtooth', peak: peak * 0.3, filter: 6000, filterTo: 1500, wet: 0.2 }, out);
};
const choir = (t, ms, dur, peak, out) => {
  for (const m of ms) {
    for (const d of [-9, 0, 8]) {
      voice(t, hz(m), dur, { type: 'sawtooth', peak: peak / 3, attack: Math.min(0.8, dur * 0.3), sustain: true, release: dur * 0.3, detune: d, filter: 1100, filterType: 'bandpass', q: 1.2, wet: 0.8 }, out);
    }
  }
};
const organ = (t, ms, dur, peak, out) => {
  for (const m of ms) {
    voice(t, hz(m), dur, { type: 'triangle', peak, attack: 0.05, sustain: true, release: 0.2, wet: 0.5 }, out);
    voice(t, hz(m) * 2, dur, { type: 'square', peak: peak * 0.18, attack: 0.05, sustain: true, release: 0.2, filter: 1800, wet: 0.5 }, out);
  }
};
const pad = (t, ms, dur, peak, out, cut = 700) => {
  for (const m of ms) {
    voice(t, hz(m), dur, { type: 'sawtooth', peak, attack: dur * 0.3, sustain: true, release: dur * 0.35, detune: -6, filter: cut, wet: 0.6 }, out);
    voice(t, hz(m), dur, { type: 'sawtooth', peak, attack: dur * 0.3, sustain: true, release: dur * 0.35, detune: 7, filter: cut, wet: 0.6 }, out);
  }
};
const kick = (t, peak, out) => voice(t, 150, 0.35, { type: 'sine', peak, slide: 38 }, out);
const snare = (t, peak, out) => {
  hit(t, 0.18, { freq: 1800, q: 0.8, peak, wet: 0.25 }, out);
  voice(t, 190, 0.1, { type: 'triangle', peak: peak * 0.5, slide: 120 }, out);
};
const hat = (t, peak, out) => hit(t, 0.05, { freq: 8000, type: 'highpass', q: 0.5, peak }, out);
const timpani = (t, m, peak, out) => {
  voice(t, hz(m), 1.4, { type: 'sine', peak, slide: hz(m) * 0.93, wet: 0.5 }, out);
  hit(t, 0.25, { freq: 180, type: 'lowpass', q: 0.8, peak: peak * 0.7, wet: 0.5 }, out);
};
const crash = (t, peak, out) => hit(t, 2.2, { freq: 6000, to: 2500, type: 'highpass', q: 0.3, peak, wet: 0.6 }, out);

// chord shapes as MIDI (root position triads around the given root)
const MIN = [0, 3, 7];
const MAJ = [0, 4, 7];
const chord = (root, q) => q.map((x) => root + x);

// ─── tracks ───
const TRACKS = {
  title: {
    step: 0.3,
    len: 64,
    vol: 1.5,
    fade: 2.0,
    play(i, t, out) {
      const bar = Math.floor(i / 8);
      const prog = [[62, MIN], [58, MAJ], [55, MIN], [57, MAJ], [62, MIN], [53, MAJ], [55, MIN], [57, MAJ]];
      const [r, q] = prog[bar % 8];
      const ch = chord(r, q);
      const s = i % 8;
      if (s === 0) {
        choir(t, ch.map((m) => m - 12), 8 * this.step * 1.05, 0.05, out);
        voice(t, hz(r - 24), 8 * this.step, { type: 'sine', peak: 0.12, attack: 0.3, sustain: true, release: 0.8, wet: 0.3 }, out);
      }
      // music box arpeggio: up, then turn
      const arp = [0, 1, 2, 3, 2, 1, 2, 3];
      const idx = arp[s];
      const note = idx === 3 ? ch[0] + 12 : ch[idx];
      musicBox(t, note + 12, 0.05, out);
      // a lonely bell melody on the half bars
      const mel = [74, 0, 72, 0, 70, 0, 69, 0, 74, 77, 76, 0, 74, 72, 73, 0];
      if (s % 4 === 0) {
        const m = mel[(bar * 2 + s / 4) % mel.length];
        if (m) bell(t, m + 12, 2.2, 0.045, out);
      }
    },
  },
  stage: {
    step: 0.42,
    len: 32,
    vol: 1.8,
    fade: 2.5,
    play(i, t, out) {
      const notes = [69, 72, 76, 74, 72, 71, 72, 69, 64, 68, 71, 74, 72, 71, 69, 0,
        69, 72, 76, 79, 77, 76, 74, 72, 71, 72, 74, 71, 68, 64, 69, 0];
      const n = notes[i % notes.length];
      if (n) musicBox(t, n, 0.1, out);
      if (i % 8 === 0) {
        const root = (n || 69) - 24;
        voice(t, hz(root), 2.5, { type: 'triangle', peak: 0.06, wet: 0.4 }, out);
        pad(t, [45, 52], 8 * this.step, 0.03, out, 260);
      }
    },
  },
  boss: {
    step: 0.12,
    len: 128,
    vol: 1.0,
    fade: 0.8,
    play(i, t, out) {
      const s = i % 16;
      const bar = Math.floor(i / 16) % 8;
      const roots = [40, 36, 45, 47, 40, 36, 41, 47]; // E C A B E C F B
      const qs = [MIN, MAJ, MIN, MAJ, MIN, MAJ, MAJ, MAJ];
      const r = roots[bar];
      // drums: four on the floor, snare on 2 and 4, busy hats
      if (s % 4 === 0) kick(t, 0.5, out);
      if (s === 4 || s === 12) snare(t, 0.22, out);
      if (bar % 4 === 3 && s >= 12) snare(t, 0.12 + (s - 12) * 0.03, out);
      if (s % 2 === 1) hat(t, 0.05, out);
      if (i % 64 === 0) crash(t, 0.1, out);
      // galloping bass
      const bassPat = [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 12, 0, 10, 7, 5, 3];
      voice(t, hz(r - 12 + bassPat[s]), 0.11, { type: 'sawtooth', peak: 0.1, filter: 900, filterTo: 300 }, out);
      // string stabs on the tresillo
      if (s === 0 || s === 6 || s === 12) {
        for (const m of chord(r + 12, qs[bar])) voice(t, hz(m), 0.16, { type: 'sawtooth', peak: 0.035, filter: 2400, wet: 0.3 }, out);
      }
      // harpsichord lead: a mad galop that climbs each phrase
      const lead = [
        [76, 0, 79, 76, 83, 0, 79, 76, 75, 76, 78, 79, 81, 79, 78, 76],
        [72, 0, 76, 72, 79, 0, 76, 72, 71, 72, 74, 76, 77, 76, 74, 72],
        [69, 0, 72, 69, 76, 0, 72, 69, 68, 69, 71, 72, 74, 72, 71, 69],
        [71, 75, 78, 83, 81, 78, 75, 71, 72, 71, 70, 71, 75, 78, 81, 83],
      ];
      const m = lead[bar % 4][s];
      if (m && bar >= 2) pluck(t, m + (bar >= 4 ? 12 : 0), 0.045, out);
    },
  },
  final: {
    step: 0.14,
    len: 128,
    vol: 0.9,
    fade: 1.2,
    play(i, t, out) {
      const s = i % 16;
      const bar = Math.floor(i / 16) % 8;
      const prog = [[48, MIN], [44, MAJ], [41, MIN], [43, MAJ], [48, MIN], [49, MAJ], [41, MIN], [43, MAJ]]; // Cm Ab Fm G Cm Db Fm G
      const [r, q] = prog[bar];
      const ch = chord(r, q);
      if (s === 0) {
        choir(t, ch.map((m) => m + 12), 16 * this.step * 1.02, 0.07, out);
        organ(t, ch.map((m) => m - 12), 16 * this.step * 0.98, 0.035, out);
        if (bar % 4 === 0) crash(t, 0.14, out);
      }
      // half-time war drums
      if (s === 0 || s === 10) kick(t, 0.55, out);
      if (s === 8) snare(t, 0.28, out);
      if (s === 0 || s === 6 || s === 8 || s === 14) timpani(t, r - 12 + (s === 6 ? 7 : 0), s === 8 ? 0.32 : 0.2, out);
      if (bar === 7 && s >= 8) timpani(t, r - 12, 0.1 + (s - 8) * 0.03, out);
      // pounding octave bass in 8ths
      if (s % 2 === 0) voice(t, hz(r - 12 + (s % 4 === 2 ? 12 : 0)), 0.2, { type: 'sawtooth', peak: 0.08, filter: 700, filterTo: 250 }, out);
      // the Queen's motif, tolled on bells
      const motif = [67, 0, 0, 0, 72, 0, 75, 0, 74, 0, 72, 0, 67, 0, 68, 0];
      const motif2 = [67, 0, 68, 0, 71, 0, 74, 0, 72, 0, 0, 0, 0, 0, 0, 0];
      const mm = (bar === 3 || bar === 7 ? motif2 : motif)[s];
      if (mm && bar % 2 === 0) bell(t, mm + 12, 1.6, 0.06, out);
      if (mm && bar % 2 === 1) pluck(t, mm + 12, 0.03, out);
    },
  },
  victory: {
    step: 0.28,
    len: 32,
    vol: 1.5,
    fade: 1.0,
    play(i, t, out) {
      const s = i % 8;
      const bar = Math.floor(i / 8) % 4;
      const prog = [[60, MAJ], [65, MAJ], [57, MIN], [67, MAJ]];
      const [r, q] = prog[bar];
      const ch = chord(r, q);
      if (s === 0) {
        choir(t, ch, 8 * this.step, 0.05, out);
        voice(t, hz(r - 24), 8 * this.step, { type: 'sine', peak: 0.1, attack: 0.2, sustain: true, wet: 0.3 }, out);
      }
      const arp = [0, 1, 2, 1, 0, 1, 2, 3];
      const idx = arp[s];
      bell(t, (idx === 3 ? ch[0] + 12 : ch[idx]) + 12, 1.4, 0.04, out);
    },
  },
};

// the opening fanfare when a run is won
function fanfare(out) {
  const t = ctx.currentTime + 0.05;
  const notes = [[60, 0], [64, 0.18], [67, 0.36], [72, 0.54], [72, 0.9], [76, 1.1], [79, 1.3]];
  for (const [m, d] of notes) {
    voice(t + d, hz(m), 0.9, { type: 'sawtooth', peak: 0.06, filter: 2600, wet: 0.5 }, out);
    bell(t + d, m + 12, 1.2, 0.05, out);
  }
  crash(t + 1.3, 0.15, out);
  kick(t + 1.3, 0.5, out);
}

function makeOut(vol) {
  // a dry bus and a reverb send per track; both fade together
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.connect(bus);
  const wet = ctx.createGain();
  wet.gain.value = 0.0001;
  wet.connect(verb);
  return { g, dry: g, wet, vol };
}

function ramp(param, to, now, dur) {
  param.cancelScheduledValues(now);
  param.setValueAtTime(Math.max(0.0001, param.value), now);
  param.exponentialRampToValueAtTime(Math.max(0.0001, to), now + dur);
}

function tick() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let k = live.length - 1; k >= 0; k--) {
    const inst = live[k];
    if (inst.dead && now > inst.deadAt) {
      inst.out.g.disconnect();
      inst.out.wet.disconnect();
      live.splice(k, 1);
      continue;
    }
    while (inst.next < now + 0.25) {
      if (!inst.dead || inst.next < inst.deadAt) inst.track.play(inst.i % inst.track.len, inst.next, inst.out);
      inst.i++;
      inst.next += inst.track.step;
    }
  }
}

export function initMusic(audioCtx, musicBus, noise) {
  ctx = audioCtx;
  bus = musicBus;
  noiseBuf = noise;
  verb = makeReverb();
  timer = setInterval(tick, 60);
  if (current) {
    const name = current;
    current = null;
    setMusic(name);
  }
}

// Cross-fade to a track (or silence with null). Safe to call before audio is
// unlocked: the request is remembered and starts on unlock.
export function setMusic(name) {
  if (!ctx) {
    current = name;
    return;
  }
  if (name === current) return;
  const now = ctx.currentTime;
  const nextTrack = name ? TRACKS[name] : null;
  const fade = nextTrack ? nextTrack.fade : 1.5;
  for (const inst of live) {
    if (inst.dead) continue;
    inst.dead = true;
    inst.deadAt = now + fade + 0.2;
    ramp(inst.out.g.gain, 0.0001, now, fade);
    ramp(inst.out.wet.gain, 0.0001, now, fade);
  }
  current = name;
  if (!nextTrack) return;
  const out = makeOut(nextTrack.vol);
  ramp(out.g.gain, nextTrack.vol, now, fade);
  ramp(out.wet.gain, nextTrack.vol, now, fade);
  live.push({ track: nextTrack, out, i: 0, next: now + 0.1, dead: false });
  if (name === 'victory') fanfare(out);
}

export function stopMusicTimer() {
  if (timer) clearInterval(timer);
}
