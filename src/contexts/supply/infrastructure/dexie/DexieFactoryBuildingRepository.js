import db from '../../../../core/persistence/dexie/db.js';
import {
  canonicalizeHouseRecord,
  instanceIdFromHouseRow,
} from '../../../../shared/building-identity/index.js';

/** Supply factory port adapter — accès direct Dexie (table `houses`). */
export class DexieFactoryBuildingRepository {
  /**
   * @param {string} factoryId
   * @param {Record<string, unknown>} fields
   */
  async #putFields(factoryId, fields) {
    const row = await db.houses.get(factoryId);
    if (!row) return;

    const next = { ...row };
    for (const key of Object.keys(fields)) {
      if (fields[key] !== undefined) {
        next[key] = fields[key];
      }
    }

    await db.houses.put(canonicalizeHouseRecord(next));
  }

  async findFactories() {
    const rows = await db.houses.toArray();
    return rows.filter((row) => {
      const type = row.type || '';
      return type.includes('Winery-001');
    });
  }

  async findById(factoryId) {
    if (!factoryId) return null;
    return db.houses.get(factoryId);
  }

  async updateFields(factoryId, fields) {
    await this.#putFields(factoryId, fields);
  }

  async listNatureItems() {
    const rows = await db.houses.toArray();
    return rows.filter((row) => (row.category || '') === 'nature');
  }

  async listAllRows() {
    return db.houses.toArray();
  }

  instanceId(row) {
    return instanceIdFromHouseRow(row);
  }
}
