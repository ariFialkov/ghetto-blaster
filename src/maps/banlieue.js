// BANLIEUE — Paris (Seine-Saint-Denis, La Courneuve style cité). HLM towers and slab "barres" around a raised concrete
// dalle, a tram boulevard, RER station, kebab/tabac/Franprix strip, a mosque, a graffiti underpass through the south
// barre, a concrete playground and a cream Haussmann row along the north edge for contrast. Grey overcast light.
import { MapBuilder } from './builder.js';

export const def = {
  id: 'banlieue', name: 'Banlieue', city: 'Paris', size: 190, seed: 93,
  teams: { tdm: 6, ffa: 10 },
  blurb: 'Seine-Saint-Denis. Concrete towers, a tram boulevard and a dalle under a grey Paris sky.',
  env: { skyTop: '#6f7a8a', skyHorizon: '#b9bcc2', skyBottom: '#2a2a2f', fogColor: '#aab0b8', fogNear: 50, fogFar: 220, hemiSky: '#c8d0dc', hemiGround: '#4a4a4a', hemiIntensity: 1.0, sunColor: '#e8ecf2', sunIntensity: 1.3, sunDir: [0.3, 0.8, -0.5], ambient: '#404048', ambientIntensity: 0.35, shadowSize: 105 },
  lightBudget: 14,
};

export function build() {
  const b = new MapBuilder(def);
  b.ground('asphalt', { seed: 93 });

  // ---------- helpers ----------
  const PI = Math.PI, H = PI / 2;
  const CONC = '#8d8d86';
  // stairs whose top landing overlaps a platform/roof edge by ~0.4 m (steps run from `edge` away in `dir`'s opposite)
  const stairsTo = (edge, fixed, dir, height, width) => {
    const steps = Math.ceil(height / 0.34), L = steps * 0.62 + 0.6;
    if (dir === 'n') b.stairs({ x: fixed, z: edge + L - 0.4, dir, height, width });
    else if (dir === 's') b.stairs({ x: fixed, z: edge - L + 0.4, dir, height, width });
    else if (dir === 'w') b.stairs({ x: edge + L - 0.4, z: fixed, dir, height, width });
    else b.stairs({ x: edge - L + 0.4, z: fixed, dir, height, width });
  };
  // guard rail on an elevated slab (walkable:false so bots don't path onto it)
  const rail = (x, z, len, rot, y) => b.box({ x, y, z, w: len, h: 1.0, d: 0.12, color: '#3a3a3a', rot, walkable: false, castShadow: false });
  // thin coloured cladding panels on a tower face: face 'n'|'s'|'e'|'w'
  const panels = (bx, bz, w, d, h, face, colors, n = 3) => {
    const off = 0.09;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5, c = colors[i % colors.length];
      if (face === 's' || face === 'n') b.box({ x: bx + t * w * 0.8, y: 1.2, z: bz + (face === 's' ? d / 2 + off : -d / 2 - off), w: 1.6, h: h - 2.4, d: 0.12, color: c, collide: false, castShadow: false });
      else b.box({ x: bx + (face === 'e' ? w / 2 + off : -w / 2 - off), y: 1.2, z: bz + t * d * 0.8, w: 0.12, h: h - 2.4, d: 1.6, color: c, collide: false, castShadow: false });
    }
    // top band
    if (face === 's' || face === 'n') b.box({ x: bx, y: h - 1.6, z: bz + (face === 's' ? d / 2 + off : -d / 2 - off), w: w * 0.96, h: 1.0, d: 0.12, color: colors[0], collide: false, castShadow: false });
    else b.box({ x: bx + (face === 'e' ? w / 2 + off : -w / 2 - off), y: h - 1.6, z: bz, w: 0.12, h: 1.0, d: d * 0.96, color: colors[0], collide: false, castShadow: false });
  };
  const hatch = ['#e8e8e8', '#8a8a8a', '#2a4a8a', '#d8d8d8', '#5a5a5a', '#f0f0f0', '#3a5aa0'];

  // ---------- Streets ----------
  // Boulevard (tram) E-W at z=12; N-S avenues at x=±52; E-W streets at z=±62; a short diagonal "rue" in the SE.
  b.road(-92, 12, 92, 12, 14, { sidewalk: true, marks: false });
  for (const x of [-52, 52]) b.road(x, -92, x, 92, 11, { sidewalk: true });
  for (const z of [-62, 62]) b.road(-92, z, 92, z, 10, { sidewalk: true });
  b.road(50, 62, 80, 90, 9, { sidewalk: true, marks: false });
  // tram rails + overhead-line poles
  for (const z of [11.3, 12.7]) b.box({ x: 0, y: 0.03, z, w: 184, h: 0.05, d: 0.12, color: '#b8b8b8', collide: false, castShadow: false });
  for (const x of [-80, -56, -32, 32, 56, 80]) b.prop('pole', { x, z: 12, h: 7, wires: true });
  // articulated tram (two cars) heading west + an RATP bus on the east
  b.prop('bus', { x: -28, z: 12, rot: H, color: '#e8e8e8' }); b.prop('bus', { x: -39.6, z: 12, rot: H, color: '#e8e8e8' });
  b.prop('bus', { x: 70, z: 7.5, rot: H, color: '#dfe6ea' });
  b.prop('busstop', { x: -20, z: 3.6, rot: PI, ad: 'T1' }); b.prop('busstop', { x: 24, z: 20.4, rot: 0, ad: 'RATP' });
  // Paris-style bollards on the north pavement, plane trees on the south pavement, lamps
  for (let x = -88; x <= 88; x += 12) if (Math.abs(x) > 14 && Math.abs(x - 52) > 8 && Math.abs(x + 52) > 8) b.prop('bollard', { x, z: 3.3 });
  for (let x = -86; x <= 86; x += 16) if (Math.abs(x - 52) > 8 && Math.abs(x + 52) > 8 && Math.abs(x - 24) > 4) b.prop('tree', { x, z: 20.2, color: '#5a7a3a' });
  for (const x of [-76, -36, 36, 76]) { b.prop('lamp', { x, z: 2.9, rot: 0, light: x === -36 }); b.prop('lamp', { x, z: 21.1, rot: PI, light: x === 36 }); }
  for (const [x, z] of [[-52, 12], [52, 12]]) { b.prop('trafficlight', { x: x + 7.5, z: z - 9, rot: PI }); b.prop('trafficlight', { x: x - 7.5, z: z + 9, rot: 0 }); }
  for (const [x, z] of [[-52, -62], [52, -62], [-52, 62], [52, 62]]) b.prop('lamp', { x: x + 7.6, z: z + 7.2, rot: PI });
  // parked hatchbacks along the avenues
  const parkRow = (x, zs, rot) => zs.forEach((z, i) => b.prop('car', { x, z, rot, color: hatch[i % hatch.length] }));
  parkRow(-46.3, [-44, 34, 80], 0); parkRow(46.3, [-46, 30, 84], PI);
  parkRow(-57.7, [-16, 78], 0); parkRow(57.7, [38], PI);

  // ---------- Esplanade (ground, in front of the dalle) ----------
  b.plaza(0, -5, 84, 15, 'tile', { color: '#9a9690', line: '#5a554c', mmColor: '#6a6a66' });
  b.prop('fountain', { x: 0, z: -5, r: 3.6, name: 'La Dalle' });
  for (const [x, z, r] of [[-7, -5, H], [7, -5, -H], [-20, -3, 0], [20, -3, 0], [-32, -8, PI], [32, -8, PI]]) b.prop('bench', { x, z, rot: r });
  for (const x of [-26, -14, 14, 26]) b.prop('planter', { x, z: -1.5, w: 3 });
  b.prop('newsstand', { x: -38, z: -2, rot: 0, text: 'PRESSE' }); b.prop('phonebooth', { x: 36, z: -1, color: '#4a4a4a' });
  b.prop('trashcan', { x: -10, z: -1 }); b.prop('trashcan', { x: 10, z: -1 }); b.prop('trashpile', { x: 40, z: -10 });
  b.prop('car', { x: -40, z: -8, rot: H, color: '#2a4a8a' });

  // ---------- La Dalle: raised concrete plaza between the towers ----------
  // platform x -24..24, z -49..-19 at y=3 (top 3.4); five stairs down to the street
  b.platform({ x: 0, z: -34, w: 48, d: 30, y: 3, rails: false });
  const Y = 3.4;
  stairsTo(-19, -9, 'n', Y, 6); stairsTo(-19, 9, 'n', Y, 6);     // grand stairs south to the esplanade
  stairsTo(-49, 0, 's', Y, 5);                                    // north stairs to rue
  stairsTo(-24, -22, 'e', Y, 4); stairsTo(24, -22, 'w', Y, 4);    // side stairs into the alleys
  // rails with gaps at the stairs
  rail(-18, -19.06, 12, 0, Y); rail(0, -19.06, 12, 0, Y); rail(18, -19.06, 12, 0, Y);
  rail(-13.25, -48.94, 21.5, 0, Y); rail(13.25, -48.94, 21.5, 0, Y);
  rail(-23.94, -36.5, 25, H, Y); rail(-23.94, -19.5, 1, H, Y); rail(23.94, -36.5, 25, H, Y); rail(23.94, -19.5, 1, H, Y);
  // dalle furniture (hand-built at y=3.4): concrete planters with hedges, benches, a kiosk and a ventilation block
  const dPlanter = (x, z, w, d) => { b.box({ x, y: Y, z, w, h: 0.6, d, m: null, color: '#7f7d76' }); b.box({ x, y: Y + 0.6, z, w: w - 0.5, h: 0.5, d: d - 0.5, color: '#3f6b2e', collide: false }); };
  for (const [x, z] of [[-14, -26], [14, -26], [-14, -42], [14, -42]]) dPlanter(x, z, 5, 1.6);
  for (const [x, z] of [[-20, -34], [20, -34]]) dPlanter(x, z, 1.6, 6);
  const dBench = (x, z, rot) => b.box({ x, y: Y, z, w: 1.8, h: 0.45, d: 0.5, color: '#5a3f2a', rot });
  for (const [x, z, r] of [[-14, -24], [14, -24], [-14, -44, 0], [14, -44, 0], [-6, -34, H], [6, -34, H]]) dBench(x, z, r || 0);
  // kiosk "Local Jeunes": three walls + roof, open to the east
  b.box({ x: -4, y: Y, z: -40, w: 0.3, h: 2.6, d: 6, color: '#6f7274' }); b.box({ x: -1, y: Y, z: -43, w: 6, h: 2.6, d: 0.3, color: '#6f7274' }); b.box({ x: -1, y: Y, z: -37, w: 6, h: 2.6, d: 0.3, color: '#6f7274' });
  b.box({ x: -1, y: Y + 2.6, z: -40, w: 6.4, h: 0.25, d: 6.4, color: '#55544f', collide: false });
  b.box({ x: -2.8, y: Y, z: -40, w: 1.6, h: 1.0, d: 0.7, color: '#4a3a2a' });
  // ventilation block of the parking below + lamp posts
  b.box({ x: 8, y: Y, z: -36, w: 3, h: 2.2, d: 2, color: '#6a6a64', walkable: false });
  for (const [x, z] of [[-10, -30], [10, -30], [-10, -46], [10, -46]]) { b.box({ x, y: Y, z, w: 0.2, h: 6, d: 0.2, color: '#3a3a3a', walkable: false }); b.box({ x, y: Y + 6, z, w: 0.5, h: 0.2, d: 0.8, color: '#fff', collide: false }); }
  b.light(0, Y + 5, -34, '#dfe8ff', 6, 22);
  // the dalle's ground-level "cave": underpass walls under the slab edge for cover in the alleys
  for (const x of [-20, 0, 20]) b.wall({ x, z: -49.6, len: 10, h: 2.0, color: '#6a6a66', graffiti: x === 0 ? '93' : null });

  // ---------- HLM towers flanking the dalle ----------
  b.building({ x: -37, z: -34, w: 14, h: 38, d: 14, style: 'concrete', color: '#8a8c88', lit: 0.35, floors: 12, name: 'Tour Balzac', graffiti: 'BANLIEUE' });
  panels(-37, -34, 14, 14, 38, 'e', ['#c0392b', '#e0a020', '#2a6fb8']); panels(-37, -34, 14, 14, 38, 's', ['#c0392b', '#2a6fb8', '#e0a020']); panels(-37, -34, 14, 14, 38, 'w', ['#e0a020', '#c0392b']);
  b.building({ x: 37, z: -34, w: 14, h: 36, d: 14, style: 'concrete', color: '#9a9a94', lit: 0.35, floors: 11, name: 'Tour Ravel', balcony: true });
  panels(37, -34, 14, 14, 36, 'w', ['#2a6fb8', '#8fb4d9', '#1f4f8f']); panels(37, -34, 14, 14, 36, 'n', ['#1f4f8f', '#8fb4d9']); panels(37, -34, 14, 14, 36, 'e', ['#2a6fb8', '#1f4f8f', '#8fb4d9']);
  // Tour Ravel under renovation: scaffold on the south face, skip and debris
  b.prop('scaffold', { x: 37, z: -26.2, len: 12, h: 12, rot: 0 });
  b.prop('dumpster', { x: 31, z: -23, rot: 0.2, color: '#c87a2a' }); b.prop('rubble', { x: 40, z: -22 }); b.prop('pallet', { x: 44, z: -24, rot: 0.4 });
  // tower bases: entrance canopies, bikes racks, trash, mailboxes
  for (const x of [-37, 37]) { b.box({ x, y: 2.6, z: -26.6, w: 5, h: 0.2, d: 1.2, color: '#55544f', collide: false }); b.prop('trashcan', { x: x + 4, z: -25.5 }); }
  b.prop('laundry', { x: -29.9, z: -36, rot: H, y: 7, len: 6 }); b.prop('laundry', { x: 29.9, z: -30, rot: H, y: 10, len: 6 });
  for (let i = 0; i < 4; i++) { b.prop('ac', { x: -29.9, z: -40 + i * 3.5, rot: H, y: 4 + i * 3 }); b.prop('dish', { x: 44.1, z: -38 + i * 3, rot: -H, y: 9 + i * 4 }); }
  // green strips around the towers (espaces verts) with trees and benches
  b.patch(-37, -48, 14, 8, 'grass', { seed: 3, color: '#4a5e32', mmColor: '#3d5a2e' }); b.patch(37, -48, 14, 8, 'grass', { seed: 4, color: '#4a5e32', mmColor: '#3d5a2e' });
  for (const [x, z] of [[-41, -50], [-33, -50], [41, -50], [33, -50], [-40, -16], [40, -16]]) b.prop('tree', { x, z, color: '#4f6b3a' });
  b.prop('bench', { x: -37, z: -47, rot: PI }); b.prop('bench', { x: 37, z: -47, rot: PI });
  for (const [x, z] of [[-30, -10], [30, -10]]) b.prop('planter', { x, z, w: 3 });
  b.prop('car', { x: -41, z: -22, rot: 0.1, color: '#8a8a8a' }); b.prop('car', { x: -34, z: -18, rot: H, color: '#e8e8e8' });

  // ---------- West & east barres (long slabs) ----------
  b.building({ x: -68, z: -26, w: 12, h: 30, d: 52, style: 'concrete', color: '#8e9090', lit: 0.35, floors: 10, balcony: true, graffiti: 'LA HAINE' });
  panels(-68, -26, 12, 52, 30, 'e', ['#d35400', '#e8c060', '#8e44ad', '#d35400', '#e8c060'], 5); panels(-68, -26, 12, 52, 30, 'w', ['#8e44ad', '#d35400', '#e8c060', '#8e44ad', '#d35400'], 5);
  b.building({ x: 68, z: -26, w: 12, h: 32, d: 52, style: 'concrete', color: '#93918c', lit: 0.35, floors: 10, graffiti: 'PSG' });
  panels(68, -26, 12, 52, 32, 'w', ['#2e7d5b', '#27ae60', '#f1c40f', '#2e7d5b', '#27ae60'], 5); panels(68, -26, 12, 52, 32, 'e', ['#f1c40f', '#2e7d5b', '#27ae60', '#f1c40f', '#2e7d5b'], 5);
  for (let i = 0; i < 3; i++) { b.prop('laundry', { x: -61.9, z: -44 + i * 16, rot: H, y: 6 + i * 3, len: 4 }); b.prop('ac', { x: 61.9, z: -44 + i * 14, rot: -H, y: 3 + i * 3.2 }); }
  for (const x of [-68, 68]) for (const z of [-44, -26, -8]) b.box({ x: x + (x < 0 ? 6.4 : -6.4), y: 2.6, z, w: 1.4, h: 0.2, d: 4, color: '#55544f', collide: false });

  // courtyards behind the barres: parking, bins, fences (team spawn zones)
  for (const s of [-1, 1]) {
    const X = s * 83;
    b.patch(X, -26, 16, 52, 'asphalt', { seed: 5, color: '#33333a', mmColor: '#3a3a40' }, 0.02);
    for (let i = 0; i < 3; i++) b.prop('car', { x: s * 76.5, z: -46 + i * 12, rot: s > 0 ? -H : H, color: hatch[(i + 2) % hatch.length] });
    b.prop('van', { x: s * 76.5, z: 0, rot: s > 0 ? -H : H, text: s > 0 ? 'DEMENAGEMENT' : 'BTP' });
    b.prop('dumpster', { x: s * 89, z: -50, rot: 0, color: '#2f5f3f' }); b.prop('dumpster', { x: s * 89, z: -47.5, rot: 0, color: '#3a4a7a' });
    b.prop('tires', { x: s * 89, z: -3 }); b.prop('trashpile', { x: s * 88, z: -30 });
    b.fence({ x: s * 80, z: -53.5, len: 22, h: 2.2 }); b.fence({ x: s * 80, z: 1.5, len: 22, h: 2.2 });
    b.prop('lamp', { x: s * 88, z: -20, rot: s > 0 ? -H : H });
    b.prop('planter', { x: s * 86, z: -40, w: 2.4 }); b.prop('bench', { x: s * 86, z: -12, rot: s > 0 ? H : -H });
  }
  // burnt-out car + police tape on the east boulevard corner (west side mirrors with a tow scene)
  b.prop('car', { x: 62, z: 3.2, rot: 0.3, wreck: true }); b.prop('barricade', { x: 58, z: 6, rot: 0.2, text: 'POLICE' }); b.prop('barricade', { x: 66, z: 6.5, rot: -0.2, text: 'POLICE' });
  b.prop('van', { x: 72, z: 19, rot: H, color: '#1a3f8c', text: 'POLICE', textColor: '#fff' }); for (let i = 0; i < 3; i++) b.prop('cone', { x: 60 + i * 2.5, z: 9.5 });
  b.prop('car', { x: -64, z: 20.5, rot: H + 0.1, wreck: true }); b.prop('barricade', { x: -70, z: 18, rot: 0.3, text: 'POLICE' }); b.prop('cone', { x: -66, z: 17 }); b.prop('cone', { x: -60, z: 17.5 });

  // ---------- South-centre block: commerces, mosque, playground ----------
  // kebab (enterable, stairs to roof) + tabac + PMU bar
  b.shell({ x: -36, z: 28.5, w: 10, h: 4, d: 10, doors: ['n', 'e'], style: 'plaster', color: '#c9a86a', name: 'Kebab', graffiti: 'BANLIEUE' });
  b.prop('neonSign', { x: -36, z: 23.2, rot: 0, text: 'KEBAB', color: '#ff3030', y: 3.3, w: 5, light: true });
  stairsTo(33.5, -39, 'n', 4.3, 2);
  b.building({ x: -24, z: 28.5, w: 10, h: 7, d: 10, style: 'plaster', color: '#b8c4b0', sign: 'TABAC', signColor: '#c0392b', awning: '#c0392b', floors: 2, lit: 0.3 });
  b.building({ x: -13, z: 28.5, w: 9, h: 7, d: 10, style: 'brick', color: '#7a4a3a', sign: 'PMU', signColor: '#2e7d5b', awning: '#2e7d5b', floors: 2 });
  for (const [x, z] of [[-38, 22.2], [-33, 22.2], [-21, 22.2]]) b.prop('trashcan', { x, z });
  b.prop('bench', { x: -27, z: 22.3, rot: PI }); b.prop('bench', { x: -16, z: 22.3, rot: PI });
  // Franprix supermarket (enterable, roof via south stairs) and its delivery yard
  b.shell({ x: 30, z: 30, w: 22, h: 5, d: 12, doors: ['n', 'w'], style: 'concrete', color: '#b8b4aa', sign: 'FRANPRIX', signColor: '#f26522' });
  stairsTo(36, 30, 'n', 5.3, 2.4);
  for (let i = 0; i < 4; i++) b.prop('pallet', { x: 23 + i * 1.6, z: 39, rot: 0.2 * i });
  b.prop('truck', { x: 41, z: 44, rot: 0, color: '#c8c8c8' }); b.prop('dumpster', { x: 34, z: 40, rot: 0, color: '#2f5f3f' }); b.prop('dumpster', { x: 31, z: 40, rot: 0, color: '#444' });
  b.prop('car', { x: 36, z: 50, rot: 0.5, wreck: true }); b.prop('tires', { x: 42, z: 52 });
  b.prop('neonSign', { x: 19, z: 30, rot: -H, text: 'OUVERT', color: '#39ff6a', y: 3.4, w: 3, light: false });
  // Mosquée: plaster hall with a stacked-box dome and a slim minaret
  b.building({ x: -26, z: 48, w: 16, h: 7, d: 13, style: 'plaster', color: '#d8d0c0', roof: 'flat', rooftop: false, name: 'Mosquée', lit: 0.1, sign: 'MOSQUEE', signColor: '#2e7d5b' });
  const dome = [[9, 0.9], [7.6, 0.8], [6, 0.8], [4.2, 0.8], [2.4, 0.7], [1.0, 0.7]]; let dy = 7;
  for (const [s, h] of dome) { b.box({ x: -26, y: dy, z: 48, w: s, h, d: s, color: '#2e7d5b', collide: false }); dy += h; }
  b.box({ x: -26, y: dy, z: 48, w: 0.16, h: 1.6, d: 0.16, color: '#d4af37', collide: false });
  b.box({ x: -19, z: 43, w: 1.8, h: 15, d: 1.8, color: '#d8d0c0', walkable: false }); b.box({ x: -19, y: 15, z: 43, w: 2.4, h: 0.5, d: 2.4, color: '#2e7d5b', collide: false }); b.box({ x: -19, y: 15.5, z: 43, w: 1.2, h: 1.6, d: 1.2, color: '#2e7d5b', collide: false });
  for (const x of [-32, -22]) b.prop('planter', { x, z: 40.4, w: 3 });
  b.prop('bench', { x: -27, z: 40.5, rot: PI });
  // concrete playground: court with hoops, fenced, street workout bars
  b.prop('court', { x: 8, z: 46, w: 24, d: 14, color: '#6a7a6a' });
  b.prop('hoop', { x: -3, z: 46, rot: H }); b.prop('hoop', { x: 19, z: 46, rot: -H });
  b.fence({ x: 8, z: 38.8, len: 24, h: 3 }); b.fence({ x: 8, z: 53.2, len: 24, h: 3 }); b.fence({ x: -4.2, z: 49.5, len: 7, h: 3, rot: H }); b.fence({ x: 20.2, z: 49.5, len: 7, h: 3, rot: H });
  for (const [x, z] of [[-8, 38], [-8, 54], [16, 36]]) b.prop('bench', { x, z, rot: z > 40 ? 0 : PI });
  b.prop('planter', { x: 4, z: 36.5, w: 4 }); b.prop('planter', { x: 12, z: 36.5, w: 4 });
  for (const x of [-10, -6]) b.box({ x, z: 48, w: 0.1, h: 2.2, d: 0.1, color: '#444', walkable: false });
  b.box({ x: -8, y: 2.2, z: 48, w: 4.2, h: 0.08, d: 0.08, color: '#444', collide: false });
  b.prop('car', { x: -4, z: 28, rot: 0, color: '#d8d8d8' }); b.prop('car', { x: 8, z: 28, rot: 0.05, color: '#2a4a8a' });
  b.prop('trashcan', { x: 22, z: 48 }); b.prop('trashpile', { x: 26, z: 52 });

  // ---------- South barre with the graffiti underpass ----------
  b.building({ x: -17, z: 80, w: 30, h: 26, d: 12, style: 'concrete', color: '#8a8a84', lit: 0.35, floors: 8, balcony: true, graffiti: 'PSG' });
  b.building({ x: 17, z: 80, w: 30, h: 26, d: 12, style: 'concrete', color: '#8a8a84', lit: 0.35, floors: 8, balcony: true, graffiti: '93' });
  panels(-17, 80, 30, 12, 26, 'n', ['#c0392b', '#e8e8e8', '#1f4f8f', '#e8e8e8', '#c0392b'], 5); panels(17, 80, 30, 12, 26, 'n', ['#1f4f8f', '#e8e8e8', '#c0392b', '#e8e8e8', '#1f4f8f'], 5);
  panels(-17, 80, 30, 12, 26, 's', ['#e8e8e8', '#c0392b', '#1f4f8f'], 4); panels(17, 80, 30, 12, 26, 's', ['#e8e8e8', '#1f4f8f', '#c0392b'], 4);
  b.wall({ x: -1.8, z: 80, len: 12, h: 4, rot: H, color: '#6a6a66', graffiti: '93' }); b.wall({ x: 1.8, z: 80, len: 12, h: 4, rot: H, color: '#6a6a66', graffiti: 'LA HAINE' });
  b.box({ x: 0, y: 4, z: 80, w: 4.4, h: 0.4, d: 12.4, m: null, color: '#6f6f6a', walkable: false }); // underpass ceiling (walkable:false so the passage below stays navigable)
  b.box({ x: 0, y: 4.4, z: 80, w: 4.4, h: 21.6, d: 12, color: '#8a8a84', collide: false, castShadow: false }); // slab continues above the passage
  b.light(0, 3.5, 80, '#ffe9a0', 5, 9);
  b.wall({ x: -36, z: 74.5, len: 10, h: 2.2, rot: H, color: '#6a6a66', graffiti: 'BANLIEUE' }); b.wall({ x: 36, z: 74.5, len: 10, h: 2.2, rot: H, color: '#6a6a66', graffiti: 'PSG' });
  for (const [x, z] of [[-34, 86], [34, 86]]) b.prop('dumpster', { x, z, rot: 0.3 });
  for (const [x, z] of [[-38, 70.5], [38, 70.5]]) b.prop('tree', { x, z, color: '#5a7a3a' });
  b.prop('van', { x: -28, z: 70, rot: H, text: 'PLOMBERIE' }); b.prop('car', { x: 20, z: 70, rot: H, color: '#e8e8e8' }); b.prop('car', { x: 8, z: 70, rot: H + 0.05, color: '#8a8a8a' });
  for (const x of [-14, 14]) b.prop('laundry', { x, z: 73.9, rot: 0, y: 6 + (x > 0 ? 2.5 : 0), len: 5 });
  b.prop('car', { x: -14, z: 89, rot: H, color: '#2a4a8a' }); b.prop('trashpile', { x: 0, z: 89.5 });

  // ---------- West-south block: Tour Hugo (tenement balconies) ----------
  b.building({ x: -72, z: 38, w: 14, h: 30, d: 16, style: 'tenement', color: '#8f8f88', lit: 0.35, floors: 10, graffiti: 'BANLIEUE' });
  panels(-72, 38, 14, 16, 30, 'e', ['#e0a020', '#c0392b', '#e0a020']); panels(-72, 38, 14, 16, 30, 'n', ['#c0392b', '#e0a020']);
  b.patch(-74, 26, 28, 7, 'grass', { seed: 8, color: '#4a5e32', mmColor: '#3d5a2e' });
  for (const x of [-84, -78, -66]) b.prop('tree', { x, z: 25.5 }); b.prop('bench', { x: -72, z: 27.5, rot: 0 });
  b.prop('car', { x: -62.5, z: 36, rot: 0, color: '#e8e8e8' }); b.prop('car', { x: -62.5, z: 42, rot: 0, color: '#5a5a5a' });
  b.prop('dumpster', { x: -86, z: 52, rot: 0 }); b.prop('dumpster', { x: -83, z: 52, rot: 0 }); b.prop('tires', { x: -62, z: 51 });
  b.fence({ x: -74, z: 48, len: 18, h: 2.2 });
  b.prop('lamp', { x: -86, z: 36, rot: H, light: true });

  // ---------- East-south block: RER station + Tour Vivaldi ----------
  b.shell({ x: 72, z: 30, w: 20, h: 5, d: 12, doors: ['w', 'n'], style: 'concrete', color: '#9aa0a8', name: 'Gare RER', sign: 'RER B', signColor: '#1f4f8f' });
  b.prop('sign', { x: 64, z: 22.8, rot: 0, text: 'SNCF', bg: '#1a3f8c', fg: '#fff', w: 2.4, h: 0.9 });
  b.prop('neonSign', { x: 61.6, z: 30, rot: -H, text: 'RER', color: '#2a6fd8', y: 4.2, w: 2.8, light: true });
  for (let i = 0; i < 4; i++) b.box({ x: 66 + i * 1.3, z: 30, w: 0.3, h: 1.1, d: 1.4, color: '#4a4f58' }); // turnstiles
  b.patch(76, 32, 8, 5, 'concrete', { color: '#2a2a2e', mmColor: '#2a2a30' }, 0.03); // stairwell down (visual)
  b.box({ x: 76, y: 0, z: 29.6, w: 8, h: 1.0, d: 0.3, color: '#4a4f58' });
  for (const [x, z] of [[64, 23.2], [78, 23.2]]) b.prop('bollard', { x, z });
  b.prop('newsstand', { x: 86, z: 25, rot: -H, text: 'RELAY' }); b.prop('trashcan', { x: 60.8, z: 24 });
  b.building({ x: 76, z: 47, w: 20, h: 32, d: 12, style: 'tenement', color: '#8f8f88', lit: 0.35, floors: 10, });
  panels(76, 47, 20, 12, 32, 'n', ['#2a6fb8', '#e8e8e8', '#2a6fb8', '#e8e8e8'], 4); panels(76, 47, 20, 12, 32, 's', ['#e8e8e8', '#2a6fb8', '#e8e8e8'], 3);
  b.prop('car', { x: 62.5, z: 44, rot: 0, color: '#d8d8d8' }); b.prop('car', { x: 62.5, z: 50, rot: 0, color: '#2a4a8a' });
  b.prop('bench', { x: 89, z: 40, rot: -H }); b.prop('planter', { x: 89, z: 48, w: 1.2, d: 3 });

  // ---------- SE corner: diagonal rue, billboard, lot ----------
  b.prop('billboard', { x: 84, z: 72, rot: -0.6, text: 'GRAND PARIS', bg: '#1f4f8f', fg: '#ffffff', w: 12, h: 9 });
  b.fence({ x: 85, z: 70, len: 12, h: 2.2, rot: 0.75 });
  b.prop('rubble', { x: 88, z: 80 }); b.prop('barrel', { x: 88, z: 86 }); b.prop('barrel', { x: 89, z: 87.3 }); b.prop('crate', { x: 86, z: 89, size: 1.2 });
  b.prop('tent', { x: 60, z: 88, rot: 0.3 }); b.prop('tarp', { x: 66, z: 89, rot: 0.1 }); b.prop('tent', { x: 74, z: 70, rot: 1.2 });
  b.prop('container', { x: 38, z: 89, rot: 0, color: '#2a5a8a' });

  // ---------- SW corner: lock-up garages ("les boxes") ----------
  for (let i = 0; i < 7; i++) {
    const x = -87 + i * 4; const door = ['#c0392b', '#2a6fb8', '#e0a020', '#6b6f73', '#2e7d5b', '#8e44ad', '#5a5a5a'][i];
    b.box({ x, z: 77, w: 3.8, h: 2.8, d: 6, color: '#8a8a84' });
    b.box({ x, y: 0.05, z: 73.9, w: 3.0, h: 2.3, d: 0.1, color: door, collide: false });
  }
  b.box({ x: -75, y: 2.8, z: 77, w: 29, h: 0.2, d: 6.6, color: '#55544f', collide: false });
  b.wall({ x: -74, z: 80.2, len: 28, h: 2.8, color: '#8a8a84', graffiti: '93' });
  b.prop('car', { x: -84, z: 70.5, rot: 0.1, color: '#e8e8e8' }); b.prop('car', { x: -72, z: 70.5, rot: -0.1, color: '#8a8a8a' }); b.prop('car', { x: -66, z: 86, rot: H, wreck: true });
  b.prop('tires', { x: -62, z: 72 }); b.prop('barrel', { x: -89, z: 84 }); b.prop('trashpile', { x: -84, z: 86 }); b.prop('pipes', { x: -74, z: 88, len: 6 });
  b.prop('lamp', { x: -62, z: 78, rot: -H });

  // ---------- North edge: Haussmann row (cream, zinc roofs, shops) ----------
  const shops = [['BOULANGERIE', '#8a5a1a', '#c9a227'], [null, null, null], ['PHARMACIE', '#2e7d5b', '#2e7d5b'], ['CAFE DE LA GARE', '#8a1a1a', '#8a1a1a'], [null, null, null], ['OPTIQUE', '#1f4f8f', '#1f4f8f'], ['BRASSERIE', '#8a1a1a', '#2e7d5b']];
  [-72, -48, -24, 0, 24, 48, 72].forEach((x, i) => {
    const [sign, sc, aw] = shops[i];
    b.building({ x, z: -81, w: 20, h: 19, d: 16, style: 'plaster', color: '#e8dcc0', floors: 6, balcony: true, roof: 'flat', rooftop: false, lit: 0.3, sign, signColor: sc || '#b3121b', awning: aw, winColor: '#2a2a30' });
    b.box({ x, y: 19, z: -81, w: 20, h: 2.4, d: 13, color: '#5a6068' }); // zinc mansard
    b.box({ x, y: 21.4, z: -81, w: 20, h: 0.4, d: 10, color: '#4a5058', collide: false });
    for (const cx of [-6, 6]) b.box({ x: x + cx, y: 21.8, z: -81, w: 1.0, h: 1.6, d: 1.0, color: '#b8542a', collide: false }); // chimneys
    b.box({ x, y: 0, z: -72.9, w: 18, h: 0.35, d: 0.3, color: '#2a2a2a', collide: false }); // kerb detail
  });
  for (const x of [-60, -36, -12, 12, 36, 60]) b.prop('bollard', { x, z: -72 });
  for (const x of [-84, 84]) b.prop('tree', { x, z: -80, color: '#5a7a3a' });
  b.prop('car', { x: -86, z: -88, rot: H, color: '#1e1e1e' }); b.prop('car', { x: 86, z: -88, rot: H, color: '#d8d8d8' });
  for (const x of [-30, 42]) b.prop('car', { x, z: -70.6, rot: H, color: hatch[(x + 30) / 12 % hatch.length] });
  b.prop('busstop', { x: -18, z: -69.8, rot: PI, ad: 'RATP' });

  // ---------- Avenue details ----------
  for (const [x, z] of [[-46.4, -60], [46.4, 64], [-46.4, 56], [46.4, -56]]) b.prop('hydrant', { x, z, color: '#555' });
  for (const [x, z, r] of [[-44.4, -8, 0], [44.4, -8, 0]]) b.prop('sign', { x, z, rot: r, text: 'RUE', bg: '#1f4f8f', fg: '#fff', w: 1.4, h: 0.5 });
  b.prop('stopsign', { x: -58.6, z: 65.8, rot: H }); b.prop('stopsign', { x: 58.6, z: -65.8, rot: -H });
  for (const x of [-20, 20]) b.prop('sandbags', { x, z: -56, rot: 0 });

  // ---------- Spawns: team 0 west, team 1 east ----------
  for (const [x, z] of [[-86, -46], [-86, -34], [-86, -22], [-86, -10], [-80, -40], [-80, -14], [-86, 32], [-86, 44], [-88, -80], [-88, 88], [-80, 50]]) b.spawn(0, x, z, H);
  for (const [x, z] of [[86, -46], [86, -34], [86, -22], [86, -10], [80, -40], [80, -14], [88, 36], [88, 50], [88, -80], [86, 82], [60, 36]]) b.spawn(1, x, z, -H);
  for (const [x, z] of [[0, -34], [0, -12], [8, 46], [0, 89], [-52, -62], [52, 62], [-24, -62], [24, 62], [-40, 60], [40, -60]]) b.spawn(null, x, z, 0);

  // ---------- Cinematics ----------
  b.cinematic(-30, 20, 6, 0, -34);     // across the esplanade up the grand stairs to the dalle and towers
  b.cinematic(-60, 16, 30, -10, 12);   // along the tram boulevard
  b.cinematic(40, 18, 60, 0, 80);      // the south barre and its underpass
  b.cinematic(30, 22, -60, 0, -81);    // Haussmann row from the north street
  return b.finish();
}
