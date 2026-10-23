// Two-layer grid navigation mesh built from the collision world. Each cell stores up to two walkable
// surfaces (lowest and highest), so bots can path through building interiors AND over their roofs.
import * as THREE from 'three';
import { STEP_HEIGHT } from '../core/physics.js';
// Max height difference between neighbouring nav nodes. Larger than the physics step so stairs connect;
// bots jump when the next waypoint is above the physics step height.
export const NAV_STEP = 1.15;

class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

export class NavGrid {
  constructor(world, cell = 1.5) {
    this.world = world; this.cell = cell;
    this.n = Math.ceil(world.size / cell);
    const N = this.n * this.n;
    this.h = new Float32Array(N * 2).fill(NaN); // node = cell*2 + layer
    this.cover = new Uint8Array(N * 2);
    this.open = new Float32Array(N * 2);
    this.walkable = []; // node indices
    this._build();
  }
  idx(cx, cz) { return cz * this.n + cx; }
  cellOf(node) { return node >> 1; }
  toCell(x, z) { return [Math.floor((x + this.world.size / 2) / this.cell), Math.floor((z + this.world.size / 2) / this.cell)]; }
  toWorld(cx, cz) { return new THREE.Vector3((cx + 0.5) * this.cell - this.world.size / 2, 0, (cz + 0.5) * this.cell - this.world.size / 2); }
  nodeWorld(node) { const c = node >> 1; return this.toWorld(c % this.n, Math.floor(c / this.n)).setY(this.h[node]); }
  inGrid(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.n && cz < this.n; }
  /** Best node for a cell given a preferred height (closest layer). Returns -1 if none. */
  nodeAt(cx, cz, y = 0) {
    if (!this.inGrid(cx, cz)) return -1; const c = this.idx(cx, cz) * 2; const h0 = this.h[c], h1 = this.h[c + 1];
    if (Number.isNaN(h0) && Number.isNaN(h1)) return -1; if (Number.isNaN(h1)) return c; if (Number.isNaN(h0)) return c + 1;
    return Math.abs(h0 - y) <= Math.abs(h1 - y) ? c : c + 1;
  }
  nodeOf(x, z, y = 0) { const [cx, cz] = this.toCell(x, z); return this.nodeAt(cx, cz, y); }
  _build() {
    const w = this.world, r = 0.5, maxH = 14;
    const cands = [];
    for (let cz = 0; cz < this.n; cz++) for (let cx = 0; cx < this.n; cx++) {
      const p = this.toWorld(cx, cz);
      if (p.x < w.bounds.minX + 1 || p.x > w.bounds.maxX - 1 || p.z < w.bounds.minZ + 1 || p.z > w.bounds.maxZ - 1) continue;
      cands.length = 0; cands.push(w.groundY);
      w.near(p.x, p.z, r, (b) => { if (!b.walkable) return; if (p.x + r > b.min.x && p.x - r < b.max.x && p.z + r > b.min.z && p.z - r < b.max.z && b.max.y <= maxH && b.max.y > w.groundY) cands.push(b.max.y); });
      cands.sort((a, b) => a - b);
      const ok = [];
      for (let i = 0; i < cands.length; i++) {
        const floor = cands[i]; if (i > 0 && Math.abs(floor - cands[i - 1]) < 0.05) continue;
        let blocked = false; const y0 = floor + STEP_HEIGHT, y1 = floor + 1.75;
        w.near(p.x, p.z, r, (b) => { const ox = p.x + r > b.min.x && p.x - r < b.max.x, oz = p.z + r > b.min.z && p.z - r < b.max.z; if (ox && oz && b.max.y > y0 && b.min.y < y1) { blocked = true; return false; } });
        if (!blocked) ok.push(floor);
      }
      if (!ok.length) continue;
      const base = this.idx(cx, cz) * 2;
      this.h[base] = ok[0]; if (ok.length > 1) this.h[base + 1] = ok[ok.length - 1];
      for (const layer of [0, 1]) { const floor = this.h[base + layer]; if (Number.isNaN(floor)) continue; let tallNear = false;
        w.near(p.x, p.z, r + 1.2, (b) => { if (b.max.y > floor + 1.2 && b.min.y < floor + 1.2) { const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x), dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z); if (dx * dx + dz * dz < 1.6 * 1.6) tallNear = true; } });
        this.cover[base + layer] = tallNear ? 1 : 0; }
    }
    // openness: fraction of neighbouring cells (radius 3) with a layer near this height
    for (let cz = 0; cz < this.n; cz++) for (let cx = 0; cx < this.n; cx++) for (const layer of [0, 1]) {
      const node = this.idx(cx, cz) * 2 + layer; const h0 = this.h[node]; if (Number.isNaN(h0)) continue;
      let ok = 0, tot = 0;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const x = cx + dx, z = cz + dz; if (!this.inGrid(x, z)) continue; tot++; const nb = this.nodeAt(x, z, h0); if (nb >= 0 && Math.abs(this.h[nb] - h0) <= NAV_STEP) ok++; }
      this.open[node] = ok / tot;
    }
  }
  /** Neighbour nodes of a node (8-connected, height-compatible, no corner cutting). */
  neighbors(node, out = []) {
    out.length = 0; const c = node >> 1; const cx = c % this.n, cz = Math.floor(c / this.n), h0 = this.h[node];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const x = cx + dx, z = cz + dz; if (!this.inGrid(x, z)) continue;
      const nb = this.nodeAt(x, z, h0); if (nb < 0 || Math.abs(this.h[nb] - h0) > NAV_STEP) continue;
      if (dx && dz) { const a = this.nodeAt(cx + dx, cz, h0), b = this.nodeAt(cx, cz + dz, h0); if (a < 0 || b < 0 || Math.abs(this.h[a] - h0) > NAV_STEP || Math.abs(this.h[b] - h0) > NAV_STEP) continue; }
      out.push(nb);
    }
    return out;
  }
  // Keep only the largest connected component that contains seeds (removes disconnected rooftops etc.)
  prune(seeds) {
    const N = this.h.length; const label = new Int32Array(N).fill(-1); const sizes = []; const nb = [];
    const fill = (start, id) => { const stack = [start]; label[start] = id; let count = 0; while (stack.length) { const i = stack.pop(); count++; for (const j of this.neighbors(i, nb)) if (label[j] === -1) { label[j] = id; stack.push(j); } } return count; };
    for (let i = 0; i < N; i++) if (label[i] === -1 && !Number.isNaN(this.h[i])) sizes.push(fill(i, sizes.length));
    const seedCount = new Array(sizes.length).fill(0);
    for (const s of seeds) { const node = this.nodeOf(s.x, s.z, s.y || 0); if (node >= 0 && label[node] >= 0) seedCount[label[node]]++; }
    let best = 0; for (let i = 1; i < sizes.length; i++) if (seedCount[i] > seedCount[best] || (seedCount[i] === seedCount[best] && sizes[i] > sizes[best])) best = i;
    if (sizes.length && sizes[best] < Math.max(...sizes) * 0.5) best = sizes.indexOf(Math.max(...sizes));
    for (let i = 0; i < N; i++) if (label[i] !== best) this.h[i] = NaN;
    this.walkable.length = 0;
    for (let i = 0; i < N; i++) if (!Number.isNaN(this.h[i])) this.walkable.push(i);
  }
  isWalkable(x, z, y = null) { const [cx, cz] = this.toCell(x, z); if (!this.inGrid(cx, cz)) return false; const node = this.nodeAt(cx, cz, y ?? 0); if (node < 0) return false; return y === null || Math.abs(this.h[node] - y) <= NAV_STEP; }
  heightAt(x, z, y = 0) { const node = this.nodeOf(x, z, y); return node < 0 ? NaN : this.h[node]; }
  nearestWalkable(x, z, maxR = 6, y = 0) {
    const [cx, cz] = this.toCell(x, z);
    for (let r = 0; r <= maxR; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const node = this.nodeAt(cx + dx, cz + dz, y); if (node >= 0) return this.nodeWorld(node);
    }
    return null;
  }
  randomPoint(rng) { return this.nodeWorld(this.walkable[Math.floor(rng.next() * this.walkable.length)]); }
  randomPointNear(rng, x, z, radius, tries = 12, y = 0) {
    for (let t = 0; t < tries; t++) { const a = rng.next() * Math.PI * 2, d = radius * Math.sqrt(rng.next()); const p = this.nearestWalkable(x + Math.cos(a) * d, z + Math.sin(a) * d, 1, y); if (p) return p; }
    return this.nearestWalkable(x, z, 6, y);
  }
  // A* from world a to world b (Vector3 with y); returns array of Vector3 (smoothed) or null
  path(a, b, maxNodes = 6000) {
    const si = this.nodeOf(a.x, a.z, a.y || 0), gi = this.nodeOf(b.x, b.z, b.y || 0);
    if (si < 0 || gi < 0) return null;
    const n = this.n; const gc = gi >> 1; const gx = gc % n, gz = Math.floor(gc / n);
    const g = new Map(); const came = new Map(); const closed = new Set(); const nb = [];
    const heap = new Heap(); g.set(si, 0); heap.push({ i: si, f: 0 });
    const hfn = (node) => { const c = node >> 1; const dx = Math.abs((c % n) - gx), dz = Math.abs(Math.floor(c / n) - gz); return (Math.max(dx, dz) + 0.41 * Math.min(dx, dz)) * this.cell; };
    let expanded = 0, found = false;
    while (heap.size) {
      const cur = heap.pop(); if (closed.has(cur.i)) continue; closed.add(cur.i);
      if (cur.i === gi) { found = true; break; }
      if (++expanded > maxNodes) break;
      const g0 = g.get(cur.i); const cc = cur.i >> 1; const cx = cc % n, cz = Math.floor(cc / n);
      for (const j of this.neighbors(cur.i, nb)) {
        if (closed.has(j)) continue; const jc = j >> 1; const jx = jc % n, jz = Math.floor(jc / n);
        const diag = jx !== cx && jz !== cz;
        const cost = (diag ? 1.414 : 1) * this.cell * (1 + (1 - this.open[j]) * 0.3) + Math.abs(this.h[j] - this.h[cur.i]) * 0.5;
        const ng = g0 + cost; if (ng < (g.get(j) ?? Infinity)) { g.set(j, ng); came.set(j, cur.i); heap.push({ i: j, f: ng + hfn(j) }); }
      }
    }
    if (!found) return null;
    const nodes = []; let c = gi; while (c !== undefined) { nodes.push(c); c = came.get(c); } nodes.reverse();
    const pts = nodes.map((i) => this.nodeWorld(i));
    pts[pts.length - 1].x = b.x; pts[pts.length - 1].z = b.z;
    return this._smooth(pts);
  }
  _smooth(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]]; let i = 0;
    while (i < pts.length - 1) {
      let j = Math.min(pts.length - 1, i + 12);
      for (; j > i + 1; j--) if (this._clear(pts[i], pts[j])) break;
      out.push(pts[j]); i = j;
    }
    return out;
  }
  _clear(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z); const steps = Math.ceil(d / (this.cell * 0.5));
    if (Math.abs(a.y - b.y) > STEP_HEIGHT) return false;
    for (let s = 1; s < steps; s++) { const t = s / steps; const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; const h = this.heightAt(x, z, a.y); if (Number.isNaN(h) || Math.abs(h - a.y) > STEP_HEIGHT) return false;
      const nx = -(b.z - a.z) / d * 0.5, nz = (b.x - a.x) / d * 0.5; if (!this.isWalkable(x + nx, z + nz, a.y) || !this.isWalkable(x - nx, z - nz, a.y)) return false; }
    return true;
  }
  // find a cover node near pos that has no LOS from threat (uses world raycasts)
  findCover(pos, threat, rng, radius = 14, tries = 24) {
    let best = null, bestScore = -Infinity;
    for (let t = 0; t < tries; t++) {
      const a = rng.next() * Math.PI * 2, d = 3 + rng.next() * radius; const x = pos.x + Math.cos(a) * d, z = pos.z + Math.sin(a) * d;
      const node = this.nodeOf(x, z, pos.y); if (node < 0) continue;
      const p = this.nodeWorld(node);
      const eye = p.clone().add(new THREE.Vector3(0, 1.5, 0)); const te = threat.clone().add(new THREE.Vector3(0, 1.5, 0));
      const hidden = !this.world.los(eye, te);
      const score = (hidden ? 10 : 0) + this.cover[node] * 4 - d * 0.2 + rng.next() - Math.abs(p.y - pos.y) * 0.5;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }
}
