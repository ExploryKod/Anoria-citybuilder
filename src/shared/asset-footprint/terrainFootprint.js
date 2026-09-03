/**
 * Collision footprint (in tiles) for every villageTown-sourced terrain/zone
 * id — see resolveFootprint.js. Explicit for every id, no default: changing
 * a tile's footprint means editing exactly this one line, in this one file,
 * nothing else.
 *
 * @type {Readonly<Record<string, { width: number, depth: number }>>}
 */
export const TERRAIN_FOOTPRINT = Object.freeze({
  'grass': Object.freeze({ width: 1, depth: 1 }),
  'terrain': Object.freeze({ width: 1, depth: 1 }),
});
