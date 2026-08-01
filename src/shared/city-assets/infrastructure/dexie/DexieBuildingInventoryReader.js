import db from '../../../../core/persistence/dexie/db.js';

/** Read-only inventory of built rows (valuation, counts). */
export class DexieBuildingInventoryReader {
  async listBuildingRows() {
    return db.houses.toArray();
  }
}
