// Skinned plastic figure driven by the procedural rig (toy reskin).
//
// CharacterModel keeps animating its invisible box-rig pivots exactly as before (hips, torso, neck, arms, legs,
// gun mount). Each frame Figure.apply() retargets that pose onto the generated mesh's 24-bone skeleton:
//  - hips / spine / neck / head copy the pivots' rotations (as deltas on top of the bind pose),
//  - arms use two-bone IK so both hands stay on the gun wherever the gun mount puts it,
//  - legs use two-bone IK towards the box rig's feet, so crouching and striding bend the knees.
// All maths happens in the CharacterModel group's space, so melt scaling and world placement don't matter.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _invG = new THREE.Matrix4(), _p = V(), _s = V(), _q = Q(), _q2 = Q(), _q3 = Q();
const _a = V(), _t = V(), _e = V(), _d = V(), _n = V(), _pole = V(), _tmp = V(), _tw1 = V(), _tw2 = V(), _tw3 = V(), _bend = V();
const _ta = V(), _hq = Q();

export class Figure {
  constructor(template, material, scale = 1) {
    this.root = SkeletonUtils.clone(template);
    this.root.scale.setScalar(scale);
    this.b = {};
    this.root.traverse((o) => {
      if (o.isBone) this.b[o.name] = o;
      if (o.isMesh) { o.material = material; o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
    });
    this.ok = ['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'].every((n) => this.b[n]);
    // bind pose in "group space" (the figure root's parent space; the root itself sits at identity apart from scale)
    this.root.updateMatrixWorld(true);
    this.rest = {};
    for (const [n, bone] of Object.entries(this.b)) {
      const p = V(), q = Q(), s = V(); bone.matrixWorld.decompose(p, q, s);
      this.rest[n] = { p, q, lq: bone.quaternion.clone(), lp: bone.position.clone(), dir: Y.clone().applyQuaternion(q) };
    }
    if (!this.ok) return;
    // rest bend axis per limb bone (group space, perpendicular to the bone): elbows bend back, knees bend forward.
    // _aim uses it to add twist, so a limb rolls to face its IK pole instead of only swinging (no corkscrewed wrists).
    for (const [names, ax] of [[['LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm'], [0, 0, -1]], [['LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'], [0, 0, 1]]]) {
      for (const n of names) { const r = this.rest[n], v = V().fromArray(ax); v.addScaledVector(r.dir, -v.dot(r.dir)); if (v.lengthSq() > 1e-6) r.bend = v.normalize(); }
    }
    const len = (a, b) => this.rest[a].p.distanceTo(this.rest[b].p);
    this.len = {
      Left: [len('LeftArm', 'LeftForeArm'), len('LeftForeArm', 'LeftHand')], Right: [len('RightArm', 'RightForeArm'), len('RightForeArm', 'RightHand')],
      LeftLeg: [len('LeftUpLeg', 'LeftLeg'), len('LeftLeg', 'LeftFoot')], RightLeg: [len('RightUpLeg', 'RightLeg'), len('RightLeg', 'RightFoot')],
    };
    this.ankleH = (this.rest.LeftFoot.p.y + this.rest.RightFoot.p.y) / 2;
    this.hand = { Left: this._handFrame('Left'), Right: this._handFrame('Right') };
    this.posScale = 1 / this.b.Hips.parent.matrixWorld.getMaxScaleOnAxis(); // group metres -> Armature units (cm)
  }
  /**
   * The hand sculpts are rigid (one bone, no fingers), so a grip is posed by orienting the whole hand. Measured in the
   * bind pose from the vertices the hand bone drives: the finger direction (wrist to the hand's centroid), the palm
   * normal (the hand's thinnest axis, signed so the fingers' curl goes towards it, falling back to facing the body),
   * and the palm centre's offset from the wrist, all in the hand bone's own frame.
   */
  _handFrame(side) {
    let sk = null; this.root.traverse((o) => { if (o.isSkinnedMesh && !sk) sk = o; });
    const bone = this.b[side + 'Hand']; if (!sk || !bone) return null;
    const idx = new Set(); sk.skeleton.bones.forEach((b, i) => { for (let p = b; p; p = p.parent) if (p === bone) { idx.add(i); break; } });
    const pos = sk.geometry.attributes.position, si = sk.geometry.attributes.skinIndex, sw = sk.geometry.attributes.skinWeight, pts = [], v = V();
    for (let i = 0; i < pos.count; i++) { let w = 0, bi = -1; for (let c = 0; c < 4; c++) { const x = sw.getComponent(i, c); if (x > w) { w = x; bi = si.getComponent(i, c); } } if (idx.has(bi)) { v.fromBufferAttribute(pos, i); sk.applyBoneTransform(i, v); pts.push(v.clone().applyMatrix4(sk.matrixWorld)); } }
    if (pts.length < 30) return null;
    const wrist = V().setFromMatrixPosition(bone.matrixWorld), c = pts.reduce((a, p) => a.add(p), V()).divideScalar(pts.length);
    const f = V().subVectors(c, wrist).normalize();
    // covariance across the finger axis: the smallest-spread direction is the palm normal
    const ref = Math.abs(f.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), a1 = V().crossVectors(f, ref).normalize(), a2 = V().crossVectors(f, a1);
    let s11 = 0, s22 = 0, s12 = 0; for (const p of pts) { const d = V().subVectors(p, c), x = d.dot(a1), y = d.dot(a2); s11 += x * x; s22 += y * y; s12 += x * y; }
    const th = 0.5 * Math.atan2(2 * s12, s11 - s22), major = V().addScaledVector(a1, Math.cos(th)).addScaledVector(a2, Math.sin(th)), n = V().crossVectors(f, major).normalize();
    // sign: the fingertips curl towards the palm; if the sculpt is too flat to tell, the palm faces the body
    const proj = pts.map((p) => V().subVectors(p, wrist).dot(f)), pmax = Math.max(...proj), pmin = Math.min(...proj);
    let tip = 0, nt = 0, mid = 0, nm = 0;
    pts.forEach((p, i) => { const t = (proj[i] - pmin) / (pmax - pmin), o = V().subVectors(p, c).dot(n); if (t > 0.8) { tip += o; nt++; } else if (t > 0.35 && t < 0.65) { mid += o; nm++; } });
    const curl = (nt ? tip / nt : 0) - (nm ? mid / nm : 0);
    // sign: sculpts are posed with the palms towards the body (A-pose, arms down) or facing down (T-pose, arms out).
    // (The fingers' curl is too slight on these mitten hands to tell reliably.)
    const toward = new THREE.Vector3(-Math.sign(wrist.x || 1), -0.6, 0).normalize();
    if (n.dot(toward) < 0) n.negate();
    const inv = this.rest[side + 'Hand'].q.clone().invert();
    return { f: f.applyQuaternion(inv), n: n.applyQuaternion(inv), palm: V().subVectors(c, wrist).multiplyScalar(0.8).applyQuaternion(inv), curl };
  }
  /** Group-space orientation for a hand bone so its fingers run along F and its palm faces N. */
  _handQ(side, F, N, out) {
    const h = this.hand[side]; const Fn = _tw1.copy(F).normalize(), Nn = _tw2.copy(N).addScaledVector(Fn, -N.dot(Fn)).normalize();
    const B = _tw3.crossVectors(Fn, Nn), bl = V().crossVectors(h.f, h.n);
    const mt = new THREE.Matrix4().makeBasis(Fn, Nn, B), ml = new THREE.Matrix4().makeBasis(h.f, h.n, bl);
    return out.setFromRotationMatrix(mt.multiply(ml.transpose()));
  }
  /** Trap House Armor: a molded plate carrier, shoulder plates and a helmet, parented to the chest, arm and head
   *  bones so they follow the pose. Built lazily the first time the streak is active. */
  setArmor(on, material) {
    if (!this.ok) return;
    if (!this.armor && on) this._buildArmor(material);
    if (this.armor) for (const a of this.armor) a.visible = on;
  }
  _buildArmor(material) {
    const R = this.rest, sh = R.LeftArm.p.distanceTo(R.RightArm.p), head = R.Head.p, chest = R.Spine02.p, hips = R.Hips.p;
    const box = (w, h, d, c) => { const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2), pa = g.attributes.position, v = V(); // pillowed box: corners pulled in
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i); const k = 1 - c * (Math.abs(v.x / (w / 2)) * Math.abs(v.y / (h / 2)) + Math.abs(v.y / (h / 2)) * Math.abs(v.z / (d / 2)) + Math.abs(v.x / (w / 2)) * Math.abs(v.z / (d / 2))) / 3; pa.setXYZ(i, v.x * k, v.y * k, v.z * k); }
      g.computeVertexNormals(); return g; };
    const mesh = (geo) => { const m = new THREE.Mesh(geo, material); m.castShadow = true; return m; };
    this.armor = [];
    const attach = (bone, obj, gx, gy, gz) => { // place obj at group-space rest position, keep it upright in the rest pose
      const bw = this.b[bone].matrixWorld, inv = new THREE.Matrix4().copy(bw).invert();
      const M = new THREE.Matrix4().compose(V().set(gx, gy, gz), Q(), V().setScalar(1)).premultiply(inv);
      M.decompose(obj.position, obj.quaternion, obj.scale); this.b[bone].add(obj); obj.visible = false; this.armor.push(obj);
    };
    const neckY = R.neck.p.y, top = neckY - (neckY - hips.y) * 0.04, bot = hips.y + (neckY - hips.y) * 0.3, torsoH = Math.max(0.2, top - bot);
    const vest = new THREE.Group(); vest.add(mesh(box(sh * 1.6, torsoH, sh * 1.2, 0.45)));
    const pouch = box(sh * 0.17, sh * 0.16, sh * 0.1, 0.4); for (const x of [-0.24, 0, 0.24]) { const p = mesh(pouch); p.position.set(x * sh * 1.5, -torsoH * 0.28, sh * 0.62); vest.add(p); }
    const collar = mesh(new THREE.TorusGeometry(sh * 0.3, sh * 0.08, 8, 16)); collar.rotation.x = Math.PI / 2; collar.position.y = torsoH * 0.5; vest.add(collar);
    attach('Spine02', vest, chest.x, (top + bot) / 2, chest.z + sh * 0.04);
    for (const side of ['Left', 'Right']) { const a = R[side + 'Arm'].p; const pad = mesh(box(sh * 0.42, sh * 0.16, sh * 0.48, 0.6)); attach(side + 'Arm', pad, a.x * 1.05, a.y + sh * 0.1, a.z); }
    const hr = sh * 0.44, helm = new THREE.Group();
    const dome = mesh(new THREE.SphereGeometry(hr, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)); dome.scale.set(1, 0.92, 1.08); helm.add(dome);
    const brim = mesh(new THREE.CylinderGeometry(hr * 1.06, hr * 1.1, hr * 0.12, 18)); brim.position.y = hr * 0.05; helm.add(brim);
    const visor = mesh(box(hr * 1.5, hr * 0.42, hr * 0.2, 0.5)); visor.position.set(0, -hr * 0.2, hr * 0.95); helm.add(visor);
    attach('Head', helm, head.x, head.y + hr * 0.75, head.z + hr * 0.05);
  }
  // ---- helpers (all in group space) ----
  _driverQ(obj, out) { _m.multiplyMatrices(_invG, obj.matrixWorld); _m.decompose(_p, out, _s); return out; }
  _driverPos(obj, local, out) { out.copy(local); obj.localToWorld(out); return out.applyMatrix4(_invG); }
  _pos(name, out) { return out.setFromMatrixPosition(this.b[name].matrixWorld).applyMatrix4(_invG); }
  _setRootQ(name, qRoot) {
    const bone = this.b[name]; _m.multiplyMatrices(_invG, bone.parent.matrixWorld); _m.decompose(_p, _q3, _s);
    bone.quaternion.copy(_q3.invert().multiply(qRoot)); bone.updateMatrixWorld(true);
  }
  /** Point a bone along `dir` (group space). With `bend`, also roll it about `dir` so its rest bend axis faces `bend`. */
  _aim(name, dir, bend = null) {
    const r = this.rest[name], d = _tmp.copy(dir).normalize();
    _q2.setFromUnitVectors(r.dir, d);
    if (bend && r.bend) {
      const cur = _tw1.copy(r.bend).applyQuaternion(_q2), want = _tw2.copy(bend).addScaledVector(d, -bend.dot(d));
      if (want.lengthSq() > 1e-8) { want.normalize(); const ang = Math.atan2(_tw3.crossVectors(cur, want).dot(d), cur.dot(want)); _q3.setFromAxisAngle(d, ang); _q2.premultiply(_q3); }
    }
    _q2.multiply(r.q); this._setRootQ(name, _q2);
  }
  /** Two-bone IK: aims `upper` and `lower` so the chain's end reaches `target` with the middle joint towards `pole`. */
  _ik(upper, lower, [l1, l2], target, pole) {
    this._pos(upper, _a); _d.subVectors(target, _a);
    const dist = Math.min(Math.max(_d.length(), 1e-4), (l1 + l2) * 0.999); _n.copy(_d).normalize();
    const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    _pole.sub(_a); _pole.addScaledVector(_n, -_pole.dot(_n)); if (_pole.lengthSq() < 1e-8) _pole.set(0, -1, 0); _pole.normalize();
    _e.copy(_a).addScaledVector(_n, x).addScaledVector(_pole, h);
    _bend.copy(_pole); // perpendicular to the chain, towards the elbow / knee
    this._aim(upper, _tmp.subVectors(_e, _a), _bend);
    this._aim(lower, _d.subVectors(target, _e), _bend);
  }
  // ---- direct posing (kinetic animator, src/game/kinetic.js): everything in the CharacterModel group's space ----
  /** Start a pose: caches the group transform. */
  begin(group) { group.updateMatrixWorld(true); _invG.copy(group.matrixWorld).invert(); }
  /** Hips bone at group-space position `pos`, rotated by the group-space delta `dq` from its bind pose. */
  setPelvis(pos, dq) {
    const bone = this.b.Hips; _m.multiplyMatrices(_invG, bone.parent.matrixWorld).invert();
    bone.position.copy(pos).applyMatrix4(_m);
    this._setRootQ('Hips', _q.copy(dq).multiply(this.rest.Hips.q));
  }
  /** Place a bone's origin at group-space position `pos` (moves it within its parent; the bone keeps its rotation). */
  setBonePos(name, pos) {
    const bone = this.b[name]; _m.multiplyMatrices(_invG, bone.parent.matrixWorld).invert();
    bone.position.copy(pos).applyMatrix4(_m); bone.updateMatrixWorld(true);
  }
  /**
   * Keep only the arms (shoulder, upper arm, forearm, hand) of the skinned mesh: triangles whose vertices are all mainly
   * carried by those bones. Used for the first-person arms, so they are the same model and paint as the body.
   */
  armsOnly() {
    const arm = new Set(['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']);
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.isSkinnedMesh) { o.visible = false; return; }
      const g = o.geometry.clone(), si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = o.skeleton.bones;
      const isArm = new Uint8Array(g.attributes.position.count);
      // a vertex counts when it's mainly carried by the arm or shoulder bones (the cut edge then sits at the torso, off screen)
      for (let i = 0; i < isArm.length; i++) { let w = 0; for (let c = 0; c < 4; c++) { const bn = bones[si.getComponent(i, c)]; if (bn && arm.has(bn.name)) w += sw.getComponent(i, c); } isArm[i] = w >= 0.6 ? 1 : 0; }
      const src = g.index ? g.index.array : Array.from({ length: isArm.length }, (_, i) => i), keep = [];
      for (let t = 0; t < src.length; t += 3) if (isArm[src[t]] && isArm[src[t + 1]] && isArm[src[t + 2]]) keep.push(src[t], src[t + 1], src[t + 2]);
      g.setIndex(keep); o.geometry = g; o.castShadow = false;
    });
    return this;
  }
  /** Any bone to (group-space delta) x (bind orientation). */
  setRot(name, dq) { this._setRootQ(name, _q.copy(dq).multiply(this.rest[name].q)); }
  /** Bone position in group space. */
  pos(name, out) { return this._pos(name, out); }
  /** Bone orientation in group space. */
  quat(name, out) { _m.multiplyMatrices(_invG, this.b[name].matrixWorld); _m.decompose(_p, out, _s); return out; }
  /**
   * Arm IK: palm centre to `target`; with F/N (finger direction, palm normal) the hand is oriented and the wrist placed
   * so the oriented palm lands on the target. `pole`: a point the elbow bends towards. All group space.
   */
  arm(side, target, F, N, pole) {
    _ta.copy(target); let hq = null;
    if (F && N && this.hand[side]) { hq = this._handQ(side, F, N, _hq); _ta.sub(_d.copy(this.hand[side].palm).applyQuaternion(hq)); }
    _pole.copy(pole);
    this._ik(side + 'Arm', side + 'ForeArm', this.len[side], _ta, _pole);
    if (hq) this._setRootQ(side + 'Hand', hq);
    else { this.b[side + 'Hand'].quaternion.copy(this.rest[side + 'Hand'].lq); this.b[side + 'Hand'].updateMatrixWorld(true); }
  }
  /**
   * First-person arm: like arm(), but the wrist stays natural. A real wrist bends a limited amount and barely
   * twists; the forearm does the rolling (pronation). So the forearm turns toward the hand's own axis until the wrist
   * bends no more than `maxBend` (radians), the shoulder (off screen in first person) slides so the upper arm still
   * reaches the elbow, and the forearm takes the hand's roll so the wrist has no twist left.
   */
  armFP(side, target, F, N, pole, maxBend = 0.42) {
    const h = this.hand[side]; if (!h) { this.arm(side, target, F, N, pole); return; }
    const hq = this._handQ(side, F, N, Q()), [l1, l2] = this.len[side];
    const W = V().copy(h.palm).applyQuaternion(hq).negate().add(target); // the wrist
    const Qd = hq.clone().multiply(_q.copy(this.rest[side + 'Hand'].lq).invert()); // forearm frame for a straight wrist
    const D0 = V().copy(Y).applyQuaternion(Qd); // ... and its direction (bones run along +Y)
    // where the elbow would naturally go from the current shoulder, bending toward the pole
    const A = this._pos(side + 'Arm', V()), d = V().subVectors(W, A), dist = Math.min(Math.max(d.length(), 1e-4), (l1 + l2) * 0.999); d.normalize();
    const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), hh = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const pl = V().copy(pole).sub(A); pl.addScaledVector(d, -pl.dot(d)); if (pl.lengthSq() < 1e-8) pl.set(0, -1, 0); pl.normalize();
    const E = V().copy(A).addScaledVector(d, x).addScaledVector(pl, hh);
    // forearm direction: the natural one, turned toward the hand's axis until the wrist bend is within limits
    const Dn = V().subVectors(W, E).normalize(), ang = Dn.angleTo(D0);
    if (ang > maxBend) {
      const ax = V().crossVectors(D0, Dn); if (ax.lengthSq() < 1e-10) ax.set(1, 0, 0); ax.normalize();
      Dn.copy(D0).applyAxisAngle(ax, maxBend);
      E.copy(W).addScaledVector(Dn, -l2);
      // the shoulder slides so the upper arm (length l1) meets the new elbow from as close to where it was as it can
      const A2 = V().subVectors(A, E); if (A2.lengthSq() < 1e-8) A2.set(0, 0, -1); A2.normalize().multiplyScalar(l1).add(E);
      const sh = side + 'Shoulder';
      if (this.b[sh]) { this.setBonePos(sh, this._pos(sh, V()).add(A2).sub(A)); }
    }
    // solve with the elbow on its chosen spot (pole pushed out from the chain through it)
    const A3 = this._pos(side + 'Arm', V()), mid = V().addVectors(A3, W).multiplyScalar(0.5), p2 = V().subVectors(E, mid);
    _pole.copy(p2.lengthSq() > 1e-8 ? p2.normalize().multiplyScalar(0.3).add(E) : pole);
    this._ik(side + 'Arm', side + 'ForeArm', this.len[side], W, _pole);
    // pronation: the forearm rolls about its own axis to take the twist the wrist would otherwise carry. With the elbow
    // near straight the upper arm shares it (it can rotate freely then), so a reaching arm doesn't wring at the elbow.
    const twistOf = (bone) => { const dl = this.quat(bone, Q()).invert().multiply(Qd), t = Q().set(0, dl.y, 0, dl.w); if (t.lengthSq() < 1e-10) return 0; t.normalize(); if (t.w < 0) t.set(-t.x, -t.y, -t.z, -t.w); return Math.sign(t.y) * 2 * Math.acos(Math.min(1, t.w)); };
    const roll = (bone, a) => { if (!a) return; const b = this.b[bone]; b.quaternion.multiply(_q.setFromAxisAngle(Y, a)); b.updateMatrixWorld(true); };
    const Ae = this._pos(side + 'Arm', V()), Ee = this._pos(side + 'ForeArm', V()), elbow = V().subVectors(Ae, Ee).angleTo(V().subVectors(W, Ee)); // pi = straight
    const share = Math.min(1, Math.max(0, (elbow - 2.4) / 0.6)) * 0.5;
    if (share > 0) { // turn the whole arm about the shoulder-wrist line: the hand stays put, the elbow barely moves
      const ax = V().subVectors(W, Ae).normalize(), R = Q().setFromAxisAngle(ax, twistOf(side + 'ForeArm') * share);
      this._setRootQ(side + 'Arm', R.multiply(this.quat(side + 'Arm', Q())));
    }
    roll(side + 'ForeArm', Math.max(-1.6, Math.min(1.6, twistOf(side + 'ForeArm')))); // a forearm rolls about 90 degrees either way
    this._setRootQ(side + 'Hand', hq);
  }
  /** Leg IK: ankle to `ankle`, knee towards `pole`, foot turned by the group-space delta `footQ`. */
  leg(side, ankle, footQ, pole) {
    _ta.copy(ankle); _pole.copy(pole);
    this._ik(side + 'UpLeg', side + 'Leg', this.len[side + 'Leg'], _ta, _pole);
    this.setRot(side + 'Foot', footQ);
  }
  /**
   * cm: the CharacterModel (pivots already posed this frame). hands: { obj, Right, Left } grip points in obj's local
   * space (the gun mesh), or null so the hands follow the box arms. Feet follow the box legs' soles.
   */
  apply(cm, hands) {
    if (!this.ok) return;
    cm.group.updateMatrixWorld(true); _invG.copy(cm.group.matrixWorld).invert();
    const R = this.rest, b = this.b;
    // hips: position offset from the rig's rest height, rotation delta on the bind pose
    const dh = this._driverPos(cm.hips.parent, cm.hips.position, V()).sub(_tmp.set(0, 0.95 * cm.scale, 0));
    b.Hips.position.copy(R.Hips.lp).addScaledVector(dh, this.posScale);
    const qh = this._driverQ(cm.hips, Q()), qt = this._driverQ(cm.torso, Q()), qn = this._driverQ(cm.neck, Q());
    this._setRootQ('Hips', _q.copy(qh).multiply(R.Hips.q));
    this._setRootQ('Spine02', _q.copy(qh).slerp(qt, 0.34).multiply(R.Spine02.q));
    this._setRootQ('Spine01', _q.copy(qh).slerp(qt, 0.67).multiply(R.Spine01.q));
    this._setRootQ('Spine', _q.copy(qt).multiply(R.Spine.q));
    this._setRootQ('neck', _q.copy(qn).multiply(R.neck.q));
    this._setRootQ('Head', _q.copy(qn).multiply(R.Head.q));
    // arms: hands on the gun (or following the box arms), elbows down/out/back
    for (const side of ['Right', 'Left']) {
      const sgn = side === 'Right' ? -1 : 1, arm = side === 'Right' ? cm.armR : cm.armL;
      if (hands && hands[side]) this._driverPos(hands.obj, hands[side], _t); else this._driverPos(arm, _tmp.set(0, -0.62 * cm.scale, 0), _t);
      const poleOf = () => { this._pos(side + 'Arm', _pole); _pole.add(_e.set(sgn * 0.45, -0.8, -0.55).applyQuaternion(qt)); return _pole; };
      const orient = hands && hands[side + 'F'] && this.hand[side];
      let hq = null;
      if (orient) {
        // the target is the palm centre, with the hand oriented by finger direction and palm normal (gun space):
        // place the wrist so the oriented hand's palm lands on the target
        const m4 = _m.multiplyMatrices(_invG, hands.obj.matrixWorld); // directions only: transformDirection drops translation
        hq = this._handQ(side, _a.copy(hands[side + 'F']).transformDirection(m4), _n.copy(hands[side + 'N']).transformDirection(m4), Q());
        _t.sub(_d.copy(this.hand[side].palm).applyQuaternion(hq));
      }
      this._ik(side + 'Arm', side + 'ForeArm', this.len[side], _t, poleOf());
      if (hq) this._setRootQ(side + 'Hand', hq);
      else { b[side + 'Hand'].quaternion.copy(R[side + 'Hand'].lq); b[side + 'Hand'].updateMatrixWorld(true); }
    }
    // legs: feet to the box rig's soles (ankle lifted), knees forward
    for (const side of ['Left', 'Right']) {
      this._driverPos(side === 'Left' ? cm.legL : cm.legR, _tmp.set(0, -0.95 * cm.scale, 0.04 * cm.scale), _t); _t.y += this.ankleH;
      this._pos(side + 'UpLeg', _pole); _pole.add(_e.set(0, -0.2, 1).applyQuaternion(qh));
      this._ik(side + 'UpLeg', side + 'Leg', this.len[side + 'Leg'], _t, _pole);
      this._setRootQ(side + 'Foot', _q.copy(qh).multiply(R[side + 'Foot'].q));
    }
  }
}
