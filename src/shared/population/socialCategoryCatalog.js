/**
 * Single source of truth for the 3 social categories (Artisans / Savants /
 * Commerçants — French display labels live in presentation, not here) and
 * the facts tied to a category itself rather than to any one building:
 *   - `tiers`: this category's house-progression ladder, keyed by tier
 *     number (what was called `level` elsewhere — a house's own stored
 *     tier number). Any number of tiers is supported, each declaring:
 *       - `requirements`: what must hold to ADVANCE from the previous tier
 *         into this one — a list of `{ kind, ...params }` objects, each
 *         `kind` evaluated by contexts/housing/domain/policies/
 *         HouseTierRequirementPolicy.js. Empty for tier 1 (the starting
 *         tier — nothing to require). Losing a tier's own requirements
 *         (e.g. road access) demotes a house back down, exactly the
 *         inverse of advancing.
 *       - `skills`: citizen skills granted once a house is AT this tier
 *         or higher — see GroupSkillPolicy.js, the one policy that reads
 *         this regardless of how many tiers exist. A workplace opts into
 *         hiring a skill via its own `employment.requiredSkill` fact (see
 *         shared/asset-economy/buildingEconomy.js) — the skill string is
 *         the join key between the two, declared once here.
 *     Adding a tier, changing what unlocks it, or changing what it grants
 *     is a catalog edit here, never a code change in the policies that
 *     read it.
 *   - `eligibleSectors`: which employment sectors this category's citizens
 *     may be counted against in the per-group employment summary (see
 *     contexts/employment/domain/computeCityEmploymentSummary.js). This is
 *     a coarser, sector-level fact used only for that summary/HUD
 *     breakdown — the actual worker-to-workplace assignment is skill-based,
 *     via `tiers[N].skills` above and each building's `requiredSkill`.
 *
 * Data only — no functions that compute or decide anything, no imports from
 * `src/contexts/**`. Same hard rules as buildingCatalog.js.
 */
export const SOCIAL_CATEGORY = Object.freeze({
  artisans: Object.freeze({
    eligibleSectors: Object.freeze([1, 3, 4]),
    tiers: Object.freeze({
      1: Object.freeze({
        requirements: Object.freeze([]),
        skills: Object.freeze(['subsistence-forager']),
      }),
      2: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 1 }),
        ]),
        skills: Object.freeze(['fermier']),
      }),
    }),
  }),
  merchants: Object.freeze({
    eligibleSectors: Object.freeze([2]),
    tiers: Object.freeze({
      1: Object.freeze({
        requirements: Object.freeze([]),
        skills: Object.freeze(['subsistence-forager']),
      }),
      2: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 1 }),
        ]),
        skills: Object.freeze(['vente-alimentaire']),
      }),
    }),
  }),
  scholars: Object.freeze({
    eligibleSectors: Object.freeze([6]),
    tiers: Object.freeze({
      1: Object.freeze({
        requirements: Object.freeze([]),
        skills: Object.freeze(['subsistence-forager']),
      }),
      2: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 1 }),
        ]),
        skills: Object.freeze(['stockage-alimentaire']),
      }),
    }),
  }),
});
