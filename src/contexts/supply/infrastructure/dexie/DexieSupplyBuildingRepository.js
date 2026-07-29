import { createSupplyBuildingSnapshot } from '../../domain/SupplyBuildingSnapshot.js';
import { createSupplyBuildingView } from '../../domain/SupplyBuildingView.js';
import { createFoodStock } from '../../domain/value-objects/FoodStock.js';
import { publishedIdFromHouseRow } from '../../../../shared/building-identity/index.js';

/**
 * Dexie / HousesStore adapter for Supply.
 */
export class DexieSupplyBuildingRepository {
  /**
   * @param {import('../../../../js/stores/HousesStore.js').default} housesStore
   */
  constructor(housesStore) {
    this.housesStore = housesStore;
  }

  #defaultMaxStock(type) {
    const t = type || '';
    return t.includes('Windmill') || t.includes('windmill') ? 1000 : 500;
  }

  #toSnapshot(house) {
    const employees = house.employees || {};
    const type = house.type || '';
    return createSupplyBuildingSnapshot({
      id: publishedIdFromHouseRow(house),
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
      id: publishedIdFromHouseRow(house),
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
    });
  }

  async findById(buildingId) {
    if (!buildingId) return null;
    const house = await this.housesStore.getHouse(buildingId);
    if (!house) return null;
    return this.#toSnapshot(house);
  }

  async findSupplyView(buildingId) {
    if (!buildingId) return null;
    const house = await this.housesStore.getHouse(buildingId);
    if (!house) return null;
    return this.#toView(house);
  }

  async listAllSupplyViews() {
    const houses = await this.housesStore.listAllHouses();
    return houses.map((house) => this.#toView(house));
  }

  async saveStocks(buildingId, stocks) {
    const normalized = createFoodStock(stocks);
    await this.housesStore.updateHouseFields(buildingId, {
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
    await this.housesStore.updateHouseFields(buildingId, fields);
  }

  async saveConsumptionMetadata(buildingId, { lastConsumptionMonth }) {
    if (lastConsumptionMonth === undefined || lastConsumptionMonth === null) return;
    await this.housesStore.updateHouseFields(buildingId, {
      lastConsumptionMonth,
    });
  }

  async saveMarketFlags(buildingId, flags) {
    await this.housesStore.updateHouseFields(buildingId, flags);
  }

  async findMarkets() {
    const houses = await this.housesStore.listAllHouses();
    return houses
      .filter((house) => {
        const type = house.type || '';
        return type.includes('Market');
      })
      .map((house) => this.#toSnapshot(house));
  }

  async findHouses() {
    const houses = await this.housesStore.listAllHouses();
    return houses
      .filter((house) => {
        const type = house.type || '';
        return type.includes('House') || type.includes('house');
      })
      .map((house) => this.#toSnapshot(house));
  }

  async findWindmills() {
    const houses = await this.housesStore.listAllHouses();
    return houses
      .filter((house) => {
        const type = house.type || '';
        return type.includes('Windmill') || type.includes('windmill');
      })
      .map((house) => this.#toSnapshot(house));
  }

  async findFarms() {
    const houses = await this.housesStore.listAllHouses();
    return houses
      .filter((house) => {
        const type = house.type || '';
        return type.includes('Farm') || type.includes('farm');
      })
      .map((house) => this.#toSnapshot(house));
  }
}
