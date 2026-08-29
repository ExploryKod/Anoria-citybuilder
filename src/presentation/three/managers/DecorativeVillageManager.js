import * as THREE from 'three';
import { buildNeighborHamletDecoSpots } from '../../../core/persistence/hamlet/neighborHamletDecoSpots.js';

const HOUSE_TYPES = ['House-Blue', 'House-Red', 'House-Purple'];
const TREE_TYPES = ['Tree-Pine-001', 'Tree-Square-001', 'Tree-Tall-001'];

/**
 * Decorative outskirts hamlets — fixed spots around the playable grid.
 * Only unlocked neighbors are rendered (active hamlet is the center grid).
 */
export class DecorativeVillageManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../meshs/AssetManager.js').default} assetManager
   */
  constructor(scene, assetManager) {
    this.scene = scene;
    this.assetManager = assetManager;
  }

  /**
   * @param {number} citySize
   * @param {string[]} unlockedHamletIds
   */
  syncUnlockedNeighborHamlets(citySize = 16, unlockedHamletIds = []) {
    this.#removeExistingVillage();

    const unlocked = new Set(unlockedHamletIds);
    const spots = buildNeighborHamletDecoSpots(citySize).filter((spot) => unlocked.has(spot.hamletId));
    if (spots.length === 0) return;

    const margin = Math.max(citySize * 0.5, 20);
    const worldMinX = -margin;
    const worldMaxX = citySize + margin;
    const worldMinZ = -margin;
    const worldMaxZ = citySize + margin;
    const worldPlatformHeight = 0.2;

    const playableMinX = 0;
    const playableMaxX = citySize;
    const playableMinZ = 0;
    const playableMaxZ = citySize;

    const villageGroup = new THREE.Group();
    villageGroup.name = 'decorative-village';

    const decorativeElements = [];

    spots.forEach((hamlet, hamletIndex) => {
      hamlet.houses.forEach((houseOffset, houseIndex) => {
        const x = hamlet.centerX + houseOffset.offsetX;
        const z = hamlet.centerZ + houseOffset.offsetZ;
        if (this.#isValidDecoTile(x, z, playableMinX, playableMaxX, playableMinZ, playableMaxZ, worldMinX, worldMaxX, worldMinZ, worldMaxZ)) {
          decorativeElements.push({
            hamletId: hamlet.hamletId,
            type: HOUSE_TYPES[(hamletIndex + houseIndex) % HOUSE_TYPES.length],
            x,
            z,
          });
        }
      });

      hamlet.trees.forEach((treeOffset, treeIndex) => {
        const x = hamlet.centerX + treeOffset.offsetX;
        const z = hamlet.centerZ + treeOffset.offsetZ;
        if (this.#isValidDecoTile(x, z, playableMinX, playableMaxX, playableMinZ, playableMaxZ, worldMinX, worldMaxX, worldMinZ, worldMaxZ)) {
          decorativeElements.push({
            hamletId: hamlet.hamletId,
            type: TREE_TYPES[(hamletIndex + treeIndex) % TREE_TYPES.length],
            x,
            z,
          });
        }
      });

      if (hamlet.hasMarket) {
        const x = hamlet.centerX;
        const z = hamlet.centerZ;
        if (this.#isValidDecoTile(x, z, playableMinX, playableMaxX, playableMinZ, playableMaxZ, worldMinX, worldMaxX, worldMinZ, worldMaxZ)) {
          decorativeElements.push({ hamletId: hamlet.hamletId, type: 'Market-Stall', x, z });
        }
      }

      if (hamlet.hasWell) {
        const x = hamlet.centerX + 1;
        const z = hamlet.centerZ;
        if (this.#isValidDecoTile(x, z, playableMinX, playableMaxX, playableMinZ, playableMaxZ, worldMinX, worldMaxX, worldMinZ, worldMaxZ)) {
          decorativeElements.push({ hamletId: hamlet.hamletId, type: 'Well-001', x, z });
        }
      }

      hamlet.houses.forEach((houseOffset, houseIndex) => {
        if (houseIndex === 0) return;
        const prevHouse = hamlet.houses[houseIndex - 1];
        const x1 = hamlet.centerX + prevHouse.offsetX;
        const z1 = hamlet.centerZ + prevHouse.offsetZ;
        const x2 = hamlet.centerX + houseOffset.offsetX;
        const z2 = hamlet.centerZ + houseOffset.offsetZ;
        const midX = Math.round((x1 + x2) / 2);
        const midZ = Math.round((z1 + z2) / 2);
        if (this.#isValidDecoTile(midX, midZ, playableMinX, playableMaxX, playableMinZ, playableMaxZ, worldMinX, worldMaxX, worldMinZ, worldMaxZ)) {
          decorativeElements.push({ hamletId: hamlet.hamletId, type: 'StonePath-001', x: midX, z: midZ });
        }
      });
    });

    decorativeElements.forEach((element) => {
      try {
        const asset = this.assetManager.createAsset(element.type, element.x, element.z);
        if (!asset) return;
        asset.userData.isDecorative = true;
        asset.userData.nonInteractive = true;
        asset.userData.hamletId = element.hamletId;
        asset.name = `decorative-${element.hamletId}-${element.type}-${element.x}-${element.z}`;
        asset.position.set(element.x, worldPlatformHeight, element.z);
        villageGroup.add(asset);
      } catch (error) {
        console.warn(
          `[DecorativeVillageManager] Failed to create decorative ${element.type} for ${element.hamletId} at (${element.x}, ${element.z}):`,
          error
        );
      }
    });

    this.scene.add(villageGroup);
  }

  #removeExistingVillage() {
    const existingVillage = this.scene.getObjectByName('decorative-village');
    if (!existingVillage) return;

    this.scene.remove(existingVillage);
    existingVillage.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  #isValidDecoTile(x, z, playableMinX, playableMaxX, playableMinZ, playableMaxZ, worldMinX, worldMaxX, worldMinZ, worldMaxZ) {
    const isOutsidePlayable = x < playableMinX || x > playableMaxX || z < playableMinZ || z > playableMaxZ;
    const isInWorld = x >= worldMinX + 1 && x <= worldMaxX - 1 && z >= worldMinZ + 1 && z <= worldMaxZ - 1;
    return isOutsidePlayable && isInWorld;
  }
}
