/**
 * Command — process a commerce product export (partner or internal limits).
 */
import { getPartnerTradePrice } from '../../domain/policies/PartnerTradePolicy.js';
import { getDefaultTradePrice } from '../../domain/catalogs/ProductCatalog.js';
import { canExecuteTrade, mergeProductTradeToggles } from '../../domain/policies/PlayerTradeTogglePolicy.js';

export class ProcessProductExport {
  /** @param {import('../services/CommerceSimulationService.js').CommerceSimulationService} simulation */
  constructor(simulation) {
    this.simulation = simulation;
  }

  /**
   * @param {object} params
   * @param {string} params.productId
   * @param {number} params.time
   * @param {number} [params.quantity]
   * @param {object|null} [params.conditions]
   * @param {string|null} [params.partnerId]
   */
  async execute({ productId, time, quantity = 1, conditions = null, partnerId = null }) {
    const simulation = this.simulation;
    const config = simulation.getProductConfig(productId);
    if (!config) {
      console.warn(`[CommerceService] No config found for product: ${productId}`);
      return null;
    }

    if (partnerId) {
      if (!simulation.canTradeWithPartner(partnerId, productId, 'export', time)) {
        return null;
      }
      const partnerLimit = simulation.getPartnerTradeLimit(partnerId, productId, 'export');
      if (partnerLimit && quantity > partnerLimit.maxPerTurn) {
        quantity = partnerLimit.maxPerTurn;
      }
    }

    const availableStock = await simulation.commerceHubStock.getTotalStock(productId);

    if (!mergeProductTradeToggles(config).industryActive) {
      return null;
    }

    if (!canExecuteTrade({ operation: 'export', productConfig: config, stock: availableStock })) {
      return null;
    }

    if (!simulation.canExportProduct(productId, quantity, availableStock, conditions)) {
      return null;
    }

    const partner = partnerId ? simulation.getPartner(partnerId) : null;
    const partnerName = partner ? partner.name : null;
    const pricePerUnit =
      getPartnerTradePrice(partner, productId, 'export')
      ?? getDefaultTradePrice(productId, 'export')
      ?? 15;
    const totalRevenue = quantity * pricePerUnit;

    if (simulation.isStockable(productId)) {
      const stockReduced = await simulation.commerceHubStock.reduceStock(productId, quantity, partnerId);
      if (!stockReduced) {
        return null;
      }
    }

    const remainingStock = simulation.isStockable(productId) ? availableStock - quantity : 0;

    let description = `Export ${productId}`;
    if (partnerName) {
      const breakdown = [{
        label: partnerName,
        quantity,
        unitCost: pricePerUnit,
        total: totalRevenue,
      }];
      description += ` |BREAKDOWN|${JSON.stringify(breakdown)}|BREAKDOWN|`;
      if (remainingStock > 0) {
        description += ` - Stock restant: ${remainingStock}`;
      }
    } else {
      description += ` (${quantity} panier × ${pricePerUnit}€)${remainingStock > 0 ? ` - Stock restant: ${remainingStock}` : ''}`;
    }

    await simulation.recordExportIncome(totalRevenue, description, productId, partnerId);

    if (partnerId) {
      simulation.updatePartnerTrade(partnerId, productId, 'export');
    }

    simulation.yearlyExports[productId] = (simulation.yearlyExports[productId] || 0) + quantity;

    simulation.commerceRepository.updateProductStats(productId, {
      exports: simulation.yearlyExports[productId],
    });

    return {
      productId,
      quantity,
      pricePerUnit,
      totalRevenue,
      description,
      remainingStock: simulation.isStockable(productId) ? remainingStock : 0,
    };
  }
}
