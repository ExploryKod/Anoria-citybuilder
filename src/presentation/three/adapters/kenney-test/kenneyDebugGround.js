// Kenney test — diagnostic helpers (ground tint, etc.).

import { KENNEY_DEBUG_BLACK_GROUND } from './kenneyTestConfig.js';

/**
 * Paints grass tiles and the world platform black so window openings reveal
 * whether the visible tint comes from terrain below the building.
 *
 * @param {THREE.Scene} scene
 * @param {import('../../meshs/AssetManager.js').AssetManager} assetManager
 */
export function applyKenneyDebugBlackGround(scene, assetManager) {
  if (!KENNEY_DEBUG_BLACK_GROUND) {
    return;
  }

  const materials = assetManager.getSharedTerrainMaterials();
  if (materials?.grass?.color) {
    materials.grass.color.setHex(0x000000);
  }
  if (materials?.terrain?.color) {
    materials.terrain.color.setHex(0x000000);
  }

  const worldPlatform = scene.getObjectByName('world-platform');
  worldPlatform?.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      mat.color?.setHex(0x000000);
    }
  });
}
