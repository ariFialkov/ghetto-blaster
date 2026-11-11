// Split-screen pause: when either player pauses, the whole match freezes and each player gets their own pause
// panel over their half of the screen, driven by their own keys or controller (and the mouse). Each panel holds
// that player's loadout, streaks, look settings and controls; audio stays global and lives in the title settings.
// The match resumes once both players have hit RESUME.
import { WEAPONS } from '../game/weapons.js';
import { allLoadouts } from '../game/loadouts.js';
import { streaksForMap } from '../game/streaks.js';
import { PAD } from '../core/input.js';
import { controlRows } from './menu.js';
import { btn } from './padglyphs.js';
import { sfx } from '../audio/sfx.js';

const TIERS = [['starter', 'STARTER'], ['medium', 'MEDIUM'], ['powerful', 'POWERFUL']];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Turns a held D-pad / stick / arrow key into menu steps with auto-repeat. */
export class NavRepeat {
  constructor() { this.dir = null; this.t = 0; }
  step(dir, dt) {
    if (dir !== this.dir) { this.dir = dir; this.t = 0.38; return dir; }
    if (!dir) return null;
    this.t -= dt; if (this.t <= 0) { this.t = 0.11; return dir; }
    return null;
  }
}
/** Menu events from one controller: { dir, select, back, start }. */
export function padNav(rep, just, held, axes, dt) {
  let d = null;
  if (held[PAD.UP] || axes[1] < -0.55) d = 'up'; else if (held[PAD.DOWN] || axes[1] > 0.55) d = 'down';
  else if (held[PAD.LEFT] || axes[0] < -0.55) d = 'left'; else if (held[PAD.RIGHT] || axes[0] > 0.55) d = 'right';
  return { dir: rep.step(d, dt), select: just.has(PAD.A), back: just.has(PAD.B), start: just.has(PAD.START) };
}

export class SplitPause {
  /**
   * root: the player's HUD element. o: { slot: 1 | 2, device: 'kbm' | 'keys' | 'pad', padType(), mapId, gunGame,
   *   settings(), onSettings(s), pick(), onPick(pick), onQuit() }
   */
  constructor(root, o) {
    this.o = o; this.ready = false; this.changed = false;
    this.el = document.createElement('div'); this.el.className = `sp-panel p${o.slot}`; root.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.page = 'main'; this.focus = 0; this.render();
  }
  dispose() { this.el.remove(); }
  // ---------------- pages ----------------
  rows() {
    const o = this.o, s = o.settings(), P = this.page;
    if (P === 'main') {
      const r = [{ id: 'resume', label: this.ready ? 'READY' : 'RESUME', cls: 'primary' }];
      if (!o.gunGame) r.push({ id: 'loadout', label: 'LOADOUT', sub: this.loadoutName() });
      r.push({ id: 'streaks', label: 'SCORE STREAKS' }, { id: 'settings', label: 'SETTINGS' }, { id: 'controls', label: 'CONTROLS' }, { id: 'quit', label: 'QUIT MATCH', cls: 'danger' });
      return r;
    }
    if (P === 'quit') return [{ id: 'quit-no', label: 'NO, KEEP PLAYING', cls: 'primary' }, { id: 'quit-yes', label: 'YES, QUIT FOR BOTH', cls: 'danger' }];
    if (P === 'loadout') {
      const cur = o.pick().loadoutId;
      return allLoadouts().filter((l) => !l.empty).map((l) => ({ id: 'lo:' + l.id, label: l.name, sub: `${WEAPONS[l.primary]?.name || ''} · ${WEAPONS[l.secondary]?.name || ''}`, on: l.id === cur }));
    }
    if (P === 'streaks') {
      const all = streaksForMap(o.mapId), picks = this.streakIds();
      return TIERS.map(([k, name], i) => { const d = all[k].find((x) => x.id === picks[i]) || all[k][0]; return { id: 'st:' + i, label: name, value: `${d.name} · ${d.cost}`, cycle: true, sub: d.desc }; });
    }
    if (P === 'settings') {
      const dev = o.device, r = [];
      if (dev === 'kbm') r.push({ id: 'sensitivity', label: 'MOUSE SENSITIVITY', value: s.sensitivity.toFixed(2), cycle: true });
      else r.push({ id: 'padSensitivity', label: dev === 'keys' ? 'LOOK SPEED' : 'CONTROLLER SENSITIVITY', value: (s.padSensitivity ?? 1).toFixed(2), cycle: true });
      r.push({ id: 'fov', label: 'FIELD OF VIEW', value: String(s.fov), cycle: true });
      r.push({ id: 'invertY', label: 'INVERT LOOK', value: s.invertY ? 'ON' : 'OFF', cycle: true });
      r.push({ id: 'adsHold', label: 'AIM DOWN SIGHTS', value: s.adsHold ? 'HOLD' : 'TOGGLE', cycle: true });
      if (dev !== 'kbm') r.push({ id: 'aimAssist', label: 'AIM ASSIST', value: s.aimAssist !== false ? 'ON' : 'OFF', cycle: true });
      if (dev === 'pad') r.push({ id: 'vibration', label: 'VIBRATION', value: s.vibration !== false ? 'ON' : 'OFF', cycle: true });
      return r;
    }
    return []; // controls: a read-only table
  }
  loadoutName() { const l = allLoadouts().find((x) => x.id === this.o.pick().loadoutId); return l ? l.name : ''; }
  streakIds() {
    const all = streaksForMap(this.o.mapId), p = this.o.pick().streaks || [];
    return TIERS.map(([k], i) => p[i] || all[k][0].id);
  }
  title() { return { main: 'PAUSED', loadout: 'LOADOUT', streaks: 'SCORE STREAKS', settings: 'SETTINGS', controls: 'CONTROLS', quit: 'QUIT MATCH?' }[this.page]; }
  hint() {
    const o = this.o, d = o.device;
    if (d === 'pad') { const g = (n) => btn(o.padType(), n); return `${g('A')} SELECT · ${g('B')} BACK${this.page === 'main' ? ` · ${g('START')} RESUME` : ''}`; }
    if (d === 'keys') return '<kbd>↑</kbd><kbd>↓</kbd> MOVE · <kbd>ENTER</kbd> SELECT · <kbd>⌫</kbd> BACK';
    return '<kbd>W</kbd><kbd>S</kbd> MOVE · <kbd>SPACE</kbd> SELECT · <kbd>ESC</kbd> BACK';
  }
  render() {
    const o = this.o, rows = this.rows(); this.focus = Math.max(0, Math.min(this.focus, rows.length - 1));
    let body;
    if (this.page === 'controls') {
      const kind = o.device === 'pad' ? 'pad' : o.device === 'keys' ? 'p2' : 'kb';
      body = `<div class="sp-controls">${controlRows(kind, o.padType()).map(([a, b]) => `<div class="sp-crow"><span>${a}</span><span>${b}</span></div>`).join('')}</div>`;
    } else {
      body = `<div class="sp-rows">${rows.map((r, i) => `<div class="sp-row ${r.cls || ''} ${r.on ? 'on' : ''} ${i === this.focus ? 'focus' : ''}" data-i="${i}">
        <div class="sp-l"><b>${esc(r.label)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</div>
        ${r.cycle ? `<div class="sp-v"><button data-d="-1" aria-label="previous">◀</button><span>${esc(r.value)}</span><button data-d="1" aria-label="next">▶</button></div>` : r.on ? '<div class="sp-v"><span class="sp-eq">EQUIPPED</span></div>' : ''}</div>`).join('')}</div>`;
    }
    const other = o.slot === 1 ? 'P2' : 'P1';
    const status = this.ready ? `<div class="sp-wait">READY · WAITING FOR ${other}</div>` : '';
    this.el.innerHTML = `<div class="sp-head"><span class="sp-tag p${o.slot}">P${o.slot}</span><h2>${this.title()}</h2></div>${status}${body}
      ${this.page !== 'main' ? '<button class="sp-back">◀ BACK</button>' : ''}<div class="sp-hint">${this.hint()}</div>`;
    this.el.classList.toggle('ready', this.ready);
    // mouse
    this.el.querySelectorAll('.sp-row').forEach((row) => {
      const i = +row.dataset.i;
      row.onmouseenter = () => { if (this.focus !== i) { this.focus = i; this.markFocus(); } };
      row.onclick = (e) => { const b = e.target.closest('button[data-d]'); this.focus = i; if (b) this.adjust(+b.dataset.d); else this.activate(); };
    });
    const back = this.el.querySelector('.sp-back'); if (back) back.onclick = () => this.back();
  }
  markFocus() { this.el.querySelectorAll('.sp-row').forEach((r) => r.classList.toggle('focus', +r.dataset.i === this.focus)); const f = this.el.querySelector('.sp-row.focus'); if (f) try { f.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }
  go(page) { this.page = page; this.focus = 0; if (page === 'loadout') this.focus = Math.max(0, this.rows().findIndex((r) => r.on)); sfx('click'); this.render(); }
  back() {
    if (this.page === 'main') { this.setReady(!this.ready); return; }
    const from = this.page; this.page = 'main'; sfx('click');
    this.focus = Math.max(0, this.rows().findIndex((r) => r.id === from)); this.render();
  }
  setReady(on) { this.ready = on; sfx(on ? 'beep' : 'click', on ? { freq: 880 } : undefined); this.focus = 0; this.render(); }
  // ---------------- actions ----------------
  activate() {
    const rows = this.rows(), r = rows[this.focus]; if (!r) { if (this.page === 'controls') this.back(); return; }
    if (this.page === 'main') {
      if (r.id === 'resume') this.setReady(!this.ready);
      else { if (this.ready) this.ready = false; this.go(r.id); }
      return;
    }
    if (this.page === 'quit') { if (r.id === 'quit-yes') { sfx('click'); this.o.onQuit(); } else this.back(); return; }
    if (this.page === 'loadout') {
      const id = r.id.slice(3), p = this.o.pick();
      if (id !== p.loadoutId) { this.o.onPick({ loadoutId: id, streaks: this.streakIds() }); this.changed = true; }
      sfx('click'); this.back(); return;
    }
    if (r.cycle) this.adjust(1);
  }
  adjust(d) {
    const r = this.rows()[this.focus]; if (!r || !r.cycle) return;
    if (this.page === 'streaks') {
      const i = +r.id.slice(3), all = streaksForMap(this.o.mapId)[TIERS[i][0]], ids = this.streakIds();
      const k = all.findIndex((x) => x.id === ids[i]); ids[i] = all[(k + d + all.length) % all.length].id;
      this.o.onPick({ loadoutId: this.o.pick().loadoutId, streaks: ids }); this.changed = true;
    } else {
      const s = { ...this.o.settings() }, k = r.id;
      if (k === 'sensitivity') s.sensitivity = Math.round(Math.min(3, Math.max(0.2, s.sensitivity + d * 0.05)) * 100) / 100;
      else if (k === 'padSensitivity') s.padSensitivity = Math.round(Math.min(2.5, Math.max(0.3, (s.padSensitivity ?? 1) + d * 0.05)) * 100) / 100;
      else if (k === 'fov') s.fov = Math.min(100, Math.max(60, s.fov + d * 5));
      else if (k === 'aimAssist' || k === 'vibration') s[k] = s[k] === false;
      else s[k] = !s[k];
      this.o.onSettings(s);
    }
    sfx('click', { vol: 0.4 }); this.render();
  }
  /** One frame of this player's menu input: { dir, select, back, start }. */
  handle(ev) {
    if (!ev) return;
    const n = this.rows().length;
    if (ev.start) { if (this.page !== 'main') { this.page = 'main'; this.focus = 0; } this.setReady(!this.ready); return; }
    if (ev.back) { this.back(); return; }
    if (ev.select) { this.activate(); return; }
    if (ev.dir === 'up' || ev.dir === 'down') {
      if (this.page === 'controls') { const c = this.el.querySelector('.sp-controls'); if (c) c.scrollTop += ev.dir === 'down' ? 40 : -40; return; }
      if (n) { this.focus = (this.focus + (ev.dir === 'down' ? 1 : -1) + n) % n; sfx('click', { vol: 0.25 }); this.markFocus(); }
    } else if (ev.dir === 'left' || ev.dir === 'right') this.adjust(ev.dir === 'right' ? 1 : -1);
  }
}
