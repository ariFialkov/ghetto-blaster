// Renderer, scene, lighting, and pooled visual effects.
import * as THREE from 'three';
import { tex, skyGradient } from './textures.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.08, 600);
    this.clock = new THREE.Clock();
    this.quality = 'high';
    this.onFrame = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.fx = new FX(this.scene);
    this._loop = this._loop.bind(this);
    this.running = false;
  }
  setQuality(q) {
    this.quality = q;
    const pr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? Math.min(pr, 1) : q === 'medium' ? Math.min(pr, 1.5) : Math.min(pr, 2));
    this.renderer.shadowMap.enabled = q !== 'low';
    if (this.sun) { this.sun.castShadow = q !== 'low'; this.sun.shadow.mapSize.setScalar(q === 'high' ? 2048 : 1024); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.scene.traverse((o) => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
  }
  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  setEnvironment(env) {
    const s = this.scene;
    // clear old lights
    for (const o of [...s.children]) if (o.isLight || o.userData.env) s.remove(o);
    s.background = skyGradient(env.skyTop, env.skyHorizon, env.skyBottom);
    s.fog = new THREE.Fog(new THREE.Color(env.fogColor), env.fogNear, env.fogFar);
    const hemi = new THREE.HemisphereLight(new THREE.Color(env.hemiSky), new THREE.Color(env.hemiGround), env.hemiIntensity ?? 0.9);
    hemi.userData.env = true; s.add(hemi);
    const sun = new THREE.DirectionalLight(new THREE.Color(env.sunColor), env.sunIntensity ?? 2.2);
    sun.position.set(env.sunDir[0], env.sunDir[1], env.sunDir[2]).multiplyScalar(80);
    sun.castShadow = this.quality !== 'low';
    sun.shadow.mapSize.setScalar(this.quality === 'high' ? 2048 : 1024);
    const sz = env.shadowSize || 90;
    sun.shadow.camera.left = -sz; sun.shadow.camera.right = sz; sun.shadow.camera.top = sz; sun.shadow.camera.bottom = -sz;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 300; sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.03;
    sun.userData.env = true; s.add(sun); s.add(sun.target); sun.target.userData.env = true;
    this.sun = sun; this.hemi = hemi;
    const amb = new THREE.AmbientLight(new THREE.Color(env.ambient || '#404048'), env.ambientIntensity ?? 0.25); amb.userData.env = true; s.add(amb);
  }
  // keep the shadow frustum centered on the camera target
  updateSunTarget(p) { if (!this.sun) return; const o = this.sun.position.clone().normalize(); this.sun.position.copy(p).addScaledVector(o, 120); this.sun.target.position.copy(p); this.sun.target.updateMatrixWorld(); }
  /** Compile every shader variant up front so the first shots/explosions don't hitch. */
  warmup() {
    const p = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(0, 0, 1);
    this.fx.muzzle(p, d, true); this.fx.tracer(p, p.clone().add(d)); this.fx.explosion(p, 1); this.fx.smoke(p, 1, 1); this.fx.impact(p, d); this.fx.blood(p);
    this.fx.update(0.001, this.camera);
    try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* ignore */ }
    this.fx.clear();
  }
  start() { if (this.running) return; this.running = true; this.clock.start(); requestAnimationFrame(this._loop); }
  stop() { this.running = false; }
  _loop() {
    if (!this.running) return;
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.fx.update(dt, this.camera);
    if (this.onFrame) this.onFrame(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

// ---------------- Effects ----------------
class FX {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.items = [];
    this.particleTex = tex('particle'); this.muzzleTex = tex('muzzle');
    // instanced-ish particle pool with Points
    this.MAX = 1500;
    const g = new THREE.BufferGeometry();
    this.pPos = new Float32Array(this.MAX * 3); this.pCol = new Float32Array(this.MAX * 3); this.pSize = new Float32Array(this.MAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.particleTex } }, transparent: true, depthWrite: false, vertexColors: true,
      vertexShader: `attribute float size; varying vec3 vC; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*(300.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC,t.a); if(gl_FragColor.a<0.02) discard; }`,
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; this.group.add(this.points);
    this.parts = []; // {p, v, life, maxLife, size, col, grav, drag}
    for (let i = 0; i < this.MAX; i++) this.pPos[i * 3 + 1] = -1000;
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.9, linewidth: 1 });
    this.smokes = [];
    // Fixed pool of dynamic lights. Adding/removing lights forces three.js to recompile every shader, so the
    // pool lives in the scene permanently and we only change intensity/position.
    this.lightPool = [];
    for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.position.set(0, -100, 0); this.group.add(l); this.lightPool.push({ l, life: 0, maxLife: 1, decay: true }); }
    this.spot = new THREE.SpotLight(0xffffff, 0, 80, 0.4, 0.5, 1.2); this.spot.position.set(0, -100, 0); this.group.add(this.spot); this.group.add(this.spot.target);
  }
  /** Borrow a pooled light. Returns the slot so callers can move it. */
  light(pos, color = 0xffffff, intensity = 5, dist = 10, life = 0.05, decay = true) {
    let slot = this.lightPool.find((s) => s.life <= 0); if (!slot) slot = this.lightPool.reduce((a, b) => (a.life < b.life ? a : b));
    slot.l.position.copy(pos); slot.l.color.set(color); slot.l.intensity = intensity; slot.l.distance = dist; slot.life = life; slot.maxLife = life; slot.decay = decay; slot.base = intensity;
    return slot;
  }
  _spawn(p, v, life, size, col, grav = 0, drag = 0) {
    if (this.parts.length >= this.MAX) this.parts.shift();
    this.parts.push({ p: p.clone(), v: v.clone(), life, maxLife: life, size, col, grav, drag });
  }
  impact(point, normal, kind = 'concrete') {
    const col = kind === 'blood' ? new THREE.Color(0.6, 0.05, 0.05) : kind === 'metal' ? new THREE.Color(1, 0.8, 0.3) : new THREE.Color(0.7, 0.65, 0.55);
    const n = kind === 'blood' ? 10 : 8;
    for (let i = 0; i < n; i++) {
      const v = normal.clone().multiplyScalar(2 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.3) * 3, (Math.random() - 0.5) * 3));
      this._spawn(point, v, 0.3 + Math.random() * 0.3, kind === 'blood' ? 0.9 : 0.5, col, 9, 2);
    }
    if (kind !== 'blood') { // dust puff
      for (let i = 0; i < 4; i++) this._spawn(point, normal.clone().multiplyScalar(0.5).add(new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.5, (Math.random() - 0.5))), 0.5, 2.5, new THREE.Color(0.5, 0.48, 0.45), -0.5, 3);
    }
  }
  tracer(from, to) {
    const g = new THREE.BufferGeometry().setFromPoints([from, to]);
    const l = new THREE.Line(g, this.tracerMat.clone()); l.frustumCulled = false;
    this.group.add(l); this.items.push({ obj: l, life: 0.06, kind: 'tracer' });
  }
  muzzle(pos, dir, big = false) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.muzzleTex, color: 0xffd090, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(pos).addScaledVector(dir, 0.15); s.scale.setScalar(big ? 0.9 : 0.5); s.material.rotation = Math.random() * 6;
    this.group.add(s); this.items.push({ obj: s, life: 0.045, kind: 'muzzle' });
    this.light(pos, 0xffb060, big ? 6 : 3, 8, 0.05);
  }
  explosion(pos, radius = 5) {
    for (let i = 0; i < 40; i++) { const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8 + 0.2, (Math.random() - 0.5)).normalize().multiplyScalar(4 + Math.random() * 10); this._spawn(pos, v, 0.5 + Math.random() * 0.6, 2.5, new THREE.Color(1, 0.4 + Math.random() * 0.4, 0.1), 6, 2); }
    for (let i = 0; i < 30; i++) { const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.6 + 0.3, (Math.random() - 0.5)).normalize().multiplyScalar(1 + Math.random() * 4); this._spawn(pos, v, 1.5 + Math.random() * 1.5, 6 + Math.random() * 6, new THREE.Color(0.2, 0.2, 0.2), -0.6, 1.5); }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.particleTex, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(pos); s.scale.setScalar(radius * 0.6); this.group.add(s); this.items.push({ obj: s, life: 0.25, kind: 'flash', grow: radius * 3 });
    this.light(pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffa040, 40, radius * 5, 0.35);
  }
  smoke(pos, radius = 5, life = 14) {
    const sprites = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.particleTex, color: 0xb0b0b8, transparent: true, opacity: 0.0, depthWrite: false }));
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * radius, Math.random() * radius * 0.6 + 0.5, (Math.random() - 0.5) * radius));
      s.scale.setScalar(radius * 0.8); this.group.add(s); sprites.push(s);
    }
    this.smokes.push({ sprites, life, maxLife: life, pos: pos.clone(), radius });
  }
  sparkTrail(pos) { this._spawn(pos, new THREE.Vector3((Math.random() - 0.5), Math.random(), (Math.random() - 0.5)), 0.4, 0.6, new THREE.Color(1, 0.6, 0.2), 4, 1); }
  blood(pos) { for (let i = 0; i < 14; i++) this._spawn(pos, new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), 0.5, 1.0, new THREE.Color(0.55, 0.03, 0.03), 9, 1); }
  casing(pos, right) { this._spawn(pos, right.clone().multiplyScalar(1.5 + Math.random()).add(new THREE.Vector3(0, 2 + Math.random(), 0)), 0.7, 0.35, new THREE.Color(0.9, 0.75, 0.3), 12, 0); }
  update(dt, camera) {
    // particles
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.v.y -= p.grav * dt; p.v.multiplyScalar(1 - p.drag * dt);
      p.p.addScaledVector(p.v, dt); if (p.p.y < 0.02) { p.p.y = 0.02; p.v.y *= -0.2; p.v.x *= 0.5; p.v.z *= 0.5; }
      const k = p.life / p.maxLife;
      this.pPos[n * 3] = p.p.x; this.pPos[n * 3 + 1] = p.p.y; this.pPos[n * 3 + 2] = p.p.z;
      this.pCol[n * 3] = p.col.r * k; this.pCol[n * 3 + 1] = p.col.g * k; this.pCol[n * 3 + 2] = p.col.b * k;
      this.pSize[n] = p.size * (p.grav < 0 ? (2 - k) : (0.5 + k * 0.5));
      n++;
    }
    for (let i = n; i < this.MAX; i++) this.pPos[i * 3 + 1] = -1000;
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true; g.setDrawRange(0, Math.max(n, 1));
    // timed items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.life -= dt;
      if (it.kind === 'flash') { it.obj.scale.addScalar(it.grow * dt); it.obj.material.opacity = Math.max(0, it.life * 4); }
      if (it.kind === 'tracer') it.obj.material.opacity = Math.max(0, it.life * 15);
      if (it.life <= 0) { this.group.remove(it.obj); if (it.obj.geometry) it.obj.geometry.dispose(); if (it.obj.material) it.obj.material.dispose(); this.items.splice(i, 1); }
    }
    for (const slot of this.lightPool) { if (slot.life > 0) { slot.life -= dt; if (slot.decay) slot.l.intensity = slot.base * Math.max(0, slot.life / slot.maxLife); if (slot.life <= 0) { slot.l.intensity = 0; slot.l.position.set(0, -100, 0); } } }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.life -= dt; const k = s.life / s.maxLife;
      const a = Math.min(1, (1 - k) * 6) * Math.min(1, k * 4) * 0.85;
      for (const sp of s.sprites) { sp.material.opacity = a; sp.position.y += dt * 0.15; sp.material.rotation += dt * 0.1; }
      if (s.life <= 0) { for (const sp of s.sprites) { this.group.remove(sp); sp.material.dispose(); } this.smokes.splice(i, 1); }
    }
  }
  // is a point inside any active smoke? (used by bot vision)
  inSmoke(p) { for (const s of this.smokes) if (s.life / s.maxLife > 0.08 && s.life / s.maxLife < 0.97 && p.distanceTo(s.pos) < s.radius) return true; return false; }
  clear() {
    for (const it of this.items) this.group.remove(it.obj);
    this.items.length = 0; this.parts.length = 0;
    for (const s of this.smokes) for (const sp of s.sprites) this.group.remove(sp);
    this.smokes.length = 0;
    for (const slot of this.lightPool) { slot.life = 0; slot.l.intensity = 0; slot.l.position.set(0, -100, 0); }
    this.spot.intensity = 0;
  }
}
