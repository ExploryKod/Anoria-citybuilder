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
 * @param {() => void} [params.onGameOver]
 * @param {() => Promise<void>} [params.presentIncomingNewsEvents] — injected at the edge (presentation owns the modal)
 * @param {boolean} [params.silent] — batch-advance interim day (see SPEED_LEVELS_DAYS): runs the
 *   simulation (ECS + economy) exactly as a normal day, but skips scene/HUD/notification
 *   presentation, which a fast-forward batch defers to its last (non-silent) day. Safe because
 *   `city.tiles`/mesh sync inside `scene.update` only mirrors state for rendering — the ECS
 *   contexts (housing, employment, parcels, supply) each read/write their own store, not
 *   `city.tiles` — see project_game_speed_fast_forward_deferred memory for the audit.
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
  onGameOver,
  presentIncomingNewsEvents,
  silent = false,
}) {
  if (shouldAbort()) {
    return;
  }

  if (!silent) {
    gameUI.updateTimeDisplay(time);
  }
  city.update();

  await getOrCreateAccountingContext().updateTreasuryTurn(time);
  if (shouldAbort()) {
    return;
  }

  if (!silent) {
    await scene.update(city, time);
    if (shouldAbort()) {
      return;
    }
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

  if (!silent) {
    await scene.update(city, time);
    if (shouldAbort()) {
      return;
    }
  }

  const { totalPop } = await persistGameplayTurn({ gameStore, housing, time });
  const budgetResult = await processGameTurnBudget({
    city,
    buildings: scene.buildings,
    time,
    totalPop,
  });
  if (!silent) {
    await notifyBudgetCleanup?.(budgetResult?.cleanupResult);
  }
  if (shouldAbort()) {
    return;
  }

  if (!silent) {
    await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
    await refreshEmploymentPresentation();
  }

  if (objectivesTracker.enabled) {
    await objectivesTracker.checkObjectives(time);
  }

  if (shouldAbort()) {
    return;
  }

  if (!silent && presentIncomingNewsEvents) {
    try {
      await presentIncomingNewsEvents();
    } catch (err) {
      console.error('[Game] News event presentation error:', err?.message || err);
    }
  }

  if (isLoseMode() && isDeathGameOverReached()) {
    // Default overlay copy already covers famine; keep HTML structure.
    gameUI.showGameOver?.();
    onGameOver?.();
  }
}
