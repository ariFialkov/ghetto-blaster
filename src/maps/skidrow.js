// SKID ROW — Los Angeles. Downtown grid: tent-lined sidewalks, missions, a market hall, San Julian-style park,
// palm trees, murals, a freeway overpass on the east edge, toy-district warehouses to the north.
import { MapBuilder } from './builder.js';

export const def = {
  id: 'skidrow', name: 'Skid Row', city: 'Los Angeles', size: 170, seed: 11,
  teams: { tdm: 5, ffa: 8 },
  blurb: 'Downtown LA. Tent city, missions and a market hall under a hazy sun.',
  env: { skyTop: '#5a86c8', skyHorizon: '#e8c79a', skyBottom: '#2a2a2f', fogColor: '#d9c3a2', fogNear: 60, fogFar: 230, hemiSky: '#cfe0ff', hemiGround: '#6b5a48', hemiIntensity: 0.8, sunColor: '#fff0d0', sunIntensity: 2.6, sunDir: [0.5, 0.9, 0.3], ambient: '#4a4640', ambientIntensity: 0.2, shadowSize: 95 },
  lightBudget: 10,
};

export function build() {
  const b = new MapBuilder(def);
  b.ground('asphalt', { seed: 4 });

  // ---- Street grid (N-S at x=-45,0,45 ; E-W at z=-45,0,45) ----
  for (const x of [-45, 0, 45]) b.road(x, -85, x, 85, 12, { sidewalk: true });
  for (const z of [-45, 0, 45]) b.road(-85, z, 85, z, 12, { sidewalk: true });
  // street furniture at intersections
  for (const x of [-45, 0, 45]) for (const z of [-45, 0, 45]) { b.prop('trafficlight', { x: x + 7.5, z: z - 7.5, rot: Math.PI }); b.prop('lamp', { x: x - 7.5, z: z + 7.5, rot: 0 }); }

  // ---- Block helper: fill a block with a row of buildings along its edge ----
  const blockBuildings = (bx, bz, opts) => {
    // block spans bx±14.5, bz±14.5 (33x33 inside sidewalks 8.2 from road centers)
    const { styles, hs, signs = [], graffiti = [] } = opts;
    let i = 0;
    const slots = [[-10, -10, 9, 9], [1, -10, 10, 9], [11, -10, 7, 9], [-10, 1, 9, 10], [11, 1, 7, 10], [-10, 11, 9, 7], [1, 11, 10, 7]];
    for (const [sx, sz, w, d] of slots) {
      const style = styles[i % styles.length], h = hs[i % hs.length];
      b.building({ x: bx + sx + w / 2 - 4, z: bz + sz + d / 2 - 4, w, d, h, style, sign: signs[i] || null, graffiti: graffiti[i] || null, lit: 0.25 });
      i++;
    }
  };

  // ---- NW block: Union-style mission + liquor store ----
  b.building({ x: -62, z: -62, w: 26, h: 14, d: 22, style: 'plaster', color: '#d9b98a', sign: 'HOPE MISSION', signColor: '#1f4f8f', name: 'Mission', floors: 4, graffiti: 'SKID' });
  b.building({ x: -27, z: -66, w: 14, h: 6, d: 14, style: 'brick', sign: 'LIQUOR', awning: '#b3121b' });
  b.building({ x: -27, z: -52, w: 14, h: 9, d: 12, style: 'concrete', graffiti: 'LA' });
  for (let i = 0; i < 6; i++) b.prop('tent', { x: -52 + i * 4.2, z: -37.5, rot: Math.PI / 2 });
  b.prop('cart', { x: -40, z: -38, rot: 0.5 }); b.prop('mattress', { x: -34, z: -38 });

  // ---- N block: Toy District warehouses ----
  b.building({ x: -22 + 10, z: -64, w: 18, h: 8, d: 20, style: 'concrete', color: '#9a9a92', sign: 'TOYS WHOLESALE', signColor: '#2a7a4a' });
  b.shell({ x: 10, z: -64, w: 18, h: 6, d: 20, doors: ['s', 'e'], style: 'concrete', color: '#8a8a82', stairs: { x: 20, z: -50, dir: 'n', width: 2 }, name: 'Warehouse', sign: 'IMPORTS' });
  b.prop('container', { x: 30, z: -70, rot: 0 }); b.prop('container', { x: 30, z: -64, rot: 0, y: 0 }); b.prop('container', { x: 30, z: -64, rot: 0, y: 2.6 });
  b.prop('truck', { x: -30, z: -44, rot: Math.PI / 2 });
  for (let i = 0; i < 5; i++) b.prop('pallet', { x: 18 + i * 1.5, z: -40, rot: 0.3 * i });

  // ---- NE block: market hall (Grand Central style) ----
  b.shell({ x: 62, z: -62, w: 30, h: 7, d: 28, doors: ['s', 'w', 'n'], style: 'brick', color: '#9c4b32', name: 'Market Hall', sign: 'CENTRAL MARKET', signColor: '#c0392b', interior: true });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.prop('stall', { x: 52 + i * 10, z: -70 + j * 14, rot: 0 });
  b.prop('neonSign', { x: 62, z: -47.6, rot: 0, text: 'TACOS', color: '#ff2d95', y: 4.5, w: 5 });
  b.prop('lamp', { x: 58, z: -40, rot: 0 });

  // ---- W block: residential hotels (SROs) ----
  blockBuildings(-62, 0, { styles: ['brick', 'plaster', 'brick', 'concrete'], hs: [12, 9, 15, 7, 10, 8, 11], signs: ['HOTEL', null, 'SRO', null, 'CAFE', null, null], graffiti: [null, 'CREW', null, 'GB', null, 'ROW', null] });
  for (let i = 0; i < 5; i++) b.prop('tent', { x: -37.5, z: -12 + i * 5, rot: 0 });
  b.prop('car', { x: -52, z: -8, rot: Math.PI / 2, color: '#1e1e1e' });
  b.prop('car', { x: -38, z: 10, rot: -0.1 });

  // ---- CENTER block: San Julian Park ----
  b.patch(0, 0, 30, 30, 'grass', { seed: 7, mmColor: '#3d5a2e' }, 0.02);
  b.fence({ x: 0, z: -15, len: 30, h: 2 }); b.fence({ x: 0, z: 15, len: 30, h: 2 });
  b.fence({ x: -15, z: -9, len: 12, h: 2, rot: Math.PI / 2 }); b.fence({ x: -15, z: 9, len: 12, h: 2, rot: Math.PI / 2 });
  b.fence({ x: 15, z: -9, len: 12, h: 2, rot: Math.PI / 2 }); b.fence({ x: 15, z: 9, len: 12, h: 2, rot: Math.PI / 2 });
  b.prop('statue', { x: 0, z: 0, rot: 0, name: 'San Julian Park', color: '#5a6b5a' });
  for (const [px, pz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) b.prop('palm', { x: px, z: pz });
  for (const [px, pz, r] of [[-5, -4, 0], [5, 4, Math.PI], [-5, 4, 0], [5, -4, Math.PI]]) b.prop('bench', { x: px, z: pz, rot: r });
  b.prop('picnic', { x: 0, z: 10, rot: 0 }); b.prop('trashcan', { x: 12, z: 0 }); b.prop('trashcan', { x: -12, z: 0 });
  b.prop('planter', { x: 0, z: -12, rot: 0, w: 4 });

  // ---- E block: liquor / check cashing strip, parking lot with cars ----
  b.building({ x: 62, z: -8, w: 26, h: 7, d: 12, style: 'plaster', color: '#e0b07a', sign: 'CHECKS CASHED', signColor: '#1f4f8f', awning: '#2a7a4a' });
  b.building({ x: 52, z: 8, w: 10, h: 10, d: 14, style: 'brick', graffiti: 'EASTSIDE' });
  b.patch(66, 8, 16, 14, 'asphalt', { seed: 5, mmColor: '#3a3a40' }, 0.02);
  b.prop('car', { x: 60, z: 6, rot: 0 }); b.prop('car', { x: 64, z: 6, rot: 0, color: '#d8d8d8' }); b.prop('van', { x: 70, z: 6, rot: 0, text: 'PLUMBING' }); b.prop('car', { x: 62, z: 13, rot: Math.PI, wreck: true });
  b.fence({ x: 74, z: 8, len: 14, rot: Math.PI / 2 });
  b.prop('billboard', { x: 70, z: 16, rot: Math.PI, text: 'WELCOME TO SKID ROW', bg: '#1f4f8f', fg: '#ffd166', w: 12, h: 9 });

  // ---- SW block: alley with dumpsters, burned-out building ----
  b.building({ x: -66, z: 56, w: 18, h: 11, d: 22, style: 'brick', color: '#6b3a2c', graffiti: 'WESTSIDE', fireEscape: true });
  b.shell({ x: -44, z: 50, w: 12, h: 5, d: 10, doors: ['n', 'e'], style: 'brick', color: '#7a4a3a', stairs: { x: -37, z: 50, dir: 'w', width: 2 }, sign: 'PAWN', signColor: '#8a5a1a' });
  b.building({ x: -62, z: 72, w: 24, h: 6, d: 8, style: 'concrete', sign: 'BAIL BONDS', signColor: '#c0392b' });
  for (let i = 0; i < 3; i++) b.prop('dumpster', { x: -50 + i * 3, z: 66, rot: 0 });
  b.prop('rubble', { x: -40, z: 70 }); b.prop('tires', { x: -36, z: 64 }); b.prop('trashpile', { x: -46, z: 62 });
  b.prop('car', { x: -40, z: 38, rot: Math.PI / 2, color: '#8c1c1c' });

  // ---- S block: church + LAPD scene ----
  b.building({ x: -4, z: 64, w: 20, h: 12, d: 22, style: 'plaster', color: '#e8dcc0', sign: 'IGLESIA', signColor: '#8a5a1a', name: 'Church', lit: 0.1 });
  b.prop('obelisk', { x: 12, z: 50, h: 5 });
  b.prop('car', { x: 2, z: 38, rot: 0.2, color: '#d8d8d8' }); b.prop('barricade', { x: -6, z: 38, rot: 0, text: 'LAPD LINE' }); b.prop('barricade', { x: 8, z: 36, rot: 0.4, text: 'LAPD LINE' });
  for (let i = 0; i < 4; i++) b.prop('cone', { x: -8 + i * 3, z: 34 });
  b.prop('busstop', { x: -12, z: 37.5, rot: Math.PI, ad: 'BLAST' });

  // ---- SE block: freeway overpass + chain-link lot ----
  b.prop('overpass', { x: 62, z: 62, rot: 1, len: 44, w: 10, y: 6 });
  b.stairs({ x: 56, z: 40, dir: 'e', height: 6.8, width: 2.4 });
  b.fence({ x: 70, z: 45, len: 20, rot: Math.PI / 2 });
  b.prop('tarp', { x: 48, z: 70, rot: 0.3 }); b.prop('tent', { x: 48, z: 64, rot: 0 }); b.prop('tent', { x: 52, z: 76, rot: 1 });
  b.prop('barrel', { x: 70, z: 70 }); b.prop('barrel', { x: 71, z: 71.2 }); b.prop('crate', { x: 72, z: 64, size: 1.3 });
  b.wall({ x: 50, z: 57, len: 12, h: 2.6, rot: 0, graffiti: 'EAST 6TH' });
  b.prop('hoop', { x: 76, z: 76, rot: -Math.PI / 2 });

  // ---- street details along avenues ----
  const rngCars = [[-20, -37.5, 0.05], [20, -37.5, 0], [-20, 37.5, Math.PI], [26, 37.5, Math.PI + 0.1], [-37.5, 20, Math.PI / 2], [37.5, -24, -Math.PI / 2], [-37.5, -24, Math.PI / 2]];
  rngCars.forEach(([x, z, r], i) => b.prop(i % 3 === 2 ? 'van' : 'car', { x, z, rot: r }));
  for (const [x, z] of [[-30, -8.5], [30, 8.5], [8.5, -30], [-8.5, 30], [-60, 8.5], [60, -8.5]]) b.prop('hydrant', { x, z });
  for (const x of [-70, -20, 20, 70]) { b.prop('lamp', { x, z: -8.2, rot: 0, light: x === 20 }); b.prop('lamp', { x, z: 8.2, rot: Math.PI, light: x === -20 }); }
  for (const z of [-70, -20, 20, 70]) { b.prop('palm', { x: -8.5, z }); b.prop('palm', { x: 8.5, z: z + 6 }); }
  for (const x of [-60, -30, 30, 60]) { b.prop('palm', { x, z: -53.5 }); b.prop('palm', { x: x + 4, z: 53.5 }); }
  b.prop('bus', { x: 37.5, z: 60, rot: 0 });
  b.prop('stopsign', { x: 8.5, z: -53.5, rot: Math.PI });

  // ---- Spawns: team 0 west, team 1 east ----
  for (const [x, z] of [[-80, -40], [-80, 0], [-80, 40], [-62, -37.5], [-62, 37.5], [-42, -30], [-42, 30], [-80, -20], [-80, 20]]) b.spawn(0, x, z, Math.PI / 2);
  for (const [x, z] of [[80, -40], [80, 0], [80, 40], [62, 20], [62, -20], [42, 24], [42, -30], [80, -20], [80, 20]]) b.spawn(1, x, z, -Math.PI / 2);
  for (const [x, z] of [[0, -22], [0, 22], [-22, 0], [22, 0], [-20, -75], [20, 75], [80, -80], [-80, 80], [38, 38], [-38, -38]]) b.spawn(null, x, z, 0);

  // ---- cinematic camera shots ----
  b.cinematic(-30, 22, -30, 0, 0); b.cinematic(70, 18, -70, 62, -62); b.cinematic(60, 14, 70, 20, 40); b.cinematic(-70, 20, 60, -40, 20);
  return b.finish();
}
