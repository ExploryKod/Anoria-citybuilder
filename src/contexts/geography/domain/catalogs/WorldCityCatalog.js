/**
 * World map — city positions, categories and connection graph.
 */

export const WORLD_CITY_CATEGORIES = Object.freeze({
  near: 'near',
  far: 'far',
  neutral: 'neutral',
  enemy: 'enemy',
  anoriaOwned: 'anoria-owned',
});

/** @type {Readonly<Record<string, string>>} */
export const WORLD_CITY_CATEGORY_LABELS = Object.freeze({
  [WORLD_CITY_CATEGORIES.near]: 'Ville proche',
  [WORLD_CITY_CATEGORIES.far]: 'Ville lointaine',
  [WORLD_CITY_CATEGORIES.neutral]: 'Ville neutre',
  [WORLD_CITY_CATEGORIES.enemy]: 'Ville ennemie',
  [WORLD_CITY_CATEGORIES.anoriaOwned]: 'Ville — propriété d\'Anoria',
});

/** @type {ReadonlyArray<{ id: string, name: string, category: string, x: number, y: number, labelAnchor?: string, description?: string }>} */
export const WORLD_CITIES = Object.freeze([
  {
    id: 'anoria',
    name: 'Anoria',
    category: 'capital',
    x: 50,
    y: 50,
    labelAnchor: 'top',
    description: 'Votre cité.',
  },
  {
    id: 'olivea',
    name: 'Olivea',
    category: WORLD_CITY_CATEGORIES.near,
    x: 28,
    y: 38,
    labelAnchor: 'left',
    description: 'Cité méditerranéenne proche.',
  },
  {
    id: 'silvania',
    name: 'Silvania',
    category: WORLD_CITY_CATEGORIES.far,
    x: 74,
    y: 36,
    labelAnchor: 'right',
    description: 'Région forestière lointaine.',
  },
  {
    id: 'maris',
    name: 'Maris',
    category: WORLD_CITY_CATEGORIES.anoriaOwned,
    x: 58,
    y: 70,
    labelAnchor: 'right',
    description: 'Port sous votre autorité.',
  },
  {
    id: 'briga',
    name: 'Briga',
    category: WORLD_CITY_CATEGORIES.neutral,
    x: 70,
    y: 58,
    labelAnchor: 'right',
    description: 'Village isolé.',
  },
  {
    id: 'piceta',
    name: 'Piceta',
    category: WORLD_CITY_CATEGORIES.far,
    x: 46,
    y: 16,
    labelAnchor: 'top',
    description: "Cité minière lointaine, qui vend de l'uranium.",
  },
  {
    id: 'sablia',
    name: 'Sablia',
    category: WORLD_CITY_CATEGORIES.far,
    x: 30,
    y: 78,
    labelAnchor: 'left',
    description: 'Oasis marchande du sud, qui manque de grain.',
  },
  {
    id: 'carbonne',
    name: 'Carbonne',
    category: WORLD_CITY_CATEGORIES.neutral,
    x: 38,
    y: 24,
    labelAnchor: 'left',
    description: 'Cité de mineurs, riche en charbon.',
  },
  {
    id: 'frumenta',
    name: 'Frumenta',
    category: WORLD_CITY_CATEGORIES.far,
    x: 84,
    y: 78,
    labelAnchor: 'right',
    description: 'Plaine à blé lointaine, qui vend du grain.',
  },
  {
    id: 'vexlor',
    name: 'Vexlor',
    category: WORLD_CITY_CATEGORIES.enemy,
    x: 18,
    y: 68,
    labelAnchor: 'left',
    description: 'Cité hostile.',
  },
]);

/**
 * Links between cities (diplomacy — visual layer).
 * @type {ReadonlyArray<{ from: string, to: string, kind: 'inter-city' | 'hostile' }>}
 */
export const WORLD_CITY_CONNECTIONS = Object.freeze([
  { from: 'anoria', to: 'olivea', kind: 'inter-city' },
  { from: 'anoria', to: 'silvania', kind: 'inter-city' },
  { from: 'anoria', to: 'maris', kind: 'inter-city' },
  { from: 'anoria', to: 'piceta', kind: 'inter-city' },
  { from: 'olivea', to: 'silvania', kind: 'inter-city' },
]);

/**
 * @param {string} cityId
 */
export function getWorldCityById(cityId) {
  return WORLD_CITIES.find((city) => city.id === cityId) ?? null;
}
