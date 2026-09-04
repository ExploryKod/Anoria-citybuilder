/**
 * Single source of truth for the 3 social categories (Artisans / Savants /
 * Commerçants — French display labels live in presentation, not here) and
 * the facts tied to a category itself rather than to any one building:
 *   - `skillsByLevel`: which citizen skills a house of this category grants
 *     at each house level, keyed by level number. Not assumed to have
 *     exactly one skill, or to only grant something at level 2 — a level can
 *     declare any number of skills (including none, or the same skill
 *     another category also declares), and any level number can have an
 *     entry as house progression grows more tiers. A citizen's actual skill
 *     set at a given level is the union of every level's list up to and
 *     including their own (see GroupSkillPolicy.js — the one, level-generic
 *     policy that reads this table; it never hardcodes a level number).
 *     A workplace opts into hiring a skill via its own
 *     `employment.requiredSkill` fact (see shared/asset-economy/buildingEconomy.js)
 *     — the skill string is the join key between the two, declared once here.
 *   - `eligibleSectors`: which employment sectors this category's citizens
 *     may be counted against in the per-group employment summary (see
 *     contexts/employment/domain/computeCityEmploymentSummary.js). This is a
 *     coarser, sector-level fact used only for that summary/HUD breakdown —
 *     the actual worker-to-workplace assignment is skill-based, via
 *     `skillsByLevel` above and each building's `requiredSkill`.
 *
 * Data only — no functions that compute or decide anything, no imports from
 * `src/contexts/**`. Same hard rules as buildingCatalog.js.
 */
export const SOCIAL_CATEGORY = Object.freeze({
  artisans: Object.freeze({
    eligibleSectors: Object.freeze([1, 3, 4]),
    skillsByLevel: Object.freeze({
      1: Object.freeze(['subsistence-forager']),
      2: Object.freeze(['fermier']),
    }),
  }),
  merchants: Object.freeze({
    eligibleSectors: Object.freeze([2]),
    skillsByLevel: Object.freeze({
      1: Object.freeze(['subsistence-forager']),
      2: Object.freeze(['vente-alimentaire']),
    }),
  }),
  scholars: Object.freeze({
    eligibleSectors: Object.freeze([6]),
    skillsByLevel: Object.freeze({
      1: Object.freeze(['subsistence-forager']),
      2: Object.freeze(['stockage-alimentaire']),
    }),
  }),
});
