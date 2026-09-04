/**
 * Single source of truth for the 3 social categories (Artisans / Savants /
 * Commerçants — French display labels live in presentation, not here) and
 * the facts tied to a category itself rather than to any one building:
 *   - `skill`: the profession skill a level-2 house of this category grants
 *     its citizens (see contexts/housing/domain/policies/GroupLevel2SkillPolicy.js).
 *     A workplace opts into hiring that skill via its own
 *     `employment.requiredSkill` fact (see shared/asset-economy/buildingEconomy.js)
 *     — the skill string is the join key between the two, declared once here.
 *   - `eligibleSectors`: which employment sectors this category's citizens
 *     may be counted against in the per-group employment summary (see
 *     contexts/employment/domain/computeCityEmploymentSummary.js). This is a
 *     coarser, sector-level fact used only for that summary/HUD breakdown —
 *     the actual worker-to-workplace assignment is skill-based, via `skill`
 *     above and each building's `requiredSkill`.
 *
 * Data only — no functions that compute or decide anything, no imports from
 * `src/contexts/**`. Same hard rules as buildingCatalog.js.
 */
export const SOCIAL_CATEGORY = Object.freeze({
  artisans: Object.freeze({ skill: 'fermier', eligibleSectors: Object.freeze([1, 3, 4]) }),
  merchants: Object.freeze({ skill: 'vente-alimentaire', eligibleSectors: Object.freeze([2]) }),
  scholars: Object.freeze({ skill: 'stockage-alimentaire', eligibleSectors: Object.freeze([6]) }),
});
