/**
 * Collision footprint (in tiles) for every building id — see
 * resolveFootprint.js, which only ever imports this (and its nature/terrain
 * siblings) and knows nothing about where any number came from. Explicit
 * for every hand-authored id, no default: changing a building's footprint
 * (e.g. making Barn-001 bigger) means editing exactly this one line, in
 * this one file, nothing else.
 *
 * Kenney building ids are folded in from their own auto-generated registry
 * (scanned from the real GLB bounding box) — this file is the one place
 * that's allowed to know Kenney exists; resolveFootprint.js isn't.
 *
 * @type {Readonly<Record<string, { width: number, depth: number }>>}
 */

import { KENNEY_BUILDING_CATALOG_ENTRIES } from '../building-catalog/kenneyCityKitRegistry.generated.js';

const KENNEY_BUILDING_FOOTPRINT = Object.freeze(
  Object.fromEntries(
    Object.entries(KENNEY_BUILDING_CATALOG_ENTRIES).map(([id, entry]) => [
      id,
      Object.freeze({ width: entry.construction.footprintWidth, depth: entry.construction.footprintDepth }),
    ])
  )
);

export const BUILDING_FOOTPRINT = Object.freeze({
  ...KENNEY_BUILDING_FOOTPRINT,
  'Barn-001': Object.freeze({ width: 2, depth: 2 }),
  'BookShop-001': Object.freeze({ width: 1, depth: 1 }),
  'Chapel': Object.freeze({ width: 1, depth: 1 }),
  'Church-002': Object.freeze({ width: 1, depth: 1 }),
  'Crate-001': Object.freeze({ width: 1, depth: 1 }),
  'Cylinder': Object.freeze({ width: 1, depth: 1 }),
  'Farm-Cabbage': Object.freeze({ width: 1, depth: 1 }),
  'Farm-Carrot': Object.freeze({ width: 1, depth: 1 }),
  'Farm-Wheat': Object.freeze({ width: 1, depth: 1 }),
  'Hay-Bale': Object.freeze({ width: 1, depth: 1 }),
  'Hay-Cart': Object.freeze({ width: 1, depth: 1 }),
  'Hay-Pile': Object.freeze({ width: 1, depth: 1 }),
  'House-2Story': Object.freeze({ width: 1, depth: 1 }),
  'House-Blue': Object.freeze({ width: 1, depth: 1 }),
  'House-Purple': Object.freeze({ width: 1, depth: 1 }),
  'House-Red': Object.freeze({ width: 1, depth: 1 }),
  'Market-Stall': Object.freeze({ width: 1, depth: 1 }),
  'Market-Stall-Blue': Object.freeze({ width: 1, depth: 1 }),
  'Market-Stall-Red': Object.freeze({ width: 1, depth: 1 }),
  'StonePath-001': Object.freeze({ width: 1, depth: 1 }),
  'StonePath-Cross-001': Object.freeze({ width: 1, depth: 1 }),
  'StonePath-Left-001': Object.freeze({ width: 1, depth: 1 }),
  'StonePath-Right-001': Object.freeze({ width: 1, depth: 1 }),
  'Windmill-001': Object.freeze({ width: 1, depth: 1 }),
  'Winery-001': Object.freeze({ width: 1, depth: 1 }),
});
