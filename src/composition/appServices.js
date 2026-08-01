/**
 * Registration helpers — sessionRuntime is always written; AppRegistry only when mirrored.
 */

import appRegistry, { isAppRegistryMirrorEnabled } from './AppRegistry.js';
import {
  getSessionGame,
  getSessionGameTime,
  getSessionScene,
  getSessionCity,
  getSessionProcessLoanPayments,
  getSessionService,
  setSessionService,
} from './sessionRuntime.js';

/** @param {string} name @param {*} instance @param {boolean} [exposeOnWindow] */
export function registerAppService(name, instance, exposeOnWindow = false) {
  if (isAppRegistryMirrorEnabled()) {
    // AppRegistry.register syncs sessionRuntime + mirror store
    appRegistry.register(name, instance, exposeOnWindow);
    return;
  }
  setSessionService(name, instance);
}

/** @param {string} name @returns {*} */
export function getAppService(name) {
  if (name === 'processLoanPayments') {
    return getSessionProcessLoanPayments();
  }
  return getSessionService(name);
}

export function getGame() {
  return getSessionGame();
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
