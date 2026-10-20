import {
  ensureHamletCatalog,
  getDefaultHamletId,
  listHamlets,
  setActiveHamletId,
} from '../../src/core/persistence/hamlet/hamletSession.js';

/** Hamlet UUIDs by slug (`H.clairiere`…), filled by setupHamlets(). */
export const H = {};

/**
 * Create the hamlet rows (fresh UUIDs) and make the starting hamlet active. Call after the database is reset.
 * @returns {Promise<Record<string, string>>}
 */
export async function setupHamlets() {
  await ensureHamletCatalog();
  for (const hamlet of await listHamlets()) {
    H[hamlet.slug] = hamlet.id;
  }
  setActiveHamletId(getDefaultHamletId());
  return H;
}
