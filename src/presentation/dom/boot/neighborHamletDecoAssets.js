/**
 * Preload meshes used by outskirts neighbor hamlet decoration.
 */

/**
 * @param {import('../../three/meshs/AssetManager.js').default} assetManager
 * @returns {Promise<void>}
 */
export async function ensureNeighborHamletDecoAssets(assetManager) {
  await Promise.all([
    assetManager.initializeBuildings('markets'),
    assetManager.initializeBuildings('infrastructure'),
  ]);
}
