/**
 * Active hamlet session — one 3D scene at a time.
 * Building rows in Dexie are scoped by `hamletId`, which is the hamlet's UUID.
 *
 * Every hamlet, the starting one included, has a UUID allocated when its row is created. The
 * slug (`eraanurbs`, `clairiere`…) only names the hamlet's definition (name, map position): it
 * is never an identifier in the data or in a URL. The game page is `/game/<uuid>`.
 *
 * The active hamlet is the one in the URL: there is no persisted "last hamlet" to disagree with it.
 */

import db from '../dexie/db.js';
import { HAMLET_CATALOG } from '../../../shared/hamlet-catalog/hamletCatalog.js';

/** Slug of the starting hamlet (its definition in HAMLET_CATALOG). */
export const DEFAULT_HAMLET_SLUG = HAMLET_CATALOG.find((hamlet) => hamlet.starting).slug;

/** @type {Map<string, { id: string, slug: string, name: string }>} uuid → hamlet, once ensured */
const knownHamlets = new Map();

/** @type {string | null} */
let activeHamletId = null;

/**
 * The UUID of a `/game/<uuid>` path, or null for any other path (including bare `/game`).
 * @param {string} pathname
 * @returns {string | null}
 */
export function parseGameHamletPath(pathname) {
  const match = /^\/game\/([0-9a-f-]{36})\/?$/i.exec(pathname ?? '');
  return match ? match[1].toLowerCase() : null;
}

export function getActiveHamletId() {
  return activeHamletId;
}

/** @returns {string | null} The starting hamlet's UUID, once the catalog is ensured. */
export function getDefaultHamletId() {
  for (const hamlet of knownHamlets.values()) {
    if (hamlet.slug === DEFAULT_HAMLET_SLUG) return hamlet.id;
  }
  return null;
}

/** @param {string} hamletId @returns {string | null} The definition slug of a hamlet. */
export function hamletSlugOf(hamletId) {
  return knownHamlets.get(hamletId)?.slug ?? null;
}

/** @param {string} hamletId */
export function isKnownHamletId(hamletId) {
  return knownHamlets.has(hamletId);
}

export function hamletIdOf(row) {
  return typeof row?.hamletId === 'string' && row.hamletId.length > 0
    ? row.hamletId
    : getDefaultHamletId();
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
 * Switch the active hamlet in memory. Only a known hamlet can become active.
 * @param {string} hamletId
 */
export function setActiveHamletId(hamletId) {
  if (!hamletId || !knownHamlets.has(hamletId)) return;
  activeHamletId = hamletId;
}

/**
 * Create the hamlet rows that do not exist yet (one UUID each, allocated once), then pick the active
 * hamlet: the requested one when it is known and unlocked, otherwise the starting hamlet.
 * @param {{ requestedId?: string | null }} [options]
 * @returns {Promise<string>} The active hamlet's UUID.
 */
export async function ensureHamletCatalog({ requestedId = null } = {}) {
  const rows = await db.hamlets.toArray();

  for (const proto of HAMLET_CATALOG) {
    const existing = rows.find((row) => row.slug === proto.slug);
    if (!existing) {
      const row = {
        id: crypto.randomUUID(),
        slug: proto.slug,
        name: proto.name,
        natureSeeded: false,
        unlocked: proto.slug === DEFAULT_HAMLET_SLUG,
      };
      await db.hamlets.put(row);
      rows.push(row);
    } else if (existing.name !== proto.name) {
      existing.name = proto.name;
      await db.hamlets.put(existing);
    }
  }

  knownHamlets.clear();
  for (const row of rows) {
    if (HAMLET_CATALOG.some((proto) => proto.slug === row.slug)) {
      knownHamlets.set(row.id, { id: row.id, slug: row.slug, name: row.name });
    }
  }

  const requested = requestedId ? rows.find((row) => row.id === requestedId) : null;
  const usable = requested && (requested.unlocked || requested.slug === DEFAULT_HAMLET_SLUG);
  activeHamletId = usable ? requested.id : getDefaultHamletId();
  return activeHamletId;
}

/**
 * @returns {Promise<{ id: string, slug: string, name: string, natureSeeded: boolean, unlocked: boolean }[]>}
 */
export async function listHamlets() {
  const rows = await db.hamlets.toArray();
  const catalogIndex = (row) => HAMLET_CATALOG.findIndex((hamlet) => hamlet.slug === row.slug);
  return rows
    .filter((row) => knownHamlets.has(row.id))
    .sort((a, b) => catalogIndex(a) - catalogIndex(b))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      color: colorOfSlug(row.slug),
      natureSeeded: Boolean(row.natureSeeded),
      unlocked: Boolean(row.unlocked),
    }));
}

/** @param {string} slug */
function colorOfSlug(slug) {
  const proto = HAMLET_CATALOG.find((hamlet) => hamlet.slug === slug);
  if (!proto?.color) throw new Error(`[hamletSession] no color declared in HAMLET_CATALOG for "${slug}"`);
  return proto.color;
}

/**
 * @param {string} hamletId
 * @returns {Promise<{ id: string, name: string, natureSeeded: boolean } | null>}
 */
export async function getHamlet(hamletId) {
  const row = await db.hamlets.get(hamletId);
  if (!row) return null;
  return { id: row.id, name: row.name, natureSeeded: Boolean(row.natureSeeded) };
}

/**
 * @param {string} hamletId
 * @returns {Promise<void>}
 */
export async function markHamletNatureSeeded(hamletId) {
  const row = await db.hamlets.get(hamletId);
  if (!row) return;
  await db.hamlets.put({ ...row, natureSeeded: true });
}
