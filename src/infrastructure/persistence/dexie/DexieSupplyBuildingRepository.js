import { createSupplyBuildingSnapshot } from '../../../contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyBuildingView } from '../../../contexts/supply/domain/SupplyBuildingView.js';
import { createFoodStock } from '../../../contexts/supply/domain/value-objects/FoodStock.js';

/**
 * Dexie / HousesStore adapter for Supply.
 */
export class DexieSupplyBuildingRepository {
  /**
   * @param {import('../../../js/stores/HousesStore.js').default} housesStore
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
      id: house.id || house.name,
      type,
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      stocks: house.stocks || {},
      maxStock: house.maxStock ?? this.#defaultMaxStock(type),
      worker: employees.worker ?? 0,
      workerNeed: employees.worker_need ?? 0,
      neighbors: house.neighbors || [],
    });
  }

  #toView(house) {
    const type = house.type || '';
    return createSupplyBuildingView({
      id: house.id || house.name,
      type,
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      stocks: house.stocks || {},
      maxStock: house.maxStock ?? this.#defaultMaxStock(type),
      neighbors: house.neighbors || [],
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
}
