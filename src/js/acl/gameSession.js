/**
 * ACL — game session persistence (core Dexie `game` table).
 */
export {
  createGameSessionContext,
  getOrCreateGameSessionContext,
  resetGameSessionContextForTests,
} from '../../composition/createGameSessionContext.js';

import { getOrCreateGameSessionContext } from '../../composition/createGameSessionContext.js';

/** @deprecated Alias for legacy `gameStore` naming. */
export function getGameStore() {
  return getOrCreateGameSessionContext();
}
