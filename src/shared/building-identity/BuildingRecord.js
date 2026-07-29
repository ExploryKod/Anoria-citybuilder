import {
  isPublishedBuildingIdString,
  resolvePublishedBuildingIdFromRef,
  tryParseBuildingId,
} from './BuildingId.js';

/**
 * Normalize a HousesStore / Dexie row before persistence.
 * Ensures `id` = `name` = Published Language `{type}-{x}-{y}`.
 *
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
export function canonicalizeHouseRecord(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('canonicalizeHouseRecord: invalid record');
  }

  const id = resolvePublishedBuildingIdFromRef(raw);
  if (!id) {
    throw new Error('canonicalizeHouseRecord: cannot resolve building id');
  }

  const parsed = tryParseBuildingId(id);
  const type =
    parsed?.type ??
    (typeof raw.type === 'string' && raw.type.length > 0 ? raw.type : '');

  const record = {
    ...raw,
    id,
    name: id,
    type,
  };

  if (parsed) {
    record.x = parsed.x;
    record.y = parsed.y;
  } else {
    if (Number.isInteger(raw.x)) record.x = raw.x;
    if (Number.isInteger(raw.y)) record.y = raw.y;
  }

  return record;
}

/** @param {Record<string, unknown>} raw */
export function tryCanonicalizeHouseRecord(raw) {
  try {
    return canonicalizeHouseRecord(raw);
  } catch {
    return null;
  }
}

/**
 * Read path: published id from a Dexie row (canonical or legacy-tolerant).
 * Prefer rows written via `canonicalizeHouseRecord`; falls back to resolver.
 *
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string}
 */
export function publishedIdFromHouseRow(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('publishedIdFromHouseRow: invalid row');
  }

  if (typeof row.id === 'string' && isPublishedBuildingIdString(row.id)) {
    return row.id;
  }

  const resolved = resolvePublishedBuildingIdFromRef(row);
  if (resolved && isPublishedBuildingIdString(resolved)) {
    return resolved;
  }

  throw new Error('publishedIdFromHouseRow: cannot resolve published building id');
}

/** @param {Record<string, unknown> | null | undefined} row */
export function tryPublishedIdFromHouseRow(row) {
  try {
    return publishedIdFromHouseRow(row);
  } catch {
    return null;
  }
}
