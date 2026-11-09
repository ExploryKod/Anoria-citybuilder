import { isConstructionPauseEnabled } from '../../../config/constructionPause.js';
import { RANGE_TOOL_ID } from '../../../shared/gameplay/behaviorMode.js';
import { getSessionGame } from '../../../composition/sessionRuntime.js';

/**
 * Construction mode: the game is paused, and the house, road and eraser buttons are shown; everything the player builds or demolishes happens
 * without the day running. It starts when the construction mode button (the hammer) is hit and ends when it is hit again.
 * With the setting off there is no mode: the hammer is hidden and the three buttons are always shown.
 */

const MODE_BUTTON_ID = 'toolbar-construction-mode-btn';
/** The wrappers of the buttons only the mode shows: the house (opens the build bar), the road and the eraser. */
const MODE_TOOLS_SELECTOR = '.construction-tool-fab';

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
    syncModeButtons();
  }
}

/** The hammer shows the mode (hidden when the setting is off); the house, road and eraser are shown while the mode runs, or always when the setting is off. */
function syncModeButtons() {
  const modeEnabled = isConstructionPauseEnabled();
  const hammer = document.getElementById(MODE_BUTTON_ID);
  if (!hammer) throw new Error(`[ConstructionMode] #${MODE_BUTTON_ID} is missing from game.html`);
  hammer.closest('.legend-btns').hidden = !modeEnabled;
  hammer.classList.toggle('active', active);
  hammer.setAttribute('aria-pressed', active ? 'true' : 'false');
  const toolsShown = !modeEnabled || active;
  for (const wrapper of document.querySelectorAll(MODE_TOOLS_SELECTOR)) wrapper.hidden = !toolsShown;
}

/** Wires the hammer: `onToggle` runs on each click (the caller decides what entering and leaving also do, e.g. closing the build bar). */
export function initConstructionMode({ onToggle }) {
  syncModeButtons();
  document.getElementById(MODE_BUTTON_ID).addEventListener('click', (e) => {
    e.stopPropagation();
    onToggle();
  });
  window.addEventListener('anoria:construction-pause-setting', () => {
    if (!isConstructionPauseEnabled()) exitConstructionMode();
    syncModeButtons();
  });
}

/** Called when the hammer is hit. Nothing happens when the setting is off or the mode already runs. */
export function enterConstructionMode() {
  dropModeOfGoneGame();
  if (!isConstructionPauseEnabled() || active) return;
  const game = getSessionGame();
  if (!game) throw new Error('[ConstructionMode] no game is running: the construction pause cannot start');
  active = true;
  pausedGame = game;
  game.enterConstructionPause();
  syncModeButtons();
}

/** Called when the hammer is hit again: the tool in hand is put down, the buttons hide, the game goes back to what it was. */
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
  syncModeButtons();
}
