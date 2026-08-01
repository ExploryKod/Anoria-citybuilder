import { DexieConstructionBuildingRepository } from '../contexts/construction/infrastructure/dexie/DexieConstructionBuildingRepository.js';
import { GetBuildingAtTile } from '../contexts/construction/application/queries/GetBuildingAtTile.js';
import { ListSceneBuildingTypes } from '../contexts/construction/application/queries/ListSceneBuildingTypes.js';
import { PlaceBuildingWithPayment } from '../contexts/construction/application/services/PlaceBuildingWithPayment.js';
import { PlaceBuildingAtTile } from '../contexts/construction/application/services/PlaceBuildingAtTile.js';
import { BulldozeBuildingAtTile } from '../contexts/construction/application/services/BulldozeBuildingAtTile.js';
import { ReclaimStaleBuildingRecords } from '../contexts/construction/application/services/ReclaimStaleBuildingRecords.js';
import { SceneBuildingInventoryAdapter } from '../contexts/construction/infrastructure/adapters/three/SceneBuildingInventoryAdapter.js';
import {
  recordConstructionExpense,
  recordConstructionRefund,
} from '../js/acl/budget.js';
import {
  awaitBudgetReady,
  getTreasurySnapshot,
} from '../js/acl/accountingGame.js';
import { getOrCreateParcelsContext } from '../js/acl/parcels.js';
import { getDefaultEmployees } from '../contexts/employment/domain/policies/BuildingEmploymentDefaults.js';
import { assetsPrices } from '../shared/building-catalog/index.js';
import { instanceIdFromHouseRow } from '../shared/building-identity/index.js';
import {
  registerSceneBuildingTypeListing,
  resetSceneBuildingInventoryBridgeForTests,
} from './sceneBuildingInventoryBridge.js';

/**
 * Composition root — Construction orchestration (Budget + row persist).
 *
 * @param {object} [deps]
 * @param {import('../contexts/construction/application/ports/ConstructionBuildingRepository.js').ConstructionBuildingRepository} [deps.buildingRepository]
 * @param {import('../contexts/construction/application/ports/SceneBuildingInventoryPort.js').SceneBuildingInventoryPort} [deps.sceneBuildingInventory]
 * @param {(amount: number, reason: string, options?: { buildingInstanceId?: string }) => Promise<object>} [deps.recordExpense]
 * @param {(amount: number, reason: string) => Promise<object>} [deps.recordRefund]
 * @param {(params: { instanceId: string }) => Promise<unknown>} [deps.syncRemovedBuilding]
 * @param {Record<string, { price?: number, gridSize?: number }>} [deps.assetCatalog]
 * @param {(buildingType: string) => object} [deps.getDefaultEmployees]
 * @param {() => Promise<unknown>} [deps.awaitBudgetReady]
 * @param {() => Promise<{ funds?: number }>} [deps.getTreasurySnapshot]
 */
export function createConstructionContext({
  buildingRepository,
  sceneBuildingInventory,
  recordExpense,
  recordRefund,
  syncRemovedBuilding,
  assetCatalog,
  getDefaultEmployees: getDefaultEmployeesDep,
  awaitBudgetReady: awaitBudgetReadyDep,
  getTreasurySnapshot: getTreasurySnapshotDep,
} = {}) {
  const repository = buildingRepository ?? new DexieConstructionBuildingRepository();
  const sceneInventory = sceneBuildingInventory ?? new SceneBuildingInventoryAdapter();
  const catalog = assetCatalog ?? assetsPrices;
  const getBuildingAtTile = new GetBuildingAtTile(repository);
  const listSceneBuildingTypes = new ListSceneBuildingTypes(sceneInventory);
  const placeBuildingWithPayment = new PlaceBuildingWithPayment({
    repository,
    recordExpense: recordExpense ?? recordConstructionExpense,
    recordRefund: recordRefund ?? recordConstructionRefund,
  });
  const reclaimStaleBuildingRecords = new ReclaimStaleBuildingRecords(repository);
  const placeBuildingAtTile = new PlaceBuildingAtTile({
    placeBuildingWithPayment: (data) => placeBuildingWithPayment.execute(data),
    reclaimStaleBuildingRecords: (params) => reclaimStaleBuildingRecords.execute(params),
    getDefaultEmployees: getDefaultEmployeesDep ?? getDefaultEmployees,
    awaitBudgetReady: awaitBudgetReadyDep ?? awaitBudgetReady,
    getTreasurySnapshot: getTreasurySnapshotDep ?? getTreasurySnapshot,
    assetCatalog: catalog,
    getAssetPrice: (buildingId, prices) => prices?.[buildingId]?.price,
  });
  const bulldozeBuildingAtTile = new BulldozeBuildingAtTile({
    syncRemovedBuilding:
      syncRemovedBuilding
      ?? (({ instanceId }) => getOrCreateParcelsContext().syncRemovedBuilding({ instanceId })),
    assetCatalog: catalog,
  });

  registerSceneBuildingTypeListing(() => listSceneBuildingTypes.execute());

  return {
    buildingRepository: repository,
    getBuildingAtTile,

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

    /**
     * @param {{ city: object, x: number, y: number, buildingType: string, gameTurn: number }} params
     */
    async placeBuildingAtTile(params) {
      return placeBuildingAtTile.execute(params);
    },

    /**
     * @param {{ city: object, x: number, y: number, meshInstanceId?: string | null }} params
     */
    async bulldozeBuildingAtTile(params) {
      return bulldozeBuildingAtTile.execute(params);
    },

    /**
     * Drop Dexie rows on tiles that city.tiles still treats as empty.
     * @param {{ city: object, x: number, y: number, gridSize?: number }} params
     */
    async reclaimStaleBuildingRecordsForPlacement(params) {
      return reclaimStaleBuildingRecords.execute(params);
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

    /** @param {{ city: { size: number }, buildings: object[][] }} ctx */
    bindSceneBuildingGrid(ctx) {
      sceneInventory.bind(ctx);
    },

    /** @returns {string[]} */
    listSceneBuildingTypes() {
      return listSceneBuildingTypes.execute();
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
  resetSceneBuildingInventoryBridgeForTests();
}
