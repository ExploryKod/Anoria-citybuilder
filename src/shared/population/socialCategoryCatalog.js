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
 *         inverse of advancing. A tier's `requirements` are NOT merged
 *         with the previous tier's automatically — `HouseLevelPolicy.js`
 *         only ever checks the CURRENT tier (to decide demotion) or the
 *         NEXT tier (to decide advancement), never anything further back.
 *         So every requirement from an earlier tier that should still hold
 *         at a later one (e.g. faith coverage, required from tier 2 on) is
 *         repeated explicitly in every later tier's own list below — this
 *         is intentional cumulative gameplay design, not something the
 *         code infers.
 *       - `skills`: a `{ skillName: level }` map of citizen skills granted
 *         once a house is AT this tier or higher — see GroupSkillPolicy.js,
 *         the one policy that reads this regardless of how many tiers
 *         exist. A citizen's effective level for a skill is the MAX level
 *         declared for it across every tier ≤ the house's own level (so a
 *         skill can be granted again at a later tier to raise its level,
 *         e.g. `medical` 1 at tier 2 then `medical` 2 at tier 5 — the
 *         second entry doesn't need to repeat anything about the first). A
 *         workplace opts into hiring a skill via its own
 *         `employment.requiredSkill` fact (+ optional `requiredSkillLevel`,
 *         default 1) — see shared/asset-economy/buildingEconomy.js — the
 *         skill string is the join key between the two, declared once
 *         here. A citizen whose level for a skill is N can staff any
 *         workplace requiring that same skill at level ≤ N (a level-2
 *         `medical` citizen can also do a level-1 `medical` job).
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
 *
 * Tier ladder (2026-09-08, identical for all 3 categories — see
 * contexts/housing/docs/service-coverage.md "Tier ladder" section for the
 * full rationale and the gameplay test plan this was built for):
 *   1 (cabane)  — free starting tier, no requirements.
 *   2 (masure)  — road + faith (Chapel).
 *   3 (logis)   — + demandMet (food fully met, via market distribution) + doctor (Cabinet médical).
 *   4 (demeure) — + publicBath (Bains publics) + pub (Taverne).
 *   5 (manoir)  — + school (École) + cinema (Cinéma) + goodsVariety 2 (2 distinct food categories in the same period).
 * Population thresholds continue the pre-existing +4 progression (1/4/8/12).
 * Every building with `employment.workerNeed > 0` is wired to a skill
 * granted somewhere on this ladder (2026-09-10) — Library/Hospital/Theatre
 * included, even though none of the three is itself referenced by any
 * tier's `requirements` yet; wiring one into a gate later is a pure catalog
 * edit here, unrelated to whether it already has hiring staff.
 *
 * Tier 1 grants TWO skills to every group: `subsistence-forager` (unpaid
 * self-sufficiency — produces food outside the formal economy) and
 * `spiritual` (staffs Chapel). `spiritual` is deliberately the one skill
 * every group grants at tier 1: Chapel's own faith service is what tier 2
 * requires from every group, so it can't itself depend on any house
 * already being tier 2 — the same reasoning that already keeps tier 1's
 * `requirements` empty applies to needing at least one hireable skill
 * before any house has advanced at all.
 */
export const SOCIAL_CATEGORY = Object.freeze({
  artisans: Object.freeze({
    eligibleSectors: Object.freeze([1, 3, 4]),
    tiers: Object.freeze({
      1: Object.freeze({
        requirements: Object.freeze([]),
        skills: Object.freeze({ 'subsistence-forager': 1, spiritual: 1 }),
      }),
      2: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 1 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
        ]),
        // 'artisanat' (pottery workshops) — sector 3, this group's own
        // Industries sector (see eligibleSectors above), same tier as the
        // group's namesake trade.
        skills: Object.freeze({ fermier: 1, artisanat: 1 }),
      }),
      3: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 4 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
          Object.freeze({ kind: 'demandMet' }),
          Object.freeze({ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 }),
        ]),
        skills: Object.freeze({}),
      }),
      4: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 8 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
          Object.freeze({ kind: 'demandMet' }),
          Object.freeze({ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'publicBath', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'pub', coveragePeriods: 2 }),
        ]),
        skills: Object.freeze({}),
      }),
      5: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 12 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
          Object.freeze({ kind: 'demandMet' }),
          Object.freeze({ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'publicBath', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'pub', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'school', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'cinema', coveragePeriods: 2 }),
          Object.freeze({ kind: 'goodsVariety', min: 2 }),
        ]),
        skills: Object.freeze({}),
      }),
    }),
  }),
  merchants: Object.freeze({
    eligibleSectors: Object.freeze([2]),
    tiers: Object.freeze({
      1: Object.freeze({
        requirements: Object.freeze([]),
        skills: Object.freeze({ 'subsistence-forager': 1, spiritual: 1 }),
      }),
      2: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 1 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
        ]),
        skills: Object.freeze({ 'vente-alimentaire': 1 }),
      }),
      3: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 4 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
          Object.freeze({ kind: 'demandMet' }),
          Object.freeze({ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 }),
        ]),
        skills: Object.freeze({}),
      }),
      4: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 8 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
          Object.freeze({ kind: 'demandMet' }),
          Object.freeze({ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'publicBath', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'pub', coveragePeriods: 2 }),
        ]),
        skills: Object.freeze({}),
      }),
      5: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 12 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
          Object.freeze({ kind: 'demandMet' }),
          Object.freeze({ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'publicBath', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'pub', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'school', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'cinema', coveragePeriods: 2 }),
          Object.freeze({ kind: 'goodsVariety', min: 2 }),
        ]),
        skills: Object.freeze({}),
      }),
    }),
  }),
  scholars: Object.freeze({
    eligibleSectors: Object.freeze([6]),
    tiers: Object.freeze({
      1: Object.freeze({
        requirements: Object.freeze([]),
        skills: Object.freeze({ 'subsistence-forager': 1, spiritual: 1 }),
      }),
      2: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 1 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
        ]),
        // 'medical' 1 lands here (not at tier 3) so Doctor can already be
        // staffed BY the time some house first reaches tier 3 and starts
        // requiring `serviceCoverage: 'doctor'` — same reasoning applies to
        // every other new service skill's placement below: one tier ahead
        // of the earliest requirement that reads its category.
        skills: Object.freeze({ 'stockage-alimentaire': 1, medical: 1 }),
      }),
      3: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 4 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
          Object.freeze({ kind: 'demandMet' }),
          Object.freeze({ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 }),
        ]),
        // Ready ahead of tier 4's publicBath/pub requirements.
        skills: Object.freeze({ hygiene: 1, hospitality: 1 }),
      }),
      4: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 8 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
          Object.freeze({ kind: 'demandMet' }),
          Object.freeze({ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'publicBath', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'pub', coveragePeriods: 2 }),
        ]),
        // Ready ahead of tier 5's school/cinema requirements.
        skills: Object.freeze({ education: 1, entertainment: 1 }),
      }),
      5: Object.freeze({
        requirements: Object.freeze([
          Object.freeze({ kind: 'roadAccess' }),
          Object.freeze({ kind: 'population', min: 12 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }),
          Object.freeze({ kind: 'demandMet' }),
          Object.freeze({ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'publicBath', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'pub', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'school', coveragePeriods: 2 }),
          Object.freeze({ kind: 'serviceCoverage', category: 'cinema', coveragePeriods: 2 }),
          Object.freeze({ kind: 'goodsVariety', min: 2 }),
        ]),
        // Level-2 raise for the buildings not wired to any tier gate yet
        // (Hospital, Theatre) plus School (level-2 'education', bigger
        // staff than Library/BookShop's level-1) — end-game unlocks, no
        // house needs these to advance further.
        skills: Object.freeze({ medical: 2, entertainment: 2, education: 2 }),
      }),
    }),
  }),
});
