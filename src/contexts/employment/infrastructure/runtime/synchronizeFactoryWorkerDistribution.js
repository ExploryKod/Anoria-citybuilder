/**
 * Legacy sync: align Winery productWorkerDistribution with assigned workers.
 * Runs after DistributeCityWorkers (ECS employment.redistribute or ACL placement hook).
 *
 * @param {import('../../../../js/stores/HousesStore.js').default} housesStore
 */
export async function synchronizeFactoryWorkerDistribution(housesStore) {
  const allBuildings = await housesStore.listAllHouses();

  for (const building of allBuildings) {
    const buildingType = building.type || '';
    if (!buildingType.includes('Winery-001')) continue;

    const buildingId = building.instanceId || building.id || building.name;
    const freshData = await housesStore.getHouse(buildingId);
    if (!freshData) continue;

    const employees = freshData.employees || { worker: 0, worker_need: 0 };
    const productWorkerDistribution = freshData.productWorkerDistribution || {};
    const totalWorkers = employees.worker || 0;
    const totalDistributedWorkers = Object.values(productWorkerDistribution).reduce(
      (sum, count) => sum + (count || 0),
      0
    );

    if (totalDistributedWorkers > totalWorkers) {
      if (totalWorkers === 0) {
        await housesStore.updateHouseFields(buildingId, {
          productWorkerDistribution: {},
        });
      } else {
        const scaleFactor = totalWorkers / totalDistributedWorkers;
        const adjustedDistribution = {};
        for (const [key, value] of Object.entries(productWorkerDistribution)) {
          adjustedDistribution[key] = Math.floor((value || 0) * scaleFactor);
        }
        await housesStore.updateHouseFields(buildingId, {
          productWorkerDistribution: adjustedDistribution,
        });
      }
    }
  }
}
