// Speaker portraits: little painted noir busts, drawn once per character onto a canvas and cached.
// Everyone's grey except what the city lets keep its color: Sally's red and gold, the radio's dial.
const cache = new Map();

function bg(g, S, tint = '#3a3c40') {
  const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, tint); gr.addColorStop(1, '#0b0b0c');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  // venetian-blind light across the back wall
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 10; y < S * 0.6; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y - 30); g.lineTo(S, y - 24); g.lineTo(0, y + 6); g.fill(); }
}
const ell = (g, x, y, rx, ry, c, rot = 0) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fill(); };
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
function eyes(g, x, y, sp, { lash = false, glint = true, lid = 0 } = {}) {
  for (const s of [-1, 1]) {
    ell(g, x + s * sp, y, 9, 5.5, '#e8e2d6');
    ell(g, x + s * sp, y + 0.5, 4.5, 5, '#141414');
    if (glint) ell(g, x + s * sp - 1.5, y - 1.5, 1.4, 1.4, '#fff');
    if (lid) rect(g, x + s * sp - 10, y - 7, 20, lid, '#9a8f84');
    if (lash) { g.strokeStyle = '#111'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + s * sp - 10 * s, y - 2); g.quadraticCurveTo(x + s * sp, y - 9, x + s * sp + 11 * s, y - 5); g.stroke(); }
  }
}

const PAINT = {
  MACK(g, S) {
    bg(g, S);
    // trench coat shoulders, collar up, lapels, tie
    g.fillStyle = '#6d665d'; g.beginPath(); g.moveTo(8, S); g.lineTo(34, S * 0.7); g.lineTo(S - 34, S * 0.7); g.lineTo(S - 8, S); g.fill();
    g.fillStyle = '#4a443c'; g.beginPath(); g.moveTo(52, S * 0.7); g.lineTo(S / 2, S * 0.97); g.lineTo(S - 52, S * 0.7); g.lineTo(S - 46, S * 0.62); g.lineTo(S / 2, S * 0.78); g.lineTo(46, S * 0.62); g.fill();
    rect(g, S / 2 - 12, S * 0.72, 24, S * 0.28, '#d8d2c6');
    g.fillStyle = '#1c1c1e'; g.beginPath(); g.moveTo(S / 2 - 7, S * 0.73); g.lineTo(S / 2 + 7, S * 0.73); g.lineTo(S / 2 + 10, S); g.lineTo(S / 2 - 10, S); g.fill();
    // face: square jaw, stubble, a crease of a frown
    ell(g, S / 2, S * 0.48, 34, 42, '#c4b8ac');
    g.fillStyle = 'rgba(70,64,58,0.55)'; g.beginPath(); g.ellipse(S / 2, S * 0.6, 31, 20, 0, 0, Math.PI); g.fill();
    eyes(g, S / 2, S * 0.45, 15, { lid: 4 });
    rect(g, S / 2 - 24, S * 0.39, 18, 4, '#141414'); rect(g, S / 2 + 6, S * 0.39, 18, 4, '#141414');
    rect(g, S / 2 - 3, S * 0.47, 6, 14, '#a99c90');
    rect(g, S / 2 - 12, S * 0.6, 24, 3, '#5a4a44');
    // cigarette and its smoke
    rect(g, S / 2 + 10, S * 0.59, 22, 4, '#f4f0e8'); rect(g, S / 2 + 30, S * 0.59, 3, 4, '#ff5a1f');
    g.strokeStyle = 'rgba(220,220,220,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(S / 2 + 33, S * 0.58); g.bezierCurveTo(S / 2 + 45, S * 0.45, S / 2 + 30, S * 0.35, S / 2 + 46, S * 0.2); g.stroke();
    // fedora: brim pulled low, hat band, the shadow it throws on his eyes
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(S / 2 - 36, S * 0.36, 72, 14);
    ell(g, S / 2, S * 0.34, 64, 11, '#1d1c1a');
    g.fillStyle = '#2b2926'; g.beginPath(); g.moveTo(S / 2 - 38, S * 0.34); g.lineTo(S / 2 - 32, S * 0.12); g.quadraticCurveTo(S / 2, S * 0.05, S / 2 + 32, S * 0.12); g.lineTo(S / 2 + 38, S * 0.34); g.fill();
    rect(g, S / 2 - 37, S * 0.27, 74, 9, '#0e0e0e');
  },
  SALLY(g, S) {
    bg(g, S, '#3a2e30');
    // red dress, shoulders bare, opera gloves at the edges
    g.fillStyle = '#d0102a'; g.beginPath(); g.moveTo(18, S); g.quadraticCurveTo(S / 2, S * 0.7, S - 18, S); g.fill();
    ell(g, S / 2 - 44, S * 0.86, 22, 12, '#d8cfc6'); ell(g, S / 2 + 44, S * 0.86, 22, 12, '#d8cfc6');
    // hair behind
    ell(g, S / 2, S * 0.46, 50, 50, '#c99a2e');
    // face
    ell(g, S / 2, S * 0.5, 30, 37, '#dcd3ca');
    eyes(g, S / 2, S * 0.48, 13, { lash: true });
    g.strokeStyle = '#8a6a2a'; g.lineWidth = 2.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(S / 2 + s * 6, S * 0.42); g.quadraticCurveTo(S / 2 + s * 14, S * 0.39, S / 2 + s * 22, S * 0.42); g.stroke(); }
    rect(g, S / 2 - 2, S * 0.5, 4, 9, '#c4b8ac');
    ell(g, S / 2, S * 0.615, 9, 4.5, '#d0102a'); ell(g, S / 2, S * 0.607, 9, 2, '#a00c20');
    ell(g, S / 2 - 18, S * 0.56, 6, 3.5, 'rgba(220,60,80,0.35)'); ell(g, S / 2 + 18, S * 0.56, 6, 3.5, 'rgba(220,60,80,0.35)');
    // golden bob: crown, flipped curls at the jaw, swept bangs, a red flower
    g.fillStyle = '#e2b64a'; g.beginPath(); g.ellipse(S / 2, S * 0.36, 44, 30, 0, Math.PI, 0); g.fill();
    ell(g, S / 2 - 40, S * 0.56, 14, 22, '#e2b64a'); ell(g, S / 2 + 40, S * 0.56, 14, 22, '#e2b64a');
    ell(g, S / 2 - 44, S * 0.66, 12, 8, '#e2b64a', -0.4); ell(g, S / 2 + 44, S * 0.66, 12, 8, '#e2b64a', 0.4);
    g.fillStyle = '#efc85e'; g.beginPath(); g.moveTo(S / 2 - 34, S * 0.38); g.quadraticCurveTo(S / 2 - 6, S * 0.25, S / 2 + 34, S * 0.4); g.quadraticCurveTo(S / 2, S * 0.33, S / 2 - 34, S * 0.38); g.fill();
    ell(g, S / 2 + 30, S * 0.26, 10, 10, '#d0102a'); ell(g, S / 2 + 30, S * 0.26, 4, 4, '#7a0814');
    ell(g, S / 2 - 34, S * 0.62, 4, 4, '#d0102a'); ell(g, S / 2 + 34, S * 0.62, 4, 4, '#d0102a');
  },
  DOTTIE(g, S) {
    bg(g, S, '#2a3038');
    // a tin can of a receptionist: riveted head, two lamp eyes, a speaker grille, a martini
    rect(g, S / 2 - 46, S * 0.24, 92, 86, '#9a9c9e'); rect(g, S / 2 - 46, S * 0.24, 92, 8, '#b8babc');
    for (let x = -40; x <= 40; x += 16) { ell(g, S / 2 + x, S * 0.28, 2.5, 2.5, '#6a6c6e'); ell(g, S / 2 + x, S * 0.24 + 82, 2.5, 2.5, '#6a6c6e'); }
    for (const s of [-1, 1]) { ell(g, S / 2 + s * 22, S * 0.43, 15, 15, '#2a2a2a'); ell(g, S / 2 + s * 22, S * 0.43, 10, 10, '#e8f0ff'); ell(g, S / 2 + s * 22, S * 0.43, 16, 16, 'rgba(200,220,255,0.25)'); }
    rect(g, S / 2 - 22, S * 0.53, 44, 14, '#3a3a3a'); for (let x = -18; x < 22; x += 6) rect(g, S / 2 + x, S * 0.535, 2, 12, '#8a8a8a');
    rect(g, S / 2 - 2, S * 0.12, 4, 22, '#6a6c6e'); ell(g, S / 2, S * 0.12, 6, 6, '#ff3a3a');
    rect(g, S / 2 - 30, S * 0.7, 60, S * 0.3, '#7a7c7e');
    g.strokeStyle = '#ddd'; g.lineWidth = 2; g.beginPath(); g.moveTo(S - 60, S * 0.7); g.lineTo(S - 34, S * 0.7); g.lineTo(S - 47, S * 0.8); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(S - 47, S * 0.8); g.lineTo(S - 47, S * 0.9); g.stroke();
    ell(g, S - 50, S * 0.72, 3, 3, '#6a9a3a');
  },
  GUS(g, S) {
    bg(g, S, '#3a3228');
    g.fillStyle = '#e8e4dc'; g.beginPath(); g.moveTo(20, S); g.lineTo(44, S * 0.72); g.lineTo(S - 44, S * 0.72); g.lineTo(S - 20, S); g.fill();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(44, S); g.lineTo(60, S * 0.76); g.lineTo(S / 2, S * 0.92); g.lineTo(S - 60, S * 0.76); g.lineTo(S - 44, S); g.fill(); // vest
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(S / 2 - 16, S * 0.7); g.lineTo(S / 2, S * 0.75); g.lineTo(S / 2 - 16, S * 0.8); g.fill(); g.beginPath(); g.moveTo(S / 2 + 16, S * 0.7); g.lineTo(S / 2, S * 0.75); g.lineTo(S / 2 + 16, S * 0.8); g.fill(); // bow tie
    ell(g, S / 2, S * 0.45, 36, 42, '#c4b8ac');
    ell(g, S / 2, S * 0.3, 30, 14, '#d4c8bc'); // the shine on top
    eyes(g, S / 2, S * 0.44, 14, { lid: 3 });
    rect(g, S / 2 - 3, S * 0.45, 6, 14, '#a99c90');
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.moveTo(S / 2 - 28, S * 0.6); g.quadraticCurveTo(S / 2, S * 0.5, S / 2 + 28, S * 0.6); g.quadraticCurveTo(S / 2, S * 0.56, S / 2 - 28, S * 0.6); g.fill(); // handlebar mustache
    ell(g, S / 2 - 36, S * 0.45, 7, 11, '#b8ac9e'); ell(g, S / 2 + 36, S * 0.45, 7, 11, '#b8ac9e');
  },
  PORK(g, S) {
    bg(g, S, '#2a2e36');
    g.fillStyle = '#2a3040'; g.beginPath(); g.moveTo(0, S); g.lineTo(26, S * 0.68); g.lineTo(S - 26, S * 0.68); g.lineTo(S, S); g.fill();
    ell(g, S / 2 + 30, S * 0.82, 10, 10, '#d8c060'); // badge
    ell(g, S / 2, S * 0.5, 46, 44, '#c4b8ac'); // a big round face
    ell(g, S / 2, S * 0.64, 38, 16, '#b8ac9e'); // jowls
    eyes(g, S / 2, S * 0.47, 15, { lid: 3 });
    ell(g, S / 2, S * 0.55, 9, 7, '#d0b8b0'); ell(g, S / 2 - 3, S * 0.555, 2, 2.5, '#5a4a44'); ell(g, S / 2 + 3, S * 0.555, 2, 2.5, '#5a4a44'); // snout of a nose
    // a cruller, mid-chew
    ell(g, S / 2 + 18, S * 0.66, 18, 10, '#ff6fb5'); ell(g, S / 2 + 18, S * 0.66, 6, 3, '#c4b8ac');
    // cap
    g.fillStyle = '#1e2230'; g.beginPath(); g.moveTo(S / 2 - 48, S * 0.32); g.lineTo(S / 2 - 40, S * 0.14); g.lineTo(S / 2 + 40, S * 0.14); g.lineTo(S / 2 + 48, S * 0.32); g.fill();
    ell(g, S / 2, S * 0.33, 56, 8, '#0e1018'); ell(g, S / 2, S * 0.22, 8, 8, '#d8c060');
  },
  COP(g, S) {
    bg(g, S, '#2a2e36');
    g.fillStyle = '#2a3040'; g.beginPath(); g.moveTo(10, S); g.lineTo(36, S * 0.7); g.lineTo(S - 36, S * 0.7); g.lineTo(S - 10, S); g.fill();
    ell(g, S / 2, S * 0.5, 32, 38, '#c4b8ac');
    eyes(g, S / 2, S * 0.48, 13);
    rect(g, S / 2 - 12, S * 0.62, 24, 3, '#5a4a44');
    g.fillStyle = '#1e2230'; g.beginPath(); g.moveTo(S / 2 - 38, S * 0.34); g.lineTo(S / 2 - 32, S * 0.16); g.lineTo(S / 2 + 32, S * 0.16); g.lineTo(S / 2 + 38, S * 0.34); g.fill();
    ell(g, S / 2, S * 0.35, 46, 7, '#0e1018'); ell(g, S / 2, S * 0.24, 7, 7, '#d8c060');
  },
  RADIO(g, S) {
    bg(g, S, '#2e2418');
    // a cathedral radio: wooden arch, cloth grille, a glowing dial
    g.fillStyle = '#4a3420'; g.beginPath(); g.moveTo(S * 0.2, S * 0.92); g.lineTo(S * 0.2, S * 0.4); g.quadraticCurveTo(S / 2, S * 0.02, S * 0.8, S * 0.4); g.lineTo(S * 0.8, S * 0.92); g.fill();
    g.fillStyle = '#2a2016'; g.beginPath(); g.moveTo(S * 0.28, S * 0.62); g.lineTo(S * 0.28, S * 0.42); g.quadraticCurveTo(S / 2, S * 0.14, S * 0.72, S * 0.42); g.lineTo(S * 0.72, S * 0.62); g.fill();
    g.strokeStyle = '#6a5034'; g.lineWidth = 3; for (let x = S * 0.34; x < S * 0.7; x += 10) { g.beginPath(); g.moveTo(x, S * 0.6); g.lineTo(x, S * 0.3); g.stroke(); }
    ell(g, S / 2, S * 0.74, 22, 12, '#e8c070'); ell(g, S / 2, S * 0.74, 30, 18, 'rgba(255,200,100,0.25)');
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(S / 2, S * 0.74); g.lineTo(S / 2 + 12, S * 0.69); g.stroke();
    ell(g, S * 0.32, S * 0.84, 7, 7, '#2a2016'); ell(g, S * 0.68, S * 0.84, 7, 7, '#2a2016');
  },
  DAME(g, S, d = {}) {
    bg(g, S, '#34302e');
    const shade = '#' + ((d.shade ?? 0x2a2a2e) >>> 0).toString(16).padStart(6, '0');
    g.fillStyle = shade; g.beginPath(); g.moveTo(16, S); g.quadraticCurveTo(S / 2, S * 0.68, S - 16, S); g.fill();
    if (d.fur) { g.fillStyle = '#d8d2c6'; for (let k = 0; k < 14; k++) ell(g, 30 + k * 14, S * 0.8 + Math.sin(k) * 4, 12, 10, '#d8d2c6'); }
    ell(g, S / 2, S * 0.48, 44, 46, '#1e1c1a'); // dark hair
    ell(g, S / 2, S * 0.5, 29, 36, '#d8cfc6');
    eyes(g, S / 2, S * 0.48, 12, { lash: true, lid: 2 });
    rect(g, S / 2 - 2, S * 0.5, 4, 9, '#c4b8ac');
    ell(g, S / 2, S * 0.615, 8, 3.5, '#4a3a3a');
    ell(g, S / 2 + 20, S * 0.4, 4, 4, 'rgba(0,0,0,0.6)'); // a beauty mark under the brim's shadow
    // the hat
    const hat = d.hat || 'cloche';
    g.fillStyle = '#111';
    if (hat === 'wide') { ell(g, S / 2 - 6, S * 0.3, 74, 14, '#111', -0.12); ell(g, S / 2, S * 0.24, 34, 16, '#161616'); }
    else if (hat === 'beret') { ell(g, S / 2 + 8, S * 0.25, 42, 16, '#161616', 0.2); }
    else if (hat === 'veil') { ell(g, S / 2, S * 0.24, 30, 12, '#161616'); g.fillStyle = 'rgba(10,10,10,0.45)'; g.fillRect(S / 2 - 34, S * 0.26, 68, 40); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; for (let x = -34; x < 34; x += 6) { g.beginPath(); g.moveTo(S / 2 + x, S * 0.26); g.lineTo(S / 2 + x, S * 0.42); g.stroke(); } }
    else { g.beginPath(); g.ellipse(S / 2, S * 0.33, 40, 30, 0, Math.PI, 0); g.fill(); ell(g, S / 2, S * 0.33, 44, 6, '#0a0a0a'); }
  },
};

// A canvas with this speaker's portrait, or null for the narrator (no face for the voice of the city)
export function portrait(who, dame) {
  if (!PAINT[who]) return null;
  const key = who === 'DAME' ? `DAME:${dame ? dame.name : ''}` : who;
  if (cache.has(key)) return cache.get(key);
  const S = 160, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  PAINT[who](g, S, dame || {});
  // a film-grain pass so it sits with the rest of the picture
  const id = g.getImageData(0, 0, S, S);
  for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 18; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
  g.putImageData(id, 0, 0);
  cache.set(key, c);
  return c;
}

const urls = new Map();
export function portraitURL(who, dame) {
  const c = portrait(who, dame);
  if (!c) return null;
  if (!urls.has(c)) urls.set(c, c.toDataURL());
  return urls.get(c);
}
