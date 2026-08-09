/**
 * HUD sync owned by the game tick / session — not scene.update.
 */

import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getCumulativeDeaths } from './gameplayMortalityState.js';

/**
 * @param {object} params
 * @param {{
 *   getFamishedPopulation: () => Promise<{ famishedPopulation?: number }>,
 *   getCityPopulationSummary?: () => Promise<{ totalPop?: number }>,
 * }} params.housing
 * @param {{ getCityEmploymentSummary?: () => Promise<object> }} [params.employment]
 * @param {{
 *   updateFamishedPopulation: (n: number) => void,
 *   updateDeaths?: (n: number) => void,
 *   updateFunds: (n: number) => void,
 *   updatePopulationBreakdown?: Function,
 *   updateUnemployedPopulation?: Function,
 *   updateWorkerLack?: Function,
 * }} params.gameUI
 * @param {boolean} [params.includeEmployment=false]
 */
export async function syncSessionHud({
  housing,
  employment,
  gameUI,
  includeEmployment = false,
}) {
  if (!gameUI) return;

  try {
    const { famishedPopulation } = await housing.getFamishedPopulation();
    gameUI.updateFamishedPopulation(famishedPopulation || 0);
  } catch (err) {
    console.warn('[syncSessionHud] famished population:', err);
  }

  try {
    gameUI.updateDeaths?.(getCumulativeDeaths());
  } catch (err) {
    console.warn('[syncSessionHud] deaths:', err);
  }

  try {
    const snapshot = await getOrCreateAccountingContext().getTreasurySnapshot();
    gameUI.updateFunds(snapshot?.funds ?? 0);
  } catch (err) {
    console.warn('[syncSessionHud] treasury:', err);
  }

  if (!includeEmployment || !employment?.getCityEmploymentSummary) {
    return;
  }

  try {
    const [summary, popSummary] = await Promise.all([
      employment.getCityEmploymentSummary(),
      housing.getCityPopulationSummary?.() ?? Promise.resolve({ totalPop: 0 }),
    ]);
    gameUI.updatePopulationBreakdown?.(
      popSummary.totalPop ?? 0,
      summary.activeCitizenCount ?? 0,
      summary.elitePool ?? 0,
      summary.civilServantCount ?? 0,
      summary.activePopulationCount ?? 0
    );
    gameUI.updateUnemployedPopulation?.(
      summary.unemployed ?? 0,
      summary.unemploymentPercentage ?? 0
    );
    gameUI.updateWorkerLack?.(summary.lack ?? 0);
  } catch (err) {
    console.warn('[syncSessionHud] employment:', err);
  }
}
