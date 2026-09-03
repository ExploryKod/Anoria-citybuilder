/**
 * Collision footprint overrides for villageTown-sourced building ids whose
 * placement size isn't the 1×1 default — see resolveFootprint.js for how
 * this combines with Kenney's auto-generated footprint and the default.
 *
 * Sparse by design: an id not listed here is 1×1. Don't add an entry that
 * just restates the default.
 *
 * @type {Readonly<Record<string, { width: number, depth: number }>>}
 */
export const BUILDING_FOOTPRINT_OVERRIDES = Object.freeze({
  'Barn-001': Object.freeze({ width: 2, depth: 2 }),
});
