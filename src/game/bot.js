// Bot AI: perception with reaction time, A* navigation, cover, strafing, bursts, grenades, personas.
// Movement goes through the same Body physics as the player so bots move with identical feel.
import * as THREE from 'three';
import { Actor } from './actor.js';
import { clamp, dampAngle, wrapAngle } from '../core/rng.js';
import { STEP_HEIGHT } from '../core/physics.js';

const _d = new THREE.Vector3(), _e = new THREE.Vector3(), _t = new THREE.Vector3();

export class Bot extends Actor {
  constructor(match, opts) {
    super(match, opts);
    this.initBrain(opts);
  }
  /** Bot brain state; also used to drive the player in headless simulations. */
  initBrain(opts = {}) {
    const rng = this.rng;
    this.skill = clamp(opts.skill ?? rng.float(0.35, 0.9), 0.1, 1);
    this.persona = opts.persona || rng.pick(['rusher', 'rusher', 'flanker', 'camper', 'balanced', 'balanced']);
    this.reaction = 0.8 - this.skill * 0.45 + rng.float(-0.05, 0.12);
    this.aggro = this.persona === 'rusher' ? 0.9 : this.persona === 'camper' ? 0.3 : 0.6;
    this.state = 'roam'; this.stateT = 0;
    this.path = null; this.pathI = 0; this.dest = null; this.repathT = 0; this.stuckT = 0; this.lastProgressPos = new THREE.Vector3(); this.progressT = 0;
    this.target = null; this.targetSeenT = -99; this.targetAcqT = 0; this.lastKnown = new THREE.Vector3(); this.aimErr = new THREE.Vector3(); this.aimErrT = 0; this.onTargetT = 0;
    this.desiredYaw = 0; this.desiredPitch = 0;
    this.strafeDir = 0; this.strafeT = 0; this.burstLeftN = 0; this.burstPauseT = 0; this.pauseT = 0; this.lookT = 0; this.lookYaw = 0;
    this.scanT = rng.float(0, 0.15); this.grenadeCd = rng.float(8, 20); this.crouchT = 0; this.jumpCd = 0; this.wantJump = false;
    this.campSpot = null; this.campT = 0;
    this.hunt = null; // director-assigned target to seek
    this.alertPos = null; this.alertT = 0;
    this.lastDist = 0;
  }
  // ---------------- perception ----------------
  perceive(dt) {
    const m = this.match;
    this.scanT -= dt; if (this.scanT > 0) return;
    this.scanT = 0.12 + (1 - this.skill) * 0.1;
    const eye = this.eye(new THREE.Vector3());
    let best = null, bestScore = -Infinity;
    const fwd = this.forward(new THREE.Vector3());
    for (const a of m.actors) {
      if (a === this || !a.alive || m.sameTeam(a, this) || a.hidden) continue;
      _d.subVectors(a.pos, this.pos); const dist = _d.length(); if (dist > 60) continue;
      const dot = _d.clone().normalize().dot(fwd);
      const recentlyHurtByThem = this.lastHitBy === a && m.time - this.lastHitT < 3;
      const loud = m.time - a.lastShotT < 1.5 && !a.weapon.def.suppressed && dist < 40;
      const inFov = dot > 0.2 || dist < 4 || recentlyHurtByThem || loud || this.target === a;
      if (!inFov) continue;
      const chest = a.chest(new THREE.Vector3());
      if (m.fx.inSmoke(chest) || m.fx.inSmoke(eye)) continue;
      if (!m.map.world.los(eye, chest) && !m.map.world.los(eye, new THREE.Vector3(chest.x, chest.y + 0.5, chest.z))) continue;
      let score = -dist + (this.target === a ? 15 : 0) + (recentlyHurtByThem ? 25 : 0) + (a.isPlayer ? m.director.playerAttractBias(this) : 0) + (this.hunt === a ? 40 : 0);
      if (score > bestScore) { bestScore = score; best = a; }
    }
    if (best) {
      if (this.target !== best) { this.target = best; this.targetAcqT = m.time + this.reaction * (this.fx.stun > 0 ? 2 : 1) * m.director.reactionMult(this); this.onTargetT = 0; this.aimErrT = 0; }
      this.targetSeenT = m.time; this.lastKnown.copy(best.pos);
    } else if (this.target && m.time - this.targetSeenT > 3.5) this.target = null;
  }
  // ---------------- navigation ----------------
  setDest(p, reason) { if (!p) return; this.dest = p.clone(); this.path = null; this.pathI = 0; this.repathT = 0; this.destReason = reason; }
  ensurePath() {
    if (!this.dest) return;
    if (!this.path) { const nav = this.match.map.nav; const from = nav.nearestWalkable(this.pos.x, this.pos.z, 3, this.pos.y) || this.pos; this.path = nav.path(from, this.dest, 5000); this.pathI = 0; if (!this.path) { this.dest = null; } }
  }
  followPath(dt, speed) {
    this.ensurePath();
    if (!this.path) { this.moveDir.set(0, 0, 0); return false; }
    let wp = this.path[this.pathI];
    while (wp && Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 0.9) { this.pathI++; wp = this.path[this.pathI]; }
    if (!wp) { this.path = null; this.dest = null; this.moveDir.set(0, 0, 0); return false; }
    _d.set(wp.x - this.pos.x, 0, wp.z - this.pos.z); const dist = _d.length(); _d.divideScalar(dist || 1);
    this.moveDir.copy(_d);
    // mantle if next waypoint is above us
    if (wp.y - this.pos.y > STEP_HEIGHT * 0.9 && dist < 1.6 && this.body.onGround) this.wantJump = true;
    // stuck detection
    this.progressT += dt;
    if (this.progressT > 1.2) { if (this.lastProgressPos.distanceTo(this.pos) < 0.5) { this.stuckT++; this.wantJump = true; if (this.stuckT > 2) { this.path = null; this.dest = null; this.stuckT = 0; } } else this.stuckT = 0; this.lastProgressPos.copy(this.pos); this.progressT = 0; }
    return true;
  }
  pickRoamDest() {
    const m = this.match, nav = m.map.nav, rng = this.rng;
    // bias toward recent action / enemies / map centre depending on persona
    const r = rng.next();
    if (this.hunt && this.hunt.alive && r < 0.8) return nav.randomPointNear(rng, this.hunt.pos.x, this.hunt.pos.z, 6, 12, this.hunt.pos.y);
    if (this.alertPos && m.time - this.alertT < 8 && r < 0.6) return nav.randomPointNear(rng, this.alertPos.x, this.alertPos.z, 8, 12, this.alertPos.y);
    const enemies = m.actors.filter((a) => a !== this && a.alive && !m.sameTeam(a, this));
    if (enemies.length && r < this.aggro * 0.7) { const e = rng.pick(enemies); return nav.randomPointNear(rng, e.pos.x, e.pos.z, 16 + (1 - this.aggro) * 20, 12, e.pos.y); }
    if (this.persona === 'camper' && r < 0.75) { const p = nav.findCover(this.pos, enemies.length ? rng.pick(enemies).pos : new THREE.Vector3(), rng, 22); if (p) return p; }
    if (r < 0.5) return nav.randomPointNear(rng, 0, 0, m.map.size * 0.3);
    return nav.randomPoint(rng);
  }
  // ---------------- main update ----------------
  update(dt) {
    const m = this.match;
    if (!this.moveDir) this.moveDir = new THREE.Vector3();
    if (!this.alive) { this.deadT += dt; this.speed = 0; this.moving = false; this.updateCommon(dt); return; }
    if (m.frozen) { this.moveDir.set(0, 0, 0); this.body.step(dt, this.moveDir, 0, false); this.speed = 0; this.moving = false; this.updateCommon(dt); return; }
    this.perceive(dt);
    this.stateT += dt; this.grenadeCd -= dt; this.jumpCd -= dt; this.crouchT -= dt;
    if (this.fx.knock > 0) { this.moveDir.set(0, 0, 0); this.body.wantCrouch = true; this.body.step(dt, this.moveDir, 0, false); this.speed = 0; this.moving = false; this.updateCommon(dt); return; }
    const t = this.target; const hasT = t && t.alive && m.time >= this.targetAcqT;
    const seesT = t && m.time - this.targetSeenT < 0.3;
    const w = this.weapon.def;
    const lowHp = this.health < 35;
    // ---- state transitions ----
    if (hasT && seesT) { if (this.state !== 'engage') { this.state = 'engage'; this.stateT = 0; this.strafeT = 0; } }
    else if (t && hasT && !seesT) { if (this.state === 'engage') { this.state = 'search'; this.stateT = 0; this.setDest(m.map.nav.nearestWalkable(this.lastKnown.x, this.lastKnown.z, 3, this.lastKnown.y), 'search'); } }
    if (this.state === 'engage' && lowHp && this.rng.chance(dt * 1.5 * (1 - this.aggro))) { this.state = 'cover'; this.stateT = 0; const c = m.map.nav.findCover(this.pos, t ? t.pos : this.pos, this.rng, 14); this.setDest(c, 'cover'); }
    if (this.state === 'search' && (this.stateT > 6 || (!this.dest && !this.path))) { this.state = 'roam'; this.stateT = 0; this.target = null; }
    if (this.state === 'cover' && (this.stateT > 5 || (this.health > 70 && this.stateT > 2) || (!this.dest && this.stateT > 1.5))) { this.state = 'roam'; this.stateT = 0; }
    // ---- behaviour ----
    let speed = 5.3 * this.effectiveSpeedMult(); this.sprint = false; this.ads = false; let wantCrouch = false;
    this.moveDir.set(0, 0, 0);
    if (this.state === 'engage' && t) {
      const dist = this.pos.distanceTo(t.pos);
      // aim
      const chest = t.chest(new THREE.Vector3()); const head = new THREE.Vector3(chest.x, chest.y + 0.5, chest.z);
      const aimAt = (this.skill > 0.7 && this.rng.chance(0.3)) ? head : chest;
      this.onTargetT += dt;
      this.aimErrT -= dt; if (this.aimErrT <= 0) { const err = (0.4 + (1 - this.skill) * 2.2) * Math.max(0.3, 1.5 - this.onTargetT * 0.5) * (t.moving ? 1.3 : 1) * m.director.aimErrorMult(this, t); this.aimErr.set(this.rng.gauss(0, err), this.rng.gauss(0, err * 0.6), this.rng.gauss(0, err)); this.aimErrT = 0.25 + this.rng.next() * 0.3; }
      const aimPoint = aimAt.clone().add(this.aimErr);
      const eye = this.eye(new THREE.Vector3());
      _e.subVectors(aimPoint, eye); const dxz = Math.hypot(_e.x, _e.z);
      this.desiredYaw = Math.atan2(_e.x, _e.z); this.desiredPitch = Math.atan2(_e.y, dxz);
      const turnRate = 5 + this.skill * 6;
      this.body.yaw = dampAngle(this.body.yaw, this.desiredYaw, turnRate, dt);
      this.pitch += (this.desiredPitch - this.pitch) * Math.min(1, dt * turnRate);
      const facing = Math.abs(wrapAngle(this.desiredYaw - this.body.yaw)) < 0.12;
      // range behaviour
      const ideal = w.type === 'shotgun' ? 6 : w.type === 'smg' ? 12 : w.type === 'sniper' || w.type === 'dmr' ? 40 : 20;
      this.ads = dist > (w.type === 'shotgun' ? 10 : 9) || w.scope;
      if (w.type === 'sniper' || w.type === 'dmr') wantCrouch = this.crouchT > 0 || (this.rng.chance(dt * 0.3) ? (this.crouchT = 2, true) : false);
      // strafe / approach
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeDir = this.rng.pick([-1, 1, 0, this.strafeDir]); this.strafeT = 0.5 + this.rng.next() * 1.2; }
      const right = new THREE.Vector3(Math.cos(this.body.yaw), 0, -Math.sin(this.body.yaw)); const fwd = this.forward(new THREE.Vector3());
      let advance = 0; if (dist > ideal * 1.4) advance = this.aggro > 0.4 || w.type === 'shotgun' ? 1 : 0.3; else if (dist < ideal * 0.5 && w.type !== 'shotgun' && w.type !== 'smg') advance = -0.6;
      if (this.persona === 'camper' && this.cover) advance = 0;
      this.moveDir.copy(right).multiplyScalar(this.strafeDir * 0.8).addScaledVector(fwd, advance);
      if (this.moveDir.lengthSq() > 1) this.moveDir.normalize();
      if (w.type === 'sniper' && this.ads) this.moveDir.multiplyScalar(0.2);
      speed *= 0.85;
      if (this.rng.chance(dt * 0.15) && this.jumpCd <= 0 && dist < 15) { this.wantJump = true; this.jumpCd = 4; }
      // fire control
      if (facing && m.time >= this.targetAcqT) {
        const los = m.map.world.los(eye, chest) || m.map.world.los(eye, head);
        if (los) {
          if (this.burstPauseT > 0) this.burstPauseT -= dt;
          else {
            const dir = aimPoint.clone().sub(eye).normalize();
            const acc = (1.6 + (1 - this.skill) * 2.2) * m.director.spreadMult(this, t);
            const fired = this.fire(eye, dir, true, acc, m.director.forcedHit(this, t));
            if (fired) { this.burstLeftN--; if (this.burstLeftN <= 0) { this.burstLeftN = w.type === 'sniper' || w.type === 'shotgun' || !w.auto ? 1 : 3 + Math.floor(this.rng.next() * 5 * this.skill + 1); this.burstPauseT = (w.type === 'sniper' ? 1.1 : w.type === 'shotgun' ? 0.5 : 0.3) + this.rng.next() * 0.7 * (1.3 - this.skill); } }
            if (this.weapon.mag === 0 && !this.reloading) { if (this.weapon.reserve > 0 && (dist > 10 || this.weapons.length < 2)) this.startReload(); else if (this.weapons.length > 1) this.swapWeapon(); }
          }
        }
      }
      // grenade
      if (this.grenadeCd <= 0 && dist > 10 && dist < 30 && this.equip.lethal.count > 0 && this.rng.chance(0.5)) { m.throwEquipment(this, 'lethal', t.pos); this.grenadeCd = 14 + this.rng.next() * 16; }
      else if (this.grenadeCd <= 0 && dist > 8 && dist < 26 && this.equip.tactical.count > 0 && !this.equip.tactical.def.passive) { m.throwEquipment(this, 'tactical', t.pos); this.grenadeCd = 12 + this.rng.next() * 16; }
      this.lastDist = dist;
    } else {
      // roam / search / cover: follow a path, look around naturally
      if (this.state === 'cover' && this.dest === null && this.path === null) { wantCrouch = true; if (this.weapon.mag < this.weapon.def.mag * 0.7) this.startReload(); }
      if (!this.dest && !this.path) {
        if (this.pauseT > 0) { this.pauseT -= dt; }
        else if (this.state === 'roam') { if (this.persona === 'camper' && this.campSpot && this.campT > 0) { this.campT -= dt; wantCrouch = this.rng.chance(0.5); } else { const p = this.pickRoamDest(); this.setDest(p, 'roam'); if (this.persona === 'camper' && this.rng.chance(0.5)) { this.campSpot = p; this.campT = 6 + this.rng.next() * 12; } } }
      }
      const moving = this.followPath(dt, speed);
      if (moving) {
        const want = Math.atan2(this.moveDir.x, this.moveDir.z);
        this.body.yaw = dampAngle(this.body.yaw, want, 6, dt);
        this.sprint = this.state === 'roam' && this.aggro > 0.4 && this.rng.next() < 0.995 && this.pos.distanceTo(this.dest || this.pos) > 8;
        if (this.sprint) speed = 7.0 * this.effectiveSpeedMult();
        this.pitch += (0 - this.pitch) * Math.min(1, dt * 4);
        if (!this.path) this.pauseT = this.rng.chance(0.4) ? this.rng.float(0.5, 2.5) : 0;
      } else {
        // idle look-around
        this.lookT -= dt; if (this.lookT <= 0) { this.lookYaw = this.body.yaw + this.rng.float(-1.2, 1.2); this.lookT = this.rng.float(0.8, 2.2); }
        this.body.yaw = dampAngle(this.body.yaw, this.lookYaw, 2.5, dt);
        this.pitch += (0 - this.pitch) * Math.min(1, dt * 3);
      }
      if (this.weapon.mag < this.weapon.def.mag * 0.5 && !this.reloading && this.weapon.reserve > 0 && this.rng.chance(dt * 0.8)) this.startReload();
      if (this.cur !== 0 && this.weapons.length > 1 && this.weapons[0].mag + this.weapons[0].reserve > 0 && this.rng.chance(dt * 0.5)) this.swapWeapon();
    }
    if (this.stationary) { this.moveDir.set(0, 0, 0); speed = 0; wantCrouch = true; }
    this.body.wantCrouch = wantCrouch;
    const jump = this.wantJump && this.body.onGround && !this.stationary; this.wantJump = false;
    this.body.step(dt, this.moveDir, speed, jump);
    const hv = Math.hypot(this.body.vel.x, this.body.vel.z); this.speed = hv; this.moving = hv > 0.4 && this.moveDir.lengthSq() > 0.01;
    this.updateCommon(dt);
  }
  onDamaged(amount, attacker) {
    if (attacker && attacker !== this && attacker.alive) { this.alertPos = attacker.pos.clone(); this.alertT = this.match.time; if (!this.target || this.target !== attacker) { this.target = attacker; this.targetAcqT = this.match.time + this.reaction * 0.5; this.targetSeenT = this.match.time; this.lastKnown.copy(attacker.pos); } }
  }
  onDied() { this.state = 'roam'; this.target = null; this.path = null; this.dest = null; this.hunt = null; }
  hearShot(shooter, pos) { if (!this.alive || this.state === 'engage') return; if (this.rng.chance(0.35 + this.aggro * 0.4)) { this.alertPos = pos.clone(); this.alertT = this.match.time; if (this.state === 'roam' && this.rng.chance(0.5)) { this.setDest(this.match.map.nav.randomPointNear(this.rng, pos.x, pos.z, 5, 12, pos.y), 'noise'); this.state = 'search'; this.stateT = 0; } } }
}
