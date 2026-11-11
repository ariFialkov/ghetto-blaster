// First-person view model: gun + hands parented to the camera, with sway, bob, ADS, sprint, reload and recoil.
import * as THREE from 'three';
import { buildGunMesh, matteMat } from './character.js';
import { damp, lerp, clamp } from '../core/rng.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Spring, Spring3, smooth } from './spring.js';
import { pathAt, env } from './kinetic.js';
import { Figure } from './figure.js';
const _q = new THREE.Quaternion(), _M = new THREE.Matrix4(), _I = new THREE.Matrix4(), _tR = new THREE.Vector3(), _tL = new THREE.Vector3(), _FR = new THREE.Vector3(), _NR = new THREE.Vector3(), _FL = new THREE.Vector3(), _NL = new THREE.Vector3(), _P = new THREE.Vector3(), _A = new THREE.Vector3(), _pole = new THREE.Vector3(), _w = new THREE.Vector3();
const n3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// Sculpted toy-figure hands: four curled finger rings around the grip, a palm pad, a thumb, then a tapered forearm
// into a hoodie cuff. Built in a local frame where the grip runs along Y, the palm faces -Z and the fingertips +Z.
let HG = null;
const handGeo = () => HG || (HG = {
  finger: new THREE.TorusGeometry(0.024, 0.0118, 8, 14, Math.PI * 1.45),
  pinky: new THREE.TorusGeometry(0.021, 0.0105, 8, 14, Math.PI * 1.45),
  palm: new RoundedBoxGeometry(0.056, 0.088, 0.03, 3, 0.012),
  thumb: new THREE.CapsuleGeometry(0.0125, 0.034, 4, 8),
  arm: new THREE.CylinderGeometry(0.037, 0.03, 1, 12, 1, true),
  sleeve: new THREE.CylinderGeometry(0.056, 0.047, 1, 14),
  cuff: new THREE.TorusGeometry(0.049, 0.011, 8, 18),
});
const UP = new THREE.Vector3(0, 1, 0);
function toyHand(skin, sleeve, { cuffMat = sleeve, pos, rx = 0, ry = 0, rz = 0, armDir, thumbSide = 1 }) {
  const G = handGeo(), g = new THREE.Group(); g.position.copy(pos);
  const hand = new THREE.Group(); hand.rotation.set(rx, ry, rz, 'YXZ'); g.add(hand);
  [0.03, 0.01, -0.01, -0.03].forEach((y, i) => {
    const f = new THREE.Mesh(i === 3 ? G.pinky : G.finger, skin);
    f.rotation.set(Math.PI / 2, 0, Math.PI * 0.775); // arc spans 0..1.45pi; this puts the gap (centre 1.725pi) on +Z
    f.position.set(0, y, i === 3 ? -0.003 : 0); hand.add(f);
  });
  const palm = new THREE.Mesh(G.palm, skin); palm.position.set(0, -0.002, -0.026); hand.add(palm);
  const th = new THREE.Mesh(G.thumb, skin); th.position.set(0.026 * thumbSide, 0.036, 0.004); th.rotation.set(Math.PI / 2 - 0.25, 0, 0.5 * thumbSide); hand.add(th);
  // forearm runs from the wrist (behind and below the palm) along armDir, in the hands-group frame
  const wrist = new THREE.Vector3(0, -0.035, -0.04).applyEuler(hand.rotation);
  const dir = armDir.clone().normalize(), q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
  const seg = (geo, mat, from, len) => { const m = new THREE.Mesh(geo, mat); m.quaternion.copy(q); m.scale.set(1, len, 1); m.position.copy(wrist).addScaledVector(dir, from + len / 2); g.add(m); return m; };
  seg(G.arm, skin, -0.01, 0.14);
  seg(G.sleeve, sleeve, 0.12, 0.6);
  const cuff = new THREE.Mesh(G.cuff, cuffMat); cuff.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  cuff.position.copy(wrist).addScaledVector(dir, 0.125); g.add(cuff);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return g;
}


export class ViewModel {
  constructor(camera, { plastic = '#1e4fc0', skin = null, bareArms = false, body = null } = {}) {
    this.camera = camera;
    // the player's own arms: the same skinned figure (and paint) as their body that round, cut down to the arms and posed
    // onto the gun by IK. Toy hands are the fallback when the 3D models aren't loaded.
    if (body && body.tpl) {
      const f = new Figure(body.tpl, body.material, 1);
      if (f.ok && f.hand.Left && f.hand.Right) {
        this.arms = f.armsOnly(); this.armRig = new THREE.Group(); this.armRig.rotation.y = Math.PI; camera.add(this.armRig); this.armRig.add(f.root); this.armRig.visible = false;
        // the figure stands so its own shoulders sit just below and behind the eye (the rig's origin)
        const mid = f.rest.LeftArm.p.clone().add(f.rest.RightArm.p).multiplyScalar(0.5); f.root.position.set(-mid.x, -mid.y - 0.3, -mid.z - 0.06); f.root.updateMatrixWorld(true);
        f.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      }
    }
    this.root = new THREE.Group(); camera.add(this.root);
    this.pivot = new THREE.Group(); this.root.add(this.pivot); // recoil / reload offsets
    this.gunHolder = new THREE.Group(); this.gunHolder.rotation.y = Math.PI; this.pivot.add(this.gunHolder); // gun models point +Z; camera looks down -Z
    this.gun = null; this.weapon = null;
    // painted miniature hands: the player's figure's skin tone, the sleeve (or a wristband on bare arms) in the crew colour.
    // View-model lights are tuned for dark metal guns, so everything is painted a shade darker here to match the world.
    this.plastic = plastic; this.vmShade = 0.9;
    this.skinMat = matteMat(skin || '#7b4b2f', this.vmShade).clone(); this.sleeveMat = matteMat(plastic, this.vmShade * 0.88).clone();
    this.cuffMat = this.sleeveMat; if (bareArms) this.sleeveMat = this.skinMat;
    this.hands = new THREE.Group(); this.gunHolder.add(this.hands);
    this.sway = new THREE.Vector2(); this.kick = 0; this.kickRot = 0; this.adsBlend = 0; this.sprintBlend = 0; this.reloadBlend = 0; this.swapT = 0; this.bob = new THREE.Vector2();
    this.root.renderOrder = 10;
    this.root.visible = false;
    // motion springs: every transition (ADS, sprint, reload, lowering, landing, hits) carries velocity, nothing snaps
    this.sAds = new Spring(0, 3, 1); this.sSpr = new Spring(0, 2.4, 0.85); this.sRl = new Spring(0, 4, 1); this.sLow = new Spring(0, 4.5, 1);
    this.sway3 = new Spring3(3.4, 0.5); this.imp = new Spring3(2.8, 0.42); this.impR = new Spring3(3.2, 0.38);
    this.sStrafe = new Spring(0, 2.2, 1); this.sAir = new Spring(0, 3.5, 1);
    this.throwT = -1; this.callT = -1; this.wasGround = true; this.lastRlK = 0; this.rlEnv = 0; this.pending = null; this.swapPh = 1;
    // a free left hand for throwing equipment and calling in streaks (same axes as the gun: +X screen-left, +Z forward)
    this.freeRig = new THREE.Group(); this.freeRig.rotation.y = Math.PI; camera.add(this.freeRig); this.freeRig.visible = false; // on the camera, not the (lowered) gun rig
    this.freeHand = toyHand(this.skinMat, this.sleeveMat, { cuffMat: this.cuffMat, pos: new THREE.Vector3(), rx: -0.3, armDir: new THREE.Vector3(0.55, -0.6, -1), thumbSide: -1 });
    this.freeRig.add(this.freeHand);
    this.grenade = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10), new THREE.MeshStandardMaterial({ color: '#4a5530', roughness: 0.55, metalness: 0.2 }));
    this.grenade.scale.set(1, 1.2, 1); this.grenade.position.set(0, 0.02, 0.045); this.freeHand.add(this.grenade);
    this.phone = new THREE.Group(); const shell = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.1, 0.012, 2, 0.006), new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.4 }));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.084), new THREE.MeshBasicMaterial({ color: '#3cff8a' })); scr.position.z = -0.0065; scr.rotation.y = Math.PI;
    this.phone.add(shell, scr); this.phone.position.set(0, 0.03, -0.004); this.freeHand.add(this.phone);
    this.freeRig.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    // with the real arms, the free hand is the figure's own left hand: only the grenade / phone props stay
    if (this.arms) for (const c of this.freeHand.children) if (c !== this.grenade && c !== this.phone) c.visible = false;
  }
  /** One-off first-person actions: 'throw' (lethal / tactical), 'call' (score streak). */
  act(kind) { if (kind === 'throw') { this.throwT = 0; this.callT = -1; } else if (kind === 'call') { this.callT = 0; this.throwT = -1; } }
  /** Took a hit: the gun is knocked about and settles back. */
  onHit(strength = 1) {
    const k = Math.min(1.6, Math.max(0.3, strength));
    this.impR.kick((Math.random() - 0.5) * 3.5 * k, (Math.random() - 0.5) * 3.5 * k, (Math.random() - 0.5) * 2.5 * k); this.imp.kick(0, -0.12 * k, 0.18 * k);
  }
  /** Equip a weapon. While the gun is on screen, the old one is lowered out of view, swapped, and the new one raised. */
  setWeapon(w) {
    if (this.gun && this.root.visible && this.weapon !== w) { this.pending = w; this.swapPh = 0; this.swapDur = Math.min(0.7, Math.max(0.3, w.swapTime || 0.45)); return; }
    this.pending = null; this.swapPh = 1; this._build(w); this.swapT = 0.35;
  }
  _build(w) {
    if (this.gun) this.gunHolder.remove(this.gun);
    while (this.hands.children.length) this.hands.remove(this.hands.children[0]);
    this.weapon = w; this.gun = buildGunMesh(w, this.plastic, this.vmShade); this.gunHolder.add(this.gun);
    this.gun.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    const d = w.model, len = d.len, h = d.h;
    // right hand on the grip, left hand under the fore-end (pistols: left hand cups the right at the grip).
    // gun space: +Z toward the muzzle, and gun -X is screen right (the holder is turned 180deg).
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const fit = this.gun.userData.fit;
    this.leftHand = null;
    if (fit && this.arms) { this._armGrips(fit); return; }
    if (fit) { this._fitHands(fit, V); this.leftHand = this.hands.children[1] || null; this.leftBase = this.leftHand ? this.leftHand.position.clone() : null; return; }
    this.hands.add(toyHand(this.skinMat, this.sleeveMat, { cuffMat: this.cuffMat, pos: V(-0.005, -h / 2 - 0.07, len * 0.2 - 0.01), rx: -0.22, armDir: V(-0.28, -0.42, -1), thumbSide: 1 }));
    if (d.pistol) this.hands.add(toyHand(this.skinMat, this.sleeveMat, { cuffMat: this.cuffMat, pos: V(0.035, -h / 2 - 0.1, len * 0.2 + 0.012), rx: -0.12, rz: 0.35, armDir: V(0.6, -0.5, -1), thumbSide: -1 }));
    else {
      // the generated gun meshes don't follow the old box profile, so find the real underside of the fore-end
      const z = Math.min(len * 0.62, len - 0.06); let y = -h / 2 + 0.005;
      const under = this._underside(z); if (under !== null) y = under + 0.024;
      this.hands.add(toyHand(this.skinMat, this.sleeveMat, { cuffMat: this.cuffMat, pos: V(0.004, y, z), rx: -Math.PI / 2, rz: 0.15, armDir: V(0.95, -0.55, -0.75), thumbSide: -1 }));
    }
  }
  /**
   * Grip points for the real arms (gun space: palm centre, finger direction F, palm normal N), the same hold as the
   * third-person figure: shooting hand on the grip, support hand cupping the pistol hand, on the vertical grip, or palm
   * up under the handguard a third of the way along it.
   */
  _armGrips(f) {
    const pistol = f.hold === 'pistol';
    this.gripR = { p: new THREE.Vector3(-0.026, f.grip[1], f.grip[0]), F: pistol ? n3(0.1, -0.55, 0.83) : n3(0.2, -0.62, 0.76), N: n3(1, 0, 0) };
    if (pistol) this.gripL = { p: new THREE.Vector3(0.03, f.grip[1] - 0.014, f.grip[0] - 0.004), F: n3(-0.1, -0.6, 0.8), N: n3(-1, 0, 0) };
    else if (f.vgrip) this.gripL = { p: new THREE.Vector3(0.026, f.fore[2], f.fore[0]), F: n3(-0.15, -0.55, 0.82), N: n3(-1, 0, 0) };
    else { const z = f.fore[0] + (f.fore[1] - f.fore[0]) * 0.35, under = this._underside(z); this.gripL = { p: new THREE.Vector3(0.006, (under !== null ? under : f.fore[2]) - 0.026, z), F: n3(0.25, 0.12, 0.96), N: n3(-0.35, 0.94, 0) }; }
    this.leftBase = this.gripL.p.clone(); this.leftG = this.gripL.p.clone();
  }
  /**
   * Pose the real arms (rig space = the figure's own: +Z forward, +X its left, eye at the origin). Each arm's shoulder
   * sits at its natural spot below and behind the eye, sliding toward the hand only as far as needed to reach (it is
   * off screen either way), the hand lands on its grip with the grip's orientation, the elbow hangs down and out.
   */
  _poseArms() {
    const f = this.arms, rig = this.armRig, fit = this.gun && this.gun.userData.fit;
    rig.visible = this.root.visible && !!fit && !!this.gripR; if (!rig.visible) return;
    this.camera.updateMatrixWorld(true);
    f.begin(rig); _I.copy(rig.matrixWorld).invert(); _M.copy(_I).multiply(this.gun.matrixWorld); // gun -> rig space
    _tR.copy(this.gripR.p).applyMatrix4(_M); _FR.copy(this.gripR.F).transformDirection(_M); _NR.copy(this.gripR.N).transformDirection(_M);
    _tL.copy(this.leftG).applyMatrix4(_M); _FL.copy(this.gripL.F).transformDirection(_M); _NL.copy(this.gripL.N).transformDirection(_M);
    // throwing / calling in: the left hand leaves the gun for the grenade or the phone
    const k = this.throwT >= 0 ? this.throwT : this.callT;
    if (k >= 0) {
      const w = env(k, 0, 0.1, 0.9, 1);
      _w.setFromMatrixPosition(this.freeHand.matrixWorld).applyMatrix4(_I); _tL.lerp(_w, w);
      _FL.lerp(_w.set(0, 1, 0.2).normalize(), w).normalize(); _NL.lerp(_w.set(0.15, 0, -1).normalize(), w).normalize(); // palm toward you, fingers up
    }
    for (const [side, T, F, N] of [['Right', _tR, _FR, _NR], ['Left', _tL, _FL, _NL]]) {
      const sg = side === 'Left' ? 1 : -1, L = f.len[side], reach = (L[0] + L[1]) * 0.96 + 0.07;
      // shoulder at rest, then slid (with its shoulder bone, so the skin moves with it) only as far as reach needs
      const sh = f.b[side + 'Shoulder']; if (sh) { sh.position.copy(f.rest[side + 'Shoulder'].lp); sh.updateMatrixWorld(true); }
      f.pos(side + 'Arm', _A); const d = _A.distanceTo(T);
      if (d > reach && sh) { _P.subVectors(_A, T).normalize().multiplyScalar(reach).add(T); f.pos(side + 'Shoulder', _w).add(_P).sub(_A); f.setBonePos(side + 'Shoulder', _w); }
      f.pos(side + 'Arm', _P);
      _pole.set(sg * 0.35, -0.8, -0.15).add(_P);
      f.arm(side, T, F, N, _pole);
    }
    // the grenade / phone sits in the real left palm, just in front of it
    if (k >= 0) {
      const prop = this.throwT >= 0 ? this.grenade : this.phone; f.pos('LeftHand', _w); f.quat('LeftHand', _q);
      _P.copy(f.hand.Left.palm).applyQuaternion(_q).add(_w); _A.copy(f.hand.Left.n).applyQuaternion(_q).multiplyScalar(this.throwT >= 0 ? 0.045 : 0.03); _P.add(_A);
      rig.localToWorld(_P); this.freeHand.worldToLocal(_P); prop.position.copy(_P);
    }
  }
  _fitHands(f, V) {
    const H = (o) => this.hands.add(toyHand(this.skinMat, this.sleeveMat, { cuffMat: this.cuffMat, ...o }));
    // shooting hand: the finger rings wrap the pistol grip, raked back like the grip itself
    H({ pos: V(-0.004, f.grip[1], f.grip[0]), rx: f.hold === 'pistol' ? -0.18 : -0.26, armDir: V(-0.28, -0.42, -1), thumbSide: 1 });
    if (f.hold === 'pistol') { H({ pos: V(0.03, f.grip[1] - 0.028, f.grip[0] + 0.02), rx: -0.12, rz: 0.35, armDir: V(0.6, -0.5, -1), thumbSide: -1 }); return; }
    if (f.vgrip) { H({ pos: V(0.004, f.fore[2], f.fore[0]), rx: -0.1, armDir: V(0.9, -0.5, -0.8), thumbSide: -1 }); return; }
    // support hand cupped under the handguard, a third of the way along it
    const z = f.fore[0] + (f.fore[1] - f.fore[0]) * 0.35; const under = this._underside(z);
    H({ pos: V(0.004, (under !== null ? under : f.fore[2]) + 0.024, z), rx: -Math.PI / 2, rz: 0.15, armDir: V(0.95, -0.55, -0.75), thumbSide: -1 });
  }
  /**
   * ADS height (camera space y of the gun origin), from the gun's own mesh: the highest the gun can ride while every
   * part of it near the screen centre (sights, optic, rail, drum) stays at least ~1.4 deg below the crosshair, so
   * the point the bullets hit is never covered. Cached per weapon and ADS depth.
   */
  _adsY(adsZ) {
    const key = this.weapon.id + ':' + adsZ; if (this._adsKey === key) return this._adsYv;
    const M = 0.025, CONE = 0.12, g = this.gun, v = new THREE.Vector3(), rel = new THREE.Matrix4(), inv = new THREE.Matrix4();
    g.updateMatrixWorld(true); inv.copy(g.matrixWorld).invert();
    let need = -Infinity;
    g.traverse((o) => {
      if (!o.isMesh || !o.geometry.attributes.position) return;
      rel.multiplyMatrices(inv, o.matrixWorld); const pa = o.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(rel); // gun space: +z to the muzzle; the holder turns it to face -z
        const dist = v.z - adsZ; if (dist < 0.05 || Math.abs(v.x) / dist > CONE) continue;
        need = Math.max(need, v.y + M * dist);
      }
    });
    this._adsKey = key; this._adsYv = need > -Infinity ? -need : null; return this._adsYv;
  }
  /** Lowest surface of the gun mesh at gun-space depth z (null if the ray misses). */
  _underside(z) {
    const H = this.gunHolder; H.updateMatrixWorld(true);
    const o = H.localToWorld(new THREE.Vector3(0, -1, z)), up = H.localToWorld(new THREE.Vector3(0, 0, z)).sub(H.localToWorld(new THREE.Vector3(0, -1, z))).normalize();
    const hit = new THREE.Raycaster(o, up, 0, 2).intersectObject(this.gun, true)[0];
    return hit ? H.worldToLocal(hit.point.clone()).y : null;
  }
  muzzleWorld(out) { if (!this.gun) return out.copy(this.camera.position); return out.copy(this.gun.userData.muzzle).applyMatrix4(this.gun.matrixWorld); }
  onShot(w) { this.kick = Math.min(0.12, this.kick + w.recoilV * 0.02 + 0.015); this.kickRot = Math.min(0.25, this.kickRot + w.recoilV * 0.03); }
  /** st: { ads, sprint, moving, speed, onGround, vy, vRight, vFwd, reloading, reloadT, reloadTime, look:{dx,dy}, bobPhase, dead, hidden, lean, slide, crawl } */
  update(dt, st) {
    if (!this.gun || st.dead || st.hidden) { this.root.visible = false; this.freeRig.visible = false; if (this.armRig) this.armRig.visible = false; this.throwT = this.callT = -1; if (this.pending) { this._build(this.pending); this.pending = null; this.swapPh = 1; } return; }
    this.root.visible = true;
    dt = Math.min(dt, 0.05);
    // weapon swap: lower the old gun out of view, swap at the bottom, raise the new one
    let swapLow = 0;
    if (this.swapPh < 1) {
      this.swapPh = Math.min(1, this.swapPh + dt / (this.swapDur || 0.45));
      if (this.pending && this.swapPh >= 0.5) { this._build(this.pending); this.pending = null; this.swapT = 0; }
      swapLow = this.swapPh < 0.5 ? smooth(0, 0.5, this.swapPh) : 1 - smooth(0.5, 1, this.swapPh);
    }
    const w = this.weapon, d = w.model, fit = this.gun.userData.fit;
    const adsF = Math.min(7, Math.max(1.2, 0.9 / Math.max(0.08, w.adsTime)));
    const ads = this.adsBlend = clamp(this.sAds.step(st.ads ? 1 : 0, dt, adsF), 0, 1);
    const spr = this.sprintBlend = this.sSpr.step(st.sprint && st.moving && !st.ads ? 1 : 0, dt);
    const rl = this.reloadBlend = clamp(this.sRl.step(st.reloading ? 1 : 0, dt), 0, 1);
    this.swapT = Math.max(0, this.swapT - dt);
    // look inertia: the gun lags the turn and settles with a little overshoot; movement pushes it about
    const vr = st.vRight || 0, vf = st.vFwd || 0;
    const sw3 = this.sway3.step(clamp(-st.look.dx * 0.0025, -0.06, 0.06) - vr * 0.003, clamp(-st.look.dy * 0.0025, -0.06, 0.06), vf * 0.0025, dt);
    const strafe = this.sStrafe.step(clamp(vr / 6, -1, 1), dt);
    // airborne / landing / take-off
    const ground = st.onGround !== false, air = this.sAir.step(ground ? 0 : 1, dt);
    if (ground && !this.wasGround) { const k = Math.min(1.2, Math.max(0.25, -(this.lastVy || 0) * 0.12)); this.imp.kick(0, -0.55 * k, 0.1 * k); this.impR.kick(-1.6 * k, 0, (Math.random() - 0.5) * 0.6 * k); }
    if (!ground && this.wasGround && (st.vy || 0) > 1) { this.imp.kick(0, -0.3, 0); this.impR.kick(-0.6, 0, 0); }
    this.wasGround = ground; this.lastVy = st.vy || 0;
    // bob
    const bobA = st.moving && ground ? (st.sprint ? 0.022 : 0.011) * (1 - ads * 0.85) : 0;
    this.bob.x = damp(this.bob.x, Math.cos(st.bobPhase) * bobA, 12, dt); this.bob.y = damp(this.bob.y, Math.abs(Math.sin(st.bobPhase)) * bobA * 1.4, 12, dt);
    // recoil recovery
    this.kick = damp(this.kick, 0, 16, dt); this.kickRot = damp(this.kickRot, 0, 14, dt);
    // base poses
    const sightY = fit ? fit.sight : d.pistol ? h2(d) * 0.6 + 0.015 : (d.scope ? h2(d) + 0.035 + d.scope * 0 : h2(d) + 0.015);
    const hipPos = fit && d.pistol ? new THREE.Vector3(0.15, -0.17, -0.34) : new THREE.Vector3(0.17, -0.19 - (d.pistol ? 0.02 : 0), -0.36 - (d.pistol ? 0 : 0.05));
    // narrower views (split screen halves) bring the gun in so it sits in the same place on screen as on a wide one
    const xk = Math.min(1, Math.max(0.5, (this.camera.aspect || 1.78) / 1.78)); hipPos.x *= xk;
    const adsZ = -0.28 - (d.pistol ? 0 : 0.08);
    const fitY = this._adsY(adsZ);
    const adsPos = new THREE.Vector3(0, fitY !== null ? Math.min(-sightY, fitY) : -sightY, adsZ);
    const pos = hipPos.lerp(adsPos, ads);
    const rot = new THREE.Vector3(0, 0, 0);
    // sprint: lower and angle the gun
    pos.lerp(new THREE.Vector3(0.2 * xk, -0.21, -0.34), spr); rot.x -= spr * 0.3; rot.y += spr * 0.55; rot.z += spr * 0.2;
    // reload: roll the gun to present the magazine well; beats (mag out, mag in, charge) land as impulses
    const rt = st.reloadTime || 2, rk = st.reloading ? clamp(st.reloadT / rt, 0, 1) : this.lastRlK;
    if (st.reloading) this.rlEnv = env(rk, 0, 0.12, 0.86, 1);
    const re = rl * this.rlEnv;
    pos.y -= 0.03 * re; pos.x -= 0.02 * re; pos.z += 0.03 * re; rot.x += 0.1 * re; rot.z += 0.2 * re; rot.y += 0.14 * re;
    if (st.reloading) {
      const beat = (b, f) => { if (this.lastRlK < b && rk >= b) f(); };
      beat(0.22, () => { this.imp.kick(0, -0.2, 0); this.impR.kick(-0.7, 0, 0.5); });          // magazine out
      beat(0.54, () => { this.imp.kick(0, 0.32, 0); this.impR.kick(1.3, 0, -0.4); });          // new magazine slapped home
      beat(0.74, () => { this.imp.kick(0.05, 0, 0.35); this.impR.kick(0.7, 0.4, 0.2); });      // charging handle / slide
    }
    this.lastRlK = st.reloading ? rk : this.lastRlK;
    // the support hand does the magazine change (artist guns): to the mag, out of view for a fresh one, slap it in, rack
    if (fit && this.leftBase && (this.leftHand || this.arms)) {
      const P = this._rlPts || (this._rlPts = Array.from({ length: 8 }, () => new THREE.Vector3())), ks = [0, 0.16, 0.3, 0.44, 0.56, 0.7, 0.8, 1];
      const mag = fit.mag, pistol = fit.hold === 'pistol';
      P[0].copy(this.leftBase); P[1].set(0.02, mag[1] - 0.03, mag[0]); P[2].set(0.12, mag[1] - 0.36, mag[0] - 0.05); P[3].copy(P[2]);
      P[4].set(0.02, mag[1] - 0.015, mag[0]);
      if (pistol) P[5].set(0.0, fit.sight + 0.015, 0.02); else P[5].set(0.07, fit.sight * 0.5, fit.grip[0] + 0.07);
      P[6].copy(P[5]).add(new THREE.Vector3(0, 0, -0.06)); P[7].copy(this.leftBase);
      const hp = pathAt(this._rlHp || (this._rlHp = new THREE.Vector3()), P, ks, rk);
      if (this.arms) this.leftG.lerpVectors(this.leftBase, hp, rl); else this.leftHand.position.lerpVectors(this.leftBase, hp, rl);
    }
    // lowered: weapon swap, throwing, calling in a streak
    let actLow = 0;
    if (this.throwT >= 0) { this.throwT += dt / 0.72; if (this.throwT >= 1) this.throwT = -1; else actLow = env(this.throwT, 0, 0.12, 0.8, 1); }
    if (this.callT >= 0) { this.callT += dt / 1.15; if (this.callT >= 1) this.callT = -1; else actLow = env(this.callT, 0, 0.14, 0.86, 1); }
    const low = this.sLow.step(Math.max(swapLow, actLow), dt, swapLow > 0 ? 9 : 4.5);
    pos.y -= 0.34 * low; pos.x += 0.05 * low; rot.x -= 0.9 * low; rot.z -= 0.45 * low; rot.y -= 0.15 * low;
    this._freeHand(dt);
    // weapon swap from nothing (spawn): raise from below
    const swp = this.swapT / 0.35; pos.y -= swp * swp * 0.35; rot.x -= swp * 0.6;
    // slide: gun tilts in and drops slightly; crawl: gun lowered, rocking with each pull
    this.slideB = damp(this.slideB || 0, st.slide ? 1 : 0, 10, dt); this.crawlB = damp(this.crawlB || 0, st.crawl ? 1 : 0, 7, dt);
    pos.x -= this.slideB * 0.05; pos.y -= this.slideB * 0.035; rot.z += this.slideB * 0.42; rot.y -= this.slideB * 0.08;
    const cs = Math.sin(st.bobPhase * 0.5);
    pos.y -= this.crawlB * (0.05 + Math.abs(cs) * 0.025); pos.x += this.crawlB * (0.02 + cs * 0.03); rot.x -= this.crawlB * 0.18; rot.z += this.crawlB * (0.28 + cs * 0.12);
    // strafe roll, air lift, inertia, impulses, bob, recoil, lean
    rot.z -= strafe * 0.07 * (1 - ads * 0.7); pos.x -= strafe * 0.012 * (1 - ads);
    pos.y += air * 0.018 * (1 - ads * 0.5); rot.x += air * 0.04;
    const ip = this.imp.step(0, 0, 0, dt), ir = this.impR.step(0, 0, 0, dt);
    const am = 1 - ads * 0.6;
    pos.x += sw3.x * am + this.bob.x + ip.x * 0.1; pos.y += sw3.y * am + this.bob.y + ip.y * 0.1; pos.z += this.kick + sw3.z + ip.z * 0.1;
    rot.y += sw3.x * 1.5 * (1 - ads * 0.5); rot.x += sw3.y * 1.5 * (1 - ads * 0.5) + this.kickRot + ir.x * 0.1; rot.z += (st.lean || 0) * 0.06 + ir.z * 0.1; rot.y += ir.y * 0.1;
    // idle breathing
    const br = Math.sin((this.t = (this.t || 0) + dt) * 1.6) * (1 - (st.moving ? 1 : 0)); pos.y += br * 0.0025 * (1 - ads * 0.8); rot.x += br * 0.004 * (1 - ads * 0.8);
    this.root.position.copy(pos); this.root.rotation.set(rot.x, rot.y, rot.z);
    if (this.arms) this._poseArms();
  }
  /** The free left hand: a throw (reach, wind up, release, follow through) or a phone call-in for a streak. */
  _freeHand(dt) {
    const fh = this.freeHand, k = this.throwT >= 0 ? this.throwT : this.callT;
    this.freeRig.visible = k >= 0; if (k < 0) return;
    const P = this._fhPts || (this._fhPts = Array.from({ length: 6 }, () => new THREE.Vector3()));
    if (this.throwT >= 0) {
      P[0].set(0.26, -0.6, 0.4); P[1].set(0.2, -0.2, 0.36); P[2].set(0.3, -0.03, 0.28); P[3].set(0.06, 0.1, 0.62); P[4].set(-0.08, -0.26, 0.52); P[5].set(0.0, -0.75, 0.45);
      pathAt(fh.position, P, [0, 0.18, 0.32, 0.46, 0.64, 1], k);
      fh.rotation.set(0.6 * env(k, 0.1, 0.3, 0.32, 0.46) - 0.9 * env(k, 0.36, 0.48, 0.6, 0.9), 0.3 * env(k, 0.2, 0.32, 0.4, 0.6), 0);
      this.grenade.visible = k < 0.46; this.phone.visible = false;
    } else {
      P[0].set(0.2, -0.62, 0.4); P[1].set(0.1, -0.14, 0.36); P[2].set(0.1, -0.125, 0.36); P[3].set(0.1, -0.14, 0.36); P[4].set(0.2, -0.62, 0.4);
      pathAt(fh.position, P, [0, 0.26, 0.5, 0.74, 1], k);
      fh.position.y -= 0.01 * (env(k, 0.4, 0.44, 0.46, 0.5) + env(k, 0.56, 0.6, 0.62, 0.66)); // thumb presses
      fh.rotation.set(-0.35, 0.15, 0.1); this.grenade.visible = false; this.phone.visible = true;
    }
  }
  setColors(skin, sleeve) { this.skinMat.color.set(skin).multiplyScalar(this.vmShade); this.cuffMat.color.set(sleeve).multiplyScalar(this.vmShade * 0.88); }
}
const h2 = (d) => d.h / 2;
