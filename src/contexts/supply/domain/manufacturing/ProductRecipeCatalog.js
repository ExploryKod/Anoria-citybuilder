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
