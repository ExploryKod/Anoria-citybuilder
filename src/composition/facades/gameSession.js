/**
 * ACL — game session persistence (core Dexie `game` table).
 */
export {
  createGameSessionContext,
  getOrCreateGameSessionContext,
  resetGameSessionContextForTests,
} from '../createGameSessionContext.js';

import { getOrCreateGameSessionContext } from '../createGameSessionContext.js';

/** @deprecated Alias for legacy `gameStore` naming. */
export function getGameStore() {
  return getOrCreateGameSessionContext();
}
