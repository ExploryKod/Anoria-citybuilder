/**
 * Presentation shell accessors — sessionRuntime + registered handlers.
 * Prefer this over composition/sessionShell.js (legacy ACL façade).
 *
 * Shell ≠ BC use cases: pause/popup/tool handlers live here;
 * accounting/construction/etc. belong on sessionApi (see sessionApi.js).
 */

import { TimeManager as TimeManagerClass } from '../shared/time/TimeManager.js';
import {
  getSessionService,
  getSessionPopupManager,
  getSessionButtonStateManager,
  getSessionTimeManager,
  getSessionGameUI,
  pauseSessionGame,
  playSessionGame,
  replaySessionGame,
  updateSessionDisplayedFunds,
} from './sessionRuntime.js';
import {
  registerAppService,
  getAppService,
  getGame,
  getGameTime,
  getGameScene,
  getGameCity,
} from './appServices.js';

export {
  registerAppService,
  getAppService,
  getGame,
  getGameTime,
  getGameScene,
  getGameCity,
};

export {
  getGameMode,
  isEditorMode,
  isMissionMode,
  isTutorialMode,
  GAME_MODES,
} from '../shared/gameplay/gameMode.js';

export function getGameUI() {
  return getSessionGameUI();
}

/** @param {string} name @param {Function} fn */
export function registerAppFunction(name, fn) {
  registerAppService(name, fn);
}

export function getPopupManager() {
  return getSessionPopupManager();
}

export function getTutorialManager() {
  return getSessionService('tutorialManager');
}

export function getObjectivesManager() {
  return getSessionService('objectivesManager');
}

export function getButtonStateManager() {
  return getSessionButtonStateManager();
}

/** @returns {typeof TimeManagerClass} */
export function getTimeManager() {
  return getSessionTimeManager() ?? TimeManagerClass;
}

/** @param {number} turn */
export function getTimeInfo(turn) {
  return getTimeManager().getTimeInfo(turn);
}

/** @param {number} currentTime @param {number} worldTime */
export function getBuildingAge(currentTime, worldTime) {
  return getTimeManager().getBuildingAge(currentTime, worldTime);
}

/** @param {number} days */
export function formatGameTime(days) {
  return getTimeManager().formatTime(days);
}

export function getInputManager() {
  return getSessionService('inputManager');
}

/** @returns {{ x: number, y: number } | null} */
export function getInputManagerMouse() {
  return getInputManager()?.mouse ?? null;
}

export function getUpdateBudgetDisplayHandler() {
  return getSessionService('updateBudgetDisplay');
}

export async function invokeUpdateBudgetDisplay() {
  const handler = getUpdateBudgetDisplayHandler();
  if (typeof handler === 'function') {
    await handler();
  }
}

export function getObjectivesTracker() {
  return getSessionService('objectivesTracker');
}

export function getObjectivesHistory() {
  return getSessionService('objectivesHistory');
}

export function getWorkSectionPresenter() {
  return getSessionService('workSectionPresenter');
}

export function getFinancesSectionPresenter() {
  return getSessionService('financesSectionPresenter');
}

export function getStorageSectionPresenter() {
  return getSessionService('storageSectionPresenter');
}

export function getHealthSectionPresenter() {
  return getSessionService('healthSectionPresenter');
}

export function getReportSectionPresenter() {
  return getSessionService('reportSectionPresenter');
}

export function getMultiplayerManager() {
  return getSessionService('multiplayerManager');
}

/** @deprecated Prefer getOrCreateGameSessionContext from createGameSessionContext.js */
export { getOrCreateGameSessionContext as getGameStore } from './createGameSessionContext.js';

export function getEventBlockerClass() {
  return getSessionService('EventBlocker');
}

export function getSetActiveToolHandler() {
  return getSessionService('setActiveTool');
}

export function getStartTutorialHandler() {
  return getSessionService('startTutorial');
}

export function getStartObjectivesHandler() {
  return getSessionService('startObjectives');
}

export function getWebglTestMode() {
  return getSessionService('webglTestMode');
}

export function pauseGame() {
  pauseSessionGame();
}

export function playGame() {
  playSessionGame();
}

export function replayGame() {
  replaySessionGame();
}

/** @param {number} funds */
export function updateDisplayedFunds(funds) {
  updateSessionDisplayedFunds(funds);
}

/** @param {Event} event */
export function invokeSetActiveTool(event) {
  const handler = getSetActiveToolHandler();
  if (typeof handler === 'function') {
    handler(event);
  }
}

export function invokeStartTutorial() {
  const handler = getStartTutorialHandler();
  if (typeof handler === 'function') {
    handler();
    return true;
  }
  const tutorialManager = getTutorialManager();
  if (tutorialManager?.showTutorial) {
    tutorialManager.showTutorial();
    return true;
  }
  return false;
}

export async function invokeStartObjectives() {
  const handler = getStartObjectivesHandler();
  if (typeof handler === 'function') {
    await handler();
  }
}
