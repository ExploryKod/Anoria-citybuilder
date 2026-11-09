import { isConstructionPauseEnabled } from '../../../config/constructionPause.js';
import { RANGE_TOOL_ID } from '../../../shared/gameplay/behaviorMode.js';
import { getSessionGame } from '../../../composition/sessionRuntime.js';

/**
 * Construction mode: the game is paused, the road and the eraser are available, and everything the player builds or demolishes happens
 * without the day running. It starts when the construction button opens the bar and ends when that button is closed.
 */

/** The buttons only construction mode lights: the road, the eraser (the portrait fab and the left-toolbar stub). */
const MODE_ONLY_BUTTONS = ['toolbar-road-btn', 'mobile-portrait-bulldoze-btn', 'bulldoze-btn'];

let active = false;
/** The game the mode paused: a mode left running when that game was left belongs to a game that no longer exists. */
let pausedGame = null;

export function isConstructionModeActive() {
  return active && getSessionGame() === pausedGame;
}

/** The game the mode paused is gone (the player left it): the mode ends with it, there is nothing left to resume. */
function dropModeOfGoneGame() {
  if (active && getSessionGame() !== pausedGame) {
    active = false;
    pausedGame = null;
    document.querySelector('.info-panel .info-box.infos-time')?.classList.remove('infos-time--construction');
    syncModeOnlyButtons();
  }
}

/** The road and the eraser are greyed out outside the mode, when the setting asks for the mode. */
function syncModeOnlyButtons() {
  const available = !isConstructionPauseEnabled() || active;
  for (const id of MODE_ONLY_BUTTONS) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.disabled = !available;
    button.setAttribute('aria-disabled', available ? 'false' : 'true');
  }
}

export function initConstructionMode() {
  syncModeOnlyButtons();
  window.addEventListener('anoria:construction-pause-setting', () => {
    if (!isConstructionPauseEnabled()) exitConstructionMode();
    syncModeOnlyButtons();
  });
}

/** Called when the construction bar opens. Nothing happens when the setting is off or the mode already runs. */
export function enterConstructionMode() {
  dropModeOfGoneGame();
  if (!isConstructionPauseEnabled() || active) return;
  const game = getSessionGame();
  if (!game) throw new Error('[ConstructionMode] no game is running: the construction pause cannot start');
  active = true;
  pausedGame = game;
  game.enterConstructionPause();
  syncModeOnlyButtons();
}

/** Called when the construction button is closed: the tool in hand is put down, the buttons grey out, the game goes back to what it was. */
export function exitConstructionMode() {
  dropModeOfGoneGame();
  if (!active) return;
  active = false;
  pausedGame = null;
  const game = getSessionGame();
  if (!game) throw new Error('[ConstructionMode] no game is running: the construction pause cannot end');
  const toolId = game.activeToolId;
  if (toolId && toolId !== 'select-object' && toolId !== RANGE_TOOL_ID) {
    game.scene?.onEnterSelectMode?.();
  }
  void game.leaveConstructionPause();
  syncModeOnlyButtons();
}
