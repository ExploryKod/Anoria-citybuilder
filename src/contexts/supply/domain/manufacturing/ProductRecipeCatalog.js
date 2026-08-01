/** Manufactured goods recipes (refined inputs → product unit). */
export const PRODUCT_RECIPES = Object.freeze({
  furniture: { logs: 4 },
  weapons: { refinedIron: 4 },
  pottery: { refinedClay: 4 },
  jewelry: { refinedGold: 4 },
});

/** Production delay in turns after transformation. */
export const PRODUCT_PRODUCTION_TURNS = Object.freeze({
  furniture: 1,
  weapons: 1,
  pottery: 1,
  jewelry: 1,
});

export const PRODUCTS_WITH_TRANSFORMATION = Object.freeze([
  'furniture',
  'jewelry',
  'pottery',
  'weapons',
]);

export const FACTORY_RESOURCE_TYPES = Object.freeze([
  'wood',
  'rock',
  'clay',
  'iron',
  'gold',
]);

/** Max storage per resource/product (canonical game rules). */
export const FACTORY_MAX_STORAGE = Object.freeze({
  wood: 200,
  rock: 200,
  clay: 200,
  iron: 200,
  gold: 200,
  furniture: 100,
  weapons: 100,
  pottery: 100,
  jewelry: 100,
});

/** Workers required per factory resource/product line. */
export const FACTORY_EMPLOYEE_NEEDS = Object.freeze({
  wood: { worker_need: 2, type: 'bucheron' },
  rock: { worker_need: 2, type: 'mineur' },
  clay: { worker_need: 2, type: 'creuseur' },
  iron: { worker_need: 2, type: 'mineur' },
  gold: { worker_need: 2, type: 'mineur' },
  furniture: { worker_need: 2, type: 'menuisier' },
  weapons: { worker_need: 2, type: 'armurier' },
  pottery: { worker_need: 2, type: 'potier' },
  jewelry: { worker_need: 2, type: 'bijoutier' },
});

/**
 * @param {string} resourceType
 * @returns {number}
 */
export function getFactoryMaxStorage(resourceType) {
  return FACTORY_MAX_STORAGE[resourceType] ?? 200;
}

/**
 * @param {string} resourceType
 * @returns {number}
 */
export function getFactoryWorkerNeed(resourceType) {
  return FACTORY_EMPLOYEE_NEEDS[resourceType]?.worker_need ?? 2;
}

/**
 * @param {string} resourceType
 * @returns {string}
 */
export function getFactoryEmployeeRoleType(resourceType) {
  return FACTORY_EMPLOYEE_NEEDS[resourceType]?.type ?? 'worker';
}
