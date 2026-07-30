import db from '../../../../core/persistence/dexie/db.js';
import { createBuildingSnapshot } from '../../domain/BuildingSnapshot.js';
import {
  assertBuildingInstanceId,
  canonicalizeHouseRecord,
  instanceIdFromHouseRow,
} from '../../../../shared/building-identity/index.js';

/** Parcels port adapter — accès direct Dexie (table `houses`). */
export class DexieBuildingRepository {
  #toSnapshot(house) {
    return createBuildingSnapshot({
      id: instanceIdFromHouseRow(house),
      type: house.type || '',
      neighbors: house.neighbors || [],
      roadCount: house.roads ?? 0,
      x: house.x ?? null,
      y: house.y ?? null,
    });
  }

  /**
   * @param {string} instanceId
   * @param {Record<string, unknown>} updates
   */
  async #putFields(instanceId, updates) {
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

  async findById(instanceId) {
    const id = assertBuildingInstanceId(instanceId);
    const row = await db.houses.get(id);
    if (!row) return null;
    return this.#toSnapshot(row);
  }

  async findAll() {
    const rows = await db.houses.toArray();
    return rows.map((row) => this.#toSnapshot(row));
  }

  async saveRoadAccess(instanceId, roadCount) {
    const id = assertBuildingInstanceId(instanceId);
    await this.#putFields(id, { roads: roadCount });
  }

  async saveNeighbors(instanceId, neighbors) {
    const id = assertBuildingInstanceId(instanceId);
    await this.#putFields(id, { neighbors });
  }

  async findNeighbors(instanceId) {
    const id = assertBuildingInstanceId(instanceId);
    const row = await db.houses.get(id);
    if (!row) return [];
    return Array.isArray(row.neighbors) ? row.neighbors : [];
  }

  async deleteById(instanceId) {
    const id = assertBuildingInstanceId(instanceId);
    await db.houses.delete(id);
  }
}
