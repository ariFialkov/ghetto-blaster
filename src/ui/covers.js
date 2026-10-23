// Staged "cover" renders for the mode panels: posed bots in a good spot of the current map, lit from the camera side.
import * as THREE from 'three';
import { CharacterModel } from '../game/character.js';
import { WEAPONS } from '../game/weapons.js';
import { RNG } from '../core/rng.js';

const W = 480, H = 720; // portrait, matching the desktop panels

/** Returns three data URLs: [tdm, ffa, gungame]. */
export function renderCovers(engine, map, seed = 1) {
  const rng = new RNG(seed);
  const { scene, camera, renderer } = engine;
  const spot = pickSpot(map, rng);
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  const buf = new Uint8Array(W * H * 4); const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
  const amb = scene.children.find((o) => o.isAmbientLight);
  const saved = { fog: scene.fog, exposure: renderer.toneMappingExposure, sunPos: engine.sun ? engine.sun.position.clone() : null, sunInt: engine.sun ? engine.sun.intensity : 1, sunCol: engine.sun ? engine.sun.color.clone() : null, hemi: engine.hemi ? engine.hemi.intensity : 1, hemiSky: engine.hemi ? engine.hemi.color.clone() : null, amb: amb ? amb.intensity : 0, fov: camera.fov, pos: camera.position.clone(), q: camera.quaternion.clone() };
  // cover lighting rig: bright warm key from the camera side, strong fill, no fog. Works for night maps too.
  scene.fog = null; renderer.toneMappingExposure = 1.5;
  if (engine.hemi) { engine.hemi.intensity = 1.6; engine.hemi.color.set('#dfe8ff'); }
  if (engine.sun) { engine.sun.intensity = 3.0; engine.sun.color.set('#fff1dc'); }
  if (amb) amb.intensity = 0.9;
  const results = [];
  const setups = [tdmSetup, ffaSetup, gunGameSetup];
  for (let i = 0; i < 3; i++) {
    const group = new THREE.Group(); scene.add(group);
    const { camPos, lookAt, fov } = setups[i](group, spot, map, rng);
    camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix();
    camera.position.copy(camPos); camera.lookAt(lookAt); camera.updateMatrixWorld();
    // key light from behind the camera, slightly above, so faces and guns read
    if (engine.sun) { const dir = camPos.clone().sub(lookAt).normalize().add(new THREE.Vector3(0.3, 0.8, 0)).normalize(); engine.sun.position.copy(lookAt).addScaledVector(dir, 120); engine.sun.target.position.copy(lookAt); engine.sun.target.updateMatrixWorld(); }
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    const img = ctx.createImageData(W, H); for (let y = 0; y < H; y++) img.data.set(buf.subarray(y * W * 4, (y + 1) * W * 4), (H - 1 - y) * W * 4); ctx.putImageData(img, 0, 0);
    results.push(c.toDataURL('image/jpeg', 0.85));
    scene.remove(group); group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  rt.dispose();
  scene.fog = saved.fog; renderer.toneMappingExposure = saved.exposure;
  if (engine.hemi) { engine.hemi.intensity = saved.hemi; engine.hemi.color.copy(saved.hemiSky); }
  if (engine.sun) { engine.sun.position.copy(saved.sunPos); engine.sun.intensity = saved.sunInt; engine.sun.color.copy(saved.sunCol); }
  if (amb) amb.intensity = saved.amb;
  camera.fov = saved.fov; camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); camera.position.copy(saved.pos); camera.quaternion.copy(saved.q);
  return results;
}

/** Find an open spot near a landmark with a clear camera line. Returns { center, dir (camera -> subject direction), floor } */
function pickSpot(map, rng) {
  const nav = map.nav, world = map.world;
  const cands = [];
  for (const p of map.cinematicPoints) cands.push(new THREE.Vector3(p.lookX, 0, p.lookZ));
  for (const l of map.landmarks) cands.push(new THREE.Vector3(l.x, 0, l.z));
  cands.push(new THREE.Vector3(0, 0, 0));
  let best = null, bestScore = -Infinity;
  for (const c of cands) {
    for (let t = 0; t < 10; t++) {
      const p = nav.randomPointNear(rng, c.x, c.z, 10, 6, 0); if (!p) continue;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2; const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
        const camPos = p.clone().addScaledVector(dir, -7).add(new THREE.Vector3(0, 1.6, 0));
        if (!nav.isWalkable(camPos.x, camPos.z, p.y)) continue;
        const eye = p.clone().add(new THREE.Vector3(0, 1.2, 0));
        if (!world.los(camPos, eye)) continue;
        // open space in front of the subject (backdrop depth) and some room sideways
        const far = world.raycast(eye, dir, 60); const depth = far ? far.t : 60;
        const side = world.raycast(eye, new THREE.Vector3(dir.z, 0, -dir.x), 8); const side2 = world.raycast(eye, new THREE.Vector3(-dir.z, 0, dir.x), 8);
        const room = Math.min(side ? side.t : 8, side2 ? side2.t : 8);
        const score = Math.min(depth, 40) * 0.5 + room * 2 + rng.float(0, 3) + (nav.open[nav.nodeOf(p.x, p.z, p.y)] || 0) * 10;
        if (score > bestScore) { bestScore = score; best = { center: p.clone(), dir, floor: p.y }; }
      }
    }
  }
  return best || { center: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 0, 1), floor: 0 };
}

function placeBot(group, { x, y, z, yaw, faction = 'gang', team = null, accent = null, weapon = 'chopper', pose = 'aim', rng }) {
  const m = new CharacterModel({ faction, team, accent, rng });
  m.setGun(WEAPONS[weapon]);
  m.group.position.set(x, y, z); m.group.rotation.y = yaw;
  const st = { speed: 0, moving: false, sprint: false, crouch: false, ads: false, onGround: true, pitch: 0, lean: 0, dead: false };
  if (pose === 'aim') st.ads = true;
  if (pose === 'run') { st.moving = true; st.sprint = true; st.speed = 7; }
  if (pose === 'crouch') { st.crouch = true; st.ads = true; }
  if (pose === 'walk') { st.moving = true; st.speed = 4; }
  if (pose === 'dead') st.dead = true;
  if (pose === 'dead') m.die(1);
  for (let i = 0; i < 30; i++) m.update(0.08, st);
  if (pose === 'run' || pose === 'walk') m.phase = rng.float(0, 6);
  m.update(0.016, st);
  group.add(m.group);
  return m;
}
const right = (d) => new THREE.Vector3(-d.z, 0, d.x);

// Two crews facing off across the street, blue on the left, red on the right, low heroic angle.
function tdmSetup(group, spot, map, rng) {
  const { center: c, dir: d, floor } = spot; const r = right(d);
  const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  const blue = [], red = [];
  for (let i = 0; i < 3; i++) { blue.push(c.clone().addScaledVector(r, -0.9 - i * 0.55).addScaledVector(d, 0.4 + i * 1.6)); red.push(c.clone().addScaledVector(r, 0.9 + i * 0.55).addScaledVector(d, 0.4 + i * 1.6)); }
  const poses = ['aim', 'crouch', 'run'];
  blue.forEach((p, i) => placeBot(group, { x: p.x, y: floor, z: p.z, yaw: yawTo(p, red[i]), team: 0, faction: i === 2 ? 'sicario' : 'gang', weapon: ['chopper', 'gauge', 'macdaddy'][i], pose: poses[i], rng }));
  red.forEach((p, i) => placeBot(group, { x: p.x, y: floor, z: p.z, yaw: yawTo(p, blue[i]), team: 1, faction: i === 1 ? 'hitman' : 'gang', weapon: ['stick', 'tommy', 'sweeper'][i], pose: poses[(i + 1) % 3], rng }));
  const camPos = c.clone().addScaledVector(d, -3.6).add(new THREE.Vector3(0, 0.9 + floor, 0));
  return { camPos, lookAt: c.clone().addScaledVector(d, 2).add(new THREE.Vector3(0, 1.3 + floor, 0)), fov: 70 };
}
// One shooter front and centre aiming past the camera, chaos behind: bodies, a runner, a flanker.
function ffaSetup(group, spot, map, rng) {
  const { center: c, dir: d, floor } = spot; const r = right(d);
  const hero = c.clone().addScaledVector(d, 0.5);
  placeBot(group, { x: hero.x, y: floor, z: hero.z, yaw: Math.atan2(-d.x, -d.z) + 0.35, faction: 'gang', accent: '#ffd166', weapon: 'drako', pose: 'aim', rng });
  const b1 = c.clone().addScaledVector(d, 4).addScaledVector(r, -2.5); placeBot(group, { x: b1.x, y: floor, z: b1.z, yaw: Math.atan2(-d.x, -d.z) - 0.6, faction: 'sicario', accent: '#ef4444', weapon: 'whisper', pose: 'run', rng });
  const b2 = c.clone().addScaledVector(d, 5.5).addScaledVector(r, 2.2); placeBot(group, { x: b2.x, y: floor, z: b2.z, yaw: Math.atan2(-d.x, -d.z) + 0.9, faction: 'hitman', accent: '#60a5fa', weapon: 'hammer', pose: 'crouch', rng });
  const b3 = c.clone().addScaledVector(d, 2.5).addScaledVector(r, 1.8); placeBot(group, { x: b3.x, y: floor, z: b3.z, yaw: rng.float(0, 6), faction: 'gang', accent: '#4ade80', weapon: 'nine', pose: 'dead', rng });
  const b4 = c.clone().addScaledVector(d, 8).addScaledVector(r, -0.5); placeBot(group, { x: b4.x, y: floor, z: b4.z, yaw: Math.atan2(-d.x, -d.z), faction: 'cop', weapon: 'fifty', pose: 'aim', rng });
  const camPos = c.clone().addScaledVector(d, -2.6).addScaledVector(r, 0.9).add(new THREE.Vector3(0, 1.3 + floor, 0));
  return { camPos, lookAt: c.clone().addScaledVector(d, 2.5).add(new THREE.Vector3(0, 1.25 + floor, 0)), fov: 62 };
}
// A line-up of shooters each holding a different gun from the ladder, pistol in front, sniper at the back.
function gunGameSetup(group, spot, map, rng) {
  const { center: c, dir: d, floor } = spot; const r = right(d);
  const guns = ['snubby', 'hammer', 'macdaddy', 'chopper', 'ratchet', 'fifty'];
  const factions = ['gang', 'hitman', 'sicario', 'gang', 'cop', 'gang'];
  const accents = ['#ffd166', '#ef4444', '#60a5fa', '#a78bfa', '#4ade80', '#fb923c'];
  guns.forEach((g, i) => { const p = c.clone().addScaledVector(d, i * 1.6).addScaledVector(r, (i % 2 ? 1 : -1) * (0.7 + i * 0.22)); placeBot(group, { x: p.x, y: floor, z: p.z, yaw: Math.atan2(-d.x, -d.z) + (i % 2 ? -0.5 : 0.5), faction: factions[i], accent: accents[i], weapon: g, pose: i % 3 === 1 ? 'crouch' : 'aim', rng }); });
  const camPos = c.clone().addScaledVector(d, -2.6).add(new THREE.Vector3(0, 1.7 + floor, 0));
  return { camPos, lookAt: c.clone().addScaledVector(d, 3.5).add(new THREE.Vector3(0, 1.0 + floor, 0)), fov: 64 };
}
