import { getProductStockKey } from '../../../commerce/domain/catalogs/ProductCatalog.js';
import {
  createEmptyCommerceStocks,
  BARN_COMMERCE_PRODUCTS,
} from '../../domain/catalogs/BarnCommerceCatalog.js';
import {
  canCreditBarnStock,
  creditBarnStock,
  debitBarnStock,
  getBarnProductStock,
  getBarnRemainingCapacity,
  isOperationalCommerceBarn,
} from '../../domain/policies/BarnStockPolicy.js';
import { instanceIdFromHouseRow } from '../../../../shared/building-identity/index.js';

/**
 * Read/write commerce hub stock on Barn-001 buildings.
 */
export class BarnStockOperations {
  /**
   * @param {import('../../infrastructure/dexie/DexieSupplyBuildingRepository.js').DexieSupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.repository = supplyBuildingRepository;
  }

  /**
   * @param {string} productId
   */
  async getTotalStock(productId) {
    const stockKey = getProductStockKey(productId);
    if (!stockKey) return 0;

    const barns = await this.repository.findCommerceBarnRows();
    let total = 0;
    for (const barn of barns) {
      if (!isOperationalCommerceBarn(barn)) continue;
      total += getBarnProductStock(barn.commerceStocks, stockKey);
    }
    return total;
  }

  /**
   * @param {string} productId
   * @param {number} quantity
   * @param {string|null} [_partnerId]
   */
  async addToStock(productId, quantity, _partnerId = null) {
    const stockKey = getProductStockKey(productId);
    if (!stockKey || quantity <= 0) return null;

    const barns = await this.repository.findCommerceBarnRows();
    let remaining = quantity;
    let credited = 0;
    let barnId = null;

    for (const barn of barns) {
      if (!isOperationalCommerceBarn(barn)) continue;
      if (remaining <= 0) break;

      const id = instanceIdFromHouseRow(barn);
      const currentStocks = createEmptyCommerceStocks(barn.commerceStocks);
      const capacityLeft = getBarnRemainingCapacity(barn, currentStocks);
      const toAdd = Math.min(remaining, capacityLeft);
      if (toAdd <= 0) continue;

      const nextStocks = creditBarnStock(barn, currentStocks, stockKey, toAdd);
      if (!nextStocks) continue;

      const added = (nextStocks[stockKey] ?? 0) - (currentStocks[stockKey] ?? 0);
      if (added <= 0) continue;

      await this.repository.saveCommerceStocks(id, nextStocks);
      barn.commerceStocks = nextStocks;
      remaining -= added;
      credited += added;
      barnId = id;
    }

    if (credited <= 0) return null;
    return { barnId, addedQuantity: credited };
  }

  /**
   * @param {string} productId
   * @param {number} quantity
   * @param {string|null} [_partnerId]
   */
  async reduceStock(productId, quantity, _partnerId = null) {
    const stockKey = getProductStockKey(productId);
    if (!stockKey || quantity <= 0) return false;

    const barns = await this.repository.findCommerceBarnRows();
    let remaining = quantity;

    for (const barn of barns) {
      if (!isOperationalCommerceBarn(barn)) continue;
      if (remaining <= 0) break;

      const id = instanceIdFromHouseRow(barn);
      const currentStocks = createEmptyCommerceStocks(barn.commerceStocks);
      const available = getBarnProductStock(currentStocks, stockKey);
      const toRemove = Math.min(remaining, available);
      if (toRemove <= 0) continue;

      const nextStocks = debitBarnStock(currentStocks, stockKey, toRemove);
      if (!nextStocks) continue;

      await this.repository.saveCommerceStocks(id, nextStocks);
      barn.commerceStocks = nextStocks;
      remaining -= toRemove;
    }

    return remaining <= 0;
  }

  /**
   * @returns {Promise<Record<string, number>>}
   */
  async getAllCommerceStocks() {
    const totals = Object.fromEntries(BARN_COMMERCE_PRODUCTS.map((id) => [id, 0]));
    const barns = await this.repository.findCommerceBarnRows();

    for (const barn of barns) {
      if (!isOperationalCommerceBarn(barn)) continue;
      for (const productId of BARN_COMMERCE_PRODUCTS) {
        totals[productId] += getBarnProductStock(barn.commerceStocks, productId);
      }
    }

    return totals;
  }

  /**
   * Credit a specific barn (factory transfer).
   *
   * @param {string} barnId
   * @param {string} productId
   * @param {number} quantity
   */
  async creditBarn(barnId, productId, quantity) {
    const stockKey = getProductStockKey(productId) ?? productId;
    if (quantity <= 0) return 0;

    const barn = await this.repository.findRowById(barnId);
    if (!isOperationalCommerceBarn(barn)) return 0;

    const currentStocks = createEmptyCommerceStocks(barn.commerceStocks);
    const nextStocks = creditBarnStock(barn, currentStocks, stockKey, quantity);
    if (!nextStocks) return 0;

    const credited = (nextStocks[stockKey] ?? 0) - (currentStocks[stockKey] ?? 0);
    if (credited <= 0) return 0;

    await this.repository.saveCommerceStocks(barnId, nextStocks);
    return credited;
  }
}
