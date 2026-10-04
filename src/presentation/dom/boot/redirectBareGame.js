import { hasPendingBootMode } from '../../pages/site/bootSession.js';

/**
 * A bare /game has no hamlet yet: send it to the starting hamlet's /game/<uuid>. The loader stays on
 * screen meanwhile, and the game does not boot on the bare address.
 * @returns {Promise<boolean>} true when a redirect was started.
 */
export async function redirectBareGameToHamlet() {
  if (!/^\/game\/?$/.test(location.pathname)) return false;
  // A menu choice is pending (new game, tutorial, mission, editor): the boot consumes it first, and a new game
  // empties the database before any hamlet exists. Creating a hamlet here would name one that the reset deletes.
  if (hasPendingBootMode()) return false;
  const { ensureHamletCatalog } = await import('../../../core/persistence/hamlet/hamletSession.js');
  location.replace(`/game/${await ensureHamletCatalog()}`);
  return true;
}
