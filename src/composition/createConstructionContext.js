import { DexieConstructionBuildingRepository } from '../contexts/construction/infrastructure/dexie/DexieConstructionBuildingRepository.js';
import { GetBuildingAtTile } from '../contexts/construction/application/queries/GetBuildingAtTile.js';
import { ListSceneBuildingTypes } from '../contexts/construction/application/queries/ListSceneBuildingTypes.js';
import { PlaceBuildingWithPayment } from '../contexts/construction/application/services/PlaceBuildingWithPayment.js';
import { PlaceBuildingAtTile } from '../contexts/construction/application/services/PlaceBuildingAtTile.js';
import { BulldozeBuildingAtTile } from '../contexts/construction/application/services/BulldozeBuildingAtTile.js';
import { ReclaimStaleBuildingRecords } from '../contexts/construction/application/services/ReclaimStaleBuildingRecords.js';
import { SceneBuildingInventoryAdapter } from '../contexts/construction/infrastructure/adapters/three/SceneBuildingInventoryAdapter.js';
import { getDefaultEmployees } from '../contexts/employment/domain/policies/BuildingEmploymentDefaults.js';
import { buildingPlacementCatalog } from '../shared/building-catalog/index.js';
import { instanceIdFromHouseRow } from '../shared/building-identity/index.js';
import { canPlaceBuildingAtTileWithSupplyRules } from './canPlaceBuildingAtTileWithSupplyRules.js';
import {
  recordConstructionExpense,
  recordConstructionRefund,
} from './constructionTreasuryBridge.js';
import { awaitBudgetReady } from './budgetReadyGate.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getOrCreateParcelsContext } from './createParcelsContext.js';
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
  const catalog = assetCatalog ?? buildingPlacementCatalog;
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
    getTreasurySnapshot:
      getTreasurySnapshotDep
      ?? (() => getOrCreateAccountingContext().getTreasurySnapshot()),
    assetCatalog: catalog,
    getAssetPrice: (buildingId, prices) => prices?.[buildingId]?.price,
    validatePlacement: canPlaceBuildingAtTileWithSupplyRules,
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

    /**
     * @param {string} instanceId
     * @param {string} key
     */
    async getBuildingField(instanceId, key) {
      const row = await repository.findById(instanceId);
      if (row && key in row) {
        return row[key];
      }

      const defaults = {
        stocks: { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
        neighbors: [],
        pop: 0,
        roads: 0,
        worldTime: 0,
      };

      if (defaults[key] !== undefined) {
        return defaults[key];
      }

      return false;
    },

    /**
     * Idempotent legacy schema migration for `employees` on existing rows.
     * @param {string} instanceId
     * @param {string} buildingType
     */
    async ensureBuildingEmployeesSchema(instanceId, buildingType) {
      const buildingData = await repository.findById(instanceId);
      if (!buildingData) return;

      const getDefaults = getDefaultEmployeesDep ?? getDefaultEmployees;

      if (!buildingData.employees) {
        await repository.updateFields(instanceId, {
          employees: getDefaults(buildingType),
        });
        return;
      }

      const employees = buildingData.employees;
      const needsUpdate =
        employees.category !== undefined ||
        employees.worker_need === undefined ||
        employees.elite_need === undefined;

      if (!needsUpdate) return;

      const defaultEmployees = getDefaults(buildingType);
      await repository.updateFields(instanceId, {
        employees: {
          priority:
            employees.priority !== undefined ? employees.priority : defaultEmployees.priority,
          worker_need: defaultEmployees.worker_need,
          elite_need: defaultEmployees.elite_need,
          worker: employees.worker || 0,
          elite: employees.elite || 0,
          sector:
            employees.category !== undefined
              ? employees.category
              : employees.sector || defaultEmployees.sector,
          salary: employees.salary || 0,
        },
      });
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
