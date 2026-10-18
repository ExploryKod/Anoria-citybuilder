/**
 * Famished population — residents not fed.
 *
 * One signal for every alert of hunger (the population rail, the house's panel and messages): the house's last consumption record,
 * `lastConsumption.totalUnfed`. A house with no record yet has not been judged, so nobody in it is counted famished: the pantry is no
 * second measure (it would show an alert the house itself does not).
 *
 * Housing owns this **read metric**. Supply owns stock / consumption writes.
 */

import { getPerCapitaDemand } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { unfedFromLastConsumption } from './FamineConsequencesPolicy.js';
import { hungerRiskOfHouse, splitUnfedByCause } from './HungerCausePolicy.js';

/**
 * @param {number} pop
 * @returns {number}
 */
function clampPop(pop) {
  return Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0;
}

/**
 * Unfed residents at one house, from its last consumption record (the Régime figure). `totalUnfed` counts UNITS short, so it is converted to
 * residents with the catalog's per-capita need. No record, nobody counted.
 *
 * @param {number} pop
 * @param {{ totalUnfed?: number } | null | undefined} lastConsumption
 * @param {string} [houseType]
 * @returns {number}
 */
export function famishedPopulationAtHouse(pop, lastConsumption, houseType) {
  const p = clampPop(pop);
  if (lastConsumption == null) return 0;
  const unfedUnits = unfedFromLastConsumption(lastConsumption);
  const perCapita = getPerCapitaDemand(houseType);
  const unfedResidents = perCapita > 0 ? Math.ceil(unfedUnits / perCapita) : unfedUnits;
  return Math.min(p, unfedResidents);
}

/**
 * City-wide risk of hunger (see `hungerRiskOfHouse`): the residents whose house is still missing part of its ration today, by cause.
 * @param {ReadonlyArray<{ pop?: number, type?: string, supplyShortfall?: object | null }>} residentialHouses
 * @returns {{ disette: number, penurie: number }}
 */
export function computeCityHungerRisk(residentialHouses) {
  let disette = 0;
  let penurie = 0;
  for (const house of residentialHouses) {
    const risk = hungerRiskOfHouse({ pop: house.pop, houseType: house.type, supplyShortfall: house.supplyShortfall });
    disette += risk.disette;
    penurie += risk.penurie;
  }
  return { disette, penurie };
}

/**
 * City-wide famished count from residential house snapshots.
 *
 * @param {ReadonlyArray<{
 *   pop?: number,
 *   type?: string,
 *   stocks?: import('../value-objects/FoodStocks.js').FoodStocks,
 *   lastConsumption?: { totalUnfed?: number } | null,
 *   supplyShortfall?: object | null,
 * }>} residentialHouses
 * @returns {{
 *   totalPopulation: number,
 *   fedPopulation: number,
 *   famishedPopulation: number,
 *   disettePopulation: number,
 *   penuriePopulation: number,
 * }} the famished are told apart: `disette` (could not pay) and `penurie` (nothing to buy), see HungerCausePolicy.js
 */
export function computeCityFamishedPopulation(residentialHouses) {
  let totalPopulation = 0;
  let famishedPopulation = 0;
  let disettePopulation = 0;
  let penuriePopulation = 0;

  for (const house of residentialHouses) {
    const pop = clampPop(house.pop);
    totalPopulation += pop;
    const famished = famishedPopulationAtHouse(pop, house.lastConsumption, house.type);
    famishedPopulation += famished;
    const { disette, penurie } = splitUnfedByCause({
      unfed: famished,
      houseType: house.type,
      lastConsumption: house.lastConsumption,
      supplyShortfall: house.supplyShortfall,
    });
    disettePopulation += disette;
    penuriePopulation += penurie;
  }

  return {
    totalPopulation,
    fedPopulation: Math.max(0, totalPopulation - famishedPopulation),
    famishedPopulation,
    disettePopulation,
    penuriePopulation,
  };
}
