/**
 * Building type id sets used by scene tick filters, info panel, mesh loader.
 * Pure data — no DOM / Three. Prefer these over lists in ui/shell/nodes.
 *
 * `houses`/`commerce` moved to presentation/three/assets/buildingCategories.js
 * — they're pure derivations of BUILDING_ASSETS's button.group (a
 * presentation fact), and shared/ must not depend on presentation/.
 */

import { KENNEY_CITY_KIT_BUILDING_IDS } from './kenneyCityKitRegistry.generated.js';

export const palaces = Object.freeze(['House-2Story']);

export const farms = Object.freeze(['Farm-Wheat', 'Farm-Carrot', 'Farm-Cabbage']);

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
  'Market-Stall-Blue',
  'Market-Stall-Red',
  'Tombstone-1',
  'Farm-Carrot',
  'Farm-Wheat',
  'Farm-Cabbage',
  'House-2Story',
  'Windmill-001',
  'Barn-001',
  ...KENNEY_CITY_KIT_BUILDING_IDS,
]);
