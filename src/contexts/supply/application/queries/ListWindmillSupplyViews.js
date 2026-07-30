import { classifySupplyKind } from './GetBuildingSupplyView.js';

/**
 * Query: windmill supply DTOs for storage UI (stocks / collection — not commerce settings).
 */
export class ListWindmillSupplyViews {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @returns {Promise<Array<object>>}
   */
  async execute() {
    const views = await this.supplyBuildingRepository.listAllSupplyViews();
    return views
      .filter((view) => classifySupplyKind(view.type) === 'windmill')
      .map((view) => ({
        buildingId: view.id,
        name: view.id,
        type: view.type,
        x: view.x,
        y: view.y,
        kind: 'windmill',
        stocks: { ...view.stocks },
        maxStock: view.maxStock,
        isCollecting: view.isCollecting,
        lastCollection: view.lastCollection ? { ...view.lastCollection } : null,
        lastImport: view.lastImport ? { ...view.lastImport } : null,
        lastImportDetails: view.lastImportDetails
          ? { ...view.lastImportDetails }
          : null,
        isActive: view.isActive,
        commercializeEnabled: view.commercializeEnabled,
      }));
  }
}
