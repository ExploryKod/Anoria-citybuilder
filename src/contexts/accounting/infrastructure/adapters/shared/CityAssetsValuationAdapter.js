import { CityAssetsValuationPort } from '../../../application/ports/CityAssetsValuationPort.js';

/**
 * Cross-context adapter — city built-asset valuation.
 * Collaborator is injected by composition (no import of the composition root).
 *
 * @param {{ getCityBuildingValuation: () => Promise<{ totalValue: number, pricesByType: Record<string, number> }> }} cityAssets
 */
export class CityAssetsValuationAdapter extends CityAssetsValuationPort {
  /**
   * @param {{ getCityBuildingValuation: () => Promise<{ totalValue: number, pricesByType: Record<string, number> }> }} cityAssets
   */
  constructor(cityAssets) {
    super();
    if (!cityAssets?.getCityBuildingValuation) {
      throw new Error('CityAssetsValuationAdapter: cityAssets collaborator required');
    }
    this._cityAssets = cityAssets;
  }

  /** @inheritdoc */
  async getCityBuildingValuation() {
    return this._cityAssets.getCityBuildingValuation();
  }
}
