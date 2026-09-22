/**
 * Collision footprint (in tiles) for every building id — see
 * resolveFootprint.js, which only ever imports this (and its nature/terrain
 * siblings) and knows nothing about where any number came from. Explicit
 * for every hand-authored id, no default: changing a building's footprint
 * (e.g. making Windmill-001 bigger) means editing exactly this one line, in
 * this one file, nothing else.
 *
 * Kenney building ids are folded in from their own auto-generated registry
 * (scanned from the real GLB bounding box) — this file is the one place
 * that's allowed to know Kenney exists; resolveFootprint.js isn't.
 *
 * @type {Readonly<Record<string, { width: number, depth: number }>>}
 */

import { KENNEY_BUILDING_CATALOG_ENTRIES } from '../building-catalog/kenneyCityKitRegistry.generated.js';

export const BUILDING_FOOTPRINT = Object.freeze({
  ...Object.fromEntries(
    Object.entries(KENNEY_BUILDING_CATALOG_ENTRIES).map(([id, entry]) => [
      id,
      Object.freeze({ width: entry.construction.footprintWidth, depth: entry.construction.footprintDepth }),
    ])
  ),
  'BookShop-001': Object.freeze({ width: 1, depth: 1 }),
  'Church-002': Object.freeze({ width: 1, depth: 1 }),
  // Service layers reassign their geometry to Kenney commercial/industrial
  // meshes (see buildingAssets.js) — footprint must match that prefab's real
  // size, same reasoning as House-Blue/Purple/Red below.
  'Chapel': Object.freeze({ width: 3, depth: 2 }),
  'Cinema': Object.freeze({ width: 2, depth: 2 }),
  'Doctor': Object.freeze({ width: 1, depth: 1 }),
  'Hospital': Object.freeze({ width: 3, depth: 2 }),
  'Library': Object.freeze({ width: 1, depth: 1 }),
  'Pub': Object.freeze({ width: 2, depth: 1 }),
  'PublicBath': Object.freeze({ width: 2, depth: 2 }),
  'School': Object.freeze({ width: 2, depth: 2 }),
  'Theatre': Object.freeze({ width: 3, depth: 2 }),
  'Crate-001': Object.freeze({ width: 1, depth: 1 }),
  // Cylinder/Windmill-001 reassign their geometry to a Kenney industrial mesh
  // (see buildingAssets.js) whose real bounding box is 1x2 — footprint must
  // match that prefab's real size, same reasoning as the pottery workshops
  // and House-Blue/Purple/Red below (a mismatch here is what makes the mesh
  // straddle its neighbour tile at placement time).
  'Cylinder': Object.freeze({ width: 1, depth: 2 }),
  'Farm-Cabbage': Object.freeze({ width: 1, depth: 1 }),
  'Farm-Carrot': Object.freeze({ width: 1, depth: 1 }),
  'Farm-Wheat': Object.freeze({ width: 1, depth: 1 }),
  // Pottery workshops reassign their geometry to Kenney industrial meshes
  // (see buildingAssets.js) — footprint must match that prefab's real size.
  'Factory-Amphora': Object.freeze({ width: 2, depth: 2 }),
  'Factory-Plate': Object.freeze({ width: 1, depth: 2 }),
  'Factory-Pot': Object.freeze({ width: 2, depth: 2 }),
  'Hay-Bale': Object.freeze({ width: 1, depth: 1 }),
  'Hay-Cart': Object.freeze({ width: 1, depth: 1 }),
  'Hay-Pile': Object.freeze({ width: 1, depth: 1 }),
  'House-2Story': Object.freeze({ width: 1, depth: 1 }),
  // House-Blue/Purple/Red reassign their geometry to Kenney suburban
  // building-type-b/c/a (see buildingAssets.js) — footprint must match that
  // prefab's real size, not the village-era 1x1 these ids used to be.
  'House-Blue': Object.freeze({ width: 2, depth: 2 }),
  'House-Purple': Object.freeze({ width: 2, depth: 1 }),
  'House-Red': Object.freeze({ width: 2, depth: 1 }),
  'Market-Stall': Object.freeze({ width: 1, depth: 1 }),
  'Market-Stall-Blue': Object.freeze({ width: 1, depth: 1 }),
  'Market-Stall-Red': Object.freeze({ width: 1, depth: 1 }),
  'StonePath-001': Object.freeze({ width: 1, depth: 1 }),
  'StonePath-Cross-001': Object.freeze({ width: 1, depth: 1 }),
  'StonePath-Tee-001': Object.freeze({ width: 1, depth: 1 }),
  'StonePath-End-001': Object.freeze({ width: 1, depth: 1 }),
  'StonePath-Left-001': Object.freeze({ width: 1, depth: 1 }),
  'StonePath-Right-001': Object.freeze({ width: 1, depth: 1 }),
  'Windmill-001': Object.freeze({ width: 1, depth: 2 }),
});
