/**
 * Active hamlet session — one 3D scene at a time.
 * Building rows in Dexie are scoped by `hamletId`.
 *
 * `eraanurbs` remains the persistence id of the starting hamlet (saves / Dexie v3).
 * The on-screen name is a hamlet name, not the game title Eraanurbs.
 *
 * Persistence: IndexedDB only (`game` row `hamlet-session`). RAM cache for sync reads.
 */

import db from '../dexie/db.js';

export const DEFAULT_HAMLET_ID = 'eraanurbs';

/** Dexie `game` table row key for the active hamlet session. */
export const HAMLET_SESSION_ROW_KEY = 'hamlet-session';

/** @deprecated One-time migration from pre-Dexie-session storage. */
const LEGACY_ACTIVE_HAMLET_STORAGE_KEY = 'anoria.activeHamletId';

export const PROTO_HAMLETS = [
  { id: 'eraanurbs', name: 'Val d’Era' },
  { id: 'clairiere', name: 'Clairière' },
  { id: 'pont-saules', name: 'Pont-aux-Saules' },
  { id: 'bruyeres', name: 'Les Bruyères' },
  { id: 'rochehaute', name: 'Rochehaute' },
  { id: 'prevert', name: 'Prévert' },
  { id: 'sourceclaire', name: 'Sourceclaire' },
  { id: 'bois-joli', name: 'Bois-Joli' },
  { id: 'marais-blanc', name: 'Marais-Blanc' },
  { id: 'colline-rouge', name: 'Colline-Rouge' },
];

/** @type {string} */
let activeHamletId = DEFAULT_HAMLET_ID;

export function getActiveHamletId() {
  return activeHamletId;
}

export function hamletIdOf(row) {
  return typeof row?.hamletId === 'string' && row.hamletId.length > 0
    ? row.hamletId
    : DEFAULT_HAMLET_ID;
}

export function isActiveHamletRow(row) {
  return hamletIdOf(row) === activeHamletId;
}

/**
 * @param {object[]} rows
 * @returns {object[]}
 */
export function filterActiveHamletRows(rows) {
  return rows.filter(isActiveHamletRow);
}

/**
 * @param {string} hamletId
 * @returns {Promise<void>}
 */
async function persistActiveHamletId(hamletId) {
  await db.game.put({
    name: HAMLET_SESSION_ROW_KEY,
    activeHamletId: hamletId,
  });
}

function isKnownHamletId(id) {
  return typeof id === 'string' && PROTO_HAMLETS.some((h) => h.id === id);
}

/**
 * @returns {Promise<string | null>}
 */
async function readPersistedActiveHamletId() {
  const session = await db.game.get(HAMLET_SESSION_ROW_KEY);
  return isKnownHamletId(session?.activeHamletId) ? session.activeHamletId : null;
}

/**
 * @returns {string | null}
 */
function readLegacyActiveHamletIdFromLocalStorage() {
  try {
    const stored = localStorage.getItem(LEGACY_ACTIVE_HAMLET_STORAGE_KEY);
    if (isKnownHamletId(stored)) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function clearLegacyActiveHamletIdFromLocalStorage() {
  try {
    localStorage.removeItem(LEGACY_ACTIVE_HAMLET_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Load active hamlet from Dexie (migrates legacy localStorage once if needed).
 * @returns {Promise<void>}
 */
async function restoreActiveHamletIdFromPersistence() {
  let stored = await readPersistedActiveHamletId();
  if (!stored) {
    const legacy = readLegacyActiveHamletIdFromLocalStorage();
    if (legacy) {
      stored = legacy;
      await persistActiveHamletId(legacy);
      clearLegacyActiveHamletIdFromLocalStorage();
    }
  }
  activeHamletId = stored ?? DEFAULT_HAMLET_ID;
}

export function setActiveHamletId(hamletId) {
  if (!hamletId || typeof hamletId !== 'string') return;
  if (!isKnownHamletId(hamletId)) return;
  activeHamletId = hamletId;
  void persistActiveHamletId(hamletId);
}

/**
 * Seed the proto hamlets and restore the last active id from IndexedDB.
 * @returns {Promise<void>}
 */
export async function ensureHamletCatalog() {
  for (const proto of PROTO_HAMLETS) {
    const existing = await db.hamlets.get(proto.id);
    if (!existing) {
      await db.hamlets.put({
        id: proto.id,
        name: proto.name,
        natureSeeded: false,
        unlocked: proto.id === DEFAULT_HAMLET_ID,
      });
      continue;
    }
    const patch = { ...existing, name: proto.name };
    if (existing.unlocked === undefined) {
      patch.unlocked = existing.id === DEFAULT_HAMLET_ID;
    }
    if (patch.name !== existing.name || patch.unlocked !== existing.unlocked) {
      await db.hamlets.put(patch);
    }
  }

  await restoreActiveHamletIdFromPersistence();

  if (activeHamletId !== DEFAULT_HAMLET_ID) {
    const activeRow = await db.hamlets.get(activeHamletId);
    if (!activeRow?.unlocked) {
      activeHamletId = DEFAULT_HAMLET_ID;
      await persistActiveHamletId(DEFAULT_HAMLET_ID);
    }
  } else if (!(await readPersistedActiveHamletId())) {
    await persistActiveHamletId(DEFAULT_HAMLET_ID);
  }
}

/**
 * @returns {Promise<{ id: string, name: string, natureSeeded?: boolean, unlocked?: boolean }[]>}
 */
export async function listHamlets() {
  const rows = await db.hamlets.toArray();
  return PROTO_HAMLETS.map((proto) => {
    const row = rows.find((r) => r.id === proto.id);
    return {
      id: proto.id,
      name: row?.name || proto.name,
      natureSeeded: Boolean(row?.natureSeeded),
      unlocked: row?.unlocked ?? proto.id === DEFAULT_HAMLET_ID,
    };
  });
}

/**
 * @param {string} hamletId
 * @returns {Promise<{ id: string, name: string, natureSeeded?: boolean } | null>}
 */
export async function getHamlet(hamletId) {
  const row = await db.hamlets.get(hamletId);
  const proto = PROTO_HAMLETS.find((h) => h.id === hamletId);
  if (!row && !proto) return null;
  return {
    id: hamletId,
    name: row?.name || proto?.name || hamletId,
    natureSeeded: Boolean(row?.natureSeeded),
  };
}

/**
 * @param {string} hamletId
 * @returns {Promise<void>}
 */
export async function markHamletNatureSeeded(hamletId) {
  const row = await db.hamlets.get(hamletId);
  if (!row) {
    const proto = PROTO_HAMLETS.find((h) => h.id === hamletId);
    await db.hamlets.put({
      id: hamletId,
      name: proto?.name || hamletId,
      natureSeeded: true,
    });
    return;
  }
  await db.hamlets.put({ ...row, natureSeeded: true });
}
