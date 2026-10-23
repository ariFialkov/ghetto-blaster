// Weapon definitions. Hood-themed names, COD-style stats. Damage model is hitscan with range falloff.
// model: procedural gun mesh descriptor (lengths in metres).
const W = (o) => ({
  auto: true, burst: 0, pellets: 1, headshot: 1.4, adsTime: 0.22, adsFov: 52, speedMult: 0.95, adsSpeedMult: 0.65,
  spreadHip: 2.2, spreadAds: 0.25, spreadMove: 1.5, recoilV: 0.9, recoilH: 0.4, recoilRecover: 7, sound: 'ar', suppressed: false,
  swapTime: 0.45, bulletSpeedVisual: 1, tracer: true, ...o,
});

export const WEAPONS = {
  // ---------------- SMG ----------------
  macdaddy: W({ id: 'macdaddy', name: 'MAC DADDY', type: 'smg', slot: 'primary', desc: 'Spray-and-pray machine pistol SMG. Melts up close, useless at range.',
    damage: 22, rpm: 1050, mag: 32, reserve: 160, reload: 1.9, rangeFull: 12, rangeMin: 28, minDamage: 13, spreadHip: 2.8, spreadAds: 0.5, recoilV: 0.7, recoilH: 0.9, adsFov: 58, speedMult: 1.0, adsSpeedMult: 0.75, sound: 'smg',
    model: { len: 0.42, h: 0.14, barrel: 0.12, mag: 0.22, stock: 0.0, color: '#2a2a2a' } }),
  tommy: W({ id: 'tommy', name: 'TOMMY', type: 'smg', slot: 'primary', desc: 'Drum-fed chopper from the old days. Slow, heavy, hits hard.',
    damage: 34, rpm: 650, mag: 50, reserve: 150, reload: 2.6, rangeFull: 18, rangeMin: 36, minDamage: 22, spreadHip: 2.4, recoilV: 1.0, recoilH: 0.6, adsFov: 55, speedMult: 0.95, sound: 'smg',
    model: { len: 0.75, h: 0.16, barrel: 0.25, mag: 0.26, stock: 0.25, drum: true, color: '#3b2a1a' } }),
  whisper: W({ id: 'whisper', name: 'WHISPER', type: 'smg', slot: 'primary', desc: 'Suppressed SMG. Quiet, controllable, stays off the radar.',
    damage: 26, rpm: 800, mag: 30, reserve: 150, reload: 2.1, rangeFull: 16, rangeMin: 32, minDamage: 16, spreadHip: 2.0, spreadAds: 0.25, recoilV: 0.55, recoilH: 0.35, adsFov: 55, speedMult: 1.0, suppressed: true, sound: 'suppressed', tracer: false,
    model: { len: 0.62, h: 0.15, barrel: 0.3, mag: 0.2, stock: 0.22, suppressor: true, color: '#1e1e22' } }),
  // ---------------- AR ----------------
  chopper: W({ id: 'chopper', name: 'CHOPPER', type: 'ar', slot: 'primary', desc: 'The AK. Big kick, bigger damage.',
    damage: 40, rpm: 600, mag: 30, reserve: 150, reload: 2.5, rangeFull: 30, rangeMin: 60, minDamage: 28, spreadHip: 2.6, spreadAds: 0.2, recoilV: 1.4, recoilH: 0.8, adsFov: 50, speedMult: 0.92, sound: 'ar',
    model: { len: 0.85, h: 0.17, barrel: 0.35, mag: 0.26, stock: 0.3, magCurve: true, color: '#5a3a1a', metal: '#2a2a2a' } }),
  stick: W({ id: 'stick', name: 'STICK', type: 'ar', slot: 'primary', desc: 'Clean M4-style rifle. Balanced, accurate, dependable.',
    damage: 32, rpm: 780, mag: 30, reserve: 180, reload: 2.2, rangeFull: 32, rangeMin: 62, minDamage: 24, spreadHip: 2.4, spreadAds: 0.15, recoilV: 0.85, recoilH: 0.45, adsFov: 48, speedMult: 0.94, sound: 'ar',
    model: { len: 0.82, h: 0.18, barrel: 0.3, mag: 0.24, stock: 0.26, rail: true, color: '#1e1e22', metal: '#2a2a2a' } }),
  drako: W({ id: 'drako', name: 'DRAKO', type: 'ar', slot: 'primary', desc: 'Pistol-grip AK with no stock. Hipfire monster, wild at range.',
    damage: 38, rpm: 640, mag: 30, reserve: 120, reload: 2.4, rangeFull: 18, rangeMin: 40, minDamage: 24, spreadHip: 1.6, spreadAds: 0.6, recoilV: 1.6, recoilH: 1.2, adsFov: 58, speedMult: 0.98, adsSpeedMult: 0.8, sound: 'ar',
    model: { len: 0.6, h: 0.17, barrel: 0.2, mag: 0.26, stock: 0.0, magCurve: true, color: '#5a3a1a', metal: '#2a2a2a' } }),
  trey: W({ id: 'trey', name: 'TREY', type: 'ar', slot: 'primary', desc: '3-round burst rifle. Precise, punishing at mid range.',
    damage: 36, rpm: 900, mag: 36, reserve: 144, reload: 2.3, rangeFull: 36, rangeMin: 70, minDamage: 26, auto: false, burst: 3, burstDelay: 0.26, spreadHip: 2.6, spreadAds: 0.12, recoilV: 0.9, recoilH: 0.3, adsFov: 46, speedMult: 0.93, sound: 'ar',
    model: { len: 0.84, h: 0.18, barrel: 0.3, mag: 0.24, stock: 0.28, scope: 0.5, color: '#2a3a2a', metal: '#2a2a2a' } }),
  // ---------------- Shotgun ----------------
  gauge: W({ id: 'gauge', name: 'GAUGE', type: 'shotgun', slot: 'primary', desc: 'Pump 12 gauge. One shot, one body, if you are close enough.',
    damage: 16, pellets: 8, rpm: 70, mag: 6, reserve: 36, reload: 2.8, reloadShell: true, rangeFull: 7, rangeMin: 18, minDamage: 4, auto: false, spreadHip: 5.5, spreadAds: 3.6, recoilV: 3.0, recoilH: 0.6, adsFov: 60, speedMult: 0.92, sound: 'shotgun',
    model: { len: 0.95, h: 0.14, barrel: 0.4, mag: 0.0, stock: 0.3, pump: true, color: '#3b2a1a', metal: '#2a2a2a' } }),
  sweeper: W({ id: 'sweeper', name: 'STREET SWEEPER', type: 'shotgun', slot: 'primary', desc: 'Drum-fed auto shotgun. Clears a room.',
    damage: 12, pellets: 8, rpm: 220, mag: 12, reserve: 48, reload: 3.4, rangeFull: 6, rangeMin: 16, minDamage: 3, auto: true, spreadHip: 6.0, spreadAds: 4.2, recoilV: 2.2, recoilH: 1.0, adsFov: 60, speedMult: 0.88, sound: 'shotgun',
    model: { len: 0.8, h: 0.16, barrel: 0.3, mag: 0.0, stock: 0.28, drum: true, color: '#1e1e22', metal: '#2a2a2a' } }),
  // ---------------- Sniper / DMR ----------------
  fifty: W({ id: 'fifty', name: 'FIFTY', type: 'sniper', slot: 'primary', desc: '.50 cal bolt action. One shot anywhere above the waist.',
    damage: 98, headshot: 2.0, rpm: 42, mag: 5, reserve: 30, reload: 3.6, rangeFull: 200, rangeMin: 300, minDamage: 90, auto: false, spreadHip: 8, spreadAds: 0.0, spreadMove: 3, recoilV: 4.0, recoilH: 1.0, adsFov: 16, adsTime: 0.42, speedMult: 0.85, adsSpeedMult: 0.45, scope: true, sound: 'sniper',
    model: { len: 1.25, h: 0.16, barrel: 0.6, mag: 0.18, stock: 0.34, scope: 0.7, bipod: true, color: '#1e1e22', metal: '#2a2a2a' } }),
  cannon: W({ id: 'cannon', name: 'CANNON', type: 'dmr', slot: 'primary', desc: 'Semi-auto marksman rifle. Two taps at any range.',
    damage: 58, headshot: 1.8, rpm: 260, mag: 10, reserve: 60, reload: 2.8, rangeFull: 120, rangeMin: 200, minDamage: 50, auto: false, spreadHip: 5, spreadAds: 0.05, spreadMove: 2, recoilV: 2.2, recoilH: 0.6, adsFov: 26, adsTime: 0.34, speedMult: 0.88, adsSpeedMult: 0.5, scope: true, sound: 'sniper',
    model: { len: 1.05, h: 0.17, barrel: 0.45, mag: 0.22, stock: 0.32, scope: 0.55, color: '#3b3b2a', metal: '#2a2a2a' } }),
  // ---------------- LMG ----------------
  ratchet: W({ id: 'ratchet', name: 'RATCHET', type: 'lmg', slot: 'primary', desc: 'Belt-fed. Hold the corner and let it rip.',
    damage: 36, rpm: 700, mag: 100, reserve: 200, reload: 5.2, rangeFull: 34, rangeMin: 70, minDamage: 26, spreadHip: 3.2, spreadAds: 0.25, recoilV: 1.1, recoilH: 0.9, adsFov: 50, adsTime: 0.36, speedMult: 0.84, adsSpeedMult: 0.5, sound: 'lmg',
    model: { len: 1.0, h: 0.2, barrel: 0.4, mag: 0.0, stock: 0.3, box: true, bipod: true, color: '#2a2a2a', metal: '#2a2a2a' } }),
  // ---------------- Secondaries ----------------
  nine: W({ id: 'nine', name: 'NINE', type: 'pistol', slot: 'secondary', desc: 'Standard 9mm. Everybody got one.',
    damage: 30, rpm: 420, mag: 15, reserve: 60, reload: 1.5, rangeFull: 14, rangeMin: 30, minDamage: 18, auto: false, spreadHip: 2.0, spreadAds: 0.4, recoilV: 1.0, recoilH: 0.4, adsFov: 60, adsTime: 0.16, speedMult: 1.0, adsSpeedMult: 0.85, sound: 'pistol',
    model: { len: 0.2, h: 0.13, barrel: 0.0, mag: 0.0, stock: 0, pistol: true, color: '#2a2a2a' } }),
  fourfifth: W({ id: 'fourfifth', name: 'FOUR-FIFTH', type: 'pistol', slot: 'secondary', desc: '.45 caliber. Slow, but it knocks.',
    damage: 42, rpm: 300, mag: 8, reserve: 40, reload: 1.6, rangeFull: 16, rangeMin: 32, minDamage: 24, auto: false, spreadHip: 2.2, spreadAds: 0.4, recoilV: 1.6, recoilH: 0.5, adsFov: 60, adsTime: 0.17, speedMult: 1.0, adsSpeedMult: 0.85, sound: 'pistol',
    model: { len: 0.22, h: 0.14, barrel: 0.0, mag: 0.0, stock: 0, pistol: true, color: '#4a4a4a' } }),
  deuce: W({ id: 'deuce', name: 'DEUCE DEUCE', type: 'pistol', slot: 'secondary', desc: '.22 pocket pistol. Tickles, but you can fire it fast.',
    damage: 18, rpm: 600, mag: 10, reserve: 60, reload: 1.3, rangeFull: 10, rangeMin: 22, minDamage: 10, auto: false, spreadHip: 1.8, spreadAds: 0.4, recoilV: 0.5, recoilH: 0.3, adsFov: 62, adsTime: 0.14, speedMult: 1.0, adsSpeedMult: 0.9, sound: 'pistol',
    model: { len: 0.16, h: 0.11, barrel: 0.0, mag: 0.0, stock: 0, pistol: true, color: '#8a8a8a' } }),
  hammer: W({ id: 'hammer', name: 'HAMMER', type: 'revolver', slot: 'secondary', desc: '.44 magnum wheel gun. Two to the chest, one to the head.',
    damage: 60, headshot: 1.8, rpm: 150, mag: 6, reserve: 30, reload: 2.4, rangeFull: 22, rangeMin: 40, minDamage: 40, auto: false, spreadHip: 2.4, spreadAds: 0.25, recoilV: 2.6, recoilH: 0.8, adsFov: 56, adsTime: 0.2, speedMult: 1.0, adsSpeedMult: 0.8, sound: 'revolver',
    model: { len: 0.3, h: 0.14, barrel: 0.12, mag: 0.0, stock: 0, pistol: true, revolver: true, color: '#555' } }),
  snubby: W({ id: 'snubby', name: 'SNUBBY', type: 'revolver', slot: 'secondary', desc: 'Snub-nose .38. Last resort.',
    damage: 45, rpm: 180, mag: 5, reserve: 25, reload: 2.2, rangeFull: 12, rangeMin: 26, minDamage: 28, auto: false, spreadHip: 2.6, spreadAds: 0.4, recoilV: 2.0, recoilH: 0.7, adsFov: 58, adsTime: 0.16, speedMult: 1.0, adsSpeedMult: 0.85, sound: 'revolver',
    model: { len: 0.18, h: 0.12, barrel: 0.0, mag: 0.0, stock: 0, pistol: true, revolver: true, color: '#333' } }),
  switch: W({ id: 'switch', name: 'SWITCH', type: 'mpistol', slot: 'secondary', desc: 'Full-auto pistol with the switch on. Empties in a second.',
    damage: 22, rpm: 1100, mag: 20, reserve: 80, reload: 1.7, rangeFull: 10, rangeMin: 24, minDamage: 12, auto: true, spreadHip: 3.2, spreadAds: 0.9, recoilV: 1.0, recoilH: 1.4, adsFov: 60, adsTime: 0.16, speedMult: 1.0, adsSpeedMult: 0.85, sound: 'pistol',
    model: { len: 0.21, h: 0.13, barrel: 0.0, mag: 0.1, stock: 0, pistol: true, color: '#1e1e22' } }),
  hush: W({ id: 'hush', name: 'HUSH', type: 'pistol', slot: 'secondary', desc: 'Suppressed pistol. Quiet work.',
    damage: 28, rpm: 400, mag: 12, reserve: 48, reload: 1.5, rangeFull: 12, rangeMin: 26, minDamage: 16, auto: false, spreadHip: 1.8, spreadAds: 0.3, recoilV: 0.7, recoilH: 0.3, adsFov: 60, adsTime: 0.15, speedMult: 1.0, adsSpeedMult: 0.88, suppressed: true, sound: 'suppressed', tracer: false,
    model: { len: 0.2, h: 0.13, barrel: 0.0, mag: 0.0, stock: 0, pistol: true, suppressor: true, color: '#1e1e22' } }),
  blicky: W({ id: 'blicky', name: 'BLICKY', type: 'mpistol', slot: 'secondary', desc: 'Extended-clip burst pistol.',
    damage: 26, rpm: 950, mag: 30, reserve: 90, reload: 1.9, rangeFull: 12, rangeMin: 26, minDamage: 14, auto: false, burst: 3, burstDelay: 0.2, spreadHip: 2.6, spreadAds: 0.6, recoilV: 1.0, recoilH: 0.9, adsFov: 60, adsTime: 0.16, speedMult: 1.0, adsSpeedMult: 0.85, sound: 'pistol',
    model: { len: 0.21, h: 0.13, barrel: 0.0, mag: 0.18, stock: 0, pistol: true, color: '#2a2a2a' } }),
};

export const PRIMARIES = Object.values(WEAPONS).filter((w) => w.slot === 'primary');
export const SECONDARIES = Object.values(WEAPONS).filter((w) => w.slot === 'secondary');

// Gun game progression (20 guns, final is the Snubby)
export const GUN_GAME_ORDER = ['nine', 'deuce', 'switch', 'hush', 'blicky', 'fourfifth', 'hammer', 'macdaddy', 'whisper', 'tommy', 'gauge', 'sweeper', 'stick', 'chopper', 'drako', 'trey', 'ratchet', 'cannon', 'fifty', 'snubby'];

export function damageAtRange(w, dist) {
  if (dist <= w.rangeFull) return w.damage;
  if (dist >= w.rangeMin) return w.minDamage;
  const t = (dist - w.rangeFull) / (w.rangeMin - w.rangeFull);
  return w.damage + (w.minDamage - w.damage) * t;
}
export function weaponStats(w) { // 0..1 bars for UI
  const dps = (w.damage * w.pellets * w.rpm) / 60;
  return { damage: Math.min(1, (w.damage * w.pellets) / 100), rate: Math.min(1, w.rpm / 1100), range: Math.min(1, w.rangeMin / 120), accuracy: Math.min(1, 1 - (w.spreadAds + w.recoilV * 0.15) / 4), mobility: Math.min(1, (w.speedMult - 0.8) / 0.2), dps };
}
