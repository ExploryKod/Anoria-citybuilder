/**
 * Collision footprint (in tiles) for every villageTown-sourced nature/
 * decoration/tombs id — see resolveFootprint.js. Explicit for every id, no
 * default: changing an asset's footprint means editing exactly this one
 * line, in this one file, nothing else.
 *
 * @type {Readonly<Record<string, { width: number, depth: number }>>}
 */
export const NATURE_FOOTPRINT = Object.freeze({
  'Arch': Object.freeze({ width: 1, depth: 1 }),
  'Barrell': Object.freeze({ width: 1, depth: 1 }),
  'Bench': Object.freeze({ width: 1, depth: 1 }),
  'Boulder-001': Object.freeze({ width: 1, depth: 1 }),
  'Coffin': Object.freeze({ width: 1, depth: 1 }),
  'Cube': Object.freeze({ width: 1, depth: 1 }),
  'Daisy': Object.freeze({ width: 1, depth: 1 }),
  'Fence-001': Object.freeze({ width: 1, depth: 1 }),
  'Fountain-001': Object.freeze({ width: 1, depth: 1 }),
  'Garland': Object.freeze({ width: 1, depth: 1 }),
  'Grave-1': Object.freeze({ width: 1, depth: 1 }),
  'Grave-2': Object.freeze({ width: 1, depth: 1 }),
  'Obelisk': Object.freeze({ width: 1, depth: 1 }),
  'Picnic-Table': Object.freeze({ width: 1, depth: 1 }),
  'Pillar': Object.freeze({ width: 1, depth: 1 }),
  'Plane-001': Object.freeze({ width: 1, depth: 1 }),
  'Plane-004': Object.freeze({ width: 1, depth: 1 }),
  'Plane-007': Object.freeze({ width: 1, depth: 1 }),
  'Pond-001': Object.freeze({ width: 1, depth: 1 }),
  'Potted-Bush': Object.freeze({ width: 1, depth: 1 }),
  'Shroom': Object.freeze({ width: 1, depth: 1 }),
  'Sphere-001': Object.freeze({ width: 1, depth: 1 }),
  'Sphere-002': Object.freeze({ width: 1, depth: 1 }),
  'Streetlight-001': Object.freeze({ width: 1, depth: 1 }),
  'Tomb': Object.freeze({ width: 1, depth: 1 }),
  'Tombstone-1': Object.freeze({ width: 1, depth: 1 }),
  'Tombstone-2': Object.freeze({ width: 1, depth: 1 }),
  'Tombstone-3': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Arbuste': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Chene': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Pine-001': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Sapin': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Square-001': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Tall-001': Object.freeze({ width: 1, depth: 1 }),
  'Well-001': Object.freeze({ width: 1, depth: 1 }),
});
