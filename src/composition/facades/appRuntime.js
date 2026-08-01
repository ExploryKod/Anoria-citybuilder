/**
 * ACL façade — thin adapters over sessionRuntime for legacy UI imports.
 * Do not add new call sites; prefer composition/sessionRuntime.js.
 */
import {
  getSessionGame,
  getSessionGameUI,
  getSessionCity,
  getSessionScene,
  getSessionGameTime,
  getSessionService,
  getSessionPopupManager,
  getSessionButtonStateManager,
  getSessionTimeManager,
  pauseSessionGame,
  playSessionGame,
  replaySessionGame,
  updateSessionDisplayedFunds,
} from '../sessionRuntime.js';
import {
  registerAppService as registerAppServiceComposition,
  getAppService as getAppServiceComposition,
} from '../appServices.js';
import { TimeManager as TimeManagerClass } from '../../shared/time/TimeManager.js';

export { default as appRegistry } from '../AppRegistry.js';
export { getGameStore } from './gameSession.js';

/** @param {string} name @param {*} instance @param {boolean} [exposeOnWindow] */
export function registerAppService(name, instance, exposeOnWindow = false) {
  registerAppServiceComposition(name, instance, exposeOnWindow);
}

/** @param {string} name @param {Function} fn */
export function registerAppFunction(name, fn) {
  registerAppService(name, fn);
}

/** @param {string} name @returns {*} */
export function getAppService(name) {
  return getAppServiceComposition(name);
}

export function getGame() {
  return getSessionGame();
}

export function getGameUI() {
  return getSessionGameUI();
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

export function getCommerceSectionPresenter() {
  return getSessionService('commerceSectionPresenter');
}

export function getFactorySectionPresenter() {
  return getSessionService('factorySectionPresenter');
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

export function getGameTime() {
  return getSessionGameTime();
}

export function getGameScene() {
  return getSessionScene();
}

export function getGameCity() {
  return getSessionCity();
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
