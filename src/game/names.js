// Bot identities: gamertags and factions.
export const NAMES = ['Lil_Smoke', 'BigHomie', 'TrapKing', 'YungSavage', 'DonDada', 'Sicario_7', 'CapoDeCapos', 'SweeperJay', 'Nina_Ross', 'Baby_Face', 'Mack10', 'TooShort', 'Trigga', 'Blicky', 'Draco_Dre', 'xX_Opp_Xx', 'ShooterMcGavin', 'HoodRich', 'PlugTalk', 'FastLane', 'SlimeBall', 'Glizzy_G', 'OG_Loc', 'Chapo_Jr', 'La_Sombra', 'ElPatron', 'Mula', 'Benjamins', 'Kilo', 'Choppa_City', 'NoCap', 'DeadEye', 'Hitta', 'Pistol_Pete', 'Scarface2k', 'Tony_M', 'Sosa', 'YoungRicky', 'DaKid', 'Ghost', 'Flaco', 'Gordo', 'Chino', 'Spider', 'Jefe', 'Hefe', 'Bando', 'Trap_Lord', 'FrenchiePlug', 'Wagwan', 'Mandem', 'Kowloon_Kid', 'TriadT', 'Banlieue93', 'NolaBoy', 'ChiRaq', 'QB_Bridge', 'SkidRowSteve', 'Petare_P', 'Clutch', 'Pressure', 'Opp_Stoppa', 'Savage_Mode', 'Menace', 'Scrappy', 'Dutchie', 'Fetti', 'Racks', 'Kingpin', 'Sauce', 'Drip', 'Lil_Bit', 'Nunu', 'Tooka', 'Shorty', 'Dre', 'Vic', 'Rizzo', 'Moose', 'Tank', 'Munch'];
export const FACTIONS = ['gang', 'gang', 'gang', 'hitman', 'sicario', 'cop'];
export const SKIN_TONES = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21', '#3b2416', '#ffdbac'];
export const HOODIE_COLORS = ['#2b2b2b', '#1e3a5f', '#5a1f1f', '#3a3a2a', '#444', '#6b2a6b', '#2a5a3a', '#d8d8d8'];
export function pickNames(rng, n, exclude = []) {
  const pool = NAMES.filter((x) => !exclude.includes(x)); rng.shuffle(pool); return pool.slice(0, n);
}
