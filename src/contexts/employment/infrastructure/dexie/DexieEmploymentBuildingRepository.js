import db from '../../../../core/persistence/dexie/db.js';
import { refuseResidentsField } from '../../../../core/persistence/dexie/residentsProjection.js';
import { isActiveHamletRow } from '../../../../core/persistence/hamlet/hamletSession.js';
import { residentsCountOf } from '../../../../shared/population/residentsCount.js';
import { createEmploymentBuildingSnapshot } from '../../domain/EmploymentBuildingSnapshot.js';
import {
  isHouseType,
  isRoadType,
  isWorkplace,
} from '../../domain/policies/BuildingRolePolicy.js';
import {
  canonicalizeHouseRecord,
  instanceIdFromHouseRow,
} from '../../../../shared/building-identity/index.js';

/** Employment port adapter — accès direct Dexie (table `houses`). */
export class DexieEmploymentBuildingRepository {
  #toSnapshot(house) {
    const employees = house.employees || {};
    return createEmploymentBuildingSnapshot({
      id: instanceIdFromHouseRow(house),
      type: house.type || '',
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      pop: residentsCountOf(house),
      level: house.level ?? 1,
      worker: employees.worker ?? 0,
      workerNeed: employees.worker_need ?? 0,
      sector: employees.sector ?? 0,
      workerSources: employees.workerSources ?? {},
      appointedFrom: employees.appointedFrom ?? {},
    });
  }

  /**
   * @param {string} instanceId
   * @param {Record<string, unknown>} updates
   */
  async #putFields(instanceId, updates) {
    refuseResidentsField(instanceId, updates);
    const row = await db.houses.get(instanceId);
    if (!row) return;

    const next = { ...row };
    for (const key of Object.keys(updates)) {
      if (updates[key] !== undefined) {
        next[key] = updates[key];
      }
    }

    await db.houses.put(canonicalizeHouseRecord(next));
  }

  async listLaborSources() {
    const rows = await db.houses.toArray();
    return rows
      .filter((row) => isActiveHamletRow(row) && isHouseType(row.type || ''))
      .map((row) => this.#toSnapshot(row));
  }

  async listWorkplaces() {
    const rows = await db.houses.toArray();
    return rows.filter(isActiveHamletRow).map((row) => this.#toSnapshot(row)).filter((snapshot) => isWorkplace(snapshot));
  }

  async listAllSnapshots() {
    const rows = await db.houses.toArray();
    return rows.filter(isActiveHamletRow).map((row) => this.#toSnapshot(row));
  }

  async resetWorkplaceWorkers() {
    const rows = await db.houses.toArray();
    for (const house of rows) {
      if (!isActiveHamletRow(house)) continue;
      const type = house.type || '';
      if (isHouseType(type) || isRoadType(type)) continue;

      const employees = house.employees || {};
      if (!(employees.worker_need > 0)) continue;

      const buildingId = instanceIdFromHouseRow(house);
      try {
        await this.#putFields(buildingId, {
          employees: { ...employees, worker: 0, workerSources: {}, absentSources: {}, appointedFrom: {} },
        });
      } catch (err) {
        console.warn('[DexieEmploymentBuildingRepository] Failed to reset workers:', {
          buildingId,
          error: err?.message || err,
        });
      }
    }
  }

  async saveWorkers(buildingId, workerCount) {
    if (!buildingId) return;
    const row = await db.houses.get(buildingId);
    if (!row) return;

    const employees = row.employees || { worker: 0, worker_need: 0 };
    try {
      await this.#putFields(buildingId, {
        employees: {
          ...employees,
          worker: Math.max(0, Math.floor(workerCount) || 0),
        },
      });
    } catch (err) {
      console.warn('[DexieEmploymentBuildingRepository] Failed to save workers:', {
        buildingId,
        error: err?.message || err,
      });
    }
  }

  /**
   * The houses the workers of a workplace come from: `{ houseId: workers }`, the trace of who is paid by whom.
   * @param {string} buildingId
   * @param {Record<string, number>} sources
   * @param {Record<string, number>} absentSources of those workers, how many are sick (so do not work), by house: `{ houseId: absent }`
   */
  async saveWorkerSources(buildingId, sources, absentSources) {
    if (!buildingId) return;
    if (!absentSources || typeof absentSources !== 'object') throw new Error(`[employment] ${buildingId}: the absent workers must be told, got ${absentSources}`);
    const row = await db.houses.get(buildingId);
    if (!row) return;
    const employees = row.employees || { worker: 0, worker_need: 0 };
    await this.#putFields(buildingId, {
      employees: { ...employees, workerSources: sources, absentSources },
    });
  }

  /**
   * The residents named to the posts of an appointed workplace: `{ houseId: count }` (see `employment.appointed` in buildingEconomy.js).
   * @param {string} buildingId
   * @param {Record<string, number>} appointedFrom
   */
  async saveAppointed(buildingId, appointedFrom) {
    if (!buildingId) return;
    const row = await db.houses.get(buildingId);
    if (!row) return;
    const employees = row.employees || { worker: 0, worker_need: 0 };
    await this.#putFields(buildingId, {
      employees: { ...employees, appointedFrom },
    });
  }
}
