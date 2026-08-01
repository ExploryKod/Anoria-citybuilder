/**
 * Explicit session graph — production spine (plan_ca Barre B).
 * Typed fields for hot paths + generic services map for UI handlers/presenters.
 * AppRegistry may mirror for debug; it is not the source of truth.
 */

/** @type {Map<string, *>} */
const services = new Map();

/** @type {object} */
const state = {
  game: null,
  gameUI: null,
  city: null,
  scene: null,
  inputManager: null,
  multiplayerManager: null,
  timeManager: null,
  /** @type {(() => Promise<void>) | null} */
  processLoanPayments: null,
  parcels: null,
  supply: null,
  housing: null,
  employment: null,
  commerce: null,
  gameplay: null,
  ecsRuntime: null,
  popupManager: null,
  buttonStateManager: null,
};

const TYPED_KEYS = new Set(Object.keys(state));

/**
 * @param {Partial<typeof state>} partial
 */
export function bindSessionRuntime(partial) {
  Object.assign(state, partial);
  for (const [key, value] of Object.entries(partial)) {
    if (value === null || value === undefined) {
      services.delete(key);
    } else {
      services.set(key, value);
    }
  }
}

/**
 * @param {string} name
 * @param {*} instance
 */
export function setSessionService(name, instance) {
  if (instance === null || instance === undefined) {
    services.delete(name);
    if (TYPED_KEYS.has(name)) {
      state[name] = null;
    }
    return;
  }

  services.set(name, instance);
  if (TYPED_KEYS.has(name)) {
    state[name] = instance;
  }
}

/** @param {string} name @returns {*} */
export function getSessionService(name) {
  if (services.has(name)) {
    return services.get(name);
  }
  if (TYPED_KEYS.has(name)) {
    return state[name];
  }
  return null;
}

/** @returns {typeof state} */
export function getSessionRuntime() {
  return state;
}

export function getSessionGame() {
  return state.game ?? getSessionService('game');
}

export function getSessionGameUI() {
  return state.gameUI ?? getSessionService('gameUI');
}

export function getSessionCity() {
  return state.city ?? getSessionGame()?.city ?? null;
}

export function getSessionScene() {
  return state.scene ?? getSessionGame()?.scene ?? null;
}

export function getSessionGameTime() {
  const game = getSessionGame();
  return game?.city?.time ?? game?.time ?? 0;
}

/** @returns {(() => Promise<void>) | null} */
export function getSessionProcessLoanPayments() {
  return state.processLoanPayments ?? getSessionService('processLoanPayments');
}

export function getSessionPopupManager() {
  return state.popupManager ?? getSessionService('popupManager');
}

export function getSessionButtonStateManager() {
  return state.buttonStateManager ?? getSessionService('buttonStateManager');
}

export function getSessionTimeManager() {
  return state.timeManager ?? getSessionService('timeManager');
}

export function pauseSessionGame() {
  const game = getSessionGame();
  if (game && typeof game.pause === 'function') {
    game.pause();
  }
}

export function playSessionGame() {
  const game = getSessionGame();
  if (game && typeof game.play === 'function') {
    game.play();
  }
}

export function replaySessionGame() {
  const game = getSessionGame();
  if (game && typeof game.replay === 'function') {
    game.replay();
  }
}

/** @param {number} funds */
export function updateSessionDisplayedFunds(funds) {
  const gameUI = getSessionGameUI();
  if (gameUI && typeof gameUI.updateFunds === 'function') {
    gameUI.updateFunds(funds);
    return;
  }
  const displayFunds = document.querySelector('.display-funds');
  if (displayFunds) {
    displayFunds.textContent = String(funds);
  }
}

/** @internal Tests only */
export function resetSessionRuntimeForTests() {
  for (const key of TYPED_KEYS) {
    state[key] = null;
  }
  services.clear();
}
