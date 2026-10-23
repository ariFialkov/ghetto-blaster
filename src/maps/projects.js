// PROJECTS — New York. A NYCHA-style superblock (Queensbridge / Marcy): tall red-brick cross-ventilated towers
// around a flagpole courtyard, fenced basketball court, playground, a corner bodega with a DELI neon, a Chinese
// takeout + laundromat strip, a Baptist church, yellow cabs, hydrants, scaffolding, water towers and an elevated
// train platform along the south edge. Overcast, cool grey-blue light.
import * as THREE from 'three';
import { MapBuilder, mat } from './builder.js';

export const def = {
  id: 'projects', name: 'Projects', city: 'New York', size: 190, seed: 23,
  teams: { tdm: 6, ffa: 10 },
  blurb: 'Queens. Brick towers around a flagpole courtyard, a fenced court, a bodega and the El rumbling past under a grey sky.',
  env: { skyTop: '#6b7c8f', skyHorizon: '#aeb6bf', skyBottom: '#34373d', fogColor: '#a7b0b9', fogNear: 70, fogFar: 270, hemiSky: '#c3ccd8', hemiGround: '#474745', hemiIntensity: 0.95, sunColor: '#e6ecf4', sunIntensity: 1.35, sunDir: [0.35, 0.8, -0.45], ambient: '#4f555d', ambientIntensity: 0.4, shadowSize: 105 },
  lightBudget: 14,
  minimapBg: '#2a2c32',
};

const colorMat = (c, r = 0.85, m = 0.05) => mat('color', { color: c, rough: r, metal: m });
const STEP_H = 0.34, STEP_D = 0.62;
// Distance from a stairs' start point to the centre of its top landing (matches MapBuilder.stairs()).
const stairLen = (h) => Math.ceil(h / STEP_H) * STEP_D + 0.6;

export function build() {
  const b = new MapBuilder(def);
  b.ground('asphalt', { seed: 9 });

  // =====================================================================
  // STREET GRID: avenues at x=±60, streets at z=±60. Superblock in between.
  // =====================================================================
  for (const x of [-60, 60]) b.road(x, -92, x, 92, 12, { sidewalk: true });
  for (const z of [-60, 60]) b.road(-92, z, 92, z, 12, { sidewalk: true });
  for (const x of [-60, 60]) for (const z of [-60, 60]) {
    b.prop('trafficlight', { x: x + 7.5, z: z - 7.5, rot: Math.PI });
    b.prop('lamp', { x: x - 7.5, z: z - 7.5, rot: Math.PI / 4 });
    b.prop('trashcan', { x: x + 7.2, z: z + 9.5 });
  }

  // ---------------- helpers ----------------
  const canopy = (x, z, rot) => { // apartment entrance canopy (visual only)
    b.box({ x: x + Math.sin(rot) * 1.3, y: 3.0, z: z + Math.cos(rot) * 1.3, w: 5.4, h: 0.25, d: 2.6, color: '#2b2b2e', rot, collide: false });
    for (const s of [-1, 1]) b.cylinder(x + Math.cos(rot) * s * 2.3 + Math.sin(rot) * 2.3, 0, z - Math.sin(rot) * s * 2.3 + Math.cos(rot) * 2.3, 0.08, 3.0, colorMat('#3a3a3a', 0.5, 0.6), 6, false);
  };
  // NYCHA tower: red brick slab, tall, white-framed windows look via lit windows
  const tower = (x, z, w, d, h, o = {}) => b.building({ x, z, w, d, h, style: o.style || 'brick', color: o.color || '#8a4232', floors: Math.round(h / 2.9), lit: 0.3, winColor: '#1c2530', roof: 'parapet', rooftop: false, sign: o.sign || null, signColor: o.signColor || '#1f4f8f', graffiti: o.graffiti || null, fireEscape: !!o.fireEscape, name: o.name || null, seed: o.seed || null });
  const hotdog = (x, z, rot) => {
    b.box({ x, z, w: 1.4, h: 1.0, d: 0.9, m: mat('metal', { seed: 12, color: '#c9ccd0' }), rot });
    b.cylinder(x, 1.0, z, 0.03, 1.7, colorMat('#555', 0.5, 0.5), 6, false);
    b._mesh(new THREE.ConeGeometry(1.3, 0.55, 10), colorMat('#f2c511', 0.9), x, 2.55, z);
    b._mesh(new THREE.ConeGeometry(0.9, 0.3, 10), colorMat('#1f4f8f', 0.9), x, 2.75, z);
    for (const s of [-0.5, 0.5]) { const wm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 10), colorMat('#111')); wm.rotation.z = Math.PI / 2; wm.rotation.y = rot; wm.position.set(x + Math.cos(rot) * s, 0.25, z - Math.sin(rot) * s); b.group.add(wm); }
  };
  const mailbox = (x, z, rot) => { b.box({ x, z, w: 0.7, h: 1.2, d: 0.6, m: colorMat('#1f4f8f', 0.6, 0.3), rot }); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 10, 1, false, 0, Math.PI), colorMat('#1f4f8f', 0.6, 0.3)); top.rotation.z = Math.PI / 2; top.rotation.y = rot; top.position.set(x, 1.2, z); b.group.add(top); };
  const ironFence = (x, z, len, rot = 0) => b.fence({ x, z, len, h: 1.1, rot });
  const lawn = (x, z, w, d) => b.patch(x, z, w, d, 'grass', { seed: 3, mmColor: '#3a5a2e' }, 0.02);
  const path = (x, z, w, d) => b.patch(x, z, w, d, 'sidewalk', { mmColor: '#55555c' }, 0.025);
  const trainCar = (x, z, y) => { // NYC subway car, length along x
    b.box({ x, y, z, w: 15.5, h: 0.6, d: 2.2, color: '#2a2a2a', collide: true });
    b.box({ x, y: y + 0.6, z, w: 16, h: 2.8, d: 2.8, m: mat('metal', { seed: 21, color: '#b9bec4', rust: 0.1 }), collide: true });
    b.box({ x, y: y + 2.0, z, w: 15.6, h: 0.9, d: 2.9, color: '#1b2430', collide: false });
    b.box({ x, y: y + 1.0, z, w: 16.02, h: 0.25, d: 2.84, color: '#1f4f8f', collide: false });
    for (const dx of [-5.5, -1.5, 2.5, 6.5]) b.box({ x: x + dx, y: y + 0.7, z, w: 1.3, h: 2.4, d: 2.9, color: '#8d9297', collide: false });
    b.box({ x, y: y + 3.4, z, w: 16, h: 0.2, d: 2.4, color: '#7d8287', collide: false });
    const lm = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffe9a0', emissiveIntensity: 0.8 });
    for (const s of [-1, 1]) for (const dz of [-0.8, 0.8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.3), lm); l.position.set(x + s * 8.02, y + 1.9, z + dz); b.group.add(l); }
  };
  const platformBench = (x, y, z, rot = 0) => { b.box({ x, y, z, w: 1.8, h: 0.5, d: 0.5, m: colorMat('#5a3f2a'), rot }); b.box({ x: x - Math.sin(rot) * 0.22, y: y + 0.5, z: z - Math.cos(rot) * 0.22, w: 1.8, h: 0.45, d: 0.06, m: colorMat('#5a3f2a'), rot, collide: false }); };
  const swingSet = (x, z, rot) => {
    const pm = colorMat('#2d6a8a', 0.5, 0.5);
    for (const s of [-1, 1]) { const px = x + Math.cos(rot) * s * 2.0, pz = z - Math.sin(rot) * s * 2.0; b.cylinder(px, 0, pz, 0.07, 2.6, pm, 6, true); }
    b.box({ x, y: 2.55, z, w: 4.2, h: 0.1, d: 0.1, m: pm, rot, collide: false });
    for (const s of [-0.7, 0.7]) { b.box({ x: x + Math.cos(rot) * s, y: 0.5, z: z - Math.sin(rot) * s, w: 0.5, h: 0.06, d: 0.25, m: colorMat('#222'), rot, collide: false }); for (const c of [-0.22, 0.22]) b.box({ x: x + Math.cos(rot) * (s + c), y: 0.55, z: z - Math.sin(rot) * (s + c), w: 0.03, h: 2.0, d: 0.03, m: colorMat('#999', 0.4, 0.8), collide: false }); }
  };
  const domeClimber = (x, z) => { const m = new THREE.MeshStandardMaterial({ color: '#c0392b', wireframe: true }); b._mesh(new THREE.SphereGeometry(1.7, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), m, x, 0, z); b._collide(x, 0, z, 3.0, 1.7, 3.0, 0, { walkable: false }); };
  const slide = (x, z, rot) => {
    const pm = colorMat('#2d6a8a', 0.5, 0.5);
    b.box({ x, z, w: 1.4, h: 1.9, d: 1.4, m: pm, rot }); // tower + ladder block
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 3.4), colorMat('#f2c511', 0.4, 0.3)); s.position.set(x + Math.sin(rot) * 2.2, 1.15, z + Math.cos(rot) * 2.2); s.rotation.y = rot; s.rotation.x = 0.5; s.castShadow = true; b.group.add(s);
    b._collide(x + Math.sin(rot) * 2.3, 0, z + Math.cos(rot) * 2.3, 0.9, 1.0, 3.0, rot, { walkable: true });
  };
  const sprayShower = (x, z) => { b.cylinder(x, 0, z, 0.1, 3.0, colorMat('#888', 0.4, 0.7), 8, true); const r = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 16), colorMat('#888', 0.4, 0.7)); r.rotation.x = Math.PI / 2; r.position.set(x, 2.95, z); b.group.add(r); };
  const steeple = (x, z, y) => {
    b.box({ x, y, z, w: 5, h: 7, d: 5, m: mat('plaster', { color: '#cfc7b8', seed: 5 }), walkable: false });
    b._mesh(new THREE.ConeGeometry(3.0, 5.0, 4), colorMat('#3a3f44', 0.7), x, y + 9.5, z).rotation.y = Math.PI / 4;
    b.box({ x, y: y + 12, z, w: 0.2, h: 1.8, d: 0.2, color: '#e8d9a0', collide: false }); b.box({ x, y: y + 13.0, z, w: 1.0, h: 0.2, d: 0.2, color: '#e8d9a0', collide: false });
  };

  // =====================================================================
  // SUPERBLOCK (x,z within ±51): towers around a flagpole courtyard
  // =====================================================================
  // --- paths & lawns ---
  path(0, 0, 32, 56); // central mall
  for (const x of [-18, 18]) path(x, 0, 4, 103);
  for (const z of [-18, 18]) path(0, z, 103, 4);
  b.plaza(0, 0, 30, 30, 'tile', { seed: 2, color: '#8c8a84', mmColor: '#5a5a60' });
  // lawns with low iron fences against the outer sidewalks
  for (const s of [-1, 1]) {
    lawn(s * 34, -49, 28, 5); ironFence(s * 34, -46.4, 28);
    lawn(s * 34, 49, 28, 5); ironFence(s * 34, 46.4, 28);
    lawn(s * 48.5, -27, 6, 14); lawn(s * 48.5, 27, 6, 14);
  }

  // --- four corner towers (L-shaped: slab + wing) ---
  const corners = [[-1, -1, 'QB', 'NORTH TOWER'], [1, -1, null, null], [-1, 1, 'BRIDGE', null], [1, 1, 'RIP', null]];
  for (const [sx, sz, graf, sign] of corners) {
    tower(sx * 33, sz * 40, 24, 12, 27, { color: sx < 0 ? '#8a4232' : '#9a4a36', graffiti: graf, seed: 100 + sx * 3 + sz });
    tower(sx * 39, sz * 27, 12, 14, 27, { color: sx < 0 ? '#8a4232' : '#9a4a36', seed: 200 + sx * 3 + sz });
    canopy(sx * 27, sz * 34, sz < 0 ? 0 : Math.PI); // entrance on the inner face of the slab
    b.prop('dumpster', { x: sx * 47, z: sz * 40, rot: Math.PI / 2, color: '#2f5f3f' });
    b.prop('tree', { x: sx * 25, z: sz * 22, scale: 1.3 });
    b.prop('trashcan', { x: sx * 21, z: sz * 23 });
  }
  // --- mid towers (balconied tenement style) flanking the courtyard ---
  tower(-30, 0, 14, 26, 23, { style: 'tenement', color: '#7d5a46', fireEscape: true, seed: 301 });
  tower(30, 0, 14, 26, 23, { style: 'tenement', color: '#6b4a3a', seed: 302 });
  canopy(-30, 13.5, 0); canopy(30, -13.5, Math.PI);
  b.prop('scaffold', { x: -30, z: -14.4, rot: 0, len: 12, h: 8 }); // scaffolding along the mid-west tower
  b.prop('scaffold', { x: -33, z: -47.3, rot: 0, len: 10, h: 8 }); // and the NW slab's street face
  b.prop('laundry', { x: -38, z: -15.5, rot: 0, len: 5, y: 4 });

  // --- central courtyard: flagpole on a stepped base, memorial statue, ring of benches ---
  b.box({ x: 0, y: 0, z: -4, w: 4.5, h: 0.4, d: 4.5, m: mat('concrete', { color: '#9a968e', seed: 51 }) });
  b.prop('flag', { x: 0, z: -4, rot: 0.3, color: '#1f3f8f', stripe: '#c0392b' });
  b.prop('statue', { x: 0, z: 6, rot: Math.PI, name: 'Courtyard Memorial', color: '#3f5a4a', h: 2.6 });
  for (const [px, pz, r] of [[-7, -9, 0], [7, -9, 0], [-7, 11, Math.PI], [7, 11, Math.PI], [-11, 1, Math.PI / 2], [11, 1, -Math.PI / 2]]) b.prop('bench', { x: px, z: pz, rot: r });
  for (const [px, pz] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) { b.prop('planter', { x: px, z: pz, w: 3 }); b.prop('tree', { x: px, z: pz + (pz < 0 ? -3 : 3), scale: 1.2 }); }
  b.prop('picnic', { x: -5, z: 1, rot: 0.2 }); b.prop('picnic', { x: 5, z: -1, rot: -0.3 }); // chess tables
  b.prop('trashcan', { x: 13, z: 0 }); b.prop('trashcan', { x: -13, z: 0 });
  b.prop('lamp', { x: -14, z: -14, rot: Math.PI / 4, light: true }); b.prop('lamp', { x: 14, z: 14, rot: -3 * Math.PI / 4, light: true });
  b.prop('sign', { x: 14, z: -8, rot: -Math.PI / 2, text: 'NO BALL PLAYING', w: 1.2, h: 0.5 });
  b.prop('cart', { x: -9, z: 8, rot: 1.1 }); b.prop('cone', { x: 15, z: 6 });

  // --- fenced basketball court north of the courtyard ---
  b.prop('court', { x: 0, z: -30, w: 26, d: 14, color: '#5f6f66' });
  b.fence({ x: 0, z: -37.6, len: 26, h: 3.6 }); b.fence({ x: -13.1, z: -30, len: 15.4, h: 3.6, rot: Math.PI / 2 }); b.fence({ x: 13.1, z: -30, len: 15.4, h: 3.6, rot: Math.PI / 2 });
  b.fence({ x: -7.75, z: -22.4, len: 10.5, h: 3.6 }); b.fence({ x: 7.75, z: -22.4, len: 10.5, h: 3.6 }); // gate gap at x -2.5..2.5
  b.prop('hoop', { x: -11.5, z: -30, rot: Math.PI / 2 }); b.prop('hoop', { x: 11.5, z: -30, rot: -Math.PI / 2 });
  b.prop('bench', { x: -5, z: -39.5, rot: Math.PI });
  b.prop('trashcan', { x: 14.5, z: -39 });

  // --- playground south of the courtyard ---
  b.patch(0, 30, 26, 14, 'concrete', { color: '#4e6a7a', seed: 82, mmColor: '#44555e' }, 0.02);
  ironFence(0, 37.6, 26); ironFence(-13.1, 30, 14, Math.PI / 2); ironFence(13.1, 30, 14, Math.PI / 2);
  ironFence(-8.5, 22.4, 9); ironFence(8.5, 22.4, 9); // gate at x -4..4
  swingSet(-7, 31, 0); domeClimber(6, 33); slide(-1, 27, Math.PI / 2); sprayShower(9, 27);
  b.prop('bench', { x: 10, z: 24.5, rot: Math.PI });
  b.prop('tree', { x: -16, z: 36, scale: 1.4 }); b.prop('tree', { x: 16, z: 36, scale: 1.3 });
  b.prop('planter', { x: 0, z: 40, w: 4 });

  // --- community center (west strip, enterable) ---
  b.shell({ x: -46, z: 0, w: 10, h: 5.5, d: 20, doors: ['e', 'w'], style: 'concrete', color: '#9a9690', name: 'Community Center', sign: 'COMMUNITY CENTER', signColor: '#1f6f8f', interior: true });
  b.prop('crate', { x: -48, z: -6, size: 1.2 }); b.prop('crate', { x: -47, z: 6, size: 1 });
  b.prop('bench', { x: -43, z: -7, rot: 0 }); b.prop('bench', { x: -43, z: 7, rot: Math.PI });
  b.prop('planter', { x: -46, z: 12, w: 3 }); b.prop('planter', { x: -46, z: -12, w: 3 });
  b.prop('bush', { x: -50, z: 13 }); b.prop('bush', { x: -50, z: -13 });
  // --- management office (east strip): 2 storeys, roof reachable by stairs along its south face, water tower on top ---
  {
    const mx = 45, mz = 0, mw = 12, md = 20, mh = 6.5;
    const L = stairLen(mh + 0.3);
    b.shell({ x: mx, z: mz, w: mw, h: mh, d: md, doors: ['w', 'e'], style: 'brick', color: '#7a4a3a', name: 'Management Office', sign: 'MANAGEMENT OFFICE', signColor: '#2a5a3a', interior: true, stairs: { x: mx - mw / 2 + 0.3 + L, z: mz + md / 2 + 1.0, dir: 'w', width: 2 } });
    b.prop('watertower', { x: mx - 2, z: mz - 4, y: mh + 0.3, h: 4.5 });
    b.prop('ac', { x: mx + 3, z: mz + 3, y: mh + 0.3 }); b.prop('antenna', { x: mx + 4, z: mz + 7, y: mh + 0.3, h: 3 });
    b.box({ x: mx + 2.5, y: mh + 0.3, z: mz + 6, w: 2.2, h: 1.2, d: 1.4, m: mat('corrugated', { seed: 5, rust: 0.5 }) }); // pigeon coop
    b.prop('bench', { x: mx, z: mz - 12, rot: 0 }); b.prop('trashcan', { x: mx + 4, z: mz - 12 });
    b.prop('bush', { x: mx + 5, z: mz + 13.5 }); b.prop('planter', { x: mx - 4, z: mz - 12, w: 3 });
  }
  // --- superblock street-side furniture ---
  for (const s of [-1, 1]) {
    b.prop('bench', { x: s * 18, z: -44, rot: s < 0 ? Math.PI / 2 : -Math.PI / 2 });
    b.prop('bench', { x: s * 18, z: 44, rot: s < 0 ? Math.PI / 2 : -Math.PI / 2 });
    b.prop('lamp', { x: s * 20.5, z: s * -20.5, rot: s < 0 ? 0 : Math.PI });
    b.prop('tree', { x: s * 42, z: -14, scale: 1.2 }); b.prop('tree', { x: s * 42, z: 14, scale: 1.2 });
    b.prop('trashpile', { x: s * 24, z: -45 }); b.prop('mattress', { x: s * 44, z: 45, rot: 0.4 });
    b.prop('hydrant', { x: s * 50.5, z: -15 }); b.prop('hydrant', { x: s * 50.5, z: 15 });
  }

  // =====================================================================
  // NORTH STRIP (z -92..-68): corner park, bodega, laundromat, Chinese takeout, church, checks cashed, pawn, depot
  // =====================================================================
  // NW corner park with statue
  lawn(-80, -80, 20, 20);
  b.prop('statue', { x: -80, z: -80, rot: Math.PI / 2, color: '#4a6b5a', h: 2.4 });
  for (const [px, pz] of [[-86, -86], [-74, -86], [-86, -74]]) b.prop('tree', { x: px, z: pz, scale: 1.3 });
  for (const [px, pz, r] of [[-80, -76, Math.PI], [-84, -80, Math.PI / 2], [-76, -80, -Math.PI / 2]]) b.prop('bench', { x: px, z: pz, rot: r });
  b.prop('trashcan', { x: -71, z: -72 }); b.prop('picnic', { x: -86, z: -79, rot: 0.5 });
  // Bodega (enterable) with awning and DELI neon
  b.shell({ x: -44, z: -82, w: 14, h: 4.6, d: 14, doors: ['s', 'e'], style: 'brick', color: '#7a3a2a', name: 'Corner Bodega', sign: 'BODEGA', signColor: '#f2c511', interior: true, graffiti: 'QB' });
  b.awning(-44, -82, 14, 14, 0, '#c0392b', b.rng);
  b.prop('neonSign', { x: -36.8, z: -82, rot: Math.PI / 2, text: 'DELI', color: '#ff2d2d', y: 3.4, w: 3.4, light: true });
  for (const dz of [-3, 1]) b.box({ x: -46, z: -82 + dz, w: 5, h: 1.8, d: 0.8, m: mat('metal', { seed: 14, color: '#8a8f94' }) }); // shelving
  b.box({ x: -39.5, z: -79, w: 0.9, h: 2.1, d: 0.9, m: colorMat('#1f4f8f', 0.5, 0.4) }); // ATM
  b.prop('crate', { x: -41, z: -87, size: 1 }); b.prop('crate', { x: -40, z: -86, size: 0.8 });
  b.prop('newsstand', { x: -36.5, z: -72.5, rot: 0, text: 'NEWS' });
  b.prop('hydrant', { x: -49, z: -73 }); b.prop('trashcan', { x: -43, z: -72.2 });
  // Laundromat + Chinese takeout strip
  b.building({ x: -27, z: -82, w: 14, d: 14, h: 7.5, style: 'brick', color: '#9c4b32', rooftop: false, sign: 'LAUNDROMAT', signColor: '#1f6fbf', shutters: true, seed: 401 });
  b.prop('neonSign', { x: -27, z: -74.8, rot: 0, text: 'WASH & FOLD', color: '#3ab0ff', y: 5.2, w: 5, light: true });
  b.prop('watertower', { x: -30, z: -84, y: 7.5, h: 3.5 });
  b.prop('scaffold', { x: -27, z: -73.2, rot: 0, len: 12, h: 6 }); // sidewalk shed
  b.building({ x: -13, z: -82, w: 12, d: 14, h: 7.5, style: 'plaster', color: '#c9a86a', rooftop: false, sign: 'NO.1 CHINESE', signColor: '#c0392b', awning: '#c0392b', seed: 402 });
  b.prop('neonSign', { x: -13, z: -74.8, rot: 0, text: 'TAKE OUT', color: '#ff3030', y: 5.2, w: 4, light: true });
  b.prop('dumpster', { x: -20.5, z: -88, rot: Math.PI / 2 }); b.prop('trashpile', { x: -20.5, z: -85 });
  b.prop('bollard', { x: -16, z: -72.5 }); b.prop('bollard', { x: -10, z: -72.5 });
  b.prop('car', { x: -22, z: -70.5, rot: Math.PI / 2, color: '#f2c511' }); // cab at the curb
  // Church
  b.building({ x: 8, z: -81, w: 22, d: 18, h: 13, style: 'plaster', color: '#d8d0c0', sign: 'ZION BAPTIST CHURCH', signColor: '#5a2a7a', name: 'Church', lit: 0.1, rooftop: false, seed: 403 });
  steeple(8, -86, 13);
  b.box({ x: 8, z: -71.5, w: 8, h: 0.4, d: 1.2, m: mat('concrete', { color: '#b8b4aa', seed: 93 }) }); // steps
  b.box({ x: 8, y: 0.4, z: -72.1, w: 2.6, h: 3.4, d: 0.2, color: '#3a2a1a', collide: false }); // doors
  for (const dx of [-7, 7]) b.prop('tree', { x: 8 + dx, z: -70, scale: 1.1 });
  b.prop('sign', { x: 20, z: -71.5, rot: 0, text: 'ONE WAY', w: 1.0, h: 0.4 });
  // Checks cashed + pawn
  b.building({ x: 30, z: -82, w: 14, d: 14, h: 9, style: 'brick', color: '#7a4a3a', rooftop: false, sign: 'CHECKS CASHED', signColor: '#1f4f8f', shutters: true, graffiti: 'EAST SIDE', seed: 404 });
  b.prop('watertower', { x: 33, z: -85, y: 9, h: 4 });
  b.building({ x: 45, z: -82, w: 12, d: 14, h: 11, style: 'concrete', color: '#7b7f82', rooftop: false, sign: 'PAWN', signColor: '#8a5a1a', graffiti: 'QB', fireEscape: true, seed: 405 });
  b.prop('phonebooth', { x: 38.5, z: -73, rot: 0 }); mailbox(41, -72.5, 0);
  b.prop('busstop', { x: 46, z: -70.5, rot: Math.PI, ad: 'BLAST' });
  b.prop('van', { x: 32, z: -70.5, rot: Math.PI / 2, text: 'MOVERS', color: '#e8e8e8' });
  // NE corner: bus depot
  b.patch(80, -80, 22, 22, 'asphalt', { seed: 5, mmColor: '#3a3a40' }, 0.02);
  b.fence({ x: 80, z: -69.2, len: 14 }); b.fence({ x: 69.2, z: -78, len: 24, rot: Math.PI / 2 });
  b.prop('bus', { x: 75, z: -82, rot: 0, color: '#e6e6ea' }); b.prop('bus', { x: 80, z: -80, rot: 0, color: '#e6e6ea' });
  b.prop('car', { x: 86, z: -80, rot: 0.1, color: '#f2c511' });
  b.prop('barrel', { x: 71, z: -89 }); b.prop('barrel', { x: 72, z: -88 }); b.prop('tires', { x: 74, z: -89.5 });
  b.prop('billboard', { x: 88, z: -89, rot: Math.PI * 0.75, text: 'WE BUY GOLD', bg: '#f2c511', fg: '#111', w: 10, h: 8 });

  // =====================================================================
  // WEST STRIP (x -92..-68): walk-up tenements with fire escapes. Team 0 spawns here.
  // =====================================================================
  for (const [i, z] of [-48, -24, 0, 24, 48].entries()) {
    b.building({ x: -86, z, w: 16, d: 10, h: 14 + (i % 2) * 3, rot: Math.PI / 2, style: 'tenement', rooftop: false, color: ['#6b4a3a', '#5c4033', '#7d5a46', '#6b4a3a', '#5c4033'][i], fireEscape: i % 2 === 0, sign: ['SALON', null, 'BAIL BONDS', null, 'FISH MARKET'][i], signColor: ['#8a2a6a', '#000', '#c0392b', '#000', '#1f6fbf'][i], graffiti: [null, 'WESTSIDE', null, 'GB', null][i], awning: i === 4 ? '#1f6fbf' : null, seed: 500 + i });
  }
  for (const z of [-36, 12]) b.prop('laundry', { x: -86, z, rot: Math.PI / 2, len: 6, y: 4.5 });
  for (const z of [-36, 12]) b.prop('trashcan', { x: -80.5, z: z + 2 });
  b.prop('dumpster', { x: -89, z: -36, rot: 0 }); b.prop('dumpster', { x: -89, z: 12, rot: 0 }); b.prop('trashpile', { x: -88, z: 36 });
  for (const [z, c] of [[-8, '#f2c511'], [40, '#f2c511']]) b.prop('car', { x: -70, z, rot: 0, color: c });
  b.prop('van', { x: -70, z: 62 + 0, rot: 0, text: 'PLUMBING', color: '#2a3a5a' });
  for (const z of [-40, 4, 48]) b.prop('lamp', { x: -68.6, z, rot: Math.PI / 2 });
  b.prop('hydrant', { x: -79.5, z: -2 }); b.prop('hydrant', { x: -79.5, z: 46 });
  b.prop('busstop', { x: -70.3, z: 30, rot: Math.PI / 2, ad: 'DELI' });
  b.prop('tree', { x: -79, z: -60 - 7, scale: 1.0 });

  // =====================================================================
  // EAST STRIP (x 68..92): more walk-ups, a corner liquor store. Team 1 spawns here.
  // =====================================================================
  for (const [i, z] of [-48, -24, 0, 24, 48].entries()) {
    b.building({ x: 86, z, w: 16, d: 10, h: 15 + (i % 2) * 3, rot: -Math.PI / 2, style: 'tenement', rooftop: false, color: ['#5c4033', '#7d5a46', '#6b4a3a', '#5c4033', '#7d5a46'][i], fireEscape: i % 2 === 1, sign: [null, 'LIQUOR', null, 'BARBER', null][i], signColor: ['#000', '#8a1a1a', '#000', '#1f4f8f', '#000'][i], graffiti: ['EASTSIDE', null, 'QB', null, 'CREW'][i], awning: i === 3 ? '#c0392b' : null, seed: 600 + i });
  }
  b.prop('laundry', { x: 86, z: 36, rot: Math.PI / 2, len: 6, y: 4.5 });
  for (const z of [-12, 36]) b.prop('trashcan', { x: 80.5, z: z - 2 });
  b.prop('dumpster', { x: 89, z: -12, rot: 0 }); b.prop('dumpster', { x: 89, z: 36, rot: 0 }); b.prop('trashpile', { x: 88, z: -36 });
  for (const [z, c] of [[-2, '#f2c511'], [44, '#8c1c1c']]) b.prop('car', { x: 70, z, rot: Math.PI, color: c });
  b.prop('bus', { x: 63.5, z: 20, rot: 0, color: '#e6e6ea' });
  for (const z of [-40, 4, 48]) b.prop('lamp', { x: 68.6, z, rot: -Math.PI / 2 });
  b.prop('hydrant', { x: 79.5, z: 10 }); b.prop('hydrant', { x: 79.5, z: -38 });
  b.prop('busstop', { x: 70.3, z: -30, rot: -Math.PI / 2, ad: 'BLAST' });
  b.prop('neonSign', { x: 80.8, z: -24, rot: -Math.PI / 2, text: 'LIQUOR', color: '#ffb020', y: 4.6, w: 4, light: true });

  // =====================================================================
  // SOUTH STRIP (z 68..92): the El — elevated train platform with stairs at both ends, subway kiosks beneath
  // =====================================================================
  const EL_Y = 7, EL_LEN = 76, EL_W = 9, EL_Z = 80, EL_TOP = EL_Y + 0.8;
  b.prop('overpass', { x: 0, z: EL_Z, rot: 0, len: EL_LEN, w: EL_W, y: EL_Y });
  {
    const L = stairLen(EL_TOP), e = EL_LEN / 2;
    b.stairs({ x: -e + 0.3 - L, z: EL_Z, dir: 'e', height: EL_TOP, width: 2.4 });
    b.stairs({ x: e - 0.3 + L, z: EL_Z, dir: 'w', height: EL_TOP, width: 2.4 });
  }
  trainCar(-28, EL_Z + 2.5, EL_TOP); trainCar(-10, EL_Z + 2.5, EL_TOP);
  // platform canopy, benches, bins (y-aware boxes only)
  for (const x of [4, 12, 20, 28]) b.cylinder(x, EL_TOP, EL_Z - 3.3, 0.12, 3.4, colorMat('#2f5f3f', 0.5, 0.5), 8, true);
  b.box({ x: 16, y: EL_TOP + 3.4, z: EL_Z - 2.2, w: 30, h: 0.15, d: 3.6, m: mat('corrugated', { seed: 7, color: '#3a5a3a', rust: 0.4 }), collide: false });
  for (const x of [8, 24]) platformBench(x, EL_TOP, EL_Z - 2.9, 0);
  b.cylinder(32, EL_TOP, EL_Z - 2.9, 0.35, 1.0, mat('metal', { seed: 9, rust: 0.5, color: '#555' }), 10, true);
  b.box({ x: 16, y: EL_TOP + 2.0, z: EL_Z + 4.1, w: 4, h: 1.2, d: 0.1, m: mat('sign', { text: 'QUEENSBRIDGE', bg: '#1f4f8f', w: 512, h: 128 }), collide: false });
  b.prop('billboard', { x: 44, z: 89, rot: Math.PI, text: 'WELCOME TO THE PROJECTS', bg: '#1f4f8f', fg: '#ffd166', w: 12, h: 9 });
  // subway kiosks (enterable booths) at each stair foot
  b.shell({ x: -46, z: 88, w: 5, h: 2.9, d: 4, doors: ['n'], windows: false, style: 'concrete', color: '#2f6f3f', roof: true, interior: false, name: 'El Station', sign: 'SUBWAY', signColor: '#1a7a3a' });
  b.shell({ x: 46, z: 88, w: 5, h: 2.9, d: 4, doors: ['n'], windows: false, style: 'concrete', color: '#2f6f3f', roof: true, interior: false, sign: 'SUBWAY', signColor: '#1a7a3a' });
  // under the El: mural wall, hot dog cart, newsstand, pigeons' worth of trash
  b.wall({ x: -14, z: 90.8, len: 34, h: 3.2, color: '#7a6a5a', graffiti: 'QUEENSBRIDGE' });
  b.wall({ x: 22, z: 90.8, len: 30, h: 3.2, color: '#6a6a62', graffiti: 'RIP' });
  hotdog(-20, 72.5, 0.2); hotdog(26, 86, Math.PI);
  b.prop('newsstand', { x: 6, z: 72.5, rot: 0, text: 'NEWS' });
  b.prop('phonebooth', { x: -4, z: 86.5 }); mailbox(-8, 72.5, 0);
  b.prop('dumpster', { x: 32, z: 76, rot: 0 }); b.prop('trashpile', { x: 36, z: 86 }); b.prop('tires', { x: -34, z: 86 });
  b.prop('barrel', { x: -30, z: 73 }); b.prop('barrel', { x: -29, z: 74.1 }); b.prop('crate', { x: 14, z: 87, size: 1.3 });
  b.prop('tent', { x: -24, z: 86, rot: 0.4 }); b.prop('mattress', { x: -27, z: 88.5, rot: 0.2 });
  b.prop('car', { x: 2, z: 84, rot: Math.PI / 2, color: '#1e1e1e', wreck: true });
  b.prop('hydrant', { x: -41, z: 69 }); b.prop('hydrant', { x: 41, z: 69 });
  b.prop('lamp', { x: -20, z: 68.8, rot: Math.PI, light: true });
  // cab hack stand along the south street
  for (const x of [-32, -25, 25]) b.prop('car', { x, z: 63.5, rot: Math.PI / 2, color: '#f2c511' });
  b.prop('sign', { x: -40, z: 68.6, rot: 0, text: 'TAXI STAND', w: 1.2, h: 0.5 });
  // SW corner: vacant lot + liquor shell
  b.patch(-80, 81, 22, 20, 'dirt', { seed: 4, mmColor: '#4a4238' }, 0.02);
  b.fence({ x: -69.2, z: 82, len: 18, rot: Math.PI / 2 });
  b.shell({ x: -85, z: 86, w: 12, h: 5, d: 10, doors: ['e', 'n'], style: 'brick', color: '#6b3a2c', sign: 'CHECK CASHING', signColor: '#8a1a1a', graffiti: 'WESTSIDE', interior: true });
  b.prop('car', { x: -74, z: 86, rot: 0.3, wreck: true }); b.prop('rubble', { x: -78, z: 74 }); b.prop('tires', { x: -72, z: 76 });
  b.prop('barrel', { x: -84, z: 78 }); b.prop('barrel', { x: -83, z: 79.1 }); b.prop('trashpile', { x: -75, z: 80 });
  b.prop('deadtree', { x: -88, z: 74 }); b.prop('tarp', { x: -79, z: 90, rot: 0.3 });
  // SE corner: auto repair
  b.shell({ x: 82, z: 80, w: 16, h: 5.5, d: 12, doors: ['n', 'w'], style: 'concrete', color: '#8d8d86', sign: 'AUTO REPAIR', signColor: '#c0392b', graffiti: 'EASTSIDE', interior: true });
  b.prop('car', { x: 76, z: 71.5, rot: -0.1, wreck: true }); b.prop('tires', { x: 70, z: 88 }); b.prop('tires', { x: 71.5, z: 89 });
  b.prop('pipes', { x: 86, z: 89.5, rot: 0, len: 6 }); b.prop('barrel', { x: 91, z: 72 }); b.prop('barrel', { x: 90, z: 73.2 });
  b.prop('container', { x: 76, z: 89.5, rot: 0, len: 6, color: '#2a5a8a' });
  b.prop('pole', { x: 69, z: 90, h: 9 }); b.prop('pole', { x: 69, z: 70, h: 9 });

  // =====================================================================
  // STREET LIFE along the four roads
  // =====================================================================
  for (const [x, r, c] of [[-40, 0, '#f2c511'], [20, 0.05, '#f2c511']]) b.prop('car', { x, z: -56.5, rot: Math.PI / 2 + r, color: c });
  b.prop('car', { x: 36, z: -63.5, rot: -Math.PI / 2, color: '#d8d8d8' });
  b.prop('truck', { x: -48, z: 63.5, rot: -Math.PI / 2 });
  b.prop('car', { x: 40, z: 56.5, rot: Math.PI / 2, color: '#f2c511' });
  b.prop('van', { x: 44, z: 63.5, rot: -Math.PI / 2, text: 'LINEN SUPPLY', color: '#e8e8e8' });
  b.prop('car', { x: -56.5, z: 10, rot: 0, color: '#f2c511' });
  b.prop('car', { x: 56.5, z: -30, rot: Math.PI, color: '#f2c511' });
  for (const x of [-30, 30]) { b.prop('lamp', { x, z: -68.6, rot: 0 }); b.prop('lamp', { x: x + 15, z: 68.6, rot: Math.PI }); }
  b.prop('tree', { x: -30, z: -53.5, scale: 1.0 }); b.prop('tree', { x: 38, z: 53.5, scale: 1.1 });
  b.prop('stopsign', { x: 51.5, z: -68.5, rot: Math.PI }); b.prop('stopsign', { x: -51.5, z: 68.5, rot: 0 });
  for (const [x, z] of [[-30, -68.6], [30, 68.6], [-68.6, -40], [68.6, 40]]) b.prop('bollard', { x, z });
  b.prop('barricade', { x: 60, z: -75, rot: Math.PI / 2, text: 'POLICE LINE' }); b.prop('cone', { x: 58, z: -78 }); b.prop('cone', { x: 62, z: -78 });
  b.prop('barricade', { x: -60, z: 75, rot: Math.PI / 2, text: 'NO STANDING' });

  // =====================================================================
  // SPAWNS: team 0 west, team 1 east, neutrals around the loop
  // =====================================================================
  for (const [x, z] of [[-75, -48], [-75, -24], [-75, 0], [-75, 24], [-75, 48], [-78, -87.5], [-75, 77], [-86, -12], [-86, -36]]) b.spawn(0, x, z, Math.PI / 2);
  for (const [x, z] of [[75, -48], [75, -24], [75, 0], [75, 24], [75, 48], [86, -36], [72, 82], [86, 12], [88, 70]]) b.spawn(1, x, z, -Math.PI / 2);
  for (const [x, z] of [[0, 0], [0, -46], [0, 46], [-18, -30], [18, 30], [-40, -60], [40, 60], [-30, -20], [30, 20], [0, 72], [-60, 20], [60, -20]]) b.spawn(null, x, z, 0);

  // ---- cinematic camera shots ----
  b.cinematic(-40, 20, -40, 0, 0);        // across the courtyard between the towers
  b.cinematic(-30, 16, -62, -36, -80);    // bodega / takeout strip
  b.cinematic(60, 18, 92, 0, 80);         // the El platform
  b.cinematic(12, 14, 50, 0, 30);         // playground and mid towers
  return b.finish();
}
