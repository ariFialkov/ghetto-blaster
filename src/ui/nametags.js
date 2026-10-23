// Colour-coded gamertags above other players, projected from world space into the HUD layer.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _c = new THREE.Vector3();
export class NameTags {
  constructor(container) { this.el = container; this.tags = new Map(); }
  update(match) {
    const cam = match.camera, p = match.player, world = match.map.world; const W = window.innerWidth, H = window.innerHeight;
    const seen = new Set();
    for (const a of match.actors) {
      if (a === p || !a.alive || a.isDog || a.isSentry) continue;
      const friendly = match.sameTeam(a, p);
      _v.set(a.pos.x, a.pos.y + a.body.height + 0.22, a.pos.z);
      const dist = _v.distanceTo(cam.position);
      let show = dist < (friendly ? 90 : 55);
      if (show && !friendly) { a.chest(_c); show = world.los(cam.position, _c) || world.los(cam.position, _v); }
      if (!show) continue;
      const v = _v.clone().project(cam); if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.2 || v.y > 1.2) continue;
      let t = this.tags.get(a);
      if (!t) { t = document.createElement('div'); t.className = 'ntag'; t.textContent = a.name; this.el.appendChild(t); this.tags.set(a, t); }
      const cls = 'ntag ' + (friendly ? 'friend' : 'enemy'); if (t.className !== cls) t.className = cls;
      const scale = Math.max(0.55, Math.min(1.1, 1.25 - dist / 70));
      const alpha = friendly ? Math.max(0.35, Math.min(1, 1.3 - dist / 90)) : 1;
      t.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2 * W).toFixed(0)}px, ${((1 - v.y) / 2 * H).toFixed(0)}px) scale(${scale.toFixed(2)})`;
      t.style.opacity = alpha.toFixed(2);
      seen.add(a);
    }
    for (const [a, t] of this.tags) if (!seen.has(a)) { t.remove(); this.tags.delete(a); }
  }
  clear() { for (const t of this.tags.values()) t.remove(); this.tags.clear(); }
}
