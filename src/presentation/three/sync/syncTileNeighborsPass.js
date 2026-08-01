import { requireSessionParcelsApi } from '../../../composition/sessionRuntime.js';
/**
 * Full-grid neighbor persist after the mesh tile loop.
 * Writes Parcels neighbors + markets + road access (not sprite painting).
 */

/**
 * @param {object} params
 * @param {object} params.city
 * @param {object[][]} params.buildings
 * @param {object[][]} params.terrain
 * @param {number} params.time
 * @param {number} params.x
 * @param {number} params.y
 * @param {string} params.buildingId
 * @param {string} params.instanceId
 * @param {{ updateNeighbors: Function, recalculateRoadAccessForBuilding: { execute: Function } }} params.parcels
 * @param {(instanceId: string, fields: Record<string, unknown>) => Promise<unknown>} params.updateBuildingFields
 */
export async function persistTileNeighbors({
  city,
  buildings,
  terrain,
  time,
  x,
  y,
  buildingId,
  instanceId,
  parcels,
  updateBuildingFields,
}) {
  const mesh = buildings[x]?.[y];
  if (!mesh?.userData || !instanceId || !buildingId) {
    return;
  }
  if (mesh.userData.instanceId !== instanceId) {
    mesh.userData.instanceId = instanceId;
  }
  const buildingData = {
    city,
    buildings,
    x,
    y,
    currentBuildingId: buildingId,
    currentInstanceId: instanceId,
    terrain,
  };
  updateBuildingNeighbors(buildingData, 1, time);
  try {
    const allNeighborsWithinZone = getBuildingsNamesInZone(
      buildingData,
      time,
      { buildingTarget: '', zones: [1, 2] }
    );
    const allMarketsInZone = getBuildingsNamesInZone(
      buildingData,
      time,
      { buildingTarget: 'Market-Stall', zones: [1, 2] }
    );
    await parcels.updateNeighbors(instanceId, allNeighborsWithinZone ?? []);
    await updateBuildingFields(instanceId, { markets: allMarketsInZone });
    await parcels.recalculateRoadAccessForBuilding.execute(instanceId);
  } catch (err) {
    console.warn('[Scene] Failed to update neighbors/markets for', buildingId, err);
  }
}

/**
 * @param {object} params
 * @param {object} params.city
 * @param {object[][]} params.buildings
 * @param {object[][]} params.terrain
 * @param {number} params.time
 * @param {object} params.parcels
 * @param {(instanceId: string, fields: Record<string, unknown>) => Promise<unknown>} params.updateBuildingFields
 */
export async function syncTileNeighborsPass({
  city,
  buildings,
  terrain,
  time,
  parcels,
  updateBuildingFields,
}) {
  for (let nx = 0; nx < city.size; nx++) {
    for (let ny = 0; ny < city.size; ny++) {
      const tileBuildingId = city.tiles[nx]?.[ny]?.buildingId;
      const instanceId =
        city.tiles[nx]?.[ny]?.instanceId
        ?? buildings[nx]?.[ny]?.userData?.instanceId
        ?? null;
      if (!tileBuildingId || !instanceId) {
        continue;
      }
      const mesh = buildings[nx]?.[ny];
      if (!mesh?.userData) {
        continue;
      }
      const buildingId = mesh.userData.type || mesh.userData.id || tileBuildingId;
      await persistTileNeighbors({
        city,
        buildings,
        terrain,
        time,
        x: nx,
        y: ny,
        buildingId,
        instanceId,
        parcels,
        updateBuildingFields,
      });
    }
  }
}
