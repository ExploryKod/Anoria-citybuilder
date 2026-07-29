import { SimService } from './SimService.js';

/**
 * EmploymentDistributionService — thin facade over Employment BC.
 *
 * Sector priorities stay in localStorage (EmployeeHelper).
 * Factory productWorkerDistribution sync stays here (out of Employment domain).
 */
export class EmploymentDistributionService extends SimService {
  /**
   * @param {City} _city
   * @param {HousesStore} _housesStore
   * @param {number} _time
   * @returns {Promise<void>}
   */
  async simulate(_city, _housesStore, _time = 0) {
    // Redistribution runs after pop evolution in game.update → scene.refreshEmploymentPresentation
  }
}

/**
 * Synchronizes productWorkerDistribution with employees.worker for all factories.
 * @param {import('../stores/HousesStore.js').default} housesStore
 * @returns {Promise<void>}
 */
export async function synchronizeFactoryWorkerDistribution(housesStore) {
  const allBuildings = await housesStore.listAllHouses();

  for (const building of allBuildings) {
    const buildingType = building.type || '';
    if (!buildingType.includes('Winery-001')) continue;

    const buildingId = building.id || building.name;
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
