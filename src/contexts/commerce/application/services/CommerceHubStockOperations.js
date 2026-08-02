/**
 * Commerce hub stock — barn warehouse (César III entrepôt).
 * Stub until Barn-001 is wired in supply; never reads or writes windmill stock.
 */
export class CommerceHubStockOperations {
  /** @param {string} _productId */
  async getTotalStock(_productId) {
    return 0;
  }

  /**
   * @param {string} _productId
   * @param {number} _quantity
   * @param {string|null} [_partnerId]
   */
  async addToStock(_productId, _quantity, _partnerId = null) {
    return null;
  }

  /**
   * @param {string} _productId
   * @param {number} _quantity
   * @param {string|null} [_partnerId]
   */
  async reduceStock(_productId, _quantity, _partnerId = null) {
    return false;
  }
}
