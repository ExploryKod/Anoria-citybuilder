export const BUILDING_KIND_HOUSE = 'house';
export const BUILDING_KIND_FARM = 'farm';
export const BUILDING_KIND_MARKET = 'market';
export const BUILDING_KIND_WINDMILL = 'windmill';
export const BUILDING_KIND_ROAD = 'road';
export const BUILDING_KIND_NATURE = 'nature';
export const BUILDING_KIND_OTHER = 'other';

export const HOUSE_TYPE_BLUE = 'House-Blue';
export const HOUSE_TYPE_RED = 'House-Red';
export const HOUSE_TYPE_PURPLE = 'House-Purple';
export const HOUSE_TYPE_PALACE = 'House-2Story';

/** @type {Readonly<Record<string, number>>} */
export const RESIDENTIAL_TIER_BY_TYPE = Object.freeze({
  [HOUSE_TYPE_BLUE]: 1,
  [HOUSE_TYPE_RED]: 2,
  [HOUSE_TYPE_PURPLE]: 3,
  [HOUSE_TYPE_PALACE]: 4,
});

/** @type {Readonly<Record<number, string>>} */
export const RESIDENTIAL_TYPE_BY_TIER = Object.freeze({
  1: HOUSE_TYPE_BLUE,
  2: HOUSE_TYPE_RED,
  3: HOUSE_TYPE_PURPLE,
  4: HOUSE_TYPE_PALACE,
});

/**
 * @param {string} type
 * @returns {string}
 */
export function normalizeResidentialTypeLabel(type) {
  const t = type || '';
  if (t.includes('2Story') || t.includes('2-Story') || t.includes('House_2Story')) {
    return HOUSE_TYPE_PALACE;
  }
  if (t.includes('House-Purple')) return HOUSE_TYPE_PURPLE;
  if (t.includes('House-Red')) return HOUSE_TYPE_RED;
  if (t.includes('House-Blue')) return HOUSE_TYPE_BLUE;
  return t;
}

/**
 * @param {string} toolOrTypeId
 * @returns {string}
 */
export function resolveBuildingKind(toolOrTypeId) {
  const t = toolOrTypeId || '';
  if (t.includes('House') || t.includes('2Story')) return BUILDING_KIND_HOUSE;
  if (t.includes('Farm')) return BUILDING_KIND_FARM;
  if (t.includes('Market')) return BUILDING_KIND_MARKET;
  if (t.includes('Windmill') || t.includes('windmill')) return BUILDING_KIND_WINDMILL;
  if (t === 'roads' || t === 'Road' || t.startsWith('StonePath')) return BUILDING_KIND_ROAD;
  if (t.includes('Tree') || t.includes('Boulder')) return BUILDING_KIND_NATURE;
  return BUILDING_KIND_OTHER;
}

/**
 * @param {string} toolOrTypeId
 * @returns {number | null}
 */
export function initialTierForToolId(toolOrTypeId) {
  const normalized = normalizeResidentialTypeLabel(toolOrTypeId || '');
  return RESIDENTIAL_TIER_BY_TYPE[normalized] ?? null;
}

/**
 * @param {string} residentialType
 * @returns {number | null}
 */
export function tierForResidentialType(residentialType) {
  const normalized = normalizeResidentialTypeLabel(residentialType || '');
  return RESIDENTIAL_TIER_BY_TYPE[normalized] ?? null;
}

/**
 * @param {number} tier
 * @returns {string | null}
 */
export function residentialTypeForTier(tier) {
  return RESIDENTIAL_TYPE_BY_TIER[tier] ?? null;
}

/**
 * @param {string} kind
 * @returns {boolean}
 */
export function isResidentialKind(kind) {
  return kind === BUILDING_KIND_HOUSE;
}
