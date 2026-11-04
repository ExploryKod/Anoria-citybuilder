import { HEALTH_MAX } from './CitizenCatalog.js';
import { SERVICE_COVERAGE_PERIODS } from './socialCategoryCatalog.js';

/**
 * What a house gives its inhabitants for their health: declared here, once. The engine (`HealthEnvironmentPolicy`) and the
 * display (the histogram of a house) read this same list: the histogram is the breakdown of the real calculation, never a second
 * reader of the same facts.
 *
 * The environment level of a house is `HEALTH_BASE_LEVEL` plus the points of every factor it meets. A citizen's health moves each
 * month towards that level (see `HealthEvolutionPolicy`).
 *
 * A factor reads a fact of the house through one of the tier requirements' `kind` (HouseTierRequirementPolicy.js): the same facts the
 * house's ladder reads, so a house is "served" for its health exactly when it is served for its level.
 *   - `measure: 'met'`: `points` when the requirement is met.
 *   - `measure: 'current'`: `pointsPerUnit` for each unit the requirement counts (here, each kind of food), up to `maxUnits`.
 *
 * Adding or changing a factor is an edit here, nothing else. The points are a first balance, to be tuned here.
 */

/**
 * A citizen whose health is below this is sick. Chosen so that a house with water and one kind of food (40 + 12 + 8 = 60) is well clear of
 * it, and one that gives almost nothing (the base, 40) is not far under: only a neglected house falls into it. Tuned here, nowhere else.
 */
export const HEALTH_SICK_BELOW = 45;

/** The words the player reads about health besides the factors' own: declared here so that the screens write none by hand. */
export const HEALTH_LABELS = Object.freeze({
  /** What a citizen below the sick threshold is, and how a count of them is called. */
  sick: 'Malade',
  sickCount: 'Malades',
  /** A citizen's score. */
  score: 'Santé',
  /** The part of the environment every house has, whatever it gives. */
  base: 'Base',
  /** What the house's factors add up to. */
  environment: 'Niveau de l\'environnement',
});

/** The level of a house that gives nothing: what its inhabitants' health settles at. */
export const HEALTH_BASE_LEVEL = 40;

/** @type {ReadonlyArray<Readonly<{ id: string, label: string, requirement: object, measure: 'met' | 'current', points?: number, pointsPerUnit?: number, maxUnits?: number }>>} */
export const HEALTH_FACTORS = Object.freeze([
  Object.freeze({
    id: 'foodVariety',
    label: 'Variété de nourriture',
    requirement: Object.freeze({ kind: 'goodsVariety', outcomeField: 'lastConsumption', min: 3 }),
    measure: 'current',
    pointsPerUnit: 8,
    maxUnits: 3,
  }),
  Object.freeze({
    id: 'prevention',
    label: 'Visite de prévention',
    requirement: Object.freeze({ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: SERVICE_COVERAGE_PERIODS }),
    measure: 'met',
    points: 12,
  }),
  Object.freeze({
    id: 'water',
    label: 'Eau de la citerne',
    requirement: Object.freeze({ kind: 'serviceDemandMet', category: 'water', outcomeField: 'lastWaterConsumption' }),
    measure: 'met',
    points: 12,
  }),
  Object.freeze({
    id: 'primaryEducation',
    label: 'Éducation primaire',
    requirement: Object.freeze({ kind: 'serviceCoverage', category: 'primarySchool', coveragePeriods: SERVICE_COVERAGE_PERIODS }),
    measure: 'met',
    points: 6,
  }),
]);

/** The most points a factor can give. */
export function maxPointsOfFactor(factor) {
  return factor.measure === 'met' ? factor.points : factor.pointsPerUnit * factor.maxUnits;
}

// A catalog whose best house goes over the scale is an authoring mistake: it fails when loaded, never clamps quietly.
const BEST_LEVEL = HEALTH_BASE_LEVEL + HEALTH_FACTORS.reduce((sum, factor) => sum + maxPointsOfFactor(factor), 0);
if (BEST_LEVEL > HEALTH_MAX) {
  throw new Error(`[health] the best house reaches ${BEST_LEVEL}, over the scale of ${HEALTH_MAX}: lower the points in HealthFactorCatalog.js`);
}
