/**
 * Port: persistence for supply-relevant building fields.
 */
export class SupplyBuildingRepository {
  async findById(_buildingId) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  /** Read-side: stocks + Supply UI flags / sales history. */
  async findSupplyView(_buildingId) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  /** Read-side: all buildings as supply views. */
  async listAllSupplyViews() {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async saveStocks(_buildingId, _stocks) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  /** Persist farm harvest timing (`lastProductionYear`, …). */
  async saveHarvestMetadata(_buildingId, _metadata) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  /** Persist house consumption timing (`lastConsumptionMonth`). */
  async saveConsumptionMetadata(_buildingId, _metadata) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  /** Persist UI / status flags (isBuying, marketTooFar, …). */
  async saveMarketFlags(_buildingId, _flags) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async findMarkets() {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async findHouses() {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async findWindmills() {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async findFarms() {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }
}
