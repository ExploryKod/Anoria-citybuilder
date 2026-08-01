/**
 * Building type id sets used by scene tick filters, info panel, mesh loader.
 * Pure data — no DOM / Three. Prefer these over lists in ui/shell/nodes.
 */

export const houses = Object.freeze(['House-Red', 'House-Purple', 'House-Blue']);

/** @deprecated Alias of `houses` — kept for call sites that still name “first houses”. */
export const firstHouses = houses;

export const palaces = Object.freeze(['House-2Story']);

export const farms = Object.freeze(['Farm-Wheat', 'Farm-Carrot', 'Farm-Cabbage']);

export const commerce = Object.freeze(['Market-Stall']);

export const factories = Object.freeze(['Winery-001']);

/** Residential meshes the loader treats as house variants (incl. palace). */
export const wantedHouses = Object.freeze([
  'House-Blue',
  'House-Red',
  'House-Purple',
  'House-2Story',
]);

/** Types that open the building info overlay when selected. */
export const buildingsObjects = Object.freeze([
  'House-Red',
  'House-Purple',
  'House-Blue',
  'Market-Stall',
  'Tombstone-1',
  'Farm-Carrot',
  'Farm-Wheat',
  'Farm-Cabbage',
  'House-2Story',
  'Windmill-001',
  'Barn-001',
]);
