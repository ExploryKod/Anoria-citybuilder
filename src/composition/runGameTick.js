/**
 * Full simulation tick owned by the game session (not scene.update).
 */

import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getOrCreateGameplayContext } from './createGameplayContext.js';
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
 * @param {(toast: { id: string, kind: string, duration: number, text: string }) => void} params.showTutorialToast — injected at the edge (presentation owns the toasts)
 * @param {() => void} params.syncLimitedBuildingButtonsOnHamletChange — sets the buttons of the buildings limited per hamlet (`maxPerHamlet`) when the hamlet is not the one seen before
 * @param {(state: { progress: object | null, justCompleted: object | null }) => void} params.showTutorialObjective — shows the objective counter of the tutorial's current step
 * @param {(allowed: string[] | null) => void} params.applyTutorialAllowedTools — greys out the construction buttons the tutorial's current step does not allow
 * @param {(toastId: string) => void} params.hideTutorialToast — takes a tutorial toast off the screen (the player did what it points at)
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
  showTutorialToast,
  hideTutorialToast,
  applyTutorialAllowedTools,
  showTutorialObjective,
  syncLimitedBuildingButtonsOnHamletChange,
  silent = false,
}) {
  if (shouldAbort()) {
    return;
  }

  if (!silent) {
    gameUI.updateTimeDisplay(time);
  }
  city.update();

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
    if (shouldAbort()) {
      return;
    }
  }

  const { totalPop } = await persistGameplayTurn({ gameStore, housing, time });
  await processGameTurnBudget({
    city,
    buildings: scene.buildings,
    time,
    totalPop,
  });
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

  // The tutorial's next instruction and its toasts, once the city has reached them (a no-op outside a tutorial game). Not on a silent day of a
  // batch: its toasts would be spent unseen, and the batch's last day looks at the same city. A failure shows, it never stops the day.
  // The buttons of the buildings a hamlet can hold only so many of are set for a hamlet the first time it is seen (a load, a hamlet switch); after that
  // only a placement or a demolition changes them, so this is one comparison.
  if (!silent) syncLimitedBuildingButtonsOnHamletChange();

  let tutorialToasts = [];
  if (!silent) {
    try {
      const tutorial = await getOrCreateGameplayContext().advanceTutorial.execute();
      applyTutorialAllowedTools(tutorial.allowed);
      showTutorialObjective(tutorial);
      tutorial.dismissed.forEach(hideTutorialToast);
      tutorialToasts = tutorial.toasts;
    } catch (err) {
      console.error('[Game] The tutorial could not advance:', err);
    }
  }

  if (!silent && presentIncomingNewsEvents) {
    try {
      await presentIncomingNewsEvents();
    } catch (err) {
      console.error('[Game] News event presentation error:', err?.message || err);
    }
  }

  // The toasts come after the dépêche is presented: the modal dims the screen, and a toast shown under it would be spent unseen. The edge holds
  // them back until the modal is closed.
  tutorialToasts.forEach(showTutorialToast);

  if (isLoseMode() && isDeathGameOverReached()) {
    // Default overlay copy already covers famine; keep HTML structure.
    gameUI.showGameOver?.();
    onGameOver?.();
  }
}
