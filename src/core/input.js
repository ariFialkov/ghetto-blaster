// Unified input for desktop (pointer lock + keyboard), mobile (static joystick + drag look + buttons)
// and game controllers (PS5 / Xbox via the Gamepad API, standard mapping).
//
// Standard mapping indices: 0 A/✕  1 B/○  2 X/□  3 Y/△  4 LB/L1  5 RB/R1  6 LT/L2  7 RT/R2
// 8 View/Create  9 Menu/Options  10 LS/L3  11 RS/R3  12 Up  13 Down  14 Left  15 Right
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
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
    // gamepad state
    this.pad = null; this.padType = 'xbox'; this.padActive = false;
    this.padPrev = []; this.padValues = []; this.padJust = new Set(); this.padReleased = new Set(); this.padAxes = [0, 0, 0, 0];
    this.padLook = { dx: 0, dy: 0 }; this.padSprint = false; this.padAds = false; this.padTurnT = 0;
    this.padSensitivity = 1.0; this.vibration = true; this.menuActive = false;
    // split screen (desktop): null, or { mode: 'kbd' | 'pad1' | 'pad2', p1, p2 } — see splitAssignment()
    this.split = null; this.pressed2 = new Set(); this.keys2Released = new Set();
    this.menuKeys = []; // key presses, in order, for the split-screen pause menus (captured even while gameplay input is off)
    window.addEventListener('keydown', (e) => { if (!e.repeat && this.menuKeys.length < 32) this.menuKeys.push(e.code); });
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
      const kbd2 = this.split && this.split.mode === 'kbd';
      if (kbd2 && P2_KEYS[k]) { this.pressed2.add(P2_KEYS[k]); e.preventDefault(); } // player 2's keys belong to player 2
      else if (map[k]) this.pressed.add(map[k]);
      if (['Space', 'Tab', 'KeyF', 'ControlLeft'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'Tab') this.pressed.add('scoreUp'); if (e.code === 'Digit0' && this.split && this.split.mode === 'kbd') this.pressed2.add('scoreUp'); });
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
    // switching back to mouse / keyboard / touch hands control back from the controller
    window.addEventListener('mousemove', (e) => { if (this.padActive && Math.abs(e.movementX) + Math.abs(e.movementY) > 6) this._setPadActive(false); });
    window.addEventListener('mousedown', () => { if (this.padActive) this._setPadActive(false); });
    window.addEventListener('keydown', () => { if (this.padActive) this._setPadActive(false); });
    window.addEventListener('touchstart', () => { if (this.padActive) this._setPadActive(false); }, { passive: true });
  }
  _setPadActive(on) {
    if (this.padActive === on) return;
    this.padActive = on;
    document.body.classList.toggle('gamepad', on);
    document.body.classList.toggle('pad-ps', on && this.padType === 'ps');
    if (!on) { this.padSprint = false; this.padAds = false; this.padLook.dx = 0; this.padLook.dy = 0; }
    window.dispatchEvent(new CustomEvent('padchange'));
  }
  /** Read the controller once per frame (before the match polls). Computes button edges and stick look. */
  updatePad(dt) {
    this.padJust.clear(); this.padReleased.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    if (this.split && this.split.mode === 'pad2' && pads[this.split.p1] && pads[this.split.p1].connected) gp = pads[this.split.p1]; // split: player 1's own controller
    else for (const p of pads) if (p && p.connected && (!gp || p.timestamp > gp.timestamp)) gp = p;
    this.pad = gp;
    if (this.second) this.second.update(dt);
    if (!gp) { if (this.padActive) this._setPadActive(false); this.padPrev = []; return; }
    const type = /054c|dualsense|dualshock|playstation|ps5|ps4/i.test(gp.id) ? 'ps' : 'xbox';
    if (type !== this.padType) { this.padType = type; if (this.padActive) { document.body.classList.toggle('pad-ps', type === 'ps'); window.dispatchEvent(new CustomEvent('padchange')); } }
    const values = gp.buttons.map((b) => (typeof b === 'object' ? b.value : b));
    const down = gp.buttons.map((b, i) => (typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5) && !((i === 6 || i === 7) && values[i] < 0.25));
    for (let i = 0; i < down.length; i++) { if (down[i] && !this.padPrev[i]) this.padJust.add(i); if (!down[i] && this.padPrev[i]) this.padReleased.add(i); }
    this.padPrev = down; this.padValues = values;
    const ax = gp.axes; this.padAxes = [ax[0] || 0, ax[1] || 0, ax[2] || 0, ax[3] || 0];
    const sticks = Math.hypot(this.padAxes[0], this.padAxes[1]) > 0.35 || Math.hypot(this.padAxes[2], this.padAxes[3]) > 0.35;
    if (!this.padActive && (this.padJust.size || sticks || (values[6] || 0) > 0.3 || (values[7] || 0) > 0.3)) this._setPadActive(true);
    // right stick look: radial deadzone, exponential response curve, turn boost at full deflection
    if (!this.enabled || this.menuActive || !this.padActive) { this.padLook.dx = 0; this.padLook.dy = 0; this.padTurnT = 0; return; }
    const rx = this.padAxes[2], ry = this.padAxes[3], len = Math.hypot(rx, ry), dz = 0.12;
    if (len > dz) {
      const m = Math.min(1, (len - dz) / (1 - dz)), curve = Math.pow(m, 1.9);
      if (m > 0.93) this.padTurnT = Math.min(0.5, this.padTurnT + dt); else this.padTurnT = 0;
      const boost = 1 + (Math.max(0, this.padTurnT - 0.12) / 0.38) * 0.7;
      const rate = 3.4 * this.padSensitivity * curve * boost; // radians per second
      this.padLook.dx += (rx / len) * rate * dt / 0.0022;
      this.padLook.dy += (ry / len) * rate * 0.72 * dt / 0.0022;
    } else this.padTurnT = 0;
  }
  rumble(weak, strong, ms) {
    if (!this.vibration || !this.padActive || !this.pad) return;
    const a = this.pad.vibrationActuator;
    if (a && a.playEffect) { try { const r = a.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: weak, strongMagnitude: strong }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* unsupported */ } }
  }
  requestLock() { if ((this.padActive && !(this.split && this.split.mode === 'pad1')) || this.mobile || !this.canvas.requestPointerLock) return; try { const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ } }
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
      const k = this.keys, arrows = !(this.split && this.split.mode === 'kbd');
      this.move.x = (k.has('KeyD') || (arrows && k.has('ArrowRight')) ? 1 : 0) - (k.has('KeyA') || (arrows && k.has('ArrowLeft')) ? 1 : 0);
      this.move.y = (k.has('KeyW') || (arrows && k.has('ArrowUp')) ? 1 : 0) - (k.has('KeyS') || (arrows && k.has('ArrowDown')) ? 1 : 0);
      this.sprint = k.has('ShiftLeft') || (arrows && k.has('ShiftRight'));
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
      pressed: new Set(this.pressed), pad: false,
    };
    // with one controller in split screen it belongs to player 2 (player 1 keeps keyboard and mouse)
    if (this.pad && this.padActive && this.enabled && !this.menuActive && !(this.split && this.split.mode === 'pad1')) this._padGameplay(snap);
    this.look.dx = 0; this.look.dy = 0; this.pressed.clear();
    return snap;
  }
  /** Standard FPS controller layout (COD style) mapped onto the same actions as keyboard / touch. */
  _padGameplay(snap) {
    const J = this.padJust, R = this.padReleased, held = this.padPrev, v = this.padValues, P = snap.pressed;
    snap.pad = true;
    // left stick: move (radial deadzone, rescaled)
    const lx = this.padAxes[0], ly = this.padAxes[1], l = Math.hypot(lx, ly), dz = 0.15;
    if (l > dz) { const m = Math.min(1, (l - dz) / (1 - dz)); snap.move.x = (lx / l) * m; snap.move.y = (-ly / l) * m; }
    // L3 toggles sprint; it drops when you stop pushing forward
    if (J.has(PAD.LS)) this.padSprint = !this.padSprint;
    if (snap.move.y < 0.3) this.padSprint = false;
    if (this.padSprint) snap.sprint = true;
    // triggers
    if ((v[PAD.RT] || 0) > 0.25) snap.fire = true;
    if (this.adsHold) { if ((v[PAD.LT] || 0) > 0.25) snap.ads = true; } else { if (J.has(PAD.LT)) this.padAds = !this.padAds; if (this.padAds) snap.ads = true; }
    // R3 held: peek, the left stick picks the side
    if (held[PAD.RS]) snap.peek = lx < -0.35 ? -1 : 1;
    snap.jumpHeld = snap.jumpHeld || !!held[PAD.A];
    const map = [[PAD.A, 'jump'], [PAD.B, 'crouch'], [PAD.X, 'reload'], [PAD.Y, 'swap'], [PAD.LB, 'tactical'], [PAD.RB, 'lethal'], [PAD.LEFT, 'streak1'], [PAD.UP, 'streak2'], [PAD.RIGHT, 'streak3'], [PAD.DOWN, 'loadout'], [PAD.START, 'esc'], [PAD.BACK, 'score']];
    for (const [b, action] of map) if (J.has(b)) P.add(action);
    if (R.has(PAD.BACK)) P.add('scoreUp');
    // right stick look (already in radians-equivalent pixels; independent of mouse sensitivity)
    snap.look.dx += this.padLook.dx; snap.look.dy += this.padLook.dy * (this.invertY ? -1 : 1);
    this.padLook.dx = 0; this.padLook.dy = 0;
  }
  setEnabled(on) { this.enabled = on; if (!on) { this.fire = false; this.ads = false; this.keys.clear(); this.move.x = 0; this.move.y = 0; this.pressed2.clear(); } }
  /** Split screen on (cfg from splitAssignment()) or off (null). Returns player 2's input source. */
  setSplit(cfg, opts2 = {}) {
    this.split = cfg; this.pressed2.clear();
    if (!cfg) { this.second = null; return null; }
    this.second = new SecondInput(this, cfg, opts2); return this.second;
  }
}

/** Who plays with what in split screen: two controllers = one each; one = it goes to player 2 (player 1 keeps
 *  keyboard and mouse); none = player 2 on the right-hand side of the keyboard. */
export function splitAssignment() {
  const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter((p) => p && p.connected);
  if (pads.length >= 2) return { mode: 'pad2', p1: pads[0].index, p2: pads[1].index };
  if (pads.length === 1) return { mode: 'pad1', p1: null, p2: pads[0].index };
  return { mode: 'kbd', p1: null, p2: null };
}
// player 2 keyboard one-shot actions (right-hand side of the keyboard)
export const P2_KEYS = { KeyO: 'jump', Semicolon: 'crouch', KeyU: 'reload', KeyP: 'swap', KeyN: 'lethal', KeyM: 'tactical', Digit7: 'streak1', Digit8: 'streak2', Digit9: 'streak3', Digit0: 'score', ShiftRight: '_', Slash: '_', KeyH: '_', KeyI: '_', KeyJ: '_', KeyK: '_', KeyL: '_', ArrowUp: '_', ArrowDown: '_', ArrowLeft: '_', ArrowRight: '_' };
export const P2_KEY_ROWS = [['Move', '<kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd>'], ['Look', '<kbd>I</kbd> <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd>'], ['Fire', '<kbd>RIGHT SHIFT</kbd>'], ['Aim down sights', '<kbd>/</kbd> (hold)'], ['Sprint', '<kbd>H</kbd> (hold)'], ['Jump', '<kbd>O</kbd>'], ['Duck / prone / slide', '<kbd>;</kbd> (tap, double-tap, while sprinting)'], ['Reload', '<kbd>U</kbd>'], ['Swap weapon', '<kbd>P</kbd>'], ['Lethal / tactical', '<kbd>N</kbd> / <kbd>M</kbd>'], ['Score streaks', '<kbd>7</kbd> <kbd>8</kbd> <kbd>9</kbd>'], ['Scoreboard', '<kbd>0</kbd> (hold)'], ['Pause', '<kbd>ESC</kbd> (either player)'], ['Pause menu', '<kbd>↑</kbd> <kbd>↓</kbd> · <kbd>ENTER</kbd> select · <kbd>BACKSPACE</kbd> back']];

/** One controller's state (button edges, sticks, stick look) with the standard FPS mapping. */
class PadState {
  constructor() { this.prev = []; this.values = []; this.just = new Set(); this.released = new Set(); this.axes = [0, 0, 0, 0]; this.look = { dx: 0, dy: 0 }; this.sprint = false; this.adsT = false; this.turnT = 0; this.gp = null; }
  read(gp, dt, sens) {
    this.just.clear(); this.released.clear(); this.gp = gp && gp.connected ? gp : null;
    if (!this.gp) { this.prev = []; this.look.dx = this.look.dy = 0; return; }
    const values = gp.buttons.map((b) => (typeof b === 'object' ? b.value : b));
    const down = gp.buttons.map((b, i) => (typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5) && !((i === 6 || i === 7) && values[i] < 0.25));
    for (let i = 0; i < down.length; i++) { if (down[i] && !this.prev[i]) this.just.add(i); if (!down[i] && this.prev[i]) this.released.add(i); }
    this.prev = down; this.values = values;
    const ax = gp.axes; this.axes = [ax[0] || 0, ax[1] || 0, ax[2] || 0, ax[3] || 0];
    const rx = this.axes[2], ry = this.axes[3], len = Math.hypot(rx, ry), dz = 0.12;
    if (len > dz) {
      const m = Math.min(1, (len - dz) / (1 - dz)), curve = Math.pow(m, 1.9);
      if (m > 0.93) this.turnT = Math.min(0.5, this.turnT + dt); else this.turnT = 0;
      const rate = 3.4 * sens * curve * (1 + (Math.max(0, this.turnT - 0.12) / 0.38) * 0.7);
      this.look.dx += (rx / len) * rate * dt / 0.0022; this.look.dy += (ry / len) * rate * 0.72 * dt / 0.0022;
    } else this.turnT = 0;
  }
  gameplay(snap, adsHold, invertY) {
    const J = this.just, held = this.prev, v = this.values, P = snap.pressed;
    const lx = this.axes[0], ly = this.axes[1], l = Math.hypot(lx, ly), dz = 0.15;
    if (l > dz) { const m = Math.min(1, (l - dz) / (1 - dz)); snap.move.x = (lx / l) * m; snap.move.y = (-ly / l) * m; }
    if (J.has(PAD.LS)) this.sprint = !this.sprint; if (snap.move.y < 0.3) this.sprint = false; if (this.sprint) snap.sprint = true;
    if ((v[PAD.RT] || 0) > 0.25) snap.fire = true;
    if (adsHold) { if ((v[PAD.LT] || 0) > 0.25) snap.ads = true; } else { if (J.has(PAD.LT)) this.adsT = !this.adsT; if (this.adsT) snap.ads = true; }
    if (held[PAD.RS]) snap.peek = lx < -0.35 ? -1 : 1;
    snap.jumpHeld = !!held[PAD.A];
    for (const [b, a] of [[PAD.A, 'jump'], [PAD.B, 'crouch'], [PAD.X, 'reload'], [PAD.Y, 'swap'], [PAD.LB, 'tactical'], [PAD.RB, 'lethal'], [PAD.LEFT, 'streak1'], [PAD.UP, 'streak2'], [PAD.RIGHT, 'streak3'], [PAD.START, 'esc'], [PAD.BACK, 'score']]) if (J.has(b)) P.add(a);
    if (this.released.has(PAD.BACK)) P.add('scoreUp');
    snap.look.dx += this.look.dx; snap.look.dy += this.look.dy * (invertY ? -1 : 1); this.look.dx = this.look.dy = 0;
  }
}

/** Player 2 in split screen: the right-hand keyboard set, or their own controller. Same snapshot shape as Input. */
export class SecondInput {
  constructor(main, cfg, opts = {}) { this.main = main; this.cfg = cfg; this.opts = opts; this.padState = new PadState(); this.mobile = false; this.crouchHold = false; this.dt = 1 / 60; this.lookT = { x: 0, y: 0 }; this.adsT = false; this.label = cfg.mode === 'kbd' ? 'ARROW KEYS' : 'CONTROLLER'; this.padType = 'xbox'; }
  /** Player 2's own settings (sensitivity, invert, aim hold / toggle, vibration); the rest falls back to player 1's. */
  get o() { const M = this.main, o = this.opts || {}; return { sens: o.padSensitivity ?? M.padSensitivity, invertY: o.invertY ?? M.invertY, adsHold: o.adsHold ?? M.adsHold, vibration: o.vibration ?? M.vibration }; }
  get pad() { return this.cfg.mode !== 'kbd'; }
  update(dt) {
    this.dt = dt;
    if (this.cfg.mode === 'kbd') return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[this.cfg.p2]; if (gp) this.padType = /054c|dualsense|dualshock|playstation|ps5|ps4/i.test(gp.id) ? 'ps' : 'xbox';
    this.padState.read(gp, dt, this.o.sens);
  }
  poll() {
    const M = this.main, snap = { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, fire: false, ads: false, sprint: false, peek: 0, jumpHeld: false, pressed: new Set(), pad: this.cfg.mode !== 'kbd', assist: true };
    if (!M.enabled) { M.pressed2.clear(); return snap; }
    if (this.cfg.mode === 'kbd') {
      const k = M.keys, dt = this.dt;
      snap.move.x = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0); snap.move.y = (k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0);
      // key look: eases in so a tap nudges and a hold turns at full speed
      const lx = (k.has('KeyL') ? 1 : 0) - (k.has('KeyJ') ? 1 : 0), ly = (k.has('KeyK') ? 1 : 0) - (k.has('KeyI') ? 1 : 0);
      this.lookT.x = lx ? Math.min(1, this.lookT.x + dt * 3) : 0; this.lookT.y = ly ? Math.min(1, this.lookT.y + dt * 3) : 0;
      const ease = (t) => 0.35 + 0.65 * t * t, O = this.o, sens = O.sens;
      snap.look.dx = lx * 2.6 * sens * ease(this.lookT.x) * dt / 0.0022; snap.look.dy = ly * 1.7 * sens * ease(this.lookT.y) * dt / 0.0022 * (O.invertY ? -1 : 1);
      snap.fire = k.has('ShiftRight');
      if (O.adsHold) snap.ads = k.has('Slash'); else { if (k.has('Slash') && !this._slash) this.adsT = !this.adsT; snap.ads = this.adsT; } this._slash = k.has('Slash'); snap.sprint = k.has('KeyH') && snap.move.y > 0.3; snap.jumpHeld = k.has('KeyO');
      for (const a of M.pressed2) if (a !== '_') snap.pressed.add(a);
      M.pressed2.clear();
    } else if (this.padState.gp) this.padState.gameplay(snap, this.o.adsHold, this.o.invertY);
    return snap;
  }
  rumble(weak, strong, ms) {
    const gp = this.padState.gp; if (!this.o.vibration || !gp) return; const a = gp.vibrationActuator;
    if (a && a.playEffect) { try { const r = a.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: weak, strongMagnitude: strong }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* unsupported */ } }
  }
}
