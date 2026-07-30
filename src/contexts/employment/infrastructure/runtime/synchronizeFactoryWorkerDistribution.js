import db from '../../../../core/persistence/dexie/db.js';
import {
  canonicalizeHouseRecord,
  instanceIdFromHouseRow,
} from '../../../../shared/building-identity/index.js';

/**
 * Legacy sync: align Winery productWorkerDistribution with assigned workers.
 * Runs after DistributeCityWorkers (ECS employment.redistribute or ACL placement hook).
 */
export async function synchronizeFactoryWorkerDistribution() {
  const allBuildings = await db.houses.toArray();

  for (const building of allBuildings) {
    const buildingType = building.type || '';
    if (!buildingType.includes('Winery-001')) continue;

    const buildingId = instanceIdFromHouseRow(building);
    const freshData = await db.houses.get(buildingId);
    if (!freshData) continue;

    const employees = freshData.employees || { worker: 0, worker_need: 0 };
    const productWorkerDistribution = freshData.productWorkerDistribution || {};
    const totalWorkers = employees.worker || 0;
    const totalDistributedWorkers = Object.values(productWorkerDistribution).reduce(
      (sum, count) => sum + (count || 0),
      0
    );

    if (totalDistributedWorkers > totalWorkers) {
      const next = { ...freshData };
      if (totalWorkers === 0) {
        next.productWorkerDistribution = {};
      } else {
        const scaleFactor = totalWorkers / totalDistributedWorkers;
        const adjustedDistribution = {};
        for (const [key, value] of Object.entries(productWorkerDistribution)) {
          adjustedDistribution[key] = Math.floor((value || 0) * scaleFactor);
        }
        next.productWorkerDistribution = adjustedDistribution;
      }
      await db.houses.put(canonicalizeHouseRecord(next));
    }
  }
}
