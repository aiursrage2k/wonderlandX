// "Down the rabbit hole": a falling tunnel of cards, clocks, keys and hats,
// with a title card for the next depth and a recap of the one just cleared.

import { TAU } from '../engine/util.js';

const QUOTES = {
  'The Hollow Tea Garden': '“Begin at the beginning,” the King said, gravely.',
  'The Mad Hatter’s Clockworks': '“If you knew Time as well as I do, you wouldn’t talk about wasting it.”',
  'The Crimson Throne': '“Sentence first — verdict afterwards.”',
  'The Weeping Rosewood': '“Who has been painting my roses red?”',
  "The Queen's Croquet Grounds": '“Off with their heads!” — and the game went on.',
  'The Pool of Tears': '“I wish I hadn’t cried so much!”',
};

const $ = (id) => document.getElementById(id);

// Things tumbling past as you fall.
function makeFaller(W, H) {
  const kinds = ['card', 'card', 'clock', 'key', 'hat', 'cup'];
  return {
    kind: kinds[Math.floor(Math.random() * kinds.length)],
    a: Math.random() * TAU,
    r: 0.15 + Math.random() * 0.85,
    z: 1 + Math.random() * 9,
    spin: (Math.random() - 0.5) * 6,
    rot: Math.random() * TAU,
    red: Math.random() < 0.6,
    W,
    H,
  };
}

function drawFaller(x, f, cx, cy, scale) {
  const k = 1 / f.z;
  const px = cx + Math.cos(f.a) * f.r * scale * 1.6 * k * 3;
  const py = cy + Math.sin(f.a) * f.r * scale * 1.6 * k * 3;
  const s = 28 * k * 3;
  if (s < 1) return;
  x.save();
  x.translate(px, py);
  x.rotate(f.rot);
  x.globalAlpha = Math.min(1, (10 - f.z) / 4) * Math.min(1, f.z / 0.6);
  switch (f.kind) {
    case 'card':
      x.fillStyle = '#efe6d4';
      x.fillRect(-s * 0.35, -s * 0.5, s * 0.7, s);
      x.fillStyle = f.red ? '#b0101e' : '#15101a';
      x.font = `${s * 0.55}px serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(f.red ? '♥' : '♠', 0, 0);
      break;
    case 'clock':
      x.fillStyle = '#c9a04a';
      x.beginPath();
      x.arc(0, 0, s * 0.45, 0, TAU);
      x.fill();
      x.fillStyle = '#efe4c8';
      x.beginPath();
      x.arc(0, 0, s * 0.38, 0, TAU);
      x.fill();
      x.strokeStyle = '#1a0e06';
      x.lineWidth = Math.max(1, s * 0.05);
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(0, -s * 0.3);
      x.moveTo(0, 0);
      x.lineTo(s * 0.2, s * 0.08);
      x.stroke();
      break;
    case 'key':
      x.strokeStyle = '#d8b060';
      x.lineWidth = Math.max(1, s * 0.09);
      x.beginPath();
      x.arc(-s * 0.3, 0, s * 0.16, 0, TAU);
      x.moveTo(-s * 0.14, 0);
      x.lineTo(s * 0.45, 0);
      x.moveTo(s * 0.3, 0);
      x.lineTo(s * 0.3, s * 0.15);
      x.moveTo(s * 0.42, 0);
      x.lineTo(s * 0.42, s * 0.12);
      x.stroke();
      break;
    case 'hat':
      x.fillStyle = '#1c1018';
      x.fillRect(-s * 0.25, -s * 0.45, s * 0.5, s * 0.5);
      x.fillRect(-s * 0.45, 0, s * 0.9, s * 0.1);
      x.fillStyle = '#8a1020';
      x.fillRect(-s * 0.25, -s * 0.12, s * 0.5, s * 0.1);
      break;
    case 'cup':
      x.fillStyle = '#f2ece2';
      x.beginPath();
      x.moveTo(-s * 0.35, -s * 0.2);
      x.lineTo(s * 0.35, -s * 0.2);
      x.lineTo(s * 0.22, s * 0.25);
      x.lineTo(-s * 0.22, s * 0.25);
      x.fill();
      x.strokeStyle = '#f2ece2';
      x.lineWidth = Math.max(1, s * 0.07);
      x.beginPath();
      x.arc(s * 0.38, 0, s * 0.12, -1.2, 1.2);
      x.stroke();
      break;
  }
  x.restore();
}

export class Transition {
  constructor() {
    this.el = $('transition');
    this.canvas = $('tunnel');
    this.ctx = this.canvas.getContext('2d');
    this.active = false;
  }

  // Plays the fall. `mid` runs once the screen is fully covered (load the
  // next stage there); resolves when the card has faded away.
  play({ depth, name, recap, hold = 2.6 }, mid) {
    if (this.skip || new URLSearchParams(location.search).has('notransition')) {
      if (mid) mid();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const el = this.el;
      const W = (this.canvas.width = Math.min(1600, window.innerWidth));
      const H = (this.canvas.height = Math.round((W / window.innerWidth) * window.innerHeight));
      const fallers = Array.from({ length: 70 }, () => makeFaller(W, H));
      $('t-depth').textContent = `Depth ${String(depth).padStart(2, '0')}`;
      $('t-name').textContent = name;
      $('t-quote').textContent = QUOTES[name] || '';
      $('t-recap').innerHTML = recap || '';
      $('t-recap').classList.toggle('hidden', !recap);
      el.classList.remove('hidden', 'show-card', 'fade-out');
      el.style.opacity = 0;
      const card = el.querySelector('.tcard');
      card.style.opacity = 0;
      this.active = true;
      // the timeline advances in capped steps, so a stalled frame (a heavy
      // stage load, a slow machine) pauses the animation rather than skipping it
      let t = 0;
      let midDone = false;
      let last = performance.now();
      const total = 0.7 + hold + 0.9;
      const frame = () => {
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        t += dt;
        const x = this.ctx;
        const cx = W / 2;
        const cy = H / 2;
        // the well: dark violet radial with spinning rings
        const bg = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
        bg.addColorStop(0, '#000000');
        bg.addColorStop(0.25, '#12061e');
        bg.addColorStop(0.7, '#2a0c3a');
        bg.addColorStop(1, '#07030b');
        x.fillStyle = bg;
        x.fillRect(0, 0, W, H);
        for (let i = 0; i < 14; i++) {
          const z = ((i / 14 + t * 0.45) % 1);
          const r = (1 - z) ** 2.2 * Math.max(W, H) * 0.9 + 6;
          x.strokeStyle = `rgba(${150 + i * 6},${60 + i * 4},${220},${0.08 + (1 - z) * 0.18})`;
          x.lineWidth = 2 + (1 - z) * 10;
          x.beginPath();
          x.ellipse(cx, cy, r, r * 0.82, t * 0.6 + i * 0.4, 0, TAU);
          x.stroke();
        }
        // tumbling debris rushing past
        for (const f of fallers) {
          f.z -= dt * 6 * (1 + t * 0.4);
          f.rot += f.spin * dt;
          f.a += dt * 0.25;
          if (f.z < 0.15) Object.assign(f, makeFaller(W, H), { z: 9 + Math.random() });
          drawFaller(x, f, cx, cy, Math.min(W, H) * 0.5);
        }
        // swap the world while nothing can see it
        if (!midDone && t > 0.7) {
          midDone = true;
          el.classList.add('show-card');
          if (mid) mid();
          last = performance.now(); // don't count the load itself
        }
        // fades driven by the same timeline (CSS transitions can starve on slow machines)
        const fadeIn = Math.min(1, t / 0.5);
        const fadeOut = t > 0.7 + hold ? Math.max(0, 1 - (t - 0.7 - hold) / 0.9) : 1;
        el.style.opacity = Math.min(fadeIn, fadeOut);
        card.style.opacity = Math.max(0, Math.min(1, (t - 0.75) / 0.7));
        card.style.transform = `scale(${0.94 + 0.06 * Math.min(1, Math.max(0, (t - 0.75) / 1.2))})`;
        if (t < total) requestAnimationFrame(frame);
        else {
          el.classList.add('hidden');
          el.classList.remove('show-card', 'fade-out');
          this.active = false;
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }
}
