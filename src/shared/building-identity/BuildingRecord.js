import { assertBuildingInstanceId, isBuildingInstanceId } from './BuildingInstanceId.js';
import {
  footprintFromRecord,
  footprintTilesAsPairs,
} from './Footprint.js';
import {
  initialTierForToolId,
  isResidentialKind,
  resolveBuildingKind,
  tierForResidentialType,
} from './BuildingKind.js';
import { toBuildingIdString } from './BuildingId.js';

/**
 * Normalize a HousesStore / Dexie row before persistence.
 * PK = `instanceId` (UUID). `type` is the asset / mesh label (mutable on evolution).
 *
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
export function canonicalizeHouseRecord(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('canonicalizeHouseRecord: invalid record');
  }

  const instanceId = raw.instanceId ?? raw.id;
  if (!isBuildingInstanceId(instanceId)) {
    throw new Error('canonicalizeHouseRecord: instanceId (UUID) required');
  }

  const type =
    typeof raw.type === 'string' && raw.type.length > 0 ? raw.type : '';

  if (!type) {
    throw new Error('canonicalizeHouseRecord: type (asset label) required');
  }

  const footprint = footprintFromRecord(raw);
  if (!footprint) {
    throw new Error('canonicalizeHouseRecord: footprint / anchor required');
  }

  const kind =
    typeof raw.kind === 'string' && raw.kind.length > 0
      ? raw.kind
      : resolveBuildingKind(type);

  const tier =
    typeof raw.tier === 'number' && Number.isFinite(raw.tier)
      ? Math.floor(raw.tier)
      : initialTierForToolId(type);

  const record = {
    ...raw,
    instanceId,
    id: instanceId,
    kind,
    type,
    tier: isResidentialKind(kind) ? tier : null,
    anchorX: footprint.anchor.x,
    anchorY: footprint.anchor.y,
    x: footprint.anchor.x,
    y: footprint.anchor.y,
    footprintTiles: footprintTilesAsPairs(footprint),
  };

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
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string}
 */
export function instanceIdFromHouseRow(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('instanceIdFromHouseRow: invalid row');
  }

  const id = row.instanceId ?? row.id;
  return assertBuildingInstanceId(id);
}

/** @param {Record<string, unknown> | null | undefined} row */
export function tryInstanceIdFromHouseRow(row) {
  try {
    return instanceIdFromHouseRow(row);
  } catch {
    return null;
  }
}

/**
 * Display-only label for UI/logs (not a primary key).
 *
 * @param {string} type
 * @param {number} x
 * @param {number} y
 * @returns {string | null}
 */
export function toDisplayLabel(type, x, y) {
  return toBuildingIdString(type, x, y);
}

/**
 * Apply residential tier + type on an existing canonical row shape (evolution write).
 *
 * @param {object} params
 * @param {string} params.instanceId
 * @param {string} params.targetType
 * @param {number} [params.targetTier]
 */
export function residentialTierPatch({ instanceId, targetType, targetTier }) {
  assertBuildingInstanceId(instanceId);
  const type = targetType || '';
  const tier =
    typeof targetTier === 'number'
      ? targetTier
      : tierForResidentialType(type);
  return {
    type,
    tier,
  };
}
