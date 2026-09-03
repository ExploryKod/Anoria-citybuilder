/**
 * Collision footprint overrides for terrain/zone ids whose placement size
 * isn't the 1×1 default — see resolveFootprint.js.
 *
 * Sparse by design: empty today (grass/terrain are both 1×1) — add an entry
 * only when a real id needs a real override.
 *
 * @type {Readonly<Record<string, { width: number, depth: number }>>}
 */
export const TERRAIN_FOOTPRINT_OVERRIDES = Object.freeze({});
