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

  /** 
   * Persist house consumption details (consumed, demanded, unfed by type).
   * @param {string} _buildingId
   * @param {{
   *   month: number,
   *   consumed: Record<string, number>,
   *   demanded: Record<string, number>,
   *   unfed: Record<string, number>,
   *   totalUnfed: number,
   * }} _consumptionRecord
   */
  async saveConsumptionRecord(_buildingId, _consumptionRecord) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  /** Persist level-1 subsistence food timing (`lastSubsistenceMonth`). */
  async saveSubsistenceMetadata(_buildingId, _metadata) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async saveWindmillLastCollection(_buildingId, _lastCollection) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async recordFarmSaleToWindmill(_farmId, _sale) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async resetFarmSalesForYear(_year) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  /** Persist UI / status flags (isBuying, marketTooFar, …). */
  async saveMarketFlags(_buildingId, _flags) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async saveSupplyWindmillId(_marketId, _windmillId) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async saveLinkedMarkets(_windmillId, _linkedMarkets) {
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

  /** Raw Dexie rows for spatial / neighbor orchestration. */
  async listAllBuildingRows() {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async findBuildingRow(_buildingId) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async recordFarmSaleToMarket(_farmId, _sale) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }
}
