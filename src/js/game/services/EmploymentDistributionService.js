import { SimService } from './SimService.js';
import { getAllSectorPriorities } from '../modules/EmployeeHelper.js';
import { getOrCreateEmploymentContext } from '../../acl/employment.js';

/**
 * EmploymentDistributionService — thin facade over Employment BC.
 *
 * Sector priorities stay in localStorage (EmployeeHelper).
 * Factory productWorkerDistribution sync stays here (out of Employment domain).
 */
export class EmploymentDistributionService extends SimService {
  /**
   * @param {City} city
   * @param {HousesStore} housesStore
   * @param {number} time
   * @returns {Promise<void>}
   */
  async simulate(city, housesStore, time = 0) {
    try {
      const employment = getOrCreateEmploymentContext(housesStore);
      const sectorPriorities = getAllSectorPriorities();

      await employment.distributeCityWorkers({ sectorPriorities });

      // Side-effect outside Employment BC (Factory concern)
      await this.synchronizeFactoryWorkerDistribution(housesStore);
    } catch (error) {
      console.error('[EmploymentDistributionService] Error processing employment distribution:', {
        error: error?.message || error,
        time,
        stack: error?.stack,
      });
    }
  }

  /**
   * Synchronizes productWorkerDistribution with employees.worker for all factories.
   * Kept in legacy facade — not part of Employment domain.
   *
   * @param {HousesStore} housesStore
   * @returns {Promise<void>}
   */
  async synchronizeFactoryWorkerDistribution(housesStore) {
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
}
