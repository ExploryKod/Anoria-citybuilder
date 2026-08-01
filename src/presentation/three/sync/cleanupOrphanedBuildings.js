/**
 * Remove Dexie building rows that no longer match city.tiles / scene meshes.
 */

/**
 * @param {object[]} rows
 * @param {{ city: { size: number, tiles: object[][] }, buildings: object[][] }} ctx
 * @returns {string[]}
 */
export function findOrphanedBuildingIds(rows, { city, buildings }) {
  const orphaned = [];

  for (const house of rows) {
    const x = house.x;
    const y = house.y;
    const instanceId = house.instanceId ?? house.id;

    if (!instanceId || !house.type || typeof house.type !== 'string') {
      continue;
    }

    const tile = city.tiles[x]?.[y];
    // city.tiles is the placement source of truth — mesh may lag one frame
    if (tile?.instanceId === instanceId) {
      continue;
    }

    if (x >= 0 && x < city.size && y >= 0 && y < city.size) {
      const buildingInScene = buildings[x] && buildings[x][y];
      const buildingType = buildingInScene?.userData?.type;
      const meshInstanceId = buildingInScene?.userData?.instanceId;

      const isRoad =
        house.type === 'roads'
        || house.type === 'Road'
        || (house.type && house.type.startsWith('StonePath-'));
      const typeMatches = isRoad
        ? buildingType === 'roads' || buildingType === house.type
        : buildingType === house.type;

      if (!buildingInScene || (!typeMatches && meshInstanceId !== instanceId)) {
        orphaned.push(instanceId);
      }
    } else {
      orphaned.push(instanceId);
    }
  }

  return orphaned;
}

/**
 * @param {object} params
 * @param {object} params.city
 * @param {object[][]} params.buildings
 * @param {() => Promise<object[]>} params.listAllBuildingRows
 * @param {(params: { instanceId: string }) => Promise<unknown>} params.syncRemovedBuilding
 * @returns {Promise<string[]>} deleted instanceIds
 */
export async function cleanupOrphanedBuildings({
  city,
  buildings,
  listAllBuildingRows,
  syncRemovedBuilding,
}) {
  const allHousesInDb = await listAllBuildingRows();
  const orphanedHouses = findOrphanedBuildingIds(allHousesInDb, { city, buildings });
  const deleted = [];

  for (const houseId of orphanedHouses) {
    if (!houseId || typeof houseId !== 'string') {
      continue;
    }
    try {
      const orphanRow = allHousesInDb.find(
        (row) => (row.instanceId ?? row.id) === houseId
      );
      await syncRemovedBuilding({ instanceId: houseId });
      const ox = orphanRow?.x ?? orphanRow?.anchorX;
      const oy = orphanRow?.y ?? orphanRow?.anchorY;
      if (
        typeof ox === 'number'
        && typeof oy === 'number'
        && city.tiles?.[ox]?.[oy]
      ) {
        city.tiles[ox][oy].buildingId = undefined;
        city.tiles[ox][oy].instanceId = undefined;
      }
      deleted.push(houseId);
    } catch (error) {
      console.warn(`[Scene] Failed to delete orphaned house ${houseId}:`, error);
    }
  }

  return deleted;
}
