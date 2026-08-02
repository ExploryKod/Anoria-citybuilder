import {
  getProductTradeConditions,
  isStockableProduct,
} from '../catalogs/ProductCatalog.js';

/**
 * @param {object} params
 * @param {object|null} params.productConfig
 * @param {number} params.quantity
 * @param {number} params.currentYearlyTotal
 * @param {object|null} [params.conditions]
 */
export function canImportProduct({
  productConfig,
  quantity,
  currentYearlyTotal,
  conditions = null,
}) {
  if (!productConfig) {
    return false;
  }

  const buyingMax = productConfig.buyingMax || 0;
  if (currentYearlyTotal + quantity > buyingMax) {
    return false;
  }

  return true;
}

/**
 * @param {object} params
 * @param {object|null} params.productConfig
 * @param {number} params.quantity
 * @param {number} params.currentYearlyTotal
 * @param {number} params.availableStock
 * @param {string} params.productId
 * @param {object|null} [params.conditions]
 */
export function canExportProduct({
  productConfig,
  quantity,
  currentYearlyTotal,
  availableStock,
  productId,
  conditions = null,
}) {
  if (!productConfig) {
    return false;
  }

  const sellingMax = productConfig.sellingMax || 0;
  if (currentYearlyTotal + quantity > sellingMax) {
    return false;
  }

  const conds = conditions || getProductTradeConditions(productId, 'export');
  if (conds.requiresStock && availableStock < quantity) {
    return false;
  }

  return true;
}

export { isStockableProduct, getProductTradeConditions };
