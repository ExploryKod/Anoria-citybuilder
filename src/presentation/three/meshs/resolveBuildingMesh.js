import { BUILDING_ASSET_CATALOG } from './BuildingAssetCatalog.js';
import { getKenneyCityKitMeshAdapter } from '../adapters/kenney-city-kit/KenneyCityKitMeshAdapter.js';

/**
 * Resolves and creates the mesh for a stable building id, via whichever
 * adapter its BUILDING_ASSET_CATALOG entry names. Single source of truth for
 * building-mesh creation — used by the real game (scene.js) and by the
 * /placement.html tuning tool, so whatever you tune there is guaranteed to
 * match what actually renders in-game.
 *
 * Throws on any missing catalog entry, unknown adapter, or an adapter
 * producing no mesh — no silent fallback.
 *
 * @param {object} params
 * @param {string} params.buildingId
 * @param {number} params.x
 * @param {number} params.y
 * @param {number} [params.rotationStep]
 * @param {object} params.assetManager - the VillageTownAssetManager instance
 * @returns {Promise<import('three').Object3D>}
 */
export async function resolveAndCreateBuildingMesh({ buildingId, x, y, rotationStep = 0, assetManager }) {
  const catalogEntry = BUILDING_ASSET_CATALOG[buildingId];
  if (!catalogEntry) {
    throw new Error(`[BuildingAssetCatalog] No catalog entry for "${buildingId}"`);
  }

  if (catalogEntry.adapter === 'kenneyCityKit') {
    const kenneyMesh = await getKenneyCityKitMeshAdapter().createBuilding(x, y, {
      rotationStep,
      buildingId: catalogEntry.asset,
    });
    if (!kenneyMesh) {
      throw new Error(
        `[BuildingAssetCatalog] No Kenney mesh produced for "${buildingId}" (asset "${catalogEntry.asset}")`
      );
    }
    return kenneyMesh;
  }

  if (catalogEntry.adapter !== 'villageTown') {
    throw new Error(`[BuildingAssetCatalog] Unknown adapter "${catalogEntry.adapter}" for "${buildingId}"`);
  }

  const mesh = assetManager.createAsset(catalogEntry.asset, x, y, { rotationStep });
  if (!mesh) {
    throw new Error(
      `[BuildingAssetCatalog] No village-town mesh produced for "${buildingId}" (asset "${catalogEntry.asset}")`
    );
  }
  return mesh;
}
