/**
 * Hamlet travel access — unlocked vs locked (future) vs active.
 */

import db from '../dexie/db.js';
import {
  getActiveHamletId,
  getDefaultHamletId,
  hamletSlugOf,
  listHamlets,
} from './hamletSession.js';

export const HAMLET_ACCESS = Object.freeze({
  active: 'active',
  unlocked: 'unlocked',
  locked: 'locked',
});

export const HAMLET_ACCESS_CHANGED_EVENT = 'anoria:hamlet-access-changed';

/**
 * @param {string} hamletId
 * @returns {Promise<boolean>}
 */
export async function isHamletUnlocked(hamletId) {
  if (!hamletId) return false;
  if (hamletId === getDefaultHamletId()) return true;
  const row = await db.hamlets.get(hamletId);
  return Boolean(row?.unlocked);
}

/**
 * @param {string} hamletId
 * @returns {Promise<boolean>}
 */
export async function canTravelToHamlet(hamletId) {
  if (!hamletId || hamletId === getActiveHamletId()) return false;
  return isHamletUnlocked(hamletId);
}

/**
 * @param {string} hamletId
 * @returns {Promise<'active' | 'unlocked' | 'locked'>}
 */
export async function getHamletAccessState(hamletId) {
  if (hamletId === getActiveHamletId()) return HAMLET_ACCESS.active;
  return (await isHamletUnlocked(hamletId)) ? HAMLET_ACCESS.unlocked : HAMLET_ACCESS.locked;
}

/**
 * @param {string} hamletId
 * @returns {Promise<void>}
 */
export async function unlockHamlet(hamletId) {
  if (!hamletSlugOf(hamletId)) return;

  const row = await db.hamlets.get(hamletId);
  const wasUnlocked = row ? Boolean(row.unlocked) : hamletId === getDefaultHamletId();

  if (row && !row.unlocked) {
    await db.hamlets.put({ ...row, unlocked: true });
  }

  if (!wasUnlocked) {
    dispatchHamletAccessChanged();
  }
}

/**
 * Unlocked hamlets that should appear as outskirts deco (not the active playable grid).
 * @returns {Promise<string[]>}
 */
export async function listUnlockedNeighborHamletIds() {
  const activeId = getActiveHamletId();
  const hamlets = await listHamletsWithAccess();
  return hamlets
    .filter((h) => h.id !== activeId && h.access === HAMLET_ACCESS.unlocked)
    .map((h) => h.id);
}

/**
 * @returns {Promise<number>}
 */
export async function unlockAllHamlets() {
  let count = 0;
  for (const hamlet of await listHamlets()) {
    const wasUnlocked = await isHamletUnlocked(hamlet.id);
    await unlockHamlet(hamlet.id);
    if (!wasUnlocked) count += 1;
  }
  dispatchHamletAccessChanged();
  return count;
}

/**
 * @returns {Promise<{ id: string, slug: string, name: string, access: 'active' | 'unlocked' | 'locked', natureSeeded?: boolean, isActive: boolean }[]>}
 */
export async function listHamletsWithAccess() {
  const activeId = getActiveHamletId();
  const hamlets = await listHamlets();
  return Promise.all(
    hamlets.map(async (hamlet) => ({
      id: hamlet.id,
      slug: hamlet.slug,
      name: hamlet.name,
      access: await getHamletAccessState(hamlet.id),
      natureSeeded: hamlet.natureSeeded,
      isActive: hamlet.id === activeId,
    }))
  );
}

export function dispatchHamletAccessChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HAMLET_ACCESS_CHANGED_EVENT));
}
