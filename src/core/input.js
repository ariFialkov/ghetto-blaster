// Unified input for desktop (pointer lock + keyboard) and mobile (static joystick + drag look + buttons).
export const isTouch = () => ('ontouchstart' in window || navigator.maxTouchPoints > 0) && !window.matchMedia('(pointer:fine)').matches;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mobile = isTouch();
    this.keys = new Set();
    this.move = { x: 0, y: 0 };       // -1..1 (x right, y forward)
    this.look = { dx: 0, dy: 0 };     // accumulated per frame (pixels)
    this.fire = false; this.ads = false; this.jump = false; this.crouchToggle = false; this.sprint = false;
    this.peek = 0; // -1 left, 1 right
    this.pressed = new Set(); // one-shot actions: 'jump','swap','reload','lethal','tactical','crouch','peek','score','streak1..3','loadout'
    this.locked = false;
    this.enabled = false;
    this.sensitivity = 1.0;
    this.touchSensitivity = 1.0;
    this.invertY = false;
    this.adsHold = true; // hold vs toggle
    this.crouchHold = false;
    this._bind();
  }
  _bind() {
    const c = this.canvas;
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k);
      const map = { Space: 'jump', KeyR: 'reload', KeyG: 'lethal', KeyF: 'tactical', KeyQ: 'peekL', KeyE: 'peekR', Tab: 'score', Digit1: 'w1', Digit2: 'w2', Digit3: 'streak1', Digit4: 'streak2', Digit5: 'streak3', KeyL: 'loadout', KeyC: 'crouch', ControlLeft: 'crouch', KeyV: 'swap', Escape: 'esc' };
      if (map[k]) this.pressed.add(map[k]);
      if (['Space', 'Tab', 'KeyF', 'ControlLeft'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'Tab') this.pressed.add('scoreUp'); });
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === c; if (!this.locked) this.keys.clear(); });
    c.addEventListener('mousemove', (e) => { if (!this.locked) return; this.look.dx += e.movementX; this.look.dy += e.movementY; });
    c.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.mobile) return;
      if (!this.locked) { this.requestLock(); return; }
      if (e.button === 0) this.fire = true;
      if (e.button === 2) { if (this.adsHold) this.ads = true; else this.ads = !this.ads; }
      if (e.button === 1) this.pressed.add('swap');
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.fire = false; if (e.button === 2 && this.adsHold) this.ads = false; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => { if (this.locked) this.pressed.add('swap'); }, { passive: true });
    if (this.mobile) this._bindTouch();
  }
  requestLock() { if (!this.mobile && this.canvas.requestPointerLock) { try { this.canvas.requestPointerLock(); } catch (e) { /* ignore */ } } }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  _bindTouch() {
    const joy = document.getElementById('joystick'), knob = document.getElementById('joy-knob'), look = document.getElementById('look-area');
    let joyId = null, joyCenter = null; const R = 48;
    const setKnob = (x, y) => { knob.style.transform = `translate(${x}px, ${y}px)`; };
    joy.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]; joyId = t.identifier; const r = joy.getBoundingClientRect(); joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      e.preventDefault();
    }, { passive: false });
    const joyMove = (e) => {
      for (const t of e.changedTouches) if (t.identifier === joyId) {
        let dx = t.clientX - joyCenter.x, dy = t.clientY - joyCenter.y; const d = Math.hypot(dx, dy);
        if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
        setKnob(dx, dy); this.move.x = dx / R; this.move.y = -dy / R;
        this.sprint = d > R * 0.92 && Math.abs(this.move.y) > 0.5;
        e.preventDefault();
      }
    };
    const joyEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; this.move.x = 0; this.move.y = 0; this.sprint = false; setKnob(0, 0); } };
    joy.addEventListener('touchmove', joyMove, { passive: false }); joy.addEventListener('touchend', joyEnd); joy.addEventListener('touchcancel', joyEnd);

    let lookId = null, lx = 0, ly = 0;
    look.addEventListener('touchstart', (e) => { if (lookId !== null) return; const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; }, { passive: true });
    look.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) { this.look.dx += (t.clientX - lx) * 2.2; this.look.dy += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY; } }, { passive: true });
    const lookEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
    look.addEventListener('touchend', lookEnd); look.addEventListener('touchcancel', lookEnd);

    const hold = (id, on, off) => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); el.classList.add('active'); on(); }, { passive: false });
      const end = (e) => { e.preventDefault(); el.classList.remove('active'); off && off(); };
      el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    };
    // fire button also allows drag-look while held
    const fireEl = document.getElementById('m-fire');
    let fx = 0, fy = 0, fid = null;
    fireEl.addEventListener('touchstart', (e) => { e.preventDefault(); this.fire = true; fireEl.classList.add('active'); const t = e.changedTouches[0]; fid = t.identifier; fx = t.clientX; fy = t.clientY; }, { passive: false });
    fireEl.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === fid) { this.look.dx += (t.clientX - fx) * 2.2; this.look.dy += (t.clientY - fy) * 2.2; fx = t.clientX; fy = t.clientY; } }, { passive: true });
    const fend = (e) => { e.preventDefault(); this.fire = false; fid = null; fireEl.classList.remove('active'); };
    fireEl.addEventListener('touchend', fend); fireEl.addEventListener('touchcancel', fend);

    hold('m-ads', () => { this.ads = !this.ads; }, null);
    hold('m-jump', () => this.pressed.add('jump'), null);
    hold('m-crouch', () => this.pressed.add('crouch'), null);
    hold('m-peek', () => { this.pressed.add('peekR'); }, null);
    hold('m-swap', () => this.pressed.add('swap'), null);
    hold('m-reload', () => this.pressed.add('reload'), null);
    hold('m-lethal', () => this.pressed.add('lethal'), null);
    hold('m-tactical', () => this.pressed.add('tactical'), null);
    hold('m-sprint', () => { this.sprintLatch = true; }, () => { this.sprintLatch = false; });
    hold('m-score', () => this.pressed.add('score'), () => this.pressed.add('scoreUp'));
  }
  // call once per frame; returns a snapshot and clears one-shots
  poll() {
    if (!this.mobile) {
      const k = this.keys;
      this.move.x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      this.move.y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      this.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
      this.peek = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
      if (this.crouchHold) this.crouchDown = k.has('KeyC') || k.has('ControlLeft');
      if (k.has('Space')) this.jumpHeld = true; else this.jumpHeld = false;
    } else {
      if (this.sprintLatch) this.sprint = true;
    }
    const snap = {
      move: { x: this.move.x, y: this.move.y },
      look: { dx: this.look.dx * this.sensitivity * (this.mobile ? this.touchSensitivity : 1), dy: this.look.dy * this.sensitivity * (this.mobile ? this.touchSensitivity : 1) * (this.invertY ? -1 : 1) },
      fire: this.fire, ads: this.ads, sprint: this.sprint, peek: this.peek, jumpHeld: this.jumpHeld,
      pressed: new Set(this.pressed),
    };
    this.look.dx = 0; this.look.dy = 0; this.pressed.clear();
    return snap;
  }
  setEnabled(on) { this.enabled = on; if (!on) { this.fire = false; this.ads = false; this.keys.clear(); this.move.x = 0; this.move.y = 0; } }
}
