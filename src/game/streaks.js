// Score streaks. Each map gets 15: 5 starter, 5 medium, 5 powerful. Some are shared, some are unique to the map.
// effect types are implemented in match.js (applyStreak).
const S = (id, name, cost, effect, params, desc, maps = null) => ({ id, name, cost, effect, params, desc, maps });

// ---- shared pool ----
const STARTER = [
  S('lookout', 'LOOKOUT', 400, 'radar', { duration: 25 }, 'Homie on the roof calls out enemy positions on your map for 25 s.'),
  S('reup', 'RE-UP', 350, 'ammo', {}, 'Full ammo and equipment refill.'),
  S('vest', 'VEST', 450, 'armor', { amount: 75 }, 'Strap on a vest: +75 armor until it breaks.'),
  S('jammer', 'JAMMER', 500, 'counter_radar', { duration: 25 }, 'Scrambles enemy radar for 25 s and hides your crew.'),
  S('burner', 'BURNER PHONE', 500, 'intel', { duration: 20 }, 'Pings the nearest enemy every 2 s for 20 s.'),
  S('scanner', 'POLICE SCANNER', 450, 'radar', { duration: 20, sweep: true }, 'Sweeping radar: enemies show on your map every few seconds for 20 s.'),
];
const MEDIUM = [
  S('homies', 'CALL THE HOMIES', 750, 'crew', { count: 2, duration: 45 }, 'Two of your crew pull up and fight with you for 45 s.'),
  S('pitbull', 'PITBULL', 650, 'dog', { duration: 40 }, 'Release a pitbull that hunts the nearest enemy for 40 s.'),
  S('driveby', 'DRIVE-BY', 800, 'driveby', {}, 'A car rolls through where you are aiming, spraying everything on the way.'),
  S('firecrackers', 'FIRECRACKERS', 700, 'mortar', { duration: 15, interval: 2.5 }, 'Explosions rain on random enemies for 15 s.'),
  S('rooftop', 'ROOFTOP SHOOTER', 850, 'turret', { duration: 60 }, 'Plant a shooter where you stand. Auto-fires at enemies for 60 s.'),
  S('energy', 'ENERGY DRINK', 650, 'speed', { duration: 25 }, 'Move, reload and swap 25% faster for 25 s.'),
  S('blackout', 'BLACKOUT', 900, 'emp', { duration: 20 }, 'Kills enemy radar and makes every enemy flinch and miss for 20 s.'),
];
const POWERFUL = [
  S('ghettobird', 'GHETTO BIRD', 1200, 'heli', { duration: 30 }, 'A chopper circles the block gunning enemies for 30 s.'),
  S('traphouse', 'TRAP HOUSE ARMOR', 1300, 'juggernaut', { duration: 60 }, '300 health plate carrier for 60 s. You move slower.'),
  S('hitman', 'HITMAN', 1100, 'hitman', { duration: 20, interval: 4 }, 'A contract killer drops one enemy every 4 s for 20 s.'),
  S('riot', 'RIOT', 1500, 'wipe', {}, 'The whole block riots. Every enemy currently alive goes down.'),
  S('lowrider', 'LOW RIDER', 1050, 'driveby', { heavy: true }, 'An armored low rider plows through the lane you are aiming down.'),
  S('rain', 'MOLOTOV RAIN', 1150, 'mortar', { duration: 25, interval: 1.6, fire: true }, 'Molotovs rain on every enemy for 25 s.'),
];
// ---- map-unique streaks ----
const UNIQUE = {
  skidrow: {
    starter: [S('la_tent', 'TENT CITY', 400, 'radar', { duration: 30 }, 'The tents are watching. Enemies on radar for 30 s.')],
    medium: [S('la_lapd', 'LAPD SWEEP', 800, 'crew', { count: 2, duration: 40, skin: 'cop' }, 'Two patrol cops roll in and clear the block with you for 40 s.')],
    powerful: [S('la_quake', 'SHAKE', 1400, 'quake', { duration: 6 }, 'An earthquake knocks every enemy off their feet for 6 s. Free kills.')],
  },
  projects: {
    starter: [S('ny_stoop', 'STOOP WATCH', 400, 'radar', { duration: 30 }, 'The stoop sees everything. Enemies on radar for 30 s.')],
    medium: [S('ny_train', 'RUSH HOUR', 750, 'mortar', { duration: 12, interval: 1.5 }, 'Shockwaves from the passing train knock down enemies around the tracks.')],
    powerful: [S('ny_nypd', 'NYPD RAID', 1300, 'crew', { count: 3, duration: 45, skin: 'cop' }, 'Three NYPD officers storm the block on your side for 45 s.')],
  },
  tenements: {
    starter: [S('chi_wire', 'THE WIRE', 450, 'intel', { duration: 25 }, 'Tapped phones: the closest enemy is pinged every 2 s for 25 s.')],
    medium: [S('chi_hawk', 'THE HAWK', 800, 'emp', { duration: 25 }, 'A lake-effect wind cuts visibility and accuracy for every enemy for 25 s.')],
    powerful: [S('chi_outfit', 'THE OUTFIT', 1250, 'hitman', { duration: 24, interval: 4 }, 'Outfit shooters drop an enemy every 4 s for 24 s.')],
  },
  ward: {
    starter: [S('nola_brass', 'BRASS BAND', 400, 'decoy', { duration: 20 }, 'A second line draws every enemy toward your decoy for 20 s.')],
    medium: [S('nola_flood', 'FLOODWALL', 850, 'armor', { amount: 150 }, '+150 armor. The levee holds.')],
    powerful: [S('nola_gator', 'GATOR SEASON', 1200, 'dog', { duration: 50, count: 2 }, 'Two gators run the streets hunting enemies for 50 s.')],
  },
  barrio: {
    starter: [S('ccs_moto', 'MOTO TAXI', 450, 'speed', { duration: 20 }, 'Ride the moto: 25% faster for 20 s.')],
    medium: [S('ccs_colectivo', 'COLECTIVO', 850, 'crew', { count: 3, duration: 40, skin: 'sicario' }, 'Three colectivos on bikes roll up on your side for 40 s.')],
    powerful: [S('ccs_apagon', 'APAGÓN', 1300, 'emp', { duration: 35, dark: true }, 'Blackout hits the hill: enemy radar dead and enemies blind for 35 s.')],
  },
  kowloon: {
    starter: [S('hk_triad', 'TRIAD EYES', 400, 'radar', { duration: 30 }, 'Every shop owner reports in. Enemies on radar for 30 s.')],
    medium: [S('hk_fireworks', 'FIREWORKS', 750, 'mortar', { duration: 15, interval: 1.8 }, 'New Year fireworks go off on enemy heads for 15 s.')],
    powerful: [S('hk_dragon', 'DRAGON DANCE', 1350, 'wipe', { delay: 3 }, 'The dragon runs through the alleys. Every enemy alive goes down 3 s after you call it.')],
  },
  banlieue: {
    starter: [S('par_rer', 'RER DELAY', 400, 'counter_radar', { duration: 30 }, 'Strike day: enemy radar is useless for 30 s.')],
    medium: [S('par_crs', 'CRS CHARGE', 850, 'crew', { count: 3, duration: 40, skin: 'cop' }, 'Three riot cops charge in on your side for 40 s.')],
    powerful: [S('par_emeute', 'ÉMEUTE', 1400, 'quake', { duration: 7, fire: true }, 'The cité riots: cars burn and every enemy is knocked down for 7 s.')],
  },
};

export function streaksForMap(mapId) {
  const u = UNIQUE[mapId] || UNIQUE.skidrow;
  const starter = [...u.starter, ...STARTER.slice(0, 5 - u.starter.length)];
  const medium = [...u.medium, ...MEDIUM.slice(0, 5 - u.medium.length)];
  const powerful = [...u.powerful, ...POWERFUL.slice(0, 5 - u.powerful.length)];
  const sortC = (a, b) => a.cost - b.cost;
  return { starter: starter.sort(sortC), medium: medium.sort(sortC), powerful: powerful.sort(sortC) };
}
export function findStreak(mapId, id) { const s = streaksForMap(mapId); return [...s.starter, ...s.medium, ...s.powerful].find((x) => x.id === id) || null; }
