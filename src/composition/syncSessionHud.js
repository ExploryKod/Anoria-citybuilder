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
 *   updateFamishedPopulation?: (country: number, hamlet?: number) => void,
 *   updateDeaths?: (n: number) => void,
 *   updatePopulationBreakdown?: Function,
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
      country.famishedPopulation || 0,
      hamlet.famishedPopulation || 0
    );

    gameUI.updatePopulationBreakdown?.(
      country.totalPop ?? 0,
      country.employment.activeCitizenCount ?? 0,
      country.employment.elitePool ?? 0,
      country.employment.civilServantCount ?? 0,
      country.employment.activePopulationCount ?? 0,
      {
        totalPop: hamlet.totalPop ?? 0,
        activeCitizenCount: hamlet.employment.activeCitizenCount ?? 0,
        elitePool: hamlet.employment.elitePool ?? 0,
        civilServantCount: hamlet.employment.civilServantCount ?? 0,
        activePopulationCount: hamlet.employment.activePopulationCount ?? 0,
      }
    );

    const countryGroups = mapEmploymentGroupsForHud(
      country.employment.byGroup,
      country.employment.bySector
    );
    const hamletGroups = mapEmploymentGroupsForHud(
      hamlet.employment.byGroup,
      hamlet.employment.bySector
    );

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
      commerceCountry: resourcesCountry.commerce,
      commerceHamlet: resourcesHamlet.commerce,
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
