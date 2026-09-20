import db from '../../../../core/persistence/dexie/db.js';
import { isActiveHamletRow } from '../../../../core/persistence/hamlet/hamletSession.js';
import { createSupplyBuildingSnapshot } from '../../domain/SupplyBuildingSnapshot.js';
import { createSupplyBuildingView } from '../../domain/SupplyBuildingView.js';
import { createSupplyStock } from '../../domain/value-objects/SupplyStock.js';
import {
  canonicalizeHouseRecord,
  instanceIdFromHouseRow,
} from '../../../../shared/building-identity/index.js';
import {
  hasResourceRole,
  getAllCategoriesForRole,
  getMaxStockForBuilding,
} from '../../domain/policies/ResourceRolePolicy.js';

/** Supply port adapter — accès direct Dexie (table `houses`). */
export class DexieSupplyBuildingRepository {
  async #activeRows() {
    const rows = await db.houses.toArray();
    return rows.filter(isActiveHamletRow);
  }

  #toSnapshot(house) {
    const employees = house.employees || {};
    const type = house.type || '';
    return createSupplyBuildingSnapshot({
      // Passed first so any catalog-declared field (e.g. a periodLock's
      // `field` name) rides along unnamed — the explicit keys below then
      // override with their proper row->snapshot remapping/coercion.
      ...house,
      id: instanceIdFromHouseRow(house),
      type,
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      stocks: house.stocks || {},
      // The catalog is the only source of a stock ceiling — a stored row value never overrides it.
      maxStock: getMaxStockForBuilding(type),
      worker: employees.worker ?? 0,
      workerNeed: employees.worker_need ?? 0,
      neighbors: house.neighbors || [],
      lastProductionYear: house.lastProductionYear ?? null,
      lastConsumptionMonth: house.lastConsumptionMonth ?? null,
      lastSubsistenceMonth: house.lastSubsistenceMonth ?? null,
      lastConsumption: house.lastConsumption ?? null,
      pop: house.pop ?? 0,
      level: house.level ?? 1,
      supplyHubId: house.supplyHubId ?? null,
      linkedDistributors: house.linkedDistributors ?? [],
    });
  }

  #toView(house) {
    const type = house.type || '';
    return createSupplyBuildingView({
      id: instanceIdFromHouseRow(house),
      type,
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      stocks: house.stocks || {},
      // The catalog is the only source of a stock ceiling — a stored row value never overrides it.
      maxStock: getMaxStockForBuilding(type),
      neighbors: house.neighbors || [],
      pop: house.pop ?? 0,
      isBuying: house.isBuying === true,
      noSourcesNearby: house.noSourcesNearby === true,
      distributorTooFar: house.distributorTooFar === true,
      isCollecting: house.isCollecting === true,
      collectedByHub: house.collectedByHub === true,
      lastCollection: house.lastCollection ?? null,
      lastImport: house.lastImport ?? null,
      lastImportDetails: house.lastImportDetails ?? null,
      salesToDistributor: house.salesToDistributor || [],
      salesToHub: house.salesToHub || [],
      isActive: house.isActive !== false,
      commercializeEnabled: house.commercializeEnabled !== false,
      supplyHubId: house.supplyHubId ?? null,
      linkedDistributors: house.linkedDistributors ?? [],
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

  async findById(buildingId) {
    if (!buildingId) return null;
    const row = await db.houses.get(buildingId);
    if (!row) return null;
    return this.#toSnapshot(row);
  }

  async findSupplyView(buildingId) {
    if (!buildingId) return null;
    const row = await db.houses.get(buildingId);
    if (!row) return null;
    return this.#toView(row);
  }

  async listAllSupplyViews() {
    const rows = await this.#activeRows();
    return rows.map((row) => this.#toView(row));
  }

  async saveStocks(buildingId, stocks) {
    await this.#putFields(buildingId, { stocks: createSupplyStock(stocks) });
  }

  async saveHubLastCollection(hubId, lastCollection) {
    await this.#putFields(hubId, { lastCollection });
  }

  async recordSourceSaleToHub(sourceId, { year, productType, quantity, hubId }) {
    const sourceData = await db.houses.get(sourceId);
    if (!sourceData) return;

    const salesToDistributor = sourceData.salesToDistributor || [];
    const salesToHub = sourceData.salesToHub || [];
    const currentYear = Number.isFinite(year) ? Math.floor(year) : 0;

    const existingSaleIndex = salesToHub.findIndex(
      (sale) => sale.year === currentYear && sale.productType === productType
    );

    if (existingSaleIndex >= 0) {
      salesToHub[existingSaleIndex].quantity += quantity;
      salesToHub[existingSaleIndex].count += 1;
    } else {
      salesToHub.push({
        year: currentYear,
        productType,
        quantity,
        count: 1,
        hubId,
        date: new Date().toISOString(),
      });
    }

    const filteredSales = salesToHub.filter((sale) => sale.year === currentYear);

    await this.#putFields(sourceId, {
      salesToDistributor,
      salesToHub: filteredSales,
    });
  }

  async resetSourceSalesForYear(currentYear) {
    const year = Number.isFinite(currentYear) ? Math.floor(currentYear) : 0;
    const rows = await this.#activeRows();
    const sources = rows.filter((row) => hasResourceRole(row.type, 'producer'));

    for (const source of sources) {
      const sourceId = instanceIdFromHouseRow(source);
      const sourceData = await db.houses.get(sourceId);
      if (!sourceData) continue;

      const salesToDistributor = (sourceData.salesToDistributor || []).filter(
        (sale) => sale.year === year
      );
      const salesToHub = (sourceData.salesToHub || []).filter(
        (sale) => sale.year === year
      );

      await this.#putFields(sourceId, {
        salesToDistributor,
        salesToHub,
      });
    }
  }

  async saveSupplyFlags(buildingId, flags) {
    await this.#putFields(buildingId, flags);
  }

  async saveDistributorHubId(distributorId, hubId) {
    await this.#putFields(distributorId, {
      supplyHubId: hubId || null,
    });
  }

  async saveHubLinkedDistributors(hubId, linkedDistributors) {
    const producerCategories = getAllCategoriesForRole('producer');
    await this.#putFields(hubId, {
      linkedDistributors: Array.isArray(linkedDistributors)
        ? linkedDistributors.map((entry) => ({
            distributorId: entry.distributorId,
            x: entry.x,
            y: entry.y,
            allocatedStocks: Object.fromEntries(
              producerCategories.map((category) => [
                category,
                Math.max(0, Math.floor(entry.allocatedStocks?.[category] ?? 0)),
              ])
            ),
          }))
        : [],
    });
  }

  async findRowById(buildingId) {
    if (!buildingId) return null;
    return db.houses.get(buildingId);
  }

  async updateBuildingFields(buildingId, fields) {
    await this.#putFields(buildingId, fields);
  }

  async findByResourceRole(role, categories) {
    const rows = await this.#activeRows();
    return rows
      .filter((row) => hasResourceRole(row.type, role, categories))
      .map((row) => this.#toSnapshot(row));
  }

  async listNatureItems() {
    const rows = await this.#activeRows();
    return rows.filter((row) => (row.category || '') === 'nature');
  }

  async listAllBuildingRows() {
    return this.#activeRows();
  }

  async findBuildingRow(buildingId) {
    if (!buildingId) return null;
    return db.houses.get(buildingId);
  }

  async recordSourceSaleToDistributor(sourceId, sale) {
    const sourceData = await db.houses.get(sourceId);
    if (!sourceData) return;

    const salesToDistributor = sourceData.salesToDistributor || [];
    const salesToHub = sourceData.salesToHub || [];
    const currentYear = sale.year ?? 0;

    salesToDistributor.push({
      year: currentYear,
      month: sale.month ?? 0,
      monthName: sale.monthName || '',
      turn: sale.turn ?? 0,
      productType: sale.productType,
      quantity: sale.quantity,
      distributorId: sale.distributorId,
      date: new Date().toISOString(),
    });

    const filteredSales = salesToDistributor.filter((entry) => entry.year === currentYear);

    await this.#putFields(sourceId, {
      salesToDistributor: filteredSales,
      salesToHub,
    });
  }
}
