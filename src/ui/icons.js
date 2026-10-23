// Icon generation: weapon/equipment renders (from the real meshes) and streak glyphs (canvas), all cached data URLs.
import * as THREE from 'three';
import { buildGunMesh, buildThrowableMesh } from '../game/character.js';

const cache = new Map();
let iconScene = null, iconCam = null;

function renderMesh(engine, mesh, key, { w = 320, h = 160, pad = 1.25, side = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  if (!iconScene) { iconScene = new THREE.Scene(); iconScene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 3.0)); const d = new THREE.DirectionalLight(0xffffff, 4.5); d.position.set(6, 5, 4); iconScene.add(d); const d2 = new THREE.DirectionalLight(0xffd9a0, 2.5); d2.position.set(-4, 2, -3); iconScene.add(d2); const d3 = new THREE.DirectionalLight(0xffffff, 2.0); d3.position.set(8, -2, 0); iconScene.add(d3); iconCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50); }
  // icon materials: lift the metals (no environment map in the icon scene) so the silhouettes read
  mesh.traverse((o) => { if (o.isMesh && o.material) { const m = o.material.clone(); m.metalness = Math.min(m.metalness, 0.15); m.roughness = Math.max(0.45, m.roughness * 0.9); m.color.offsetHSL(0, 0, 0.12); o.material = m; } });
  iconScene.add(mesh); mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh); const size = new THREE.Vector3(); box.getSize(size); const c = new THREE.Vector3(); box.getCenter(c);
  const span = Math.max(size.z, size.y * (w / h)) * pad; // side view: z is the long axis
  iconCam.left = -span / 2; iconCam.right = span / 2; iconCam.top = (span / 2) * (h / w); iconCam.bottom = -(span / 2) * (h / w); iconCam.updateProjectionMatrix();
  if (side) { iconCam.position.set(c.x + 10, c.y + 0.6, c.z); } else { iconCam.position.set(c.x + 6, c.y + 7, c.z + 6); }
  iconCam.lookAt(c); iconCam.updateMatrixWorld();
  const rt = new THREE.WebGLRenderTarget(w, h); const r = engine.renderer;
  r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(iconScene, iconCam); r.setRenderTarget(null); r.setClearColor(0x000000, 1);
  const buf = new Uint8Array(w * h * 4); r.readRenderTargetPixels(rt, 0, 0, w, h, buf); rt.dispose();
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(buf.subarray(y * w * 4, (y + 1) * w * 4), (h - 1 - y) * w * 4); ctx.putImageData(img, 0, 0);
  iconScene.remove(mesh);
  const url = cv.toDataURL('image/png'); cache.set(key, url); return url;
}
export function weaponIcon(engine, w) { const m = buildGunMesh(w); m.rotation.y = 0; return renderMesh(engine, m, 'w:' + w.id, { w: 320, h: 140, pad: 1.15 }); }
export function equipmentIcon(engine, e) { const m = buildThrowableMesh(e); m.scale.setScalar(1); return renderMesh(engine, m, 'e:' + e.id, { w: 160, h: 160, pad: 1.6, side: false }); }

// ---------------- streak glyphs ----------------
const GLYPHS = {
  radar: (c, s) => { c.beginPath(); c.arc(0, 0, s * 0.8, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, s * 0.45, 0, 7); c.stroke(); c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 0.75, -s * 0.35); c.stroke(); dot(c, s * 0.35, s * 0.2, s * 0.1); },
  counter_radar: (c, s) => { GLYPHS.radar(c, s); c.beginPath(); c.moveTo(-s * 0.8, s * 0.8); c.lineTo(s * 0.8, -s * 0.8); c.lineWidth *= 1.6; c.stroke(); },
  intel: (c, s) => { c.beginPath(); c.roundRect(-s * 0.3, -s * 0.8, s * 0.6, s * 1.6, s * 0.1); c.stroke(); c.beginPath(); c.arc(s * 0.6, -s * 0.6, s * 0.2, 0, 7); c.stroke(); c.beginPath(); c.arc(s * 0.6, -s * 0.6, s * 0.4, -2.2, -0.9); c.stroke(); },
  ammo: (c, s) => { for (let i = -1; i <= 1; i++) { c.beginPath(); c.roundRect(i * s * 0.45 - s * 0.14, -s * 0.5, s * 0.28, s * 1.2, s * 0.14); c.fill(); } },
  armor: (c, s) => { c.beginPath(); c.moveTo(0, -s * 0.85); c.lineTo(s * 0.7, -s * 0.55); c.lineTo(s * 0.6, s * 0.2); c.quadraticCurveTo(s * 0.4, s * 0.7, 0, s * 0.9); c.quadraticCurveTo(-s * 0.4, s * 0.7, -s * 0.6, s * 0.2); c.lineTo(-s * 0.7, -s * 0.55); c.closePath(); c.fill(); },
  crew: (c, s) => { for (const [x, y, r] of [[-0.5, 0.1, 0.28], [0.5, 0.1, 0.28], [0, -0.15, 0.34]]) { c.beginPath(); c.arc(x * s, y * s, r * s, 0, 7); c.fill(); c.beginPath(); c.roundRect(x * s - r * s * 1.2, y * s + r * s * 0.9, r * s * 2.4, s * 0.5, s * 0.15); c.fill(); } },
  dog: (c, s) => { dot(c, 0, s * 0.3, s * 0.42); for (const [x, y] of [[-0.55, -0.25], [-0.2, -0.55], [0.2, -0.55], [0.55, -0.25]]) dot(c, x * s, y * s, s * 0.17); },
  driveby: (c, s) => { c.beginPath(); c.roundRect(-s * 0.9, -s * 0.1, s * 1.8, s * 0.5, s * 0.12); c.fill(); c.beginPath(); c.roundRect(-s * 0.5, -s * 0.5, s * 1.0, s * 0.45, s * 0.12); c.fill(); dot(c, -s * 0.5, s * 0.5, s * 0.2); dot(c, s * 0.5, s * 0.5, s * 0.2); },
  mortar: (c, s) => { for (const [x, y] of [[-0.5, -0.6], [0.1, -0.2], [0.6, -0.7]]) { c.beginPath(); c.moveTo(x * s, y * s); c.lineTo(x * s, y * s + s * 0.5); c.stroke(); } c.beginPath(); c.arc(0, s * 0.6, s * 0.35, Math.PI, 0); c.fill(); for (let i = 0; i < 5; i++) { const a = Math.PI + (i / 4) * Math.PI; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.45, s * 0.6 + Math.sin(a) * s * 0.45); c.lineTo(Math.cos(a) * s * 0.7, s * 0.6 + Math.sin(a) * s * 0.7); c.stroke(); } },
  turret: (c, s) => { c.beginPath(); c.roundRect(-s * 0.4, -s * 0.5, s * 0.8, s * 0.5, s * 0.1); c.fill(); c.beginPath(); c.moveTo(s * 0.3, -s * 0.3); c.lineTo(s * 0.95, -s * 0.3); c.stroke(); c.beginPath(); c.moveTo(0, 0); c.lineTo(-s * 0.5, s * 0.8); c.moveTo(0, 0); c.lineTo(s * 0.5, s * 0.8); c.moveTo(0, 0); c.lineTo(0, s * 0.85); c.stroke(); },
  speed: (c, s) => { c.beginPath(); c.moveTo(s * 0.2, -s * 0.9); c.lineTo(-s * 0.5, s * 0.1); c.lineTo(s * 0.0, s * 0.1); c.lineTo(-s * 0.2, s * 0.9); c.lineTo(s * 0.5, -s * 0.1); c.lineTo(0, -s * 0.1); c.closePath(); c.fill(); },
  emp: (c, s) => { c.beginPath(); c.arc(0, 0, s * 0.8, 0.4, 5.9); c.stroke(); c.beginPath(); c.moveTo(0, -s * 0.9); c.lineTo(0, -s * 0.1); c.stroke(); GLYPHS.speed(c, s * 0.5); },
  heli: (c, s) => { c.beginPath(); c.moveTo(-s * 0.95, -s * 0.6); c.lineTo(s * 0.95, -s * 0.6); c.stroke(); c.beginPath(); c.moveTo(0, -s * 0.6); c.lineTo(0, -s * 0.3); c.stroke(); c.beginPath(); c.ellipse(s * 0.1, 0, s * 0.55, s * 0.32, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(-s * 0.5, -s * 0.05); c.lineTo(-s * 0.95, -s * 0.15); c.lineTo(-s * 0.95, s * 0.15); c.closePath(); c.fill(); c.beginPath(); c.moveTo(-s * 0.4, s * 0.55); c.lineTo(s * 0.6, s * 0.55); c.stroke(); },
  juggernaut: (c, s) => { c.beginPath(); c.arc(0, -s * 0.1, s * 0.7, Math.PI, 0); c.lineTo(s * 0.7, s * 0.5); c.lineTo(-s * 0.7, s * 0.5); c.closePath(); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.roundRect(-s * 0.45, -s * 0.05, s * 0.9, s * 0.25, s * 0.08); c.fill(); c.restore(); },
  hitman: (c, s) => { c.beginPath(); c.arc(0, 0, s * 0.6, 0, 7); c.stroke(); for (const [x, y] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { c.beginPath(); c.moveTo(x * s * 0.35, y * s * 0.35); c.lineTo(x * s * 0.9, y * s * 0.9); c.stroke(); } dot(c, 0, 0, s * 0.12); },
  wipe: (c, s) => { c.beginPath(); c.arc(0, -s * 0.15, s * 0.6, Math.PI * 0.9, Math.PI * 2.1); c.lineTo(s * 0.45, s * 0.5); c.lineTo(-s * 0.45, s * 0.5); c.closePath(); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; dot(c, -s * 0.25, -s * 0.15, s * 0.16); dot(c, s * 0.25, -s * 0.15, s * 0.16); c.fillRect(-s * 0.08, s * 0.1, s * 0.16, s * 0.25); c.restore(); for (const x of [-0.25, 0, 0.25]) c.fillRect(x * s - s * 0.06, s * 0.5, s * 0.12, s * 0.3); },
  quake: (c, s) => { c.beginPath(); c.moveTo(-s * 0.95, 0); c.lineTo(-s * 0.5, 0); c.lineTo(-s * 0.3, -s * 0.6); c.lineTo(0, s * 0.6); c.lineTo(s * 0.3, -s * 0.4); c.lineTo(s * 0.5, 0); c.lineTo(s * 0.95, 0); c.lineWidth *= 1.5; c.stroke(); },
  decoy: (c, s) => { c.beginPath(); c.moveTo(-s * 0.8, -s * 0.3); c.lineTo(-s * 0.4, -s * 0.3); c.lineTo(0, -s * 0.7); c.lineTo(0, s * 0.7); c.lineTo(-s * 0.4, s * 0.3); c.lineTo(-s * 0.8, s * 0.3); c.closePath(); c.fill(); for (const r of [0.35, 0.6, 0.85]) { c.beginPath(); c.arc(s * 0.1, 0, s * r, -0.9, 0.9); c.stroke(); } },
};
function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
export function streakIcon(effect, color = '#ffd166', size = 96) {
  const key = 's:' + effect + color + size; if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size; const c = cv.getContext('2d');
  c.translate(size / 2, size / 2); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = size * 0.07; c.lineCap = 'round'; c.lineJoin = 'round';
  (GLYPHS[effect] || GLYPHS.radar)(c, size * 0.42);
  const url = cv.toDataURL('image/png'); cache.set(key, url); return url;
}
