// Voices: the browser's own speech synthesis reads the dialogue aloud, one line at a time.
// Each character gets a voice, pitch and pace. Nothing is downloaded; if the browser has no
// speech engine (or the player turns voices off) the captions carry on alone.
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

// who sounds like what: a preferred kind of system voice, then pitch and rate on top of it
const CAST_VOICE = {
  MACK: { want: 'male', pitch: 0.62, rate: 0.9 },
  SALLY: { want: 'female', pitch: 1.35, rate: 1.12 },
  DOTTIE: { want: 'female', pitch: 1.75, rate: 0.95 },
  GUS: { want: 'male', pitch: 0.8, rate: 0.95 },
  PORK: { want: 'male', pitch: 0.5, rate: 0.85 },
  COP: { want: 'male', pitch: 0.75, rate: 1.05 },
  RADIO: { want: 'male', pitch: 1.05, rate: 1.18 },
  NARR: { want: 'male', pitch: 0.7, rate: 0.88 },
  DAME: { want: 'female', pitch: 1.0, rate: 0.95 },
};

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
  const pool = voices.filter((v) => (c.want === 'female' ? FEMALE.test(v.name) && !/\bmale\b/i.test(v.name) : MALE.test(v.name) && !FEMALE.test(v.name)));
  // prefer American / British English, and spread different characters across different voices
  const list = (pool.length ? pool : voices).slice().sort((a, b) => (/US|GB/.test(b.lang) ? 1 : 0) - (/US|GB/.test(a.lang) ? 1 : 0));
  const used = new Set(Object.values(picked).filter(Boolean).map((v) => v.name));
  picked[who] = list.find((v) => !used.has(v.name)) || list[0] || null;
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
