/**
 * Active hamlet session — one 3D scene at a time.
 * Building rows in Dexie are scoped by `hamletId`.
 *
 * `eraanurbs` remains the persistence id of the starting hamlet (saves / Dexie v3).
 * The on-screen name is a hamlet name, not the game title Eraanurbs.
 */

import db from '../dexie/db.js';

export const DEFAULT_HAMLET_ID = 'eraanurbs';

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

const STORAGE_KEY = 'anoria.activeHamletId';

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

export function setActiveHamletId(hamletId) {
  if (!hamletId || typeof hamletId !== 'string') return;
  if (!PROTO_HAMLETS.some((h) => h.id === hamletId)) return;
  activeHamletId = hamletId;
  try {
    localStorage.setItem(STORAGE_KEY, hamletId);
  } catch {
    /* ignore */
  }
}

function isKnownHamletId(id) {
  return PROTO_HAMLETS.some((h) => h.id === id);
}

function readStoredActiveId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isKnownHamletId(stored)) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_HAMLET_ID;
}

/**
 * Seed the proto hamlets and restore the last active id.
 * @returns {Promise<void>}
 */
export async function ensureHamletCatalog() {
  activeHamletId = readStoredActiveId();

  for (const proto of PROTO_HAMLETS) {
    const existing = await db.hamlets.get(proto.id);
    if (!existing) {
      await db.hamlets.put({
        id: proto.id,
        name: proto.name,
        natureSeeded: false,
      });
      continue;
    }
    if (existing.name !== proto.name) {
      await db.hamlets.put({ ...existing, name: proto.name });
    }
  }
}

/**
 * @returns {Promise<{ id: string, name: string, natureSeeded?: boolean }[]>}
 */
export async function listHamlets() {
  const rows = await db.hamlets.toArray();
  return PROTO_HAMLETS.map((proto) => {
    const row = rows.find((r) => r.id === proto.id);
    return {
      id: proto.id,
      name: row?.name || proto.name,
      natureSeeded: Boolean(row?.natureSeeded),
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
