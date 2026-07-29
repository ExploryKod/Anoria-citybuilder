import { instanceIdFromHouseRow } from '../../../../shared/building-identity/index.js';

/**
 * Dexie / HousesStore adapter for factory production.
 */
export class DexieFactoryBuildingRepository {
  /**
   * @param {import('../../../../js/stores/HousesStore.js').default} housesStore
   */
  constructor(housesStore) {
    this.housesStore = housesStore;
  }

  async findFactories() {
    const houses = await this.housesStore.listAllHouses();
    return houses.filter((house) => {
      const type = house.type || '';
      return type.includes('Winery-001');
    });
  }

  async findById(factoryId) {
    if (!factoryId) return null;
    return this.housesStore.getHouse(factoryId);
  }

  async updateFields(factoryId, fields) {
    await this.housesStore.updateHouseFields(factoryId, fields);
  }

  async listNatureItems() {
    const houses = await this.housesStore.listAllHouses();
    return houses.filter((house) => (house.category || '') === 'nature');
  }

  async listAllRows() {
    return this.housesStore.listAllHouses();
  }

  instanceId(row) {
    return instanceIdFromHouseRow(row);
  }
}
