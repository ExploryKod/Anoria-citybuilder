/**
 * Collision footprint (in tiles) for every nature id — see resolveFootprint.js. Explicit for every id, no
 * default: changing an asset's footprint means editing exactly this one
 * line, in this one file, nothing else.
 *
 * @type {Readonly<Record<string, { width: number, depth: number }>>}
 */
export const NATURE_FOOTPRINT = Object.freeze({
  'Boulder-001': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Arbuste': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Chene': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Pine-001': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Sapin': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Square-001': Object.freeze({ width: 1, depth: 1 }),
  'Tree-Tall-001': Object.freeze({ width: 1, depth: 1 }),
});
