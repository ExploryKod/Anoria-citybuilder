/**
 * Commerce hub stock — delegates to Supply BarnStockOperations (Barn-001).
 */
export class CommerceHubStockOperations {
  /**
   * @param {import('../../../supply/application/services/BarnStockOperations.js').BarnStockOperations|null} [barnStockOperations]
   */
  constructor(barnStockOperations = null) {
    this.delegate = barnStockOperations;
  }

  /** @param {string} productId */
  async getTotalStock(productId) {
    if (!this.delegate) return 0;
    return this.delegate.getTotalStock(productId);
  }

  /**
   * @param {string} productId
   * @param {number} quantity
   * @param {string|null} [partnerId]
   */
  async addToStock(productId, quantity, partnerId = null) {
    if (!this.delegate) return null;
    return this.delegate.addToStock(productId, quantity, partnerId);
  }

  /**
   * @param {string} productId
   * @param {number} quantity
   * @param {string|null} [partnerId]
   */
  async reduceStock(productId, quantity, partnerId = null) {
    if (!this.delegate) return false;
    return this.delegate.reduceStock(productId, quantity, partnerId);
  }
}
