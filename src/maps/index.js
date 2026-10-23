// Map registry: lazy-loaded modules so the title screen boots fast.
export const MAPS = [
  { id: 'skidrow', name: 'Skid Row', city: 'Los Angeles', load: () => import('./skidrow.js') },
  { id: 'projects', name: 'Projects', city: 'New York', load: () => import('./projects.js') },
  { id: 'tenements', name: 'Tenements', city: 'Chicago', load: () => import('./tenements.js') },
  { id: 'ward', name: 'Ward', city: 'New Orleans', load: () => import('./ward.js') },
  { id: 'barrio', name: 'Barrio', city: 'Caracas', load: () => import('./barrio.js') },
  { id: 'kowloon', name: 'Kowloon', city: 'Hong Kong', load: () => import('./kowloon.js') },
  { id: 'banlieue', name: 'Banlieue', city: 'Paris', load: () => import('./banlieue.js') },
];
export async function loadMap(id) {
  const entry = MAPS.find((m) => m.id === id) || MAPS[0];
  const mod = await entry.load();
  return { def: mod.def, build: mod.build };
}
