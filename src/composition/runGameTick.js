/**
 * Full simulation tick owned by the game session (not scene.update).
 */

import { getOrCreateAccountingContext } from './createAccountingContext.js';
import {
  persistGameplayTurn,
  processGameTurnBudget,
} from './runGameTurnEconomy.js';
import { syncSessionHud } from './syncSessionHud.js';
import { isLoseMode } from '../config/loseMode.js';
import { isDeathGameOverReached } from './gameplayMortalityState.js';
import { presentIncomingNewsEvents } from '../presentation/dom/intelligence/NewsEventModal.js';

/**
 * @param {object} params
 * @param {number} params.time
 * @param {() => boolean} params.shouldAbort
 * @param {object} params.city
 * @param {object} params.scene
 * @param {{ runSimulation: Function }} params.runtime
 * @param {object} params.housing
 * @param {object} [params.employment]
 * @param {object} params.gameStore
 * @param {{ updateTimeDisplay: Function, showGameOver?: Function }} params.gameUI
 * @param {() => Promise<void>} params.refreshEmploymentPresentation
 * @param {{ enabled?: boolean, checkObjectives: Function }} params.objectivesTracker
 * @param {(cleanupResult?: { deleted?: number, deletedTurns?: number[] }) => void | Promise<void>} [params.notifyBudgetCleanup]
 * @param {(params: { housing: object }) => void | Promise<void>} [params.refreshPlacementToolGating]
 * @param {() => void} [params.onGameOver]
 */
export async function runGameTick({
  time,
  shouldAbort,
  city,
  scene,
  runtime,
  housing,
  employment,
  gameStore,
  gameUI,
  refreshEmploymentPresentation,
  objectivesTracker,
  notifyBudgetCleanup,
  refreshPlacementToolGating,
  onGameOver,
}) {
  if (shouldAbort()) {
    return;
  }

  gameUI.updateTimeDisplay(time);
  city.update();

  await getOrCreateAccountingContext().updateTreasuryTurn(time);
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
  await notifyBudgetCleanup?.(budgetResult?.cleanupResult);
  if (shouldAbort()) {
    return;
  }

  await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
  await refreshEmploymentPresentation();

  if (objectivesTracker.enabled) {
    await objectivesTracker.checkObjectives(time);
  }

  if (refreshPlacementToolGating) {
    await refreshPlacementToolGating({ housing });
  }

  if (shouldAbort()) {
    return;
  }

  try {
    await presentIncomingNewsEvents();
  } catch (err) {
    console.error('[Game] News event presentation error:', err?.message || err);
  }

  if (isLoseMode() && isDeathGameOverReached()) {
    // Default overlay copy already covers famine; keep HTML structure.
    gameUI.showGameOver?.();
    onGameOver?.();
  }
}
