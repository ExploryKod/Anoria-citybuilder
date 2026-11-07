import { HEALTH_MAX } from './CitizenCatalog.js';
import { SERVICE_COVERAGE_PERIODS } from './socialCategoryCatalog.js';
import { getResourceCategoryPresentation } from '../resource-catalog/ResourceCategoryCatalog.js';

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

/**
 * Invalidity (docs/plan/health.plan.md, step 3): a grave illness is a health under `HEALTH_SEVERE_BELOW`, and a citizen who stays in it `INVALIDITY_MONTHS` months in a row
 * is invalid. Whether he can ever recover from it is his social category's fact (`invalidity.permanent`, socialCategoryCatalog.js): an invalid citizen of a permanent
 * category stays so for life; of another, only while his health stays that low. An invalid citizen does not work and is paid a pension (SicknessCoverCatalog.js).
 * A first balance, tuned here.
 */
export const HEALTH_SEVERE_BELOW = 25;
export const INVALIDITY_MONTHS = 3;

/**
 * Contagion (docs/plan/health.plan.md, step 4): the sick of the houses around spread their illness. A house takes off `CONTAGION_POINTS_AT_FULL` points when every inhabitant of
 * the houses within `CONTAGION_RADIUS` tiles (Manhattan, from the house's anchor) is sick, in proportion to the share who are; a house covered by a doctor or a hospital
 * takes off `CONTAGION_PROTECTION` of it less. Deterministic, no draw: a district that is neglected falls ill together, a cared-for one resists. A first balance.
 */
export const CONTAGION_RADIUS = 6;
export const CONTAGION_POINTS_AT_FULL = 15;
export const CONTAGION_PROTECTION = 0.5;

/**
 * Health kills (docs/plan/health.plan.md, step 2). Each month a sick citizen (below the sick threshold) dies with a risk that grows the further his health is under it:
 * nothing at the threshold, `HEALTH_DEATH_RISK_AT_ZERO` for a citizen at nothing, linear between. A house that gives nothing settles its citizens just under the threshold, so
 * they die slowly; a neglected house with a poor start dies faster. Deaths only happen where the famine's do (the mode that has defeat): see the housing health system.
 * A first balance, tuned here.
 */
export const HEALTH_DEATH_RISK_AT_ZERO = 0.3;

/**
 * The monthly chance a citizen of this health dies.
 * @param {number} health on the scale of HEALTH_MAX
 * @returns {number} a probability, 0 to HEALTH_DEATH_RISK_AT_ZERO
 */
export function healthDeathRisk(health) {
  if (!Number.isFinite(health)) throw new Error(`[health] the death risk of a health of ${health} cannot be told`);
  if (health >= HEALTH_SICK_BELOW) return 0;
  return HEALTH_DEATH_RISK_AT_ZERO * ((HEALTH_SICK_BELOW - Math.max(0, health)) / HEALTH_SICK_BELOW);
}

/**
 * The monthly chance a citizen of this mental health takes his own life: nothing from the severe threshold up, `SUICIDE_RISK_AT_ZERO` at nothing, linear between.
 * @param {number} mentalHealth on the scale of HEALTH_MAX
 * @returns {number} a probability, 0 to SUICIDE_RISK_AT_ZERO
 */
export function suicideRisk(mentalHealth) {
  if (!Number.isFinite(mentalHealth)) throw new Error(`[health] the suicide risk of a mental health of ${mentalHealth} cannot be told`);
  if (mentalHealth >= HEALTH_SEVERE_BELOW) return 0;
  return SUICIDE_RISK_AT_ZERO * ((HEALTH_SEVERE_BELOW - Math.max(0, mentalHealth)) / HEALTH_SEVERE_BELOW);
}

/** The words the player reads about health besides the factors' own: declared here so that the screens write none by hand. */
export const HEALTH_LABELS = Object.freeze({
  /** What a citizen below the sick threshold is, and how a count of them is called. */
  sick: 'Malade',
  sickCount: 'Malades',
  /** Workers assigned to a workplace who are sick, so absent. */
  absentWorkers: 'Absents (malades)',
  /** A citizen's score, of the body and of the mind (the short form is for a small card). */
  score: 'Santé',
  mentalScore: 'Santé psychique',
  mentalShort: 'Psy',
  mentalAverage: 'Santé psychique moyenne',
  /** What the environment of the mind is called, under its histogram. */
  mentalEnvironment: 'Niveau de l\'environnement psychique',
  /** The administrators stand outside health (see `outsideHealth`, socialCategoryCatalog.js): this is what their cards say, and why. */
  outside: 'Immortels',
  outsideNote: 'Les administrateurs sont immortels : hors santé, ils ne tombent pas malades, ne deviennent pas invalides et ne meurent pas de maladie.',
  /** A citizen who cannot work for good or for as long as he is gravely ill (see HEALTH_SEVERE_BELOW), and how a count of them is called. */
  invalid: 'Invalide',
  invalidCount: 'Invalides',
  /** The inhabitants of a house, and the average of their scores. */
  citizens: 'Habitants',
  average: 'Santé moyenne',
  /** The part of the environment every house has, whatever it gives. */
  base: 'Base',
  /** What the house's factors add up to. */
  environment: 'Niveau de l\'environnement',
});

/** What "sick" means, for the player: a score below the threshold. */
export function sickExplanation() {
  return `Un habitant est malade quand sa santé passe sous ${HEALTH_SICK_BELOW} sur ${HEALTH_MAX}.`;
}

/** The level of a house that gives nothing: what its inhabitants' health settles at. */
export const HEALTH_BASE_LEVEL = 40;

/**
 * What the work itself does to the health of those who do it: a workplace declares a `pollution` level from 1 to 3 (dust, fumes, noise: a mine and a coal plant 3, a
 * pottery 2, an oil mill 1; a workplace that exposes its workers to nothing declares none), and a house's exposure is the average level of the workplaces its workers go to,
 * weighed by how many go. It touches the workers, not the neighbours. Each level takes `POLLUTION_POINTS_PER_LEVEL` points off the house's environment.
 */
export const WORKPLACE_POLLUTION_MAX_LEVEL = 3;
export const POLLUTION_POINTS_PER_LEVEL = 4;

/** @type {ReadonlyArray<Readonly<{ id: string, label: string, requirement?: object, measure: 'met' | 'current' | 'exposure' | 'proximity', points?: number, pointsPerUnit?: number, maxUnits?: number, pointsAtFull?: number, protection?: object }>>} */
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
  // The only factor that takes points off: the average pollution of the workplaces of the house's workers (see above). It reads no requirement of the house's ladder.
  Object.freeze({
    id: 'pollution',
    label: 'Lieu de travail pollué',
    measure: 'exposure',
    pointsPerUnit: -POLLUTION_POINTS_PER_LEVEL,
    maxUnits: WORKPLACE_POLLUTION_MAX_LEVEL,
  }),
  // The sick of the houses around (see CONTAGION_* above): takes points off in proportion to their share, less where a doctor or a hospital covers the house.
  Object.freeze({
    id: 'contagion',
    label: 'Malades à proximité',
    measure: 'proximity',
    pointsAtFull: -CONTAGION_POINTS_AT_FULL,
    protection: Object.freeze({
      requirements: Object.freeze([
        Object.freeze({ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: SERVICE_COVERAGE_PERIODS }),
        Object.freeze({ kind: 'serviceCoverage', category: 'hospital', coveragePeriods: SERVICE_COVERAGE_PERIODS }),
      ]),
      reducesBy: CONTAGION_PROTECTION,
    }),
  }),
]);

/**
 * The average pollution level a house's workers are exposed to.
 * @param {{ workers: number, exposure: number } | undefined} workplaces the workers of the house and the sum of the levels of their workplaces (none: nobody works)
 * @returns {number} 0 to WORKPLACE_POLLUTION_MAX_LEVEL; 0 for a house whose residents do not work
 */
export function workplaceExposureOf(workplaces) {
  if (!workplaces || !(workplaces.workers > 0)) return 0;
  return workplaces.exposure / workplaces.workers;
}

/**
 * The share of the inhabitants of the houses around that are sick.
 * @param {{ sick: number, residents: number } | undefined} neighbours the sick and the residents of the houses within the radius (none: no one lives around)
 * @returns {number} 0 to 1; 0 for a house with no neighbours
 */
export function neighbourSickShareOf(neighbours) {
  if (!neighbours || !(neighbours.residents > 0)) return 0;
  return Math.min(1, neighbours.sick / neighbours.residents);
}

/**
 * The mind has its own score and its own environment (docs/plan/health.plan.md): a citizen's mental health moves each month towards `MENTAL_BASE_LEVEL` plus the points of
 * these factors, as his physical health does towards the physical ones. It starts high: a mind falls ill from what weighs on it (no work, hunger, the nuisance of work)
 * more than from what it lacks, and is lifted by culture and leisure. A grave mental illness (under HEALTH_SEVERE_BELOW) makes invalid like a grave physical one, and what
 * kills a body (HEALTH_DEATH_RISK_AT_ZERO) is for the mind the suicide (`SUICIDE_RISK_AT_ZERO` at nothing, from the severe threshold down). A first balance, tuned here.
 *
 * Measures: 'met' as above; 'unemployment' takes `pointsAtFull` off when every resident who looks for a job is unemployed, in proportion to their share; 'hunger' takes
 * `points` off when the house went hungry at its last consumption; 'exposure' as the pollution above (here the nuisance of the work).
 */
export const MENTAL_BASE_LEVEL = 60;
export const SUICIDE_RISK_AT_ZERO = 0.2;
const cultureFactor = (category) => Object.freeze({
  id: `culture-${category}`,
  label: getResourceCategoryPresentation(category).label,
  requirement: Object.freeze({ kind: 'serviceCoverage', category, coveragePeriods: SERVICE_COVERAGE_PERIODS }),
  measure: 'met',
  points: 5,
});

/** @type {ReadonlyArray<Readonly<{ id: string, label: string, requirement?: object, measure: 'met' | 'exposure' | 'unemployment' | 'hunger', points?: number, pointsPerUnit?: number, maxUnits?: number, pointsAtFull?: number }>>} */
export const MENTAL_HEALTH_FACTORS = Object.freeze([
  cultureFactor('library'),
  cultureFactor('theatre'),
  cultureFactor('cinema'),
  cultureFactor('pub'),
  Object.freeze({ id: 'unemployment', label: 'Chômage', measure: 'unemployment', pointsAtFull: -20 }),
  Object.freeze({ id: 'hunger', label: 'Faim', measure: 'hunger', points: -15 }),
  Object.freeze({ id: 'workNuisance', label: 'Nuisances du travail', measure: 'exposure', pointsPerUnit: -3, maxUnits: WORKPLACE_POLLUTION_MAX_LEVEL }),
]);

/**
 * The share of the residents who look for a job and have none.
 * @param {number} seeking the residents who look for a job (the administrators do not)
 * @param {number} workers the residents who work
 * @returns {number} 0 to 1; 0 for a house where nobody looks for a job
 */
export function unemployedShareOf(seeking, workers) {
  if (!(seeking > 0)) return 0;
  return Math.max(0, seeking - workers) / seeking;
}

/** The most points a factor can give (0 for a factor that only takes points off). */
export function maxPointsOfFactor(factor) {
  if (factor.measure === 'exposure' || factor.measure === 'proximity' || factor.measure === 'unemployment' || factor.measure === 'hunger') return 0;
  return factor.measure === 'met' ? factor.points : factor.pointsPerUnit * factor.maxUnits;
}

/** The most points a factor can take off (0 for a factor that only gives). */
export function worstPointsOfFactor(factor) {
  if (factor.measure === 'exposure') return factor.pointsPerUnit * factor.maxUnits;
  if (factor.measure === 'proximity' || factor.measure === 'unemployment') return factor.pointsAtFull;
  if (factor.measure === 'hunger') return factor.points;
  return 0;
}

// A catalog whose best house goes over the scale is an authoring mistake: it fails when loaded, never clamps quietly. So is a worst house, the base less everything that
// takes points off, that falls under nothing. Both scores are checked.
for (const [name, base, factors] of [['physical', HEALTH_BASE_LEVEL, HEALTH_FACTORS], ['mental', MENTAL_BASE_LEVEL, MENTAL_HEALTH_FACTORS]]) {
  const best = base + factors.reduce((sum, factor) => sum + maxPointsOfFactor(factor), 0);
  if (best > HEALTH_MAX) throw new Error(`[health] the best ${name} environment reaches ${best}, over the scale of ${HEALTH_MAX}: lower the points in HealthFactorCatalog.js`);
  const worst = base + factors.reduce((sum, factor) => sum + worstPointsOfFactor(factor), 0);
  if (worst < 0) throw new Error(`[health] the worst ${name} environment reaches ${worst}, under nothing: lower the points that take some off in HealthFactorCatalog.js`);
}
