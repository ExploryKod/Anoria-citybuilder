/**
 * Population ceiling of a house at each tier — declared ONCE and referenced by
 * every category's tier (`maxPopulation`), so the numbers live nowhere else.
 * A category that should differ overrides its own tier's `maxPopulation`.
 * Read by HouseCapacityPolicy.maxPopulationForLevel.
 */
const TIER_MAX_POPULATION = Object.freeze({ 1: 6, 2: 12, 3: 18, 4: 24, 5: 30, 6: 36 });

/** The city's administrators (the mayor's house): six, whatever the tier. */
const ADMINISTRATORS_MAX = 6;

/**
 * The skills the administrators hold, named once: the owner (collects the rents, from the first tier) and one tax collection per tax. A tax
 * nobody holds the collection of is not levied. Every rule that asks for one reads the name here, never spells it.
 */
export const OWNER_SKILL = 'proprietaire';
export const TAX_COLLECTION_SKILLS = Object.freeze({
  citizen: 'perception_ic',
  income: 'perception_ir',
  vat: 'perception_tva',
  corporate: 'perception_is',
  customs: 'perception_douane',
});

/**
 * The requirements a tier can list, declared once and combined below (a kind is evaluated by
 * contexts/housing/domain/policies/HouseTierRequirementPolicy.js). Each tier repeats every earlier one explicitly:
 * `HouseLevelPolicy.js` only ever checks the CURRENT tier (to decide demotion) or the NEXT one (to decide advancement).
 */
const ROAD = Object.freeze({ kind: 'roadAccess' });
const population = (min) => Object.freeze({ kind: 'population', min });
/** The diet is fully met (a market reaches the house with food). */
const FOOD = Object.freeze({ kind: 'demandMet' });
/** A quantity need served by a building (water by a tank, energy by a plant), fully met this period. */
const need = (category, outcomeField) => Object.freeze({ kind: 'serviceDemandMet', category, outcomeField });
const WATER = need('water', 'lastWaterConsumption');
const ENERGY = need('energy', 'lastEnergyConsumption');
/** A service building reaches the house (a coverage flag kept for `coveragePeriods` periods). */
const covered = (category) => Object.freeze({ kind: 'serviceCoverage', category, coveragePeriods: 2 });
/** At least `min` kinds of the retail goods (pot, plate, amphora, furniture) were drawn this period. */
const goods = (min) => Object.freeze({ kind: 'goodsVariety', min, outcomeField: 'lastGoodsConsumption' });
/** The house's own business can reach a warehouse. */
const WAREHOUSE_ACCESS = Object.freeze({ kind: 'activityAccess' });

/**
 * Single source of truth for the 3 social categories (Artisans / Commerçants /
 * Savants — French display labels live in presentation, not here) and
 * the facts tied to a category itself rather than to any one building:
 *   - `tiers`: this category's house-progression ladder, keyed by tier
 *     number (what was called `level` elsewhere — a house's own stored
 *     tier number). Any number of tiers is supported, each declaring:
 *       - `requirements`: what must hold to ADVANCE from the previous tier
 *         into this one — a list of `{ kind, ...params }` objects, each
 *         `kind` evaluated by HouseTierRequirementPolicy.js. Empty for tier 1
 *         (the starting tier). Losing a tier's own requirements (e.g. road
 *         access) demotes a house back down, exactly the inverse of advancing.
 *         A tier's `requirements` are NOT merged with the previous tier's
 *         automatically, so every earlier requirement that should still hold
 *         is repeated explicitly in every later tier's own list below — this is
 *         intentional cumulative gameplay design, not something the code infers.
 *       - `skills`: a `{ skillName: level }` map of citizen skills granted
 *         once a house is AT this tier or higher — see GroupSkillPolicy.js.
 *         A citizen's effective level for a skill is the MAX level declared
 *         for it across every tier ≤ the house's own level. A workplace opts
 *         into hiring a skill via its own `employment.requiredSkill` fact
 *         (+ optional `requiredSkillLevel`, default 1) — see
 *         shared/asset-economy/buildingEconomy.js; the skill string is the join
 *         key between the two, declared once here.
 *     Adding a tier, changing what unlocks it, or changing what it grants
 *     is a catalog edit here, never a code change in the policies that read it.
 *   - `eligibleSectors`: which employment sectors this category's citizens
 *     may be counted against in the per-group employment summary (see
 *     contexts/employment/domain/computeCityEmploymentSummary.js) — a coarse
 *     fact for that summary/HUD only; the actual worker-to-workplace
 *     assignment is skill-based.
 *
 * Data only — no functions that compute or decide anything, no imports from
 * `src/contexts/**`. Same hard rules as buildingCatalog.js.
 *
 * THE LADDER (2026-10-11, identical for the 3 categories; only the skills a class holds differ). Read a row as: what a
 * house AT that level needs, met, to evolve to the next level (= the next tier's `requirements`); and the skills it holds
 * once it is at it, one level AHEAD of the buildings they staff (a tier's list can only be met if its buildings can be
 * run already), exactly as the old ladder did:
 *   1 (cabane)  — starts free. Needs food (a market), water (a tank), a dispensary (Doctor).
 *                 Skills: farmer (artisans), food sale and storage (merchants), water and medicine (savants).
 *   2           — + one retail good, fire cover (fire station), a warehouse within reach of its business, energy (a plant).
 *                 Skills: the pottery, wood and oil chains and energy (artisans), handling and finance (merchants), fire (savants).
 *   3           — + two retail goods, a hospital, a police station, a café-restaurant (the Taverne).
 *                 Skills: the other industry chains and telecoms (artisans), hospitality (merchants), the hospital and police (savants).
 *   4, 5, 6     — placeholders made of the services the old ladder kept (public bath, school, theatre, cinema, library) and
 *                 more retail goods, to be redesigned.
 * Population thresholds continue the +4 progression (1/4/8/12/16). Every building with `employment.workerNeed > 0` is wired
 * to a skill granted somewhere on this ladder.
 */
export const SOCIAL_CATEGORY = Object.freeze({
  artisans: Object.freeze({
    eligibleSectors: Object.freeze([1, 3, 4]),
    tiers: Object.freeze({
      1: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[1],
        requirements: Object.freeze([]),
        skills: Object.freeze({ fermier: 1 }),
      }),
      2: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[2],
        requirements: Object.freeze([ROAD, population(1), FOOD, WATER, covered('doctor')]),
        skills: Object.freeze({ artisanat: 1, energie: 1 }),
      }),
      3: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[3],
        requirements: Object.freeze([ROAD, population(4), FOOD, WATER, covered('doctor'), goods(1), covered('fire'), WAREHOUSE_ACCESS, ENERGY]),
        skills: Object.freeze({ artisanat: 2, telecoms: 1, energie: 2 }),
      }),
      4: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[4],
        requirements: Object.freeze([
          ROAD, population(8), FOOD, WATER, covered('doctor'), goods(2), covered('fire'), WAREHOUSE_ACCESS, ENERGY,
          covered('hospital'), covered('police'), covered('pub'),
        ]),
        skills: Object.freeze({}),
      }),
      5: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[5],
        requirements: Object.freeze([
          ROAD, population(12), FOOD, WATER, covered('doctor'), goods(3), covered('fire'), WAREHOUSE_ACCESS, ENERGY,
          covered('hospital'), covered('police'), covered('pub'), covered('school'),
        ]),
        skills: Object.freeze({}),
      }),
      6: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[6],
        requirements: Object.freeze([
          ROAD, population(16), FOOD, WATER, covered('doctor'), goods(4), covered('fire'), WAREHOUSE_ACCESS, ENERGY,
          covered('hospital'), covered('police'), covered('pub'), covered('school'),
          covered('theatre'), covered('cinema'), covered('library'),
        ]),
        skills: Object.freeze({}),
      }),
    }),
  }),
  merchants: Object.freeze({
    eligibleSectors: Object.freeze([2]),
    tiers: Object.freeze({
      1: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[1],
        requirements: Object.freeze([]),
        skills: Object.freeze({ 'vente-alimentaire': 1, 'stockage-alimentaire': 1 }),
      }),
      2: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[2],
        requirements: Object.freeze([ROAD, population(1), FOOD, WATER, covered('doctor')]),
        // 'manutention' (the warehouses, the trade warehouse) and 'finance' (the bank): the group's own Commerces sector.
        skills: Object.freeze({ finance: 1, manutention: 1 }),
      }),
      3: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[3],
        requirements: Object.freeze([ROAD, population(4), FOOD, WATER, covered('doctor'), goods(1), covered('fire'), WAREHOUSE_ACCESS, ENERGY]),
        skills: Object.freeze({ hospitality: 1 }),
      }),
      4: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[4],
        requirements: Object.freeze([
          ROAD, population(8), FOOD, WATER, covered('doctor'), goods(2), covered('fire'), WAREHOUSE_ACCESS, ENERGY,
          covered('hospital'), covered('police'), covered('pub'),
        ]),
        skills: Object.freeze({}),
      }),
      5: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[5],
        requirements: Object.freeze([
          ROAD, population(12), FOOD, WATER, covered('doctor'), goods(3), covered('fire'), WAREHOUSE_ACCESS, ENERGY,
          covered('hospital'), covered('police'), covered('pub'), covered('school'),
        ]),
        skills: Object.freeze({}),
      }),
      6: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[6],
        requirements: Object.freeze([
          ROAD, population(16), FOOD, WATER, covered('doctor'), goods(4), covered('fire'), WAREHOUSE_ACCESS, ENERGY,
          covered('hospital'), covered('police'), covered('pub'), covered('school'),
          covered('theatre'), covered('cinema'), covered('library'),
        ]),
        skills: Object.freeze({}),
      }),
    }),
  }),
  scholars: Object.freeze({
    eligibleSectors: Object.freeze([6]),
    tiers: Object.freeze({
      1: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[1],
        requirements: Object.freeze([]),
        // The water tank and the dispensary (Doctor) the first tier needs are staffed from the start.
        skills: Object.freeze({ hydraulique: 1, medical: 1 }),
      }),
      2: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[2],
        requirements: Object.freeze([ROAD, population(1), FOOD, WATER, covered('doctor')]),
        skills: Object.freeze({ incendie: 1 }),
      }),
      3: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[3],
        requirements: Object.freeze([ROAD, population(4), FOOD, WATER, covered('doctor'), goods(1), covered('fire'), WAREHOUSE_ACCESS, ENERGY]),
        // The hospital (medical, level 2) and the police station gate tier 4: ready one tier ahead.
        skills: Object.freeze({ medical: 2, securite: 1 }),
      }),
      4: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[4],
        requirements: Object.freeze([
          ROAD, population(8), FOOD, WATER, covered('doctor'), goods(2), covered('fire'), WAREHOUSE_ACCESS, ENERGY,
          covered('hospital'), covered('police'), covered('pub'),
        ]),
        // Ready ahead of tier 5's school.
        skills: Object.freeze({ education: 1 }),
      }),
      5: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[5],
        requirements: Object.freeze([
          ROAD, population(12), FOOD, WATER, covered('doctor'), goods(3), covered('fire'), WAREHOUSE_ACCESS, ENERGY,
          covered('hospital'), covered('police'), covered('pub'), covered('school'),
        ]),
        // Ready ahead of tier 6's theatre (entertainment, level 2), cinema and library.
        skills: Object.freeze({ entertainment: 2 }),
      }),
      6: Object.freeze({
        maxPopulation: TIER_MAX_POPULATION[6],
        requirements: Object.freeze([
          ROAD, population(16), FOOD, WATER, covered('doctor'), goods(4), covered('fire'), WAREHOUSE_ACCESS, ENERGY,
          covered('hospital'), covered('police'), covered('pub'), covered('school'),
          covered('theatre'), covered('cinema'), covered('library'),
        ]),
        skills: Object.freeze({}),
      }),
    }),
  }),
  // The city's administrators (the mayor's house): six at most, whatever the tier. From the first tier, with no requirement, they hold
  // `proprietaire` (collects the rents and lets the other houses be built, see the houses' `requiresPlaced`) and the collection of the simple
  // taxes (citizen, income, VAT). The second tier adds the collection of the companies' tax and of the customs. No workplace asks for any of them
  // as a worker: they are the house's own functions, and the house reaches its tiers only while its needs are paid (so while its stipend is enough).
  administrators: Object.freeze({
    eligibleSectors: Object.freeze([]),
    // Governing is not a post of the labour market (see workforceQueries.js): no hiring, no unemployment, no benefit.
    seeksWork: false,
    tiers: Object.freeze({
      1: Object.freeze({
        maxPopulation: ADMINISTRATORS_MAX,
        requirements: Object.freeze([]),
        skills: Object.freeze({
          [OWNER_SKILL]: 1,
          [TAX_COLLECTION_SKILLS.citizen]: 1,
          [TAX_COLLECTION_SKILLS.income]: 1,
          [TAX_COLLECTION_SKILLS.vat]: 1,
        }),
      }),
      2: Object.freeze({
        maxPopulation: ADMINISTRATORS_MAX,
        requirements: Object.freeze([ROAD, population(1), FOOD, WATER, covered('doctor')]),
        skills: Object.freeze({ [TAX_COLLECTION_SKILLS.corporate]: 1, [TAX_COLLECTION_SKILLS.customs]: 1 }),
      }),
      3: Object.freeze({
        maxPopulation: ADMINISTRATORS_MAX,
        requirements: Object.freeze([ROAD, population(4), FOOD, WATER, covered('doctor'), goods(1), covered('fire'), WAREHOUSE_ACCESS, ENERGY]),
        skills: Object.freeze({}),
      }),
    }),
  }),
});
