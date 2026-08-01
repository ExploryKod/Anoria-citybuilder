/**
 * Port: built-asset valuation (City Assets context).
 */
export class CityAssetsValuationPort {
  /**
   * @returns {Promise<{ totalValue: number, pricesByType: Record<string, number> }>}
   */
  async getCityBuildingValuation() {
    throw new Error('CityAssetsValuationPort: port not implemented');
  }
}
