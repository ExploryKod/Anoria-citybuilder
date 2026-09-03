import { getTerrainCatalogEntry } from './terrainCatalog.js';
import { KENNEY_GROUND_GRASS_COLOR } from './terrainAtmosphere.js';
import { resolveTerrainId } from './resolveTerrainId.js';
import { terrainColorHexToCss } from './terrainColorBlend.js';

/**
 * Canonical unlit display color for a terrain type (Three.js hex).
 * Never read GLB/MTL baseColor here — those differ from the calibrated scene look.
 *
 * @param {string} terrainId — e.g. `grass` or `nature:ground_grass`
 * @returns {number}
 */
export function resolveTerrainDisplayColorHex(terrainId) {
  const canonicalId = resolveTerrainId(terrainId);
  const entry = getTerrainCatalogEntry(canonicalId);
  return entry?.displayColor ?? KENNEY_GROUND_GRASS_COLOR;
}

/**
 * @param {string} terrainId
 * @returns {string} CSS hex, e.g. `#2fe7c5`
 */
export function resolveTerrainDisplayColorCss(terrainId) {
  return terrainColorHexToCss(resolveTerrainDisplayColorHex(terrainId));
}
