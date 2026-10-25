/**
 * HUD sync owned by the game tick / session — not scene.update.
 */

import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getCumulativeDeaths } from './gameplayMortalityState.js';
import {
  getHudPopulationScopeSnapshot,
  mapEmploymentGroupsForHud,
} from './hudPopulationAggregates.js';
import { getHudResourceScopeSnapshot, getHudNatureResourceScopeSnapshot } from './hudResourceAggregates.js';
import { getSessionCity } from './sessionRuntime.js';
import { allSocialGroups } from '../contexts/employment/domain/catalogs/HouseGroupSectorEligibilityPolicy.js';

/**
 * @param {Record<string, { workerPool?: number }>} groups
 * @returns {Record<string, number>}
 */
function workerCountsFromGroups(groups) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const group of allSocialGroups()) {
    counts[group] = Math.max(0, Math.floor(groups?.[group]?.workerPool) || 0);
  }
  return counts;
}

/**
 * Sync population rail: country totals + active hamlet (dual column).
 *
 * @param {{
 *   updateFamishedPopulation?: (country: { disette: number, penurie: number }, hamlet?: { disette: number, penurie: number }) => void,
 *   updateHungerRisk?: (country: { disette: number, penurie: number }, hamlet?: { disette: number, penurie: number }) => void,
 *   updateDeaths?: (n: number) => void,
 *   updatePopulationTotals?: Function,
 *   updateGroupHud?: Function,
 * }} gameUI
 */
export async function syncPopRailHud(gameUI) {
  if (!gameUI) return;

  try {
    const [country, hamlet] = await Promise.all([
      getHudPopulationScopeSnapshot('country'),
      getHudPopulationScopeSnapshot('active'),
    ]);

    gameUI.updateFamishedPopulation?.(
      { disette: country.disettePopulation || 0, penurie: country.penuriePopulation || 0 },
      { disette: hamlet.disettePopulation || 0, penurie: hamlet.penuriePopulation || 0 }
    );

    gameUI.updateHungerRisk?.(country.hungerRisk, hamlet.hungerRisk);

    const countryGroups = mapEmploymentGroupsForHud(
      country.employment.byGroup,
      country.employment.bySkill
    );
    const hamletGroups = mapEmploymentGroupsForHud(
      hamlet.employment.byGroup,
      hamlet.employment.bySkill
    );

    // The workers' head figure is what the per-class worker rows below it add up to, never a count of its own.
    const sumOf = (counts) => Object.values(counts).reduce((sum, count) => sum + count, 0);
    gameUI.updatePopulationTotals?.(country.totalPop ?? 0, sumOf(workerCountsFromGroups(countryGroups)), {
      totalPop: hamlet.totalPop ?? 0,
      workersCount: sumOf(workerCountsFromGroups(hamletGroups)),
    });

    gameUI.updateGroupHud?.({
      popCountry: country.popByGroup,
      popHamlet: hamlet.popByGroup,
      workersCountry: workerCountsFromGroups(countryGroups),
      workersHamlet: workerCountsFromGroups(hamletGroups),
      laborCountry: {
        unemployed: country.employment.unemployed ?? 0,
        unemploymentPercentage: country.employment.unemploymentPercentage ?? 0,
        lack: country.employment.lack ?? 0,
      },
      laborHamlet: {
        unemployed: hamlet.employment.unemployed ?? 0,
        unemploymentPercentage: hamlet.employment.unemploymentPercentage ?? 0,
        lack: hamlet.employment.lack ?? 0,
      },
      groupsCountry: countryGroups,
      groupsHamlet: hamletGroups,
      causesCountry: country.employmentCauses,
      causesHamlet: hamlet.employmentCauses,
      groupCausesCountry: country.employmentGroupCauses,
      groupCausesHamlet: hamlet.employmentGroupCauses,
    });
  } catch (err) {
    console.warn('[syncPopRailHud] population:', err);
  }

  try {
    const city = getSessionCity();
    const [resourcesCountry, resourcesHamlet, natureCountry, natureHamlet] = await Promise.all([
      getHudResourceScopeSnapshot('country'),
      getHudResourceScopeSnapshot('active'),
      getHudNatureResourceScopeSnapshot('country', { city }),
      getHudNatureResourceScopeSnapshot('active', { city }),
    ]);
    gameUI.updateResourcesHud?.({
      cityCountry: resourcesCountry.city,
      cityHamlet: resourcesHamlet.city,
      natureCountry: natureCountry.nature,
      natureHamlet: natureHamlet.nature,
    });
  } catch (err) {
    console.warn('[syncPopRailHud] resources:', err);
  }

  try {
    gameUI.updateDeaths?.(getCumulativeDeaths());
  } catch (err) {
    console.warn('[syncPopRailHud] deaths:', err);
  }
}

/**
 * @param {object} params
 * @param {object} params.housing — kept for API compat; pop rail uses Dexie aggregates
 * @param {object} [params.employment]
 * @param {object} params.gameUI
 * @param {boolean} [params.includeEmployment=false]
 */
export async function syncSessionHud({
  housing: _housing,
  employment,
  gameUI,
  includeEmployment = false,
}) {
  if (!gameUI) return;

  if (includeEmployment && employment?.getCityEmploymentSummary) {
    await syncPopRailHud(gameUI);
  }

  try {
    const snapshot = await getOrCreateAccountingContext().getTreasurySnapshot();
    gameUI.updateFunds(snapshot?.funds ?? 0);
  } catch (err) {
    console.warn('[syncSessionHud] treasury:', err);
  }
}
