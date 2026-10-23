// BARRIO — Caracas. A Petare-style hillside: three stacked terraces of brightly painted ranchos climbing the east
// side, joined by wide concrete escaleras; below, a flat zone with Plaza Bolívar, the church, a futsal cancha,
// a bodega, an arepera, a GNB checkpoint on the winding subida and a Metrocable station whose cable climbs the hill.
import * as THREE from 'three';
import { MapBuilder, mat } from './builder.js';
import { tex } from '../core/textures.js';

export const def = {
  id: 'barrio', name: 'Barrio', city: 'Caracas', size: 170, seed: 23,
  teams: { tdm: 5, ffa: 8 },
  blurb: 'Petare hillside. Terraced ranchos, escaleras and a Metrocable under a hard tropical sun.',
  env: { skyTop: '#1b6fd8', skyHorizon: '#a8d8f8', skyBottom: '#3a3a30', fogColor: '#c4e2f6', fogNear: 130, fogFar: 320, hemiSky: '#bfe3ff', hemiGround: '#7a6a48', hemiIntensity: 0.95, sunColor: '#fff6d8', sunIntensity: 3.1, sunDir: [0.35, 0.95, 0.3], ambient: '#5a6670', ambientIntensity: 0.25, shadowSize: 95 },
  lightBudget: 8,
};

// Terrace heights (the hill climbs east). Ground = 0, T1 = 3, T2 = 6, T3 (mirador) = 9.
const T1 = 3, T2 = 6, T3 = 9;
const BRIGHT = ['#e8572a', '#c0392b', '#2a6fc0', '#2f9e55', '#f1c40f', '#e67e22', '#8e44ad', '#1abc9c', '#ecf0f1', '#ff7f50'];

export function build() {
  const b = new MapBuilder(def);
  const rng = b.rng;
  b.minimapBg = '#3a3128';
  b.ground('dirt', { seed: 6, color: '#7a6240' });

  // ---------------- materials ----------------
  const bodyMat = mat('brick', { color: '#8a6a4e', mortar: '#4a3a2e', seed: 5, dirty: 0.8 });
  const topMat = mat('concrete', { color: '#8c8273', seed: 15 });
  const parapetMat = mat('concrete', { color: '#a09484', seed: 16 });
  const metalM = mat('metal', { seed: 97, rust: 0.8, color: '#6a5a4a' });
  const tankBlue = mat('color', { color: '#1f5fa8', rough: 0.6 });
  const tankBlack = mat('color', { color: '#1b1b1b', rough: 0.7 });
  const pick = (arr) => arr[rng.int(0, arr.length - 1)];

  // ---------------- helpers ----------------
  // Solid terrace: brick retaining body + concrete walking slab (platform registers the minimap footprint).
  const terrace = (x1, x2, z1, z2, y, y0 = 0) => {
    const w = x2 - x1, d = z2 - z1, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    b.box({ x: cx, y: y0, z: cz, w, h: y - 0.4 - y0, d, m: bodyMat, repeat: [w / 3, (y - y0) / 3] });
    b.platform({ x: cx, z: cz, w, d, y: y - 0.4, t: 0.4, m: topMat, rails: false });
  };
  // Low parapet along a terrace edge, running along z at x (or along x at z when horiz)
  const parapet = (x, z, len, y, horiz = false) => {
    if (horiz) b.box({ x, y, z, w: len, h: 0.9, d: 0.4, m: parapetMat }); else b.box({ x, y, z, w: 0.4, h: 0.9, d: len, m: parapetMat });
  };
  // Enterable corrugated / plaster hut at arbitrary height (shell() can't take y, so built from boxes).
  const hut = (x, y, z, w, d, h, color, door = 's', style = 'shanty') => {
    const t = 0.15, dw = 1.4, dh = 2.1;
    const m = style === 'shanty' ? mat('corrugated', { seed: rng.int(1, 999), rust: 0.45, color }) : mat('plaster', { color, seed: rng.int(1, 999), dirty: 0.7 });
    const sides = [
      { k: 'n', cx: x, cz: z - d / 2 + t / 2, len: w, horiz: true }, { k: 's', cx: x, cz: z + d / 2 - t / 2, len: w, horiz: true },
      { k: 'w', cx: x - w / 2 + t / 2, cz: z, len: d, horiz: false }, { k: 'e', cx: x + w / 2 - t / 2, cz: z, len: d, horiz: false },
    ];
    for (const s of sides) {
      if (s.k !== door) { if (s.horiz) b.box({ x: s.cx, y, z: s.cz, w: s.len, h, d: t, m, repeat: [s.len / 2, h / 2] }); else b.box({ x: s.cx, y, z: s.cz, w: t, h, d: s.len, m, repeat: [s.len / 2, h / 2] }); continue; }
      const L = (s.len - dw) / 2;
      if (s.horiz) { b.box({ x: s.cx - s.len / 2 + L / 2, y, z: s.cz, w: L, h, d: t, m }); b.box({ x: s.cx + s.len / 2 - L / 2, y, z: s.cz, w: L, h, d: t, m }); b.box({ x: s.cx, y: y + dh, z: s.cz, w: dw + 0.1, h: h - dh, d: t, m }); }
      else { b.box({ x: s.cx, y, z: s.cz - s.len / 2 + L / 2, w: t, h, d: L, m }); b.box({ x: s.cx, y, z: s.cz + s.len / 2 - L / 2, w: t, h, d: L, m }); b.box({ x: s.cx, y: y + dh, z: s.cz, w: t, h: h - dh, d: dw + 0.1, m }); }
    }
    const roof = b.box({ x, y: y + h, z, w: w + 0.7, h: 0.1, d: d + 0.7, m: mat('corrugated', { seed: rng.int(1, 999), rust: 0.85 }), walkable: false }); // not a nav floor: the overhang would steal neighbouring cells
    roof.rotation.z = 0.03;
    // blue water tank (tanque azul) or black tank on the roof
    if (rng.chance(0.6)) b.cylinder(x + rng.float(-w / 4, w / 4), y + h + 0.1, z + rng.float(-d / 4, d / 4), 0.55, 1.1, rng.chance(0.7) ? tankBlue : tankBlack, 10, false);
    if (rng.chance(0.25)) b.prop('antenna', { x: x + w / 2 - 0.3, z: z - d / 2 + 0.3, y: y + h, h: 2.5 });
  };
  const barrel = (x, y, z) => b.cylinder(x, y, z, 0.32, 0.9, mat('metal', { seed: rng.int(1, 99), rust: 0.8, color: pick(['#8a2a2a', '#2a5a8a', '#4a4a4a', '#c87a2a']) }), 10, true);
  const tarp = (x, y, z, rot = 0, color = null) => {
    const c = color || pick(['#2a5a8a', '#4a4a4a', '#8a7a4a', '#1f8f4f']); const pm = mat('color', { color: '#444' });
    const cs = Math.cos(rot), sn = Math.sin(rot);
    for (const [px, pz] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) b.box({ x: x + px * cs + pz * sn, y, z: z - px * sn + pz * cs, w: 0.08, h: 2.2, d: 0.08, m: pm, collide: false });
    const r = b.box({ x, y: y + 2.2, z, w: 3, h: 0.05, d: 2.6, m: mat('color', { color: c, rough: 0.95 }), rot, collide: false }); r.rotation.z += 0.08;
    b.box({ x: x - 0.5 * cs, y, z: z + 0.5 * sn, w: 1.2, h: 0.5, d: 2.0, m: mat('color', { color: '#3a2a2a' }), rot });
  };
  const pipes = (x, y, z, len = 5, rot = 0) => {
    for (let i = 0; i < 3; i++) { const off = i === 2 ? 0 : (i - 0.5) * 0.6; b.box({ x: x + Math.sin(rot) * off, y: y + (i === 2 ? 0.55 : 0), z: z + Math.cos(rot) * off, w: len, h: 0.55, d: 0.55, m: metalM, rot, collide: false }); }
    b.box({ x, y, z, w: len, h: 1.1, d: 1.3, m: metalM, rot, collide: true, castShadow: false }).visible = false;
  };
  const sandbagsAt = (x, y, z, rot = 0) => {
    const m = mat('color', { color: '#9a8a5a', rough: 0.95 });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - (r === 2 ? 1 : 0); i++) { const off = (i - 1.5 + (r % 2) * 0.5) * 0.7; b.box({ x: x + Math.cos(rot) * off, y: y + r * 0.3, z: z - Math.sin(rot) * off, w: 0.7, h: 0.3, d: 0.45, m, rot, collide: false }); }
    b.box({ x, y, z, w: 2.8, h: 0.9, d: 0.5, m, rot, castShadow: false }).visible = false;
  };
  // Graffiti decal on any vertical face (y = centre height). rot: facing direction.
  const tag = (x, y, z, rot, text, w = 5) => {
    const t = tex('graffiti', { seed: rng.int(1, 9999), text });
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), m); p.position.set(x, y, z); p.rotation.y = rot; b.group.add(p);
  };
  // Building that sits on a terrace at height ty (box extends from ground, embedded in the hill)
  const tb = (ty, { x, z, w, d, h, color, style = 'plaster', sign = null, signColor = '#1f4f8f', graffiti = null, awning = null, name = null, balcony = false }) =>
    b.building({ x, z, w, d, h: ty + h, style, color, floors: Math.max(1, Math.round(h / 3)), lit: 0.15, sign, signColor, graffiti, awning, name, balcony, rooftop: true, shutters: style === 'plaster' });

  // =====================================================================================
  // GROUND ZONE (x -82..22)
  // =====================================================================================
  // ---- Roads ----
  b.road(-45, -82, -45, 82, 11, { sidewalk: true });                   // Avenida Principal
  b.road(-82, -44, 22, -44, 10, { sidewalk: true });                   // Calle Norte (to the Metrocable)
  b.road(-82, 44, 22, 44, 10, { sidewalk: true });                     // Calle Sur
  b.road(-82, 0, -38, 0, 9, { sidewalk: true });                       // short western street to the plaza
  // La Subida: winding road along the foot of the hill
  const subida = [[-2, 44], [16, 36], [19, 18], [14, -2], [19, -20], [16, -36], [18, -44]];
  for (let i = 0; i < subida.length - 1; i++) b.road(subida[i][0], subida[i][1], subida[i + 1][0], subida[i + 1][1], 8, { sidewalk: false, dashed: false });
  for (const [x, z] of [[-45, -44], [-45, 44], [-45, 0]]) { b.prop('trafficlight', { x: x + 7.5, z: z - 7.5, rot: Math.PI }); b.prop('lamp', { x: x - 7.5, z: z + 7.5, rot: 0, on: false }); }

  // ---- West strip: team 0 side, a row of painted buildings along the Avenida ----
  b.building({ x: -62, z: -68, w: 16, h: 9, d: 14, style: 'plaster', color: '#e8572a', sign: 'FARMACIA', signColor: '#2f9e55', awning: '#2f9e55' });
  b.building({ x: -62, z: -28, w: 16, h: 12, d: 12, style: 'tenement', graffiti: '23 DE ENERO', balcony: true });
  b.building({ x: -62, z: -10, w: 14, h: 7, d: 10, style: 'plaster', color: '#2a6fc0', sign: 'PANADERIA', signColor: '#c0392b', awning: '#f1c40f' });
  b.building({ x: -62, z: 12, w: 16, h: 10, d: 12, style: 'brick', color: '#9c4b32', fireEscape: true, graffiti: 'CHAVEZ VIVE' });
  b.building({ x: -62, z: 30, w: 14, h: 6, d: 10, style: 'plaster', color: '#2f9e55', sign: 'LICORES', signColor: '#8e44ad', awning: '#c0392b' });
  b.building({ x: -62, z: 68, w: 18, h: 11, d: 14, style: 'concrete', color: '#b8c4b0', sign: 'LICEO BOLIVARIANO', signColor: '#1f4f8f', name: 'Liceo' });
  for (const z of [-55, -40, 20, 50]) b.prop('laundry', { x: -62, z, y: 3.2, rot: 0, len: 6 });
  for (const [x, z, r] of [[-52.5, -60, 0], [-52.5, -20, 0.05], [-52.5, 22, 0], [-52.5, 58, -0.05], [-37.5, -66, Math.PI], [-37.5, 24, Math.PI]]) b.prop(rng.chance(0.3) ? 'van' : 'car', { x, z, rot: r, color: pick(['#c0392b', '#f1c40f', '#1c3f8c', '#d8d8d8', '#2f9e55']) });
  b.prop('car', { x: -74, z: 40, rot: 1.2, wreck: true }); b.prop('tires', { x: -74, z: 36 });
  for (let i = 0; i < 4; i++) b.prop('stall', { x: -52.5, z: -4 + i * 4, rot: Math.PI / 2 });
  b.prop('dumpster', { x: -72, z: -20, rot: 0.2 }); b.prop('dumpster', { x: -72, z: 4, rot: 0 }); b.prop('trashpile', { x: -72, z: 22 });
  for (const z of [-78, -62, -36, 4, 36, 58, 78]) b.prop('pole', { x: -76, z, rot: 0 });
  b.fence({ x: -74, z: 56, len: 12, rot: Math.PI / 2 }); b.fence({ x: -74, z: -78, len: 8, rot: Math.PI / 2 });
  b.prop('tree', { x: -70, z: -50, scale: 1.4 }); b.prop('tree', { x: -70, z: 50, scale: 1.4 }); b.prop('tree', { x: -74, z: 14 }); b.prop('tree', { x: -74, z: -8 });
  b.prop('billboard', { x: -70, z: 80, rot: Math.PI, text: 'PATRIA SOCIALISMO', bg: '#c0392b', fg: '#ffffff', w: 10, h: 8 });

  // ---- North block (x -38..-2, z -82..-54): hotel + tenement + alley ----
  b.building({ x: -30, z: -70, w: 14, h: 10, d: 16, style: 'plaster', color: '#e67e22', sign: 'HOTEL CARACAS', signColor: '#1f4f8f', balcony: true });
  b.building({ x: -12, z: -70, w: 14, h: 8, d: 16, style: 'brick', color: '#8a3b2a', graffiti: 'CHAVEZ VIVE', fireEscape: true });
  b.prop('dumpster', { x: -21, z: -76, rot: Math.PI / 2 }); b.prop('crate', { x: -21, z: -66 }); b.prop('laundry', { x: -21, z: -70, y: 4, rot: Math.PI / 2, len: 5 });
  b.prop('van', { x: -34, z: -56, rot: Math.PI / 2, text: 'POLAR', color: '#2a3a5a' });
  b.wall({ x: -12, z: -56, len: 12, h: 2.2, graffiti: '23 DE ENERO', color: '#b8b4aa' });

  // ---- Church block (z -42..-20) ----
  b.shell({ x: -18, z: -31, w: 24, h: 9, d: 18, doors: ['s'], style: 'plaster', color: '#f4ead2', name: 'Iglesia', sign: 'IGLESIA', signColor: '#8a5a1a', interior: false, lit: 0.1 });
  b.patch(-18, -31, 23, 17, 'tile', { seed: 3, color: '#b89a7a', line: '#6a4a3a', scale: 4 }, 0.025);
  for (let r = 0; r < 3; r++) for (const s of [-1, 1]) b.prop('bench', { x: -18 + s * 5, z: -26 - r * 3.2, rot: Math.PI });
  b.box({ x: -18, z: -38, w: 5, h: 1.1, d: 1.4, m: mat('plaster', { color: '#d9c9a3', seed: 4 }) });
  b.box({ x: -33.5, z: -24, w: 5, h: 16, d: 5, m: mat('plaster', { color: '#f4ead2', seed: 8, dirty: 0.4 }), repeat: [1, 4] }); // bell tower
  b.box({ x: -33.5, y: 16, z: -24, w: 0.3, h: 2.4, d: 0.3, m: mat('color', { color: '#d4af37', rough: 0.3, metal: 0.8 }), collide: false });
  b.box({ x: -33.5, y: 17.4, z: -24, w: 1.4, h: 0.3, d: 0.3, m: mat('color', { color: '#d4af37', rough: 0.3, metal: 0.8 }), collide: false });
  b.prop('shrine', { x: -5, z: -22, rot: 0 });
  b.prop('palm', { x: -32, z: -18 }); b.prop('palm', { x: -4, z: -18 });

  // ---- Plaza Bolívar (z -13..13) ----
  b.plaza(-18, 0, 30, 26, 'tile', { seed: 9, color: '#c9b48c', line: '#7a6a50', mmColor: '#8a7a60' });
  b.prop('statue', { x: -18, z: 0, rot: Math.PI / 2, horse: true, name: 'Plaza Bolívar', color: '#3f6b5a', h: 3 });
  b.prop('flag', { x: -14, z: -4, rot: 0.4, color: '#ffd700', stripe: '#1a3a8a' });
  for (const [px, pz] of [[-30, -10], [-6, -10], [-30, 10], [-6, 10]]) b.prop('tree', { x: px, z: pz, scale: 1.3 });
  for (const [px, pz, r] of [[-24, -5, 0], [-12, -5, 0], [-24, 5, Math.PI], [-12, 5, Math.PI]]) b.prop('bench', { x: px, z: pz, rot: r });
  for (const [px, pz, r] of [[-18, -11, 0], [-18, 11, 0], [-31.5, 0, Math.PI / 2], [-4.5, 0, Math.PI / 2]]) b.prop('planter', { x: px, z: pz, rot: r, w: 4 });
  b.prop('newsstand', { x: -28, z: 6, rot: Math.PI / 2, text: 'LOTERIA' });
  b.prop('stall', { x: -8, z: -6, rot: 0, color: '#f39c12' }); b.prop('stall', { x: -8, z: 6, rot: 0, color: '#27ae60' });
  b.prop('lamp', { x: -24, z: 0, rot: 0, on: false }); b.prop('lamp', { x: -12, z: 0, rot: Math.PI, on: false });
  b.prop('trashcan', { x: -30, z: -2 }); b.prop('trashcan', { x: -6, z: 2 });
  b.prop('busstop', { x: -37.6, z: 8, rot: Math.PI / 2, ad: 'METRO' });
  b.prop('bus', { x: -51, z: 8, rot: 0, color: '#c0392b' });

  // ---- Cancha (futsal court, z 22..36) ----
  b.prop('court', { x: -20, z: 29, w: 26, d: 14, color: '#2a7fc0' });
  b.prop('hoop', { x: -32, z: 29, rot: Math.PI / 2 }); b.prop('hoop', { x: -8, z: 29, rot: -Math.PI / 2 });
  b.fence({ x: -20, z: 21.5, len: 26, h: 3 }); b.fence({ x: -20, z: 36.5, len: 26, h: 3 });
  b.fence({ x: -33.5, z: 25, len: 7, h: 3, rot: Math.PI / 2 }); b.fence({ x: -33.5, z: 33, len: 7, h: 3, rot: Math.PI / 2 });
  b.fence({ x: -6.5, z: 25, len: 7, h: 3, rot: Math.PI / 2 }); b.fence({ x: -6.5, z: 33, len: 7, h: 3, rot: Math.PI / 2 });
  b.wall({ x: -20, z: 38.5, len: 14, h: 2.4, graffiti: 'PETARE', color: '#c9b48c' });
  b.prop('bench', { x: -26, z: 19.5, rot: 0 }); b.prop('bench', { x: -14, z: 19.5, rot: 0 });

  // ---- South block (z 54..82): mercado + houses ----
  b.building({ x: -30, z: 68, w: 14, h: 9, d: 16, style: 'plaster', color: '#f1c40f', sign: 'MERCADO', signColor: '#c0392b', awning: '#2a6fc0' });
  b.building({ x: -12, z: 70, w: 14, h: 7, d: 14, style: 'shanty', color: '#6f8a5f', graffiti: 'PETARE' });
  for (let i = 0; i < 5; i++) b.prop('stall', { x: -34 + i * 6, z: 52, rot: Math.PI });
  b.prop('tarp', { x: -8, z: 56, rot: 0.3 }); b.prop('barrel', { x: -4, z: 60 }); b.prop('barrel', { x: -3.2, z: 61 });
  b.prop('truck', { x: -21, z: 78, rot: Math.PI / 2, color: '#8a3a2a' });
  b.prop('laundry', { x: -21, z: 68, y: 4, rot: Math.PI / 2, len: 5 });
  b.prop('pipes', { x: -36, z: 78, rot: 0 });

  // ---- Hill foot strip (x 0..22) ----
  // Metrocable station: enterable shell, roof platform reached by stairs on its south side, canopy over the roof
  b.shell({ x: 8, z: -70, w: 14, h: 5, d: 10, doors: ['w', 's'], style: 'concrete', color: '#c0392b', name: 'Metrocable', sign: 'METROCABLE PETARE', signColor: '#c0392b', stairs: { x: 10, z: -55.08, dir: 'n', width: 2.4 }, interior: true });
  for (const [px, pz] of [[1.5, -75], [14.5, -75], [1.5, -65], [14.5, -65]]) b.box({ x: px, y: 5.3, z: pz, w: 0.3, h: 3.8, d: 0.3, m: mat('color', { color: '#444', rough: 0.5, metal: 0.6 }), walkable: false });
  b.box({ x: 8, y: 9.1, z: -70, w: 16, h: 0.3, d: 12, m: mat('color', { color: '#c0392b', rough: 0.7 }), collide: false });
  b.box({ x: 8, y: 5.3, z: -74.7, w: 14, h: 1.0, d: 0.12, m: mat('color', { color: '#3a3a3a' }), walkable: false }); // rail
  b.prop('sign', { x: 2.5, z: -63, rot: 0, text: 'METROCABLE', bg: '#c0392b', fg: '#fff', w: 1.6, h: 0.6 });
  b.prop('bollard', { x: -2, z: -70 }); b.prop('bollard', { x: -2, z: -67 }); b.prop('bollard', { x: -2, z: -73 });
  // Arepera (enterable) with neon
  b.shell({ x: 8, z: -28, w: 10, h: 4.2, d: 8, doors: ['w', 's'], style: 'plaster', color: '#f1c40f', name: 'Arepera', sign: 'AREPERA LA GLORIA', signColor: '#c0392b', interior: true });
  b.prop('neonSign', { x: 8, z: -23.7, rot: 0, text: 'AREPAS', color: '#ffb000', y: 3.6, w: 5, light: true });
  b.awning(8, -28, 10, 8, 0, '#c0392b', rng);
  b.prop('picnic', { x: 2, z: -22, rot: 0 }); b.prop('picnic', { x: 14, z: -22, rot: 0.2 }); b.prop('trashcan', { x: 1, z: -31 });
  b.prop('van', { x: 1, z: -38, rot: 0.1, text: 'AREPAS', color: '#f1c40f' });
  // Bodega (enterable) with sign + awning facing the plaza
  b.shell({ x: 8, z: 14, w: 10, h: 4, d: 8, doors: ['w'], style: 'plaster', color: '#2a6fc0', name: 'Abastos', sign: 'ABASTOS', signColor: '#c0392b', interior: true, graffiti: 'PETARE' });
  b.awning(8, 14, 10, 8, -Math.PI / 2, '#c0392b', rng);
  b.prop('crate', { x: 2, z: 10 }); b.prop('crate', { x: 2, z: 18, size: 1.2 }); b.prop('pallet', { x: 2.4, z: 20.5 });
  b.prop('phonebooth', { x: 1.5, z: 6, rot: 0, color: '#c0392b' });
  // GNB checkpoint on the subida
  b.prop('barricade', { x: 14, z: -4, rot: 0.3, text: 'GNB' }); b.prop('barricade', { x: 19, z: 1, rot: 0.3, text: 'GNB' });
  b.prop('sandbags', { x: 10, z: -8, rot: 0.3 }); b.prop('sandbags', { x: 21, z: -12, rot: -1.2 });
  b.prop('flag', { x: 8, z: -12, rot: 0.2, color: '#ffd700', stripe: '#1a3a8a' });
  b.prop('van', { x: 20, z: -10, rot: 0.15, text: 'GNB', color: '#3a5a3a' });
  for (let i = 0; i < 4; i++) b.prop('cone', { x: 10 + i * 2.5, z: 2 + i * 0.6 });
  b.prop('barrier', { x: 6, z: -1, rot: 0.3 });
  // Ground-level rancho cluster (south, z 24..40 and 54..80)
  for (const [x, z, c, door] of [[5, 28, '#e8572a', 'e'], [5, 34, '#2f9e55', 'e'], [10, 30, '#2a6fc0', 'w'], [5, 58, '#c0392b', 'n'], [11, 60, '#f1c40f', 'w'], [5, 66, '#8e44ad', 'e'], [12, 70, '#e67e22', 's'], [5, 76, '#1abc9c', 'n'], [13, 78, '#ff7f50', 'w']]) b.prop('shack', { x, z, color: c, door, w: 4.2, d: 3.6, h: 2.7 });
  b.prop('laundry', { x: 8, z: 32, y: 2.8, rot: 0, len: 5 }); b.prop('laundry', { x: 8, z: 63, y: 2.8, rot: Math.PI / 2, len: 5 }); b.prop('laundry', { x: 9, z: 73, y: 2.8, rot: 0.3, len: 4 });
  b.prop('tarp', { x: 15, z: 56, rot: 0.3, color: '#1f8f4f' }); b.prop('tires', { x: 18, z: 64 }); b.prop('car', { x: 18, z: 74, rot: 0.3, wreck: true });
  b.prop('pipes', { x: 10, z: 40, rot: 0, len: 6 }); b.prop('rubble', { x: 18, z: 44 });
  b.prop('dumpster', { x: 2, z: 48, rot: 0 }); b.prop('trashpile', { x: 16, z: 50 });
  b.prop('car', { x: 4, z: -50, rot: Math.PI / 2, color: '#d8d8d8' }); b.prop('car', { x: 20, z: -58, rot: 0.1, color: '#1c3f8c' }); b.prop('car', { x: 20, z: 30, rot: 0.2, color: '#c9a227' });
  b.prop('tree', { x: 2, z: -56, scale: 1.2 }); b.prop('palm', { x: 2, z: 0 }); b.prop('tree', { x: 20, z: 52, scale: 1.3 });
  // graffiti on the T1 retaining face (x=28), facing west
  tag(27.97, 1.5, -30, -Math.PI / 2, 'CHAVEZ VIVE', 6); tag(27.97, 1.5, 10, -Math.PI / 2, 'PETARE', 5); tag(27.97, 1.5, 70, -Math.PI / 2, '23 DE ENERO', 6); tag(27.97, 1.5, -76, -Math.PI / 2, 'PETARE', 4);

  // =====================================================================================
  // THE HILL
  // =====================================================================================
  // ---- Terrace bodies ----
  terrace(28, 54, -82, 82, T1);
  terrace(54, 82, -82, 82, T2);
  terrace(62, 82, -82, -58, T3, T2); // mirador in the NE corner, sits on T2

  // ---- Escaleras: ground -> T1 (4), T1 -> T2 (3), T2 -> T3 (1) ----
  const stairsT1 = [-60, -20, 20, 60], stairsT2 = [-40, 0, 40];
  for (const z of stairsT1) b.stairs({ x: 22, z, dir: 'e', height: T1, width: 3 });             // landing spans x 27.58..28.78 (T1 edge 28)
  for (const z of stairsT2) b.stairs({ x: 42, z, dir: 'e', height: T2, width: 3 });             // first 9 steps buried in T1; landing 53.16..54.36 (T2 edge 54)
  b.stairs({ x: 66, z: -41.26, dir: 'n', height: T3, width: 3 });                               // landing z -58.0..-59.2 (T3 edge -58)

  // ---- Parapets along terrace fronts (gaps at the stairs) ----
  const segs = (zs, from, to, gap) => { const out = []; let a = from; for (const z of [...zs, to + 100]) { const end = Math.min(z - gap, to); if (end > a + 1) out.push([a, end]); a = z + gap; } return out; };
  for (const [a, c] of segs(stairsT1, -82, 82, 2.4)) parapet(28.3, (a + c) / 2, c - a, T1);
  for (const [a, c] of segs(stairsT2, -82, 82, 2.4)) parapet(54.3, (a + c) / 2, c - a, T2);
  parapet(62.3, -70, 24, T3); parapet(63.2, -58.3, 2.4, T3, true); parapet(75, -58.3, 14, T3, true); // gap at x 64.4..68 for the escalera

  // ---- Terrace roads (callejones) ----
  b.road(38, -82, 38, 82, 6, { sidewalk: false, marks: false, y: T1 + 0.02 });
  b.road(68, -56, 68, 82, 6, { sidewalk: false, marks: false, y: T2 + 0.02 });
  b.road(38, -82, 68, -70, 5, { sidewalk: false, marks: false, y: T2 + 0.02 });

  // =====================================================================================
  // T1 (y=3): front row of painted houses, middle huts along the callejón, back row against T2's wall
  // =====================================================================================
  const frontT1 = [[-74, 10, '#e8572a', 'shanty'], [-50, 8, '#2a6fc0', 'plaster'], [-32, 10, '#f1c40f', 'plaster'], [-8, 12, '#c0392b', 'plaster'], [8, 10, '#2f9e55', 'shanty'], [32, 10, '#e67e22', 'plaster'], [48, 8, '#8e44ad', 'plaster'], [72, 10, '#1abc9c', 'shanty']];
  frontT1.forEach(([z, d, color, style], i) => tb(T1, { x: 32.5, z, w: 7, d, h: 4 + (i % 3) * 1.5, color, style, graffiti: i === 3 ? 'CHAVEZ VIVE' : i === 6 ? 'PETARE' : null, sign: i === 1 ? 'CYBER' : i === 5 ? 'PELUQUERIA' : null, signColor: '#c0392b', balcony: i % 2 === 0 }));
  const backT1 = [[-72, 10, '#2f9e55', 'plaster'], [-56, 10, '#ecf0f1', 'shanty'], [-24, 12, '#ff7f50', 'plaster'], [12, 12, '#2a6fc0', 'plaster'], [24, 8, '#f1c40f', 'shanty'], [56, 10, '#c0392b', 'plaster'], [72, 10, '#e67e22', 'shanty']];
  backT1.forEach(([z, d, color, style], i) => tb(T1, { x: 50, z, w: 7, d, h: 3.5 + (i % 2) * 2, color, style, graffiti: i === 2 ? '23 DE ENERO' : null, sign: i === 3 ? 'BODEGA' : null, signColor: '#1f4f8f' }));
  // huts + props along the callejón
  const hutsT1 = [[43, -66, '#e8572a', 'w'], [43, -48, '#1abc9c', 'w'], [44, -30, '#f1c40f', 's'], [43, -12, '#2a6fc0', 'w'], [44, 18, '#c0392b', 'n'], [43, 30, '#8e44ad', 'w'], [44, 50, '#2f9e55', 's'], [43, 66, '#ff7f50', 'w'], [33, -62, '#ecf0f1', 'e'], [33, 20, '#e67e22', 'e'], [33, 60, '#1abc9c', 'e']];
  hutsT1.forEach(([x, z, c, door], i) => hut(x, T1, z, 4.2, 3.6, 2.6, c, door, i % 3 === 0 ? 'plaster' : 'shanty'));
  for (const [x, z, r] of [[38, -58, Math.PI / 2], [38, -4, Math.PI / 2], [38, 24, Math.PI / 2], [38, 74, Math.PI / 2], [46, -40, 0], [46, 40, 0]]) b.prop('laundry', { x, z, y: T1 + 2.9, rot: r, len: 4 });
  for (const [x, z] of [[40, -72], [40.8, -71.2], [36, -36], [36.9, -35.2], [41, 8], [36, 54], [36.8, 54.9], [41, 72]]) barrel(x, T1, z);
  for (const [x, z, r] of [[36, -44, 0.2], [41, 36, Math.PI / 2], [36, 70, 0]]) tarp(x, T1, z, r);
  for (const [x, z, y] of [[46, -4, T1], [46, -4, T1 + 2.6], [46, 44, T1]]) b.prop('container', { x, z, y, rot: 0, len: 6, color: pick(['#8a2a2a', '#2a5a8a', '#c87a2a']) });
  for (const [x, z] of [[30, -42], [30.5, 42], [41, -20], [36, 10]]) b.prop('crate', { x, z, y: T1, size: pick([1, 1.2, 1.4]) });
  pipes(44, T1, -78, 6, 0); pipes(36, T1, 36, 5, Math.PI / 2);
  b.prop('watertower', { x: 46, z: -58, y: T1, h: 5 });
  b.prop('watertower', { x: 46, z: 64, y: T1, h: 4 });
  // cars on the callejón (built from ground: fake with boxes at T1)
  for (const [z, c] of [[-26, '#d8d8d8'], [6, '#c0392b'], [38, '#1c3f8c']]) { b.box({ x: 36, y: T1, z, w: 1.9, h: 0.7, d: 4.4, m: mat('color', { color: c, rough: 0.4, metal: 0.4 }), kind: 'prop' }); b.box({ x: 36, y: T1 + 0.7, z: z - 0.2, w: 1.7, h: 0.6, d: 2.2, m: mat('color', { color: '#1b2430', rough: 0.2, metal: 0.6 }) }); }
  // posts & wires along the callejón
  for (const z of [-70, -46, -14, 14, 46, 70]) b.cylinder(41, T1, z, 0.14, 7, mat('color', { color: '#6b5a45', rough: 0.9 }), 8, true);
  tag(53.97, T1 + 1.5, -10, -Math.PI / 2, 'PETARE', 6); tag(53.97, T1 + 1.5, 30, -Math.PI / 2, 'CHAVEZ VIVE', 6);
  // Metrocable pylon on T1
  b.cylinder(40, T1, -68, 0.5, 12, mat('color', { color: '#777', rough: 0.5, metal: 0.6 }), 10, true);

  // =====================================================================================
  // T2 (y=6): team 1 side. Front row above T1, back row along the east edge, callejón at x=68
  // =====================================================================================
  const frontT2 = [[-74, 10, '#ecf0f1', 'plaster'], [-50, 8, '#e8572a', 'shanty'], [-30, 10, '#2a6fc0', 'plaster'], [-12, 10, '#2f9e55', 'plaster'], [10, 10, '#f1c40f', 'shanty'], [26, 8, '#c0392b', 'plaster'], [50, 10, '#8e44ad', 'plaster'], [66, 10, '#e67e22', 'shanty'], [78, 6, '#1abc9c', 'plaster']];
  frontT2.forEach(([z, d, color, style], i) => tb(T2, { x: 58.5, z, w: 7, d, h: 4.5 + (i % 3) * 1.5, color, style, graffiti: i === 2 ? 'PETARE' : i === 5 ? 'CHAVEZ VIVE' : null, sign: i === 3 ? 'LICORERIA' : null, signColor: '#c0392b', balcony: i % 2 === 1 }));
  const backT2 = [[-50, 10, '#2f9e55', 'plaster'], [-34, 10, '#f1c40f', 'shanty'], [-16, 10, '#c0392b', 'plaster'], [4, 10, '#2a6fc0', 'plaster'], [22, 8, '#ff7f50', 'shanty'], [44, 10, '#ecf0f1', 'plaster'], [62, 10, '#e8572a', 'plaster'], [76, 8, '#8e44ad', 'shanty']];
  backT2.forEach(([z, d, color, style], i) => tb(T2, { x: 77, z, w: 8, d, h: 4 + (i % 2) * 2, color, style, graffiti: i === 4 ? '23 DE ENERO' : null }));
  const hutsT2 = [[66, -30, '#e67e22', 'w'], [64, -10, '#1abc9c', 'e'], [72, 12, '#f1c40f', 'w'], [64, 36, '#e8572a', 'e'], [72, 54, '#2f9e55', 'w'], [64, 70, '#ecf0f1', 'e'], [58, -62, '#c0392b', 's']];
  hutsT2.forEach(([x, z, c, door], i) => hut(x, T2, z, 4.2, 3.6, 2.6, c, door, i % 2 === 0 ? 'shanty' : 'plaster'));
  for (const [x, z, r] of [[68, -24, Math.PI / 2], [68, 30, Math.PI / 2], [68, 62, Math.PI / 2], [72, 40, 0]]) b.prop('laundry', { x, z, y: T2 + 2.9, rot: r, len: 4 });
  for (const [x, z] of [[62, -22], [62.8, -21.2], [70, 20], [62, 48], [62.9, 48.8], [70, 76]]) barrel(x, T2, z);
  for (const [x, z, r] of [[72, -24, 0.2], [64, 24, Math.PI / 2], [72, 66, 0]]) tarp(x, T2, z, r);
  for (const [x, z, y] of [[72, -44, T2], [72, 32, T2], [72, 32, T2 + 2.6]]) b.prop('container', { x, z, y, rot: 0, len: 6, color: pick(['#2f6f3f', '#2a5a8a', '#c87a2a']) });
  for (const [x, z] of [[64, 4], [64.9, 4.6], [64, 58]]) b.prop('crate', { x, z, y: T2, size: pick([1, 1.2]) });
  pipes(66, T2, 46, 6, 0);
  b.prop('watertower', { x: 72, z: 78, y: T2, h: 5 });
  for (const z of [-20, 8, 36, 72]) b.cylinder(71, T2, z, 0.14, 7, mat('color', { color: '#6b5a45', rough: 0.9 }), 8, true);
  // Upper Metrocable station on T3 (cable terminal) + the cable itself with cabins
  tb(T3, { x: 74, z: -68, w: 12, d: 9, h: 6, color: '#c0392b', style: 'concrete', sign: 'METROCABLE', signColor: '#c0392b' });
  {
    const a = new THREE.Vector3(8, 8.6, -70), c = new THREE.Vector3(68, T3 + 7, -68);
    const dir = c.clone().sub(a); const len = dir.length();
    const cable = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), mat('color', { color: '#222', rough: 0.4, metal: 0.8 }));
    cable.position.copy(a.clone().add(c).multiplyScalar(0.5)); cable.rotation.y = -Math.atan2(dir.z, dir.x); cable.rotation.z = Math.atan2(dir.y, Math.hypot(dir.x, dir.z)); b.group.add(cable);
    const cm = mat('color', { color: '#c0392b', rough: 0.5, metal: 0.3 }), gm = mat('color', { color: '#1b2430', rough: 0.2, metal: 0.6 });
    for (const t of [0.22, 0.5, 0.78]) { const p = a.clone().lerp(c, t); const hang = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), mat('color', { color: '#333' })); hang.position.set(p.x, p.y - 0.7, p.z); b.group.add(hang); const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 2.6), cm); cab.position.set(p.x, p.y - 2.5, p.z); cab.castShadow = true; b.group.add(cab); const win = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.8, 2.64), gm); win.position.set(p.x, p.y - 2.2, p.z); b.group.add(win); }
  }

  // =====================================================================================
  // T3 (y=9): El Mirador — lookout over the whole barrio
  // =====================================================================================
  b.landmarks.push({ x: 70, z: -72, name: 'El Mirador' });
  b.prop('watertower', { x: 78, z: -76, y: T3, h: 5 });
  b.prop('antenna', { x: 66, z: -78, y: T3, h: 9 }); b.prop('dish', { x: 67, z: -76, y: T3, rot: 1 });
  hut(66, T3, -64, 4.2, 3.6, 2.6, '#f1c40f', 'e', 'plaster');
  sandbagsAt(64, T3, -70, 0.2); sandbagsAt(64, T3, -62, -0.3);
  barrel(68, T3, -74); barrel(68.8, T3, -73.3); b.prop('crate', { x: 70, z: -78, y: T3, size: 1.3 });
  b.box({ x: 74, y: T3, z: -78, w: 3, h: 0.5, d: 1.8, m: mat('color', { color: '#2a3a5a', rough: 0.9 }) }); // old mattress/sofa
  b.cylinder(79, T3, -62, 0.06, 7, mat('color', { color: '#ccc', rough: 0.4, metal: 0.7 }), 6, false);
  { const f = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshStandardMaterial({ map: tex('cloth', { color: '#ffd700', stripe: '#1a3a8a' }), side: THREE.DoubleSide })); f.position.set(77.9, T3 + 6.2, -62); b.group.add(f); }
  tag(61.97, T3 + 1.2, -66, -Math.PI / 2, 'PETARE', 5);
  b.prop('laundry', { x: 72, z: -62, y: T3 + 2.8, rot: 0, len: 5 });

  // =====================================================================================
  // Spawns: team 0 far west at ground level, team 1 on T2's callejón
  // =====================================================================================
  for (const z of [-72, -60, -30, -16, -2, 12, 26, 60, 72]) b.spawn(0, -78, z, Math.PI / 2);
  for (const [x, z] of [[72, -75], [69, -54], [69, -30], [69, -16], [69, -2], [69, 14], [69, 30], [69, 54], [69, 70]]) b.spawn(1, x, z, -Math.PI / 2);
  for (const [x, z] of [[-18, -17], [-18, 17], [38, -44], [38, 44], [-45, -62], [-45, 62], [18, -56], [10, 50], [65, -74], [38, 78]]) b.spawn(null, x, z, 0);

  // ---- cinematic camera shots ----
  b.cinematic(-44, 20, 24, 40, 0);         // from over the plaza up the painted hillside
  b.cinematic(70, 24, -74, -18, 0);        // from El Mirador down over the barrio
  b.cinematic(-45, 14, -80, -45, 0);       // down the Avenida
  b.cinematic(30, 16, -82, 10, -68);       // the Metrocable station and cable
  return b.finish();
}
