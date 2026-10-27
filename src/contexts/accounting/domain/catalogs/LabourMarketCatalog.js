/**
 * The labour market: what a first wage is and how fast the market moves it. Declared once, here.
 *
 * Each skill has its own wage, settled by the market from the month's shortage or slack (see WageRatePolicy.js): it
 * starts at the value below and moves a few percent a month, never under the city's minimum wage. The wage a building pays its workers is
 * the rate of the skill its workplace requires. A skill has one level only: what a more advanced trade is (hospital medicine against local medicine) is a skill of its own.
 *
 * - `START_WAGE_BASE` and `START_WAGE_BY_SKILL`: a monthly gross wage before the market has moved it, the base for a skill that is not listed, the listed value for the advanced trades. First values, to tune with a play-through, set on the
 *   economy's own scale: a citizen's needs cost about 5.8 a month at today's prices (food 1.1, goods 3.6, heat and light 0.5, water and energy
 *   0.6), and what a worker produces is worth 6 to 15 a month at the producers' price (a farm about 8, a lumberjack 6, a pottery 9 to 15), so a first
 *   wage is a little above a citizen's needs and under what a worker produces.
 * - `WAGE_ADJUSTMENT.maxMonthlyStep`: the most a wage moves in one month (a fraction), so it cannot jump.
 * - `WAGE_ADJUSTMENT.pressureGain`: how much of the market's pressure (the share of jobs unfilled, or of qualified citizens idle) turns into a
 *   move; a full shortage with a gain of 0.5 asks for +50 %, which the step caps.
 */

/** The monthly gross wage a skill starts at when it is not listed below. */
export const START_WAGE_BASE = 8;

/** @type {Readonly<Record<string, number>>} the advanced trades, which start above the base: skill → monthly gross wage */
export const START_WAGE_BY_SKILL = Object.freeze({ 'artisanat-specialise': 11, 'energie-nucleaire': 11, 'medecine-hospitaliere': 11, 'arts-scene': 11 });

/**
 * The cost of living: what a month costs one citizen of a reference household, at the prices on the shelves (see CostOfLivingPolicy.js).
 * - What a citizen uses up (food, goods, heat, light, water, energy) is read from the catalog's quantity needs of `houseType`.
 * - The services a house is billed (a doctor, a fire station...) are one unit a month per house, whatever its residents: the ones the
 *   `tier` of the house ladder requires (`serviceCoverage` in socialCategoryCatalog.js), shared between the residents of a full house of that tier.
 * The first tier with requirements (2) is the entry household: the one a minimum wage has to keep alive.
 * @type {Readonly<{ houseType: string, tier: number }>}
 */
export const COST_OF_LIVING_BASKET = Object.freeze({ houseType: 'House-Red', tier: 2 });

export const WAGE_ADJUSTMENT =Object.freeze({ maxMonthlyStep: 0.05, pressureGain: 0.5 });
