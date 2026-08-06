/**
 * Scan voisinage sur la grille Three.js (meshes + city.tiles).
 * Infrastructure Parcels — extrait de js/utils/utils.js (Lot P0).
 */

export const zoneBordersBuildings = (buildingData, time = 0) => {
  const { buildings, x, y, city } = buildingData;

  if (x == null || y == null) {
    console.warn('[zoneBordersBuildings] y and x coordinates have wrong values');
    return false;
  }

  const meshs = [];
  if (buildings) {
    buildings.filter((building) => building).forEach((building) => {
      const temp = [];
      if (Array.isArray(building)) {
        building.filter((mesh) => mesh && mesh.name && mesh.position).forEach((mesh) => {
          const deltaX = Math.abs(mesh.position.x - x);
          const deltaZ = Math.abs(mesh.position.z - y);
          const zone = Math.max(deltaX, deltaZ);
          const meshType = mesh.userData?.type || mesh.name;
          const tileX = mesh.userData?.x ?? mesh.position.x;
          const tileY = mesh.userData?.y ?? mesh.position.z;
          const meshInstanceId =
            mesh.userData?.instanceId
            ?? city?.tiles?.[tileX]?.[tileY]?.instanceId
            ?? null;

          if (!meshInstanceId) {
            return;
          }

          const isRoadNeighbor = Boolean(
            mesh.userData?.isRoad
            || meshType === 'roads'
            || meshType === 'Road'
            || (meshType && meshType.startsWith('StonePath-'))
          );

          let neighborData = {
            time,
            type: meshType,
            instanceId: meshInstanceId,
            id: meshInstanceId,
            x: tileX,
            y: tileY,
            deltaX,
            deltaZ,
            zone,
            isRoad: isRoadNeighbor,
          };

          if (Object.hasOwn(mesh, 'userData') && Object.hasOwn(mesh.userData, 'stocks')) {
            neighborData = { ...neighborData, stocks: mesh.userData.stocks };
          }

          temp.push(neighborData);
        });
      }
      meshs.push(...new Set(temp));
    });
  }

  return [...new Set(meshs)];
};

export function getBuildingsNamesInZone(
  buildingData,
  time = 0,
  targets = { buildingTarget: '', zones: [] }
) {
  if (!buildingData) {
    console.warn('[getBuildingsInZone] buildingData must not be undefined');
    return;
  }

  if (!Object.hasOwn(targets, 'buildingTarget') || !Object.hasOwn(targets, 'zones')) {
    console.error('[getBuildingsInZone] ket buildingTarget or zones are missing from targets object third argument');
    return;
  }

  const zoneBuildings = zoneBordersBuildings(buildingData, time);

  if (targets.buildingTarget !== '' && targets.zones.length > 0) {
    return zoneBuildings.filter(
      (entry) =>
        (entry.type === targets.buildingTarget ||
          entry.type.startsWith(`${targets.buildingTarget}-`)) &&
        targets.zones.includes(entry.zone)
    );
  }

  if (targets.buildingTarget !== '') {
    return zoneBuildings.filter(
      (entry) =>
        entry.type === targets.buildingTarget ||
        entry.type.startsWith(`${targets.buildingTarget}-`)
    );
  }

  if (targets.zones.length > 0) {
    return zoneBuildings.filter((building) => targets.zones.includes(building.zone));
  }

  return zoneBuildings;
}
