// TENEMENTS — Chicago, South/West Side. An elevated "L" track runs north-south over the central avenue with a
// playable station platform; brick courtyard flats and greystones, Chicago alleys with garages (one roof reachable),
// a corner tavern under an OLD STYLE neon, a currency exchange, a brick church, a fieldhouse park, a vacant lot and a
// graffiti-covered freight viaduct in the south-east. Cold late-autumn light: pale sky, low sun, long shadows.
import { MapBuilder } from './builder.js';

export const def = {
  id: 'tenements', name: 'Tenements', city: 'Chicago', size: 180, seed: 23,
  teams: { tdm: 5, ffa: 9 },
  blurb: 'South Side Chicago. Courtyard flats and greystones under the rattle of the L, cold November light.',
  env: {
    skyTop: '#6c86a4', skyHorizon: '#cfd7de', skyBottom: '#3a3d42', fogColor: '#bcc5cd', fogNear: 55, fogFar: 225,
    hemiSky: '#c6d2de', hemiGround: '#4a4440', hemiIntensity: 0.7, sunColor: '#fff2dc', sunIntensity: 2.3, sunDir: [-0.75, 0.38, 0.5],
    ambient: '#3f4248', ambientIntensity: 0.25, shadowSize: 100,
  },
  lightBudget: 14,
  minimapBg: '#26282c',
};

const PI = Math.PI, H = PI / 2;
const GREY = ['#9a9a90', '#a8a498', '#8e8c84', '#b0aca0'];
const BRICK = ['#8a3b2a', '#7a4a3a', '#6b3a2c', '#a85a3c', '#9c4b32'];
const AUTUMN = ['#8a6a2a', '#a0522d', '#b5742a', '#6b5a2a', '#9a4a2a'];

export function build() {
  const b = new MapBuilder(def);
  b.ground('asphalt', { seed: 9 });
  const rng = b.rng;

  // =====================================================================================
  // Street grid. A = the avenue under the L (x=0). B/C = side streets (x=±54). D/E/F = cross streets (z=-50, 50, 0).
  // =====================================================================================
  b.road(0, -87, 0, 87, 14, { sidewalk: true });
  b.road(-54, -87, -54, 87, 11, { sidewalk: true });
  b.road(54, -87, 54, 87, 11, { sidewalk: true });
  b.road(-87, -50, 87, -50, 11, { sidewalk: true });
  b.road(-87, 50, 87, 50, 11, { sidewalk: true });
  b.road(-87, 0, 87, 0, 10, { sidewalk: true });
  // intersections: traffic lights + stop signs + hydrants
  for (const x of [-54, 0, 54]) for (const z of [-50, 0, 50]) {
    const hw = x === 0 ? 7 : 5.5, hd = z === 0 ? 5 : 5.5;
    b.prop('trafficlight', { x: x + hw + 1.2, z: z - hd - 1.2, rot: PI });
    b.prop('hydrant', { x: x - hw - 1.4, z: z - hd - 1.6 });
    b.prop('trashcan', { x: x + hw + 1.5, z: z + hd + 1.6 });
  }
  for (const [x, z, r] of [[-47.5, -44, 0], [47.5, 56, PI], [-61, 6.4, H], [61, -6.4, -H]]) b.prop('stopsign', { x, z, rot: r });

  // =====================================================================================
  // Helpers
  // =====================================================================================
  const stoop = (x, z, rot) => { // greystone front stoop: two step-able blocks in front of the door
    const sx = Math.sin(rot), cz = Math.cos(rot);
    b.box({ x: x + sx * 0.5, z: z + cz * 0.5, w: rot === 0 || Math.abs(rot) === PI ? 2.6 : 1.2, h: 0.95, d: rot === 0 || Math.abs(rot) === PI ? 1.2 : 2.6, m: null, color: '#b5b0a4' });
    b.box({ x: x + sx * 1.6, z: z + cz * 1.6, w: rot === 0 || Math.abs(rot) === PI ? 2.6 : 1.0, h: 0.48, d: rot === 0 || Math.abs(rot) === PI ? 1.0 : 2.6, color: '#b5b0a4' });
  };
  // Garage row: continuous roofed row of small garages along an alley. axis 'x' => row runs along x, doors face dz side.
  const garageRow = (x0, z0, n, axis, doorSide, opts = {}) => {
    const pitch = 4.65, gw = 4.55, gd = 4.5, gh = opts.h || 2.8;
    for (let i = 0; i < n; i++) {
      const c = (axis === 'x' ? x0 : z0) + pitch * i + gw / 2;
      const cx = axis === 'x' ? c : x0, cz = axis === 'x' ? z0 : c;
      const color = rng.pick(['#7a6a5a', '#8a7a62', '#6f655a', '#857868', '#9a8a72']);
      const w = axis === 'x' ? gw : gd, d = axis === 'x' ? gd : gw;
      b.box({ x: cx, z: cz, w, h: gh, d, color });
      // door slab on the alley side
      const door = rng.pick(['#4a4a4a', '#8a2a2a', '#c8c8c0', '#3a4a6a', '#6a5a3a']);
      if (axis === 'x') b.box({ x: cx, y: 0.02, z: cz + doorSide * (gd / 2 + 0.04), w: 3.4, h: 2.3, d: 0.08, color: door, collide: false });
      else b.box({ x: cx + doorSide * (gd / 2 + 0.04), y: 0.02, z: cz, w: 0.08, h: 2.3, d: 3.4, color: door, collide: false });
    }
  };
  const alleyDressing = (x, z, w, d) => { // asphalt strip + junk
    b.patch(x, z, w, d, 'asphalt', { seed: 13, mmColor: '#333338' }, 0.012);
  };
  const autumnTree = (x, z, s) => b.prop('tree', { x, z, scale: s || rng.float(0.9, 1.3), color: rng.pick(AUTUMN) });
  const woodFence = (x, z, len, rot) => b.wall({ x, z, len, h: 1.8, t: 0.12, rot, color: '#6a5842' });
  const parkedCars = (list) => list.forEach(([x, z, r, kind]) => b.prop(kind || 'car', { x, z, rot: r }));

  // =====================================================================================
  // THE L — elevated track along the avenue, station in the middle (z -15..15) with platforms either side.
  // =====================================================================================
  const Y = 6.5; // deck underside; deck top at 7.3
  b.prop('overpass', { x: 0, z: -50, rot: 1, len: 70, w: 9, y: Y });
  b.prop('overpass', { x: 0, z: 50, rot: 1, len: 70, w: 9, y: Y });
  // station deck + platforms
  const steel = { color: '#3b3f45' };
  b.box({ x: 0, y: Y, z: 0, w: 9, h: 0.8, d: 30, color: '#75756f' });
  for (const z of [-5, 5]) b.box({ x: 0, z, w: 1.6, h: Y, d: 1.6, color: '#75756f' });
  for (const s of [-1, 1]) {
    b.platform({ x: s * 7, z: 0, w: 5, d: 30, y: Y, t: 0.8, rails: false });
    for (const z of [-11, 0, 11]) b.box({ x: s * 7.5, z, w: 0.9, h: Y, d: 0.9, ...steel });
    // outer safety rail (non-walkable), canopy with posts
    b.box({ x: s * 9.4, y: Y + 0.8, z: 0, w: 0.12, h: 1.05, d: 30, color: '#2b2b2b', walkable: false });
    for (const z of [-12, -6, 0, 6, 12]) b.box({ x: s * 9.0, y: Y + 0.8, z, w: 0.22, h: 3.3, d: 0.22, color: '#2b5c3a', walkable: false });
    b.box({ x: s * 7.2, y: Y + 4.1, z: 0, w: 5.2, h: 0.25, d: 27, color: '#2b5c3a', collide: false });
    // benches, trash, ad panels on the platform
    b.prop('bench', { x: s * 7.6, z: -4, rot: s > 0 ? -H : H });
    b.prop('bench', { x: s * 7.6, z: 5, rot: s > 0 ? -H : H });
    b.box({ x: s * 8.4, y: Y + 0.8, z: 9, w: 0.4, h: 1.4, d: 0.5, ...steel }); // trash bin
    b.box({ x: s * 8.6, y: Y + 0.8, z: -9, w: 0.3, h: 2.2, d: 2.4, color: '#1f4f8f' }); // ad panel / map case
  }
  // tracks (visual) and third-rail boxes, signal cabinets as cover on the deck
  for (const x of [-2.6, -1.2, 1.2, 2.6]) b.box({ x, y: Y + 0.8, z: 0, w: 0.14, h: 0.14, d: 170, color: '#5a4a3a', collide: false });
  for (const z of [-70, -40, -24, 24, 40, 70]) b.box({ x: z % 20 === 0 ? 2.6 : -2.6, y: Y + 0.8, z, w: 1.1, h: 1.5, d: 0.8, color: '#6f6f6a' });
  for (const z of [-78, -58, 58, 78]) b.box({ x: 0, y: Y + 0.8, z, w: 0.8, h: 1.2, d: 0.8, ...steel });
  // station name boards + lights
  b.prop('neonSign', { x: 9.5, z: -12.5, rot: H, text: 'ASHLAND', color: '#ffffff', y: Y + 3.0, w: 3.2, light: false });
  b.prop('neonSign', { x: -9.5, z: 12.5, rot: -H, text: 'ASHLAND', color: '#ffffff', y: Y + 3.0, w: 3.2, light: false });
  b.light(7, Y + 3.6, 0, '#ffe9c0', 7, 16); b.light(-7, Y + 3.6, 0, '#ffe9c0', 7, 16);
  b.light(0, 5.6, 0, '#ffd9a0', 6, 14);
  // stairs up to the platforms (east platform from the south, west platform from the north)
  b.stairs({ x: 7, z: 29.3, dir: 'n', height: Y + 0.8, width: 2.4 });
  b.stairs({ x: -7, z: -29.3, dir: 's', height: Y + 0.8, width: 2.4 });
  // station house at the foot of the stairs (ticket booth boxes) + turnstile-ish barriers
  b.box({ x: 8.3, z: 32.5, w: 1.8, h: 2.6, d: 2.6, color: '#2b5c3a' });
  b.box({ x: -8.3, z: -32.5, w: 1.8, h: 2.6, d: 2.6, color: '#2b5c3a' });
  b.landmarks.push({ x: 0, z: 0, name: 'Ashland L Station' });

  // avenue life under the L: parked cars, barriers, lamps, bus stop, newsstand, pigeons' worth of trash
  parkedCars([[-5.6, -70, 0], [-5.6, -44, 0, 'van'], [-5.6, 38, 0], [-5.6, 66, 0],
    [5.6, -76, PI], [5.6, -40, PI, 'van'], [5.6, -20, PI], [5.6, 72, PI]]);
  b.prop('car', { x: 5.6, z: 8, rot: PI, wreck: true });
  b.prop('bus', { x: -4.4, z: -10, rot: 0, color: '#d9d9d9' });
  for (const z of [-70, -36, 36, 70]) b.prop('lamp', { x: -8.5, z, rot: H, light: z === 36 || z === -36 });
  for (const z of [-54, 18, 54]) b.prop('lamp', { x: 8.5, z, rot: -H, light: z === 18 });
  b.prop('busstop', { x: 8.4, z: -34, rot: -H, ad: 'BLAST' });
  b.prop('newsstand', { x: -8.3, z: 14, rot: H, text: 'SUN-TIMES' });
  for (const z of [-27, -22, 22, 27]) b.prop('barrier', { x: z < 0 ? 3.2 : -3.2, z, rot: 0, len: 3 });
  for (const z of [-24.5, 24.5]) b.prop('cone', { x: z < 0 ? 3.2 : -3.2, z });
  b.prop('trashpile', { x: 2.2, z: -8.5 }); b.prop('trashcan', { x: -8.6, z: -40 }); b.prop('trashcan', { x: 8.6, z: 40 });
  b.prop('stall', { x: 13.2, z: -11, rot: H, color: '#c0392b' }); // hot dog stand
  b.prop('sign', { x: 12, z: -8.6, rot: PI, text: 'RED HOTS', bg: '#c0392b', fg: '#ffe066', w: 1.6, h: 0.7 });
  b.prop('barrel', { x: 14.5, z: -8.8 });

  // =====================================================================================
  // WEST COLUMN (team 0 side) — x -87..-62
  // =====================================================================================
  // W-N: cold storage warehouse with roof access, loading dock
  b.shell({ x: -68.25, z: -72.75, w: 12, h: 5.5, d: 22, doors: ['e', 's'], style: 'brick', color: '#7a4a3a', sign: 'COLD STORAGE', signColor: '#1f4f8f', stairs: { x: -75.3, z: -61.5, dir: 'n', width: 2 }, graffiti: 'WESTSIDE' });
  b.prop('watertower', { x: -66, z: -78, y: 5.8, h: 4 });
  b.prop('truck', { x: -66, z: -56.2, rot: H, color: '#5a5a5a' });
  for (let i = 0; i < 4; i++) b.prop('pallet', { x: -71 + (i % 2) * 1.5, z: -66 - Math.floor(i / 2) * 1.3, rot: 0.2 * i });
  b.prop('container', { x: -81, z: -84, rot: 0, len: 6, color: '#6a6a6a' });
  b.prop('dumpster', { x: -79, z: -62, rot: 0 }); b.prop('barrel', { x: -84, z: -74 }); b.prop('barrel', { x: -83.2, z: -73.1 });
  b.fence({ x: -74.5, z: -85.5, len: 24, h: 2.2 });
  b.prop('pole', { x: -77, z: -58.5, h: 9 });

  // W-MN: three greystones facing the side street, gangways between, back yards with garages
  for (const z of [-36.5, -25, -13.5]) {
    b.building({ x: -67.5, z, w: 9, d: 11, h: 10, style: 'concrete', color: rng.pick(GREY), rot: H, floors: 3, lit: 0.3, seed: 100 + z, roof: 'flat' });
    stoop(-61.9, z, H);
  }
  for (const z of [-30.75, -19.25]) woodFence(-82, z, 8, 0);
  for (const z of [-38, -27, -16]) b.box({ x: -81.5, z, w: 5, h: 2.8, d: 5, color: rng.pick(['#7a6a5a', '#8a7a62', '#6f655a']) });
  b.prop('laundry', { x: -76, z: -36.5, rot: H, len: 6, y: 3.2 });
  b.prop('dumpster', { x: -76, z: -33, rot: H }); b.prop('trashpile', { x: -76, z: -18 });
  b.prop('car', { x: -77, z: -41, rot: H, color: '#1c3f8c' });
  autumnTree(-84, -42); autumnTree(-84, -10);
  b.prop('deadtree', { x: -85, z: -23 });

  // W-MS: corner store, 3-flat, vacant corner lot
  b.building({ x: -68, z: 13, w: 12, d: 10, h: 7, style: 'brick', color: '#8a3b2a', sign: 'FOOD & LIQUOR', signColor: '#b3121b', awning: '#b3121b', graffiti: 'CHI', seed: 31, roof: 'flat' });
  b.prop('neonSign', { x: -62.3, z: 13, rot: H, text: 'OPEN', color: '#ff2d2d', y: 3.2, w: 2.4 });
  b.building({ x: -68, z: 26.5, w: 11, d: 12, h: 11, style: 'tenement', color: '#6b4a3a', fireEscape: true, rot: H, seed: 32, roof: 'flat' });
  b.patch(-74, 37.5, 24, 9, 'dirt', { seed: 3, mmColor: '#4a4336' }, 0.012);
  b.prop('rubble', { x: -70, z: 38 }); b.prop('tires', { x: -78, z: 40 }); b.prop('deadtree', { x: -82, z: 36 }); b.prop('mattress', { x: -66, z: 40, rot: 0.4 });
  b.fence({ x: -62.3, z: 37.5, len: 9, rot: H, h: 2 }); b.fence({ x: -74, z: 41.8, len: 24, h: 2 });
  b.box({ x: -81.5, z: 12, w: 5, h: 2.8, d: 5, color: '#857868' });
  b.prop('dumpster', { x: -76, z: 20, rot: 0 }); b.prop('car', { x: -78, z: 28, rot: 0, color: '#d8d8d8' });
  woodFence(-83, 32.5, 6, 0);

  // W-S: coin laundry + tenement, back lot
  b.building({ x: -68, z: 63, w: 12, d: 10, h: 6, style: 'plaster', color: '#c9c0b0', sign: 'COIN LAUNDRY', signColor: '#1f6fa8', awning: '#1f6fa8', rot: PI, seed: 33, roof: 'flat' });
  b.building({ x: -68, z: 77, w: 13, d: 12, h: 12, style: 'brick', color: '#6b3a2c', fireEscape: true, rot: H, graffiti: 'SOUTHSIDE', seed: 34, roof: 'flat' });
  b.box({ x: -81.5, z: 84, w: 5, h: 2.8, d: 4.5, color: '#6f655a' });
  b.prop('van', { x: -78, z: 70, rot: 0, text: 'PLUMBING' });
  b.prop('dumpster', { x: -76, z: 60, rot: 0 }); b.prop('trashpile', { x: -84, z: 76 }); b.prop('laundry', { x: -77, z: 80, rot: 0, len: 6, y: 3 });
  woodFence(-82, 69.25, 8, 0); b.prop('pole', { x: -85, z: 62, h: 9 });
  autumnTree(-84, 58); b.prop('bush', { x: -75, z: 65, color: '#6b5a2a' });

  // =====================================================================================
  // EAST COLUMN (team 1 side) — x 62..87
  // =====================================================================================
  // E-N: liquor store + tenement
  b.building({ x: 68, z: -63, w: 12, d: 10, h: 6, style: 'plaster', color: '#e0b07a', sign: 'LIQUORS', signColor: '#8a1a1a', awning: '#2a7a4a', seed: 41, roof: 'flat' });
  b.building({ x: 68, z: -78, w: 13, d: 12, h: 13, style: 'brick', color: '#9c4b32', fireEscape: true, rot: -H, graffiti: 'EASTSIDE', seed: 42, roof: 'flat' });
  b.box({ x: 81.5, z: -84, w: 5, h: 2.8, d: 4.5, color: '#857868' });
  b.prop('dumpster', { x: 76, z: -68, rot: 0 }); b.prop('car', { x: 78, z: -60, rot: 0, color: '#5a6b3a' });
  b.prop('trashpile', { x: 84, z: -70 }); b.prop('laundry', { x: 77, z: -78, rot: 0, len: 6, y: 3 });
  woodFence(82, -70, 8, 0); b.prop('pole', { x: 85, z: -58.5, h: 9 });

  // E-MN: storefront church + two 3-flats facing the side street
  b.building({ x: 68, z: -37, w: 9, d: 12, h: 6, style: 'plaster', color: '#d9d2c0', sign: 'MT ZION M.B. CHURCH', signColor: '#5b2a8a', rot: -H, seed: 43, roof: 'flat' });
  for (const z of [-25, -12.5]) { b.building({ x: 68, z, w: 10, d: 12, h: 11, style: 'tenement', color: rng.pick(['#5c4033', '#7d5a46']), fireEscape: true, rot: -H, seed: 44 + z, roof: 'flat' }); }
  for (const z of [-38, -27, -16]) b.box({ x: 81.5, z, w: 5, h: 2.8, d: 5, color: rng.pick(['#7a6a5a', '#8a7a62', '#6f655a']) });
  for (const z of [-31.25, -18.75]) woodFence(82, z, 8, 0);
  b.prop('dumpster', { x: 76, z: -33, rot: H }); b.prop('trashpile', { x: 76, z: -18 }); b.prop('car', { x: 77, z: -41, rot: H, wreck: true });
  autumnTree(84, -42); b.prop('deadtree', { x: 85, z: -23 }); autumnTree(84, -10);

  // E-MS: greystones facing west + back yards
  for (const z of [12.5, 24, 35.5]) {
    b.building({ x: 67.5, z, w: 9, d: 11, h: 10, style: 'concrete', color: rng.pick(GREY), rot: -H, floors: 3, lit: 0.3, seed: 200 + z, roof: 'flat' });
    stoop(61.9, z, -H);
  }
  for (const z of [18.25, 29.75]) woodFence(82, z, 8, 0);
  for (const z of [11, 22, 33]) b.box({ x: 81.5, z, w: 5, h: 2.8, d: 5, color: rng.pick(['#7a6a5a', '#8a7a62', '#6f655a']) });
  b.prop('laundry', { x: 76, z: 12.5, rot: H, len: 6, y: 3.2 }); b.prop('dumpster', { x: 76, z: 40, rot: 0 }); b.prop('car', { x: 77, z: 8.5, rot: H, color: '#777' });
  autumnTree(84, 41); autumnTree(84, 8.5);

  // =====================================================================================
  // MID-WEST NORTH — courtyard tenement (U-shaped, opens south onto the cross street)
  // =====================================================================================
  for (const x of [-41.5, -14.5]) b.building({ x, z: -71, w: 9, d: 26, h: 11, style: 'brick', color: '#8a3b2a', fireEscape: true, floors: 3, seed: 51 + x, name: x < -20 ? 'Courtyard Flats' : null });
  b.building({ x: -28, z: -81, w: 19, d: 10, h: 11.5, style: 'brick', color: '#8a3b2a', roof: 'flat', floors: 3, seed: 53 });
  b.patch(-28, -67, 18, 18, 'grass', { seed: 5, color: '#6b6a3a', mmColor: '#4f4e30' }, 0.012);
  b.patch(-28, -67, 2.4, 18, 'sidewalk', { mmColor: '#6a6a66' }, 0.016);
  b.prop('laundry', { x: -28, z: -72, rot: 0, len: 12, y: 4.2 });
  b.prop('deadtree', { x: -33, z: -70 }); autumnTree(-23, -63, 1.0);
  for (const [x, z, r] of [[-33, -62, H], [-23, -70, -H]]) b.prop('bench', { x, z, rot: r });
  b.prop('trashcan', { x: -32, z: -74 }); b.prop('trashpile', { x: -24, z: -75 }); b.prop('tires', { x: -34, z: -75.5 });
  b.fence({ x: -33.5, z: -58, len: 7, h: 1.3 }); b.fence({ x: -22.5, z: -58, len: 7, h: 1.3 });
  b.prop('car', { x: -42, z: -55.5, rot: H, color: '#c9a227' }); b.prop('car', { x: -20, z: -55.6, rot: H });
  b.prop('pole', { x: -46.5, z: -56, h: 9 }); b.prop('lamp', { x: -12, z: -57, rot: 0 });

  // =====================================================================================
  // MID-WEST MIDDLE-NORTH — tavern, hardware, alley with garages (roof reachable), currency exchange
  // =====================================================================================
  b.shell({ x: -15.75, z: -35.25, w: 12, h: 5, d: 12, doors: ['e', 's'], style: 'brick', color: '#6b3a2c', name: 'Old Style Tavern', sign: 'TAVERN', signColor: '#8a1a1a', graffiti: 'PLAYERS' });
  b.prop('neonSign', { x: -9.45, z: -35.25, rot: H, text: 'OLD STYLE', color: '#ff3b30', y: 3.9, w: 4.2 });
  b.prop('bench', { x: -16.75, z: -38.5, rot: 0 }); b.prop('barrel', { x: -20.5, z: -34 }); b.prop('crate', { x: -19.5, z: -32.5, size: 1 }); b.prop('crate', { x: -12.5, z: -39.5, size: 1.2 });
  b.prop('pole', { x: -9.5, z: -42, h: 9, wires: false });
  b.building({ x: -35.5, z: -35.5, w: 21, d: 13, h: 12, style: 'brick', color: '#a85a3c', fireEscape: true, sign: 'HARDWARE', signColor: '#2a7a4a', rot: PI, floors: 4, graffiti: 'SOUTHSIDE', seed: 61 });
  // alley z -29..-23
  alleyDressing(-28, -26, 36, 6);
  b.prop('dumpster', { x: -31, z: -27.6, rot: 0 }); b.prop('dumpster', { x: -20, z: -27.6, rot: 0 }); b.prop('trashpile', { x: -14, z: -27.4 });
  b.prop('pole', { x: -40, z: -28.6, h: 9 }); b.prop('pole', { x: -18, z: -28.6, h: 9 }); b.prop('laundry', { x: -34, z: -26, rot: 0, len: 6, y: 3.4 });
  b.prop('car', { x: -24, z: -26, rot: H, wreck: true });
  garageRow(-44.5, -21, 7, 'x', -1);
  b.stairs({ x: -44.5, z: -24, dir: 'e', height: 2.8, width: 2 });
  b.prop('tires', { x: -22, z: -21 }); b.prop('crate', { x: -30, z: -20.5, size: 1, y: 2.8 }); b.prop('barrel', { x: -16, z: -21.5 });
  b.box({ x: -40, y: 2.8, z: -21, w: 1.4, h: 0.9, d: 1.2, color: '#9aa0a6' }); // ac unit on the garage roof
  // south row fronting z=0 street
  b.building({ x: -17, z: -13.5, w: 14, d: 11, h: 7, style: 'concrete', color: '#c8b89a', sign: 'CURRENCY EXCHANGE', signColor: '#f2c200', awning: '#f2c200', seed: 62 });
  b.prop('neonSign', { x: -17, z: -7.85, rot: 0, text: 'CHECKS CASHED', color: '#ffd166', y: 2.6, w: 3.6 });
  b.building({ x: -36.5, z: -13.5, w: 19, d: 11, h: 11, style: 'brick', color: '#7a4a3a', fireEscape: true, floors: 3, graffiti: 'CHI-TOWN', seed: 63 });
  b.prop('car', { x: -30, z: -6.3, rot: H, color: '#1e1e1e' }); b.prop('car', { x: -14, z: -6.3, rot: H, color: '#8c1c1c' });
  b.prop('phonebooth', { x: -24.9, z: -8.2, rot: 0 }); b.prop('trashcan', { x: -11, z: -8.3 });

  // =====================================================================================
  // MID-EAST MIDDLE-NORTH — avenue storefronts, N-S alley with garages, greystones on the side street
  // =====================================================================================
  b.building({ x: 18, z: -35, w: 14, d: 12, h: 12, style: 'brick', color: '#6b3a2c', fireEscape: true, sign: 'LIQUOR', signColor: '#b3121b', awning: '#b3121b', rot: -H, floors: 4, seed: 71 });
  b.building({ x: 18, z: -20, w: 10, d: 12, h: 9, style: 'concrete', color: '#9a9a92', sign: 'BARBER SHOP', signColor: '#1f4f8f', rot: -H, graffiti: 'EAST SIDE', seed: 72 });
  alleyDressing(26.5, -24.5, 5, 35);
  b.prop('dumpster', { x: 26, z: -40, rot: H }); b.prop('dumpster', { x: 26, z: -30, rot: H }); b.prop('trashpile', { x: 27, z: -14 });
  b.prop('pole', { x: 24.6, z: -34, h: 9 }); b.prop('pole', { x: 24.6, z: -12, h: 9 });
  garageRow(31.25, -41, 7, 'z', -1);
  b.prop('laundry', { x: 31, z: -9, rot: H, len: 4, y: 3 });
  for (const z of [-36.5, -25, -13.5]) {
    b.building({ x: 40.5, z, w: 9, d: 11, h: 10, style: 'concrete', color: rng.pick(GREY), rot: H, floors: 3, lit: 0.3, seed: 300 + z, roof: 'flat' });
    stoop(46.1, z, H);
  }
  autumnTree(47.4, -31); autumnTree(47.4, -20);
  b.prop('car', { x: 12.6, z: -46.5, rot: H, color: '#d8d8d8' });

  // =====================================================================================
  // MID-EAST NORTH — the brick church (enterable) with bell tower, rectory, parking lot
  // =====================================================================================
  b.shell({ x: 24.75, z: -71.25, w: 18, h: 9, d: 24, doors: ['s', 'e'], style: 'brick', color: '#6b3a2c', name: 'St. Casimir Church', sign: 'ST. CASIMIR', signColor: '#5b2a8a', interior: true, windows: true });
  b.box({ x: 12.9, z: -62.5, w: 5, h: 20, d: 5, color: '#6b3a2c', m: null }); // bell tower
  b.box({ x: 12.9, y: 20, z: -62.5, w: 3.4, h: 3, d: 3.4, color: '#5a3a2c', collide: false });
  b.box({ x: 12.9, y: 23, z: -62.5, w: 0.3, h: 2.2, d: 0.3, color: '#d4af37', collide: false });
  b.box({ x: 12.9, y: 24.4, z: -62.5, w: 1.2, h: 0.25, d: 0.25, color: '#d4af37', collide: false });
  for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) b.prop('bench', { x: 24.75 + sx * 3.2, z: -78.25 + r * 3.6, rot: PI }); // pews
  b.box({ x: 24.75, z: -57.3, w: 6, h: 0.25, d: 2.4, color: '#b5b0a4' }); // front steps
  b.box({ x: 24.75, z: -58.6, w: 6, h: 0.5, d: 1.2, color: '#b5b0a4' });
  b.building({ x: 40, z: -78, w: 10, d: 14, h: 9, style: 'brick', color: '#7a4a3a', floors: 3, seed: 81 });
  b.patch(40, -64, 11, 11, 'asphalt', { seed: 2, mmColor: '#3a3a40' }, 0.012);
  b.prop('car', { x: 37, z: -64, rot: 0, color: '#1e1e1e' }); b.prop('car', { x: 41, z: -64, rot: 0, color: '#d8d8d8' }); b.prop('van', { x: 45, z: -64, rot: 0, color: '#2a3a5a' });
  b.fence({ x: 46.2, z: -64, len: 11, rot: H, h: 2 });
  b.prop('deadtree', { x: 44, z: -85 }); autumnTree(12.5, -84); b.prop('sign', { x: 11.5, z: -57, rot: 0, text: 'NO PARKING', w: 0.9, h: 0.6 });

  // =====================================================================================
  // MID-WEST MIDDLE-SOUTH — the park: fieldhouse, memorial statue, Chicago flag, ball court
  // =====================================================================================
  b.patch(-28, 25, 36, 34, 'grass', { seed: 8, color: '#6f6b3c', mmColor: '#4b4a2e' }, 0.012);
  b.fence({ x: -39, z: 8, len: 14, h: 1.6 }); b.fence({ x: -17, z: 8, len: 14, h: 1.6 });
  b.fence({ x: -46, z: 14, len: 12, h: 1.6, rot: H }); b.fence({ x: -46, z: 36, len: 12, h: 1.6, rot: H });
  b.fence({ x: -10, z: 14, len: 12, h: 1.6, rot: H }); b.fence({ x: -10, z: 36, len: 12, h: 1.6, rot: H });
  b.fence({ x: -39, z: 42, len: 14, h: 1.6 }); b.fence({ x: -17, z: 42, len: 14, h: 1.6 });
  b.shell({ x: -36.75, z: 18.75, w: 14, h: 5, d: 12, doors: ['e', 's'], style: 'brick', color: '#7a4a3a', name: 'Fieldhouse', sign: 'FIELDHOUSE', signColor: '#2a7a4a' });
  b.prop('statue', { x: -22, z: 22, rot: PI, color: '#4a6b5a', h: 2.4 });
  b.prop('flag', { x: -18, z: 22, rot: 0, color: '#ffffff', stripe: '#5db6e3' });
  b.prop('flag', { x: -26, z: 22, rot: 0, color: '#ffffff', stripe: '#5db6e3' });
  b.plaza(-22, 22, 12, 8, 'tile', { seed: 4, color: '#8c8a80', mmColor: '#6a6a66' });
  b.prop('court', { x: -20, z: 34, w: 14, d: 10 });
  b.prop('hoop', { x: -26.6, z: 34, rot: H }); b.prop('hoop', { x: -13.4, z: 34, rot: -H });
  for (const [x, z, r] of [[-30, 26, -H], [-14, 18, H], [-28, 12, PI], [-14, 28, H]]) b.prop('bench', { x, z, rot: r });
  b.prop('picnic', { x: -40, z: 32, rot: 0 }); b.prop('picnic', { x: -40, z: 38, rot: 0.3 });
  autumnTree(-33, 30, 1.3); autumnTree(-42, 27, 1.1); autumnTree(-14, 12, 1.2); autumnTree(-32, 39, 1.0); b.prop('deadtree', { x: -30, z: 14 });
  b.prop('planter', { x: -22, z: 17, rot: 0, w: 3 }); b.prop('trashcan', { x: -28, z: 20 }); b.prop('trashcan', { x: -16, z: 38 });
  b.prop('sign', { x: -28.5, z: 9, rot: 0, text: 'PARK CLOSES 11PM', w: 1.2, h: 0.6 });
  b.prop('car', { x: -30, z: 44, rot: H }); b.prop('car', { x: -16, z: 43.9, rot: H, color: '#6b2a6b' });

  // =====================================================================================
  // MID-EAST MIDDLE-SOUTH — vacant lot, burned-out building, billboard, tenement
  // =====================================================================================
  b.patch(20, 25, 20, 34, 'dirt', { seed: 11, mmColor: '#4a4336' }, 0.012);
  b.fence({ x: 10.8, z: 13, len: 10, rot: H, h: 2 }); b.fence({ x: 10.8, z: 35, len: 14, rot: H, h: 2 });
  b.fence({ x: 20, z: 8.2, len: 20, h: 2 }); b.fence({ x: 16, z: 41.8, len: 12, h: 2 });
  b.prop('rubble', { x: 14, z: 30 }); b.prop('rubble', { x: 24, z: 14 }); b.prop('rubble', { x: 26, z: 36 });
  b.prop('tires', { x: 18, z: 20 }); b.prop('tires', { x: 27, z: 27 }); b.prop('mattress', { x: 15, z: 37, rot: 0.6 });
  b.prop('deadtree', { x: 12.5, z: 24 }); b.prop('deadtree', { x: 22, z: 30 }); b.prop('deadtree', { x: 28, z: 18 });
  b.prop('car', { x: 20, z: 24, rot: 0.4, wreck: true }); b.prop('trashpile', { x: 16, z: 12 }); b.prop('cart', { x: 24, z: 40, rot: 1 });
  b.prop('billboard', { x: 27, z: 40, rot: PI, text: 'WE BUY HOUSES CASH', bg: '#f2c200', fg: '#111', w: 10, h: 7 });
  b.building({ x: 39, z: 16, w: 14, d: 16, h: 10, style: 'brick', color: '#3a2a24', graffiti: 'CONDEMNED', floors: 3, lit: 0, rooftop: false, seed: 91 });
  b.prop('barricade', { x: 39, z: 6.5, rot: 0, text: 'KEEP OUT' }); b.prop('rubble', { x: 28, z: 10 });
  b.wall({ x: 28, z: 41.8, len: 8, h: 2.2, rot: 0, graffiti: 'RIP LIL D' });
  b.building({ x: 39, z: 35, w: 14, d: 14, h: 12, style: 'tenement', color: '#5c4033', fireEscape: true, sign: 'FOR RENT', signColor: '#8a5a1a', rot: H, seed: 92 });
  b.prop('dumpster', { x: 34, z: 26, rot: 0 }); b.prop('laundry', { x: 36, z: 27, rot: 0, len: 5, y: 3.2 });
  b.prop('car', { x: 48.3, z: 20, rot: 0, color: '#c9a227' });

  // =====================================================================================
  // MID-WEST SOUTH — greystone row facing the cross street, alley, garages, back strip
  // =====================================================================================
  for (const x of [-41, -28.5, -16]) {
    b.building({ x, z: 64.5, w: 10, d: 13, h: 10, style: 'concrete', color: rng.pick(GREY), rot: PI, floors: 3, lit: 0.3, seed: 400 + x, roof: 'flat' });
    stoop(x, 57.9, PI);
  }
  alleyDressing(-28, 73.5, 36, 5);
  garageRow(-44.5, 78.25, 7, 'x', -1);
  b.prop('dumpster', { x: -36, z: 72.2, rot: 0 }); b.prop('dumpster', { x: -14, z: 72.2, rot: 0 }); b.prop('trashpile', { x: -24, z: 72 });
  b.prop('pole', { x: -46, z: 74, h: 9 }); b.prop('pole', { x: -22, z: 74, h: 9 }); b.prop('laundry', { x: -30, z: 73.5, rot: 0, len: 6, y: 3.4 });
  b.prop('car', { x: -12.5, z: 74, rot: H, color: '#777' });
  woodFence(-28, 85.5, 34, 0); b.prop('deadtree', { x: -40, z: 83 }); autumnTree(-14, 83);
  b.prop('busstop', { x: -8.4, z: 60, rot: H, ad: 'BLAST' });

  // =====================================================================================
  // SOUTH-EAST — the freight viaduct (walls+platform underpass at the side street), auto body, lots
  // =====================================================================================
  const VH = 5.1;
  const tags = ['SOUTH SIDE', 'CHI', 'WESTSIDE', 'BLAST', 'GB', 'VIADUCT', 'EASTSIDE', 'CREW'];
  // embankment segments (thick walls carry graffiti on both faces)
  for (let i = 0; i < 4; i++) b.wall({ x: 16.25 + i * 8.5, z: 64, len: 8.5, h: VH, t: 8, color: '#7a6f66', graffiti: tags[i] });
  for (let i = 0; i < 3; i++) b.wall({ x: 66 + i * 8, z: 64, len: 8, h: VH, t: 8, color: '#7a6f66', graffiti: tags[4 + i] });
  // bridge deck over the side street + pillars
  b.platform({ x: 54, z: 64, w: 16.2, d: 8, y: VH - 0.38, t: 0.4, rails: true });
  for (const x of [47, 61]) b.box({ x, z: 64, w: 1.2, h: VH - 0.4, d: 1.2, color: '#6f6f6a' });
  b.light(54, 4.2, 64, '#ffd9a0', 6, 14);
  // rails + boxcars on top
  for (const z of [62.4, 63.6, 64.4, 65.6]) b.box({ x: 49, y: VH + 0.02, z, w: 74, h: 0.14, d: 0.14, color: '#5a4a3a', collide: false });
  b.prop('container', { x: 30, z: 63, rot: 0, len: 8, y: VH, color: '#8a2a2a' }); b.prop('container', { x: 39, z: 63, rot: 0, len: 8, y: VH, color: '#2f6f3f' });
  b.prop('container', { x: 72, z: 65, rot: 0, len: 8, y: VH, color: '#c87a2a' });
  b.stairs({ x: 14, z: 69, dir: 'e', height: VH, width: 2 });
  b.stairs({ x: 86, z: 69, dir: 'w', height: VH, width: 2 });
  b.landmarks.push({ x: 54, z: 64, name: 'The Viaduct' });
  // auto body shop + wrecks
  b.shell({ x: 22, z: 80.25, w: 16, h: 5, d: 12, doors: ['w'], style: 'concrete', color: '#8a8a80', sign: 'AUTO BODY', signColor: '#c0392b', graffiti: 'BLAST' });
  b.prop('car', { x: 24, z: 82, rot: 0.2, wreck: true }); b.prop('tires', { x: 17, z: 76.5 }); b.prop('barrel', { x: 28, z: 76.5 }); b.prop('pipes', { x: 22, z: 85, rot: 0, len: 5 });
  b.prop('car', { x: 11.5, z: 70, rot: 0, color: '#1c3f8c' }); b.prop('tires', { x: 32, z: 73 }); b.prop('barrel', { x: 33.2, z: 73.6 });
  // container lot
  b.patch(40, 79, 12, 16, 'asphalt', { seed: 6, mmColor: '#3a3a40' }, 0.012);
  b.prop('container', { x: 40, z: 84, rot: 0, len: 6, color: '#2a5a8a' }); b.prop('container', { x: 40, z: 84, rot: 0, len: 6, y: 2.6, color: '#6a6a6a' });
  b.prop('truck', { x: 43, z: 77, rot: PI }); b.prop('pallet', { x: 36, z: 78 }); b.prop('pallet', { x: 37.4, z: 78.2, rot: 0.3 }); b.prop('crate', { x: 36, z: 80, size: 1.2 });
  b.fence({ x: 46.2, z: 79, len: 16, rot: H, h: 2.2 }); b.fence({ x: 40, z: 71.2, len: 12, h: 2.2 });
  // E-S: team 1 back lot behind the viaduct
  b.box({ x: 68, z: 84, w: 5, h: 2.8, d: 4.5, color: '#7a6a5a' }); b.box({ x: 81.5, z: 78, w: 5, h: 2.8, d: 5, color: '#6f655a' });
  b.prop('dumpster', { x: 64, z: 72, rot: 0 }); b.prop('trashpile', { x: 74, z: 84 }); b.prop('van', { x: 70, z: 76, rot: H, color: '#8a2a2a' });
  woodFence(72, 80.5, 10, 0); b.prop('deadtree', { x: 85, z: 84 }); b.prop('pole', { x: 62.5, z: 58.5, h: 9 });

  // =====================================================================================
  // Street dressing on the cross streets and side streets
  // =====================================================================================
  parkedCars([[-30, -44.4, H], [36, -55.6, -H, 'van'], [70, -44.4, H],
    [28, 44.2, H], [-20, 55.7, -H], [68, 44.4, H], [-72, 55.6, -H],
    [-48.4, 30, 0.02], [59.6, 78, PI], [-20, 5.6, PI], [22, -5.6, 0]]);
  b.prop('bus', { x: 30, z: 52.6, rot: -H, color: '#dcdcdc' });
  for (const x of [-72, -30]) b.prop('lamp', { x, z: -57.4, rot: 0, light: x === -30 });
  for (const x of [36, 78]) b.prop('lamp', { x, z: 57.4, rot: PI, light: x === 36 });
  for (const z of [-70, 19]) b.prop('lamp', { x: -61.4, z, rot: H });
  for (const z of [-30, 75]) b.prop('lamp', { x: 61.4, z, rot: -H });
  for (const x of [-30, 30]) { b.prop('lamp', { x, z: -7, rot: 0, light: x === 30 }); b.prop('lamp', { x: x + 4, z: 7, rot: PI, light: x === -30 }); }
  for (const [x, z] of [[-40, -42.6], [40, 42.6], [-61.9, 30], [61.9, -30], [-12, 7.6], [12, -7.6]]) b.prop('hydrant', { x, z });
  b.prop('busstop', { x: -42, z: -57.5, rot: PI, ad: 'EL' }); b.prop('busstop', { x: 70, z: 57.5, rot: 0, ad: 'BLAST' });
  for (const [x, z] of [[-47.4, -59], [47.4, 59], [-47.4, 41], [47.4, -41]]) b.prop('pole', { x, z, h: 9 });
  b.prop('sign', { x: -46.6, z: -55.8, rot: PI, text: 'ONE WAY', w: 1.0, h: 0.5 }); b.prop('sign', { x: 46.6, z: 55.8, rot: 0, text: 'ONE WAY', w: 1.0, h: 0.5 });

  // =====================================================================================
  // Spawns: team 0 in the west back yards, team 1 in the east back yards, neutrals around the middle
  // =====================================================================================
  for (const [x, z] of [[-82, -79], [-80, -66], [-77, -36], [-77, -25], [-77, -14], [-78, 24], [-80, 36], [-78, 64], [-78, 78], [-84, -34]]) b.spawn(0, x, z, H);
  for (const [x, z] of [[80, -80], [78, -66], [77, -36], [77, -25], [77, -14], [77, 15], [77, 26], [77, 37], [76, 73], [64, 77]]) b.spawn(1, x, z, -H);
  for (const [x, z] of [[-28, -67], [26, -24], [-32, -26], [-22, 30], [20, 30], [-28, 73.5], [40, 79], [-66, -45], [66, 52], [3, 46], [-3, -46]]) b.spawn(null, x, z, 0);

  // =====================================================================================
  // Cinematic shots
  // =====================================================================================
  b.cinematic(-26, 16, 42, 0, 0);          // over the park toward the station
  b.cinematic(-40, 18, -50, -28, -70);     // courtyard flats from the cross street
  b.cinematic(70, 20, 84, 54, 64);         // the viaduct and underpass
  b.cinematic(-24, 13, -44, -16, -36);     // the tavern under the L
  return b.finish();
}
