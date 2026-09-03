/**
 * Collision footprint overrides for nature/decoration/tombs ids whose
 * placement size isn't the 1×1 default — see resolveFootprint.js.
 *
 * Sparse by design: empty today (every current nature/decoration/tombs id
 * is 1×1) — add an entry only when a real id needs a real override.
 *
 * @type {Readonly<Record<string, { width: number, depth: number }>>}
 */
export const NATURE_FOOTPRINT_OVERRIDES = Object.freeze({});
