/**
 * HUD sync owned by the game tick / session — not scene.update.
 */

import { getOrCreateAccountingContext } from './createAccountingContext.js';

/**
 * @param {object} params
 * @param {{ getFamishedPopulation: () => Promise<{ famishedPopulation?: number }> }} params.housing
 * @param {{ getCityEmploymentSummary?: () => Promise<object> }} [params.employment]
 * @param {{
 *   updateFamishedPopulation: (n: number) => void,
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
    const snapshot = await getOrCreateAccountingContext().getTreasurySnapshot();
    gameUI.updateFunds(snapshot?.funds ?? 0);
  } catch (err) {
    console.warn('[syncSessionHud] treasury:', err);
  }

  if (!includeEmployment || !employment?.getCityEmploymentSummary) {
    return;
  }

  try {
    const summary = await employment.getCityEmploymentSummary();
    const citizenPopulation = summary.workerPool ?? 0;
    const elitePopulation = summary.elitePool ?? 0;
    gameUI.updatePopulationBreakdown?.(
      citizenPopulation + elitePopulation,
      citizenPopulation,
      elitePopulation
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
