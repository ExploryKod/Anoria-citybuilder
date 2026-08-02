import db from '../../../../core/persistence/dexie/db.js';
import { createSupplyBuildingSnapshot } from '../../domain/SupplyBuildingSnapshot.js';
import { createSupplyBuildingView } from '../../domain/SupplyBuildingView.js';
import { createFoodStock } from '../../domain/value-objects/FoodStock.js';
import {
  canonicalizeHouseRecord,
  instanceIdFromHouseRow,
} from '../../../../shared/building-identity/index.js';

/** Supply port adapter — accès direct Dexie (table `houses`). */
export class DexieSupplyBuildingRepository {
  #defaultMaxStock(type) {
    const t = type || '';
    return t.includes('Windmill') || t.includes('windmill') ? 1000 : 500;
  }

  #toSnapshot(house) {
    const employees = house.employees || {};
    const type = house.type || '';
    return createSupplyBuildingSnapshot({
      id: instanceIdFromHouseRow(house),
      type,
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      stocks: house.stocks || {},
      maxStock: house.maxStock ?? this.#defaultMaxStock(type),
      worker: employees.worker ?? 0,
      workerNeed: employees.worker_need ?? 0,
      neighbors: house.neighbors || [],
      lastProductionYear: house.lastProductionYear ?? null,
      lastConsumptionMonth: house.lastConsumptionMonth ?? null,
      pop: house.pop ?? 0,
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
      maxStock: house.maxStock ?? this.#defaultMaxStock(type),
      neighbors: house.neighbors || [],
      pop: house.pop ?? 0,
      isBuying: house.isBuying === true,
      noFarmsNearby: house.noFarmsNearby === true,
      marketTooFar: house.marketTooFar === true,
      isCollecting: house.isCollecting === true,
      soldToWindmill: house.soldToWindmill === true,
      lastCollection: house.lastCollection ?? null,
      lastImport: house.lastImport ?? null,
      lastImportDetails: house.lastImportDetails ?? null,
      salesToMarket: house.salesToMarket || [],
      salesToWindmill: house.salesToWindmill || [],
      isActive: house.isActive !== false,
      commercializeEnabled: house.commercializeEnabled !== false,
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
    const rows = await db.houses.toArray();
    return rows.map((row) => this.#toView(row));
  }

  async saveStocks(buildingId, stocks) {
    const normalized = createFoodStock(stocks);
    await this.#putFields(buildingId, {
      stocks: {
        wheat: normalized.wheat,
        carrot: normalized.carrot,
        cabbage: normalized.cabbage,
        food: normalized.food,
      },
    });
  }

  async saveHarvestMetadata(buildingId, { lastProductionYear, lastProductionMonth }) {
    const fields = {};
    if (lastProductionYear !== undefined) {
      fields.lastProductionYear = lastProductionYear;
    }
    if (lastProductionMonth !== undefined && lastProductionMonth !== null) {
      fields.lastProductionMonth = lastProductionMonth;
    }
    if (Object.keys(fields).length === 0) return;
    await this.#putFields(buildingId, fields);
  }

  async saveConsumptionMetadata(buildingId, { lastConsumptionMonth }) {
    if (lastConsumptionMonth === undefined || lastConsumptionMonth === null) return;
    await this.#putFields(buildingId, { lastConsumptionMonth });
  }

  async saveWindmillLastCollection(windmillId, lastCollection) {
    await this.#putFields(windmillId, { lastCollection });
  }

  async recordFarmSaleToWindmill(farmId, { year, productType, quantity, windmillId }) {
    const farmData = await db.houses.get(farmId);
    if (!farmData) return;

    const salesToMarket = farmData.salesToMarket || [];
    const salesToWindmill = farmData.salesToWindmill || [];
    const currentYear = Number.isFinite(year) ? Math.floor(year) : 0;

    const existingSaleIndex = salesToWindmill.findIndex(
      (sale) => sale.year === currentYear && sale.productType === productType
    );

    if (existingSaleIndex >= 0) {
      salesToWindmill[existingSaleIndex].quantity += quantity;
      salesToWindmill[existingSaleIndex].count += 1;
    } else {
      salesToWindmill.push({
        year: currentYear,
        productType,
        quantity,
        count: 1,
        windmillId,
        date: new Date().toISOString(),
      });
    }

    const filteredSales = salesToWindmill.filter((sale) => sale.year === currentYear);

    await this.#putFields(farmId, {
      salesToMarket,
      salesToWindmill: filteredSales,
    });
  }

  async resetFarmSalesForYear(currentYear) {
    const year = Number.isFinite(currentYear) ? Math.floor(currentYear) : 0;
    const rows = await db.houses.toArray();
    const farms = rows.filter((row) => {
      const type = row.type || '';
      return type.includes('Farm') || type.includes('farm');
    });

    for (const farm of farms) {
      const farmId = instanceIdFromHouseRow(farm);
      const farmData = await db.houses.get(farmId);
      if (!farmData) continue;

      const salesToMarket = (farmData.salesToMarket || []).filter(
        (sale) => sale.year === year
      );
      const salesToWindmill = (farmData.salesToWindmill || []).filter(
        (sale) => sale.year === year
      );

      await this.#putFields(farmId, {
        salesToMarket,
        salesToWindmill,
      });
    }
  }

  async saveMarketFlags(buildingId, flags) {
    await this.#putFields(buildingId, flags);
  }

  async findRowById(buildingId) {
    if (!buildingId) return null;
    return db.houses.get(buildingId);
  }

  async updateBuildingFields(buildingId, fields) {
    await this.#putFields(buildingId, fields);
  }

  async findMarkets() {
    const rows = await db.houses.toArray();
    return rows
      .filter((row) => {
        const type = row.type || '';
        return type.includes('Market');
      })
      .map((row) => this.#toSnapshot(row));
  }

  async findHouses() {
    const rows = await db.houses.toArray();
    return rows
      .filter((row) => {
        const type = row.type || '';
        return type.includes('House') || type.includes('house');
      })
      .map((row) => this.#toSnapshot(row));
  }

  async findWindmills() {
    const rows = await db.houses.toArray();
    return rows
      .filter((row) => {
        const type = row.type || '';
        return type.includes('Windmill') || type.includes('windmill');
      })
      .map((row) => this.#toSnapshot(row));
  }

  async findCommerceBarns() {
    const rows = await db.houses.toArray();
    return rows.filter((row) => {
      const type = row.type || '';
      return type.includes('Barn');
    });
  }

  async saveCommerceStocks(buildingId, commerceStocks) {
    await this.#putFields(buildingId, { commerceStocks });
  }

  async findCommerceBarnRows() {
    return this.findCommerceBarns();
  }

  async findFarms() {
    const rows = await db.houses.toArray();
    return rows
      .filter((row) => {
        const type = row.type || '';
        return type.includes('Farm') || type.includes('farm');
      })
      .map((row) => this.#toSnapshot(row));
  }

  async listAllBuildingRows() {
    return db.houses.toArray();
  }

  async findBuildingRow(buildingId) {
    if (!buildingId) return null;
    return db.houses.get(buildingId);
  }

  async recordFarmSaleToMarket(farmId, sale) {
    const farmData = await db.houses.get(farmId);
    if (!farmData) return;

    const salesToMarket = farmData.salesToMarket || [];
    const salesToWindmill = farmData.salesToWindmill || [];
    const currentYear = sale.year ?? 0;

    salesToMarket.push({
      year: currentYear,
      month: sale.month ?? 0,
      monthName: sale.monthName || '',
      turn: sale.turn ?? 0,
      productType: sale.productType,
      quantity: sale.quantity,
      marketId: sale.marketId,
      date: new Date().toISOString(),
    });

    const filteredSales = salesToMarket.filter((entry) => entry.year === currentYear);

    await this.#putFields(farmId, {
      salesToMarket: filteredSales,
      salesToWindmill,
    });
  }
}
