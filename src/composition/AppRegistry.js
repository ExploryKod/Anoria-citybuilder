/**
 * AppRegistry — optional debug mirror of sessionRuntime (window.app).
 * Production source of truth: composition/sessionRuntime.js
 */

import { setSessionService } from './sessionRuntime.js';

/** @returns {boolean} */
export function isAppRegistryMirrorEnabled() {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return true;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    if (window.localStorage?.getItem('anoria.debugAppRegistry') === '1') {
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

const _store = new Map();

const registryApi = {
  register(name, instance, exposeOnWindow = false) {
    setSessionService(name, instance);

    if (instance === null || instance === undefined) {
      _store.delete(name);
    } else {
      _store.set(name, instance);
    }

    if (exposeOnWindow && instance != null && typeof window !== 'undefined') {
      window[name] = instance;
    }
  },

  /** @param {string} name @returns {*} */
  get(name) {
    return _store.has(name) ? _store.get(name) : null;
  },

  /** @param {string} name @returns {boolean} */
  has(name) {
    const value = _store.get(name);
    return value !== null && value !== undefined;
  },

  getAll() {
    const keys = [
      'game',
      'gameUI',
      'popupManager',
      'objectivesTracker',
      'objectivesHistory',
      'tutorialManager',
      'objectivesManager',
      'inputManager',
      'buttonStateManager',
      'EventBlocker',
    ];
    return Object.fromEntries(keys.map((key) => [key, registryApi.get(key)]));
  },
};

const appRegistry = new Proxy(registryApi, {
  get(target, prop, receiver) {
    if (typeof prop === 'symbol') {
      return Reflect.get(target, prop, receiver);
    }
    if (prop in target) {
      return target[prop];
    }
    return _store.has(prop) ? _store.get(prop) : null;
  },
  set(_target, prop, value) {
    if (typeof prop === 'symbol' || prop in registryApi) {
      return false;
    }
    setSessionService(prop, value);
    if (value === null || value === undefined) {
      _store.delete(prop);
    } else {
      _store.set(prop, value);
    }
    return true;
  },
});

if (typeof window !== 'undefined' && isAppRegistryMirrorEnabled()) {
  window.app = appRegistry;
}

export default appRegistry;
