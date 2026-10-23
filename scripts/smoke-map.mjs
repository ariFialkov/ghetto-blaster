// Headless map validation: node scripts/smoke-map.mjs <mapId>
// Stubs the DOM canvas so the builder can run under Node, then checks colliders, nav reachability and spawns.
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop: noop }) : k === 'measureText' ? () => ({ width: 10 }) : typeof k === 'string' ? noop : undefined), set: () => true });
globalThis.document = { createElement: (tag) => ({ tag, width: 0, height: 0, getContext: () => ctxProxy, style: {} }) };
globalThis.window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener: noop, matchMedia: () => ({ matches: false }) };
try { Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true }); } catch (e) {}
const id = process.argv[2] || 'skidrow';
const { def, build } = await import(`../src/maps/${id}.js`);
const t0 = Date.now();
const map = build();
const ms = Date.now() - t0;
const nav = map.nav;
const meshes = []; map.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
const errors = [];
if (map.size < 120 || map.size > 260) errors.push(`size ${map.size} should be 120..260`);
if (map.world.boxes.length < 80) errors.push(`only ${map.world.boxes.length} colliders - map is too sparse`);
if (nav.walkable.length < 1500) errors.push(`only ${nav.walkable.length} walkable nav cells - too little playable space`);
for (const t of [0, 1]) if (map.spawns[t].length < 5) errors.push(`team ${t} has ${map.spawns[t].length} valid spawns (need >= 5)`);
if (map.spawns.all.length < 12) errors.push(`only ${map.spawns.all.length} valid spawns total (need >= 12)`);
// reachability between all spawns
let unreachable = 0;
const s0 = map.spawns.all[0];
for (const s of map.spawns.all) { const p = nav.path({ x: s0.x, z: s0.z, y: s0.y || 0 }, { x: s.x, z: s.z, y: s.y || 0 }, 20000); if (!p) unreachable++; }
if (unreachable) errors.push(`${unreachable} spawns unreachable from the first spawn`);
// connected component coverage: fraction of walkable nodes reachable from spawn 0
const reach = new Set(); const stack = []; const start = nav.nodeOf(s0.x, s0.z, s0.y || 0); stack.push(start); reach.add(start); const nb = [];
while (stack.length) { const i = stack.pop(); for (const j of nav.neighbors(i, nb)) if (!reach.has(j)) { reach.add(j); stack.push(j); } }
const coverage = reach.size / nav.walkable.length;
if (coverage < 0.98) errors.push(`only ${(coverage * 100).toFixed(1)}% of walkable nodes reachable from spawn 0`);
const interior = nav.walkable.filter((i) => (i & 1) === 0 && !Number.isNaN(nav.h[i + 1])).length;
const elevated = nav.walkable.filter((i) => nav.h[i] > 1.5).length;
console.log(JSON.stringify({ id: def.id, name: def.name, size: map.size, buildMs: ms, meshes: meshes.length, colliders: map.world.boxes.length, navCells: nav.walkable.length, elevatedCells: elevated, interiorCells: interior, spawns: { t0: map.spawns[0].length, t1: map.spawns[1].length, all: map.spawns.all.length }, landmarks: map.landmarks.map((l) => l.name), cinematic: map.cinematicPoints.length, coverage: +(coverage * 100).toFixed(1) }, null, 1));
if (errors.length) { console.error('PROBLEMS:\n - ' + errors.join('\n - ')); process.exit(1); }
console.log('OK');
