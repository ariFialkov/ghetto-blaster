// Player controller: input -> movement, third-person over-the-shoulder camera, ADS, recoil, lean, equipment.
import * as THREE from 'three';
import { Actor } from './actor.js';
import { clamp, damp, lerp } from '../core/rng.js';

const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3(), _o = new THREE.Vector3(), _t = new THREE.Vector3(), _c = new THREE.Vector3();

export class Player extends Actor {
  constructor(match, opts) {
    super(match, { ...opts, isPlayer: true });
    this.camera = match.camera;
    this.yaw = opts.yaw || 0; this.pitch = 0;
    this.recoilP = 0; this.recoilY = 0; this.kickP = 0; this.kickY = 0;
    this.adsBlend = 0; this.fov = match.settings.fov || 75; this.curFov = this.fov;
    this.crouchToggle = false; this.bobPhase = 0; this.camShake = 0;
    this.camPos = new THREE.Vector3(); this.camTarget = new THREE.Vector3();
    this.frozen = true; // pre-match
    this.autoReloadT = -1;
    this.scopeOverlay = false;
    this.lastFireHeld = false;
    this.leanDir = 0;
    this.aimPoint = new THREE.Vector3();
    this.sensitivity = 1;
  }
  onSpawn() { this.yaw = this.body.yaw; this.pitch = 0; this.recoilP = 0; this.recoilY = 0; this.adsBlend = 0; this.crouchToggle = false; this.leanDir = 0; this.snapCamera = true; }
  update(dt, input) {
    const m = this.match;
    if (!this.alive) { this.deadT += dt; this.speed = 0; this.moving = false; this.updateCommon(dt); this.updateCamera(dt, true); return; }
    const w = this.weapon.def;
    // ---- look ----
    const adsScale = this.adsBlend > 0.5 ? clamp(w.adsFov / this.fov, 0.25, 1) : 1;
    const sens = 0.0022 * this.sensitivity * adsScale;
    if (!this.frozen && this.fx.stun <= 0) { this.yaw -= input.look.dx * sens; this.pitch -= input.look.dy * sens; }
    else if (!this.frozen) { this.yaw -= input.look.dx * sens * 0.3; this.pitch -= input.look.dy * sens * 0.3; }
    this.pitch = clamp(this.pitch, -1.35, 1.35);
    // recoil recovery
    const rec = w.recoilRecover;
    this.recoilP = damp(this.recoilP, 0, rec, dt); this.recoilY = damp(this.recoilY, 0, rec, dt);
    this.kickP = damp(this.kickP, 0, 18, dt); this.kickY = damp(this.kickY, 0, 18, dt);
    this.body.yaw = this.yaw;
    // ---- actions ----
    const P = input.pressed;
    if (P.has('crouch')) { if (m.input.crouchHold) this.body.wantCrouch = true; else this.crouchToggle = !this.crouchToggle; }
    if (m.input.crouchHold) this.body.wantCrouch = !!input.crouchDown; else this.body.wantCrouch = this.crouchToggle;
    if (P.has('reload')) this.startReload();
    if (P.has('swap') || P.has('w1') || P.has('w2')) { if (P.has('w1') && this.cur !== 0) this.swapWeapon(); else if (P.has('w2') && this.cur !== 1) this.swapWeapon(); else if (P.has('swap')) this.swapWeapon(); }
    if (P.has('lethal')) m.throwEquipment(this, 'lethal');
    if (P.has('tactical')) m.throwEquipment(this, 'tactical');
    for (let i = 0; i < 3; i++) if (P.has('streak' + (i + 1))) m.useStreak(this, i);
    if (m.input.mobile) { if (P.has('peekR')) this.leanDir = this.leanDir ? 0 : 1; } else this.leanDir = input.peek;
    this.lean = this.leanDir;
    // ADS
    const wantAds = input.ads && !this.frozen && this.swapT <= 0 && this.fx.stun <= 0;
    this.ads = wantAds;
    this.sprint = input.sprint && input.move.y > 0.3 && !this.ads && !this.reloading && this.fx.stun <= 0;
    if (this.sprint) this.crouchToggle = false, this.body.wantCrouch = m.input.crouchHold ? this.body.wantCrouch : false;
    // ---- movement ----
    const mv = input.move; const len = Math.hypot(mv.x, mv.y); const mx = len > 1 ? mv.x / len : mv.x, my = len > 1 ? mv.y / len : mv.y;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    _dir.set(sy * my + cy * mx, 0, cy * my - sy * mx);
    const base = this.sprint ? 7.2 : 5.3;
    let speed = base * this.effectiveSpeedMult();
    if (this.frozen) { _dir.set(0, 0, 0); speed = 0; }
    const jump = P.has('jump') && !this.frozen && this.fx.stun <= 0 && this.fx.knock <= 0;
    if (jump) { this.crouchToggle = false; this.body.wantCrouch = false; }
    this.body.step(dt, _dir, speed, jump);
    const hv = Math.hypot(this.body.vel.x, this.body.vel.z); this.speed = hv; this.moving = hv > 0.4 && (mx !== 0 || my !== 0);
    if (this.moving && this.body.onGround) { this.bobPhase += dt * hv * 1.6; if (Math.sin(this.bobPhase) > 0.98 && !this._stepped) { this._stepped = true; m.audio('step', this, null, { vol: this.sprint ? 0.9 : 0.5 }); } else if (Math.sin(this.bobPhase) < 0) this._stepped = false; }
    // ---- firing ----
    if (this.autoReloadT >= 0) { this.autoReloadT -= dt; if (this.autoReloadT < 0) { this.startReload(); } }
    const trigger = input.fire && !this.frozen && this.fx.stun <= 0;
    if (trigger && this.sprint) this.sprint = false;
    const semiTrigger = w.auto ? trigger : (trigger && !this.lastFireHeld);
    this.lastFireHeld = trigger;
    if ((semiTrigger || this.burstLeft > 0) && this.swapT <= 0) {
      this.computeAim();
      const origin = this.eye(new THREE.Vector3()); const dir = this.aimPoint.clone().sub(origin).normalize();
      if (this.fire(origin, dir, semiTrigger)) {
        const kickMult = this.ads ? 0.65 : 1;
        this.recoilP += w.recoilV * 0.012 * kickMult; this.recoilY += (this.rng.next() - 0.5) * w.recoilH * 0.012 * kickMult;
        this.kickP += w.recoilV * 0.01; this.kickY += (this.rng.next() - 0.5) * w.recoilH * 0.01;
        this.pitch += w.recoilV * 0.0035 * kickMult; // permanent climb (COD-like)
        this.camShake = Math.min(1, this.camShake + (w.type === 'sniper' || w.type === 'shotgun' ? 0.5 : 0.15));
      }
    } else if (trigger && this.weapon.mag === 0 && !this.reloading) { this.startReload(); }
    this.updateCommon(dt);
    this.updateCamera(dt, false);
  }
  /** Aim point: ray from camera through screen centre, hitting world or actors. */
  computeAim() {
    const cam = this.camera; cam.getWorldDirection(_dir);
    _o.copy(cam.position);
    const hit = this.match.traceBullet(this, _o, _dir, 400, null, true);
    if (hit) this.aimPoint.copy(hit.point); else this.aimPoint.copy(_o).addScaledVector(_dir, 400);
    // never aim behind the eye
    const eye = this.eye(_t); if (this.aimPoint.clone().sub(eye).dot(_dir) < 0.5) this.aimPoint.copy(eye).addScaledVector(_dir, 2);
    return this.aimPoint;
  }
  updateCamera(dt, dead) {
    const w = this.weapon.def; const cam = this.camera; const m = this.match;
    const adsRate = 1 / Math.max(0.08, w.adsTime);
    this.adsBlend = damp(this.adsBlend, this.ads && this.alive ? 1 : 0, adsRate * 3.5, dt);
    const scoped = !!w.scope && this.adsBlend > 0.9;
    this.scopeOverlay = scoped;
    const targetFov = lerp(this.fov, w.adsFov, this.adsBlend) + (this.sprint ? 4 : 0);
    this.curFov = damp(this.curFov, targetFov, 14, dt);
    if (Math.abs(cam.fov - this.curFov) > 0.05) { cam.fov = this.curFov; cam.updateProjectionMatrix(); }
    // pivot: eye + lean
    const eye = this.eye(new THREE.Vector3());
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const leanOff = this.model.lean * 0.5;
    const pivot = eye.clone().addScaledVector(right, leanOff);
    const pitch = this.pitch + this.recoilP, yaw = this.yaw + this.recoilY;
    const fwd = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    // offsets
    const back = lerp(2.6, 1.35, this.adsBlend) * (dead ? 1.6 : 1), side = lerp(0.75, 0.62, this.adsBlend), up = lerp(0.42, 0.26, this.adsBlend) - (this.body.crouch ? 0.15 : 0);
    let desired = pivot.clone().addScaledVector(fwd, -back).addScaledVector(right, side).addScaledVector(UP, up);
    if (scoped) desired = eye.clone().addScaledVector(fwd, 0.1);
    // collision: pull camera in if blocked
    const toCam = desired.clone().sub(pivot); const dist = toCam.length();
    if (dist > 0.05 && !scoped) { const hit = m.map.world.raycast(pivot, toCam.clone().divideScalar(dist), dist + 0.25); if (hit) desired.copy(pivot).addScaledVector(toCam.divideScalar(dist), Math.max(0.2, hit.t - 0.25)); }
    // smooth position (snappy but not rigid)
    if (this.snapCamera) { this.camPos.copy(desired); this.snapCamera = false; } else this.camPos.lerp(desired, 1 - Math.exp(-dt * (scoped ? 60 : 22)));
    // bob and shake
    this.camShake = damp(this.camShake, 0, 9, dt);
    const bobA = this.moving && this.body.onGround ? (this.sprint ? 0.035 : 0.015) * (1 - this.adsBlend * 0.7) : 0;
    const bob = new THREE.Vector3(Math.cos(this.bobPhase) * bobA, Math.abs(Math.sin(this.bobPhase)) * bobA * 1.2, 0);
    const shake = new THREE.Vector3((this.rng.next() - 0.5), (this.rng.next() - 0.5), 0).multiplyScalar(this.camShake * 0.03);
    cam.position.copy(this.camPos).add(bob).add(shake);
    const look = pivot.clone().addScaledVector(fwd, 50);
    cam.lookAt(look);
    cam.rotateZ(-this.model.lean * 0.06 + this.kickY * 0.5);
    cam.rotateX(this.kickP * 0.6);
    // hide own model when scoped
    this.model.setVisible(!scoped && !this.hidden);
    m.engine.updateSunTarget(this.body.pos);
  }
}
