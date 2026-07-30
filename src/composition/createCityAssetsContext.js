import { GetCityBuildingValuation } from '../shared/city-assets/application/queries/GetCityBuildingValuation.js';
import { DexieBuildingInventoryReader } from '../shared/city-assets/infrastructure/dexie/DexieBuildingInventoryReader.js';

/**
 * Composition root — city built-asset read models (not accounting ledger).
 *
 * @param {object} [deps]
 * @param {import('../shared/city-assets/infrastructure/dexie/DexieBuildingInventoryReader.js').DexieBuildingInventoryReader} [deps.buildingInventory]
 */
export function createCityAssetsContext({ buildingInventory } = {}) {
  const inventory = buildingInventory ?? new DexieBuildingInventoryReader();
  const getCityBuildingValuation = new GetCityBuildingValuation(inventory);

  return {
    async getCityBuildingValuation() {
      return getCityBuildingValuation.execute();
    },
  };
}

/** @type {ReturnType<typeof createCityAssetsContext> | null} */
let sharedCityAssets = null;

export function getOrCreateCityAssetsContext() {
  if (!sharedCityAssets) {
    sharedCityAssets = createCityAssetsContext();
  }
  return sharedCityAssets;
}

/** @internal Tests only */
export function resetCityAssetsContextForTests() {
  sharedCityAssets = null;
}
