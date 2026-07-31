import { DexieConstructionBuildingRepository } from '../contexts/construction/infrastructure/dexie/DexieConstructionBuildingRepository.js';
import { GetBuildingAtTile } from '../contexts/construction/application/queries/GetBuildingAtTile.js';
import { PlaceBuildingWithPayment } from '../contexts/construction/application/services/PlaceBuildingWithPayment.js';
import budgetManager from '../js/stores/BudgetManager.js';
import { instanceIdFromHouseRow } from '../shared/building-identity/index.js';

/**
 * Composition root — Construction orchestration (Budget + row persist).
 *
 * @param {object} [deps]
 * @param {import('../contexts/construction/application/ports/ConstructionBuildingRepository.js').ConstructionBuildingRepository} [deps.buildingRepository]
   * @param {(amount: number, reason: string, options?: { buildingInstanceId?: string }) => Promise<object>} [deps.recordExpense]
   * @param {(amount: number, reason: string) => Promise<object>} [deps.recordRefund]
 */
export function createConstructionContext({
  buildingRepository,
  recordExpense,
  recordRefund,
} = {}) {
  const repository = buildingRepository ?? new DexieConstructionBuildingRepository();
  const getBuildingAtTile = new GetBuildingAtTile(repository);
  const placeBuildingWithPayment = new PlaceBuildingWithPayment({
    repository,
    recordExpense:
      recordExpense ??
      ((amount, reason, options) =>
        budgetManager.addConstructionExpense(amount, reason, options)),
    recordRefund:
      recordRefund ??
      ((amount, reason, options) =>
        budgetManager.addConstructionRefund(amount, reason, options)),
  });

  return {
    buildingRepository: repository,
    getBuildingAtTile,
    placeBuildingWithPayment,

    /** @param {{ x: number, y: number }} params */
    async findBuildingAtTile({ x, y }) {
      const row = await getBuildingAtTile.execute({ x, y });
      if (!row) return null;
      return {
        instanceId: instanceIdFromHouseRow(row),
        type: row.type || '',
        x: row.x ?? null,
        y: row.y ?? null,
      };
    },

    /** @param {object} data */
    async placeBuildingWithPayment(data) {
      return placeBuildingWithPayment.execute(data);
    },

    /** @param {object} data — nature spawns / free placement (no budget). */
    async placeBuildingRecord(data) {
      return repository.addRecord(data);
    },

    /** @param {string} instanceId */
    async getBuildingById(instanceId) {
      return repository.findById(instanceId);
    },

    /** @param {string} instanceId @param {Record<string, unknown>} fields */
    async updateBuildingFields(instanceId, fields) {
      return repository.updateFields(instanceId, fields);
    },

    /**
     * @param {{ instanceId: string, field: string, increment: number, condition?: { limit: number } | false }} params
     */
    async incrementBuildingField({ instanceId, field, increment, condition = false }) {
      return repository.incrementField(instanceId, field, increment, condition);
    },

    async listAllBuildingRows() {
      return repository.listAllRows();
    },

    /** Hard delete row only — prefer Parcels `syncRemovedBuilding` when adjacency matters. */
    async removeBuildingRecord(instanceId) {
      return repository.deleteById(instanceId);
    },
  };
}

/** @type {ReturnType<typeof createConstructionContext> | null} */
let sharedConstruction = null;

export function getOrCreateConstructionContext() {
  if (!sharedConstruction) {
    sharedConstruction = createConstructionContext();
  }
  return sharedConstruction;
}

/** @internal Tests only */
export function resetConstructionContextForTests() {
  sharedConstruction = null;
}
