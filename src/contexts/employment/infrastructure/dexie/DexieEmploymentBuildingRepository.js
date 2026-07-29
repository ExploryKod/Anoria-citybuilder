import { createEmploymentBuildingSnapshot } from '../../domain/EmploymentBuildingSnapshot.js';
import {
  isHouseType,
  isRoadType,
  isWorkplace,
} from '../../domain/policies/BuildingRolePolicy.js';
import { instanceIdFromHouseRow } from '../../../../shared/building-identity/index.js';

/**
 * Dexie / HousesStore adapter for Employment.
 */
export class DexieEmploymentBuildingRepository {
  /**
   * @param {import('../../../../js/stores/HousesStore.js').default} housesStore
   */
  constructor(housesStore) {
    this.housesStore = housesStore;
  }

  #toSnapshot(house) {
    const employees = house.employees || {};
    return createEmploymentBuildingSnapshot({
      id: instanceIdFromHouseRow(house),
      type: house.type || '',
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      pop: house.pop ?? 0,
      worker: employees.worker ?? 0,
      workerNeed: employees.worker_need ?? 0,
      sector: employees.sector ?? 0,
    });
  }

  async listLaborSources() {
    const houses = await this.housesStore.listAllHouses();
    return houses
      .filter((h) => isHouseType(h.type || ''))
      .map((h) => this.#toSnapshot(h));
  }

  async listWorkplaces() {
    const houses = await this.housesStore.listAllHouses();
    return houses
      .map((h) => this.#toSnapshot(h))
      .filter((s) => isWorkplace(s));
  }

  async listAllSnapshots() {
    const houses = await this.housesStore.listAllHouses();
    return houses.map((h) => this.#toSnapshot(h));
  }

  async resetWorkplaceWorkers() {
    const houses = await this.housesStore.listAllHouses();
    for (const house of houses) {
      const type = house.type || '';
      if (isHouseType(type) || isRoadType(type)) continue;

      const employees = house.employees || {};
      if (!(employees.worker_need > 0)) continue;

      const buildingId = instanceIdFromHouseRow(house);
      await this.housesStore
        .updateHouseFields(buildingId, {
          employees: { ...employees, worker: 0 },
        })
        .catch((err) => {
          console.warn('[DexieEmploymentBuildingRepository] Failed to reset workers:', {
            buildingId,
            error: err?.message || err,
          });
        });
    }
  }

  async saveWorkers(buildingId, workerCount) {
    if (!buildingId) return;
    const house = await this.housesStore.getHouse(buildingId);
    if (!house) return;

    const employees = house.employees || { worker: 0, worker_need: 0 };
    await this.housesStore
      .updateHouseFields(buildingId, {
        employees: {
          ...employees,
          worker: Math.max(0, Math.floor(workerCount) || 0),
        },
      })
      .catch((err) => {
        console.warn('[DexieEmploymentBuildingRepository] Failed to save workers:', {
          buildingId,
          error: err?.message || err,
        });
      });
  }
}
