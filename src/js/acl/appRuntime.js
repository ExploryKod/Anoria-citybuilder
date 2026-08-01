/**
 * ACL — accès au runtime applicatif (remplace window.* legacy).
 * Point d'entrée unique : AppRegistry via window.app (composition legacy).
 */
import appRegistry from '../game/AppRegistry.js';
import { TimeManager as TimeManagerClass } from '../game/utils/TimeManager.js';

export { default as appRegistry } from '../game/AppRegistry.js';

/** @param {string} name @param {*} instance @param {boolean} [exposeOnWindow] */
export function registerAppService(name, instance, exposeOnWindow = false) {
  appRegistry.register(name, instance, exposeOnWindow);
}

/** @param {string} name @param {Function} fn */
export function registerAppFunction(name, fn) {
  registerAppService(name, fn);
}

/** @param {string} name @returns {*} */
export function getAppService(name) {
  return appRegistry.get(name);
}

export function getGame() {
  return appRegistry.get('game');
}

export function getGameUI() {
  return appRegistry.get('gameUI');
}

export function getPopupManager() {
  return appRegistry.get('popupManager');
}

export function getTutorialManager() {
  return appRegistry.get('tutorialManager');
}

export function getButtonStateManager() {
  return appRegistry.get('buttonStateManager');
}

export function getGameStore() {
  return appRegistry.get('gameStore');
}

/** @returns {typeof TimeManagerClass} */
export function getTimeManager() {
  return appRegistry.get('timeManager') ?? TimeManagerClass;
}

/** @param {number} turn */
export function getTimeInfo(turn) {
  return getTimeManager().getTimeInfo(turn);
}

export function getFoodTraceabilityService() {
  return appRegistry.get('foodTraceabilityService');
}

export function getInputManager() {
  return appRegistry.get('inputManager');
}

/** @returns {{ x: number, y: number } | null} */
export function getInputManagerMouse() {
  return getInputManager()?.mouse ?? null;
}

export function getUpdateBudgetDisplayHandler() {
  return appRegistry.get('updateBudgetDisplay');
}

export async function invokeUpdateBudgetDisplay() {
  const handler = getUpdateBudgetDisplayHandler();
  if (typeof handler === 'function') {
    await handler();
  }
}

export function getObjectivesTracker() {
  return appRegistry.get('objectivesTracker');
}

export function getObjectivesHistory() {
  return appRegistry.get('objectivesHistory');
}

export function getObjectivesStore() {
  return appRegistry.get('objectivesStore');
}

export function getWorkSectionManager() {
  return appRegistry.get('workSectionManager');
}

export function getMultiplayerManager() {
  return appRegistry.get('multiplayerManager');
}

export function getEventBlockerClass() {
  return appRegistry.get('EventBlocker');
}

export function getSetActiveToolHandler() {
  return appRegistry.get('setActiveTool');
}

export function getStartTutorialHandler() {
  return appRegistry.get('startTutorial');
}

export function getStartObjectivesHandler() {
  return appRegistry.get('startObjectives');
}

export function getWebglTestMode() {
  return appRegistry.get('webglTestMode');
}

export function getGameTime() {
  const game = getGame();
  return game?.city?.time ?? game?.time ?? 0;
}

export function getGameScene() {
  return getGame()?.scene ?? null;
}

export function getGameCity() {
  return getGame()?.city ?? null;
}

export function pauseGame() {
  const game = getGame();
  if (game && typeof game.pause === 'function') {
    game.pause();
  }
}

export function playGame() {
  const game = getGame();
  if (game && typeof game.play === 'function') {
    game.play();
  }
}

export function replayGame() {
  const game = getGame();
  if (game && typeof game.replay === 'function') {
    game.replay();
  }
}

/** @param {number} funds */
export function updateDisplayedFunds(funds) {
  const gameUI = getGameUI();
  if (gameUI && typeof gameUI.updateFunds === 'function') {
    gameUI.updateFunds(funds);
    return;
  }
  const displayFunds = document.querySelector('.display-funds');
  if (displayFunds) {
    displayFunds.textContent = String(funds);
  }
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

/** @param {*} employmentPriorityService */
export function attachEmploymentPriorityToWorkSection(employmentPriorityService) {
  const workSection = getWorkSectionManager();
  if (workSection?.setPriorityService) {
    workSection.setPriorityService(employmentPriorityService);
    return;
  }

  const checkWorkSection = setInterval(() => {
    const mgr = getWorkSectionManager();
    if (mgr?.setPriorityService) {
      mgr.setPriorityService(employmentPriorityService);
      clearInterval(checkWorkSection);
    }
  }, 100);
  setTimeout(() => clearInterval(checkWorkSection), 5000);
}
