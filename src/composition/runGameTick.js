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
  onGameOver,
  presentIncomingNewsEvents,
  silent = false,
}) {
  if (shouldAbort()) {
    return;
  }

  // Measurement only: the milliseconds each stage of the day took, reported once at the end of a complete tick (dev builds).
  const stageMs = {};
  let lapStartedAt = performance.now();
  const lap = (stage) => {
    const now = performance.now();
    stageMs[stage] = (stageMs[stage] ?? 0) + (now - lapStartedAt);
    lapStartedAt = now;
  };

  if (!silent) {
    gameUI.updateTimeDisplay(time);
  }
  city.update();
  lap('city');

  if (shouldAbort()) {
    return;
  }

  if (!silent) {
    await scene.update(city, time);
    lap('sceneBefore');
    if (shouldAbort()) {
      return;
    }
  }

  try {
    await runtime.runSimulation({ city, time });
    lap('ecs');
  } catch (err) {
    // The Error object itself, not just its message — `err.stack` is the one thing that says
    // WHERE inside the ECS pipeline this threw (which system, which file/line), and a plain
    // `{error: err.message}` throws that away, leaving only "something failed, no clue where".
    console.error('[Game] ECS simulation error:', err, { time });
  }
  if (shouldAbort()) {
    return;
  }

  if (!silent) {
    await scene.update(city, time);
    lap('sceneAfter');
    if (shouldAbort()) {
      return;
    }
  }

  lapStartedAt = performance.now();
  const { totalPop } = await persistGameplayTurn({ gameStore, housing, time });
  lap('persist');
  await processGameTurnBudget({
    city,
    buildings: scene.buildings,
    time,
    totalPop,
  });
  lap('budget');
  if (shouldAbort()) {
    return;
  }

  if (!silent) {
    await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
    await refreshEmploymentPresentation();
    lap('hud');
  }

  if (objectivesTracker.enabled) {
    await objectivesTracker.checkObjectives(time);
    lap('objectives');
  }

  if (shouldAbort()) {
    return;
  }

  if (import.meta.env?.DEV) {
    const total = Object.values(stageMs).reduce((sum, ms) => sum + ms, 0);
    const stages = Object.entries(stageMs).map(([stage, ms]) => `${stage}=${ms.toFixed(1)}`).join(' ');
    console.info(`[tick-perf] day=${time}${silent ? ' (silent)' : ''} total=${total.toFixed(1)}ms ${stages}`);
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
