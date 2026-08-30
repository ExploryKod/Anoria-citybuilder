import { resolveTerrainId } from '../../../../shared/terrain-catalog/resolveTerrainId.js';
import { getTerrainCatalogEntry } from '../../../../shared/terrain-catalog/terrainCatalog.js';
import { registerSceneObjectFactory } from '../SceneObjectRegistry.js';
import { createKenneyTerrainSceneTile } from './createKenneyTerrainSceneTile.js';
import { createLegacyPlaceholderTerrainSceneTile } from './createLegacyPlaceholderTerrainSceneTile.js';
import { createLegacyRoadSceneTile } from './createLegacyRoadSceneTile.js';

let registered = false;

/**
 * @param {{
 *   getSharedTerrainMaterials: () => Record<string, import('three').Material>,
 *   getTerrainBoxGeometry: () => import('three').BoxGeometry,
 *   getRoadPlaneGeometry?: () => import('three').PlaneGeometry,
 * }} deps
 */
export function registerTerrainSceneFactories(deps) {
  if (registered) return;
  registered = true;

  registerSceneObjectFactory(
    (logicalId) => {
      const canonical = resolveTerrainId(logicalId);
      return Boolean(getTerrainCatalogEntry(canonical));
    },
    (logicalId, x, y) => createKenneyTerrainSceneTile(logicalId, x, y)
  );

  registerSceneObjectFactory(
    (logicalId) => logicalId === 'roads',
    (logicalId, x, y) => createLegacyRoadSceneTile(logicalId, x, y, {
      materials: deps.getSharedTerrainMaterials(),
      roadGeometry: deps.getRoadPlaneGeometry?.(),
    })
  );

  registerSceneObjectFactory(
    (logicalId) => logicalId === 'terrain',
    (logicalId, x, y) => createLegacyPlaceholderTerrainSceneTile(logicalId, x, y, {
      materials: deps.getSharedTerrainMaterials(),
      boxGeometry: deps.getTerrainBoxGeometry(),
    })
  );
}

/** @internal test helper */
export function resetTerrainSceneFactoryRegistration() {
  registered = false;
}
