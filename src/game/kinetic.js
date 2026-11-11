// Kinetic animator for the skinned figures: a procedural, physics-informed character controller that drives the
// 24-bone skeleton directly (pelvis, three spine segments, neck, head, two-bone arms and legs, feet).
//
// Everything is a function of the character's actual motion (world velocity, acceleration, turn rate) plus a few
// state flags, and every channel is filtered by second-order springs, so any change of state (walk -> sprint -> slide
// -> crouch -> prone, firing, reloading, getting hit) is a continuous blend with no pops.
//
//  - Locomotion: foot-planted gait. Each foot is locked to the ground while in stance (no foot sliding) and swings
//    along an arc to a predicted landing point, so strafing, backpedalling and turning step in the right direction.
//    Stride, cadence and ground-contact time scale with speed (walk -> run -> sprint). The pelvis rides on the legs:
//    it compresses on each footfall, shifts over the planted foot, rotates and rolls with the stride, and is capped
//    by what the legs can reach. The spine counter-rotates, leans into acceleration and into turns.
//  - Standing: athletic ready stance, breathing, weight shift; the upper body turns with the aim first and the feet
//    shuffle round once the twist gets large (turn in place).
//  - Weapon: held off the posed shoulder (rifles) or chest (pistols), with inertia from turning and acceleration,
//    recoil impulses into the gun, shoulder and spine, tactical sprint carry, reload / throw / weapon-swap sequences.
//  - Reactions: hits shove the pelvis and snap the spine and head away from the shot; landings compress the legs.
//  - Death: a toppling body (gravity on an inverted pendulum pivoting at the feet, with the knees buckling), a
//    whipping head and a lagging, flailing free arm, settling onto the ground.
//
// Coordinates: the CharacterModel group's space (origin between the feet, +Z forward = aim, +X = the figure's left,
// +Y up), unscaled. Footholds are stored in the group's parent space (the world for actors).
import * as THREE from 'three';
import { Spring, Spring3, smooth, wrapPi } from './spring.js';

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x), lerp = (a, b, t) => a + (b - a) * t;
const UP = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);
const _eu = new THREE.Euler(0, 0, 0, 'YXZ');
const qE = (out, yaw, pitch, roll) => out.setFromEuler(_eu.set(pitch, yaw, roll, 'YXZ'));
const qRV = (out, rv) => { const a = Math.hypot(rv.x, rv.y, rv.z); if (a < 1e-6) return out.identity(); return out.setFromAxisAngle(_rvA.set(rv.x / a, rv.y / a, rv.z / a), a); };
const _rvA = V();
// scratch
const _p = V(), _p2 = V(), _p3 = V(), _ankL = V(), _ankR = V(), _sh = V(), _shL = V(), _c = V(), _head = V(), _o = V(), _t = V(), _F = V(), _N = V(), _F2 = V(), _N2 = V(), _pole = V(), _hip = V(), _ank = V(), _v = V();
const _q = Q(), _q2 = Q(), _q3 = Q(), _qp = Q(), _qc = Q(), _qh = Q(), _qn = Q(), _qs = Q(), _qf = Q(), _qk = Q(), _qr = Q(), _qd = Q();
const _m = new THREE.Matrix4(), _mg = new THREE.Matrix4(), _one = new THREE.Vector3(1, 1, 1), _ca = V(), _cb = V();

/** Catmull-Rom through key points (array of Vector3) at keyframe times `ks` (ascending, 0..1), sampled at k. */
export function pathAt(out, pts, ks, k) {
  const n = pts.length; if (k <= ks[0]) return out.copy(pts[0]); if (k >= ks[n - 1]) return out.copy(pts[n - 1]);
  let i = 0; while (i < n - 2 && k > ks[i + 1]) i++;
  let t = (k - ks[i]) / (ks[i + 1] - ks[i]); t = 0.5 * t + 0.5 * t * t * (3 - 2 * t);
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  for (const c of ['x', 'y', 'z']) out[c] = 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
  return out;
}
export const env = (k, a, b, c, d) => smooth(a, b, k) * (1 - smooth(c, d, k)); // rise a..b, fall c..d

class Foot {
  constructor(side) { this.side = side; this.sgn = side === 'Left' ? 1 : -1; this.stance = true; this.plant = V(); this.plantYaw = 0; this.lift = V(); this.liftYaw = 0; this.w = V(); this.yaw = 0; this.pitch = 0; this.u = 0; this.s = 0; }
}

export class Kinetic {
  constructor(cm) {
    this.cm = cm; this.fig = cm.figure; const R = this.fig.rest, s = cm.scale; this.s = s;
    this.hipH = R.Hips.p.y;
    this.hipJ = { Left: R.LeftUpLeg.p.clone().sub(R.Hips.p), Right: R.RightUpLeg.p.clone().sub(R.Hips.p) };
    this.L = { Left: this.fig.len.LeftLeg[0] + this.fig.len.LeftLeg[1], Right: this.fig.len.RightLeg[0] + this.fig.len.RightLeg[1] };
    this.ankleH = this.fig.ankleH;
    const toe = R.LeftToeBase ? Math.hypot(R.LeftToeBase.p.z - R.LeftFoot.p.z, R.LeftToeBase.p.x - R.LeftFoot.p.x) : 0.11 * s;
    this.toeF = clamp(toe, 0.06 * s, 0.16 * s); this.heelB = 0.045 * s;
    this.width = Math.abs(this.hipJ.Left.x - this.hipJ.Right.x) / 2 + 0.035 * s;
    this.feet = { Left: new Foot('Left'), Right: new Foot('Right') };
    // springs (Hz, damping)
    this.velS = new Spring3(4.5, 1); this.yawRate = new Spring(0, 3.5, 1); this.aimP = new Spring(0, 7, 1); this.leanS = new Spring(0, 2.6, 1);
    this.crouchW = new Spring(0, 2.4, 1); this.proneW = new Spring(0, 0.95, 1); this.sprintW = new Spring(0, 2.1, 1); this.adsW = new Spring(0, 3.4, 1);
    this.slideW = new Spring(0, 3.2, 1); this.airW = new Spring(0, 5, 1); this.runW = new Spring(0, 2.5, 1); this.moveW = new Spring(0, 3, 1);
    this.pelY = new Spring(this.hipH, 6, 0.9); this.pelXZ = new Spring3(3.2, 1); this.dip = new Spring(0, 3.2, 0.5);
    this.lowYaw = new Spring(0, 3.2, 1);
    this.chestRV = new Spring3(2.6, 0.38); this.headRV = new Spring3(3.4, 0.36); this.pelOff = new Spring3(2.4, 0.55);
    this.gunPos = new Spring3(4.2, 0.5); this.gunRot = new Spring3(4.5, 0.45); this.turnLag = new Spring(0, 2.2, 0.6);
    this.rlW = new Spring(0, 4.5, 1); this.lowW = new Spring(0, 5, 1);
    this.leanFwd = new Spring(0, 2, 1); this.leanSide = new Spring(0, 2, 1);
    // death sim
    this.death = null;
    this.reset();
  }
  reset() { this.ready = false; this.death = null; this.throwT = -1; this.swap = null; this.aliveT = 0; }
  /** Weapon swaps are animated (lower, swap the mesh at the bottom, raise) once the figure has been up a moment. */
  canSwap() { return this.ready && !this.death && this.aliveT > 0.3 && !!this.cm.gunMesh; }
  beginSwap(weapon, time = 0.5) { this.swap = { t: 0, dur: clamp(time, 0.32, 0.8), weapon, done: false }; }
  act(kind) { if (kind === 'throw' && this.ready && !this.death) this.throwT = 0; }
  /** A bullet / blast hit: dir = travel direction of the shot (world, horizontal), strength ~0.3..1.5. */
  onHit(dir, strength = 1, part = 'body') {
    if (!this.ready || this.death) return; const l = this._toLocalDir(dir, _v); const k = clamp(strength, 0.2, 1.8);
    // the chest is knocked away from the shot: rotate +Y towards the travel direction (axis = up x dir)
    const ax = _o.crossVectors(UP, l);
    this.chestRV.kick(ax.x * 2.4 * k, ax.y * 2.4 * k + (Math.random() - 0.5) * 1.5 * k, ax.z * 2.4 * k);
    if (part === 'head') this.headRV.kick(ax.x * 7 * k, (Math.random() - 0.5) * 3 * k, ax.z * 7 * k);
    else this.headRV.kick(ax.x * 2.5 * k, 0, ax.z * 2.5 * k);
    this.pelOff.kick(l.x * 0.9 * k, 0, l.z * 0.9 * k); this.dip.kick(-0.35 * k);
    this.gunRot.kick((Math.random() - 0.5) * 3 * k, (Math.random() - 0.5) * 3 * k, (Math.random() - 0.5) * 2 * k);
  }
  onShot(recoil = 1, heavy = false) {
    const k = Math.min(2.2, clamp(recoil, 0.3, 2) * (heavy ? 1.4 : 1));
    this.gunPos.kick(0, 0.08 * k, -0.55 * k); this.gunRot.kick(-3.2 * k, (Math.random() - 0.5) * 1.2 * k, (Math.random() - 0.5) * 0.8 * k);
    this.chestRV.kick(-0.55 * k, 0, 0); this.headRV.kick(-0.25 * k, 0, 0);
  }
  /** Killed: dir = the killing shot's travel direction (world), strength, part ('head' crumples). */
  die(dir, strength = 1, part = 'body') {
    const push = dir ? this._toLocalDir(dir, V()) : new THREE.Vector3(0, 0, -1); if (push.lengthSq() < 1e-4) push.set(0, 0, -1);
    const head = part === 'head', blast = strength > 1.6, k = clamp(strength, 0.6, 2.6);
    // momentum at the moment of death (local): a running body keeps going and pitches the way it was moving
    const vs = this.velS ? this.velS.x : { x: 0, z: 0 }, c = Math.cos(this.yaw || 0), sn = Math.sin(this.yaw || 0);
    const slide = new THREE.Vector3(vs.x * c - vs.z * sn, 0, vs.x * sn + vs.z * c), speed = slide.length();
    const fall = push.clone().multiplyScalar(k * 0.9).addScaledVector(slide, 0.38); if (fall.lengthSq() < 1e-4) fall.copy(push);
    const R = () => Math.random() - 0.5;
    this.death = {
      dir: fall.normalize(), th: 0, om: (head ? 0.25 : 0.9) * k + 0.15 + speed * 0.2, b: new Spring(0, head ? 2.6 : speed > 3 ? 2.2 : 1.7, 1), t: 0, head, blast,
      slide: slide.multiplyScalar(speed > 1 ? 0.8 : 0).addScaledVector(push, blast ? 2.2 : 0), off: V(),
      pivot: null, pel0: this.lastPel ? this.lastPel.clone() : new THREE.Vector3(0, this.hipH, 0), rest: false,
      ank: { Left: this.lastAnk ? this.lastAnk.Left.clone() : null, Right: this.lastAnk ? this.lastAnk.Right.clone() : null },
      // flung limbs: underdamped springs so they whip out and settle, each death a little different
      armL: new Spring3(2.1, 0.3), armR: new Spring3(2.3, 0.32), armInit: false,
      sprL: { x: 0.44 + R() * 0.2, y: -0.12 + R() * 0.3, z: 0.12 + R() * 0.4 }, sprR: { x: -0.44 + R() * 0.2, y: -0.12 + R() * 0.3, z: 0.1 + R() * 0.4 },
      bend: Math.random() < 0.5 ? 'Left' : 'Right', legSpread: 0.14 + Math.random() * 0.12,
    };
    // killed while prone: already down, face first
    if (this.proneW && this.proneW.x > 0.5) { const D = this.death; D.dir.set(0, 0, 1); D.th = 1.45; D.om = 0; D.rest = true; D.b.set(1); D.slide.set(0, 0, 0); }
    this.throwT = -1; this.swap = null;
  }
  _toLocalDir(d, out) { const g = this.cm.group, c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y); out.set(d.x * c - d.z * s, 0, d.x * s + d.z * c); const n = out.length(); return n > 1e-6 ? out.divideScalar(n) : out.set(0, 0, -1); }
  _toLocal(w, out) { const dx = w.x - this.px, dz = w.z - this.pz; return out.set(dx * this.cy - dz * this.sy, w.y - this.py, dx * this.sy + dz * this.cy); }
  _toWorld(l, out) { return out.set(this.px + l.x * this.cy + l.z * this.sy, this.py + l.y, this.pz - l.x * this.sy + l.z * this.cy); }
  _init(st) {
    const g = this.cm.group; this.px = g.position.x; this.py = g.position.y; this.pz = g.position.z; this.yaw = g.rotation.y;
    this.cy = Math.cos(this.yaw); this.sy = Math.sin(this.yaw);
    this.velS.set(0, 0, 0); this.yawRate.set(0); this.aimP.set(clamp(st.pitch || 0, -1.1, 1.1));
    this.crouchW.set(st.crouch && !st.prone ? 1 : 0); this.proneW.set(st.prone ? 1 : 0); this.sprintW.set(0); this.adsW.set(st.ads ? 1 : 0); this.slideW.set(0); this.airW.set(st.onGround === false ? 1 : 0);
    this.runW.set(0); this.moveW.set(0); this.dip.set(0); this.pelXZ.set(0, 0, 0); this.lowYaw.set(this.yaw + this._blade() * 0.6);
    this.pelY.set(lerp(this.hipH * 0.965, this.hipH * 0.66, this.crouchW.x));
    for (const s of [this.chestRV, this.headRV, this.pelOff, this.gunPos, this.gunRot]) s.set(0, 0, 0);
    this.turnLag.set(0); this.rlW.set(0); this.lowW.set(0); this.leanS.set(st.lean || 0); this.leanFwd.set(0); this.leanSide.set(0);
    this.phase = 0; this.parked = true; this.turning = false; this.crawlPh = 0; this.onGround = st.onGround !== false; this.vy = 0;
    for (const f of Object.values(this.feet)) { this._idleSpot(f, f.plant); f.lift.copy(f.plant); f.plantYaw = f.liftYaw = this.lowYaw.x + f.sgn * 0.12; f.stance = true; f.w.copy(f.plant); }
    this.ready = true;
  }
  _blade() { const f = this.cm.fit; if (!f) return 0; return f.hold === 'rifle' ? -0.42 : f.hold === 'pistol' ? -0.12 : -0.3; }
  /** Where a foot rests when standing still (world): stance width, a bladed stagger for long guns. */
  _idleSpot(f, out) {
    const ly = this.lowYaw.x, c = Math.cos(ly), s = Math.sin(ly), rifle = this.cm.fit && this.cm.fit.hold !== 'pistol';
    const lx = f.sgn * this.width * (1 + 0.25 * this.crouchW.x), lz = (rifle ? f.sgn * 0.09 : f.sgn * 0.02) * this.s * (1 - this.moveW.x);
    return out.set(this.px + lx * c + lz * s, this.py, this.pz - lx * s + lz * c);
  }

  update(dt, st) {
    const cm = this.cm, fig = this.fig, g = cm.group; if (!fig.ok) return;
    dt = clamp(dt || 0.016, 1e-4, 0.05);
    if (!this.ready) this._init(st);
    // ---- motion from the group's placement this frame ----
    const nx = g.position.x, ny = g.position.y, nz = g.position.z, nyaw = g.rotation.y;
    if (Math.hypot(nx - this.px, nz - this.pz) > 3 || Math.abs(ny - this.py) > 3) { this.ready = false; this._init(st); }
    const vx = (nx - this.px) / dt, vz = (nz - this.pz) / dt, vy = (ny - this.py) / dt;
    const dyaw = wrapPi(nyaw - this.yaw);
    this.px = nx; this.py = ny; this.pz = nz; this.yaw = nyaw; this.cy = Math.cos(nyaw); this.sy = Math.sin(nyaw);
    if (st.dead) { this._updateDeath(dt, st); return; }
    if (this.death) { this.reset(); this._init(st); }
    this.aliveT += dt; this.t = (this.t || 0) + dt;
    const pvx = this.velS.x.x, pvz = this.velS.x.z;
    const vS = this.velS.step(vx, 0, vz, dt);
    const ax = (vS.x - pvx) / dt, az = (vS.z - pvz) / dt; // world acceleration (smoothed)
    const yawRate = this.yawRate.step(clamp(dyaw / dt, -12, 12), dt);
    const speed = Math.hypot(vS.x, vS.z);
    // local velocity / acceleration
    const lvx = vS.x * this.cy - vS.z * this.sy, lvz = vS.x * this.sy + vS.z * this.cy;
    const lax = ax * this.cy - az * this.sy, laz = ax * this.sy + az * this.cy;
    // ---- state blends ----
    const prone = !!st.prone, crouch = !!st.crouch && !prone, slide = !!st.slide;
    const crouchW = this.crouchW.step(crouch || slide ? 1 : 0, dt), proneW = this.proneW.step(prone ? 1 : 0, dt);
    const sprintW = this.sprintW.step(st.sprint && st.moving ? 1 : 0, dt), adsW = this.adsW.step(st.ads ? 1 : 0, dt);
    const slideW = this.slideW.step(slide ? 1 : 0, dt), airW = this.airW.step(st.onGround === false ? 1 : 0, dt);
    const moveW = clamp(this.moveW.step(smooth(0.25, 1.6, speed), dt), 0, 1), runW = clamp(this.runW.step(smooth(3, 6.4, speed), dt), 0, 1);
    const aimPitch = this.aimP.step(clamp(st.pitch || 0, -1.1, 1.1), dt);
    cm.lean = this.leanS.step(st.lean || 0, dt); const lean = cm.lean;
    cm.adsBlend = adsW; cm.crouchBlend = crouchW; cm.sprintBlend = sprintW; cm.aimPitch = aimPitch;
    const fit = cm.fit, rifle = !!fit && fit.hold === 'rifle', pistol = !!fit && fit.hold === 'pistol';
    // ---- take-off / landing ----
    const grounded = st.onGround !== false;
    if (!grounded && this.onGround && vy > 1) { this.dip.kick(0.6); this.chestRV.kick(0.4, 0, 0); }
    if (grounded && !this.onGround) {
      const impact = clamp(-this.vy * 0.13, 0.15, 1.1);
      this.dip.kick(-impact * 1.6); this.chestRV.kick(impact * 1.6, 0, 0); this.headRV.kick(impact * 1.2, 0, 0); this.gunPos.kick(0, -impact * 0.5, 0);
      for (const f of Object.values(this.feet)) { this._landingSpot(f, 0.1, vS, f.plant); f.plantYaw = this.lowYaw.x + f.sgn * 0.1; f.lift.copy(f.plant); f.stance = true; }
      this.parked = speed < 0.3;
    }
    this.onGround = grounded; this.vy = vy;
    // ---- lower body facing (world yaw) ----
    const blade = this._blade();
    let lowT;
    if (moveW > 0.05 && proneW < 0.5) {
      let a = Math.atan2(lvx, lvz); if (Math.abs(a) > 1.85) a = wrapPi(a + Math.PI); // backpedal: hips face forward, feet step back
      a = clamp(a, -1.0, 1.0); lowT = nyaw + lerp(blade * 0.5, a, moveW); this.turning = false;
    } else {
      const want = nyaw + blade * 0.6 * (1 - proneW), err = wrapPi(want - this.lowYaw.x);
      if (Math.abs(err) > 0.8 || proneW > 0.3) this.turning = true; if (Math.abs(err) < 0.06) this.turning = false;
      lowT = this.turning ? want : this.lowYaw.x;
    }
    this.lowYaw.step(this.lowYaw.x + wrapPi(lowT - this.lowYaw.x), dt, this.turning ? 3.6 : 3.2);
    const pelYawL = clamp(wrapPi(this.lowYaw.x - nyaw), -1.3, 1.3);
    // ---- gait: phase, cadence, footholds ----
    const duty = this._duty(speed) * (1 - 0.1 * crouchW);
    const travel = this._travel(speed) * (1 + 0.2 * crouchW);
    let rate = speed > 0.05 ? clamp(speed * duty / travel, 0.85, 2.5) : 0; // cycles / s (two steps per cycle)
    // park when still with both feet down near their spots; unpark when moving or the stance drifts (turn in place)
    const footErr = Math.max(this._idleErr(this.feet.Left), this._idleErr(this.feet.Right));
    // leaving a standstill enters the cycle at mid-stance (feet are under the body), so the first stride isn't a lunge
    if (this.parked) { if (speed > 0.3 || footErr > 0.24 * this.s || this.turning) { this.parked = false; this.phase = duty * 0.5; } }
    else if (speed < 0.3 && this.feet.Left.stance && this.feet.Right.stance && footErr < 0.12 * this.s && !this.turning) this.parked = true;
    if (!this.parked && speed < 0.6) rate = Math.max(rate, 1.15); // shuffle steps when turning or settling
    if (this.parked || !grounded || proneW > 0.4 || slideW > 0.4) rate = this.parked ? 0 : rate;
    const T = rate > 0 ? 1 / rate : 1;
    if (grounded && proneW < 0.4 && slideW < 0.4) this.phase = (this.phase + rate * dt) % 1;
    // per foot: stance (locked) or swing (arc to the predicted landing point)
    let compress = 0, stanceN = 0, stanceX = 0;
    for (const f of [this.feet.Left, this.feet.Right]) {
      const u = (this.phase + (f.sgn > 0 ? 0 : 0.5)) % 1, wrapped = f.prevU !== undefined && u < f.prevU - 0.5; f.u = u; f.prevU = u;
      // a planted foot lifts when its share of the cycle is up; a swinging foot lands only when its own cycle comes
      // round (its timing is frozen at lift-off), so slowing down or speeding up never cuts a swing short
      const inStance = this.parked || (f.stance ? u < duty : wrapped);
      if (grounded && proneW < 0.4 && slideW < 0.4 && !f.hold) {
        if (inStance && !f.stance) { this._landingSpot(f, 0, vS, f.plant); f.plantYaw = this.lowYaw.x + f.sgn * 0.1; f.stance = true; }
        else if (!inStance && f.stance) { f.lift.copy(f.plant); this._toLocal(f.plant, f.liftL || (f.liftL = V())); f.liftYaw = f.plantYaw; f.stance = false; f.dutyS = Math.min(duty, u); f.sw0 = clamp((u - f.dutyS) / (1 - f.dutyS), 0, 0.9); }
      }
      // while another whole-body pose takes over (air, prone, slide) the foot rides along with the body where it was;
      // once that pose fully owns the legs the foothold moves under the body, ready to hand back without a jump
      const over = Math.max(airW, smooth(0, 0.55, proneW), slideW); // the weight those poses actually have on the legs
      if (over > 0.02 || !grounded) {
        if (!f.hold) { f.hold = this._toLocal(f.w, V()); f.holdYaw = wrapPi(f.yaw - nyaw); }
        f.hold.y *= Math.exp(-dt * 9); // a foot caught mid-stride comes down rather than dropping
        if (over > 0.97 && grounded) { this._idleSpot(f, _v); this._toLocal(_v, f.hold); f.hold.y = 0; f.holdYaw = wrapPi(this.lowYaw.x + f.sgn * 0.1 - nyaw); }
        this._toWorld(f.hold, f.plant); f.plantYaw = nyaw + f.holdYaw; f.lift.copy(f.plant); f.liftYaw = f.plantYaw; f.stance = true;
      } else if (f.hold) { f.hold = null; }
      if (f.stance) {
        // a planted foot left far behind (knock-back, respawn nudge) is re-placed rather than stretched
        if (Math.hypot(f.plant.x - this.px, f.plant.z - this.pz) > 1.25 * this.s || Math.abs(f.plant.y - this.py) > 0.6) this._idleSpot(f, f.plant);
        f.w.copy(f.plant); f.yaw = f.plantYaw;
        const k = this.parked ? 0 : u / duty;
        compress = Math.max(compress, this.parked ? 0 : Math.sin(Math.PI * clamp(k, 0, 1)));
        f.pitch = this.parked ? 0 : (smooth(0.62, 1, k) * 0.55 - (1 - smooth(0, 0.18, k)) * 0.22) * moveW; // heel strike -> roll -> toe-off
        stanceN++; stanceX += f.sgn;
      } else {
        const dS = f.dutyS ?? duty, swRaw = clamp((u - dS) / (1 - dS), 0, 1), sw = clamp((swRaw - (f.sw0 || 0)) / (1 - (f.sw0 || 0)), 0, 1); f.s = sw; // the arc always runs from where the foot actually lifted
        this._landingSpot(f, (1 - swRaw) * (1 - dS) * T, vS, _p);
        // the arc is body-relative: the foot leaves the ground travelling with the hips, the heel folds up behind and
        // under the hips (running), then the thigh drives it through to the landing point. Quadratic curve with the
        // control point behind the hips and high.
        if (!f.liftL) this._toLocal(f.lift, f.liftL = V());
        this._toLocal(_p, _o); const P0 = f.liftL, t = sw, it = 1 - t;
        const kickH = runW * moveW * (0.22 + 0.12 * sprintW) * this.s;
        const cx = (P0.x + _o.x) / 2, cz = lerp((P0.z + _o.z) / 2, this.pelXZ.x.z - 0.22 * this.s, runW * moveW), cy = (P0.y + _o.y) / 2 + 2 * kickH;
        _v.set(it * it * P0.x + 2 * t * it * cx + t * t * _o.x, it * it * P0.y + 2 * t * it * cy + t * t * _o.y, it * it * P0.z + 2 * t * it * cz + t * t * _o.z);
        const liftH = (0.06 + 0.03 * runW + 0.05 * crouchW) * this.s * Math.max(0.35, moveW) * (1 - runW * 0.5);
        _v.y += Math.sin(Math.PI * sw) * liftH;
        this._toWorld(_v, f.w);
        const e = smooth(0, 1, sw);
        f.yaw = f.liftYaw + wrapPi(this.lowYaw.x + f.sgn * 0.1 - f.liftYaw) * e;
        f.pitch = (0.55 * (1 - sw) * (1 - sw) - 0.3 * smooth(0.55, 1, sw)) * moveW;
      }
    }
    // ---- pelvis ----
    const standH = this.hipH * (0.97 - 0.008 * runW - 0.015 * adsW), crouchH = this.hipH * 0.64;
    let hY = lerp(standH, crouchH, crouchW) - (0.012 + 0.028 * runW) * moveW * compress * this.s + (stanceN === 0 ? 0.025 * runW * this.s : 0);
    // the legs cap the pelvis: it can't sit higher than the planted feet let it (compass gait)
    for (const f of [this.feet.Left, this.feet.Right]) {
      if (!f.stance || !grounded) continue;
      this._toLocal(f.w, _ank); const hj = this.hipJ[f.side];
      const dh = Math.hypot(_ank.x - (this.pelXZ.x.x + hj.x), _ank.z - this.pelXZ.x.z), Lr = this.L[f.side] * 0.975;
      hY = Math.min(hY, this.ankleH + _ank.y + Math.sqrt(Math.max(0, Lr * Lr - dh * dh)) - hj.y);
    }
    const pelY = this.pelY.step(hY, dt) + this.dip.step(0, dt) * this.s;
    const swayX = stanceN === 1 ? stanceX * 0.028 * (1 - runW) * moveW * this.s : 0;
    const idleShift = Math.sin(this.t * 0.55) * 0.012 * this.s * (1 - moveW);
    const po = this.pelOff.step(0, 0, 0, dt);
    const pxz = this.pelXZ.step(swayX + idleShift - lean * 0.2 * this.s, 0, -0.06 * crouchW * this.s - 0.03 * runW * this.s, dt);
    // stride rotation, roll, forward tilt
    const ph = this.phase * Math.PI * 2, osc = (0.07 + 0.09 * runW) * moveW * (this.parked ? 0 : 1);
    const lf = this.leanFwd.step(clamp(laz * 0.012, -0.12, 0.16) + 0.1 * runW * moveW + 0.07 * sprintW, dt);
    const ls = this.leanSide.step(clamp(-lax * 0.016 + yawRate * speed * 0.016, -0.26, 0.26), dt);
    const pelYaw = pelYawL - osc * Math.cos(ph), pelRoll = (0.045 * moveW * Math.sin(ph) * (1 - runW * 0.5)) * (this.parked ? 0 : 1) + lean * 0.12 - ls * 0.4;
    const pelPitch = lf * 0.35 + 0.3 * crouchW;
    // stand / crouch pose
    _p.set(pxz.x + po.x, pelY + po.y, pxz.z + po.z); qE(_qp, pelYaw, pelPitch, pelRoll);
    // chest: aim-locked with the hold's blade, counter-rotating the stride, leaning into speed, acceleration and turns
    const turnLag = this.turnLag.step(clamp(-yawRate * 0.06, -0.3, 0.3), dt);
    const chestYaw = blade * (1 - sprintW * 0.85) + osc * 0.35 * Math.cos(ph) + turnLag;
    const breath = Math.sin(this.t * 1.7) * 0.014 * (1 - moveW);
    const chestPitch = -aimPitch * 0.42 + 0.04 + lf * 1.1 + 0.26 * sprintW + 0.22 * crouchW + 0.05 * adsW + breath;
    const chestRoll = lean * 0.3 - ls + (rifle ? 0.05 * adsW : 0);
    qE(_qc, chestYaw, chestPitch, chestRoll); _qc.premultiply(qRV(_q, this.chestRV.step(0, 0, 0, dt)));
    // head: on the aim, cheek on the stock when aiming a rifle
    qE(_qh, 0, -aimPitch + (rifle ? 0.16 * adsW : 0) - 0.15 * sprintW * 0, rifle ? 0.14 * adsW : 0); _qh.premultiply(qRV(_q, this.headRV.step(0, 0, 0, dt)));
    // ---- prone and slide blends (whole-body poses mixed in by their own springs) ----
    const ankT = { Left: _ankL.set(0, 0, 0), Right: _ankR.set(0, 0, 0) };
    for (const f of [this.feet.Left, this.feet.Right]) {
      const a = ankT[f.side]; this._toLocal(f.w, a); a.y += this.ankleH;
      // toe / heel roll: pivot about the ball (heel up) or the heel (toes up)
      if (f.pitch > 0) { a.y += this.toeF * Math.sin(f.pitch) - this.ankleH * (1 - Math.cos(f.pitch)); a.z -= (this.toeF * (1 - Math.cos(f.pitch))); }
      else if (f.pitch < 0) a.y += this.heelB * Math.sin(-f.pitch);
      f.yawL = wrapPi(f.yaw - nyaw); f.pitchL = f.pitch;
    }
    // airborne: legs tuck on the way up, reach for the ground on the way down
    if (airW > 0.01) {
      const up = clamp(vy / 5, -1, 1);
      for (const f of [this.feet.Left, this.feet.Right]) {
        const hj = this.hipJ[f.side], lead = f.sgn > 0 ? 1 : 0.55, tuck = clamp(0.25 + up * 0.45, 0, 0.7) * lead;
        _t.set(_p.x + hj.x + f.sgn * 0.03 * this.s, _p.y + hj.y - this.L[f.side] * (0.93 - tuck * 0.45), _p.z + (tuck * 0.32 - 0.06) * this.s + lvz * 0.03);
        ankT[f.side].lerp(_t, airW); f.pitchL = lerp(f.pitchL, 0.35, airW);
      }
    }
    // prone: drop to a knee, then down onto the stomach; crawling alternates the knees
    if (proneW > 0.001) {
      const k1 = smooth(0, 0.55, proneW), k2 = smooth(0.42, 1, proneW);
      this.crawlPh += (st.moving ? speed : 0) * dt * 2.4; const crawlA = (this.crawlA || (this.crawlA = new Spring(0, 2.5, 1))).step(st.moving && prone ? 1 : 0, dt);
      _t.set(0, this.hipH * 0.55, -0.12 * this.s); _o.set(0, 0.2 * this.s, -0.4 * this.s);
      _p.lerp(_t, k1).lerp(_o, k2);
      qE(_q, pelYawL * (1 - k2), 0.25, 0); _qp.slerp(_q, k1); qE(_q, 0, 1.42, 0); _qp.slerp(_q, k2);
      qE(_q, blade * 0.2, -aimPitch * 0.45 + 0.3, 0); _qc.slerp(_q, k1); qE(_q, -0.05, 1.08 - aimPitch * 0.35, 0); _qc.slerp(_q, k2);
      qE(_q, 0, -aimPitch - 0.05, 0); _qh.slerp(_q, k2);
      for (const f of [this.feet.Left, this.feet.Right]) {
        const crawl = Math.max(0, Math.sin(this.crawlPh + (f.sgn > 0 ? 0 : Math.PI))) * crawlA;
        _t.set(f.sgn * this.width, this.ankleH * 1.1, _p.z - 0.42 * this.s); // kneeling: shin on the ground
        ankT[f.side].lerp(_t, k1 * (1 - k2));
        _t.set(f.sgn * (this.width * 0.9 + 0.12 * crawl * this.s), this.ankleH * 1.25, _p.z - (0.86 - 0.36 * crawl) * this.s);
        ankT[f.side].lerp(_t, k2);
        f.pitchL = lerp(f.pitchL, 1.25, k1); f.yawL = lerp(f.yawL, f.sgn * (0.15 + 0.25 * crawl), k2);
      }
    }
    // slide: low, leaning back, lead leg out in front, the other folded under
    if (slideW > 0.001) {
      const side = st.slideSide || 1;
      _t.set(-0.04 * side * this.s, 0.44 * this.s, 0.05 * this.s); _p.lerp(_t, slideW);
      qE(_q, pelYawL * 0.5, -0.42, 0.12 * side); _qp.slerp(_q, slideW);
      qE(_q, blade * 0.6, -aimPitch * 0.4 - 0.22, 0.1 * side); _qc.slerp(_q, slideW);
      _t.set(0.11 * this.s, this.ankleH, 0.7 * this.s); ankT.Left.lerp(_t, slideW);
      _t.set(-0.13 * this.s, this.ankleH * 1.2, -0.24 * this.s); ankT.Right.lerp(_t, slideW);
      this.feet.Left.pitchL = lerp(this.feet.Left.pitchL, -0.55, slideW); this.feet.Right.pitchL = lerp(this.feet.Right.pitchL, 1.3, slideW);
    }
    // ---- pose the trunk ----
    fig.begin(g);
    fig.setPelvis(_p, _qp);
    this.lastPel = (this.lastPel || V()).copy(_p);
    fig.setRot('Spine02', _q.copy(_qp).slerp(_qc, 0.3)); fig.setRot('Spine01', _q.copy(_qp).slerp(_qc, 0.66)); fig.setRot('Spine', _qc);
    fig.setRot('neck', _q.copy(_qc).slerp(_qh, 0.5)); fig.setRot('Head', _qh);
    // ---- weapon ----
    if (this.swap) { const sw = this.swap; sw.t += dt / sw.dur; if (!sw.done && sw.t >= 0.5) { sw.done = true; cm._setGunNow(sw.weapon); this._inertPending = true; } if (sw.t >= 1) this.swap = null; }
    let throwK = -1; if (this.throwT >= 0) { this.throwT += dt / 0.72; throwK = this.throwT; if (this.throwT >= 1) this.throwT = -1; }
    const swapLow = this.swap ? (this.swap.t < 0.5 ? smooth(0, 0.5, this.swap.t) : 1 - smooth(0.5, 1, this.swap.t)) : 0;
    const throwLow = throwK >= 0 ? env(throwK, 0, 0.14, 0.8, 1) : 0;
    const crawlLow = proneW > 0.5 && st.moving ? 0.32 : 0;
    const low = this.lowW.step(Math.max(swapLow, throwLow * 0.85, crawlLow), dt, swapLow > 0 ? 9 : 5);
    const rlW = this.rlW.step(st.reloading ? 1 : 0, dt);
    const rlK = st.reloading ? clamp((st.reloadT || 0) / Math.max(0.3, st.reloadTime || 2), 0, 1) : (this.rlK || 0); if (st.reloading) this.rlK = rlK;
    if (!cm.gunMesh || !fit) { this._freeArms(st, dt); this._legs(ankT, _p, _qp, pelYawL, proneW, slideW, crouchW); return; }
    const spr = sprintW * (st.ads ? 0 : 1) * (1 - proneW);
    fig.pos('RightArm', _sh); fig.pos('LeftArm', _shL); _c.addVectors(_sh, _shL).multiplyScalar(0.5); fig.pos('Head', _head);
    const eyeUp = _head.y + 0.07 * this.s - _c.y;
    const pitch = aimPitch, cp = Math.cos(pitch), sp = Math.sin(pitch);
    const lift = (dy, dz, out) => out.set(0, dy * cp + dz * sp, -dy * sp + dz * cp);
    const G = _t;
    if (rifle) { const sightOver = fit.sight - fit.butt[1]; const dy = clamp(eyeUp - sightOver, -0.05, 0.03) * adsW + (-0.03) * (1 - adsW); G.copy(_sh).add(_o.set(0.045 * (1 - spr), 0, 0)).add(lift(dy, 0.1, _v)); }
    else { const reach = pistol ? 0.42 : 0.32, sightOver = fit.sight - fit.grip[1]; const dy = (eyeUp - sightOver - 0.015) * adsW + (pistol ? -0.06 : -0.1) * (1 - adsW); G.copy(_c).add(_o.set(pistol ? -0.035 - 0.02 * adsW : -0.08, 0, 0)).add(lift(dy, reach, _v)); }
    // tactical sprint carry; pistols pump with the stride
    const pump = pistol ? Math.sin(ph) * spr : 0;
    if (spr > 0) G.add(_o.set(rifle ? -0.02 : -0.06, rifle ? -0.32 : -0.28 + 0.05 * pump, rifle ? 0.02 : -0.1 + 0.07 * pump).multiplyScalar(spr));
    // footfall bounce and inertia: the gun lags acceleration and turns, settles with a little overshoot
    const gp = this.gunPos.step(clamp(-lax * 0.0035, -0.04, 0.04), -compress * 0.012 * moveW * (1 - adsW * 0.7) * this.s, clamp(-laz * 0.003, -0.04, 0.03), dt);
    const gr = this.gunRot.step(clamp(yawRate * 0.012, -0.08, 0.08) * 0, clamp(-yawRate * 0.05, -0.18, 0.18) * (1 - adsW * 0.6), 0, dt);
    G.add(_o.set(gp.x, gp.y, gp.z));
    // reload: tilt the gun in and up to present the magazine well
    const rlTilt = rlW * env(rlK, 0, 0.12, 0.82, 1);
    G.add(_o.set(0.07 * rlTilt, -0.04 * rlTilt, -0.06 * rlTilt));
    // lowered (weapon swap, throwing, crawling)
    G.add(_o.set(0.05 * low, -0.24 * low, -0.12 * low));
    qE(_q, spr * (rifle ? 0.75 : 0.25) + gr.y + 0.35 * low, -pitch + spr * (rifle ? 0.8 : 0.9) + gr.x - rlTilt * 0.18 + 0.95 * low - proneW * 0.05, spr * (rifle ? 0.35 : 0) + gr.z + rlTilt * 0.55 + 0.25 * low);
    // inertialization: a new gun brings a new hold (rifle shoulder vs pistol chest). Capture the jump and decay it.
    if (this._inertPending && this._lastG) { this._inertPending = false; this.inert = { t: 0, dp: this._lastG.clone().sub(G), dq: this._lastQ.clone().multiply(_q2.copy(_q).invert()), hd: false }; }
    let iw = 0; if (this.inert) { iw = 1 - smooth(0, 0.26, this.inert.t); this.inert.t += dt; G.addScaledVector(this.inert.dp, iw); _q.premultiply(_q2.identity().slerp(this.inert.dq, iw)); if (this.inert.t > 0.26) this.inert = null; }
    (this._lastG || (this._lastG = V())).copy(G); (this._lastQ || (this._lastQ = Q())).copy(_q);
    cm.gunMount.position.copy(G); cm.gunMount.quaternion.copy(_q); cm.gunMount.scale.set(1, 1, 1); cm.gunMount.updateMatrixWorld(true);
    // ---- arms ----
    const H = cm._fitHands({ reloading: false });
    _mg.copy(g.matrixWorld).invert().multiply(cm.gunMesh.matrixWorld); // gun space -> group space
    const RP = _v.copy(H.Right).applyMatrix4(_mg); _F.copy(H.RightF).transformDirection(_mg); _N.copy(H.RightN).transformDirection(_mg);
    const LP = _p2.copy(H.Left).applyMatrix4(_mg);
    if (this.inert && !this.inert.hd && this._lastRP) { this.inert.hd = true; this.inert.dR = this._lastRP.clone().sub(RP); this.inert.dL = this._lastLP.clone().sub(LP); }
    if (this.inert && this.inert.hd) { RP.addScaledVector(this.inert.dR, iw); LP.addScaledVector(this.inert.dL, iw); }
    (this._lastRP || (this._lastRP = V())).copy(RP); (this._lastLP || (this._lastLP = V())).copy(LP);
    fig.arm('Right', RP, _F, _N, this._armPole('Right', _sh, _qc, proneW));
    _F2.copy(H.LeftF).transformDirection(_mg); _N2.copy(H.LeftN).transformDirection(_mg);
    let poleL = this._armPole('Left', _shL, _qc, proneW);
    // reload: magazine out, to the pouch, new magazine in, charge / rack, back to the handguard
    if (rlW > 0.01) {
      const mag = fit.mag, rk = this._rk || (this._rk = { pts: Array.from({ length: 8 }, V), ks: [0, 0.12, 0.22, 0.4, 0.54, 0.62, 0.8, 1] });
      const P = rk.pts, pv = (x, y, z, out) => out.set(x, y, z).applyMatrix4(_mg);
      P[0].copy(LP);
      pv(0.035, mag[1] - 0.01, mag[0], P[1]);
      pv(0.06, mag[1] - 0.17, mag[0] - 0.02, P[2]);
      _o.set(this.hipJ.Left.x + 0.05 * this.s, -0.02 * this.s, 0.11 * this.s).applyQuaternion(_qp).add(_p); P[3].copy(_o); // belt pouch, left front
      pv(0.05, mag[1] - 0.12, mag[0], P[4]);
      pv(0.035, mag[1] + 0.02, mag[0], P[5]);
      if (pistol) pv(0.0, fit.sight * 0.9, 0.0, P[6]); else pv(0.06, fit.sight * 0.45, fit.grip[0] + 0.07, P[6]);
      P[7].copy(LP);
      pathAt(_o, P, rk.ks, rlK); LP.lerp(_o, rlW);
      _F.set(0, -0.6, 0.8).transformDirection(_mg); _N.set(-1, 0, 0).transformDirection(_mg); _F2.lerp(_F, rlW).normalize(); _N2.lerp(_N, rlW).normalize();
    }
    // throw: reach to the vest, wind up behind the shoulder, whip over the top, follow through, back to the gun
    if (throwK >= 0) {
      const tk = this._tk || (this._tk = { pts: Array.from({ length: 6 }, V), ks: [0, 0.14, 0.3, 0.44, 0.66, 1] }), P = tk.pts;
      const ch = (x, y, z, out) => out.set(x * this.s, y * this.s, z * this.s).applyQuaternion(_qc).add(_shL);
      P[0].copy(LP); ch(-0.06, -0.24, 0.16, P[1]); ch(0.06, 0.18, -0.2, P[2]); ch(-0.06, 0.16, 0.42, P[3]); ch(-0.22, -0.22, 0.3, P[4]); P[5].copy(LP);
      const w = env(throwK, 0, 0.06, 0.86, 1);
      pathAt(_o, P, tk.ks, throwK); LP.lerp(_o, w);
      _F.set(0, 1, 0.3).applyQuaternion(_qc); _N.set(0, 0.1, 1).applyQuaternion(_qc); _F2.lerp(_F, w).normalize(); _N2.lerp(_N, w).normalize();
      _o.set(0.5, 0.25 * env(throwK, 0.1, 0.25, 0.45, 0.6), -0.35).applyQuaternion(_qc).add(_shL); poleL.lerp(_o, w);
    }
    // sprinting with a pistol: the free hand pumps
    if (pistol && spr > 0.01) {
      _o.set(0.02 * this.s, -0.36 * this.s + 0.05 * Math.cos(ph) * this.s, 0.16 * Math.sin(ph + Math.PI) * this.s).applyQuaternion(_qc).add(_shL);
      LP.lerp(_o, spr); _F.set(0, -0.4, 1).applyQuaternion(_qc); _N.set(-1, 0, 0).applyQuaternion(_qc); _F2.lerp(_F, spr).normalize(); _N2.lerp(_N, spr).normalize();
    }
    fig.arm('Left', LP, _F2, _N2, poleL); fig.pos('LeftHand', this.lastHandL || (this.lastHandL = V()));
    this._legs(ankT, _p, _qp, pelYawL, proneW, slideW, crouchW);
  }
  _armPole(side, sh, qc, proneW) {
    const sgn = side === 'Right' ? -1 : 1;
    _pole.set(sgn * 0.45, -0.8, -0.55).lerp(_o.set(sgn * 0.5, -1, 0.1), proneW).applyQuaternion(qc).add(sh);
    return side === 'Left' ? (this._poleL || (this._poleL = V())).copy(_pole) : (this._poleR || (this._poleR = V())).copy(_pole);
  }
  _legs(ankT, pel, qp, pelYawL, proneW, slideW, crouchW) {
    const fig = this.fig; this.lastAnk = this.lastAnk || { Left: V(), Right: V() };
    for (const f of [this.feet.Left, this.feet.Right]) {
      const a = ankT[f.side]; this.lastAnk[f.side].copy(a);
      // knee towards the foot's facing, a little outward; down when kneeling / prone
      _hip.copy(this.hipJ[f.side]).applyQuaternion(qp).add(pel);
      const fy = f.yawL; _pole.set(Math.sin(fy) + f.sgn * 0.15, 0.05 + 0.3 * crouchW, Math.cos(fy)).lerp(_o.set(f.sgn * 0.3, -1, 0.25), smooth(0.2, 0.7, proneW)).normalize().multiplyScalar(0.6).add(_hip);
      if (f.side === 'Right' && slideW > 0.01) _pole.lerp(_o.set(-0.4, -0.6, 0.5).add(_hip), slideW);
      qE(_qf, fy, f.pitchL, 0);
      fig.leg(f.side, a, _qf, _pole);
    }
  }
  // ground contact as a fraction of the stride (walk ~0.6, run ~0.3: a flight phase), and how far the body travels
  // over a planted foot (short, so the foot lands near under the hips rather than out in a lunge)
  _duty(speed) { return lerp(0.6, 0.27, smooth(1, 6.5, speed)); }
  _travel(speed) { return lerp(0.5, 0.8, smooth(0.5, 7.2, speed)) * this.s; }
  _idleErr(f) { this._idleSpot(f, _v); return Math.hypot(f.plant.x - _v.x, f.plant.z - _v.z) + (Math.abs(wrapPi(f.plantYaw - this.lowYaw.x - f.sgn * 0.1)) > 0.7 ? 1 : 0); }
  /** Predicted foothold (world) for a foot that lands in `tLand` seconds: under the body then, half a stance ahead. */
  _landingSpot(f, tLand, vS, out) {
    this._idleSpot(f, out);
    const speed = Math.hypot(vS.x, vS.z), duty = this._duty(speed);
    const travel = this._travel(speed), rate = speed > 0.05 ? clamp(speed * duty / travel, 0.85, 2.5) : 1.15;
    const lead = Math.min(0.7, tLand + duty / rate * 0.4); // lands a little ahead of the hips, pushes off further behind
    out.x += vS.x * lead; out.z += vS.z * lead; out.y = this.py;
    return out;
  }
  /** No gun (podium, unarmed): arms hang relaxed, swinging against the stride. */
  _freeArms(st, dt) {
    const fig = this.fig, qc = _qc;
    for (const side of ['Right', 'Left']) {
      const sgn = side === 'Right' ? -1 : 1; fig.pos(side + 'Arm', _sh);
      const swing = Math.sin(this.phase * Math.PI * 2 + (sgn > 0 ? Math.PI : 0)) * 0.22 * this.moveW.x * this.s;
      _o.set(sgn * 0.08 * this.s, -0.5 * this.s, swing + 0.04 * this.s).applyQuaternion(qc).add(_sh);
      fig.arm(side, _o, null, null, this._armPole(side, _sh, qc, 0));
    }
  }
  // ---- death: a ragdoll-like fall. The body topples about the feet (gravity on an inverted pendulum, knees
  // buckling), carries the momentum it had, flings its limbs out on loose springs and comes to rest on the ground.
  // Nothing goes under the surface: the trunk stops short of flat, and after posing, any part of the head, chest or
  // hips that would sink lifts the whole body, while elbows and knees that would dip re-bend upward. ----
  _updateDeath(dt, st) {
    const D = this.death, s = this.s;
    if (!D) { this.death = null; this.die(null, 1); return this._updateDeath(dt, st); }
    D.t += dt;
    if (!D.pivot) { D.pivot = V(); const a = D.ank; if (a.Left && a.Right) D.pivot.addVectors(a.Left, a.Right).multiplyScalar(0.5).setY(0); }
    const Lc = 0.95 * s, thMax = 1.45;
    if (!D.rest) {
      D.om += (9.8 / Lc) * Math.sin(D.th + 0.06) * dt * (D.head ? 0.6 : 1); D.th += D.om * dt;
      if (D.th >= thMax) { D.th = thMax; D.om = -D.om * 0.22; if (Math.abs(D.om) < 0.35) { D.om = 0; D.rest = true; } }
    }
    // momentum: barely slowed while still falling, scrubbed off quickly once down
    const down = D.th > thMax * 0.85, sp = Math.hypot(D.slide.x, D.slide.z);
    if (sp > 1e-4) D.slide.multiplyScalar(Math.max(0, sp - (down ? 9 : 3.2) * dt) / sp);
    D.off.addScaledVector(D.slide, dt);
    D.bk = D.b.step(1, dt);
    if (!D.kicked) { D.kicked = true; const ax = _o.crossVectors(UP, D.dir).normalize(); this.headRV.kick(-ax.x * 4, 0, -ax.z * 4); }
    D.hr = this.headRV.step(0, 0, 0, dt);
    // pose; if the trunk would sink, lift and pose again (springs step on the first pass only)
    let lift = 0;
    for (let pass = 0; pass < 3; pass++) {
      this._poseDead(D, dt, lift, pass === 0);
      const pen = this._sink(); if (pen <= 0.004 * s) break; lift += pen;
    }
  }
  /**
   * The body as capsules (bone segment + thickness), thickness measured from the figure's own mesh: for each bone, the
   * distance from the bone segment that 99% of the vertices it carries stay within (thighs count as trunk: they hang
   * off the pelvis, so only lifting the body clears them). Cached on the figure.
   */
  _caps() {
    const fig = this.fig; if (fig._caps) return fig._caps;
    const B = fig.b, segs = [['Hips', 'Spine02', 't'], ['Spine02', 'Spine01', 't'], ['Spine01', 'Spine', 't'], ['Spine', 'neck', 't'], ['neck', 'Head', 't'], ['Head', 'head_end', 't']];
    for (const sd of ['Left', 'Right']) segs.push([sd + 'Shoulder', sd + 'Arm', 't'], [sd + 'Arm', sd + 'ForeArm', 'a' + sd], [sd + 'ForeArm', sd + 'Hand', 'a' + sd], [sd + 'Hand', '@hand', 'a' + sd], [sd + 'UpLeg', sd + 'Leg', 't'], [sd + 'Leg', sd + 'Foot', 'l' + sd], );
    // feet aren't capsule-shaped (the bone sits at the ankle, the sole well below): they get a measured box instead
    const caps = segs.filter(([a, b]) => B[a] && (b[0] === '@' || B[b])).map(([a, b, grp, fixed]) => ({ a, b, grp, r: (fixed || 0.05) * this.s, fixed: !!fixed }));
    let sk = null; fig.root.traverse((o) => { if (o.isSkinnedMesh && !sk) sk = o; });
    const shoe = {};
    if (sk) {
      const bones = sk.skeleton.bones, pos = sk.geometry.attributes.position, si = sk.geometry.attributes.skinIndex, sw = sk.geometry.attributes.skinWeight, v = V(), A = V(), Bp = V();
      const byBone = new Map(caps.map((c) => [c.a, []]));
      fig.root.updateMatrixWorld(true);
      // the shoe as a box in a frame that sits square with the figure when the foot is at rest (sole flat, toes forward)
      // and turns with the foot: tight around the shoe whatever way the foot bone's own axes happen to point
      const footInv = {}, gInv = this.cm.group.matrixWorld.clone().invert();
      for (const sd of ['Left', 'Right']) if (B[sd + 'Foot']) {
        shoe[sd] = new THREE.Box3(); const ank = fig.pos(sd + 'Foot', V()), dq = fig.quat(sd + 'Foot', Q()).multiply(fig.rest[sd + 'Foot'].q.clone().invert());
        footInv[sd] = new THREE.Matrix4().compose(ank, dq, _one).invert().multiply(gInv); // world -> shoe frame
      }
      for (let i = 0; i < pos.count; i += 2) {
        let w = 0, bi = -1; for (let c = 0; c < 4; c++) { const x = sw.getComponent(i, c); if (x > w) { w = x; bi = si.getComponent(i, c); } }
        const bn = bones[bi] && bones[bi].name, L = byBone.get(bn);
        const fsd = bn === 'LeftFoot' || bn === 'LeftToeBase' ? 'Left' : bn === 'RightFoot' || bn === 'RightToeBase' ? 'Right' : null;
        if (!L && !fsd) continue;
        v.fromBufferAttribute(pos, i); sk.applyBoneTransform(i, v); v.applyMatrix4(sk.matrixWorld);
        if (fsd && shoe[fsd]) shoe[fsd].expandByPoint(v.clone().applyMatrix4(footInv[fsd]));
        if (L) L.push(v.applyMatrix4(_m.copy(this.cm.group.matrixWorld).invert()).clone());
      }
      for (const c of caps) {
        const pts = byBone.get(c.a); if (c.fixed || !pts || pts.length < 8) continue;
        this._capEnds(c, A, Bp); const ab = Bp.clone().sub(A), l2 = Math.max(1e-6, ab.lengthSq());
        let d;
        if (c.b === '@hand') { // a hand is flat: what matters lying palm-down is its thickness across the palm
          const sd = c.a.startsWith('Left') ? 'Left' : 'Right', h = fig.hand[sd]; fig.quat(c.a, _q3); const n = h ? h.n.clone().applyQuaternion(_q3) : UP;
          d = pts.map((p) => Math.abs(p.clone().sub(A).addScaledVector(ab, -0.5).dot(n))).sort((x, y) => x - y);
        } else d = pts.map((p) => { const t = clamp(p.clone().sub(A).dot(ab) / l2, 0, 1); return p.distanceTo(A.clone().addScaledVector(ab, t)); }).sort((x, y) => x - y);
        c.r = d[Math.floor(d.length * 0.99)];
      }
    }
    // the shoulder and hip joints belong to the trunk: only lifting the body clears them
    for (const sd of ['Left', 'Right']) for (const [j, from] of [[sd + 'Arm', sd + 'Arm'], [sd + 'Leg', sd + 'UpLeg']]) { const c = caps.find((x) => x.a === from); if (c && B[j]) caps.push({ a: j, b: j, grp: 't', r: c.r }); }
    fig._shoe = shoe;
    return (fig._caps = caps);
  }
  /** How far the lowest corner of a shoe is under the ground (0 if none). */
  _shoeSink(side) {
    const fig = this.fig; this._caps(); const box = fig._shoe && fig._shoe[side]; if (!box || box.isEmpty()) return 0;
    fig.pos(side + 'Foot', _cb); fig.quat(side + 'Foot', _q3).multiply(_q2.copy(fig.rest[side + 'Foot'].q).invert());
    const M = _m.compose(_cb, _q3, _one); let lo = Infinity;
    for (let i = 0; i < 8; i++) { _ca.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(M); if (_ca.y < lo) lo = _ca.y; }
    return Math.max(0, 0.004 * this.s - lo);
  }
  /** Current end points of a capsule (group space). */
  _capEnds(c, A, Bp) {
    const fig = this.fig; fig.pos(c.a, A);
    if (c.b === '@hand') { const sd = c.a.startsWith('Left') ? 'Left' : 'Right', h = fig.hand[sd]; fig.quat(c.a, _q3); return h ? Bp.copy(h.palm).multiplyScalar(2).applyQuaternion(_q3).add(A) : Bp.copy(A); }
    if (c.b === '@toe') { const sd = c.a.startsWith('Left') ? 'Left' : 'Right'; fig.pos(sd + 'Foot', Bp); return Bp.sub(A).multiplyScalar(-0.6).add(A); }
    return fig.pos(c.b, Bp);
  }
  /** Deepest sinking (r - lowest point) of a capsule group: 't' trunk, 'aLeft' arm, 'lRight' leg... (0 if none). */
  _sink(grp = 't') {
    let pen = 0;
    for (const c of this._caps()) { if (c.grp !== grp) continue; this._capEnds(c, _ca, _cb); pen = Math.max(pen, c.r - _ca.y, c.r - _cb.y); }
    return pen;
  }
  _poseDead(D, dt, lift, step) {
    const cm = this.cm, fig = this.fig, g = cm.group, s = this.s, th = D.th, b = D.bk, thMax = 1.45;
    const ax = _p3.crossVectors(UP, D.dir).normalize(); _qd.setFromAxisAngle(ax, th);
    const pivot = _p2.copy(D.pivot).add(D.off);
    // pelvis: knees fold (height shrinks), the whole body pivots, never sinking into the ground
    const h = lerp(this.hipH * 0.96, (D.head ? 0.3 : 0.45) * s, b);
    _p.set(0, h, 0).applyQuaternion(_qd).add(pivot); _p.y = Math.max(_p.y, 0.06 * s);
    const w0 = smooth(0, 0.18, D.t); _p.lerpVectors(_v.copy(D.pel0).add(D.off), _p, w0); _p.y += lift;
    qE(_q, this.lowYaw ? clamp(wrapPi(this.lowYaw.x - this.yaw), -1, 1) : 0, 0, 0); _qp.copy(_qd).multiply(_q).multiply(_q2.setFromAxisAngle(ax, -0.25 * b));
    // trunk: arches with the fall, but the chest never rotates past flat; the head lags (whiplash) then settles
    const arch = Math.min(0.25 * smooth(0.3, 1, th / thMax) + 0.15 * b, Math.max(0, 1.5 - th));
    _qc.copy(_qd).multiply(_q2.setFromAxisAngle(ax, arch));
    const hx = Math.min(0.2 * smooth(0.6, 1, th / thMax), Math.max(0, 1.52 - th - arch));
    _qh.copy(_qc).multiply(_q2.setFromAxisAngle(ax, hx)).premultiply(qRV(_q3, D.hr));
    fig.begin(g); fig.setPelvis(_p, _qp);
    fig.setRot('Spine02', _q.copy(_qp).slerp(_qc, 0.33)); fig.setRot('Spine01', _q.copy(_qp).slerp(_qc, 0.66)); fig.setRot('Spine', _qc);
    fig.setRot('neck', _q.copy(_qc).slerp(_qh, 0.5)); fig.setRot('Head', _qh);
    // gun: carried by the chest as at the moment of death, then let go: it drops flat on its side beside the body
    fig.quat('Spine', _qs); fig.pos('Spine', _c);
    let gripW = 0;
    if (!D.gunRel && cm.gunMesh) { cm.gunMount.updateMatrixWorld(true); _m.compose(_c, _qs, _one).invert(); D.gunRel = new THREE.Matrix4().multiplyMatrices(_m, cm.gunMount.matrix); }
    if (D.gunRel && cm.gunMesh) {
      _m.compose(_c, _qs, _one).multiply(D.gunRel); _m.decompose(cm.gunMount.position, cm.gunMount.quaternion, _v);
      const rel = smooth(0.3, 0.9, th / thMax) * smooth(0.15, 0.7, D.t);
      if (!D.gunGround && th / thMax > 0.3) {
        const side = _o.set(-1, 0, 0).applyQuaternion(_qp); side.y = 0; side.normalize();
        const gy = Math.atan2(D.dir.x, D.dir.z) + 1.2 + (Math.random() - 0.5) * 0.8;
        D.gunGround = { p: _c.clone().addScaledVector(side, 0.38 * s).add(D.slide.clone().multiplyScalar(0.12)).setY(0.035 * s), q: qE(Q(), gy, 0, Math.PI / 2) };
      }
      if (D.gunGround) { cm.gunMount.position.lerp(D.gunGround.p, rel); cm.gunMount.quaternion.slerp(D.gunGround.q, rel); }
      cm.gunMount.position.y = Math.max(cm.gunMount.position.y, 0.035 * s); cm.gunMount.updateMatrixWorld(true);
      gripW = 1 - smooth(0.15, 0.5, rel);
    }
    // arms: the free hand flies out at once, the gun hand once the gun is let go; both whip out and settle on the ground
    for (const side of ['Left', 'Right']) {
      const sh = side === 'Left' ? _shL : _sh; fig.pos(side + 'Arm', sh);
      const spr = side === 'Left' ? D.sprL : D.sprR, sp = side === 'Left' ? D.armL : D.armR;
      _t.set(spr.x * s, spr.y * s, spr.z * s).applyQuaternion(_qc).add(sh);
      _t.y = lerp(Math.max(_t.y, 0.02 * s), 0.02 * s, smooth(0.45, 1, th / thMax)); // flung out, then down flat on the ground
      if (!D.armInit) { const last = side === 'Left' ? this.lastHandL : this._lastRP; const st0 = last || _t; sp.set(st0.x, st0.y, st0.z); }
      const a = step ? sp.step(_t.x, _t.y, _t.z, dt) : sp.x; _ank.set(a.x, Math.max(a.y, 0.02 * s), a.z);
      let F = null, N = null;
      if (side === 'Right' && gripW > 0 && cm.gunMesh) {
        const H = cm._fitHands({ reloading: false }); _mg.copy(g.matrixWorld).invert().multiply(cm.gunMesh.matrixWorld);
        _v.copy(H.Right).applyMatrix4(_mg); _ank.lerp(_v, gripW); if (gripW > 0.5) { F = _F.copy(H.RightF).transformDirection(_mg); N = _N.copy(H.RightN).transformDirection(_mg); }
      }
      // a limp hand lies flat, palm down, fingers pointing on from the arm
      if (!F) { F = _F.subVectors(_ank, sh).setY(0); if (F.lengthSq() < 1e-6) F.set(1, 0, 0); F.normalize(); N = _N.set(0, -1, 0); }
      // elbow out and up off the ground
      _pole.set(side === 'Left' ? 0.5 : -0.5, 0.35, -0.3).applyQuaternion(_qc).add(sh);
      fig.arm(side, _ank, F, N, _pole);
      fig.pos(side + 'ForeArm', _v); if (_v.y < 0.05 * s) { _pole.copy(sh).add(_o.set(0, 1, 0)); fig.arm(side, _ank, F, N, _pole); }
      for (let k = 0; k < 3; k++) { const pen = this._sink('a' + side); if (pen <= 0.003 * s) break; _ank.y += pen * 1.2; fig.arm(side, _ank, F, N, _pole); }
    }
    D.armInit = true;
    // legs: dragged along with the body, then splayed out in line with the trunk; one knee bent
    const lay = smooth(0.35, 1, th / thMax), bodyDown = _o.set(0, -1, 0).applyQuaternion(_qd);
    for (const side of ['Left', 'Right']) {
      const f = this.feet[side], hip = _hip.copy(this.hipJ[side]).applyQuaternion(_qp).add(_p);
      const a = D.ank[side] ? _ank.copy(D.ank[side]).add(D.off) : _ank.set(f.sgn * this.width, this.ankleH, 0).add(D.off);
      const bent = side === D.bend, L = this.L[side];
      const lie = _t.copy(hip).addScaledVector(bodyDown, L * (bent ? 0.62 : 0.95)); lie.x += f.sgn * D.legSpread * s; lie.y = Math.max(lie.y, this.ankleH + (bent ? 0.1 * s : 0));
      a.lerp(lie, lay);
      const d = a.distanceTo(hip); if (d > L * 0.97) a.sub(hip).multiplyScalar((L * 0.97) / d).add(hip);
      a.y = Math.max(a.y, this.ankleH);
      _pole.set(f.sgn * (bent ? 0.6 : 0.25), -0.1, 1).lerp(_v.set(f.sgn * (bent ? 0.7 : 0.3), 1, 0.2), smooth(0.2, 1, b)).normalize().multiplyScalar(0.6).add(hip);
      qE(_qf, 0, lerp(0, D.dir.z < 0 ? -0.6 : 1.0, lay), 0);
      fig.leg(side, a, _qf, _pole);
      fig.pos(side + 'Leg', _v); if (_v.y < 0.06 * s) { _pole.copy(hip).add(_v.set(f.sgn * 0.4, 1, 0)); fig.leg(side, a, _qf, _pole); }
      for (let k = 0; k < 3; k++) { const pen = Math.max(this._sink('l' + side), this._shoeSink(side)); if (pen <= 0.003 * s) break; a.y += pen * 1.2; fig.leg(side, a, _qf, _pole); }
    }
  }
}
