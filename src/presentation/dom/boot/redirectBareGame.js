/**
 * A bare /game has no hamlet yet: send it to the starting hamlet's /game/<uuid>. The loader stays on
 * screen meanwhile, and the game does not boot on the bare address.
 * @returns {Promise<boolean>} true when a redirect was started.
 */
export async function redirectBareGameToHamlet() {
  if (!/^\/game\/?$/.test(location.pathname)) return false;
  const { ensureHamletCatalog } = await import('../../../core/persistence/hamlet/hamletSession.js');
  location.replace(`/game/${await ensureHamletCatalog()}`);
  return true;
}
