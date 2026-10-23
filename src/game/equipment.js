// Tactical and lethal equipment definitions. Behaviour lives in projectiles.js.
export const TACTICALS = {
  flashbang: { id: 'flashbang', name: 'FLASHBANG', desc: 'Blinds and deafens anyone looking at it.', count: 2, fuse: 1.6, throwSpeed: 18, radius: 9, color: '#9aa', shape: 'can' },
  smoke: { id: 'smoke', name: 'SMOKE', desc: 'Thick smoke screen. Break line of sight.', count: 2, fuse: 1.2, throwSpeed: 15, radius: 6, color: '#777', shape: 'can' },
  stun: { id: 'stun', name: 'STUN', desc: 'Slows and disorients enemies in the blast.', count: 2, fuse: 1.5, throwSpeed: 18, radius: 7, color: '#bbb', shape: 'can' },
  heartbeat: { id: 'heartbeat', name: 'HEARTBEAT SENSOR', desc: 'Pulses nearby enemy positions onto your map.', count: 1, passive: true, radius: 30, interval: 1.6, color: '#3a3', shape: 'box' },
  decoy: { id: 'decoy', name: 'DECOY', desc: 'Fake gunfire that draws enemies and spoofs radar.', count: 2, fuse: 1.0, throwSpeed: 16, radius: 14, duration: 10, color: '#a63', shape: 'can' },
  molotov_t: null,
};
delete TACTICALS.molotov_t;
export const LETHALS = {
  frag: { id: 'frag', name: 'FRAG', desc: 'Pin out, cook it, throw it. 5 m kill radius.', count: 1, fuse: 3.2, throwSpeed: 20, radius: 6, damage: 150, bounce: 0.4, color: '#4a5a3a', shape: 'ball' },
  breach: { id: 'breach', name: 'BREACHING CHARGE', desc: 'Sticks to anything, blows a second later.', count: 1, fuse: 1.2, throwSpeed: 14, radius: 5.5, damage: 170, sticky: true, color: '#3a3a3a', shape: 'box' },
  semtex: { id: 'semtex', name: 'SEMTEX', desc: 'Sticky plastic explosive on a timer.', count: 1, fuse: 2.2, throwSpeed: 19, radius: 6, damage: 160, sticky: true, color: '#c8b48a', shape: 'ball' },
  claymore: { id: 'claymore', name: 'CLAYMORE', desc: 'Plant it. Front-facing proximity mine.', count: 1, placed: true, radius: 5, damage: 150, triggerRange: 3.2, color: '#4a5a3a', shape: 'box' },
  tomahawk: { id: 'tomahawk', name: 'TOMAHAWK', desc: 'Thrown axe. One hit kills, and you can pick it back up.', count: 1, fuse: 99, throwSpeed: 26, radius: 0, damage: 200, impact: true, retrievable: true, color: '#8a6a3a', shape: 'axe' },
  molotov: { id: 'molotov', name: 'MOLOTOV', desc: 'Bottle of fire. Burns the area for 6 seconds.', count: 1, fuse: 99, throwSpeed: 17, radius: 4.5, damage: 25, impact: true, burn: 6, color: '#c8a040', shape: 'bottle' },
  knife: { id: 'knife', name: 'THROWING KNIFE', desc: 'Silent, instant kill on hit.', count: 2, fuse: 99, throwSpeed: 30, radius: 0, damage: 200, impact: true, retrievable: true, color: '#aaa', shape: 'axe' },
};
