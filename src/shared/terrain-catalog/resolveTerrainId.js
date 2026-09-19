import { TERRAIN_CATALOG } from './terrainCatalog.js';

const LEGACY_TO_CANONICAL = new Map();

for (const [canonicalId, entry] of Object.entries(TERRAIN_CATALOG)) {
  for (const legacyId of entry.legacyIds ?? []) {
    LEGACY_TO_CANONICAL.set(legacyId, canonicalId);
  }
}

/**
 * @param {string} terrainId — e.g. `grass` or `nature:ground_grass`
 * @returns {string}
 */
export function resolveTerrainId(terrainId) {
  return LEGACY_TO_CANONICAL.get(terrainId) ?? terrainId;
}
