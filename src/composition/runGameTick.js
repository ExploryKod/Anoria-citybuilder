/**
 * Full simulation tick owned by the game session (not scene.update).
 */

import { updateTreasuryTurn } from '../js/acl/accountingGame.js';
import {
  persistGameplayTurn,
  processGameTurnBudget,
} from './runGameTurnEconomy.js';
import { notifyBudgetCleanupIfNeeded } from '../ui/compta/tresorerie/CleanupNotificationPresenter.js';

/**
 * @param {object} params
 * @param {number} params.time
 * @param {() => boolean} params.shouldAbort
 * @param {object} params.city
 * @param {object} params.scene
 * @param {{ runSimulation: Function }} params.runtime
 * @param {object} params.housing
 * @param {object} params.gameStore
 * @param {{ updateTimeDisplay: Function }} params.gameUI
 * @param {() => Promise<void>} params.refreshEmploymentPresentation
 * @param {{ enabled?: boolean, checkObjectives: Function }} params.objectivesTracker
 */
export async function runGameTick({
  time,
  shouldAbort,
  city,
  scene,
  runtime,
  housing,
  gameStore,
  gameUI,
  refreshEmploymentPresentation,
  objectivesTracker,
}) {
  if (shouldAbort()) {
    return;
  }

  gameUI.updateTimeDisplay(time);
  city.update();

  await updateTreasuryTurn(time);
  if (shouldAbort()) {
    return;
  }

  await scene.update(city, time);
  if (shouldAbort()) {
    return;
  }

  try {
    await runtime.runSimulation({ city, time });
  } catch (err) {
    console.error('[Game] ECS simulation error:', {
      error: err?.message || err,
      time,
    });
  }
  if (shouldAbort()) {
    return;
  }

  await scene.update(city, time);
  if (shouldAbort()) {
    return;
  }

  const { totalPop } = await persistGameplayTurn({ gameStore, housing, time });
  const budgetResult = await processGameTurnBudget({
    city,
    buildings: scene.buildings,
    time,
    totalPop,
  });
  await notifyBudgetCleanupIfNeeded(budgetResult?.cleanupResult);
  if (shouldAbort()) {
    return;
  }

  await refreshEmploymentPresentation();

  if (objectivesTracker.enabled) {
    await objectivesTracker.checkObjectives(time);
  }
}
