/**
 * Read model: total built asset value + sample price per building type.
 * Source: `houses.price` (patrimoine bâti — not budget ledger).
 */
export class GetCityBuildingValuation {
  /**
   * @param {{ listBuildingRows: () => Promise<object[]> }} buildingInventory
   */
  constructor(buildingInventory) {
    this.buildingInventory = buildingInventory;
  }

  /**
   * @returns {Promise<{ totalValue: number, pricesByType: Record<string, number> }>}
   */
  async execute() {
    const rows = await this.buildingInventory.listBuildingRows();
    let totalValue = 0;
    /** @type {Record<string, number>} */
    const pricesByType = {};

    for (const row of rows) {
      const price = row.price || 0;
      totalValue += price;

      const houseType = row.type || 'unknown';
      if (pricesByType[houseType] === undefined) {
        pricesByType[houseType] = price;
      }
    }

    return { totalValue, pricesByType };
  }
}
