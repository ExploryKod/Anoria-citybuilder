import { DexieGameSessionRepository } from '../core/persistence/dexie/DexieGameSessionRepository.js';

/**
 * Composition root — game session persistence (core / transverse).
 *
 * @param {object} [deps]
 * @param {DexieGameSessionRepository} [deps.gameSessionRepository]
 */
export function createGameSessionContext({ gameSessionRepository } = {}) {
  const repo = gameSessionRepository ?? new DexieGameSessionRepository();

  return {
    gameSessionRepository: repo,

    listAllGameItems() {
      return repo.listAllGameItems();
    },
    getGameItem(name) {
      return repo.getGameItem(name);
    },
    getLatestGameItemByField(fieldName) {
      return repo.getLatestGameItemByField(fieldName);
    },
    getLatestGameItems() {
      return repo.getLatestGameItems();
    },
    addGameItems(data) {
      return repo.addGameItems(data);
    },
    updateLatestGameItemFields(updates) {
      return repo.updateLatestGameItemFields(updates);
    },
    updateGameItemFields(name, updates) {
      return repo.updateGameItemFields(name, updates);
    },
    updateAllGameItems(updates) {
      return repo.updateAllGameItems(updates);
    },
    deleteGameItem(name) {
      return repo.deleteGameItem(name);
    },
    clearGameItems() {
      return repo.clearGameItems();
    },
  };
}

/** @type {ReturnType<typeof createGameSessionContext> | null} */
let sharedGameSession = null;

/** @param {object} [deps] */
export function getOrCreateGameSessionContext(deps = {}) {
  if (!sharedGameSession) {
    sharedGameSession = createGameSessionContext(deps);
  }
  return sharedGameSession;
}

/** @internal Tests only */
export function resetGameSessionContextForTests() {
  sharedGameSession = null;
}
