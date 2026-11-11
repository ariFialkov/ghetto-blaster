// Second-order dynamics for animation. A spring carries position AND velocity, so a target that jumps (a stance
// change, a new gait phase, an impulse from a hit) is followed with continuous velocity: no pops, no linear easing.
// f: natural frequency in Hz (how quickly it gets there), z: damping ratio (1 = critically damped, <1 overshoots).
const STEP = 1 / 120;

export class Spring {
  constructor(x = 0, f = 4, z = 1) { this.x = x; this.v = 0; this.f = f; this.z = z; }
  step(target, dt, f = this.f, z = this.z) {
    const w = 2 * Math.PI * f, n = Math.max(1, Math.ceil(dt / STEP)), h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (w * w * (target - this.x) - 2 * z * w * this.v) * h; this.x += this.v * h; }
    return this.x;
  }
  kick(dv) { this.v += dv; return this; }
  set(x) { this.x = x; this.v = 0; return this; }
}

/** Three independent springs sharing a frequency: positions, offsets or small rotation vectors. */
export class Spring3 {
  constructor(f = 4, z = 1) { this.x = { x: 0, y: 0, z: 0 }; this.v = { x: 0, y: 0, z: 0 }; this.f = f; this.z = z; }
  step(tx, ty, tz, dt, f = this.f, z = this.z) {
    const w = 2 * Math.PI * f, n = Math.max(1, Math.ceil(dt / STEP)), h = dt / n, X = this.x, Vv = this.v;
    for (let i = 0; i < n; i++) {
      Vv.x += (w * w * (tx - X.x) - 2 * z * w * Vv.x) * h; X.x += Vv.x * h;
      Vv.y += (w * w * (ty - X.y) - 2 * z * w * Vv.y) * h; X.y += Vv.y * h;
      Vv.z += (w * w * (tz - X.z) - 2 * z * w * Vv.z) * h; X.z += Vv.z * h;
    }
    return X;
  }
  kick(x, y, z) { this.v.x += x; this.v.y += y; this.v.z += z; return this; }
  set(x, y, z) { this.x.x = x; this.x.y = y; this.x.z = z; this.v.x = this.v.y = this.v.z = 0; return this; }
}

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const wrapPi = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
