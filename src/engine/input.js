// Keyboard + pointer-lock mouse + touch, normalised into one action state.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered this frame
    this.mouse = { left: false, right: false };
    this.look = { dx: 0, dy: 0 };
    this.locked = false;
    this.touchMove = null;
    this.touchFire = false;
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.left = this.mouse.right = false;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.left = true;
        this.pressed.add('lmb');
      }
      if (e.button === 2) {
        this.mouse.right = true;
        this.pressed.add('rmb');
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // clamp spikes some browsers emit when locking
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
      this.look.dx += e.movementX;
      this.look.dy += e.movementY;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.mouse.left = this.mouse.right = false;
      if (this.onLockChange) this.onLockChange(this.locked);
    });

    this.setupTouch();
  }

  requestLock() {
    if (this.isTouch) return;
    try {
      const r = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (r && r.catch) r.catch(() => this.canvas.requestPointerLock());
    } catch {
      this.canvas.requestPointerLock();
    }
  }

  setupTouch() {
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!this.isTouch) return;
    const stick = document.getElementById('stick');
    const nub = document.getElementById('nub');
    let stickId = null;
    let lookId = null;
    let lx = 0;
    let ly = 0;
    const center = () => {
      const r = stick.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2, r.width / 2];
    };
    stick.addEventListener('touchstart', (e) => {
      stickId = e.changedTouches[0].identifier;
      e.preventDefault();
    });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          const [cx, cy, R] = center();
          let dx = (t.clientX - cx) / R;
          let dy = (t.clientY - cy) / R;
          const l = Math.hypot(dx, dy);
          if (l > 1) {
            dx /= l;
            dy /= l;
          }
          this.touchMove = { x: dx, y: -dy };
          nub.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
        } else if (t.identifier === lookId) {
          this.look.dx += (t.clientX - lx) * 2.2;
          this.look.dy += (t.clientY - ly) * 2.2;
          lx = t.clientX;
          ly = t.clientY;
        }
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null;
          this.touchMove = null;
          nub.style.transform = '';
        }
        if (t.identifier === lookId) lookId = null;
      }
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    this.canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (lookId === null && t.clientX > window.innerWidth * 0.35) {
          lookId = t.identifier;
          lx = t.clientX;
          ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const btn = (id, down, up) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        down();
        // allow aiming while holding fire
        const t = e.changedTouches[0];
        if (id === 't-fire' && lookId === null) {
          lookId = t.identifier;
          lx = t.clientX;
          ly = t.clientY;
        }
      });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (up) up();
      });
    };
    btn('t-fire', () => (this.touchFire = true), () => (this.touchFire = false));
    btn('t-2', () => this.pressed.add('touch2'));
    btn('t-3', () => this.pressed.add('touch3'));
    btn('t-4', () => this.pressed.add('touch4'));
    btn('t-jump', () => this.pressed.add(' '));
    btn('t-use', () => this.pressed.add('e'));
  }

  down(k) {
    return this.keys.has(k);
  }

  hit(k) {
    return this.pressed.has(k);
  }

  moveVector() {
    if (this.touchMove) return this.touchMove;
    let x = 0;
    let y = 0;
    if (this.down('a') || this.down('arrowleft')) x -= 1;
    if (this.down('d') || this.down('arrowright')) x += 1;
    if (this.down('w') || this.down('arrowup')) y += 1;
    if (this.down('s') || this.down('arrowdown')) y -= 1;
    const l = Math.hypot(x, y);
    return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
  }

  consumeLook() {
    const l = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = this.look.dy = 0;
    return l;
  }

  endFrame() {
    this.pressed.clear();
  }
}
