// Voices: the browser's own speech synthesis reads the dialogue aloud, one line at a time.
// Each character gets a voice, pitch and pace. Nothing is downloaded; if the browser has no
// speech engine (or the player turns voices off) the captions carry on alone.
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

// who sounds like what: a preferred kind of system voice, then pitch and rate on top of it
// Pitch stays close to 1: heavy pitch-shifting is what makes synthetic voices sound like robots.
// The character comes from picking a different natural voice for each, plus pace.
// `prefer` lists voice names to look for first (Edge/Windows "Online (Natural)" voices, Chrome's Google
// voices, macOS voices), in order.
const CAST_VOICE = {
  MACK: { want: 'male', pitch: 0.92, rate: 0.92, prefer: ['Christopher', 'Guy', 'Davis', 'Roger', 'Eric', 'Tony', 'Google UK English Male', 'Daniel', 'Alex', 'Fred'] },
  SALLY: { want: 'female', pitch: 1.06, rate: 1.08, prefer: ['Jenny', 'Ana', 'Aria', 'Michelle', 'Ava', 'Samantha', 'Google US English', 'Zira'] },
  DOTTIE: { want: 'female', pitch: 1.25, rate: 0.96, prefer: ['Ana', 'Sara', 'Michelle', 'Karen', 'Tessa', 'Google UK English Female', 'Hazel'] },
  GUS: { want: 'male', pitch: 0.95, rate: 0.95, prefer: ['Ryan', 'Thomas', 'Google UK English Male', 'George', 'Daniel', 'Oliver'] },
  PORK: { want: 'male', pitch: 0.82, rate: 0.9, prefer: ['Eric', 'Roger', 'Steffan', 'Brian', 'Fred'] },
  COP: { want: 'male', pitch: 0.95, rate: 1.05, prefer: ['Steffan', 'Brandon', 'Jason', 'Andrew'] },
  RADIO: { want: 'male', pitch: 1.0, rate: 1.12, prefer: ['Andrew', 'Brian', 'Guy', 'Google US English', 'Alex'] },
  NARR: { want: 'male', pitch: 0.9, rate: 0.9, prefer: ['Davis', 'Christopher', 'Guy', 'Roger', 'Daniel'] },
  DAME: { want: 'female', pitch: 1.0, rate: 0.94, prefer: ['Sonia', 'Libby', 'Emma', 'Aria', 'Victoria', 'Moira', 'Google UK English Female'] },
};
// how natural a system voice is likely to sound
const quality = (v) => (/natural|neural|online/i.test(v.name) ? 60 : 0) + (/premium|enhanced|siri/i.test(v.name) ? 45 : 0) + (/^google/i.test(v.name) ? 30 : 0) + (v.localService === false ? 10 : 0) + (/en-US|en-GB/i.test(v.lang) ? 5 : 0);

let voices = [];
let enabled = true, volume = 0.9;
try { enabled = localStorage.getItem('gcb-voices') !== '0'; volume = parseFloat(localStorage.getItem('gcb-voicevol') ?? '0.9'); } catch (e) { /* ignore */ }
const picked = {};

function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
  for (const k in picked) delete picked[k];
}
if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }

const FEMALE = /female|woman|zira|susan|samantha|victoria|karen|moira|tessa|fiona|serena|hazel|libby|aria|jenny|sonia|emma|ava|allison|kate|veena/i;
const MALE = /male|man|david|mark|george|daniel|alex|fred|ryan|guy|james|tom|arthur|oliver|aaron|rishi|lee|christopher|eric|roger/i;
function voiceFor(who) {
  if (picked[who] !== undefined) return picked[who];
  const c = CAST_VOICE[who] || CAST_VOICE.NARR;
  const pref = (v) => (c.prefer || []).some((n) => v.name.toLowerCase().includes(n.toLowerCase()));
  const pool = voices.filter((v) => pref(v) || (c.want === 'female' ? FEMALE.test(v.name) && !/\bmale\b/i.test(v.name) : MALE.test(v.name) && !FEMALE.test(v.name)));
  const used = new Set(Object.values(picked).filter(Boolean).map((v) => v.name));
  // score: the character's preferred names first, then the most natural-sounding, avoiding voices already cast
  const score = (v) => {
    const pi = (c.prefer || []).findIndex((n) => v.name.toLowerCase().includes(n.toLowerCase()));
    return (pi >= 0 ? 200 - pi * 8 : 0) + quality(v) - (used.has(v.name) ? 150 : 0);
  };
  const list = (pool.length ? pool : voices).slice().sort((a, b) => score(b) - score(a));
  picked[who] = list[0] || null;
  return picked[who];
}

// a short queue: if the street gets chatty, older lines are dropped rather than talked over
const queue = [];
let speaking = false;
function next() {
  if (!synth || speaking || !queue.length) return;
  const { who, text } = queue.shift();
  const c = CAST_VOICE[who] || CAST_VOICE.NARR;
  const u = new SpeechSynthesisUtterance(clean(text));
  const v = voiceFor(who);
  if (v) u.voice = v;
  u.pitch = c.pitch; u.rate = c.rate; u.volume = volume;
  u.onend = u.onerror = () => { speaking = false; setTimeout(next, 120); };
  speaking = true;
  synth.speak(u);
}
// strip stage directions and quote marks so the voice doesn't read them out
function clean(t) {
  return t.replace(/\*[^*]*\*/g, ' ').replace(/[“”"]/g, '').replace(/—/g, ', ').replace(/\s+/g, ' ').trim();
}

export const voice = {
  say(who, text, { priority = false } = {}) {
    if (!synth || !enabled || !text) return;
    if (!clean(text)) return;
    if (priority) { queue.length = 0; synth.cancel(); speaking = false; }
    queue.push({ who, text });
    while (queue.length > 2) queue.shift();
    next();
  },
  stop() { queue.length = 0; if (synth) synth.cancel(); speaking = false; },
  get busy() { return speaking || queue.length > 0; },
  get enabled() { return enabled; },
  setEnabled(on) { enabled = on; try { localStorage.setItem('gcb-voices', on ? '1' : '0'); } catch (e) { /* ignore */ } if (!on) this.stop(); },
  get volume() { return volume; },
  setVolume(v) { volume = v; try { localStorage.setItem('gcb-voicevol', String(v)); } catch (e) { /* ignore */ } },
  supported: !!synth,
};
