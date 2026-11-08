import { CLIMATE_PHASES } from './ClimateCatalog.js';
import { getClimateSensitivity, hasResourceCategoryPresentation } from '../resource-catalog/ResourceCategoryCatalog.js';

/**
 * The climate of the year after one in `previousPhase`: its phase (drawn from the chances the previous phase gives) and the factor on the fields' yield (the phase's centre
 * plus a draw within its spread).
 * @param {{ previousPhase: string, random: () => number }} params `random`: draws in [0, 1), the composition's to give
 * @returns {{ phase: string, harvestFactor: number }}
 */
export function drawClimateYear({ previousPhase, random }) {
  const previous = CLIMATE_PHASES[previousPhase];
  if (!previous) throw new Error(`[climate] "${previousPhase}" is not a phase of the climate (${Object.keys(CLIMATE_PHASES).join(', ')})`);
  if (typeof random !== 'function') throw new Error('[climate] the climate needs its random source');
  const pick = random();
  if (!(pick >= 0 && pick < 1)) throw new Error(`[climate] random() returned ${pick}, expected a number in [0, 1)`);
  let acc = 0;
  let phase = null;
  for (const [candidate, chance] of Object.entries(previous.next)) {
    acc += chance;
    if (pick < acc) {
      phase = candidate;
      break;
    }
  }
  // Rounding of the chances may leave the last sliver of [0, 1) unassigned: it falls to the last phase of the row.
  phase ??= Object.keys(previous.next).at(-1);
  const { center, spread } = CLIMATE_PHASES[phase];
  const swing = (random() * 2 - 1) * spread;
  return { phase, harvestFactor: Math.round((center + swing) * 1000) / 1000 };
}

/**
 * @param {{ category: string, yearFactor: number }} params
 * @returns {number} the factor on the yield of this crop that year: the year's swing, as much as the crop feels it
 */
export function cropHarvestFactor({ category, yearFactor }) {
  const sensitivity = getClimateSensitivity(category);
  if (sensitivity === null) throw new Error(`[climate] "${category}" is not a crop: the climate has no say in its yield`);
  return 1 + sensitivity * (yearFactor - 1);
}

/** @param {string} category @returns {boolean} whether the climate decides this good's yield */
export function isClimateCrop(category) {
  return hasResourceCategoryPresentation(category) && getClimateSensitivity(category) !== null;
}
