import { getProductStockKey } from '../../../../commerce/domain/catalogs/ProductCatalog.js';
import {
  createEmptyCommerceStocks,
  FACTORY_TO_BARN_TRANSFERS,
} from '../../../domain/catalogs/BarnCommerceCatalog.js';
import { HUB_KIND, listHubProducts } from '../../../domain/catalogs/HubStorageCatalog.js';
import {
  getHubProductRemainingInbound,
  listHubFetchProductIds,
  normalizeHubStorageOrders,
} from '../../../domain/policies/HubStorageOrdersPolicy.js';
import {
  creditBarnStock,
  debitBarnStock,
  getBarnProductStock,
  getBarnTotalCapacity,
  isOperationalCommerceBarn,
} from '../../../domain/policies/BarnStockPolicy.js';
import { instanceIdFromHouseRow } from '../../../../../shared/building-identity/index.js';

/**
 * Pull commodity stock into a hub when order mode is `fetch` (Amener).
 */
export class ExecuteHubFetchOrders {
  /**
   * @param {import('../../infrastructure/dexie/DexieSupplyBuildingRepository.js').DexieSupplyBuildingRepository} supplyBuildingRepository
   * @param {import('../../infrastructure/dexie/DexieFactoryBuildingRepository.js').DexieFactoryBuildingRepository} factoryBuildingRepository
   */
  constructor(supplyBuildingRepository, factoryBuildingRepository) {
    this.supplyRepository = supplyBuildingRepository;
    this.factoryRepository = factoryBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {'barn'|'windmill'} params.hubKind
   * @param {string} params.buildingId
   */
  async execute({ hubKind, buildingId }) {
    if (hubKind !== HUB_KIND.BARN) {
      return { fetched: 0, transfers: [] };
    }

    const barn = await this.supplyRepository.findRowById(buildingId);
    if (!isOperationalCommerceBarn(barn)) {
      return { fetched: 0, transfers: [] };
    }

    const productIds = listHubProducts(HUB_KIND.BARN);
    const orders = normalizeHubStorageOrders(barn.hubStorageOrders, productIds);
    const fetchIds = listHubFetchProductIds(orders);
    if (fetchIds.length === 0) {
      return { fetched: 0, transfers: [] };
    }

    let stocks = createEmptyCommerceStocks(barn.commerceStocks);
    const totalCapacity = getBarnTotalCapacity(barn);
    /** @type {Array<{ productId: string, quantity: number, source: string }>} */
    const transfers = [];

    for (const productId of fetchIds) {
      await this.#pullFromOtherBarns({
        targetId: buildingId,
        productId,
        barn,
        orders,
        productIds,
        totalCapacity,
        stocks,
        transfers,
      });

      await this.#pullFromCommerceFactories({
        productId,
        barn,
        orders,
        productIds,
        totalCapacity,
        stocks,
        transfers,
      });
    }

    await this.supplyRepository.saveCommerceStocks(buildingId, stocks);

    const fetched = transfers.reduce((sum, t) => sum + t.quantity, 0);
    return { fetched, transfers };
  }

  async #pullFromOtherBarns({
    targetId,
    productId,
    barn,
    orders,
    productIds,
    totalCapacity,
    stocks,
    transfers,
  }) {
    const barns = await this.supplyRepository.findCommerceBarnRows();

    for (const source of barns) {
      const sourceId = instanceIdFromHouseRow(source);
      if (sourceId === targetId || !isOperationalCommerceBarn(source)) continue;

      const remaining = getHubProductRemainingInbound({
        productId,
        productIds,
        orders,
        stocks,
        totalCapacity,
      });
      if (remaining <= 0) break;

      const sourceStocks = createEmptyCommerceStocks(source.commerceStocks);
      const available = getBarnProductStock(sourceStocks, productId);
      if (available <= 0) continue;

      const toMove = Math.min(remaining, available);
      const debited = debitBarnStock(sourceStocks, productId, toMove);
      if (!debited) continue;

      await this.supplyRepository.saveCommerceStocks(sourceId, debited);

      const credited = creditBarnStock(barn, stocks, productId, toMove);
      if (!credited) continue;

      const added = (credited[productId] ?? 0) - (stocks[productId] ?? 0);
      if (added <= 0) continue;

      Object.assign(stocks, credited);
      transfers.push({ productId, quantity: added, source: `barn:${sourceId}` });
    }
  }

  async #pullFromCommerceFactories({
    productId,
    barn,
    orders,
    productIds,
    totalCapacity,
    stocks,
    transfers,
  }) {
    const transferDef = FACTORY_TO_BARN_TRANSFERS.find((t) => t.productId === productId);
    if (!transferDef) return;

    const stockKey = getProductStockKey(productId) ?? productId;
    const remaining = getHubProductRemainingInbound({
      productId,
      productIds,
      orders,
      stocks,
      totalCapacity,
    });
    if (remaining <= 0) return;

    const factories = await this.factoryRepository.findFactories();

    for (const factory of factories) {
      const inbound = getHubProductRemainingInbound({
        productId,
        productIds,
        orders,
        stocks,
        totalCapacity,
      });
      if (inbound <= 0) break;
      if (factory.supplyFlow !== 'commerce') continue;

      const factoryId = this.factoryRepository.instanceId(factory);
      const field = factory[transferDef.factoryField] || {};
      const available = Math.max(0, Math.floor(Number(field[transferDef.factoryKey]) || 0));
      if (available <= 0) continue;

      const toMove = Math.min(inbound, available);
      const nextField = {
        ...field,
        [transferDef.factoryKey]: available - toMove,
      };
      await this.factoryRepository.updateFields(factoryId, {
        [transferDef.factoryField]: nextField,
      });

      const credited = creditBarnStock(barn, stocks, stockKey, toMove);
      if (!credited) continue;

      const added = (credited[stockKey] ?? 0) - (stocks[stockKey] ?? 0);
      if (added <= 0) continue;

      Object.assign(stocks, credited);
      transfers.push({ productId, quantity: added, source: `factory:${factoryId}` });
    }
  }
}
