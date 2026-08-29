/**
 * Hamlet travel access — unlocked vs locked (future) vs active.
 */

import db from '../dexie/db.js';
import {
  DEFAULT_HAMLET_ID,
  PROTO_HAMLETS,
  getActiveHamletId,
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
  if (hamletId === DEFAULT_HAMLET_ID) return true;
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
  const proto = PROTO_HAMLETS.find((h) => h.id === hamletId);
  if (!proto) return;

  const row = await db.hamlets.get(hamletId);
  if (row) {
    await db.hamlets.put({ ...row, unlocked: true });
  } else {
    await db.hamlets.put({
      id: hamletId,
      name: proto.name,
      natureSeeded: false,
      unlocked: true,
    });
  }
}

/**
 * @returns {Promise<number>}
 */
export async function unlockAllHamlets() {
  let count = 0;
  for (const proto of PROTO_HAMLETS) {
    const wasUnlocked = await isHamletUnlocked(proto.id);
    await unlockHamlet(proto.id);
    if (!wasUnlocked) count += 1;
  }
  dispatchHamletAccessChanged();
  return count;
}

/**
 * @returns {Promise<{ id: string, name: string, access: 'active' | 'unlocked' | 'locked', natureSeeded?: boolean }[]>}
 */
export async function listHamletsWithAccess() {
  const rows = await db.hamlets.toArray();
  const activeId = getActiveHamletId();

  return Promise.all(
    PROTO_HAMLETS.map(async (proto) => {
      const row = rows.find((r) => r.id === proto.id);
      const access = await getHamletAccessState(proto.id);
      return {
        id: proto.id,
        name: row?.name || proto.name,
        access,
        natureSeeded: Boolean(row?.natureSeeded),
        isActive: proto.id === activeId,
      };
    })
  );
}

export function dispatchHamletAccessChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HAMLET_ACCESS_CHANGED_EVENT));
}
