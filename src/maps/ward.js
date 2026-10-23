// WARD — New Orleans (Lower Ninth / Tremé). Rows of candy-coloured shotgun houses, a live-oak neutral ground down
// the boulevard, St. Augustine church, an above-ground cemetery, a jazz hall, a po-boy corner store, a gas station
// canopy, a second-line float, and the Industrial Canal levee floodwall along the north edge in humid golden light.
import * as THREE from 'three';
import { MapBuilder, mat } from './builder.js';

export const def = {
  id: 'ward', name: 'Ward', city: 'New Orleans', size: 170, seed: 504,
  teams: { tdm: 5, ffa: 8 },
  blurb: 'Lower Ninth. Shotgun houses, St. Augustine, the levee wall and a second line under a hazy golden sun.',
  env: { skyTop: '#6f93c4', skyHorizon: '#f2b56a', skyBottom: '#3a2e28', fogColor: '#e4bf8c', fogNear: 48, fogFar: 215, hemiSky: '#e3cca6', hemiGround: '#5a4a38', hemiIntensity: 0.75, sunColor: '#ffc987', sunIntensity: 2.3, sunDir: [-0.78, 0.4, 0.34], ambient: '#5c4c3c', ambientIntensity: 0.26, shadowSize: 95 },
  lightBudget: 12,
  minimapBg: '#2c2a26',
};

export function build() {
  const b = new MapBuilder(def);
  const C = (c) => mat('color', { color: c });
  const PI = Math.PI, H = PI / 2;
  b.ground('asphalt', { seed: 9 });

  // ---------------- helpers ----------------
  const HOUSE = ['#d98a6a', '#9fb3c8', '#e0b07a', '#7fb07a', '#c9a0c0', '#e8d9a0', '#d9c9a3', '#b8c4b0', '#e9a07a', '#88b8b0'];
  const TRIM = ['#f5f0e6', '#2a3a5a', '#8a2a2a', '#3a6a3a', '#6a1b9a', '#1f6f8f'];
  let hi = 0;
  /** narrow shotgun house. rot: 0 faces south, PI faces north, H faces east, -H faces west */
  const shotgun = (x, z, rot, o = {}) => {
    const color = o.color || HOUSE[hi % HOUSE.length], trim = o.trim || TRIM[(hi * 2 + 1) % TRIM.length]; hi++;
    const w = o.w || 5.5, d = o.d || 14, h = o.h || 4.6;
    b.building({ x, z, w, d, h, style: 'plaster', color, floors: 1, floorH: 4.6, roof: 'flat', rooftop: false, rot, awning: o.awning === null ? null : (o.awning || trim), shutters: true, lit: 0.12, graffiti: o.graffiti || null, sign: o.sign || null, signColor: o.signColor || trim, name: o.name || null, winColor: '#2a3a40' });
    const fx = Math.sin(rot), fz = Math.cos(rot);
    // front steps (0.5 m: steppable) + a planter/porch chair for life
    b.box({ x: x + fx * (d / 2 + 0.6), z: z + fz * (d / 2 + 0.6), w: 2.2, h: 0.5, d: 1.2, rot, m: mat('concrete', { color: '#aaa69a', seed: 5 }) });
    const sx = Math.cos(rot), sz = -Math.sin(rot); // frontage axis
    if (o.ac !== false) b.prop('ac', { x: x + sx * (w / 2 + 0.4), z: z + sz * (w / 2 + 0.4), rot: rot + H, y: 2.4 });
    if (o.chair) b.prop('bench', { x: x + fx * (d / 2 + 0.6) + sx * 2.1, z: z + fz * (d / 2 + 0.6) + sz * 2.1, rot: rot + PI });
  };
  /** signboard on a shell face. dir: 0 south, PI north, H east, -H west */
  const signOn = (x, z, w, d, h, dir, text, color) => { const along = Math.abs(dir) === H ? w : d, face = Math.abs(dir) === H ? d : w; b.signboard(x, z, face, along, h, dir, text, color, b.rng); };
  const awningOn = (x, z, w, d, dir, color) => { const along = Math.abs(dir) === H ? w : d, face = Math.abs(dir) === H ? d : w; b.awning(x, z, face, along, dir, color, b.rng); };
  const laundry = (x, z, rot, len, y = 3.1) => { b.prop('laundry', { x, z, rot, len, y }); b.prop('pole', { x: x + Math.cos(rot) * (len / 2), z: z - Math.sin(rot) * (len / 2), h: 3.4, wires: false }); b.prop('pole', { x: x - Math.cos(rot) * (len / 2), z: z + Math.sin(rot) * (len / 2), h: 3.4, wires: false }); };

  // ---------------- roads ----------------
  // Boulevard (Claiborne-style): two carriageways with a neutral ground between them
  b.road(-82, -9, 82, -9, 8, { sidewalk: true });
  b.road(-82, 9, 82, 9, 8, { sidewalk: true });
  b.patch(0, 0, 164, 5.6, 'grass', { seed: 7, color: '#5b7a34', mmColor: '#3d5a2e' }, 0.02);
  for (const x of [-45, 0, 45]) b.road(x, -57, x, 82, 10, { sidewalk: true });
  b.road(-82, -38, 82, -38, 10, { sidewalk: true });
  b.road(-82, 50, 82, 50, 10, { sidewalk: true });

  // live oaks on the neutral ground + benches
  for (const x of [-79, -69, -57, -33, -21, -11, 11, 21, 33, 57, 69, 79]) b.prop('tree', { x, z: 0, scale: 1.6 + ((x * 7) % 4) * 0.1, color: '#3f5a2e' });
  for (const [x, r] of [[-63, 0], [-27, PI], [27, 0], [63, PI]]) b.prop('bench', { x, z: r ? 1.6 : -1.6, rot: r });
  // intersection furniture
  for (const x of [-45, 0, 45]) { b.prop('trafficlight', { x: x + 8.6, z: -16.2, rot: PI }); b.prop('trafficlight', { x: x - 8.6, z: 16.2, rot: 0 }); b.prop('stopsign', { x: x + 8.2, z: -31, rot: PI }); b.prop('stopsign', { x: x - 8.2, z: 57.6, rot: 0 }); }
  for (const [x, z, r, l] of [[-58, -14.6, PI, true], [-20, 14.6, 0, false], [20, -14.6, PI, true], [58, 14.6, 0, false], [-30, 58, 0, true], [30, -46, PI, false]]) b.prop('lamp', { x, z, rot: r, light: l });
  for (const [x, z] of [[-55, -14.6], [10, 14.6], [-10, -30.2], [55, 44.2], [-10, 58], [36, 58]]) b.prop('hydrant', { x, z });
  b.prop('sign', { x: -37.3, z: -17, rot: H, text: 'N CLAIBORNE AV', bg: '#1f6f3f', fg: '#fff', w: 1.6, h: 0.4 });
  b.prop('sign', { x: 37.3, z: 17, rot: H, text: 'DESIRE ST', bg: '#1f6f3f', fg: '#fff', w: 1.4, h: 0.4 });
  b.prop('sign', { x: -8, z: 45, rot: 0, text: 'ST CLAUDE AV', bg: '#1f6f3f', fg: '#fff', w: 1.6, h: 0.4 });
  b.prop('busstop', { x: -50, z: 14.4, rot: 0, ad: 'WHO DAT' });
  b.prop('busstop', { x: 50, z: -14.4, rot: PI, ad: 'SNO-BALLS' });

  // ---------------- LEVEE (north edge): canal, floodwall, grass levee top ----------------
  b.patch(0, -79, 170, 12, 'water', { scale: 10, mmColor: '#2f5a7a' }, 0.02);
  b.wall({ x: -56.5, z: -73.2, len: 57, h: 3.6, t: 0.5, color: '#a2a298', graffiti: 'KATRINA' });
  b.wall({ x: 0, z: -73.2, len: 57, h: 3.6, t: 0.5, color: '#a2a298', graffiti: 'NOLA' });
  b.wall({ x: 56.5, z: -73.2, len: 57, h: 3.6, t: 0.5, color: '#a2a298', graffiti: 'WHO DAT' });
  b.platform({ x: 0, z: -68, w: 164, d: 10, y: 2.0, t: 0.4, m: mat('grass', { seed: 3, color: '#5f7d38' }), rails: false });
  for (const x of [-45, 0, 45]) b.stairs({ x, z: -57.5, dir: 'n', height: 2.4, width: 3 });
  // cover on the levee top
  for (const [x, z] of [[-30, -68], [-12, -70], [20, -67], [36, -69], [62, -68], [-66, -69]]) b.box({ x, y: 2.4, z, w: 3, h: 0.9, d: 0.55, m: mat('concrete', { color: '#9a9a92', seed: 33 }) });
  for (const [x, z] of [[-22, -70.5], [8, -70.5], [52, -70.5], [-55, -70.5]]) { b.prop('crate', { x, z, y: 2.4, size: 1.2 }); b.prop('crate', { x: x + 1.3, z: z + 0.2, y: 2.4, size: 1 }); }
  // pump stations at the levee foot (block the long strip sightline)
  b.shell({ x: -23, z: -60, w: 6, d: 6, h: 3.6, doors: ['w', 's'], windows: false, style: 'concrete', color: '#8a8a80', interior: false, name: 'Levee Pump Station' });
  b.shell({ x: 23, z: -60, w: 6, d: 6, h: 3.6, doors: ['e', 's'], windows: false, style: 'concrete', color: '#8a8a80', interior: false });
  b.prop('pipes', { x: -23, z: -64.5, rot: 0, len: 5 }); b.prop('pipes', { x: 23, z: -64.5, rot: 0, len: 5 });
  b.prop('antenna', { x: -21, z: -61, h: 6 });
  for (const [x, z] of [[-70, -60], [-52, -61], [40, -60], [74, -61]]) b.prop('barrel', { x, z });
  b.prop('deadtree', { x: -36, z: -61 }); b.prop('deadtree', { x: 50, z: -61 });

  // ---------------- BAND A (z -57..-44): house rows facing the back street, backs to the levee ----------------
  for (const x of [-78.75, -70.75, -62.75]) shotgun(x, -50.5, 0, { d: 13, chair: x === -70.75 });
  // vacant Katrina lot with a watermark wall
  b.patch(-56, -51, 7, 12, 'dirt', { seed: 2, mmColor: '#5a4a38' }, 0.02);
  b.wall({ x: -56.5, z: -56, len: 6, h: 2.6, graffiti: 'KATRINA' });
  b.prop('car', { x: -56, z: -49, rot: 0.3, wreck: true }); b.prop('rubble', { x: -58, z: -53 }); b.prop('tires', { x: -54, z: -54 });
  b.prop('billboard', { x: -57, z: -47.5, rot: 0, text: 'WHO DAT', bg: '#6a1b9a', fg: '#ffd700', w: 8, h: 7 });
  for (const x of [-34.75, -26.75, -18.75, -10.75]) shotgun(x, -50.5, 0, { d: 13, graffiti: x === -18.75 ? 'X 9-12' : null });
  laundry(-30.5, -51, H, 6);
  // corner bar + two houses
  b.shell({ x: 13.5, z: -50.5, w: 11, d: 13, h: 4.5, doors: ['s', 'w'], style: 'plaster', color: '#c9a0c0', graffiti: 'TREME' });
  signOn(13.5, -50.5, 11, 13, 4.5, 0, 'MARDI GRAS LOUNGE', '#6a1b9a');
  b.prop('neonSign', { x: 13.5, z: -43.85, rot: 0, text: 'OPEN', color: '#39ff6a', y: 2.6, w: 3 });
  for (const x of [27.25, 35.25]) shotgun(x, -50.5, 0, { d: 13 });
  laundry(21.5, -49, H, 8); b.prop('dumpster', { x: 21, z: -54.5, rot: 0.2 }); b.prop('trashcan', { x: 20, z: -46 });
  for (const x of [55.25, 63.25, 71.25]) shotgun(x, -50.5, 0, { d: 13, chair: x === 63.25 });
  b.patch(78, -51, 7, 12, 'dirt', { seed: 4, mmColor: '#5a4a38' }, 0.02);
  b.wall({ x: 78, z: -56, len: 6, h: 2.6, graffiti: '9TH WARD' });
  b.prop('trashpile', { x: 76, z: -52 }); b.prop('mattress', { x: 80, z: -48, rot: 0.4 }); b.prop('cart', { x: 77, z: -47 });

  // ---------------- BAND B (z -33..-15): church, jazz hall, po-boy store ----------------
  for (const x of [-78.75, -70.75]) shotgun(x, -22.5, 0, {});
  // PO-BOYS corner store (enterable)
  b.shell({ x: -59, z: -24, w: 12, d: 16, h: 4.5, doors: ['e', 's'], style: 'brick', color: '#9c4b32', name: 'Po-Boy Corner' });
  signOn(-59, -24, 12, 16, 4.5, H, 'PO-BOYS', '#c0392b');
  awningOn(-59, -24, 12, 16, 0, '#c0392b');
  b.prop('neonSign', { x: -52.85, z: -27, rot: H, text: 'PO-BOYS', color: '#ffd700', y: 3.4, w: 4.5 });
  b.prop('newsstand', { x: -55, z: -13.6, rot: 0, text: 'ICE' }); b.prop('trashcan', { x: -51, z: -16 });
  for (let i = 0; i < 3; i++) b.prop('crate', { x: -66.5, z: -30 + i * 1.6, size: 1.1 });
  // St. Augustine church (enterable, with steeple)
  b.shell({ x: -24, z: -24, w: 14, d: 16, h: 6, doors: ['s'], style: 'brick', color: '#8a4a3a', name: 'St. Augustine', interior: false });
  signOn(-24, -24, 14, 16, 6, 0, 'ST. AUGUSTINE', '#4a2a6a');
  b.patch(-24, -24, 13, 15, 'tile', { seed: 3, color: '#8c7a6a', scale: 4 }, 0.025);
  for (const z of [-29.5, -27, -24.5]) for (const x of [-27.5, -20.5]) b.prop('bench', { x, z, rot: PI });
  b.box({ x: -24, z: -30.8, w: 3, h: 1.0, d: 0.8, m: mat('plaster', { color: '#d8d2c4', seed: 8 }) });
  const brick = mat('brick', { color: '#8a4a3a', seed: 7 });
  b.box({ x: -29.5, z: -19.5, w: 3.6, h: 13, d: 3.6, m: brick, repeat: [1.2, 4.3] });
  b._mesh(new THREE.ConeGeometry(2.6, 5.5, 4), C('#45454c'), -29.5, 15.75, -19.5, PI / 4);
  b.box({ x: -29.5, y: 18.5, z: -19.5, w: 0.2, h: 1.6, d: 0.2, m: C('#d4af37'), collide: false });
  b.box({ x: -29.5, y: 19.4, z: -19.5, w: 0.9, h: 0.2, d: 0.2, m: C('#d4af37'), collide: false });
  // churchyard
  b.patch(-34.5, -24, 6, 16, 'grass', { seed: 5, mmColor: '#3d5a2e' }, 0.02);
  b.prop('tree', { x: -34.5, z: -28, scale: 1.3, color: '#4a6b36' }); b.prop('bench', { x: -34.5, z: -20, rot: -H });
  b.fence({ x: -34.5, z: -32.2, len: 6, h: 1.6 });
  shotgun(-10.75, -22.5, 0, { color: '#7fb07a', graffiti: 'NOLA' });
  // Jazz hall (enterable, roof via east stairs)
  b.shell({ x: 16, z: -25, w: 16, d: 16, h: 4.2, doors: ['s', 'e'], style: 'brick', color: '#5a2d3a', name: 'Ninth Ward Jazz Hall', stairs: { x: 33.3, z: -21, dir: 'w', width: 2.2 }, graffiti: 'WHO DAT' });
  signOn(16, -25, 16, 16, 4.2, 0, 'JAZZ HALL', '#2a1a4a');
  b.prop('neonSign', { x: 16, z: -16.85, rot: 0, text: 'JAZZ', color: '#ff2d95', y: 2.6, w: 5 });
  b.prop('neonSign', { x: 24.15, z: -28, rot: H, text: 'LIVE', color: '#39c0ff', y: 3.2, w: 3.2 });
  for (let i = 0; i < 3; i++) b.prop('crate', { x: 10, z: -31 + i * 1.5, size: 1 });
  b.prop('dumpster', { x: 27, z: -31.5, rot: 0 }); b.prop('dumpster', { x: 29.3, z: -31.5, rot: 0 });
  b.prop('van', { x: 30, z: -25.5, rot: 0, text: 'BRASS BAND', color: '#2a3a5a' });
  b.prop('shack', { x: 28, z: -18.5, w: 4, d: 3, door: 'w', color: '#6f8a5f' });
  laundry(26, -22, 0, 6, 3.2);
  for (const x of [55.25, 63.25, 71.25, 79.25]) shotgun(x, -26, PI, { chair: x === 71.25 });
  for (const x of [59.25, 67.25, 75.25]) b.fence({ x, z: -18.2, len: 2.2, h: 1.8 });
  laundry(59.25, -17, 0, 5); laundry(75.25, -17, 0, 5);
  b.prop('ac', { x: 52.3, z: -24, rot: H, y: 2.4 });

  // ---------------- BAND C (z 15..43): cemetery, corner stores, Congo Square, float lot ----------------
  // St. Roch cemetery: walled, above-ground tombs
  b.patch(-67, 29.5, 25, 24, 'cobble', { seed: 6, mmColor: '#8a857a' }, 0.02);
  const cw = (x, z, len, rot = 0) => b.wall({ x, z, len, h: 2.4, t: 0.4, rot, color: '#cfc6b4' });
  cw(-75, 17, 10); cw(-59, 17, 10); cw(-67, 42, 26); cw(-80, 29.5, 25, H); cw(-54, 21.5, 9, H); cw(-54, 38.5, 9, H);
  for (const [x, z] of [[-70, 17], [-64, 17], [-54, 26], [-54, 34]]) b.box({ x, z, w: 0.7, h: 3, d: 0.7, m: mat('plaster', { color: '#d8d2c4', seed: 9 }) });
  for (const x of [-76, -67, -58]) for (const z of [23, 30, 37]) { if (x === -67 && z === 30) continue; b.prop('tomb', { x, z, rot: 0 }); }
  b.prop('obelisk', { x: -67, z: 30, h: 6, name: 'St. Roch Cemetery' });
  for (const x of [-71.5, -62.5]) for (const z of [23, 30, 37]) b.prop('grave', { x, z, rot: 0 });
  b.prop('deadtree', { x: -77.5, z: 40 }); b.prop('bush', { x: -57, z: 40, scale: 0.8 }); b.prop('bush', { x: -77, z: 19.5, scale: 0.7 });
  b.prop('tree', { x: -58, z: 19.5, scale: 1.2, color: '#4a6b36' });
  // C-CW: houses facing the cross street, dollar store, basketball court
  for (const z of [18.25, 26.25, 34.25]) shotgun(-31, z, -H, { chair: z === 26.25 });
  b.building({ x: -14, z: 21, w: 12, h: 5.5, d: 12, style: 'concrete', color: '#c9b98a', sign: 'DOLLAR STORE', signColor: '#2a7a4a', rot: PI, awning: '#2a7a4a', graffiti: '504' });
  b.prop('cart', { x: -8.8, z: 28.5, rot: 0.3 }); b.prop('trashcan', { x: -19.5, z: 28 });
  b.prop('court', { x: -16, z: 36.5, w: 14, d: 11 });
  b.prop('hoop', { x: -16, z: 41.6, rot: PI }); b.prop('hoop', { x: -16, z: 31.4, rot: 0 });
  b.fence({ x: -16, z: 30.2, len: 10, h: 2.4 }); b.fence({ x: -23.2, z: 36.5, len: 10, h: 2.4, rot: H });
  b.prop('shack', { x: -34, z: 40.2, w: 4.5, d: 3.2, door: 'e', color: '#8a8f93' });
  // Congo Square plaza (central landmark)
  b.patch(23, 29, 30, 27, 'cobble', { seed: 3, mmColor: '#7a7468' }, 0.02);
  b.prop('statue', { x: 23, z: 22.5, rot: PI, name: 'Congo Square', color: '#4a6b5a', h: 2.4 });
  b.platform({ x: 23, z: 35, w: 8, d: 8, y: 1.0, t: 0.4, m: mat('concrete', { color: '#8a8680', seed: 12 }) });
  b.stairs({ x: 15.3, z: 35, dir: 'e', height: 1.4, width: 2.4 });
  for (const [px, pz] of [[19.6, 31.6], [26.4, 31.6], [19.6, 38.4], [26.4, 38.4]]) b.box({ x: px, y: 1.4, z: pz, w: 0.25, h: 4, d: 0.25, m: C('#f5f0e6'), collide: false });
  b.box({ x: 23, y: 5.3, z: 35, w: 9.2, h: 0.3, d: 9.2, m: C('#2e7d32'), collide: false });
  b.box({ x: 23, y: 5.6, z: 35, w: 6, h: 0.25, d: 6, m: C('#ffd700'), collide: false });
  for (const [x, z, c, s] of [[11.5, 24, '#6a1b9a', '#ffd700'], [11.5, 30, '#2e7d32', '#ffd700'], [11.5, 36, '#ffd700', '#6a1b9a']]) b.prop('flag', { x, z, rot: H, color: c, stripe: s });
  for (const [x, r] of [[17.5, -H], [28.5, H]]) b.prop('bench', { x, z: 22.5, rot: r });
  for (const [x, z] of [[11, 18.5], [35, 18.5], [11, 41], [35, 41]]) b.prop('tree', { x, z, scale: 1.45, color: '#3f5a2e' });
  b.prop('stall', { x: 15, z: 19, rot: 0, color: '#27ae60' }); b.prop('stall', { x: 31, z: 19, rot: 0, color: '#8e44ad' });
  b.prop('planter', { x: 34.5, z: 30, rot: H, w: 4 }); b.prop('planter', { x: 23, z: 28, rot: 0, w: 3 });
  b.prop('trashcan', { x: 30, z: 40 }); b.prop('trashcan', { x: 16, z: 40 });
  b.fence({ x: 13, z: 16, len: 8, h: 1.4 }); b.fence({ x: 33, z: 16, len: 8, h: 1.4 });
  b.fence({ x: 8.5, z: 35, len: 14, h: 1.4, rot: H }); b.fence({ x: 37.5, z: 26, len: 14, h: 1.4, rot: H });
  b.fence({ x: 16, z: 42.2, len: 14, h: 1.4 }); b.fence({ x: 32, z: 42.2, len: 10, h: 1.4 });
  // C-E: houses on the boulevard + second-line float staging lot
  for (const x of [55.25, 63.25, 71.25, 79.25]) shotgun(x, 22, PI, { chair: x === 55.25 });
  b.patch(67, 36, 28, 12, 'dirt', { seed: 8, mmColor: '#5a4a38' }, 0.02);
  b.prop('truck', { x: 62, z: 35, rot: 0, color: '#6a1b9a' });
  for (const [x, z, s] of [[62, 34.5, 1.2], [61.2, 33.2, 1], [62.9, 32.6, 0.9], [62.2, 36.6, 1]]) b.prop('crate', { x, z, y: 3.2, size: s });
  b.prop('flag', { x: 58.8, z: 33, rot: 0, color: '#ffd700', stripe: '#6a1b9a' }); b.prop('flag', { x: 65.2, z: 33, rot: 0, color: '#2e7d32', stripe: '#ffd700' });
  b.prop('van', { x: 74, z: 38, rot: H, text: 'SECOND LINE', color: '#e8e8e8' });
  b.prop('stall', { x: 56, z: 40, rot: 0, color: '#f39c12' });
  b.prop('tires', { x: 79, z: 31 }); b.prop('barrel', { x: 77, z: 35 }); b.prop('barrel', { x: 77.9, z: 36 });
  b.fence({ x: 60, z: 42.4, len: 14, h: 2 }); b.fence({ x: 76, z: 42.4, len: 10, h: 2 });

  // ---------------- BAND D (z 57..82): school, lounge, gas station, back yards ----------------
  for (const x of [-78.75, -70.75, -62.75, -54.75]) shotgun(x, 64.5, PI, { chair: x === -62.75, graffiti: x === -54.75 ? 'X 9-10' : null });
  for (const x of [-74.75, -58.75]) b.fence({ x, z: 72, len: 6, h: 1.8 });
  b.prop('shack', { x: -74, z: 76, w: 4, d: 3.5, door: 'n', color: '#a3714a' });
  laundry(-66.75, 74, 0, 6); b.prop('dumpster', { x: -56, z: 75, rot: 0.1 }); b.prop('tires', { x: -61, z: 79 });
  b.prop('car', { x: -79, z: 71.5, rot: 0, color: '#1c3f8c' });
  // abandoned school
  b.building({ x: -23, z: 69.5, w: 28, h: 8.6, d: 22, style: 'brick', color: '#8a5a4a', sign: 'WARD 9 SCHOOL', signColor: '#1f4f8f', rot: PI, floors: 3, fireEscape: true, graffiti: 'KATRINA', lit: 0.05 });
  b.prop('tarp', { x: -31, z: 80.4, rot: 0 }); b.prop('rubble', { x: -14, z: 80 }); b.prop('tarp', { x: -40.5, z: 62, rot: H });
  b.prop('barricade', { x: -23, z: 56, rot: 0, text: 'NO TRESPASSING' }); b.prop('cone', { x: -20, z: 56.5 }); b.prop('cone', { x: -26, z: 56.5 });
  // Big Chief lounge + houses + back lot
  b.shell({ x: 14, z: 63.5, w: 12, d: 12, h: 4.5, doors: ['n', 'e'], style: 'plaster', color: '#e0b07a' });
  signOn(14, 63.5, 12, 12, 4.5, PI, 'BIG CHIEF LOUNGE', '#8a2a2a');
  awningOn(14, 63.5, 12, 12, PI, '#6a1b9a');
  b.prop('neonSign', { x: 14, z: 57.35, rot: PI, text: 'COLD BEER', color: '#ffb000', y: 2.5, w: 3.6 });
  for (const x of [27.25, 35.25]) shotgun(x, 64.5, PI, {});
  laundry(22.2, 63, H, 8); b.prop('dumpster', { x: 22, z: 69, rot: H });
  b.wall({ x: 23, z: 76, len: 10, h: 2.6, graffiti: 'WHO DAT' });
  b.prop('container', { x: 12, z: 76, rot: 0, len: 6, color: '#2f6f3f' }); b.prop('scaffold', { x: 32, z: 72.5, rot: 0, h: 4, len: 6 });
  b.prop('barrel', { x: 9.5, z: 72 }); b.prop('barrel', { x: 10.5, z: 73 }); b.prop('trashpile', { x: 35, z: 79 }); b.prop('car', { x: 30, z: 80, rot: H, wreck: true });
  // gas station: canopy on four posts + kiosk with roof stairs
  b.patch(66, 63, 28, 10, 'concrete', { seed: 5, color: '#8a8a84', scale: 6, mmColor: '#4a4a48' }, 0.02);
  b.platform({ x: 62, z: 63, w: 16, d: 10, y: 3.2, t: 0.4, m: mat('metal', { seed: 4, color: '#c8c0b0', rust: 0.1 }), rails: false });
  for (const [px, pz] of [[55, 59], [69, 59], [55, 67], [69, 67]]) b.box({ x: px, z: pz, w: 0.4, h: 3.2, d: 0.4, m: C('#d9d0c0') });
  for (const x of [59, 65]) { b.box({ x, z: 63, w: 1.0, h: 1.7, d: 0.6, m: C('#c0392b') }); b.box({ x, z: 63, w: 2.6, h: 0.18, d: 1.4, m: mat('concrete', { color: '#9a9a92', seed: 12 }) }); }
  b.box({ x: 62, y: 3.6, z: 58.2, w: 16, h: 0.9, d: 0.2, m: C('#c0392b'), collide: false });
  b.light(62, 3.1, 63, '#fff2d0', 7, 16);
  b.shell({ x: 74, z: 63, w: 8, d: 10, h: 3.3, doors: ['w'], style: 'concrete', color: '#d9d0c0', name: 'Claiborne Gas', stairs: { x: 74, z: 75.4, dir: 'n', width: 2 } });
  signOn(74, 63, 8, 10, 3.3, -H, 'GAS', '#c0392b');
  b.prop('car', { x: 59, z: 65.8, rot: H, color: '#d8d8d8' }); b.prop('car', { x: 65, z: 60.4, rot: -H, color: '#c9a227' });
  b.prop('trashcan', { x: 70.5, z: 58.5 }); b.prop('tires', { x: 79, z: 69 });
  b.fence({ x: 60, z: 72, len: 12, h: 2 });
  b.prop('dumpster', { x: 79, z: 74, rot: 0 }); b.prop('car', { x: 63, z: 79, rot: 0, color: '#5a6b3a' });

  // ---------------- street details ----------------
  for (const [x, z, r, c] of [[-72, -12, H, null], [-30, -12, H, '#d8d8d8'], [18, -12, -H, null], [62, -12, H, '#1e1e1e'], [-60, 12, -H, null], [-16, 12, -H, '#6b2a6b'], [30, 12, H, null], [70, 12, -H, '#8c1c1c']]) b.prop('car', { x, z, rot: r, color: c || undefined });
  b.prop('bus', { x: -32, z: 11.5, rot: H, color: '#d9d0c0' });
  // second-line police closure on the east boulevard
  b.prop('barricade', { x: 56, z: -7, rot: H, text: 'NOPD' }); b.prop('barricade', { x: 56, z: -11.5, rot: H, text: 'NOPD' });
  for (let i = 0; i < 3; i++) b.prop('cone', { x: 58.5, z: -12 + i * 2.5 });
  for (const [x, z, r] of [[-74, -36, H], [-20, -40, -H], [40, -36, H], [-50, 48, -H], [10, 52, H], [68, 48, -H]]) b.prop('car', { x, z, rot: r });
  for (const [x, z] of [[-41, -22], [-49, 30], [41, 30], [49, -28], [-3, 30], [3, -28], [-3, 66], [41, 66]]) b.prop('car', { x, z, rot: 0 });
  for (const [x, z, r] of [[-37.3, -52, 0], [37.3, 60, 0], [-7.3, 20, 0], [52.7, -36, 0]]) b.prop('pole', { x, z, rot: r, h: 8 });
  b.prop('phonebooth', { x: -37.3, z: -17, rot: 0 });
  b.prop('planter', { x: -8.2, z: -17.5, rot: H, w: 3 }); b.prop('planter', { x: 8.2, z: 17.5, rot: H, w: 3 });
  b.prop('sandbags', { x: -47, z: -56, rot: 0 }); b.prop('sandbags', { x: 47, z: -56, rot: 0 });

  // ---------------- spawns ----------------
  for (const [x, z] of [[-78, -60], [-66, -60], [-56, -50], [-80, -38], [-34, -60], [-78, 78], [-66, 78], [-56, 78], [-31, 40], [-64, -36]]) b.spawn(0, x, z, H);
  for (const [x, z] of [[78, -60], [66, -60], [78, -50], [34, -60], [80, 36], [70, 41], [78, 78], [66, 78], [56, 78], [30, 78]]) b.spawn(1, x, z, -H);
  for (const [x, z] of [[-16, 0], [16, 0], [-45, 30], [45, -26], [23, 27], [-45, -20], [45, 66], [-20, 50], [20, -38], [-60, -38], [60, 50], [0, 70], [-67, 26.5]]) b.spawn(null, x, z, 0);

  // ---------------- cinematic shots ----------------
  b.cinematic(6, 15, -62, 0, 0);
  b.cinematic(-48, 14, 6, -26, -24);
  b.cinematic(46, 15, 48, 23, 31);
  b.cinematic(84, 18, 82, 62, 58);
  return b.finish();
}
