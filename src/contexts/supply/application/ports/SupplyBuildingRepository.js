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

  /**
   * Generic field merge — circuit descriptors use this for their own
   * bookkeeping (timing fields, per-circuit records, ...) instead of each
   * needing a dedicated repository method.
   */
  async updateBuildingFields(_buildingId, _fields) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async saveHubLastCollection(_hubId, _lastCollection) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async recordSourceSaleToHub(_sourceId, _sale) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async resetSourceSalesForYear(_year) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  /** Persist UI / status flags (isBuying, distributorTooFar, …). */
  async saveSupplyFlags(_buildingId, _flags) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async saveDistributorHubId(_distributorId, _hubId, _linkField) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async saveHubLinkedDistributors(_hubId, _linkedDistributors) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  /**
   * Generic role/category building selection (see ResourceRolePolicy) — the
   * one every resource cycle uses. No named shortcuts (findDistributors/
   * findConsumers/findHubs/findProducers) — callers pass the role they mean
   * ('distributor'/'consumer'/'hub'/'producer').
   * @param {import('../../domain/policies/ResourceRolePolicy.js').ResourceRoleKind} _role
   * @param {string | string[]} [_categories]
   */
  async findByResourceRole(_role, _categories) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  /**
   * Every placed natural resource (a tree, ...) as `{ id, type, x, y }` —
   * what a raw-material producer draws on (see the `source` catalog fact).
   */
  async listNaturalResources() {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  /** Raw Dexie rows for spatial / neighbor orchestration. */
  async listAllBuildingRows() {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async findBuildingRow(_buildingId) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }

  async recordSourceSaleToDistributor(_sourceId, _sale) {
    throw new Error('SupplyBuildingRepository: port not implemented');
  }
}
