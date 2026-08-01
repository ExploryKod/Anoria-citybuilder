/**
 * AppRegistry — service locator exposed as window.app.
 * Application code should prefer js/acl/appRuntime.js getters.
 */

const _store = new Map();

const registryApi = {
  register(name, instance, exposeOnWindow = false) {
    if (instance === null || instance === undefined) {
      _store.delete(name);
    } else {
      _store.set(name, instance);
    }

    if (exposeOnWindow && instance != null) {
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
    if (value === null || value === undefined) {
      _store.delete(prop);
    } else {
      _store.set(prop, value);
    }
    return true;
  },
});

if (typeof window !== 'undefined') {
  window.app = appRegistry;
}

export default appRegistry;
