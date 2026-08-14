/**
 * HUD sync owned by the game tick / session — not scene.update.
 */

import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getCumulativeDeaths } from './gameplayMortalityState.js';
import { getHudPopulationScopeSnapshot } from './hudPopulationAggregates.js';

/**
 * Sync population rail: country totals + active hamlet (dual column).
 *
 * @param {{
 *   updateFamishedPopulation?: (country: number, hamlet?: number) => void,
 *   updateDeaths?: (n: number) => void,
 *   updatePopulationBreakdown?: Function,
 *   updateUnemployedPopulation?: Function,
 *   updateWorkerLack?: Function,
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

    gameUI.updateUnemployedPopulation?.(
      country.employment.unemployed ?? 0,
      country.employment.unemploymentPercentage ?? 0,
      hamlet.employment.unemployed ?? 0,
      hamlet.employment.unemploymentPercentage ?? 0
    );

    gameUI.updateWorkerLack?.(
      country.employment.lack ?? 0,
      hamlet.employment.lack ?? 0
    );
  } catch (err) {
    console.warn('[syncPopRailHud] population:', err);
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
