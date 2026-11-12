// Ghetto Blaster — app state machine: title (cinematic) -> modes -> lobby -> match -> results.
import * as THREE from 'three';
import '@fontsource/anton/400.css';
import { Engine } from './core/engine.js';
import { Input, splitAssignment } from './core/input.js';
import { RNG, hashString, damp } from './core/rng.js';
import { initAudio, setVolume, sfx } from './audio/sfx.js';
import { MAPS, loadMap } from './maps/index.js';
import { Match } from './game/match.js';
import { MODES } from './game/modes.js';
import { getSave, persist, allLoadouts, resolveLoadout } from './game/loadouts.js';
import { findStreak, streaksForMap } from './game/streaks.js';
import { HUD } from './ui/hud.js';
import * as UI from './ui/menu.js';
import { PadNav } from './ui/padnav.js';
import { loadModels } from './game/models.js';
import { btn, padLabel } from './ui/padglyphs.js';
import { SplitPause, SplitLoadout, NavRepeat, padNav as padMenuEv } from './ui/splitpause.js';

const $ = (id) => document.getElementById(id);
const canvas = $('gl');
const engine = new Engine(canvas);
const input = new Input(canvas);
const HUD_TEMPLATE = $('hud').cloneNode(true); // pristine copy for player 2's HUD in split screen
const hud = new HUD();
let hud2 = null;
/** Player 2's HUD: a copy of the HUD over the right half of the screen. */
function makeHud2() {
  const c = HUD_TEMPLATE.cloneNode(true); c.id = 'hud2'; c.classList.add('hidden');
  c.querySelectorAll('#mobile-controls').forEach((e) => e.remove());
  $('hud').parentNode.insertBefore(c, $('hud').nextSibling); return new HUD(c, false);
}
UI.setEngine(engine);
const padNav = new PadNav(input);
const save = getSave();
let settings = save.settings;
// player 2's own look settings in split screen (audio and graphics stay shared)
if (!save.settings2) save.settings2 = { sensitivity: 1, padSensitivity: settings.padSensitivity ?? 1, aimAssist: true, vibration: true, invertY: false, adsHold: true, fov: settings.fov || 75 };
const params = new URLSearchParams(location.search);
const DEBUG_TIME = params.has('t') ? Math.max(20, +params.get('t')) : 0; // ?t=60 shortens matches for testing
const FORCE_MAP = MAPS.some((m) => m.id === params.get('map')) ? params.get('map') : null; // ?map=kowloon
const app = { state: 'boot', mapData: null, mapId: null, match: null, cin: null, mode: null, bet: 0, pick: null, lobbyTimers: [] };
// 2-player split screen (desktop only), remembered between sessions
const splitOn = () => !input.mobile && !!save.split && !!splitAssignment(); // needs at least one controller
if (input.mobile) document.body.classList.add('mobile');

// ---------------- PWA ----------------
if ('serviceWorker' in navigator && location.protocol !== 'file:') { window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {})); }
function updateRotateHint() { const portrait = window.innerHeight > window.innerWidth; $('rotate-hint').classList.toggle('hidden', !(input.mobile && portrait)); }
window.addEventListener('resize', updateRotateHint); updateRotateHint();

function applySettings(s) {
  settings = s; save.settings = s; persist();
  input.sensitivity = s.sensitivity; input.touchSensitivity = s.touchSensitivity; input.invertY = s.invertY; input.adsHold = s.adsHold;
  input.padSensitivity = s.padSensitivity ?? 1; input.vibration = s.vibration !== false;
  setVolume(s.volume); engine.setQuality(s.quality);
  if (app.match && app.match.player) { app.match.player.fov = s.fov; app.match.player.sensitivity = 1; app.match.player.settings = s; }
}
function applySettings2(s) {
  save.settings2 = s; persist();
  if (input.second) input.second.opts = s;
  const p2 = app.match && app.match.player2; if (p2) { p2.settings = s; p2.fov = s.fov; }
}
applySettings(settings);

// ---------------- app state ----------------
const mapCache = new Map();
async function getMap(id) {
  if (mapCache.has(id)) return mapCache.get(id);
  const { def, build } = await loadMap(id); const data = build(); data.def = def; mapCache.set(id, data); return data;
}
function clearSceneMatch() { if (app.match) { app.match.dispose(); app.match = null; } }

// ---------------- title / cinematic ----------------
let cinIndex = 0, cinT = 0, cinFrom = null, cinTo = null;
async function enterTitle(mapId = null) {
  app.state = 'title'; input.setEnabled(false); input.releaseLock(); hud.hide(); engine.start();
  clearSceneMatch();
  const rng = new RNG(Date.now() & 0xffff);
  app.mapId = FORCE_MAP || mapId || rng.pick(MAPS).id;
  app.mapData = await getMap(app.mapId);
  engine.setEnvironment(app.mapData.def.env); engine.setMapLights(app.mapData.lights);
  app.match = new Match({ engine, input, map: app.mapData, mode: MODES.tdm, settings, seed: rng.int(1, 1e9), loadout: null, mapId: app.mapId, cinematic: true });
  app.match.goLive();
  engine.warmup();
  cinIndex = 0; cinT = 0; setupCinematicShot();
  UI.showTitle(app.mapData.def.name, save.wallet);
  engine.start();
}
function setupCinematicShot() {
  const pts = app.mapData.cinematicPoints.length ? app.mapData.cinematicPoints : [{ x: 40, y: 20, z: 40, lookX: 0, lookZ: 0 }];
  const p = pts[cinIndex % pts.length]; cinFrom = p; cinTo = pts[(cinIndex + 1) % pts.length]; cinT = 0;
}
function updateCinematic(dt) {
  const cam = engine.camera; cinT += dt; const dur = 9;
  const k = Math.min(1, cinT / dur); const e = k * k * (3 - 2 * k);
  const ang = cinT * 0.12;
  // orbit around the look-at point, drifting between shots
  const lx = cinFrom.lookX + (cinTo.lookX - cinFrom.lookX) * e, lz = cinFrom.lookZ + (cinTo.lookZ - cinFrom.lookZ) * e;
  const r = Math.hypot(cinFrom.x - cinFrom.lookX, cinFrom.z - cinFrom.lookZ); const a0 = Math.atan2(cinFrom.x - cinFrom.lookX, cinFrom.z - cinFrom.lookZ);
  const y = cinFrom.y + (cinTo.y - cinFrom.y) * e;
  cam.position.set(lx + Math.sin(a0 + ang) * r, y, lz + Math.cos(a0 + ang) * r);
  cam.lookAt(lx, 2, lz); if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); }
  engine.updateSunTarget(new THREE.Vector3(lx, 0, lz));
  if (cinT >= dur) { cinIndex++; setupCinematicShot(); }
}
// illustrated 2D card art for the mode panels (public/ui), in MODES order: TDM, FFA, Gun Game
const MODE_ARTS = ['./ui/mode-tdm.jpg', './ui/mode-ffa.jpg', './ui/mode-gungame.jpg'];
for (const src of MODE_ARTS) { const im = new Image(); im.src = src; } // warm the cache so the cards don't pop in

// ---------------- modes ----------------
function enterModes() {
  app.state = 'modes'; initAudio(); sfx('ui');
  UI.showModes(MODE_ARTS, save.wallet, (mode) => enterLobby(mode));
  if (!input.mobile) UI.playersToggle(save.split ? 2 : 1, (n) => { save.split = n === 2; persist(); sfx('click'); }, splitAssignment);
}

// ---------------- lobby ----------------
async function enterLobby(mode) {
  app.state = 'lobby'; app.mode = mode; UI.hideModes();
  const rng = new RNG(Date.now() & 0xfffff);
  const mapId = FORCE_MAP || rng.pick(MAPS).id; app.mapId = mapId;
  const { def } = await loadMap(mapId);
  UI.showLobby(mode, def, save.wallet, (b) => { app.bet = b; });
  $('lobby-cancel').onclick = () => { app.lobbyTimers.forEach(clearTimeout); app.lobbyTimers = []; sfx('click'); enterTitle(app.mapId); };
  const seed = rng.int(1, 1e9); app.seed = seed;
  // pre-build the map and the match (bots) now so the player list is real
  const mapData = await getMap(mapId);
  const loadout = allLoadouts().find((l) => l.id === (save.lastLoadout || 'runner') && !l.empty) || allLoadouts()[0];
  app.pick = { loadoutId: loadout.id, streaks: null };
  engine.setEnvironment(def.env); engine.setMapLights(mapData.lights);
  clearSceneMatch();
  const name = (settings.name || 'YOU').toUpperCase();
  const modeDef = DEBUG_TIME ? { ...mode, timeLimit: DEBUG_TIME } : mode;
  // split screen: who plays with what is decided now (two controllers = one each, one = player 2's, none = keyboard)
  const split = splitOn() ? splitAssignment() : null; const input2 = input.setSplit(split, save.settings2);
  app.match = new Match({ engine, input, map: mapData, mode: modeDef, settings, seed, loadout, mapId, bet: app.bet, playerName: name, split: input2 ? { input: input2 } : null });
  const m = app.match; engine.warmup();
  if (m.player2) { // player 2: own settings and own saved loadout / streak picks
    m.player.settings = settings; m.player2.settings = save.settings2; m.player2.fov = save.settings2.fov;
    const sv = save.pick2 || {}, lo = allLoadouts().find((l) => l.id === sv.loadoutId && !l.empty), ids = sv.streaks && sv.streaks[mapId];
    app.pick2 = { loadoutId: lo ? lo.id : null, streaks: ids || null };
    m.p2Pick = { loadout: lo ? resolveLoadout(lo) : null, streaks: ids ? ids.map((id) => findStreak(mapId, id)) : null };
  }
  const total = m.actors.length; const list = m.actors.slice();
  const t = (ms, fn) => app.lobbyTimers.push(setTimeout(fn, ms));
  const t1 = 1600 + rng.int(0, 1200), t2 = t1 + 1800 + rng.int(0, 1200);
  const humans = m.players.length;
  if (m.player2) UI.lobbyStatus(`2 PLAYERS · P2 ON ${m.player2.input.label}`);
  t(t1, () => { UI.lobbyStatus(m.player2 ? `FINDING PLAYERS · P2 ON ${m.player2.input.label}` : 'FINDING PLAYERS'); UI.lobbySlots(mode, list.slice(0, humans), total); sfx('beep', { freq: 660 }); });
  for (let i = humans; i < total; i++) t(t1 + 250 + ((t2 - t1 - 400) * i) / total, () => { UI.lobbySlots(mode, list.slice(0, i + 1), total); sfx('click', { vol: 0.5 }); });
  t(t2 + 300, () => { UI.lobbyStatus('STARTING MATCH'); sfx('beep', { freq: 880 }); });
  t(t2 + 1300, () => startMatch());
}

// ---------------- match ----------------
function startMatch() {
  app.state = 'match'; const m = app.match; m.bet = app.bet;
  if (app.bet > 0) { save.wallet -= app.bet; save.stats.bets++; persist(); }
  UI.hideAll();
  hud.bind(m, { onOpenLoadout: () => openLoadout(), onScoreboard: (on) => (on ? UI.showScoreboard(m, quitMatch) : UI.hideScoreboard()), onPause: () => pauseMatch() });
  document.body.classList.toggle('split', !!m.player2);
  if (m.player2) { hud2 = hud2 || makeHud2(); hud2.bind(m, {}, m.player2); }
  m.events.live = () => { UI.hideLoadoutSelector(); if (sp.open && sp.kind === 'loadout') closeSplitPanels(); if (!input.mobile && !input.locked && !(input.split && input.split.mode === 'pad2')) input.requestLock(); };
  m.events.end = (res) => endMatch(res);
  input.setEnabled(true);
  if (m.player2) openSplitLoadout(); else openLoadout();
  // pointer lock loss during a live desktop match = pause
  document.addEventListener('pointerlockchange', onLockChange);
}
function onLockChange() { if (sp.open) return; if (app.state === 'match' && !document.pointerLockElement && !input.mobile && app.match && app.match.state === 'live' && $('screen-loadout').classList.contains('hidden') && $('screen-dialog').classList.contains('hidden')) pauseMatch(); }
function openLoadout(midMatch = false) {
  const m = app.match; if (!m || m.state === 'ended' || (m.player2 && sp.open)) return; // split screen: each player has their own panel
  input.releaseLock();
  const gunGame = m.mode.id === 'gungame';
  const before = { loadout: m.player.nextLoadout?.id || m.player.loadout.id, streaks: (m.player.nextStreaks || m.streakState.picks).map((d) => d && d.id).join() };
  app.midLoadout = midMatch;
  UI.showLoadoutSelector(app.mapId, app.pick, (pick) => { app.pick = pick; applyPick(); }, () => {
    if (midMatch) {
      app.midLoadout = false; input.setEnabled(true);
      const changed = (!gunGame && app.pick.loadoutId !== before.loadout) || (app.pick.streaks || []).join() !== before.streaks;
      if (changed && m.player.alive) hud.message('CHANGES APPLY ON NEXT SPAWN', 2.2);
    }
    if (!input.mobile) input.requestLock();
  }, { gunGame });
  if (midMatch) $('loadout-timer').textContent = m.player.alive ? 'APPLIES ON NEXT SPAWN' : 'APPLIES ON RESPAWN';
}
function applyPick() {
  const m = app.match; if (!m) return;
  const pregame = m.state === 'pregame';
  if (m.mode.id !== 'gungame') { // gun game never takes a loadout
    const lo = allLoadouts().find((l) => l.id === app.pick.loadoutId) || allLoadouts()[0];
    const r = resolveLoadout(lo);
    if (pregame) m.player.setLoadout(r); else m.player.nextLoadout = r.id === m.player.loadout.id ? null : r;
  }
  const streaks = (app.pick.streaks || []).map((id) => findStreak(app.mapId, id));
  if (pregame) { m.streakState.picks = streaks; hud.renderStreaks(true); }
  else m.player.nextStreaks = streaks.every((d, i) => d === m.streakState.picks[i]) ? null : streaks;
}
function pauseMatch() {
  if (app.state !== 'match' || !app.match || app.match.state === 'ended') return;
  if (app.match.player2) { openSplitPause(); return; }
  if (!$('screen-dialog').classList.contains('hidden')) return;
  input.setEnabled(false); input.releaseLock(); // free the mouse so the pause menu can be clicked however the pause was triggered
  const resume = () => { UI.closeDialog(); input.setEnabled(true); if (!input.mobile) input.requestLock(); };
  const openPause = () => {
    UI.openDialog('PAUSED', `<div class="pause-menu"><button class="menu-btn primary" id="p-resume">RESUME</button>${app.match.mode.id === 'gungame' ? '' : '<button class="menu-btn" id="p-loadout">LOADOUT</button>'}<button class="menu-btn" id="p-controls">CONTROLS</button><button class="menu-btn" id="p-settings">SETTINGS</button><button class="menu-btn danger" id="p-quit">QUIT MATCH</button></div>`, resume);
    $('p-resume').onclick = resume;
    if ($('p-loadout')) $('p-loadout').onclick = () => { sfx('click'); UI.closeDialog(); openLoadout(true); };
    $('p-controls').onclick = () => { sfx('click'); UI.openControls(input.mobile, openPause, input); };
    $('p-settings').onclick = () => { sfx('click'); UI.openSettings(settings, (s2) => { applySettings(s2); }); $('dialog-close').onclick = () => { sfx('click'); applySettings(settings); openPause(); }; };
    $('p-quit').onclick = () => { UI.closeDialog(); quitMatch(); };
  };
  openPause();
}
// ---------------- split-screen pause: the match freezes, each player gets their own panel ----------------
const sp = { open: false, kind: null, panels: [], reps: [new NavRepeat(), new NavRepeat()] };
const splitDevice = (slot) => { const mode = input.split ? input.split.mode : 'kbd'; return slot === 1 ? (mode === 'pad2' ? 'pad' : 'kbm') : (mode === 'kbd' ? 'keys' : 'pad'); };
const pickIds = (st) => st.picks.map((d) => d && d.id);
function openSplitPause() {
  const m = app.match; if (sp.open || !m || m.state !== 'live') return; // pre-game: the loadout screen is up
  sp.open = true; sp.kind = 'pause'; input.setEnabled(false); input.releaseLock(); input.menuKeys.length = 0; UI.hideScoreboard();
  const gunGame = m.mode.id === 'gungame';
  const p1 = { slot: 1, settings: () => settings, onSettings: (s) => applySettings(s), pick: pick1, onPick: onPick1 };
  const p2 = { slot: 2, settings: () => save.settings2, onSettings: (s) => applySettings2(s),
    pick: () => ({ loadoutId: app.pick2.loadoutId || (m.player2.nextLoadout || m.player2.loadout).id, streaks: app.pick2.streaks || pickIds(m.player2.streakState || m.streakState) }),
    onPick: (p) => applyPick2(p) };
  const mk = (o, h) => new SplitPause(h.el, { ...o, device: splitDevice(o.slot), padType: () => (o.slot === 1 ? input.padType : input.second.padType), mapId: app.mapId, gunGame, onQuit: () => { closeSplitPause(false); quitMatch(); } });
  sp.panels = [mk(p1, hud), mk(p2, hud2)];
  sfx('click');
}
const pick1 = () => ({ loadoutId: app.pick.loadoutId, streaks: app.pick.streaks || pickIds(app.match.streakState) });
function onPick1(p) { app.pick = p; save.lastLoadout = p.loadoutId; save.lastStreaks = save.lastStreaks || {}; save.lastStreaks[app.mapId] = p.streaks.slice(); persist(); applyPick(); }
/** Split screen pre-game: a loadout panel per player instead of the one full-screen selector. The countdown runs a
 *  little longer for two players and cuts short once both are ready. */
function openSplitLoadout() {
  const m = app.match; if (!m || !m.player2 || sp.open) return;
  sp.open = true; sp.kind = 'loadout'; input.setEnabled(false); input.releaseLock(); input.menuKeys.length = 0;
  m.pregameT = Math.max(m.pregameT, 15);
  const gunGame = m.mode.id === 'gungame', all = streaksForMap(app.mapId);
  // player 1 starts on their last picks; player 2 on theirs (or player 1's until they choose)
  onPick1({ loadoutId: app.pick.loadoutId, streaks: (save.lastStreaks && save.lastStreaks[app.mapId]) || [all.starter[0].id, all.medium[0].id, all.powerful[0].id] });
  const pick2 = () => ({ loadoutId: app.pick2.loadoutId || app.pick.loadoutId, streaks: app.pick2.streaks || app.pick.streaks });
  const onReady = () => { if (sp.panels.length === 2 && sp.panels.every((p) => p.ready)) m.pregameT = Math.min(m.pregameT, 0.8); };
  const mk = (slot, h, pick, onPick) => new SplitLoadout(h.el, { slot, device: splitDevice(slot), padType: () => (slot === 1 ? input.padType : input.second.padType), mapId: app.mapId, gunGame, pick, onPick, onReady });
  sp.panels = [
    mk(1, hud, pick1, (p) => { onPick1(p); if (!app.pick2.loadoutId && sp.panels[1]) sp.panels[1].render(); }),
    mk(2, hud2, pick2, (p) => applyPick2(p)),
  ];
}
function applyPick2(p) {
  const m = app.match, p2 = m && m.player2; if (!p2) return;
  app.pick2 = { loadoutId: p.loadoutId, streaks: p.streaks.slice() };
  save.pick2 = { loadoutId: p.loadoutId, streaks: { ...((save.pick2 && save.pick2.streaks) || {}), [app.mapId]: p.streaks.slice() } }; persist();
  if (m.state === 'pregame') { // before the start: what player 2 goes in with (see Match.goLive)
    const lo = allLoadouts().find((l) => l.id === p.loadoutId && !l.empty), r = lo ? resolveLoadout(lo) : null;
    m.p2Pick = { loadout: r, streaks: p.streaks.map((id) => findStreak(app.mapId, id)) };
    if (r && m.mode.id !== 'gungame') p2.setLoadout(r);
    return;
  }
  if (m.mode.id !== 'gungame') {
    const lo = allLoadouts().find((l) => l.id === p.loadoutId && !l.empty);
    if (lo) { const r = resolveLoadout(lo); p2.nextLoadout = r.id === p2.loadout.id ? null : r; }
  }
  const st = p2.streakState || m.streakState, defs = p.streaks.map((id) => findStreak(app.mapId, id));
  p2.nextStreaks = defs.every((d, i) => d === st.picks[i]) ? null : defs;
}
function closeSplitPanels() {
  sp.panels.forEach((p) => p.dispose()); sp.panels = []; sp.open = false; sp.kind = null; input.menuKeys.length = 0; input.setEnabled(true);
}
function closeSplitPause(resume = true) {
  if (!sp.open) return;
  const kind = sp.kind, changed = sp.panels.map((p) => p.changed); sp.panels.forEach((p) => p.dispose()); sp.panels = []; sp.open = false; sp.kind = null; input.menuKeys.length = 0;
  if (!resume || kind !== 'pause') return;
  input.setEnabled(true); if (input.split && input.split.mode !== 'pad2') input.requestLock();
  const m = app.match; [m.player, m.player2].forEach((p, i) => { if (changed[i] && p && p.alive) (i ? hud2 : hud).message('CHANGES APPLY ON NEXT SPAWN', 2.2); });
  sfx('beep', { freq: 990 });
}
/** Each player drives their own panel: player 1 on W/S/A/D, Space, Esc (or their controller with two pads), player 2 on
 *  the arrows, Enter, Backspace (or their controller). Both can use the mouse. */
function updateSplitPause(dt) {
  const mode = input.split ? input.split.mode : 'kbd', shared = mode === 'kbd';
  // keyboard: every press in order (a slow frame can hold several)
  const P1K = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', Space: 'select', Escape: 'back' };
  const P2K = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'select', NumpadEnter: 'select', ShiftRight: 'select', Backspace: 'back', Slash: 'back' };
  if (!shared) Object.assign(P1K, { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'select', NumpadEnter: 'select', Backspace: 'back' });
  const toEv = (a) => (a === 'select' || a === 'back' ? { [a]: true } : { dir: a });
  const keys = input.menuKeys.splice(0);
  for (const code of keys) {
    if (!sp.open) break;
    if (P1K[code]) sp.panels[0].handle(toEv(P1K[code])); else if (shared && P2K[code]) sp.panels[1].handle(toEv(P2K[code]));
  }
  // controllers
  if (sp.open && mode === 'pad2' && input.pad) sp.panels[0].handle(padMenuEv(sp.reps[0], input.padJust, input.padPrev, input.padAxes, dt));
  if (sp.open && !shared && input.second && input.second.padState.gp) { const ps = input.second.padState; sp.panels[1].handle(padMenuEv(sp.reps[1], ps.just, ps.prev, ps.axes, dt)); }
  if (sp.open && sp.kind === 'pause' && sp.panels.every((p) => p.ready)) closeSplitPause(true);
  if (sp.open && sp.kind === 'loadout') for (const p of sp.panels) p.setTimer(app.match.pregameT);
}
function leaveSplit() { closeSplitPause(false); if (hud2) hud2.hide(); document.body.classList.remove('split'); input.setSplit(null); }
function quitMatch() { document.removeEventListener('pointerlockchange', onLockChange); UI.hideScoreboard(); hud.hide(); leaveSplit(); input.setEnabled(false); enterTitle(app.mapId); }
function endMatch(res) {
  document.removeEventListener('pointerlockchange', onLockChange);
  app.state = 'results'; input.setEnabled(false); input.releaseLock(); UI.hideScoreboard(); hud.hide(); leaveSplit();
  const m = app.match; const p = m.player; const mode = m.mode;
  let payout = 0; const betWon = mode.teams ? res.win : res.top3;
  if (m.bet > 0 && betWon) { payout = Math.round(m.bet * mode.bet.odds); save.wallet += payout; save.stats.won += payout; }
  if (save.wallet < 100) save.wallet = 100; // the house fronts you a new stack
  save.stats.matches++; if (res.win) save.stats.wins++; save.stats.kills += p.kills; save.stats.deaths += p.deaths; save.stats.bestStreak = Math.max(save.stats.bestStreak, p.bestStreak); persist();
  sfx(res.win ? 'streak' : 'bass');
  UI.showResults(res, m, payout, save.wallet, () => enterLobby(mode), () => enterTitle(app.mapId));
}

// ---------------- frame ----------------
engine.onFrame = (dt) => {
  input.updatePad(dt); padNav.update(dt);
  if (app.state === 'title' || app.state === 'modes') { if (app.match) { app.match.update(dt); updateCinematic(dt); } return; }
  if (app.state === 'lobby') { if (app.match) { updateCinematicLobby(dt); } return; }
  if (app.state === 'match' || app.state === 'results') {
    const m = app.match; if (!m) return;
    if (app.state === 'match' && sp.open) { updateSplitPause(dt); if (sp.kind === 'pause') return; }
    if (app.state === 'match' && (!$('screen-dialog').classList.contains('hidden') || app.midLoadout)) { /* paused (menu or mid-match loadout): freeze */ return; }
    m.update(dt);
    if (app.state === 'match') { hud.update(dt); if (m.player2 && hud2) hud2.update(dt); if (m.state === 'pregame') UI.loadoutTimer(m.pregameT); }
  }
};
function updateCinematicLobby(dt) { const cam = engine.camera; const pts = app.match.map.cinematicPoints; const p = pts[0] || { x: 40, y: 20, z: 40, lookX: 0, lookZ: 0 }; const t = performance.now() / 1000; const r = Math.hypot(p.x - p.lookX, p.z - p.lookZ); cam.position.set(p.lookX + Math.sin(t * 0.1) * r, p.y, p.lookZ + Math.cos(t * 0.1) * r); cam.lookAt(p.lookX, 2, p.lookZ); }

// ---------------- title interactions ----------------
$('screen-title').addEventListener('click', (e) => { if (e.target.closest('button')) return; if (app.state !== 'title') return; enterModes(); });
$('screen-title').querySelectorAll('[data-open]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); initAudio(); sfx('click'); const k = b.dataset.open; if (k === 'controls') UI.openControls(input.mobile, null, input); else if (k === 'settings') UI.openSettings(settings, applySettings); else UI.openLoadoutEditor(); }; });
document.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => { sfx('click'); UI.hideModes(); UI.showTitle(app.mapData.def.name, save.wallet); app.state = 'title'; }; });
window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && app.state === 'modes') { UI.hideModes(); UI.showTitle(app.mapData.def.name, save.wallet); app.state = 'title'; } });
// controller prompts and connection toast
function updatePadPrompts() { $('title-cta').innerHTML = input.padActive ? `PRESS ${btn(input.padType, 'A')} TO PLAY` : (input.mobile ? 'TAP ANYWHERE TO PLAY' : 'CLICK ANYWHERE TO PLAY'); }
window.addEventListener('padchange', () => { updatePadPrompts(); if (input.padActive) initAudio(); });
let toastT = null;
function toast(text) { const t = $('pad-toast'); t.textContent = text; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }
window.addEventListener('gamepadconnected', (e) => { const ps = /054c|dualsense|dualshock|playstation|ps5|ps4/i.test(e.gamepad.id); toast(`${padLabel(ps ? 'ps' : 'xbox')} CONTROLLER CONNECTED`); });
window.addEventListener('gamepaddisconnected', () => { toast('CONTROLLER DISCONNECTED'); if (app.state === 'match' && app.match && app.match.state === 'live') pauseMatch(); });
// the play prompt is set once the models have loaded (see the loadModels call below)
// first touch anywhere unlocks audio
window.addEventListener('pointerdown', () => initAudio(), { once: true });

window.__gb = { app, engine, input, hud, save, padNav, sp, get hud2() { return hud2; } };
// generated 3D models load before the first scene is built; on failure the procedural box models are used
loadModels('./', { lowTextures: settings.quality === 'low' }).catch((e) => console.warn('models unavailable, using procedural models', e)).finally(() => { enterTitle(); updatePadPrompts(); });
