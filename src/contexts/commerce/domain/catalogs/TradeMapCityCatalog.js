/**
 * Trade map — city positions, categories and connection graph.
 * Presentation reads this catalog; trade partners link via `partnerId`.
 */

export const TRADE_MAP_CITY_CATEGORIES = Object.freeze({
  nearCommercial: 'near-commercial',
  farCommercial: 'far-commercial',
  nonCommercial: 'non-commercial',
  enemy: 'enemy',
  anoriaOwnedNearCommercial: 'anoria-owned-near-commercial',
});

/** @type {Readonly<Record<string, string>>} */
export const TRADE_MAP_CITY_CATEGORY_LABELS = Object.freeze({
  [TRADE_MAP_CITY_CATEGORIES.nearCommercial]: 'Ville proche commerçante',
  [TRADE_MAP_CITY_CATEGORIES.farCommercial]: 'Ville lointaine commerçante',
  [TRADE_MAP_CITY_CATEGORIES.nonCommercial]: 'Ville non-commerçante',
  [TRADE_MAP_CITY_CATEGORIES.enemy]: 'Ville ennemie',
  [TRADE_MAP_CITY_CATEGORIES.anoriaOwnedNearCommercial]: 'Ville proche — propriété d\'Anoria',
});

/** @type {ReadonlyArray<{ id: string, name: string, category: string, x: number, y: number, labelAnchor?: string, partnerId?: string | null, description?: string }>} */
export const TRADE_MAP_CITIES = Object.freeze([
  {
    id: 'anoria',
    name: 'Anoria',
    category: 'capital',
    x: 50,
    y: 50,
    labelAnchor: 'top',
    partnerId: null,
    description: 'Votre cité — hub des routes commerciales.',
  },
  {
    id: 'olivea',
    name: 'Olivea',
    category: TRADE_MAP_CITY_CATEGORIES.nearCommercial,
    x: 28,
    y: 38,
    labelAnchor: 'left',
    partnerId: 'olivea',
    description: 'Cité méditerranéenne proche — achète bois et meubles, vend des figues.',
  },
  {
    id: 'silvania',
    name: 'Silvania',
    category: TRADE_MAP_CITY_CATEGORIES.farCommercial,
    x: 74,
    y: 36,
    labelAnchor: 'right',
    partnerId: 'silvania',
    description: 'Région forestière lointaine — achète des meubles.',
  },
  {
    id: 'maris',
    name: 'Maris',
    category: TRADE_MAP_CITY_CATEGORIES.anoriaOwnedNearCommercial,
    x: 58,
    y: 70,
    labelAnchor: 'right',
    partnerId: null,
    description: 'Port commercial d\'Anoria — route ouverte, commerce actif sous votre autorité.',
  },
  {
    id: 'briga',
    name: 'Briga',
    category: TRADE_MAP_CITY_CATEGORIES.nonCommercial,
    x: 70,
    y: 58,
    labelAnchor: 'right',
    partnerId: null,
    description: 'Village isolé — pas encore de marché. Une route pourrait y ouvrir le commerce.',
  },
  {
    id: 'vexlor',
    name: 'Vexlor',
    category: TRADE_MAP_CITY_CATEGORIES.enemy,
    x: 18,
    y: 68,
    labelAnchor: 'left',
    partnerId: null,
    description: 'Cité hostile — aucun échange pour l\'instant.',
  },
]);

/**
 * Links between cities (diplomacy / trade routes — visual layer).
 * @type {ReadonlyArray<{ from: string, to: string, kind: 'trade-route' | 'inter-city' | 'potential' | 'hostile' }>}
 */
export const TRADE_MAP_CONNECTIONS = Object.freeze([
  { from: 'anoria', to: 'olivea', kind: 'trade-route' },
  { from: 'anoria', to: 'silvania', kind: 'trade-route' },
  { from: 'anoria', to: 'maris', kind: 'trade-route' },
  { from: 'olivea', to: 'silvania', kind: 'inter-city' },
]);

/**
 * @param {object} city
 */
export function cityHasCommercialRoute(city) {
  return city.category === TRADE_MAP_CITY_CATEGORIES.nearCommercial
    || city.category === TRADE_MAP_CITY_CATEGORIES.farCommercial
    || city.category === TRADE_MAP_CITY_CATEGORIES.anoriaOwnedNearCommercial;
}

/**
 * Villes pouvant être reliées par une route sur la carte (pas ennemies ni non-commerçantes).
 * @param {object | null | undefined} city
 */
export function cityShowsOnTradeMapRoutes(city) {
  if (!city) return false;
  return city.category !== TRADE_MAP_CITY_CATEGORIES.enemy
    && city.category !== TRADE_MAP_CITY_CATEGORIES.nonCommercial;
}

/**
 * @param {string} cityId
 */
export function getTradeMapCityById(cityId) {
  return TRADE_MAP_CITIES.find((city) => city.id === cityId) ?? null;
}

/**
 * @param {string} partnerId
 */
export function getTradeMapCityByPartnerId(partnerId) {
  return TRADE_MAP_CITIES.find((city) => city.partnerId === partnerId) ?? null;
}
